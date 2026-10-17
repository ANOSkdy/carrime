import { NextResponse } from 'next/server';
import { query } from '@/lib/db/postgres';
import { normalizePostalCode } from '@/lib/address/postal-code';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const code = normalizePostalCode(new URL(request.url).searchParams.get('code') ?? '');
  if (code.length !== 7) {
    return NextResponse.json({ error: 'invalid postal code' }, { status: 400 });
  }

  try {
    const { rows } = await query<{ prefecture: string; city: string; town: string }>(
      'select prefecture, city, town from zip_codes where postal_code = $1 order by town asc',
      [code]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }

    return NextResponse.json(
      {
        prefecture: rows[0].prefecture,
        city: rows[0].city,
        towns: rows.map((row) => row.town).filter(Boolean),
      },
      { headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=604800' } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    console.error('Zipcode lookup error', { message });
    return NextResponse.json({ error: 'lookup failed' }, { status: 500 });
  }
}
