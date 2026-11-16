'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { StockState } from '@20mart/shared';
import { storeApi, StoreApiError, useStore } from './store';
import { LocationPicker } from '../components/LocationPicker';

/**
 * Customer delivery location (PIN code) and location-specific availability.
 * The PIN lives in a cookie set by /api/location; every server call re-validates it.
 * Manual entry always works; "use my current location" needs the customer's permission
 * AND a configured geocoding provider on the server.
 */

export interface Serviceability {
  pincode: string;
  serviceable: boolean;
  code: 'OK' | 'INVALID' | 'DISABLED' | 'NOT_SERVICEABLE' | 'PAUSED' | 'NOT_CONFIGURED' | 'AT_CAPACITY';
  reason?: string;
  area?: string | null;
  city?: string | null;
  feePaise: number;
  estimateHours: number | null;
  estimateText: string | null;
  minOrderPaise?: number;
}

export interface ProductAvailability {
  state: StockState;
  deliverable: boolean;
  variants: Record<string, StockState>;
}

interface LocationContextType {
  ready: boolean;
  pincode: string | null;
  serviceability: Serviceability | null;
  gpsAvailable: boolean;
  /** Short label: "Satellite, 380015" / "380015". */
  label: string | null;
  setPincode: (pincode: string) => Promise<Serviceability>;
  /** Browser geolocation → PIN. Resolves to an error message, or null when the PIN was set. */
  locateMe: () => Promise<string | null>;
  pickerOpen: boolean;
  openPicker: () => void;
  closePicker: () => void;
  /** Location availability per product (undefined until loaded / when no location is set). */
  availability: Record<string, ProductAvailability>;
  requestAvailability: (ids: string[]) => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

type LocationResponse = { pincode: string | null; serviceability: Serviceability | null; gpsAvailable?: boolean };

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { refreshCart, showToast } = useStore();
  const [ready, setReady] = useState(false);
  const [pincode, setPin] = useState<string | null>(null);
  const [serviceability, setServiceability] = useState<Serviceability | null>(null);
  const [gpsAvailable, setGpsAvailable] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [availability, setAvailability] = useState<Record<string, ProductAvailability>>({});
  const pending = useRef(new Set<string>());
  const requested = useRef(new Set<string>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinRef = useRef<string | null>(null);

  const apply = useCallback((r: LocationResponse) => {
    setPin(r.pincode);
    pinRef.current = r.pincode;
    setServiceability(r.serviceability);
    if (r.gpsAvailable !== undefined) setGpsAvailable(r.gpsAvailable);
    // New location → availability must be re-fetched for everything on screen.
    requested.current.forEach((id) => pending.current.add(id));
    requested.current.clear();
    setAvailability({});
  }, []);

  const flush = useCallback(async () => {
    timer.current = null;
    if (!pinRef.current || !pending.current.size) return;
    const ids = [...pending.current].slice(0, 60);
    ids.forEach((id) => {
      pending.current.delete(id);
      requested.current.add(id);
    });
    try {
      const r = await storeApi<{ pincode: string | null; products: Record<string, ProductAvailability> }>(`/api/availability?ids=${ids.join(',')}`);
      if (r.pincode === pinRef.current) setAvailability((a) => ({ ...a, ...r.products }));
    } catch {
      ids.forEach((id) => requested.current.delete(id)); // retried on next request
    }
    if (pending.current.size) timer.current = setTimeout(flush, 30);
  }, []);

  const requestAvailability = useCallback(
    (ids: string[]) => {
      for (const id of ids) if (!requested.current.has(id)) pending.current.add(id);
      if (pinRef.current && pending.current.size && !timer.current) timer.current = setTimeout(flush, 30);
    },
    [flush]
  );

  useEffect(() => {
    storeApi<LocationResponse>('/api/location')
      .then(apply)
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, [apply]);

  useEffect(() => {
    if (pincode && pending.current.size && !timer.current) timer.current = setTimeout(flush, 30);
  }, [pincode, flush]);

  const setPincode = useCallback(
    async (pin: string) => {
      const r = await storeApi<LocationResponse>('/api/location', { body: { pincode: pin } });
      apply(r);
      void refreshCart(); // cart availability depends on the location
      return r.serviceability!;
    },
    [apply, refreshCart]
  );

  const locateMe = useCallback(async (): Promise<string | null> => {
    if (!gpsAvailable) return 'Location lookup is not available. Please enter your PIN code.';
    if (typeof navigator === 'undefined' || !navigator.geolocation) return 'Your browser cannot share location. Please enter your PIN code.';
    const coords = await new Promise<GeolocationCoordinates | string>((resolve) =>
      navigator.geolocation.getCurrentPosition(
        (p) => resolve(p.coords),
        (e) => resolve(e.code === e.PERMISSION_DENIED ? 'Location permission was denied. Please enter your PIN code.' : 'Could not get your location. Please enter your PIN code.'),
        { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 }
      )
    );
    if (typeof coords === 'string') return coords;
    try {
      const r = await storeApi<{ pincode: string | null; locality: string | null; city: string | null }>('/api/location/reverse', {
        body: { lat: coords.latitude, lng: coords.longitude },
      });
      if (!r.pincode) return 'We found your area but not its PIN code. Please enter it.';
      const s = await setPincode(r.pincode);
      showToast(s.serviceable ? `Delivering to ${r.pincode}` : `Location set to ${r.pincode}`);
      return null;
    } catch (e) {
      return e instanceof StoreApiError ? e.message : 'Could not look up your location. Please enter your PIN code.';
    }
  }, [gpsAvailable, setPincode, showToast]);

  const label = pincode ? [serviceability?.area, pincode].filter(Boolean).join(', ') : null;

  const value = useMemo<LocationContextType>(
    () => ({
      ready,
      pincode,
      serviceability,
      gpsAvailable,
      label,
      setPincode,
      locateMe,
      pickerOpen,
      openPicker: () => setPickerOpen(true),
      closePicker: () => setPickerOpen(false),
      availability,
      requestAvailability,
    }),
    [ready, pincode, serviceability, gpsAvailable, label, setPincode, locateMe, pickerOpen, availability, requestAvailability]
  );

  return (
    <LocationContext.Provider value={value}>
      {children}
      {pickerOpen && <LocationPicker />}
    </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocation must be used within a LocationProvider');
  return ctx;
};

/** Location availability for one product; undefined when no location is set or not loaded yet. */
export function useProductAvailability(productId: string) {
  const { pincode, serviceability, availability, requestAvailability } = useLocation();
  useEffect(() => {
    if (pincode && serviceability?.serviceable) requestAvailability([productId]);
  }, [pincode, serviceability?.serviceable, productId, requestAvailability]);
  if (!pincode || !serviceability?.serviceable) return undefined;
  return availability[productId];
}
