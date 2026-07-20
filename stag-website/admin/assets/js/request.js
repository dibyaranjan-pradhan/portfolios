/**
 * STAG Admin — Club Request detail page
 */
(function () {
  'use strict';

  // ── Auth guard ──────────────────────────────────────────────────────────────
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    window.location.href = 'index.html';
    return;
  }

  // ── Request id from query string ─────────────────────────────────────────────
  const requestId = new URLSearchParams(window.location.search).get('id');
  const content   = document.getElementById('reqContent');

  if (!requestId) {
    content.innerHTML = '<div class="detail-error">No request specified.</div>';
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

  // ── Toast ─────────────────────────────────────────────────────────────────────
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

  function field(label, value) {
    return `
      <div class="detail-card">
        <div class="detail-card-label">${esc(label)}</div>
        <div class="detail-card-value">${value}</div>
      </div>`;
  }

  // ── User card (avatar + name → user detail page) ──────────────────────────────
  function userCard(u, role) {
    if (!u) {
      return `
        <div class="req-user-card">
          <div class="req-user-avatar-wrap">
            <span class="ucell-avatar ucell-avatar-lg" data-initial="?"></span>
          </div>
          <div class="req-user-role">${esc(role)}</div>
          <div class="req-user-name" style="color:var(--muted)">Unknown</div>
        </div>`;
    }

    const initial = ((u.username || '?').trim().charAt(0) || '?').toUpperCase();
    const avatarInner = u.profilePicUrl
      ? `<img src="${esc(u.profilePicUrl)}" alt="" onerror="this.style.display='none'">`
      : '';
    const href = u.id ? `user.html?id=${encodeURIComponent(u.id)}` : '#';

    return `
      <div class="req-user-card">
        <a href="${href}" class="req-user-avatar-wrap" title="View user profile">
          <span class="ucell-avatar ucell-avatar-lg avatar-clickable" data-initial="${esc(initial)}">${avatarInner}</span>
          <div class="req-user-avatar-overlay">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </div>
        </a>
        <div class="req-user-role">${esc(role)}</div>
        <a href="${href}" class="req-user-name user-name-link">${esc(u.username) || '—'}</a>
        ${u.phone ? `<div class="req-user-phone">${esc(u.phone)}</div>` : ''}
      </div>`;
  }

  // ── Activity timeline ────────────────────────────────────────────────────────
  const activityStatusColors = {
    pending:           { dot: '#888',    label: 'Pending' },
    accepted:          { dot: '#4caf50', label: 'Accepted' },
    rejected:          { dot: '#ef5350', label: 'Rejected' },
    confirm_intended:  { dot: '#ff9800', label: 'Confirm Intended' },
    payment_initiated: { dot: '#ff9800', label: 'Payment Initiated' },
    confirmed:         { dot: '#42a5f5', label: 'Payment Confirmed' },
    verified:          { dot: '#26c6da', label: 'Meetup Verified' },
    completed:         { dot: '#66bb6a', label: 'Completed' },
    cancelled:         { dot: '#ef5350', label: 'Cancelled' },
    expired:           { dot: '#9e9e9e', label: 'Expired' },
  };

  // resolve a UUID to a display name using the request participants
  function resolveName(uuid, req) {
    if (!uuid || !req) return null;
    const mId = req.mUser && req.mUser.id;
    const fId = req.fUser && req.fUser.id;
    if (mId && uuid === mId) return (req.mUser.username || req.mUser.phone || 'Male User') + ' (Male)';
    if (fId && uuid === fId) return (req.fUser.username || req.fUser.phone || 'Female User') + ' (Female)';
    return null; // unknown UUID
  }

  function actorLabel(uuid, req) {
    const name = resolveName(uuid, req);
    return name
      ? `<strong>${esc(name)}</strong>`
      : `<span style="font-family:monospace;font-size:0.8rem;color:var(--muted)">${esc(uuid)}</span>`;
  }

  // build a human-readable description for each activity action
  function describeActivity(item, req) {
    const m = req && req.mUser ? (req.mUser.username || req.mUser.phone || 'Male User') : 'Male User';
    const f = req && req.fUser ? (req.fUser.username || req.fUser.phone || 'Female User') : 'Female User';
    const meta = item.metadata || {};

    switch (item.action) {
      case 'create':
        return `<strong>${esc(m)}</strong> sent a meetup request to <strong>${esc(f)}</strong> at <em>${esc(req && req.clubName || 'the club')}</em>.`;

      case 'respond': {
        const s = item.status;
        if (s === 'accepted')
          return `<strong>${esc(f)}</strong> <span style="color:#4caf50;font-weight:600">accepted</span> the request.`;
        if (s === 'rejected')
          return `<strong>${esc(f)}</strong> <span style="color:#ef5350;font-weight:600">rejected</span> the request.`;
        if (s === 'blocked')
          return `Request was <span style="color:#ef5350;font-weight:600">blocked</span>.`;
        return `<strong>${esc(f)}</strong> responded — new status: <em>${esc(s)}</em>.`;
      }

      case 'confirm_intended':
        return `<strong>${esc(m)}</strong> confirmed intention to pay and locked the booking.`;

      case 'payment_initiated': {
        const orderId = meta.orderId || '';
        return `<strong>${esc(m)}</strong> initiated payment.${orderId ? ` <span class="act-meta-pill">Order: ${esc(orderId)}</span>` : ''}`;
      }

      case 'payment_failed': {
        const orderId = meta.orderId || '';
        return `Payment <span style="color:#ef5350;font-weight:600">failed</span>.${orderId ? ` <span class="act-meta-pill">Order: ${esc(orderId)}</span>` : ''}`;
      }

      case 'confirmed': {
        const paymentId = meta.paymentId || '';
        const orderId   = meta.orderId   || '';
        return `<strong>${esc(m)}</strong>'s payment was <span style="color:#42a5f5;font-weight:600">confirmed</span> — booking locked in.`
          + (paymentId ? ` <span class="act-meta-pill">Payment ID: ${esc(paymentId)}</span>` : '')
          + (orderId   ? ` <span class="act-meta-pill">Order: ${esc(orderId)}</span>` : '');
      }

      case 'verifyOtp': {
        const isMUser = meta.isMUser === 'true';
        const submittedOtp = meta.otp || '';
        if (isMUser) {
          // mUser entered fUser's meetup code → meetup verified
          return `<strong>${esc(m)}</strong> entered <strong>${esc(f)}</strong>'s <em>Meetup Code</em>`
            + (submittedOtp ? ` (<code style="font-size:1rem;letter-spacing:3px">${esc(submittedOtp)}</code>)` : '')
            + ` — meetup verified ✓`;
        } else {
          // fUser entered mUser's satisfaction/entry code → completed
          return `<strong>${esc(f)}</strong> entered <strong>${esc(m)}</strong>'s <em>Satisfaction Code</em>`
            + (submittedOtp ? ` (<code style="font-size:1rem;letter-spacing:3px">${esc(submittedOtp)}</code>)` : '')
            + ` — meeting completed ✓`;
        }
      }

      case 'cancel': {
        const byId   = meta.cancelledBy || item.actedBy || '';
        const byType = meta.userType || '';
        const name   = resolveName(byId, req);
        const who    = name ? name : (byType === 'mUser' ? m : byType === 'fUser' ? f : byId || 'Unknown');
        return `Request was <span style="color:#ef5350;font-weight:600">cancelled</span> by <strong>${esc(who)}</strong>.`;
      }

      case 'delete':
        return `Request was <span style="color:#ef5350;font-weight:600">deleted</span>${meta.isAdmin === 'true' ? ' by an <strong>Admin</strong>' : ''}.`;

      default:
        return `Action: <em>${esc(item.action)}</em>`;
    }
  }

  function buildActivitySection(actData, req) {
    const section = document.createElement('div');
    section.id = 'req-activity-section';

    const items = (actData && Array.isArray(actData.activity) && actData.activity.length > 0)
      ? actData.activity
      : null;

    if (!items) {
      section.innerHTML = `
        <p class="detail-section-title">Activity Timeline</p>
        <div class="act-empty">No activity recorded for this request yet.</div>
      `;
      return section;
    }

    const timelineHtml = items.map((item, idx) => {
      const col    = activityStatusColors[item.status] || { dot: '#aaa', label: item.status || '—' };
      const isLast = idx === items.length - 1;
      const desc   = describeActivity(item, req);

      return `
        <div class="act-item${isLast ? ' act-item-last' : ''}">
          <div class="act-spine">
            <div class="act-dot" style="background:${col.dot};box-shadow:0 0 0 3px ${col.dot}22"></div>
            ${!isLast ? '<div class="act-line"></div>' : ''}
          </div>
          <div class="act-body">
            <div class="act-header">
              <span class="act-status-pill" style="background:${col.dot}22;color:${col.dot}">${esc(col.label)}</span>
              <span class="act-time" style="margin:0">${fmtDate(item.actedAt)}</span>
            </div>
            <div class="act-desc">${desc}</div>
          </div>
        </div>`;
    }).join('');

    section.innerHTML = `
      <p class="detail-section-title">Activity Timeline <span class="act-count">${items.length}</span></p>
      <div class="act-timeline">${timelineHtml}</div>
    `;
    return section;
  }

  // ── Codes section ─────────────────────────────────────────────────────────────
  function buildCodesSection(req) {
    // Only meaningful when confirmed or beyond
    const statusesWithCodes = ['confirmed', 'verified', 'completed'];
    const hasCodes = statusesWithCodes.includes(req.status);
    const mOtp = req.mUser && req.mUser.otp;
    const fOtp = req.fUser && req.fUser.otp;
    if (!hasCodes && !mOtp && !fOtp) return '';

    const mName = req.mUser ? (req.mUser.username || req.mUser.phone || 'Male User') : 'Male User';
    const fName = req.fUser ? (req.fUser.username || req.fUser.phone || 'Female User') : 'Female User';

    function codeBox(label, sublabel, hint, code, available) {
      const digits = available && code
        ? code.split('').map(d => `<span class="code-digit">${esc(d)}</span>`).join('')
        : `<span style="color:var(--muted);font-size:0.85rem">Not available (admin does not receive OTPs for security)</span>`;
      return `
        <div class="code-card">
          <div class="code-card-header">
            <span class="code-card-label">${esc(label)}</span>
            <span class="code-card-sublabel">${esc(sublabel)}</span>
          </div>
          <div class="code-digits-row">${digits}</div>
          <div class="code-card-hint">${hint}</div>
        </div>`;
    }

    return `
      <p class="detail-section-title">Meetup &amp; Entry Codes</p>
      <div class="codes-row">
        ${codeBox(
          'Meetup Code',
          `Held by ${fName} (Female)`,
          `<strong>${mName}</strong> enters this code at the meeting point to verify the meetup happened. Advances status to <em>Verified</em>.`,
          fOtp,
          !!fOtp
        )}
        ${codeBox(
          'Satisfaction / Entry Code',
          `Held by ${mName} (Male)`,
          `<strong>${fName}</strong> enters this code after the club entry to confirm completion. Advances status to <em>Completed</em> and releases payout.`,
          mOtp,
          !!mOtp
        )}
      </div>
      <p class="codes-note">⚠️ OTP values are hidden from admins by the server for security. The codes submitted during verification are visible in the Activity Timeline below.</p>
    `;
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  function render(req) {
    window._currentReq = req;
    const pay = req.payment;
    const mName = req.mUser ? (req.mUser.username || req.mUser.phone || 'Male User') : 'Male User';
    const fName = req.fUser ? (req.fUser.username || req.fUser.phone || 'Female User') : 'Female User';

    // refund banner
    const canRefund = pay && pay.paymentStatus === 'completed' && !pay.refundId;
    let refundInfo = '';
    if (pay && pay.refundId) {
      refundInfo = `
        <div class="refund-banner">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          Refund initiated
          ${pay.refundAmount ? ` &mdash; <strong>${fmtCurrency(pay.refundAmount)}</strong>` : ''}
          ${pay.refundId ? ` &nbsp;&middot;&nbsp; Refund ID: <strong>${esc(pay.refundId)}</strong>` : ''}
          ${pay.refundProcessedAt ? ` &nbsp;&middot;&nbsp; Processed at: <strong>${fmtDate(pay.refundProcessedAt)}</strong>` : ''}
        </div>`;
    }

    // cancellation info
    let cancelInfo = '';
    if (req.cancelledBy) {
      const cancelName = req.cancelledBy === (req.mUser && req.mUser.id)
        ? mName + ' (Male)'
        : req.cancelledBy === (req.fUser && req.fUser.id)
          ? fName + ' (Female)'
          : req.cancelledBy;
      cancelInfo = `
        <div class="cancel-banner">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          Cancelled by <strong>${esc(cancelName)}</strong>
          ${req.cancelledAt && req.cancelledAt !== '0001-01-01T00:00:00Z' ? ` on ${fmtDate(req.cancelledAt)}` : ''}
        </div>`;
    }

    content.innerHTML = `
      <!-- Hero: status + club -->
      <div class="detail-hero" style="align-items:flex-start;gap:18px">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px">
            <div class="detail-hero-name" style="font-size:1.25rem">${esc(req.clubName) || '—'}</div>
            ${badge(req.status, reqStatusMap)}
            ${canRefund ? `<button id="refundBtn" onclick="openRefundModal()" style="margin-left:auto;background:#e74c3c;color:#fff;border:none;border-radius:8px;padding:7px 16px;font-size:0.82rem;cursor:pointer;font-family:inherit">Initiate Refund</button>` : ''}
          </div>
          <div style="color:var(--muted);font-size:0.85rem">${esc(req.clubAddress) || '—'}</div>
          <div style="color:var(--muted-mid);font-size:0.78rem;margin-top:6px">
            Scheduled: <strong style="color:var(--white)">${fmtDate(req.datetime)}</strong>
            ${req.timezone ? `<span style="margin-left:8px">(${esc(req.timezone)})</span>` : ''}
          </div>
        </div>
      </div>

      ${cancelInfo}
      ${refundInfo}

      <!-- Participants -->
      <p class="detail-section-title">Participants</p>
      <div class="req-users-row">
        ${userCard(req.mUser, 'Male User (Creator)')}
        <div class="req-users-divider">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </div>
        ${userCard(req.fUser, 'Female User')}
      </div>

      <!-- Codes -->
      ${buildCodesSection(req)}

      <!-- Request info + Payment side by side -->
      <div class="req-info-row">
        <div class="req-info-col">
          <p class="detail-section-title" style="margin-top:0">Request Details</p>
          <div class="detail-grid req-info-grid">
            ${field('Status',       badge(req.status, reqStatusMap))}
            ${field('Scheduled At', fmtDate(req.datetime))}
            ${field('Timezone',     esc(req.timezone) || '—')}
            ${field('Club',         esc(req.clubName) || '—')}
            ${field('Address',      esc(req.clubAddress) || '—')}
            ${field('Created At',   fmtDate(req.createdAt))}
            ${field('Updated At',   fmtDate(req.updatedAt))}
            ${req.chatId ? field('Chat', `<a href="#" style="color:var(--red);font-size:0.8rem;font-family:monospace">${esc(req.chatId)}</a>`) : ''}
            ${field('Request ID', `<span style="font-family:monospace;font-size:0.76rem;color:var(--muted)">${esc(req.id)}</span>`)}
          </div>
        </div>
        ${pay ? `
        <div class="req-info-col">
          <p class="detail-section-title" style="margin-top:0">Payment Breakdown</p>
          <div class="detail-grid req-info-grid">
            ${field('Entry Fee (Base)',        fmtCurrency(pay.fUserBaseAmount))}
            ${field(`${mName} — Platform Fee`, fmtCurrency(pay.mUserPlatformFee))}
            ${field(`${mName} — GST`,          fmtCurrency(pay.mUserGST))}
            ${field(`${mName} — Total Paid`,   `<strong>${fmtCurrency(pay.mUserTotalPayable)}</strong>`)}
            ${field(`${fName} — Platform Fee`, fmtCurrency(pay.fUserPlatformFee))}
            ${field(`${fName} — GST`,          fmtCurrency(pay.fUserGST))}
            ${field(`${fName} — Net Payout`,   `<strong>${fmtCurrency(pay.fUserNetPayout)}</strong>`)}
            ${pay.paymentStatus ? field('Payment Status', `<span style="text-transform:capitalize">${esc(pay.paymentStatus)}</span>`) : ''}
            ${pay.payoutStatus  ? field('Payout Status',  `<span style="text-transform:capitalize">${esc(pay.payoutStatus)}</span>`)  : ''}
            ${pay.refundStatus      ? field('Refund Status',       `<span style="text-transform:capitalize">${esc(pay.refundStatus)}</span>`)  : ''}
            ${pay.refundAmount      ? field('Refund Amount',       fmtCurrency(pay.refundAmount)) : ''}
            ${pay.refundId         ? field('Refund ID',          `<span style="font-family:monospace;font-size:0.76rem;color:var(--muted)">${esc(pay.refundId)}</span>`) : ''}
            ${pay.refundProcessedAt ? field('Refund Processed At', fmtDate(pay.refundProcessedAt)) : ''}
          </div>
        </div>
        ` : ''}
      </div>
    `;
  }

  // ── Load ──────────────────────────────────────────────────────────────────────
  async function load() {
    const { ok, data } = await apiAbs(API_BASE + '/v1/request/' + encodeURIComponent(requestId));
    if (!ok || !data || !data.id) {
      content.innerHTML = '<div class="detail-error">Request not found.</div>';
      return;
    }
    console.log('[STAG Admin] Request detail page loaded for id:', requestId);
    render(data);

    // Wire photo lightbox
    const lightbox    = document.getElementById('photoLightbox');
    const lightboxImg = document.getElementById('lightboxImg');
    const lightboxClose = document.getElementById('lightboxClose');
    if (lightbox && lightboxImg && lightboxClose) {
      document.querySelectorAll('.ucell-avatar img').forEach(img => {
        img.style.cursor = 'zoom-in';
        img.addEventListener('click', () => {
          lightboxImg.src = img.src;
          lightbox.classList.add('open');
        });
      });
      lightboxClose.addEventListener('click', () => lightbox.classList.remove('open'));
      lightbox.addEventListener('click', e => { if (e.target === lightbox) lightbox.classList.remove('open'); });
    }

    // Fetch activity timeline (best-effort — degrade silently)
    let actData = null;
    try {
      const { ok: aOk, data: aData } = await apiAbs(
        API_BASE + '/v1/request/' + encodeURIComponent(requestId) + '/activity'
      );
      if (aOk && aData) actData = aData;
    } catch (_) { /* silently degrade */ }

    content.appendChild(buildActivitySection(actData, data));
  }

  // ── Refund modal ─────────────────────────────────────────────────────────────
  function openRefundModal() {
    const pay = window._currentReq && window._currentReq.payment;
    const defaultAmount = pay ? (pay.mUserTotalPayable || pay.baseAmount || '') : '';
    const clubName = window._currentReq ? window._currentReq.clubName : '';
    document.getElementById('refundModalDesc').textContent =
      `Issue a refund for request at "${clubName}".`;
    document.getElementById('refundAmount').value = defaultAmount || '';
    document.getElementById('refundReason').value = '';
    const modal = document.getElementById('refundModal');
    modal.style.display = 'flex';
  }

  function closeRefundModal() {
    document.getElementById('refundModal').style.display = 'none';
  }

  document.getElementById('refundCancelBtn').addEventListener('click', closeRefundModal);
  document.getElementById('refundModal').addEventListener('click', e => {
    if (e.target === document.getElementById('refundModal')) closeRefundModal();
  });

  document.getElementById('refundConfirmBtn').addEventListener('click', async () => {
    const amount = parseFloat(document.getElementById('refundAmount').value);
    const reason = document.getElementById('refundReason').value.trim() || 'Admin-initiated refund';
    if (!amount || amount <= 0) { toast('Enter a valid refund amount'); return; }

    const confirmBtn = document.getElementById('refundConfirmBtn');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Processing…';

    const { ok, data } = await apiAbs(
      API_BASE + '/v1/payment/requests/' + encodeURIComponent(requestId) + '/refund',
      { method: 'POST', body: JSON.stringify({ amount, reason, overrideAction: true }) }
    );

    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Confirm Refund';

    if (ok && data && data.processed) {
      closeRefundModal();
      toast('Refund initiated successfully — Refund ID: ' + (data.refundId || ''));
      // Reload the request to show updated refund details
      load();
    } else {
      toast((data && data.message) || (data && data.reason) || 'Refund failed. Please try again.');
    }
  });

  // expose openRefundModal to inline onclick
  window.openRefundModal = openRefundModal;

  load();
})();
