import { prisma } from '@20mart/database';
import { formatPaise } from '@20mart/shared';
import { getStoreSettings, PINCODE_REGEX, type StoreSettingsRow } from './settings';
import { warehouseCandidates, type WarehouseCandidate } from './fulfillment';
import { consentedVisitorId, istDay, trackServerEvents, type AnalyticsCaller } from './tracking/events';

const TZ = 'Asia/Kolkata';

function istMinutesNow(now: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
}
const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const to12h = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`;
};

/**
 * Human estimate derived only from configured operational settings.
 * Never promises a window shorter than the configured hours.
 */
export function deliveryEstimateText(hours: number, s: StoreSettingsRow, now = new Date(), cutoffTime: string | null = null) {
  const base = hours <= 24 ? `Delivery within ${hours} hour${hours === 1 ? '' : 's'}` : `Delivery in about ${Math.ceil(hours / 24)} days`;
  const mins = istMinutesNow(now);
  const open = toMinutes(s.operatingHoursStart);
  const close = toMinutes(s.operatingHoursEnd);
  const isOpen = mins >= open && mins < close;
  if (isOpen && cutoffTime && /^\d{2}:\d{2}$/.test(cutoffTime) && mins >= toMinutes(cutoffTime)) {
    return `${base} — orders placed after ${to12h(cutoffTime)} are processed the next day`;
  }
  return isOpen ? `${base} of order confirmation` : `${base} — orders placed now are processed from ${to12h(s.operatingHoursStart)}`;
}

export type ServiceabilityCode = 'OK' | 'INVALID' | 'DISABLED' | 'NOT_SERVICEABLE' | 'PAUSED' | 'NOT_CONFIGURED' | 'AT_CAPACITY';

export interface ServiceabilityResult {
  pincode: string;
  serviceable: boolean;
  code: ServiceabilityCode;
  reason?: string;
  area?: string | null;
  city?: string | null;
  feePaise: number;
  estimateHours: number | null;
  estimateText: string | null;
  zone?: string | null;
  /** Minimum order for this area (zone override or store default). */
  minOrderPaise?: number;
}

const no = (pincode: string, code: ServiceabilityCode, reason: string, extra: Partial<ServiceabilityResult> = {}): ServiceabilityResult => ({
  pincode,
  serviceable: false,
  code,
  reason,
  feePaise: 0,
  estimateHours: null,
  estimateText: null,
  ...extra,
});

/**
 * A PIN code is deliverable ONLY when it is explicitly configured as serviceable, belongs to an
 * active delivery area, and that area is mapped to at least one ACTIVE warehouse with capacity.
 * Fee/estimate precedence: PIN override → warehouse-area mapping → area → store default.
 * Pass `warehouse` to quote for an already-selected fulfilment warehouse.
 */
export async function checkServiceability(
  pincode: string,
  settings?: StoreSettingsRow,
  opts: { warehouse?: WarehouseCandidate | null } = {}
): Promise<ServiceabilityResult> {
  const s = settings ?? (await getStoreSettings());
  const pin = pincode.trim();
  if (!PINCODE_REGEX.test(pin)) return no(pin, 'INVALID', 'Enter a valid 6-digit PIN code');
  if (!s.deliveryEnabled) return no(pin, 'DISABLED', 'Delivery is temporarily unavailable');
  const row = await prisma.serviceablePincode.findUnique({ where: { pincode: pin }, include: { zone: true } });
  if (!row || !row.isServiceable) return no(pin, 'NOT_SERVICEABLE', 'Sorry, we do not deliver to this PIN code yet');
  const place = { area: row.area, city: row.city, zone: row.zone?.name ?? null };
  if (row.zone && !row.zone.isActive) return no(pin, 'PAUSED', 'Delivery to this area is paused right now', place);
  let wh = opts.warehouse ?? null;
  if (!wh) {
    const candidates = await warehouseCandidates(pin);
    if (!candidates.length) return no(pin, 'NOT_CONFIGURED', 'Delivery to this area is not available yet', place);
    wh = candidates.find((c) => !c.atCapacity) ?? null;
    if (!wh) return no(pin, 'AT_CAPACITY', 'We are fully booked for deliveries in this area today. Please try again tomorrow.', place);
  }
  const hours = row.estimateHours ?? wh.estimateHours ?? row.zone?.estimateHours ?? s.defaultEstimateHours;
  return {
    pincode: pin,
    serviceable: true,
    code: 'OK',
    ...place,
    feePaise: row.deliveryFeePaise ?? wh.feePaise ?? row.zone?.deliveryFeePaise ?? s.deliveryFeePaise,
    minOrderPaise: row.zone?.minOrderPaise ?? s.minOrderPaise,
    estimateHours: hours,
    estimateText: deliveryEstimateText(hours, s, new Date(), wh.cutoffTime),
  };
}

export interface DeliveryQuote {
  subtotalPaise: number;
  deliveryChargePaise: number;
  freeDeliveryThresholdPaise: number;
  minOrderPaise: number;
  /** Amount still needed for free delivery (0 when already free). */
  amountToFreeDeliveryPaise: number;
  blockers: string[];
  serviceability: ServiceabilityResult | null;
}

/** Delivery charge and blocking rules for a server-computed subtotal. */
export async function quoteDelivery(
  subtotalPaise: number,
  pincode: string | null,
  settings?: StoreSettingsRow,
  warehouse?: WarehouseCandidate | null
): Promise<DeliveryQuote> {
  const s = settings ?? (await getStoreSettings());
  const serviceability = pincode ? await checkServiceability(pincode, s, { warehouse }) : null;
  const blockers: string[] = [];
  const minOrder = serviceability?.serviceable ? (serviceability.minOrderPaise ?? s.minOrderPaise) : s.minOrderPaise;
  if (subtotalPaise < minOrder) blockers.push(`Minimum order value is ${formatPaise(minOrder)}`);
  if (serviceability && !serviceability.serviceable) blockers.push(serviceability.reason ?? 'This PIN code is not serviceable');
  const free = subtotalPaise >= s.freeDeliveryThresholdPaise;
  const fee = free ? 0 : serviceability?.serviceable ? serviceability.feePaise : s.deliveryFeePaise;
  return {
    subtotalPaise,
    deliveryChargePaise: fee,
    freeDeliveryThresholdPaise: s.freeDeliveryThresholdPaise,
    minOrderPaise: minOrder,
    amountToFreeDeliveryPaise: free ? 0 : s.freeDeliveryThresholdPaise - subtotalPaise,
    blockers,
    serviceability,
  };
}

/**
 * DELIVERY_CHECKED: a shopper checked whether a PIN code is delivered to (PIN check or choosing a
 * location). Unserviceable results are the "unmet area demand" signal. Malformed PINs are not
 * recorded. `ownerKey` (customer id / cart or visitor cookie) only de-duplicates repeat checks of
 * the same PIN on the same day; it is hashed into the event id and never stored.
 */
export function trackDeliveryCheck(result: ServiceabilityResult, analytics: AnalyticsCaller, source: 'pincode_check' | 'location_set', ownerKey: string | null) {
  if (result.code === 'INVALID') return;
  const day = istDay();
  trackServerEvents(analytics, (ctx) => {
    // Same shopper + PIN + IST day counts once: by session/cart key, else the consented visitor id,
    // else one shared anonymous bucket (under-counts rather than identify a non-consenting visitor).
    const visitorId = ownerKey ? null : consentedVisitorId(ctx);
    const [dedupeScope, owner] = ownerKey ? ['shopper', ownerKey] : visitorId ? ['visitor', `v:${visitorId}`] : ['anonymous', 'a'];
    return [
      {
        name: 'DELIVERY_CHECKED',
        pincode: result.pincode,
        metadata: { serviceable: result.serviceable, code: result.code, source, dedupeScope },
        dedupeKey: `${owner}:${result.pincode}:${day}`,
      },
    ];
  });
}
