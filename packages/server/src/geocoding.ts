import { z } from 'zod';
import { env, geocodingConfigured } from './env';
import { AppError } from './errors';
import { PINCODE_REGEX } from './settings';

/**
 * Coordinates → delivery PIN code, through the configured provider only. GPS coordinates do not
 * carry a PIN code, so when the provider returns none the customer is asked to type it.
 * Coordinates are used for this single lookup and never stored.
 */
export const coordinatesInput = z.object({
  lat: z.coerce.number().min(6).max(38), // India bounding box (approx.)
  lng: z.coerce.number().min(68).max(98),
});

export interface ResolvedLocation {
  pincode: string | null;
  locality: string | null;
  city: string | null;
}

const TIMEOUT_MS = 6000;

async function fetchJson(url: string, headers: Record<string, string> = {}) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' });
  if (!res.ok) throw new AppError(502, 'GEOCODING_FAILED', 'Could not look up your location. Please enter your PIN code.');
  return res.json() as Promise<unknown>;
}

const pin = (v: unknown) => {
  const s = String(v ?? '').replace(/\s/g, '');
  return PINCODE_REGEX.test(s) ? s : null;
};

async function google(lat: number, lng: number): Promise<ResolvedLocation> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${encodeURIComponent(env().GOOGLE_MAPS_API_KEY)}&region=in`;
  const data = (await fetchJson(url)) as { status?: string; results?: { address_components?: { long_name: string; types: string[] }[] }[] };
  if (data.status !== 'OK' || !data.results?.length) return { pincode: null, locality: null, city: null };
  const comps = data.results.flatMap((r) => r.address_components ?? []);
  const find = (t: string) => comps.find((c) => c.types.includes(t))?.long_name ?? null;
  return { pincode: pin(find('postal_code')), locality: find('sublocality_level_1') ?? find('sublocality') ?? find('neighborhood'), city: find('locality') };
}

async function nominatim(lat: number, lng: number): Promise<ResolvedLocation> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
  const data = (await fetchJson(url, { 'User-Agent': `20Mart-storefront (${env().GEOCODING_CONTACT})`, 'Accept-Language': 'en' })) as {
    address?: Record<string, string>;
  };
  const a = data.address ?? {};
  return { pincode: pin(a.postcode), locality: a.suburb ?? a.neighbourhood ?? a.quarter ?? null, city: a.city ?? a.town ?? a.village ?? a.state_district ?? null };
}

export async function reverseGeocode(raw: unknown): Promise<ResolvedLocation> {
  if (!geocodingConfigured()) throw new AppError(503, 'GEOCODING_UNAVAILABLE', 'Location lookup is not available. Please enter your PIN code.');
  const { lat, lng } = coordinatesInput.parse(raw);
  const r = await (env().GEOCODING_PROVIDER === 'google' ? google(lat, lng) : nominatim(lat, lng)).catch((e) => {
    if (e instanceof AppError) throw e;
    throw new AppError(502, 'GEOCODING_FAILED', 'Could not look up your location. Please enter your PIN code.');
  });
  return r;
}
