import { prisma } from '@20mart/database';
import { formatPaise } from '@20mart/shared';
import { getStoreSettings, PINCODE_REGEX, type StoreSettingsRow } from './settings';

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
export function deliveryEstimateText(hours: number, s: StoreSettingsRow, now = new Date()) {
  const base = hours <= 24 ? `Delivery within ${hours} hour${hours === 1 ? '' : 's'}` : `Delivery in about ${Math.ceil(hours / 24)} days`;
  const mins = istMinutesNow(now);
  const open = toMinutes(s.operatingHoursStart);
  const close = toMinutes(s.operatingHoursEnd);
  const isOpen = mins >= open && mins < close;
  return isOpen ? `${base} of order confirmation` : `${base} — orders placed now are processed from ${to12h(s.operatingHoursStart)}`;
}

export interface ServiceabilityResult {
  pincode: string;
  serviceable: boolean;
  reason?: string;
  area?: string | null;
  city?: string | null;
  feePaise: number;
  estimateHours: number | null;
  estimateText: string | null;
}

/** PIN codes are serviceable ONLY when explicitly configured as such. */
export async function checkServiceability(pincode: string, settings?: StoreSettingsRow): Promise<ServiceabilityResult> {
  const s = settings ?? (await getStoreSettings());
  const pin = pincode.trim();
  if (!PINCODE_REGEX.test(pin)) {
    return { pincode: pin, serviceable: false, reason: 'Enter a valid 6-digit PIN code', feePaise: 0, estimateHours: null, estimateText: null };
  }
  if (!s.deliveryEnabled) {
    return { pincode: pin, serviceable: false, reason: 'Delivery is temporarily unavailable', feePaise: 0, estimateHours: null, estimateText: null };
  }
  const row = await prisma.serviceablePincode.findUnique({ where: { pincode: pin } });
  if (!row || !row.isServiceable) {
    return { pincode: pin, serviceable: false, reason: 'Sorry, we do not deliver to this PIN code yet', feePaise: 0, estimateHours: null, estimateText: null };
  }
  const hours = row.estimateHours ?? s.defaultEstimateHours;
  return {
    pincode: pin,
    serviceable: true,
    area: row.area,
    city: row.city,
    feePaise: row.deliveryFeePaise ?? s.deliveryFeePaise,
    estimateHours: hours,
    estimateText: deliveryEstimateText(hours, s),
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
export async function quoteDelivery(subtotalPaise: number, pincode: string | null, settings?: StoreSettingsRow): Promise<DeliveryQuote> {
  const s = settings ?? (await getStoreSettings());
  const serviceability = pincode ? await checkServiceability(pincode, s) : null;
  const blockers: string[] = [];
  if (subtotalPaise < s.minOrderPaise) blockers.push(`Minimum order value is ${formatPaise(s.minOrderPaise)}`);
  if (serviceability && !serviceability.serviceable) blockers.push(serviceability.reason ?? 'This PIN code is not serviceable');
  const free = subtotalPaise >= s.freeDeliveryThresholdPaise;
  const fee = free ? 0 : serviceability?.serviceable ? serviceability.feePaise : s.deliveryFeePaise;
  return {
    subtotalPaise,
    deliveryChargePaise: fee,
    freeDeliveryThresholdPaise: s.freeDeliveryThresholdPaise,
    minOrderPaise: s.minOrderPaise,
    amountToFreeDeliveryPaise: free ? 0 : s.freeDeliveryThresholdPaise - subtotalPaise,
    blockers,
    serviceability,
  };
}
