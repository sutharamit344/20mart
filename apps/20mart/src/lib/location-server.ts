import type { NextRequest } from 'next/server';
import { locationCookie } from '@20mart/server';

/** Customer's selected delivery PIN from the location cookie (validated again by every service). */
export const locationFrom = (req: NextRequest) => ({ pincode: req.cookies.get(locationCookie().name)?.value ?? null });
