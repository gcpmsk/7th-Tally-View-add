/**
 * POST /api/submit
 * Cloudflare Pages Function (Edge) — bill/receipt data को PostgreSQL में insert करता है
 *
 * Connection:
 *   env.HYPERDRIVE.connectionString   (अगर Hyperdrive binding लगाया हो)  → सबसे तेज़
 *   env.DATABASE_URL                  (Environment Variable / Secret)     → fallback
 *
 * Body (JSON):
 * {
 *   "customer_name":   "राम कुमार",
 *   "mobile_number":   "9631816666",
 *   "items":           [ {name:"Atta", qty:2, unit:"बोरा", rate:1250, amount:2500}, ... ],
 *   "total_amount":    2500,
 *   "due_amount":      500,
 *   "pdf_receipt_url": "https://.../receipt-101.pdf",
 *   "created_at":      "2026-08-16T05:25:00+05:30"   // optional — न भेजें तो server NOW() लगाएगा
 * }
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

/* connection string — पहले Hyperdrive, फिर DATABASE_URL */
function connString(env) {
  return (env.HYPERDRIVE && env.HYPERDRIVE.connectionString) || env.DATABASE_URL || '';
}

/* "1,250.50" / "₹1250" / 1250 → 1250.5 ; खाली → 0 */
function num(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export async function onRequestPost({ request, env }) {
  const url = connString(env);
  if (!url) return bad('DATABASE_URL set नहीं है (Cloudflare → Settings → Environment variables)', 500);

  /* ---------- body parse ---------- */
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return bad('Invalid JSON body');
  }

  const customer_name = String(body.customer_name || '').trim();
  if (!customer_name) return bad('customer_name ज़रूरी है');

  const mobile_number = String(body.mobile_number || '').trim() || null;

  /* items — array या object दोनों चलेंगे; जो भी भेजा गया वही ज्यों-का-त्यों JSONB में जाएगा */
  let items = body.items;
  if (typeof items === 'string') {
    try { items = JSON.parse(items); } catch (e) { items = [{ name: items }]; }
  }
  if (items === null || items === undefined) items = [];
  if (!Array.isArray(items) && typeof items !== 'object') items = [{ name: String(items) }];

  const total_amount    = num(body.total_amount);
  const due_amount      = num(body.due_amount);
  const pdf_receipt_url = String(body.pdf_receipt_url || '').trim() || null;

  /* created_at — client भेजे तो वही (exact time), वरना server का NOW() */
  let created_at = null;
  if (body.created_at) {
    const d = new Date(body.created_at);
    if (!isNaN(d.getTime())) created_at = d.toISOString();
  }

  /* ---------- insert ---------- */
  const sql = postgres(url, {
    max: 5,               // edge पर छोटा pool
    fetch_types: false,   // Hyperdrive/Workers के लिए ज़रूरी
    idle_timeout: 20,
    prepare: false,
  });

  try {
    const rows = await sql`
      INSERT INTO transactions
        (customer_name, mobile_number, items, total_amount, due_amount, pdf_receipt_url, created_at)
      VALUES
        (${customer_name},
         ${mobile_number},
         ${sql.json(items)},
         ${total_amount},
         ${due_amount},
         ${pdf_receipt_url},
         ${created_at ? created_at : sql`NOW()`})
      RETURNING id, customer_name, mobile_number, items, total_amount, due_amount, pdf_receipt_url, created_at
    `;

    return ok({ ok: true, row: rows[0] }, 201);
  } catch (err) {
    return bad('DB error: ' + (err && err.message ? err.message : String(err)), 500);
  } finally {
    /* connection background में बंद — response रुकेगा नहीं */
    try { sql.end({ timeout: 5 }); } catch (e) {}
  }
}

/* browser preflight (अगर कभी दूसरे domain से call करें) */
export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
