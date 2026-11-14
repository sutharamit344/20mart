/** Price filter buckets in paise (shared by server listing and client filters). */
export const PRICE_BUCKETS = [
  { id: 'under-20', label: 'Up to ₹20', min: undefined, max: 2000 },
  { id: '20-40', label: '₹20 – ₹40', min: 2001, max: 4000 },
  { id: '40-60', label: '₹40 – ₹60', min: 4001, max: 6000 },
  { id: '60-100', label: '₹60 – ₹100', min: 6001, max: 10000 },
  { id: 'above-100', label: 'Above ₹100', min: 10001, max: undefined },
] as const;
