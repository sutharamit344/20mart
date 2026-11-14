import { NextResponse, type NextRequest } from 'next/server';
import { rateLimit, searchSuggestions } from '@20mart/server';
import { clientMeta, errorResponse } from '@20mart/server/next';

export async function GET(req: NextRequest) {
  try {
    if (!rateLimit(`search:${clientMeta(req).ipAddress ?? 'unknown'}`, 60, 60_000).ok) {
      return NextResponse.json({ items: [] }, { status: 429 });
    }
    const q = req.nextUrl.searchParams.get('q') ?? '';
    const limit = Number(req.nextUrl.searchParams.get('limit') ?? 8) || 8;
    const items = await searchSuggestions(q, limit);
    return NextResponse.json({ items }, { headers: { 'cache-control': 'public, max-age=30, s-maxage=60' } });
  } catch (err) {
    return errorResponse(err);
  }
}
