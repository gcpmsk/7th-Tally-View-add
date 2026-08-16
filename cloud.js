/* ============================================================
   cloud.js — SATYAM GOLD ☁️ Cloud Bills
   (a) नया बिल POST  → /api/submit
   (b) history  GET  → /api/history   (page/screen खुलते ही auto)
   ============================================================ */
(function () {
  'use strict';

  const $  = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));

  /* ---------- helpers ---------- */
  const esc = (s) => String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const num = (v) => {
    if (v === null || v === undefined || v === '') return 0;
    const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
    return isFinite(n) ? n : 0;
  };

  const money = (v) => '₹' + num(v).toLocaleString('en-IN', {
    minimumFractionDigits: 0, maximumFractionDigits: 2
  });

  function msg(text, isErr) {
    const el = $('#cb-msg');
    if (!el) return;
    el.textContent = text;
    el.className = 'cb-msg ' + (isErr ? 'errr' : 'okk');
    if (!isErr) setTimeout(() => { el.className = 'cb-msg'; }, 4000);
  }

  /* DB का created_at (UTC ISO) → भारत का पूरा date + time, exact seconds समेत */
  function fmtDT(iso) {
    if (!iso) return '<span class="cb-none">—</span>';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return esc(iso);
    const opt = { timeZone: 'Asia/Kolkata' };
    const date = d.toLocaleDateString('en-GB', Object.assign({
      day: '2-digit', month: '2-digit', year: 'numeric'
    }, opt));
    const time = d.toLocaleTimeString('en-GB', Object.assign({
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
    }, opt));
    return '<b>' + esc(date) + '</b>' + esc(time);
  }

  /* datetime-local input के लिए local ISO (सेकंड समेत) */
  function localNow() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
           'T' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }

  /* ---------- item rows ---------- */
  const PRESETS = ['Atta', 'Sattu', 'Besan', 'Chokar'];

  function addRow(item) {
    item = item || {};
    const wrap = $('#cb-irows');
    if (!wrap) return;
    const div = document.createElement('div');
    div.className = 'cb-irow';
    div.innerHTML =
      '<input class="i-name"  list="cb-plist" placeholder="Atta / Sattu / Besan / Chokar" value="' + esc(item.name || '') + '">' +
      '<input class="i-qty"   type="number" step="0.01" min="0" placeholder="Qty"  value="' + esc(item.qty  || '') + '">' +
      '<input class="i-unit"  placeholder="बोरा / kg"          value="' + esc(item.unit || '') + '">' +
      '<input class="i-rate"  type="number" step="0.01" min="0" placeholder="Rate" value="' + esc(item.rate || '') + '">' +
      '<input class="i-amt cb-amt" type="number" step="0.01" min="0" placeholder="Amount" value="' + esc(item.amount || '') + '">' +
      '<button type="button" class="cb-del" title="हटाएँ">✖</button>';
    wrap.appendChild(div);
  }

  /* qty × rate → amount, फिर सारे amount जोड़कर total */
  function recalc() {
    let total = 0;
    $$('#cb-irows .cb-irow').forEach((r) => {
      const q = num($('.i-qty', r).value);
      const rt = num($('.i-rate', r).value);
      const amtEl = $('.i-amt', r);
      if (q && rt) amtEl.value = +(q * rt).toFixed(2);
      total += num(amtEl.value);
    });
    $('#cb-tot-lbl').textContent = money(total);
    const tEl = $('#cb-total');
    /* user ने खुद total edit न किया हो तो auto भरें */
    if (!tEl.dataset.touched) tEl.value = total ? +total.toFixed(2) : 0;
    $('#cb-due-lbl').textContent = money($('#cb-due').value);
  }

  /* form से items array बनाओ (खाली rows छोड़ दो) */
  function collectItems() {
    const out = [];
    $$('#cb-irows .cb-irow').forEach((r) => {
      const name = $('.i-name', r).value.trim();
      const qty  = num($('.i-qty', r).value);
      const rate = num($('.i-rate', r).value);
      const amt  = num($('.i-amt', r).value);
      if (!name && !qty && !rate && !amt) return;
      out.push({
        name: name,
        qty: qty,
        unit: $('.i-unit', r).value.trim(),
        rate: rate,
        amount: amt
      });
    });
    return out;
  }

  /* ---------- (a) POST /api/submit ---------- */
  async function submitBill(e) {
    e.preventDefault();
    const btn = $('#cb-save');
    const name = $('#cb-name').value.trim();
    if (!name) { msg('Customer name ज़रूरी है', true); return; }

    const items = collectItems();
    if (!items.length) { msg('कम से कम एक item भरें', true); return; }

    /* बिल का exact समय — user ने चुना हो तो वही, वरना अभी का */
    const dtVal = $('#cb-dt').value;
    const created_at = new Date(dtVal || localNow()).toISOString();

    const payload = {
      customer_name:   name,
      mobile_number:   $('#cb-mob').value.trim(),
      items:           items,
      total_amount:    num($('#cb-total').value),
      due_amount:      num($('#cb-due').value),
      pdf_receipt_url: $('#cb-pdf').value.trim(),
      created_at:      created_at
    };

    btn.disabled = true;
    btn.textContent = '⏳ Save हो रहा है…';
    try {
      const res  = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || ('HTTP ' + res.status));

      msg('✔ Save हो गया — Bill #' + data.row.id, false);
      resetForm();
      loadHistory();          // history तुरंत refresh
    } catch (err) {
      msg('✖ Save नहीं हुआ: ' + err.message, true);
    } finally {
      btn.disabled = false;
      btn.textContent = '💾 Database में Save करें';
    }
  }

  function resetForm() {
    $('#cb-form').reset();
    $('#cb-irows').innerHTML = '';
    addRow();
    $('#cb-total').dataset.touched = '';
    $('#cb-dt').value = localNow();
    recalc();
  }

  /* ---------- (b) GET /api/history ---------- */
  async function loadHistory() {
    const tb = $('#cb-tbody');
    if (!tb) return;
    tb.innerHTML = '<tr><td colspan="8" class="cb-empty">— load हो रहा है… —</td></tr>';

    const p = new URLSearchParams();
    const q = $('#cb-q').value.trim();
    const f = $('#cb-from').value;
    const t = $('#cb-to').value;
    if (q) p.set('q', q);
    if (f) p.set('from', f);
    if (t) p.set('to', t);
    p.set('limit', '500');

    try {
      const res  = await fetch('/api/history?' + p.toString());
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || ('HTTP ' + res.status));
      renderHistory(data.rows || []);
    } catch (err) {
      tb.innerHTML = '<tr><td colspan="8" class="cb-empty" style="color:#c0392b;">✖ ' +
                     esc(err.message) + '</td></tr>';
      $('#cb-cnt').textContent = '';
    }
  }

  function renderHistory(rows) {
    const tb = $('#cb-tbody');
    $('#cb-cnt').textContent = rows.length ? '(' + rows.length + ' bills)' : '';

    if (!rows.length) {
      tb.innerHTML = '<tr><td colspan="8" class="cb-empty">— अभी कोई bill save नहीं है —</td></tr>';
      return;
    }

    tb.innerHTML = rows.map((r) => {
      /* items — array of objects / array of strings / object, तीनों संभालो */
      let its = r.items;
      if (typeof its === 'string') { try { its = JSON.parse(its); } catch (e) { its = [its]; } }
      if (!Array.isArray(its)) its = its ? [its] : [];

      const itemsHtml = its.length
        ? its.map((it) => {
            if (it && typeof it === 'object') {
              const bits = [it.name, (it.qty ? it.qty : '') + (it.unit ? ' ' + it.unit : '')]
                .filter(Boolean).join(' × ');
              const rate = it.rate ? ' @₹' + it.rate : '';
              const amt  = it.amount ? ' = ₹' + it.amount : '';
              return '<span>' + esc(bits + rate + amt) + '</span>';
            }
            return '<span>' + esc(it) + '</span>';
          }).join('')
        : '<span class="cb-none">—</span>';

      const pdf = r.pdf_receipt_url
        ? '<a class="cb-pdf" href="' + esc(r.pdf_receipt_url) + '" target="_blank" rel="noopener">📄 PDF खोलें</a>'
        : '<span class="cb-none">—</span>';

      const dueTxt = num(r.due_amount) > 0
        ? '<span class="cb-money cb-due">' + money(r.due_amount) + '</span>'
        : '<span class="cb-none">₹0</span>';

      return '<tr>' +
        '<td><b>#' + esc(r.id) + '</b></td>' +
        '<td><b>' + esc(r.customer_name) + '</b></td>' +
        '<td>' + (r.mobile_number
                  ? '<a href="tel:' + esc(r.mobile_number) + '">' + esc(r.mobile_number) + '</a>'
                  : '<span class="cb-none">—</span>') + '</td>' +
        '<td class="cb-items-cell">' + itemsHtml + '</td>' +
        '<td><span class="cb-money cb-tot">' + money(r.total_amount) + '</span></td>' +
        '<td>' + dueTxt + '</td>' +
        '<td>' + pdf + '</td>' +
        '<td class="cb-time">' + fmtDT(r.created_at) + '</td>' +
      '</tr>';
    }).join('');
  }

  /* ---------- wiring ---------- */
  function init() {
    if (!$('#cloud-screen')) return;

    /* item name suggestions */
    if (!$('#cb-plist')) {
      const dl = document.createElement('datalist');
      dl.id = 'cb-plist';
      dl.innerHTML = PRESETS.map((p) => '<option value="' + p + '">').join('');
      document.body.appendChild(dl);
    }

    addRow();
    $('#cb-dt').value = localNow();
    recalc();

    $('#cb-additem').addEventListener('click', () => { addRow(); recalc(); });

    $('#cb-irows').addEventListener('click', (e) => {
      const b = e.target.closest('.cb-del');
      if (!b) return;
      const rows = $$('#cb-irows .cb-irow');
      if (rows.length > 1) b.parentElement.remove(); else resetRow(b.parentElement);
      recalc();
    });
    $('#cb-irows').addEventListener('input', recalc);

    $('#cb-total').addEventListener('input', function () { this.dataset.touched = '1'; });
    $('#cb-due').addEventListener('input', recalc);

    $('#cb-form').addEventListener('submit', submitBill);
    $('#cb-clear').addEventListener('click', () => setTimeout(resetForm, 0));

    $('#cb-refresh').addEventListener('click', loadHistory);
    $('#cb-q').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); loadHistory(); } });
    $('#cb-from').addEventListener('change', loadHistory);
    $('#cb-to').addEventListener('change', loadHistory);

    /* page load पर history */
    loadHistory();

    /* Cloud Bills tile दबाने पर दोबारा fresh history */
    document.addEventListener('click', (e) => {
      const g = e.target.closest('[data-go="cloud"]');
      if (g) setTimeout(loadHistory, 60);
    });
  }

  function resetRow(r) {
    $$('input', r).forEach((i) => { i.value = ''; });
  }

  window.cbLoadHistory = loadHistory;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
