/**
 * STAG Admin — Payout / Ledger item detail page
 */
(function () {
  'use strict';

  // ── Auth guard ───────────────────────────────────────────────────────────────
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) { window.location.href = 'index.html'; return; }

  // ── Query params ─────────────────────────────────────────────────────────────
  const params = new URLSearchParams(window.location.search);
  const itemId = params.get('id');
  const userId = params.get('userId');
  const content = document.getElementById('payoutContent');

  // Back-link: return to user payout tab
  const backLink = document.getElementById('backLink');
  if (userId) backLink.href = `user.html?id=${encodeURIComponent(userId)}#payout`;

  if (!itemId || !userId) {
    content.innerHTML = '<div class="detail-error">Invalid link — missing payout or user ID.</div>';
    return;
  }

  // ── Fetch helper ─────────────────────────────────────────────────────────────
  async function apiAbs(url, opts = {}) {
    const res = await fetch(url, {
      ...opts,
      headers: {
        'Content-Type':  'application/json',
        'Authorization': 'Bearer ' + token,
        ...(opts.headers || {}),
      },
    });
    if (res.status === 401) {
      localStorage.clear();
      window.location.href = 'index.html';
      return { ok: false, data: null };
    }
    const data = await res.json().catch(() => null);
    return { ok: res.ok, data };
  }

  // ── Toast ────────────────────────────────────────────────────────────────────
  const toastEl = document.getElementById('toast');
  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3000);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function fmtDate(str) {
    if (!str) return '—';
    const d = new Date(str);
    if (isNaN(d) || d.getFullYear() < 1971) return '—';
    return d.toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  function fmtCurrency(n) {
    if (n == null) return '—';
    return '₹' + Number(n).toFixed(2);
  }

  function isoWeekToRange(isoWeek) {
    if (!isoWeek) return '—';
    const match = isoWeek.match(/^(\d{4})-W(\d{2})$/);
    if (!match) return isoWeek;
    const year = parseInt(match[1], 10);
    const week = parseInt(match[2], 10);
    const jan4      = new Date(Date.UTC(year, 0, 4));
    const dayOfWeek = (jan4.getUTCDay() + 6) % 7;
    const weekMon   = new Date(jan4);
    weekMon.setUTCDate(jan4.getUTCDate() - dayOfWeek + (week - 1) * 7);
    const weekSun   = new Date(weekMon);
    weekSun.setUTCDate(weekMon.getUTCDate() + 6);
    const fmt = d => d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
    return `Week ${week}, ${year} <span style="color:var(--muted);font-weight:400">(${fmt(weekMon)} – ${fmt(weekSun)})</span>`;
  }

  const ledgerTypeBadge    = { PAYOUT: 'badge-confirmed', EARNING: 'badge-completed', PENALTY: 'badge-cancelled' };
  const settlementBadgeMap = { PENDING: 'badge-pending', COMPLETED: 'badge-completed', FAILED: 'badge-cancelled' };
  const reqStatusMap = {
    pending: 'badge-pending', accepted: 'badge-accepted', confirmed: 'badge-confirmed',
    completed: 'badge-completed', cancelled: 'badge-cancelled', rejected: 'badge-rejected',
    expired: 'badge-expired', blocked: 'badge-blocked',
    confirm_intended: 'badge-pending', payment_initiated: 'badge-pending', verified: 'badge-accepted',
  };

  function badge(val, map) {
    if (!val) return '<span class="badge badge-inactive">—</span>';
    const cls = map[val] || 'badge-inactive';
    return `<span class="badge ${cls}">${esc(val)}</span>`;
  }

  // ── Resolve ledger item ───────────────────────────────────────────────────────
  async function resolveLedgerItem() {
    try {
      const raw = sessionStorage.getItem('payoutItem');
      if (raw) {
        const item = JSON.parse(raw);
        if (item && item.id === itemId) { sessionStorage.removeItem('payoutItem'); return item; }
      }
    } catch (_) {}
    for (let p = 1; p <= 5; p++) {
      const { ok, data } = await apiAbs(
        API_BASE + '/v1/payment/users/' + encodeURIComponent(userId) + '/ledger?page=' + p + '&limit=50'
      );
      if (!ok || !data || !data.data || !data.data.items) break;
      const found = data.data.items.find(i => i.id === itemId);
      if (found) return found;
      if (data.data.items.length < 50) break;
    }
    return null;
  }

  async function fetchRequest(id) {
    const { ok, data } = await apiAbs(API_BASE + '/v1/request/' + encodeURIComponent(id));
    return ok && data && data.id ? data : null;
  }

  // ── UI primitives ─────────────────────────────────────────────────────────────
  // Horizontal label/value row inside a panel
  function infoRow(label, value) {
    return `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,0.05)">
      <span style="color:var(--muted);font-size:0.78rem;white-space:nowrap;flex-shrink:0">${esc(label)}</span>
      <span style="font-size:0.82rem;text-align:right;word-break:break-all">${value}</span>
    </div>`;
  }

  // Card panel with coloured top border
  function panel(title, bodyHtml, accent) {
    return `<div style="background:var(--bg-card);border:1px solid var(--border);border-top:3px solid ${accent || 'var(--border)'};border-radius:12px;padding:20px 22px;min-width:0">
      <div style="font-size:0.7rem;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:var(--muted);margin-bottom:14px">${esc(title)}</div>
      ${bodyHtml}
    </div>`;
  }

  // Amount breakdown line (label left, value right)
  function amtRow(label, value, color, large, minus) {
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:${large?'11px':'7px'} 0;border-bottom:1px solid rgba(255,255,255,0.05)">
      <span style="color:var(--muted);font-size:${large?'0.85rem':'0.78rem'}">${esc(label)}</span>
      <span style="font-size:${large?'1rem':'0.85rem'};font-weight:${large?'700':'500'};color:${color||'var(--white)'}">${minus?'<span style="color:#ef5350">−</span> ':''}${value}</span>
    </div>`;
  }

  // Compact request card
  function requestCard(req) {
    if (!req) return `<div class="req-card-mini req-card-error">Could not load request</div>`;
    const mName = req.mUser ? (req.mUser.username || req.mUser.phone || 'Male') : '—';
    const fName = req.fUser ? (req.fUser.username || req.fUser.phone || 'Female') : '—';
    const pay = req.payment;
    const sCls = reqStatusMap[req.status] || 'badge-inactive';
    return `<a href="request.html?id=${encodeURIComponent(req.id)}" class="req-card-mini">
      <div class="req-card-mini-top">
        <span class="req-card-mini-club">${esc(req.clubName) || '—'}</span>
        <span class="badge ${sCls}" style="font-size:0.68rem;flex-shrink:0">${esc(req.status)}</span>
      </div>
      <div class="req-card-mini-row">
        <span style="color:var(--muted);font-size:0.75rem">${esc(mName)}</span>
        <span style="color:rgba(255,255,255,0.25);font-size:0.7rem">→</span>
        <span style="color:var(--muted);font-size:0.75rem">${esc(fName)}</span>
      </div>
      <div class="req-card-mini-row" style="margin-top:7px;justify-content:space-between">
        <span style="color:var(--muted);font-size:0.72rem">${fmtDate(req.datetime)}</span>
        <div style="display:flex;gap:8px">
          ${pay ? `<span style="font-size:0.73rem;font-weight:600;color:var(--white)">₹${Number(pay.mUserTotalPayable||0).toFixed(0)}</span>` : ''}
          ${pay && pay.fUserNetPayout ? `<span style="font-size:0.73rem;color:#50c878">Out ₹${Number(pay.fUserNetPayout).toFixed(0)}</span>` : ''}
        </div>
      </div>
    </a>`;
  }

  // ── Main render ───────────────────────────────────────────────────────────────
  async function render(item) {
    const typeCls  = ledgerTypeBadge[item.type]            || 'badge-inactive';
    const settlCls = settlementBadgeMap[item.settlementStatus] || 'badge-inactive';
    const typeColor = { PAYOUT: '#42a5f5', EARNING: '#50c878', PENALTY: '#ef5350' }[item.type] || '#aaa';
    const typeRgb   = { PAYOUT: '66,165,245', EARNING: '80,200,120', PENALTY: '239,83,80' }[item.type] || '170,170,170';

    // ── Hero ─────────────────────────────────────────────────────────────────
    const heroHtml = `
      <div style="background:linear-gradient(135deg,rgba(${typeRgb},0.1) 0%,var(--bg-card) 100%);border:1px solid rgba(${typeRgb},0.22);border-radius:14px;padding:26px 28px 20px;margin-bottom:22px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:20px;flex-wrap:wrap">
          <div>
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px">
              <span class="badge ${typeCls}" style="font-size:0.82rem;padding:5px 14px;letter-spacing:0.05em">${esc(item.type)}</span>
              <span class="badge ${settlCls}">${esc(item.settlementStatus)}</span>
            </div>
            <div style="font-size:2.1rem;font-weight:700;color:${typeColor};line-height:1">${fmtCurrency(item.finalAmount)}</div>
            <div style="margin-top:8px;font-size:0.82rem;color:var(--muted)">${isoWeekToRange(item.isoWeek)}</div>
            <div style="margin-top:3px;font-size:0.74rem;color:rgba(255,255,255,0.3)">Created ${fmtDate(item.createdAt)}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end">
            ${item.referenceId ? `<div style="font-family:monospace;font-size:0.75rem;color:${typeColor};background:rgba(${typeRgb},0.1);padding:5px 10px;border-radius:6px">${esc(item.referenceId)}</div>` : ''}
            <div style="font-family:monospace;font-size:0.64rem;color:rgba(255,255,255,0.2)">${esc(item.id)}</div>
          </div>
        </div>
      </div>`;

    // ── Left panel: metadata ─────────────────────────────────────────────────
    const leftRows =
      infoRow('Settlement', `<span class="badge ${settlCls}">${esc(item.settlementStatus)}</span>`) +
      infoRow('Week',       isoWeekToRange(item.isoWeek)) +
      infoRow('Created',    fmtDate(item.createdAt)) +
      (item.referenceId    ? infoRow('Reference ID',    `<span style="font-family:monospace;font-size:0.74rem;color:${typeColor}">${esc(item.referenceId)}</span>`) : '') +
      (item.idempotencyKey ? infoRow('Idempotency Key', `<span style="font-family:monospace;font-size:0.65rem;color:var(--muted)">${esc(item.idempotencyKey)}</span>`) : '') +
      infoRow('User', `<a href="user.html?id=${encodeURIComponent(item.userId)}" style="color:var(--red);font-family:monospace;font-size:0.72rem">${esc(item.userId)}</a>`);
    const leftPanel = panel('Ledger Info', leftRows, typeColor);

    // ── Right panel: financial breakdown ─────────────────────────────────────
    let rightBody = '';
    if (item.type === 'PAYOUT' && item.deductions) {
      const d = item.deductions;
      rightBody =
        amtRow('Base Price',    fmtCurrency(item.basePrice)) +
        amtRow('Platform Fee',  fmtCurrency(d.PlatformFee),  '#ff9800', false, true) +
        amtRow('GST',           fmtCurrency(d.GST),          '#ff9800', false, true) +
        (d.Penalty ? amtRow('Penalty', fmtCurrency(d.Penalty), '#ef5350', false, true) : '') +
        `<div style="margin-top:4px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.1)">` +
        amtRow('Net Deduction', fmtCurrency(d.NetDeduction), '#ef5350', false, true) +
        `</div><div style="margin-top:4px;padding-top:8px;border-top:2px solid rgba(${typeRgb},0.35)">` +
        amtRow('Final Payout',  fmtCurrency(item.finalAmount), typeColor, true) +
        `</div>`;
    } else if (item.type === 'EARNING') {
      rightBody =
        amtRow('Base Price',   fmtCurrency(item.basePrice)) +
        (item.platformFee != null ? amtRow('Platform Fee', fmtCurrency(item.platformFee), '#ff9800', false, true) : '') +
        (item.gst         != null ? amtRow('GST',          fmtCurrency(item.gst),         '#ff9800', false, true) : '') +
        `<div style="margin-top:4px;padding-top:8px;border-top:2px solid rgba(${typeRgb},0.35)">` +
        amtRow('Net Earning', fmtCurrency(item.finalAmount), typeColor, true) +
        `</div>`;
    } else if (item.type === 'PENALTY') {
      const meta = item.metadata || {};
      rightBody =
        amtRow('Base Price', fmtCurrency(item.basePrice)) +
        (item.penalty != null ? amtRow('Penalty Applied', fmtCurrency(Math.abs(item.penalty)), '#ef5350', false, true) : '') +
        `<div style="margin-top:4px;padding-top:8px;border-top:2px solid rgba(${typeRgb},0.35)">` +
        amtRow('Amount Charged', fmtCurrency(item.finalAmount), typeColor, true) +
        `</div>` +
        (meta.reason      ? `<div style="margin-top:14px;font-size:0.78rem;color:var(--muted)">Reason: <span style="color:var(--white)">${esc(meta.reason.replace(/_/g, ' '))}</span></div>` : '') +
        (meta.cancelledBy ? `<div style="margin-top:6px;font-size:0.7rem;color:var(--muted);font-family:monospace">By: ${esc(meta.cancelledBy)}</div>` : '');
    } else {
      rightBody = '<p style="color:var(--muted);font-size:0.82rem;margin:0">No breakdown available.</p>';
    }
    const rightPanel = panel(
      item.type === 'PAYOUT' ? 'Deductions Breakdown' : item.type === 'EARNING' ? 'Earnings Breakdown' : 'Penalty Details',
      rightBody, typeColor
    );

    // ── Two-column grid ───────────────────────────────────────────────────────
    const twoCol = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">${leftPanel}${rightPanel}</div>`;

    // ── Requests section skeleton ─────────────────────────────────────────────
    const reqIds   = item.requestIds || (item.requestId ? [item.requestId] : []);
    const reqCount = reqIds.length;
    const skeletons = Array.from({ length: Math.min(reqCount, 6) })
      .map(() => `<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;height:94px;opacity:0.35"></div>`)
      .join('');

    content.innerHTML = heroHtml + twoCol + (reqCount ? `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <p class="detail-section-title" style="margin:0" id="reqSectionTitle">Linked Requests (${reqCount})</p>
      </div>
      <div id="reqCards">
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px">${skeletons}</div>
      </div>` : '');

    if (!reqCount) return;

    // Fetch in batches of 5
    const BATCH = 5;
    const results = [];
    for (let i = 0; i < reqIds.length; i += BATCH) {
      const fetched = await Promise.all(reqIds.slice(i, i + BATCH).map(fetchRequest));
      results.push(...fetched);
    }

    const cardsEl = document.getElementById('reqCards');
    if (cardsEl) {
      cardsEl.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px">${results.map(requestCard).join('')}</div>`;
    }
  }

  // ── Boot ──────────────────────────────────────────────────────────────────────
  async function load() {
    const item = await resolveLedgerItem();
    if (!item) {
      content.innerHTML = '<div class="detail-error">Payout item not found.</div>';
      return;
    }
    await render(item);
  }

  load();
})();
