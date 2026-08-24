/**
 * STAG Admin — User detail page
 */
(function () {
  'use strict';

  // ── Auth guard ──────────────────────────────────────────────────────────────
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    window.location.href = 'index.html';
    return;
  }

  // ── User id from query string ────────────────────────────────────────────────
  const userId = new URLSearchParams(window.location.search).get('id');
  const hero   = document.getElementById('userHero');

  if (!userId) {
    hero.innerHTML = '<div class="detail-error">No user specified.</div>';
    return;
  }

  // ── Fetch helper ────────────────────────────────────────────────────────────
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

  // ── Toast ───────────────────────────────────────────────────────────────────
  const toastEl = document.getElementById('toast');
  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3000);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  const statusMap = {
    active: 'badge-active', blocked: 'badge-blocked', inactive: 'badge-inactive',
    premium: 'badge-premium', banned: 'badge-banned', basic: 'badge-basic', deleted: 'badge-deleted',
  };
  const genderMap = { male: 'badge-male', female: 'badge-female' };

  const reqStatusMap = {
    pending: 'badge-pending', accepted: 'badge-accepted', confirmed: 'badge-confirmed',
    completed: 'badge-completed', cancelled: 'badge-cancelled', rejected: 'badge-rejected',
    expired: 'badge-expired', blocked: 'badge-blocked',
    confirm_intended: 'badge-pending', payment_initiated: 'badge-pending',
    verified: 'badge-accepted',
  };

  function badge(val, map) {
    if (!val) return '<span class="badge badge-inactive">—</span>';
    const cls = map[val] || 'badge-inactive';
    return `<span class="badge ${cls}">${esc(val)}</span>`;
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

  function shortId(id) {
    if (!id) return '—';
    return id.length > 12 ? id.slice(0, 8) + '…' : id;
  }

  function avatarHtml(u) {
    const initial = ((u.name || '?').trim().charAt(0) || '?').toUpperCase();
    if (u.profilePicUrl) {
      // Clickable — opens lightbox
      return `<span class="ucell-avatar ucell-avatar-lg avatar-clickable" data-initial="${esc(initial)}" id="heroAvatar" title="Click to enlarge">
        <img src="${esc(u.profilePicUrl)}" alt="" onerror="this.style.display='none'">
      </span>`;
    }
    return `<span class="ucell-avatar ucell-avatar-lg" data-initial="${esc(initial)}" id="heroAvatar"></span>`;
  }

  // ── Photo lightbox ───────────────────────────────────────────────────────────
  function initLightbox(picUrl) {
    if (!picUrl) return;
    const lb    = document.getElementById('photoLightbox');
    const img   = document.getElementById('lightboxImg');
    const close = document.getElementById('lightboxClose');
    const avatarEl = document.getElementById('heroAvatar');
    if (!lb || !img || !avatarEl) return;

    avatarEl.addEventListener('click', () => {
      img.src = picUrl;
      lb.classList.add('open');
    });
    close.addEventListener('click', () => lb.classList.remove('open'));
    lb.addEventListener('click', e => { if (e.target === lb) lb.classList.remove('open'); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') lb.classList.remove('open'); });
  }

  // ── Three-dot action menu ────────────────────────────────────────────────────
  let _menuOpen = false;
  function initActionMenu(u) {
    const btn  = document.getElementById('actionMenuBtn');
    const menu = document.getElementById('actionMenu');
    if (!btn || !menu) return;

    btn.addEventListener('click', e => {
      e.stopPropagation();
      _menuOpen = !_menuOpen;
      menu.classList.toggle('open', _menuOpen);
    });
    document.addEventListener('click', () => {
      if (_menuOpen) { _menuOpen = false; menu.classList.remove('open'); }
    });

    document.getElementById('menuToggleBan').addEventListener('click', toggleBan);
    document.getElementById('menuDeleteUser').addEventListener('click', deleteUser);
  }

  function field(label, value) {
    return `
      <div class="detail-card">
        <div class="detail-card-label">${esc(label)}</div>
        <div class="detail-card-value">${value}</div>
      </div>`;
  }

  function renderPagination(containerId, currentPage, totalPages, onPageChange) {
    const el = document.getElementById(containerId);
    el.innerHTML = '';
    if (totalPages <= 1) return;
    const prev = document.createElement('button');
    prev.className = 'page-btn';
    prev.textContent = '‹';
    prev.disabled = currentPage <= 1;
    prev.onclick = () => onPageChange(currentPage - 1);
    el.appendChild(prev);
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end   = Math.min(totalPages, start + maxVisible - 1);
    if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);
    for (let p = start; p <= end; p++) {
      const btn = document.createElement('button');
      btn.className = 'page-btn' + (p === currentPage ? ' active' : '');
      btn.textContent = p;
      btn.onclick = () => onPageChange(p);
      el.appendChild(btn);
    }
    const next = document.createElement('button');
    next.className = 'page-btn';
    next.textContent = '›';
    next.disabled = currentPage >= totalPages;
    next.onclick = () => onPageChange(currentPage + 1);
    el.appendChild(next);
  }

  // ── Tab switching ───────────────────────────────────────────────────────────
  const tabLoaded = { details: false, requests: false, booked: false, bank: false, availability: false, location: false, push: false, payout: false, subscriptions: false };
  let _cachedUser = null;
  let _cachedLocations = [];

  function activateTab(name) {
    console.log('[STAG Admin] User detail tab:', name);
    document.querySelectorAll('.user-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === name);
    });
    document.querySelectorAll('.user-tab-panel').forEach(panel => {
      panel.style.display = panel.id === 'tab-' + name ? '' : 'none';
    });

    // Lazy-load on first visit
    if (name === 'requests' && !tabLoaded.requests) {
      tabLoaded.requests = true;
      loadUserRequests(1);
    }
    if (name === 'booked' && !tabLoaded.booked) {
      tabLoaded.booked = true;
      loadBookedClubs(1);
    }
    if (name === 'bank' && !tabLoaded.bank) {
      tabLoaded.bank = true;
      loadBankAccount();
    }
    if (name === 'availability' && !tabLoaded.availability) {
      tabLoaded.availability = true;
      loadAvailabilityTab();
    }
    if (name === 'location' && !tabLoaded.location) {
      tabLoaded.location = true;
      loadLocationTab();
    }
    if (name === 'push' && !tabLoaded.push) {
      tabLoaded.push = true;
      initPushTab();
    }
    if (name === 'payout' && !tabLoaded.payout) {
      tabLoaded.payout = true;
      initPayoutRowClicks();
      loadPayoutHistory(1);
    }
    if (name === 'subscriptions' && !tabLoaded.subscriptions) {
      tabLoaded.subscriptions = true;
      loadUserSubscriptions();
    }
  }

  const subStatusMap = {
    live: 'badge-active',
    scheduled: 'badge-pending',
    exhausted: 'badge-inactive',
    expired: 'badge-expired',
  };

  let userSubs = {
    dailyAllowance: 0,
    dailyUsed: 0,
    live: { items: [], total: 0, page: 1, limit: 10 },
    older: { items: [], total: 0, page: 1, limit: 10 },
  };

  function asPaged(raw) {
    return {
      items: (raw && raw.items) || [],
      total: (raw && raw.total) || 0,
      page: (raw && raw.page) || 1,
      limit: (raw && raw.limit) || 10,
    };
  }

  function packEndAt(row) {
    if (!row) return '';
    if (row.status === 'expired') return row.expiresAt || row.updatedAt || '';
    if (row.status === 'exhausted') return row.updatedAt || row.expiresAt || '';
    return row.expiresAt || row.updatedAt || '';
  }

  function renderSubCard(row, queued) {
    const purpose = row.purpose || 'entry';
    const credits = '<strong>' + esc(row.creditsLeft) + '</strong> / ' + esc(row.creditCount);
    let expiryLine;
    if (queued) {
      expiryLine = 'Starts after current pack';
    } else if (row.neverExpires) {
      expiryLine = 'Expires ∞';
    } else {
      expiryLine = 'Expires ' + esc(fmtDate(row.expiresAt));
    }
    return `
      <article class="user-sub-card${queued ? ' user-sub-card--queued' : ''}">
        <div class="user-sub-card-top">
          <span class="user-sub-card-name">${esc(row.name || 'Pack')}</span>
          ${badge(purpose, { entry: 'badge-basic' })}
        </div>
        <p class="user-sub-card-credits">${credits} left</p>
        <p class="user-sub-card-meta">Bought ${esc(fmtDate(row.createdAt))}<br>${expiryLine}</p>
      </article>
    `;
  }

  function renderUserSubscriptions() {
    const dailyEl = document.getElementById('userSubsDaily');
    const liveEl = document.getElementById('userSubsLive');
    const olderEl = document.getElementById('userSubsOlder');
    const allowance = userSubs.dailyAllowance;
    const used = userSubs.dailyUsed;
    dailyEl.innerHTML = `
      <div class="user-subs-daily">
        <span class="user-subs-daily-label">Daily free</span>
        <span class="user-subs-daily-value">${esc(used)} / ${esc(allowance)}</span>
        <span class="user-subs-daily-hint">${allowance === 0 ? 'No daily free' : 'UTC today'}</span>
      </div>
    `;

    const liveItems = userSubs.live.items;
    const inUse = liveItems.filter(function (row) { return row.status === 'live'; });
    const queued = liveItems.filter(function (row) { return row.status === 'scheduled'; });
    const noPaid = userSubs.live.total === 0 && userSubs.older.total === 0;

    let liveHtml = '';
    if (noPaid) {
      liveHtml = '<p class="user-subs-empty">No paid pack. Daily only.</p>';
    } else {
      liveHtml += '<div class="user-subs-block"><h4 class="user-subs-heading">Live packs</h4>';
      if (!inUse.length && !queued.length) {
        liveHtml += '<p class="user-subs-empty">No pack in use.</p>';
      } else {
        liveHtml += '<div class="user-subs-live-row">';
        liveHtml += inUse.map(function (row) { return renderSubCard(row, false); }).join('');
        liveHtml += queued.map(function (row) { return renderSubCard(row, true); }).join('');
        liveHtml += '</div>';
      }
      if (userSubs.live.items.length < userSubs.live.total) {
        liveHtml += '<button class="btn-sm btn-ghost user-subs-more" type="button" data-subs-more="live">See more</button>';
      }
      liveHtml += '</div>';
    }
    liveEl.innerHTML = liveHtml;

    if (noPaid) {
      olderEl.innerHTML = '';
      return;
    }

    const olderRows = userSubs.older.items.map(function (row) {
      return `<tr>
        <td>${esc(row.name || '—')}</td>
        <td>${esc(row.creditsLeft)} / ${esc(row.creditCount)}</td>
        <td>${badge(row.status, subStatusMap)}</td>
        <td>${esc(fmtDate(row.createdAt))}</td>
        <td>${esc(fmtDate(row.startsAt))}</td>
        <td>${esc(fmtDate(packEndAt(row)))}</td>
      </tr>`;
    }).join('');

    let olderHtml = '<div class="user-subs-block"><h4 class="user-subs-heading">Older</h4>';
    if (!userSubs.older.items.length) {
      olderHtml += '<p class="user-subs-empty">No past packs.</p>';
    } else {
      olderHtml += `<div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Plan</th><th>Credits</th><th>Status</th><th>Bought</th><th>Start</th><th>End</th></tr></thead>
          <tbody>${olderRows}</tbody>
        </table>
      </div>`;
      if (userSubs.older.items.length < userSubs.older.total) {
        olderHtml += '<button class="btn-sm btn-ghost user-subs-more" type="button" data-subs-more="older">See more</button>';
      }
    }
    olderHtml += '</div>';
    olderEl.innerHTML = olderHtml;
  }

  async function loadUserSubscriptions() {
    const dailyEl = document.getElementById('userSubsDaily');
    dailyEl.innerHTML = '<div class="detail-loading">Loading subscriptions…</div>';
    document.getElementById('userSubsLive').innerHTML = '';
    document.getElementById('userSubsOlder').innerHTML = '';
    const result = await apiAbs(API_BASE + '/v1/subscription/user/' + encodeURIComponent(userId));
    if (!result.ok || !result.data) {
      dailyEl.innerHTML = '<div class="detail-error">Failed to load subscriptions.</div>';
      toast((result.data && result.data.message) || 'Failed to load subscriptions');
      return;
    }
    userSubs.dailyAllowance = Number.isInteger(result.data.dailyAllowance) && result.data.dailyAllowance >= 0
      ? result.data.dailyAllowance
      : 0;
    userSubs.dailyUsed = Number.isInteger(result.data.dailyUsed) && result.data.dailyUsed >= 0
      ? result.data.dailyUsed
      : 0;
    userSubs.live = asPaged(result.data.live);
    userSubs.older = asPaged(result.data.older);
    renderUserSubscriptions();
  }

  async function loadMoreUserSubs(listType) {
    const bag = listType === 'older' ? userSubs.older : userSubs.live;
    const nextPage = (bag.page || 1) + 1;
    const result = await apiAbs(
      API_BASE + '/v1/subscription/user/' + encodeURIComponent(userId) +
      '/more?type=' + encodeURIComponent(listType) + '&page=' + nextPage + '&limit=' + (bag.limit || 10)
    );
    if (!result.ok || !result.data) {
      toast((result.data && result.data.message) || 'Failed to load more packs');
      return;
    }
    const page = asPaged(result.data);
    bag.items = bag.items.concat(page.items);
    bag.page = page.page;
    bag.total = page.total;
    bag.limit = page.limit;
    renderUserSubscriptions();
  }

  document.getElementById('tab-subscriptions').addEventListener('click', function (ev) {
    const btn = ev.target.closest('[data-subs-more]');
    if (!btn) return;
    btn.disabled = true;
    loadMoreUserSubs(btn.getAttribute('data-subs-more'));
  });

  // ── Payout History tab ────────────────────────────────────────────────────────

  // Module-level map so the single tbody click listener always has current data
  const _payoutItemMap = {};

  function isoWeekToRange(isoWeek) {
    if (!isoWeek) return '—';
    const match = isoWeek.match(/^(\d{4})-W(\d{2})$/);
    if (!match) return isoWeek;
    const year = parseInt(match[1], 10);
    const week = parseInt(match[2], 10);
    // ISO week 1 contains Jan 4; week starts Monday
    const jan4      = new Date(Date.UTC(year, 0, 4));
    const dayOfWeek = (jan4.getUTCDay() + 6) % 7; // 0=Mon…6=Sun
    const weekMon   = new Date(jan4);
    weekMon.setUTCDate(jan4.getUTCDate() - dayOfWeek + (week - 1) * 7);
    const weekSun   = new Date(weekMon);
    weekSun.setUTCDate(weekMon.getUTCDate() + 6);
    const fmt = d => d.toLocaleString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' });
    return `Wk ${week}, ${year} &nbsp;<span style="color:var(--muted);font-size:0.72rem">(${fmt(weekMon)} – ${fmt(weekSun)})</span>`;
  }

  // Date-range only (no "Wk N" prefix) — used in the payout list
  function isoWeekDateRange(isoWeek) {
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
    const fmtShort = d => d.toLocaleString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' });
    const fmtFull  = d => d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
    return `${fmtShort(weekMon)} – ${fmtFull(weekSun)}`;
  }

  const ledgerTypeBadge = {
    PAYOUT:  'badge-confirmed',
    EARNING: 'badge-completed',
    PENALTY: 'badge-cancelled',
  };
  const settlementBadgeMap = {
    PENDING:   'badge-pending',
    COMPLETED: 'badge-completed',
    FAILED:    'badge-cancelled',
  };

  function payoutSummaryCard(label, value, color) {
    return `
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:14px 16px">
        <div style="color:var(--muted);font-size:0.73rem;margin-bottom:4px">${esc(label)}</div>
        <div style="font-size:1.1rem;font-weight:600;color:${color}">${value}</div>
      </div>`;
  }

  async function loadPayoutHistory(p) {
    const body  = document.getElementById('payoutBody');
    const empty = document.getElementById('payoutEmpty');
    if (!body) return;

    body.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:24px">Loading…</td></tr>';

    const { ok, data } = await apiAbs(
      API_BASE + '/v1/payment/users/' + encodeURIComponent(userId) + '/ledger?page=' + p + '&limit=10'
    );

    if (!ok || !data || !data.data) {
      body.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:24px">Failed to load payout history.</td></tr>';
      return;
    }

    const { items, total, limit } = data.data;
    const summary = data.summary;
    const totalPages = Math.ceil((total || 0) / (limit || 10));

    // Render summary cards
    const summaryEl = document.getElementById('payoutSummary');
    if (summaryEl && summary) {
      summaryEl.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin:0 0 20px">
          ${payoutSummaryCard('Pending Amount', fmtCurrency(summary.pendingAmount), '#ff9800')}
          ${payoutSummaryCard('Total Earning',  fmtCurrency(summary.totalEarning),  '#50c878')}
          ${payoutSummaryCard('Total Payout',   fmtCurrency(summary.totalPayout),   '#42a5f5')}
          ${payoutSummaryCard('Total Penalty',  fmtCurrency(summary.totalPenalty),  '#ef5350')}
        </div>`;
    }

    if (!items || !items.length) {
      body.innerHTML = '';
      if (empty) empty.classList.remove('hidden');
      renderPagination('payoutPagination', p, 0, loadPayoutHistory);
      return;
    }
    if (empty) empty.classList.add('hidden');

    // Map of id → item for event delegation click handler
    const payoutItemMap = _payoutItemMap;
    // Clear previous page entries and populate with current page
    Object.keys(payoutItemMap).forEach(k => delete payoutItemMap[k]);

    body.innerHTML = items.map(item => {
      payoutItemMap[item.id] = item;
      const typeCls  = ledgerTypeBadge[item.type]   || 'badge-inactive';
      const settlCls = settlementBadgeMap[item.settlementStatus] || 'badge-inactive';

      // Secondary info line shown under amount
      let subInfo = '';
      if (item.type === 'PAYOUT' && item.deductions) {
        const d = item.deductions;
        subInfo = `<div style="font-size:0.71rem;color:var(--muted);margin-top:3px">Base ₹${(item.basePrice||0).toFixed(0)} &minus; Fee ₹${(d.PlatformFee||0).toFixed(0)} &minus; GST ₹${(d.GST||0).toFixed(0)}${d.Penalty ? ` &minus; Penalty ₹${d.Penalty.toFixed(0)}` : ''}</div>`;
      } else if (item.type === 'EARNING') {
        subInfo = `<div style="font-size:0.71rem;color:var(--muted);margin-top:3px">Base ₹${(item.basePrice||0).toFixed(0)}${item.platformFee ? ` &minus; Fee ₹${item.platformFee.toFixed(0)}` : ''}${item.gst ? ` &minus; GST ₹${item.gst.toFixed(0)}` : ''}</div>`;
      } else if (item.type === 'PENALTY') {
        subInfo = `<div style="font-size:0.71rem;color:#ef5350;margin-top:3px">Penalty: ₹${Math.abs(item.penalty||0).toFixed(0)}</div>`;
      }

      // Requests cell
      let reqCell;
      if (item.type === 'PAYOUT' && item.requestIds && item.requestIds.length) {
        reqCell = `<span style="display:inline-flex;align-items:center;gap:5px;background:rgba(66,165,245,0.12);border:1px solid rgba(66,165,245,0.25);border-radius:6px;padding:3px 8px;font-size:0.75rem;color:#42a5f5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          ${item.requestIds.length} requests</span>`;
      } else if (item.requestId) {
        reqCell = `<a href="request.html?id=${encodeURIComponent(item.requestId)}" onclick="event.stopPropagation()" style="color:var(--red);font-family:monospace;font-size:0.72rem">${shortId(item.requestId)}</a>`;
      } else {
        reqCell = '—';
      }

      return `
        <tr class="clickable-row" style="cursor:pointer" data-payout-id="${esc(item.id)}">
          <td>
            <span class="badge ${typeCls}">${esc(item.type)}</span>
            ${item.referenceId ? `<div style="font-family:monospace;font-size:0.68rem;color:var(--muted);margin-top:3px">${esc(item.referenceId)}</div>` : ''}
          </td>
          <td>${fmtCurrency(item.finalAmount)}${subInfo}</td>
          <td style="font-size:0.78rem;color:var(--muted);white-space:nowrap">${isoWeekDateRange(item.isoWeek)}</td>
          <td><span class="badge ${settlCls}">${esc(item.settlementStatus)}</span></td>
          <td>${reqCell}</td>
          <td style="color:var(--muted);font-size:0.8rem">${fmtDate(item.createdAt)}</td>
        </tr>`;
    }).join('');

    renderPagination('payoutPagination', p, totalPages, loadPayoutHistory);
  }

  // Single event delegation listener for payout rows — set up once when tab first loads
  function initPayoutRowClicks() {
    const body = document.getElementById('payoutBody');
    if (!body) return;
    body.addEventListener('click', function (e) {
      if (e.target.closest('a')) return;
      const row = e.target.closest('tr[data-payout-id]');
      if (!row) return;
      const id   = row.dataset.payoutId;
      const item = _payoutItemMap[id];
      if (!item) return;
      try { sessionStorage.setItem('payoutItem', JSON.stringify(item)); } catch (_) {}
      window.location = `payout.html?id=${encodeURIComponent(id)}&userId=${encodeURIComponent(userId)}`;
    });
  }


  // ── Push Notification tab ────────────────────────────────────────────────────
  function initPushTab() {
    const btn      = document.getElementById('pushSendBtn');
    const feedback = document.getElementById('pushFeedback');
    if (!btn) return;

    btn.addEventListener('click', async () => {
      const title   = (document.getElementById('pushTitle').value || '').trim();
      const message = (document.getElementById('pushMessage').value || '').trim();
      if (!message) { feedback.style.color = '#e74c3c'; feedback.textContent = 'Message is required.'; return; }

      btn.disabled = true;
      feedback.style.color = 'var(--muted)';
      feedback.textContent = 'Sending…';

      const { ok, data } = await apiAbs(
        API_BASE + '/v1/users/' + encodeURIComponent(userId) + '/push',
        { method: 'POST', body: JSON.stringify({ title, message }) }
      );

      btn.disabled = false;
      if (ok) {
        feedback.style.color = '#50c878';
        feedback.textContent = data?.message || 'Sent successfully.';
        document.getElementById('pushTitle').value   = '';
        document.getElementById('pushMessage').value = '';
      } else {
        feedback.style.color = '#e74c3c';
        feedback.textContent = data?.message || 'Failed to send. User may not have a device token.';
      }
    });
  }

  // ── Hero (always visible) ────────────────────────────────────────────────────
  function renderHero(u) {
    const isBanned = u.status === 'banned';
    hero.innerHTML = `
      <div class="detail-hero">
        ${avatarHtml(u)}
        <div class="detail-hero-info">
          <div class="detail-hero-name">${esc(u.name) || '—'}</div>
          <div class="detail-hero-badges">
            ${badge(u.gender, genderMap)}
            ${badge(u.status, statusMap)}
          </div>
          <div style="color:var(--muted);font-size:0.82rem">${esc(u.email) || '—'}</div>
        </div>
        <div class="action-menu-wrap">
          <button class="action-menu-btn" id="actionMenuBtn" title="Actions" aria-label="User actions">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
          </button>
          <div class="action-menu" id="actionMenu">
            <button class="action-menu-item ${isBanned ? 'item-success' : 'item-danger'}" id="menuToggleBan">
              ${isBanned ? 'Unban User' : 'Ban User'}
            </button>
            <button class="action-menu-item item-danger" id="menuDeleteUser">
              Delete User
            </button>
          </div>
        </div>
      </div>
    `;
    initLightbox(u.profilePicUrl);
    initActionMenu(u);
  }

  // ── Details tab content ──────────────────────────────────────────────────────
  function renderDetails(u, locations) {
    const phone    = ((u.phoneExt || '') + (u.phone || '')) || '—';
    const rating   = u.ratings != null
      ? `${Number(u.ratings).toFixed(1)} (${u.ratingCount || 0})`
      : '—';
    const isFemale = u.gender === 'female';
    const isAvailable = u.status === 'active';

    // Compact availability toggle row (female users only)
    const availabilityRow = isFemale ? `
      <p class="detail-section-title" style="margin-top:24px">Availability</p>
      <div class="detail-grid">
        <div class="detail-field" style="grid-column:1/-1">
          <div class="avail-toggle-row">
            <span class="avail-toggle-label">Status</span>
            <label class="toggle-switch" title="Toggle availability">
              <input type="checkbox" id="availToggleInput" ${isAvailable ? 'checked' : ''}>
              <span class="toggle-track"></span>
            </label>
            <span class="avail-status-text" id="availStatusText" style="color:${isAvailable ? '#50c878' : 'var(--muted)'}">
              ${isAvailable ? 'Available' : 'Inactive'}
            </span>
          </div>
        </div>
      </div>
    ` : '';

    document.getElementById('tab-details').innerHTML = `
      <p class="detail-section-title">Contact</p>
      <div class="detail-grid">
        ${field('Email',        esc(u.email) || '—')}
        ${field('Phone',        esc(phone))}
        ${field('Date of Birth', esc(u.dateOfBirth) || '—')}
        ${field('Gender',       badge(u.gender, genderMap))}
      </div>

      <p class="detail-section-title">Account</p>
      <div class="detail-grid">
        ${field('Status',         badge(u.status, statusMap))}
        ${field('Rating',         esc(rating))}
        ${field('Total Bookings', u.totalCount != null ? esc(u.totalCount) : '—')}
        ${field('Charge Amount',  u.chargeAmount ? fmtCurrency(u.chargeAmount) : '—')}
        ${field('Referral Code',  esc(u.referralCode) || '—')}
        ${field('Referred By',    esc(u.referredByCode) || '—')}
      </div>

      <p class="detail-section-title">Timeline</p>
      <div class="detail-grid">
        ${field('Joined',       fmtDate(u.createdAt))}
        ${field('Last Updated', fmtDate(u.updatedAt))}
      </div>

      <p class="detail-section-title">Device</p>
      <div class="detail-grid">
        ${field('OS',           esc(u.deviceOs)      || '—')}
        ${field('OS Version',   esc(u.deviceOsVersion) || '—')}
        ${field('Device Model', esc(u.deviceModel)   || '—')}
        ${field('App Version',  esc(u.appVersion)    || '—')}
        ${field('Country',      esc(u.deviceCountry) || '—')}
      </div>

      ${availabilityRow}
    `;

    // Wire toggle switch
    const toggleInput = document.getElementById('availToggleInput');
    if (toggleInput) {
      toggleInput.addEventListener('change', async () => {
        toggleInput.disabled = true;
        const { ok, data: updated } = await apiAbs(
          API_BASE + '/v1/users/' + encodeURIComponent(userId) + '/toggle-available',
          { method: 'PATCH' }
        );
        if (!ok) {
          toast('Failed to update availability');
          toggleInput.checked = !toggleInput.checked; // revert
          toggleInput.disabled = false;
          return;
        }
        // Update status text + colour immediately without full reload
        const nowAvailable = updated && updated.status === 'active';
        const statusText = document.getElementById('availStatusText');
        if (statusText) {
          statusText.textContent = nowAvailable ? 'Available' : 'Inactive';
          statusText.style.color = nowAvailable ? '#50c878' : 'var(--muted)';
        }
        toggleInput.checked = nowAvailable;
        toggleInput.disabled = false;
        toast('Availability updated');
        // Reset availability tab so it re-renders next time
        tabLoaded.availability = false;
        // Update cached user status
        if (_cachedUser) _cachedUser.status = updated ? updated.status : (nowAvailable ? 'active' : 'inactive');
      });
    }

    tabLoaded.details = true;
  }

  // ── Availability tab ─────────────────────────────────────────────────────────
  function loadAvailabilityTab() {
    const u = _cachedUser;
    const container = document.getElementById('availabilityBody');
    if (!u) { container.innerHTML = '<p style="color:var(--muted)">No data.</p>'; return; }

    const isAvailable = u.status === 'active';
    const changelog = Array.isArray(u.availabilityChangelog) ? u.availabilityChangelog : [];

    container.innerHTML = `
      <p class="detail-section-title">Current Availability</p>
      <div class="detail-grid" style="margin-bottom:24px">
        <div class="detail-field" style="grid-column:1/-1">
          <div class="avail-toggle-row">
            <span class="avail-toggle-label">Status</span>
            <label class="toggle-switch" title="Toggle availability">
              <input type="checkbox" id="availToggleInput2" ${isAvailable ? 'checked' : ''}>
              <span class="toggle-track"></span>
            </label>
            <span class="avail-status-text" id="availStatusText2" style="color:${isAvailable ? '#50c878' : 'var(--muted)'}">
              ${isAvailable ? 'Available' : 'Inactive'}
            </span>
          </div>
        </div>
      </div>

      <p class="detail-section-title">Availability History
        <span style="font-size:0.75rem;font-weight:400;color:var(--muted);margin-left:8px">(${changelog.length} record${changelog.length !== 1 ? 's' : ''})</span>
      </p>
      ${changelog.length === 0
        ? '<p style="color:var(--muted);font-size:0.85rem;padding:8px 0">No history yet.</p>'
        : `<div class="table-wrap" style="margin-top:0">
            <table class="data-table">
              <thead><tr><th>Changed At</th><th>Changed By</th><th>Role</th><th>To Status</th></tr></thead>
              <tbody>
                ${[...changelog].reverse().map(entry => `
                  <tr>
                    <td style="color:var(--muted)">${fmtDate(entry.changedAt)}</td>
                    <td style="font-family:monospace;font-size:0.78rem">${esc(entry.changedBy) || '—'}</td>
                    <td>${entry.changedByRole === 'admin'
                      ? '<span class="badge badge-blocked">Admin</span>'
                      : '<span class="badge badge-active">User</span>'}</td>
                    <td>${badge(entry.toStatus, statusMap)}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>`}
    `;

    // Wire second toggle
    const t2 = document.getElementById('availToggleInput2');
    if (t2) {
      t2.addEventListener('change', async () => {
        t2.disabled = true;
        const { ok, data: updated } = await apiAbs(
          API_BASE + '/v1/users/' + encodeURIComponent(userId) + '/toggle-available',
          { method: 'PATCH' }
        );
        if (!ok) {
          toast('Failed to update availability');
          t2.checked = !t2.checked;
          t2.disabled = false;
          return;
        }
        toast('Availability updated');
        // Refresh availability tab fully
        if (updated && _cachedUser) _cachedUser.status = updated.status;
        tabLoaded.availability = false;
        tabLoaded.details = false;
        loadAvailabilityTab();
        tabLoaded.availability = true;
      });
    }
  }

  // ── Location tab ─────────────────────────────────────────────────────────────
  function loadLocationTab() {
    const locs = _cachedLocations;
    const container = document.getElementById('locationBody');

    container.innerHTML = `
      <p class="detail-section-title">Current Location
        <span style="font-size:0.75rem;font-weight:400;color:var(--muted);margin-left:8px">(${locs.length} record${locs.length !== 1 ? 's' : ''})</span>
      </p>
      ${locs.length === 0
        ? '<p style="color:var(--muted);font-size:0.85rem;padding:8px 0">No location data available.</p>'
        : `<div class="table-wrap" style="margin-top:0">
            <table class="data-table">
              <thead><tr><th>Name</th><th>Address</th><th>Lat</th><th>Lng</th><th>Updated</th></tr></thead>
              <tbody>
                ${locs.map(loc => `
                  <tr>
                    <td>${esc(loc.name) || '—'}</td>
                    <td>${esc(loc.address) || '—'}</td>
                    <td style="font-family:monospace;font-size:0.78rem">${loc.lat != null ? loc.lat : '—'}</td>
                    <td style="font-family:monospace;font-size:0.78rem">${loc.lng != null ? loc.lng : '—'}</td>
                    <td style="color:var(--muted)">${fmtDate(loc.updated_at)}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>`}
    `;
  }

  async function toggleBan() {
    const { ok: loaded, data: current } = await apiAbs(API_BASE + '/v1/users/' + encodeURIComponent(userId));
    const isBanned = loaded && current && current.status === 'banned';
    const action   = isBanned ? 'unban' : 'ban';
    if (!confirm(`Are you sure you want to ${action} this user?`)) return;
    const { ok } = await apiAbs(
      API_BASE + '/v1/users/' + encodeURIComponent(userId) + '/toggle-ban',
      { method: 'PATCH' }
    );
    if (!ok) { toast('Failed to update user'); return; }
    toast('User status updated');
    load();
  }

  async function deleteUser() {
    if (!confirm('Are you sure you want to permanently delete this user? This action cannot be undone.')) return;
    const { ok } = await apiAbs(
      API_BASE + '/v1/users/' + encodeURIComponent(userId) + '/delete',
      { method: 'DELETE' }
    );
    if (!ok) { toast('Failed to delete user'); return; }
    toast('User deleted');
    setTimeout(() => { window.location.href = 'dashboard.html#users'; }, 1200);
  }

  // ── Club Requests tab ────────────────────────────────────────────────────────
  let userReqPage = 1;

  async function loadUserRequests(p) {
    userReqPage = p;
    const status   = document.getElementById('userReqStatusFilter').value;
    const timeline = document.getElementById('userReqTimelineFilter').value;
    const params   = new URLSearchParams({ page: p, limit: 10, userId });
    if (status)   params.set('status', status);
    if (timeline) params.set('timeline', timeline);

    const { ok, data } = await apiAbs(
      API_BASE + '/v1/request?' + params
    );
    const items      = ok && data && Array.isArray(data.items) ? data.items : null;
    const total      = (ok && data && data.total) || 0;
    const limit      = (ok && data && data.limit) || 10;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const tbody = document.getElementById('userReqBody');
    const empty = document.getElementById('userReqEmpty');

    if (!items || items.length === 0) {
      tbody.innerHTML = '';
      empty.classList.remove('hidden');
      document.getElementById('userReqPagination').innerHTML = '';
      return;
    }
    empty.classList.add('hidden');

    const refundableStatuses = new Set(['confirmed', 'completed']);

    tbody.innerHTML = items.map(req => {
      const canRefund = refundableStatuses.has(req.status);
      const amount    = req.payment ? (req.payment.mUserTotalPayable ?? req.payment.baseAmount ?? '') : '';
      const refundBtn = canRefund
        ? `<button class="btn-sm" style="background:#e74c3c;color:#fff;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:0.75rem"
             onclick="event.stopPropagation();openRefundModal('${esc(req.id)}','${esc(req.clubName)}',${amount})">Refund</button>`
        : '';
      return `
      <tr class="clickable-row" onclick="window.location='request.html?id=${encodeURIComponent(req.id)}'" style="cursor:pointer">
        <td style="font-size:0.73rem;color:var(--muted);font-family:monospace">${req.id || '—'}</td>
        <td><strong>${esc(req.clubName) || '—'}</strong><br/><span style="font-size:0.75rem;color:var(--muted)">${esc(req.clubAddress) || ''}</span></td>
        <td style="font-size:0.78rem">${req.mUser ? esc(req.mUser.username) : (req.mUserId || '—')}</td>
        <td style="font-size:0.78rem">${req.fUser ? esc(req.fUser.username) : (req.fUserId || '—')}</td>
        <td>${badge(req.status, reqStatusMap)}</td>
        <td style="color:var(--muted)">${fmtDate(req.datetime)}</td>
        <td>${req.payment ? fmtCurrency(req.payment.mUserTotalPayable) : '—'}</td>
        <td>${refundBtn}</td>
      </tr>`;
    }).join('');

    renderPagination('userReqPagination', p, totalPages, loadUserRequests);
  }

  // ── Refund modal ─────────────────────────────────────────────────────────────
  let _refundRequestId = null;

  function openRefundModal(requestId, clubName, defaultAmount) {
    _refundRequestId = requestId;
    document.getElementById('refundModalDesc').textContent =
      `Issue a refund for request at "${clubName}".`;
    document.getElementById('refundAmount').value = defaultAmount || '';
    document.getElementById('refundReason').value = '';
    const modal = document.getElementById('refundModal');
    modal.style.display = 'flex';
  }

  function closeRefundModal() {
    document.getElementById('refundModal').style.display = 'none';
    _refundRequestId = null;
  }

  document.getElementById('refundCancelBtn').addEventListener('click', closeRefundModal);
  document.getElementById('refundModal').addEventListener('click', e => {
    if (e.target === document.getElementById('refundModal')) closeRefundModal();
  });

  document.getElementById('refundConfirmBtn').addEventListener('click', async () => {
    if (!_refundRequestId) return;
    const amount = parseFloat(document.getElementById('refundAmount').value);
    const reason = document.getElementById('refundReason').value.trim() || 'Admin-initiated refund';
    if (!amount || amount <= 0) { toast('Enter a valid refund amount'); return; }

    const confirmBtn = document.getElementById('refundConfirmBtn');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Processing…';

    const { ok, data } = await apiAbs(
      API_BASE + '/v1/payment/requests/' + encodeURIComponent(_refundRequestId) + '/refund',
      { method: 'POST', body: JSON.stringify({ amount, reason, overrideAction: true }) }
    );

    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Confirm Refund';

    if (ok) {
      toast(data?.message || 'Refund processed successfully.');
      closeRefundModal();
      loadUserRequests(userReqPage);
    } else {
      toast(data?.message || 'Refund failed. Please try again.');
    }
  });

  // ── Booked Clubs tab ─────────────────────────────────────────────────────────
  let bookedPage = 1;

  async function loadBookedClubs(p) {
    bookedPage = p;
    const paramsFwd = new URLSearchParams({
      page: p, limit: 10, userId,
      status: 'confirmed,verified,completed',
    });
    const paramsPast = new URLSearchParams({
      page: p, limit: 10, userId, timeline: 'past',
      status: 'confirmed,verified,completed',
    });

    const [fwd, past] = await Promise.all([
      apiAbs(API_BASE + '/v1/request/user/' + REQ_PLACEHOLDER_ID + '?' + paramsFwd),
      apiAbs(API_BASE + '/v1/request/user/' + REQ_PLACEHOLDER_ID + '?' + paramsPast),
    ]);

    const seen = new Set();
    const merged = [];
    for (const src of [fwd, past]) {
      if (src.ok && src.data && Array.isArray(src.data.items)) {
        for (const item of src.data.items) {
          if (!seen.has(item.id)) { seen.add(item.id); merged.push(item); }
        }
      }
    }

    const now = Date.now();
    merged.sort((a, b) => {
      const da = new Date(a.datetime), db = new Date(b.datetime);
      const aFuture = da > now, bFuture = db > now;
      if (aFuture && !bFuture) return -1;
      if (!aFuture && bFuture) return 1;
      return aFuture ? da - db : db - da;
    });

    const fwdTotal    = (fwd.ok  && fwd.data  && fwd.data.total)  || 0;
    const pastTotal   = (past.ok && past.data && past.data.total) || 0;
    const totalMerged = Math.min(fwdTotal + pastTotal, merged.length);
    const totalPages  = Math.max(1, Math.ceil(totalMerged / 10));

    const tbody = document.getElementById('bookedBody');
    const empty = document.getElementById('bookedEmpty');

    if (merged.length === 0) {
      tbody.innerHTML = '';
      empty.classList.remove('hidden');
      document.getElementById('bookedPagination').innerHTML = '';
      return;
    }
    empty.classList.add('hidden');

    tbody.innerHTML = merged.map(req => `
      <tr class="clickable-row" onclick="window.location='request.html?id=${encodeURIComponent(req.id)}'" style="cursor:pointer">
        <td><strong>${esc(req.clubName) || '—'}</strong></td>
        <td style="font-size:0.78rem;color:var(--muted)">${esc(req.clubAddress) || '—'}</td>
        <td>${badge(req.status, reqStatusMap)}</td>
        <td style="color:var(--muted)">${fmtDate(req.datetime)}</td>
        <td>${req.payment ? fmtCurrency(req.payment.mUserTotalPayable) : '—'}</td>
      </tr>
    `).join('');

    renderPagination('bookedPagination', p, totalPages, loadBookedClubs);
  }
  // ── Bank Account tab ──────────────────────────────────────────────────────────────
  async function loadBankAccount() {
    const container = document.getElementById('bankAccountBody');
    container.innerHTML = '<div class="detail-loading">Loading bank account…</div>';

    const { ok, data } = await apiAbs(
      API_BASE + '/v1/users/' + encodeURIComponent(userId) + '/bank-account'
    );

    if (!ok || !data || !data.accountNumber) {
      container.innerHTML = `
        <div class="table-empty" style="padding:40px 0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
          <p>No bank account on file</p>
        </div>`;
      return;
    }

    container.innerHTML = `
      <p class="detail-section-title">Bank Account Details</p>
      <div class="detail-grid">
        ${field('Account Holder', esc(data.accountHolderName) || '—')}
        ${field('Account Number', `<span style="font-family:monospace;letter-spacing:0.08em">${esc(data.accountNumber)}</span>`)}
        ${field('IFSC Code',      `<span style="font-family:monospace">${esc(data.ifsc) || '—'}</span>`)}
        ${field('Bank Name',      esc(data.bankName) || '—')}
        ${field('Account Type',   esc(data.accountType) || '—')}
      </div>`;
  }
  // ── Load ────────────────────────────────────────────────────────────────────
  async function load() {
    // Fetch user + location in parallel
    const [userRes, locRes] = await Promise.all([
      apiAbs(API_BASE + '/v1/users/' + encodeURIComponent(userId)),
      apiAbs(API_BASE + '/v1/userlocation/user-locations/' + encodeURIComponent(userId)),
    ]);

    const data = userRes.data;
    if (!userRes.ok || !data || !data.id) {
      hero.innerHTML = '<div class="detail-error">User not found.</div>';
      return;
    }
    console.log('[STAG Admin] User detail page loaded for userId:', userId, '— name:', data.name);

    // The endpoint returns a single UserLocation object (not an array)
    const locations = (locRes.ok && locRes.data && locRes.data.id)
      ? [locRes.data]
      : [];

    // Cache for tab loaders
    _cachedUser = data;
    _cachedLocations = locations;
    // Reset lazy tabs so they re-render with fresh data
    tabLoaded.availability = false;
    tabLoaded.location = false;
    tabLoaded.details = false;

    renderHero(data);
    renderDetails(data, locations);

    // Show female-only tabs
    const bankTab = document.getElementById('bankTab');
    const availabilityTab = document.getElementById('availabilityTab');
    const locationTab = document.getElementById('locationTab');
    if (data.gender === 'female') {
      if (bankTab) bankTab.style.display = '';
      if (availabilityTab) availabilityTab.style.display = '';
      if (locationTab) locationTab.style.display = '';
      const payoutTab = document.getElementById('payoutTab');
      if (payoutTab) payoutTab.style.display = '';
    }

    // Show tab bar and activate the tab (respect URL hash for deep-linking)
    const tabBar = document.getElementById('userTabs');
    tabBar.style.display = '';
    const hashTab = window.location.hash.replace('#', '');
    const validTabs = Object.keys(tabLoaded);
    activateTab(validTabs.includes(hashTab) ? hashTab : 'details');

    // Wire tab buttons
    tabBar.querySelectorAll('.user-tab').forEach(btn => {
      btn.addEventListener('click', () => activateTab(btn.dataset.tab));
    });

    // Wire filter controls for Requests tab
    document.getElementById('userReqFilterBtn').addEventListener('click', () => loadUserRequests(1));
    document.getElementById('userReqStatusFilter').addEventListener('change', () => loadUserRequests(1));
    document.getElementById('userReqTimelineFilter').addEventListener('change', () => loadUserRequests(1));
  }

  // Expose for inline onclick handlers in dynamically-built table rows
  window.openRefundModal = openRefundModal;

  load();
})();