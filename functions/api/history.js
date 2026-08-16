/**
 * GET /api/history
 * Cloudflare Pages Function (Edge) — PostgreSQL से saved bills की पूरी history लौटाता है
 *
 * Optional query params:
 *   ?limit=200            कितनी rows (default 200, max 1000)
 *   ?offset=0             pagination
 *   ?q=राम                customer_name / mobile_number में search
 *   ?from=2026-08-01      created_at >= (YYYY-MM-DD)
 *   ?to=2026-08-31        created_at <= (YYYY-MM-DD, पूरे दिन समेत)
 *
 * Response:
 * { ok:true, count:12, rows:[ {id, customer_name, mobile_number, items,
 *                              total_amount, due_amount, pdf_receipt_url, created_at}, ... ] }
 */

import postgres from 'postgres';

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

const ok  = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
const bad = (message, status = 400) =>
  new Response(JSON.stringify({ ok: false, error: message }), { status, headers: JSON_HEADERS });

function connString(env) {
  return (env.HYPERDRIVE && env.HYPERDRIVE.connectionString) || env.DATABASE_URL || '';
}

export async function onRequestGet({ request, env }) {
  const url = connString(env);
  if (!url) return bad('DATABASE_URL set नहीं है (Cloudflare → Settings → Environment variables)', 500);

  const p      = new URL(request.url).searchParams;
  const limit  = Math.min(Math.max(parseInt(p.get('limit') || '200', 10) || 200, 1), 1000);
  const offset = Math.max(parseInt(p.get('offset') || '0', 10) || 0, 0);
  const q      = (p.get('q') || '').trim();
  const from   = (p.get('from') || '').trim();
  const to     = (p.get('to') || '').trim();

  const sql = postgres(url, {
    max: 5,
    fetch_types: false,
    idle_timeout: 20,
    prepare: false,
  });

  try {
    const rows = await sql`
      SELECT
        id,
        customer_name,
        mobile_number,
        items,
        total_amount,
        due_amount,
        pdf_receipt_url,
        created_at
      FROM transactions
      WHERE TRUE
        ${ q    ? sql`AND (customer_name ILIKE ${'%' + q + '%'} OR mobile_number ILIKE ${'%' + q + '%'})` : sql`` }
        ${ from ? sql`AND (created_at AT TIME ZONE 'Asia/Kolkata')::date >= ${from}::date`                 : sql`` }
        ${ to   ? sql`AND (created_at AT TIME ZONE 'Asia/Kolkata')::date <= ${to}::date`                   : sql`` }
      ORDER BY created_at DESC, id DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    return ok({ ok: true, count: rows.length, rows });
  } catch (err) {
    return bad('DB error: ' + (err && err.message ? err.message : String(err)), 500);
  } finally {
    try { sql.end({ timeout: 5 }); } catch (e) {}
  }
}

export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
