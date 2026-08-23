/**
 * STAG Admin — Dashboard logic
 */
(function () {
  'use strict';

  // ── Migrate old sessionStorage token → localStorage (for users logged in before the fix) ──
  (function migrateToken() {
    const old = sessionStorage.getItem(TOKEN_KEY);
    if (old && !localStorage.getItem(TOKEN_KEY)) {
      localStorage.setItem(TOKEN_KEY, old);
      const oldInfo = sessionStorage.getItem(ADMIN_INFO_KEY);
      if (oldInfo) localStorage.setItem(ADMIN_INFO_KEY, oldInfo);
    }
  })();

  // ── Auth guard ──────────────────────────────────────────────────────────────
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    window.location.href = 'index.html';
    return;
  }

  const adminInfo = JSON.parse(localStorage.getItem(ADMIN_INFO_KEY) || '{}');
  const roleLabel = (adminInfo.role || 'admin');
  const nameLabel = adminInfo.username || adminInfo.email || 'Admin';
  const avatarChar = nameLabel.charAt(0).toUpperCase();

  // Populate sidebar profile
  const profileAvatar = document.getElementById('profileAvatar');
  const profileName   = document.getElementById('profileName');
  const profileRole   = document.getElementById('profileRole');
  if (profileAvatar) profileAvatar.textContent = avatarChar;
  if (profileName)   profileName.textContent   = nameLabel;
  if (profileRole)   profileRole.textContent   = roleLabel;

  // Populate header
  const headerAvatar    = document.getElementById('headerAvatar');
  const headerAdminName = document.getElementById('headerAdminName');
  const adminBadge      = document.getElementById('adminBadge');
  if (headerAvatar)    headerAvatar.textContent    = avatarChar;
  if (headerAdminName) headerAdminName.textContent = nameLabel;
  if (adminBadge)      adminBadge.textContent      = roleLabel;

  // ── Fetch helpers ───────────────────────────────────────────────────────────
  // apiAbs fetches an absolute URL with auth + shared 401 handling.
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
      return null;
    }
    return res.json();
  }

  // api targets the admin-dash endpoints (stats/requests/reports/support).
  function api(path, opts = {}) {
    return apiAbs(DASH_ENDPOINT + path, opts);
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
  function badge(val, map) {
    if (!val) return '<span class="badge badge-inactive">—</span>';
    const cls = map[val] || 'badge-inactive';
    return `<span class="badge ${cls}">${val}</span>`;
  }

  const statusMap = {
    active: 'badge-active', blocked: 'badge-blocked', inactive: 'badge-inactive',
    premium: 'badge-premium', banned: 'badge-banned', basic: 'badge-basic', deleted: 'badge-deleted',
  };
  const reqStatusMap = {
    pending: 'badge-pending', accepted: 'badge-accepted', confirmed: 'badge-confirmed',
    completed: 'badge-completed', cancelled: 'badge-cancelled', rejected: 'badge-rejected',
    expired: 'badge-expired', blocked: 'badge-blocked',
    confirm_intended: 'badge-pending', payment_initiated: 'badge-pending',
    verified: 'badge-accepted',
  };
  const genderMap = { male: 'badge-male', female: 'badge-female' };
  const ticketStatusMap = { open: 'badge-open', closed: 'badge-closed' };

  function fmtDate(str) {
    if (!str) return '—';
    const d = new Date(str);
    return isNaN(d) ? str : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function fmtDateTime(str) {
    if (!str) return '—';
    const d = new Date(str);
    if (isNaN(d)) return str;
    const date = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    return date + ', ' + time;
  }

  function fmtCurrency(n) {
    if (n == null) return '—';
    return '₹' + Number(n).toFixed(2);
  }

  function shortId(id) {
    if (!id) return '—';
    return id.length > 12 ? id.slice(0, 8) + '…' : id;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Builds the avatar markup: real profile pic if present, otherwise an
  // initial-letter fallback (the initial is rendered via CSS ::before and
  // shown if the image is missing or fails to load).
  function avatarHtml(u, size) {
    const initial = ((u.name || '?').trim().charAt(0) || '?').toUpperCase();
    const cls = 'ucell-avatar' + (size === 'lg' ? ' ucell-avatar-lg' : '');
    const img = u.profilePicUrl
      ? `<img src="${esc(u.profilePicUrl)}" alt="" onerror="this.style.display='none'">`
      : '';
    return `<span class="${cls}" data-initial="${esc(initial)}">${img}</span>`;
  }

  // ── Pagination renderer ──────────────────────────────────────────────────────
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

  // ── Navigation ───────────────────────────────────────────────────────────────
  const sections = ['overview', 'users', 'requests', 'rewards', 'reports', 'support', 'events', 'salesLeads', 'salesLeadDetail', 'cockpit'];
  const sectionTitles = {
    overview: 'Overview', users: 'Users', requests: 'Club Requests', rewards: 'Rewards',
    reports: 'Reports', support: 'Support Tickets', events: 'Events Management', salesLeads: 'Sales Leads', salesLeadDetail: 'Sales Lead Details', cockpit: 'Cockpit',
  };

  const navHashes = ['overview', 'users', 'requests', 'rewards', 'events', 'salesLeads', 'reports', 'support', 'cockpit'];

  function activateSection(name, skipHash) {
    console.log('[STAG Admin] Navigating to section:', name, '—', sectionTitles[name] || name);
    sections.forEach(s => {
      document.getElementById('section-' + s).classList.toggle('hidden', s !== name);
    });
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.section === name);
    });
    document.getElementById('pageTitle').textContent = sectionTitles[name];

    if (name === 'overview')  loadStats();
    if (name === 'users')     loadUsers(1);
    if (name === 'requests')  loadRequests(1);
    if (name === 'rewards') loadRewardSettings();
    if (name === 'reports')   loadReports(1);
    if (name === 'support')   loadSupport(1);
    if (name === 'events')    loadEvents();
    if (name === 'salesLeads') loadSalesLeads(1);
    if (name === 'cockpit')   loadCockpit();

    document.getElementById('sidebar').classList.remove('open');
    if (!skipHash && navHashes.includes(name) && location.hash !== '#' + name) {
      history.pushState({ section: name }, '', '#' + name);
    }
  }

  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', e => {
      if (!el.dataset.section) return;
      e.preventDefault();
      activateSection(el.dataset.section);
    });
  });

  window.addEventListener('popstate', () => {
    const raw = location.hash.replace('#', '');
    activateSection(navHashes.includes(raw) ? raw : 'overview', true);
  });

  document.querySelectorAll('.reward-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const selectedTab = tab.dataset.rewardTab;
      document.querySelectorAll('.reward-tab').forEach(item => {
        const isSelected = item === tab;
        item.classList.toggle('active', isSelected);
        item.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      });
      document.querySelectorAll('.reward-tab-panel').forEach(panel => {
        const isSelected = panel.id === 'reward-panel-' + selectedTab;
        panel.classList.toggle('active', isSelected);
        panel.hidden = !isSelected;
      });
      if (selectedTab === 'users') loadRewards(1);
    });
  });

  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.clear();
    window.location.href = 'index.html';
  });

  document.getElementById('sidebarToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('visible');
  });
  document.getElementById('sidebarOverlay').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('visible');
  });

  // ── Overview / Stats ─────────────────────────────────────────────────────────
  async function loadStats() {
    const json = await api('/stats');
    if (!json || !json.success) return;
    const d = json.data;
    const map = {
      totalUsers: d.totalUsers, activeUsers: d.activeUsers, blockedUsers: d.blockedUsers,
      totalRequests: d.totalRequests, pendingRequests: d.pendingRequests,
      completedRequests: d.completedRequests, totalReports: d.totalReports, openTickets: d.openTickets,
    };
    Object.entries(map).forEach(([k, v]) => {
      const el = document.getElementById('v-' + k);
      if (el) { el.textContent = v != null ? v.toLocaleString() : '—'; }
      const card = document.getElementById('stat-' + k);
      if (card) card.classList.remove('loading');
    });
  }

  // ── Rewards ─────────────────────────────────────────────────────────────────
  let rewardPage = 1;
  let rewardSettingsLoaded = false;

  function setRewardField(id, value) {
    const el = document.getElementById(id);
    if (el && value != null) el.value = value;
  }

  async function loadRewardSettings() {
    if (rewardSettingsLoaded) return;
    const settings = await apiAbs(API_BASE + '/v1/admin/settings');
    if (!settings) { toast('Failed to load reward settings'); return; }
    setRewardField('reward-pointsPerClubVisit', settings.rewardPointsPerClubVisit || 10);
    setRewardField('reward-referralPoints', settings.referralRewardPoints || 25);
    setRewardField('reward-referralSignupPoints', settings.referralSignupRewardPoints || 10);
    setRewardField('reward-level1Name', settings.rewardLevel1Name || 'Excellent');
    setRewardField('reward-level2Name', settings.rewardLevel2Name || 'Pro');
    setRewardField('reward-level3Name', settings.rewardLevel3Name || 'Legend');
    setRewardField('reward-level4Name', settings.rewardLevel4Name || 'GOAT');
    setRewardField('reward-level1MinPoints', settings.rewardLevel1MinPoints || 0);
    setRewardField('reward-level2MinPoints', settings.rewardLevel2MinPoints || 100);
    setRewardField('reward-level3MinPoints', settings.rewardLevel3MinPoints || 250);
    setRewardField('reward-level4MinPoints', settings.rewardLevel4MinPoints || 500);
    rewardSettingsLoaded = true;
  }

  async function saveRewardSettings() {
    const value = id => document.getElementById(id)?.value;
    const payload = {
      rewardPointsPerClubVisit: Number(value('reward-pointsPerClubVisit')),
      referralRewardPoints: Number(value('reward-referralPoints')),
      referralSignupRewardPoints: Number(value('reward-referralSignupPoints')),
      rewardLevel1Name: value('reward-level1Name'), rewardLevel2Name: value('reward-level2Name'),
      rewardLevel3Name: value('reward-level3Name'), rewardLevel4Name: value('reward-level4Name'),
      rewardLevel1MinPoints: Number(value('reward-level1MinPoints')), rewardLevel2MinPoints: Number(value('reward-level2MinPoints')),
      rewardLevel3MinPoints: Number(value('reward-level3MinPoints')), rewardLevel4MinPoints: Number(value('reward-level4MinPoints')),
    };
    if (Object.values(payload).some(v => v === '' || v == null || (typeof v === 'number' && (!Number.isFinite(v) || v < 0)))) {
      toast('Enter valid reward settings');
      return;
    }
    const result = await apiAbs(API_BASE + '/v1/admin-dash/rewards/settings', { method: 'PATCH', body: JSON.stringify(payload) });
    if (!result) { toast('Failed to save reward settings'); return; }
    rewardSettingsLoaded = false;
    toast('Reward settings saved successfully');
  }

  function rewardHistoryHtml(history) {
    if (!history || history.length === 0) return '<span style="color:var(--muted)">No activity</span>';
    return `<details><summary class="reward-history-toggle">${history.length} transaction${history.length === 1 ? '' : 's'}</summary><ul class="reward-history-list">${history.map(entry => {
      const points = Number(entry.points || 0);
      return `<li><span><strong>${esc(entry.description || entry.type || 'Reward')}</strong><br/>${fmtDateTime(entry.createdAt)}</span><span class="reward-points ${points < 0 ? 'reward-negative' : ''}">${points > 0 ? '+' : ''}${points}</span></li>`;
    }).join('')}</ul></details>`;
  }

  async function loadRewards(page) {
    rewardPage = page;
    const json = await apiAbs(API_BASE + '/v1/admin-dash/rewards?page=' + page + '&limit=20');
    if (!json || !Array.isArray(json.items)) { toast('Failed to load rewards'); return; }
    const tbody = document.getElementById('rewardsBody');
    const empty = document.getElementById('rewardsEmpty');
    if (json.items.length === 0) {
      tbody.innerHTML = '';
      empty.classList.remove('hidden');
      document.getElementById('rewardsPagination').innerHTML = '';
      return;
    }
    empty.classList.add('hidden');
    tbody.innerHTML = json.items.map(user => {
      const history = user.history || [];
      const latest = history[0];
      return `<tr class="reward-user-row" tabindex="0" role="link" data-reward-user-id="${esc(user.id)}" aria-label="View reward details for ${esc(user.name || 'user')}"><td>${esc(user.name || '—')}</td><td>${esc(user.email || '—')}</td><td><strong>${Number(user.rewardPoints || 0).toLocaleString()}</strong></td><td>${rewardHistoryHtml(history)}</td><td style="color:var(--muted)">${latest ? fmtDateTime(latest.createdAt) : '—'}</td></tr>`;
    }).join('');
    tbody.querySelectorAll('.reward-user-row').forEach(row => {
      const openDetails = () => { window.location.href = 'reward-detail.html?id=' + encodeURIComponent(row.dataset.rewardUserId); };
      row.addEventListener('click', openDetails);
      row.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openDetails(); }
      });
    });
    const totalPages = Math.max(1, Math.ceil((json.total || 0) / (json.limit || 20)));
    renderPagination('rewardsPagination', page, totalPages, loadRewards);
  }

  document.getElementById('rewardSaveBtn').addEventListener('click', saveRewardSettings);

  // ── Users ─────────────────────────────────────────────────────────────────────
  let userPage = 1;

  async function loadUsers(p) {
    userPage = p;
    const search = document.getElementById('userSearch').value.trim();
    const status = document.getElementById('userStatusFilter').value;
    const gender = document.getElementById('userGenderFilter').value;

    const params = new URLSearchParams({ page: p, limit: 20 });
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    if (gender) params.set('gender', gender);

    // Uses the existing admin user API: GET /v1/users (returns Paged{total,page,limit,items}).
    const json = await apiAbs(API_BASE + '/v1/users?' + params);
    if (!json || !Array.isArray(json.items)) { toast('Failed to load users'); return; }

    const items = json.items;
    const total = json.total || 0;
    const totalPages = Math.max(1, Math.ceil(total / (json.limit || 20)));
    const tbody = document.getElementById('usersBody');
    const empty = document.getElementById('usersEmpty');

    if (!items || items.length === 0) {
      tbody.innerHTML = '';
      empty.classList.remove('hidden');
      document.getElementById('usersPagination').innerHTML = '';
      return;
    }
    empty.classList.add('hidden');

    tbody.innerHTML = items.map(u => `
      <tr>
        <td>
          <div class="ucell">
            ${avatarHtml(u)}
            <div class="ucell-meta">
              <a class="user-name-link" href="user.html?id=${encodeURIComponent(u.id)}">${esc(u.name) || '—'}</a>
              <span class="ucell-email">${esc(u.email) || '—'}</span>
            </div>
          </div>
        </td>
        <td>${esc((u.phoneExt || '') + (u.phone || '')) || '—'}</td>
        <td>${badge(u.gender, genderMap)}</td>
        <td>${badge(u.status, statusMap)}</td>
        <td style="color:var(--muted)">${fmtDate(u.createdAt)}</td>
        <td>
          <a class="btn-ghost" href="user.html?id=${encodeURIComponent(u.id)}">View</a>
        </td>
      </tr>
    `).join('');

    renderPagination('usersPagination', p, totalPages, loadUsers);
  }

  document.getElementById('userSearchBtn').addEventListener('click', () => loadUsers(1));
  document.getElementById('userSearch').addEventListener('keydown', e => { if (e.key === 'Enter') loadUsers(1); });
  document.getElementById('userStatusFilter').addEventListener('change', () => loadUsers(1));
  document.getElementById('userGenderFilter').addEventListener('change', () => loadUsers(1));

  // Live search: debounce so we don't hammer the API on every keystroke.
  let _userSearchTimer;
  document.getElementById('userSearch').addEventListener('input', e => {
    clearTimeout(_userSearchTimer);
    // Immediate reset when field is cleared; short debounce while typing.
    const delay = e.target.value.trim() === '' ? 0 : 300;
    _userSearchTimer = setTimeout(() => loadUsers(1), delay);
  });

  // ── User detail modal ────────────────────────────────────────────────────────
  window.viewUser = async function (id) {
    const json = await api('/users/' + id);
    if (!json || !json.success) { toast('Failed to load user'); return; }
    const u = json.data;

    document.getElementById('modalBody').innerHTML = `
      <div class="modal-field"><span class="mf-label">Name</span><span class="mf-value">${u.name || '—'}</span></div>
      <div class="modal-field"><span class="mf-label">Phone</span><span class="mf-value">${u.phoneExt || ''}${u.phone || '—'}</span></div>
      <div class="modal-field"><span class="mf-label">Email</span><span class="mf-value">${u.email || '—'}</span></div>
      <div class="modal-field"><span class="mf-label">Gender</span><span class="mf-value">${badge(u.gender, genderMap)}</span></div>
      <div class="modal-field"><span class="mf-label">Status</span><span class="mf-value">${badge(u.status, statusMap)}</span></div>
      <div class="modal-field"><span class="mf-label">Rating</span><span class="mf-value">${u.ratings != null ? u.ratings.toFixed(1) + ' ('+u.ratingCount+')' : '—'}</span></div>
      <div class="modal-field"><span class="mf-label">Charge</span><span class="mf-value">${u.chargeAmount ? fmtCurrency(u.chargeAmount) : '—'}</span></div>
      <div class="modal-field"><span class="mf-label">Joined</span><span class="mf-value">${fmtDate(u.createdAt)}</span></div>
      <div class="modal-field"><span class="mf-label">Referral</span><span class="mf-value">${u.referralCode || '—'}</span></div>
      <div class="modal-field"><span class="mf-label">ID</span><span class="mf-value" style="font-size:0.73rem">${u.id || '—'}</span></div>
    `;

    const isBlocked = u.status === 'blocked';
    document.getElementById('modalActions').innerHTML = `
      ${isBlocked
        ? `<button class="btn-success" onclick="setUserStatus('${u.id}', 'active')">Unblock User</button>`
        : `<button class="btn-danger"  onclick="setUserStatus('${u.id}', 'blocked')">Block User</button>`
      }
    `;

    document.getElementById('userModal').classList.remove('hidden');
  };

  window.setUserStatus = async function (id, status) {
    const json = await api('/users/' + id + '/status', {
      method: 'POST',
      body:   JSON.stringify({ status }),
    });
    if (!json || !json.success) { toast('Failed to update status'); return; }
    toast('User status updated to: ' + status);
    closeModal();
    loadUsers(userPage);
  };

  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('userModal').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
  });

  function closeModal() {
    document.getElementById('userModal').classList.add('hidden');
  }

  // ── Requests ─────────────────────────────────────────────────────────────────
  let reqPage = 1;

  // The app endpoint GET /v1/request/user/{userId} requires a valid UUID in the
  async function loadRequests(p) {
    reqPage = p;
    const status = document.getElementById('reqStatusFilter').value;
    const timeline = document.getElementById('reqTimelineFilter').value;
    const params = new URLSearchParams({ page: p, limit: 20 });
    if (status) params.set('status', status);
    if (timeline) params.set('timeline', timeline);

    const json = await apiAbs(API_BASE + '/v1/request?' + params);
    if (!json || !Array.isArray(json.items)) { toast('Failed to load requests'); return; }

    const items = json.items;
    const total = json.total || 0;
    const limit = json.limit || 20;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const tbody = document.getElementById('requestsBody');
    const empty = document.getElementById('requestsEmpty');

    if (!items || items.length === 0) {
      tbody.innerHTML = '';
      empty.classList.remove('hidden');
      document.getElementById('requestsPagination').innerHTML = '';
      return;
    }
    empty.classList.add('hidden');

    tbody.innerHTML = items.map(req => `
      <tr class="clickable-row" onclick="window.location='request.html?id=${encodeURIComponent(req.id)}'" style="cursor:pointer">
        <td style="font-size:0.73rem;color:var(--muted);font-family:monospace">${req.id || '—'}</td>
        <td><strong>${req.clubName || '—'}</strong><br/><span style="font-size:0.75rem;color:var(--muted)">${req.clubAddress || ''}</span></td>
        <td style="font-size:0.78rem">${req.mUser ? (req.mUser.username || req.mUserId) : (req.mUserId || '—')}</td>
        <td style="font-size:0.78rem">${req.fUser ? (req.fUser.username || req.fUserId) : (req.fUserId || '—')}</td>
        <td>${badge(req.status, reqStatusMap)}</td>
        <td style="color:var(--muted)">${fmtDate(req.datetime)}</td>
        <td>${req.payment ? fmtCurrency(req.payment.mUserTotalPayable) : '—'}</td>
      </tr>
    `).join('');

    renderPagination('requestsPagination', p, totalPages, loadRequests);
  }

  document.getElementById('reqSearchBtn').addEventListener('click', () => loadRequests(1));
  document.getElementById('reqStatusFilter').addEventListener('change', () => loadRequests(1));
  document.getElementById('reqTimelineFilter').addEventListener('change', () => loadRequests(1));

  // ── Reports ──────────────────────────────────────────────────────────────────
  let reportPage = 1;
  let reportStatusFilter = '';
  let _reportsCache = {};

  const rptStatusMap = {
    pending:  'badge-rpt-pending',
    resolved: 'badge-rpt-resolved',
    closed:   'badge-rpt-closed',
  };

  // Quick-filter chips
  document.querySelectorAll('.rpt-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.rpt-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      reportStatusFilter = chip.dataset.status;
      loadReports(1);
    });
  });

  document.getElementById('rptFilterBtn').addEventListener('click', () => loadReports(1));
  document.getElementById('rptTypeFilter').addEventListener('change', () => loadReports(1));

  async function loadReports(p) {
    reportPage = p;
    const type = document.getElementById('rptTypeFilter').value;
    const params = new URLSearchParams({ page: p, limit: 20 });
    if (reportStatusFilter) params.set('status', reportStatusFilter);
    if (type) params.set('requestType', type);

    const json = await apiAbs(API_BASE + '/v1/request-report?' + params);
    const tbody = document.getElementById('reportsBody');
    const empty = document.getElementById('reportsEmpty');

    if (!json || !Array.isArray(json.reports)) {
      toast('Failed to load reports');
      return;
    }

    const items = json.reports;
    const totalPages = json.totalPages || 1;

    if (items.length === 0) {
      tbody.innerHTML = '';
      empty.classList.remove('hidden');
      document.getElementById('reportsPagination').innerHTML = '';
      return;
    }
    empty.classList.add('hidden');

    // Cache reports by ID so the panel can access them without re-fetching
    _reportsCache = {};
    items.forEach(r => { _reportsCache[r.id] = r; });

    tbody.innerHTML = items.map(r => {
      const count = Array.isArray(r.userReports) ? r.userReports.length : 0;
      // Latest reporter name + date
      const latest = count > 0 ? r.userReports[count - 1] : null;
      const latestName = latest ? esc(latest.userName || 'Unknown') : '—';
      const latestDate = latest ? fmtDateTime(latest.reportedAt) : fmtDateTime(r.createdAt);
      // All reporter names for tooltip when multiple
      const allNames = count > 1
        ? r.userReports.map((ur, i) => `#${i+1} ${esc(ur.userName || 'User')}`).join(' · ')
        : '';
      // Truncated reason
      const latestReason = latest ? latest.reason : '—';
      const typeBadgeCls = r.requestType === 'event' ? 'badge-premium' : 'badge-basic';
      return `
        <tr>
          <td>
            <div style="display:flex;flex-direction:column;gap:2px">
              <span style="font-weight:600;color:var(--white)">${latestName}</span>
              ${count > 1 ? `<span style="font-size:0.71rem;color:var(--muted)" title="${allNames}">+${count - 1} more reporter${count > 2 ? 's' : ''}</span>` : ''}
            </div>
          </td>
          <td class="rpt-reason-cell" title="${esc(latestReason)}">${esc(latestReason)}</td>
          <td><span class="badge ${typeBadgeCls}">${esc(r.requestType || 'club')}</span></td>
          <td><span class="badge badge-blocked">${count}</span></td>
          <td>${badge(r.status, rptStatusMap)}</td>
          <td style="color:var(--muted)">${latestDate}</td>
          <td><button class="btn-ghost" onclick="openReportPanel('${esc(r.id)}')">Review</button></td>
        </tr>
      `;
    }).join('');

    renderPagination('reportsPagination', p, totalPages, loadReports);
  }

  // ── Report detail panel ───────────────────────────────────────────────────────
  const rptPanelOverlay = document.getElementById('rptPanelOverlay');
  const rptPanelBody    = document.getElementById('rptPanelBody');

  function closeReportPanel() {
    rptPanelOverlay.classList.add('hidden');
    rptPanelBody.innerHTML = '<div class="rpt-loading">Loading\u2026</div>';
  }
  document.getElementById('rptPanelClose').addEventListener('click', closeReportPanel);
  rptPanelOverlay.addEventListener('click', e => { if (e.target === rptPanelOverlay) closeReportPanel(); });

  function buildPanelBody(report, req) {
    const count    = Array.isArray(report.userReports) ? report.userReports.length : 0;
    const hasNotes = Array.isArray(report.adminNotes) && report.adminNotes.length > 0;

    // ── Request info ──────────────────────────────────────────────────────────
    const reqBlock = req ? `
      <div class="rpt-block">
        <div class="rpt-block-title">Request Details</div>
        <div class="rpt-info-grid">
          <div class="rpt-info-item">
            <span class="rpt-info-label">Club / Venue</span>
            <span class="rpt-info-value">${esc(req.clubName || '\u2014')}</span>
          </div>
          <div class="rpt-info-item">
            <span class="rpt-info-label">Scheduled</span>
            <span class="rpt-info-value">${fmtDate(req.datetime)}</span>
          </div>
          <div class="rpt-info-item">
            <span class="rpt-info-label">Male User</span>
            <span class="rpt-info-value">${esc((req.mUser && (req.mUser.username || req.mUser.phone)) || req.mUserId || '\u2014')}</span>
          </div>
          <div class="rpt-info-item">
            <span class="rpt-info-label">Female User</span>
            <span class="rpt-info-value">${esc((req.fUser && (req.fUser.username || req.fUser.phone)) || req.fUserId || '\u2014')}</span>
          </div>
          <div class="rpt-info-item">
            <span class="rpt-info-label">Request Status</span>
            <span class="rpt-info-value">${badge(req.status, reqStatusMap)}</span>
          </div>
          <div class="rpt-info-item">
            <span class="rpt-info-label">Address</span>
            <span class="rpt-info-value" style="font-size:0.78rem">${esc(req.clubAddress || '\u2014')}</span>
          </div>
        </div>
        <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
          <a class="btn-ghost" href="request.html?id=${esc(report.requestId)}" target="_blank" style="font-size:0.78rem">
            Open full request \u2197
          </a>
        </div>
      </div>
    ` : `
      <div class="rpt-block">
        <div class="rpt-block-title">Request</div>
        <div class="rpt-info-grid">
          <div class="rpt-info-item">
            <span class="rpt-info-label">Request ID</span>
            <span class="rpt-info-value" style="font-size:0.78rem;font-family:monospace">${esc(report.requestId)}</span>
          </div>
          <div class="rpt-info-item">
            <span class="rpt-info-label">Type</span>
            <span class="rpt-info-value">${esc(report.requestType || '\u2014')}</span>
          </div>
        </div>
        <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
          <a class="btn-ghost" href="request.html?id=${esc(report.requestId)}" target="_blank" style="font-size:0.78rem">
            Open full request \u2197
          </a>
        </div>
      </div>
    `;

    // ── Reporters ─────────────────────────────────────────────────────────────
    const reportersHtml = count === 0
      ? '<p style="color:var(--muted);font-size:0.84rem">No reporters recorded.</p>'
      : report.userReports.map((ur, idx) => `
          <div class="reporter-card">
            <div class="reporter-card-header">
              <span class="reporter-name">#${idx + 1} &nbsp; ${esc(ur.userName || 'Unknown User')}</span>
              <span class="reporter-date">${fmtDateTime(ur.reportedAt)}</span>
            </div>
            <p class="reporter-reason">${esc(ur.reason)}</p>
          </div>
        `).join('');

    const reportersBlock = `
      <div class="rpt-block">
        <div class="rpt-block-title">Reported By (${count})</div>
        <div class="reporter-list">${reportersHtml}</div>
      </div>
    `;

    // ── Admin notes timeline ──────────────────────────────────────────────────
    const notesHtml = !hasNotes
      ? '<p style="color:var(--muted);font-size:0.84rem">No admin notes yet.</p>'
      : report.adminNotes.map(n => `
          <div class="admin-note-item">
            <div class="admin-note-dot"></div>
            <div class="admin-note-content">
              <div class="admin-note-meta">${fmtDateTime(n.createdAt)}</div>
              <div class="admin-note-text">${esc(n.note)}</div>
            </div>
          </div>
        `).join('');

    const notesBlock = `
      <div class="rpt-block">
        <div class="rpt-block-title">Admin Notes (${hasNotes ? report.adminNotes.length : 0})</div>
        <div class="admin-notes-list">${notesHtml}</div>
      </div>
    `;

    // ── Respond form ──────────────────────────────────────────────────────────
    const respondBlock = `
      <div class="rpt-block">
        <div class="rpt-block-title">Admin Response</div>
        <div class="rpt-respond-form">
          <select id="rptRespondStatus">
            <option value="pending"  ${report.status === 'pending'  ? 'selected' : ''}>Pending \u2014 Keep under review</option>
            <option value="resolved" ${report.status === 'resolved' ? 'selected' : ''}>Resolved \u2014 Issue addressed</option>
            <option value="closed"   ${report.status === 'closed'   ? 'selected' : ''}>Closed \u2014 No further action</option>
          </select>
          <textarea id="rptRespondNote" placeholder="Add a note describing the investigation outcome, action taken, or reason for status change\u2026"></textarea>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn-sm btn-primary" id="rptRespondBtn" style="flex:1;min-width:140px">
              <span id="rptRespondBtnText">Submit Response</span>
            </button>
          </div>
        </div>
      </div>
    `;

    // ── Meta footer ───────────────────────────────────────────────────────────
    const metaBlock = `
      <div style="padding:4px 2px;display:flex;gap:20px;flex-wrap:wrap">
        <span style="font-size:0.72rem;color:var(--muted)">Report ID: <code style="color:var(--muted-mid)">${esc(report.id)}</code></span>
        <span style="font-size:0.72rem;color:var(--muted)">First reported: ${fmtDateTime(report.createdAt)}</span>
        <span style="font-size:0.72rem;color:var(--muted)">Last updated: ${fmtDateTime(report.updatedAt)}</span>
        ${report.autoClosed ? '<span style="font-size:0.72rem;color:#888">\u26a0\ufe0f Auto-closed</span>' : ''}
      </div>
    `;

    return reqBlock + reportersBlock + notesBlock + respondBlock + metaBlock;
  }

  window.openReportPanel = async function(reportId) {
    const report = _reportsCache[reportId];
    if (!report) { toast('Report not found — try refreshing the list'); return; }

    // Show panel immediately with loading state
    rptPanelOverlay.classList.remove('hidden');
    document.getElementById('rptPanelTitleText').textContent = 'Report \u00b7 ' + shortId(report.id);
    document.getElementById('rptPanelBadge').innerHTML = badge(report.status, rptStatusMap);
    rptPanelBody.innerHTML = '<div class="rpt-loading">Fetching request details\u2026</div>';

    // Fetch linked request details (and get fresh report data with admin notes)
    let req = null;
    try {
      const reqJson = await apiAbs(API_BASE + '/v1/request/reports/request/' + report.requestId);
      if (reqJson && reqJson.request) req = reqJson.request;
      // Merge fresh report fields (adminNotes may have been updated)
      if (reqJson && reqJson.report) {
        _reportsCache[reportId] = { ...report, ...reqJson.report };
      }
    } catch (_) { /* silently degrade — we still show the report without request details */ }

    const freshReport = _reportsCache[reportId] || report;
    rptPanelBody.innerHTML = buildPanelBody(freshReport, req);

    // Wire respond button
    document.getElementById('rptRespondBtn').addEventListener('click', () => {
      submitReportResponse(freshReport.id);
    });
  };

  async function submitReportResponse(reportId) {
    const noteEl   = document.getElementById('rptRespondNote');
    const statusEl = document.getElementById('rptRespondStatus');
    const btn      = document.getElementById('rptRespondBtn');
    const btnText  = document.getElementById('rptRespondBtnText');

    const note   = (noteEl.value || '').trim();
    const status = statusEl.value;

    if (!note || note.length < 3) {
      toast('Please write a note (at least 3 characters) before submitting.');
      noteEl.focus();
      return;
    }

    btn.disabled = true;
    btnText.textContent = 'Submitting\u2026';

    const result = await apiAbs(API_BASE + '/v1/request-report/' + reportId + '/respond', {
      method: 'POST',
      body: JSON.stringify({ note, status }),
    });

    btn.disabled = false;
    btnText.textContent = 'Submit Response';

    if (!result || result.message) {
      toast('Error: ' + (result && result.message ? result.message : 'Failed to submit'));
      return;
    }

    toast('Response submitted successfully');
    // Update cache with the freshly-returned report
    if (result && result.id) {
      _reportsCache[reportId] = result;
    }
    // Re-render panel and refresh table
    openReportPanel(reportId);
    loadReports(reportPage);
  }

  // ── Support ──────────────────────────────────────────────────────────────────
  let supportPage = 1;

  async function loadSupport(p) {
    supportPage = p;
    const status = document.getElementById('supportStatusFilter').value;
    const params = new URLSearchParams({ page: p, limit: 20 });
    if (status) params.set('status', status);

    const json = await api('/support?' + params);
    if (!json || !json.success) { toast('Failed to load tickets'); return; }

    const { items, totalPages } = json.data;
    const tbody = document.getElementById('supportBody');
    const empty = document.getElementById('supportEmpty');

    if (!items || items.length === 0) {
      tbody.innerHTML = '';
      empty.classList.remove('hidden');
      document.getElementById('supportPagination').innerHTML = '';
      return;
    }
    empty.classList.add('hidden');

    tbody.innerHTML = items.map(t => `
      <tr>
        <td><strong>${t.title || '—'}</strong><br/><span style="font-size:0.75rem;color:var(--muted)">${t.description ? t.description.slice(0,60) + '…' : ''}</span></td>
        <td style="font-size:0.78rem;color:var(--muted)">${shortId(t.userId)}</td>
        <td>${badge(t.status, ticketStatusMap)}</td>
        <td style="color:var(--muted)">${fmtDate(t.createdAt)}</td>
      </tr>
    `).join('');

    renderPagination('supportPagination', p, totalPages, loadSupport);
  }

  document.getElementById('supportSearchBtn').addEventListener('click', () => loadSupport(1));
  document.getElementById('supportStatusFilter').addEventListener('change', () => loadSupport(1));

  // ── Sales Leads ─────────────────────────────────────────────────────────────
  let salesLeadsPage = 1;
  const salesLeadsCache = new Map();

  async function loadSalesLeads(p) {
    salesLeadsPage = p;
    const params = new URLSearchParams({ page: p, limit: 20 });
    const json = await apiAbs(API_BASE + '/v1/salesLeads?' + params);
    const tbody = document.getElementById('salesLeadsBody');
    const empty = document.getElementById('salesLeadsEmpty');
    if (!json || !Array.isArray(json.items)) { toast('Failed to load sales leads'); return; }

    if (json.items.length === 0) {
      tbody.innerHTML = '';
      empty.classList.remove('hidden');
      document.getElementById('salesLeadsPagination').innerHTML = '';
      return;
    }
    empty.classList.add('hidden');
    json.items.forEach(lead => salesLeadsCache.set(lead.id, lead));
    tbody.innerHTML = json.items.map(lead => `
      <tr class="sales-lead-row" data-lead-id="${esc(lead.id)}" tabindex="0" role="button">
        <td><strong>${esc(lead.name)}</strong></td>
        <td><a href="mailto:${esc(lead.email)}">${esc(lead.email)}</a></td>
        <td style="max-width:420px;white-space:pre-wrap;color:var(--muted)">${esc(lead.message)}</td>
        <td style="color:var(--muted);white-space:nowrap">${fmtDateTime(lead.createdAt)}</td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.sales-lead-row').forEach(row => {
      const open = () => openSalesLeadDetail(row.dataset.leadId);
      row.addEventListener('click', open);
      row.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open();
        }
      });
    });

    const totalPages = Math.max(1, Math.ceil((json.total || 0) / (json.limit || 20)));
    renderPagination('salesLeadsPagination', p, totalPages, loadSalesLeads);
  }

  document.getElementById('salesLeadsRefreshBtn').addEventListener('click', () => loadSalesLeads(salesLeadsPage));

  function openSalesLeadDetail(leadId) {
    const lead = salesLeadsCache.get(leadId);
    if (!lead) {
      toast('Sales lead details are unavailable. Refresh the list and try again.');
      return;
    }
    document.querySelectorAll('.section').forEach(section => section.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.getElementById('section-salesLeadDetail').classList.remove('hidden');
    document.getElementById('pageTitle').textContent = 'Sales Lead Details';
    document.getElementById('salesLeadDetailCard').innerHTML = `
      <div class="sales-lead-detail-topline">
        <div>
          <p class="sales-lead-detail-label">Contact</p>
          <h4>${esc(lead.name)}</h4>
        </div>
        <a class="btn-sm btn-primary" href="mailto:${esc(lead.email)}">Email Lead</a>
      </div>
      <div class="sales-lead-detail-grid">
        <div><span class="sales-lead-detail-label">Email</span><a href="mailto:${esc(lead.email)}">${esc(lead.email)}</a></div>
        <div><span class="sales-lead-detail-label">Submitted</span><span>${fmtDateTime(lead.createdAt)}</span></div>
        <div><span class="sales-lead-detail-label">Source</span><span>${esc(lead.source || 'Website contact form')}</span></div>
        <div><span class="sales-lead-detail-label">Lead ID</span><span>${esc(lead.id)}</span></div>
      </div>
      <div class="sales-lead-detail-message">
        <span class="sales-lead-detail-label">Enquiry</span>
        <p>${esc(lead.message)}</p>
      </div>
    `;
  }

  document.getElementById('salesLeadBackBtn').addEventListener('click', () => {
    document.getElementById('section-salesLeadDetail').classList.add('hidden');
    activateSection('salesLeads');
  });

  // ── Events ──────────────────────────────────────────────────────────────────
  let currentEventPage = 1;
  let allEvents = [];

  async function loadEvents(p = 1) {
    currentEventPage = p;
    const search = document.getElementById('eventSearch')?.value.trim() || '';
    const status = document.getElementById('eventStatusFilter')?.value || '';
    const category = document.getElementById('eventCategoryFilter')?.value || '';

    try {
      // Fetch all events from backend: GET /v1/event (returns paged{items, total, limit, offset})
      const params = new URLSearchParams({ page: p, limit: 20 });
      const json = await apiAbs(API_BASE + '/v1/event?' + params);
      if (!json) { toast('Failed to load events'); return; }

      const items = json.items || [];
      const total = json.total || 0;
      const totalPages = Math.max(1, Math.ceil(total / (json.limit || 20)));

      // Apply client-side filters
      let filtered = items;
      if (status) {
        filtered = filtered.filter(e => e.status === status);
      }
      if (category) {
        filtered = filtered.filter(e => e.category === category);
      }
      if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(e =>
          (e.name?.toLowerCase().includes(q) || false) ||
          (e.venue?.toLowerCase().includes(q) || false)
        );
      }

      allEvents = filtered;

      const tbody = document.getElementById('eventsBody');
      const empty = document.getElementById('eventsEmpty');

      if (!filtered || filtered.length === 0) {
        tbody.innerHTML = '';
        empty.classList.remove('hidden');
        document.getElementById('eventsPagination').innerHTML = '';
        return;
      }
      empty.classList.add('hidden');

      tbody.innerHTML = filtered.map(e => {
        const dateObj = new Date(e.date);
        const dateStr = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        const timeStr = e.startTime ? e.startTime.substring(0, 5) : '—';
        const statusBadge = e.status === 'posted'
          ? '<span class="badge badge-active">Posted</span>'
          : '<span class="badge badge-pending">Draft</span>';

        return `
          <tr>
            <td style="color:var(--red);cursor:pointer;text-decoration:underline;" onclick="window.location.href='event-detail.html?id=${esc(e.id)}'">${esc(e.name) || '—'}</td>
            <td>${statusBadge}</td>
            <td style="font-size:0.85rem;color:var(--muted)">${dateStr} ${timeStr}</td>
            <td style="color:var(--muted)">${esc(e.venue) || '—'}</td>
            <td><span class="badge badge-inactive">${esc(e.category) || '—'}</span></td>
            <td><span class="badge badge-inactive">${(e.entryType || 'free').charAt(0).toUpperCase() + (e.entryType || 'free').slice(1)}</span></td>
            <td style="text-align:right;color:var(--muted)">${e.capacity ? e.capacity + ' pax' : '—'}</td>
            <td style="text-align:right; gap:6px; display:flex; justify-content:flex-end;">
              <button class="btn-ghost btn-sm" onclick="editEventHandler('${esc(e.id)}')">Edit</button>
              <button class="btn-ghost btn-sm" onclick="togglePostEvent('${esc(e.id)}', '${e.status === 'posted' ? 'unpost' : 'post'}')">
                ${e.status === 'posted' ? '⬇️ Unpost' : '🚀 Post'}
              </button>
              <button class="btn-ghost btn-sm" style="color:var(--red);" onclick="deleteEventHandler('${esc(e.id)}', '${esc(e.name)}')">Delete</button>
            </td>
          </tr>
        `;
      }).join('');

      renderPagination('eventsPagination', p, totalPages, loadEvents);
    } catch (error) {
      console.error('Error loading events:', error);
      toast('Failed to load events');
    }
  }

  // Event Form Modal handlers
  const eventModal = document.getElementById('eventModal');
  const eventForm = document.getElementById('eventForm');
  const eventModalClose = document.getElementById('eventModalClose');
  const eventModalCancel = document.getElementById('eventModalCancel');
  const eventModalSave = document.getElementById('eventModalSave');
  const eventEntryType = document.getElementById('eventEntryType');
  const priceGroup = document.getElementById('priceGroup');
  let editingEventId = null;

  // Show/hide price field based on entry type
  if (eventEntryType) {
    eventEntryType.addEventListener('change', (e) => {
      priceGroup.style.display = e.target.value === 'paid' ? 'flex' : 'none';
    });
  }

  // ── Venue Autocomplete ──────────────────────────────────────────────
  const eventVenue = document.getElementById('eventVenue');
  let venueTimeout;
  let currentVenueSuggestions = [];

  function createVenueAutocompleteDropdown() {
    if (document.getElementById('venueSuggestionsDropdown')) {
      return; // Already created
    }
    const dropdown = document.createElement('div');
    dropdown.id = 'venueSuggestionsDropdown';
    dropdown.style.cssText = `
      position: absolute;
      background: var(--bg-elevated);
      border: 1px solid var(--border-mid);
      border-top: none;
      border-radius: 0 0 8px 8px;
      max-height: 400px;
      overflow-y: scroll;
      width: 100%;
      z-index: 1000;
      display: none;
      box-shadow: 0 12px 32px rgba(0,0,0,0.4);
      top: 100%;
      left: 0;
      right: 0;
    `;
    eventVenue.parentElement.style.position = 'relative';
    eventVenue.parentElement.appendChild(dropdown);
  }

  function showVenueSuggestions(places) {
    const dropdown = document.getElementById('venueSuggestionsDropdown') || createVenueAutocompleteDropdown();
    const dropdown2 = document.getElementById('venueSuggestionsDropdown');
    if (!places || places.length === 0) {
      dropdown2.style.display = 'none';
      return;
    }
    
    dropdown2.innerHTML = places.map((place, idx) => `
      <div data-idx="${idx}" style="
        padding: 12px;
        border-bottom: 1px solid var(--border);
        cursor: pointer;
        transition: background 0.15s;
      " class="venue-suggestion-item">
        <div style="color: var(--white); font-weight: 500; font-size: 0.9rem;">${esc(place.name || place.Name || '')}</div>
        <div style="color: var(--muted); font-size: 0.8rem; margin-top: 4px;">${esc(place.address || place.Address || place.vicinity || '')}</div>
      </div>
    `).join('');
    
    dropdown2.style.display = 'block';
    
    // Add click handlers
    document.querySelectorAll('.venue-suggestion-item').forEach(item => {
      item.addEventListener('click', () => {
        const idx = parseInt(item.dataset.idx);
        const place = places[idx];
        eventVenue.value = place.name || place.Name || '';
        dropdown2.style.display = 'none';
        eventVenue.focus();
      });
      item.addEventListener('mouseenter', () => {
        item.style.background = 'rgba(255,255,255,0.05)';
      });
      item.addEventListener('mouseleave', () => {
        item.style.background = 'transparent';
      });
    });
  }

  if (eventVenue) {
    // Create dropdown on first focus
    eventVenue.addEventListener('focus', () => {
      createVenueAutocompleteDropdown();
    });

    // Fetch suggestions as user types
    eventVenue.addEventListener('input', async (e) => {
      const query = e.target.value.trim();
      clearTimeout(venueTimeout);
      
      if (query.length < 2) {
        const dropdown = document.getElementById('venueSuggestionsDropdown');
        if (dropdown) dropdown.style.display = 'none';
        return;
      }
      
      // Debounce API call
      venueTimeout = setTimeout(async () => {
        try {
          // Use backend places search API
          const response = await apiAbs(API_BASE + '/v1/places/by-area?area=' + encodeURIComponent(query));
          if (response && Array.isArray(response)) {
            currentVenueSuggestions = response;
            showVenueSuggestions(response);
          } else {
            const dropdown = document.getElementById('venueSuggestionsDropdown');
            if (dropdown) dropdown.style.display = 'none';
          }
        } catch (error) {
          console.error('Error fetching venue suggestions:', error);
          const dropdown = document.getElementById('venueSuggestionsDropdown');
          if (dropdown) dropdown.style.display = 'none';
        }
      }, 300);
    });

    // Hide dropdown when input loses focus
    eventVenue.addEventListener('blur', () => {
      setTimeout(() => {
        const dropdown = document.getElementById('venueSuggestionsDropdown');
        if (dropdown) dropdown.style.display = 'none';
      }, 150); // Delay to allow click to register
    });
  }

  // ── Photo Upload Logic ──────────────────────────────────────────────
  let selectedPhotos = []; // Store File objects
  const photoUploadArea = document.getElementById('photoUploadArea');
  const photoFileInput = document.getElementById('photoFileInput');
  const photoPreviewGrid = document.getElementById('photoPreviewGrid');

  if (photoUploadArea && photoFileInput) {
    photoUploadArea.addEventListener('click', () => {
      photoFileInput.click();
    });

    photoFileInput.addEventListener('change', (e) => {
      handlePhotoSelect(Array.from(e.target.files || []));
    });

    // Drag and drop
    photoUploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      photoUploadArea.classList.add('drag-active');
    });

    photoUploadArea.addEventListener('dragleave', () => {
      photoUploadArea.classList.remove('drag-active');
    });

    photoUploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      photoUploadArea.classList.remove('drag-active');
      const files = Array.from(e.dataTransfer.files || []).filter(f => f.type.startsWith('image/'));
      handlePhotoSelect(files);
    });
  }

  function handlePhotoSelect(files) {
    // Max 5 photos
    const totalPhotos = selectedPhotos.length + files.length;
    if (totalPhotos > 5) {
      toast('Maximum 5 photos allowed');
      return;
    }

    // Validate file sizes (max 10MB each)
    const validFiles = files.filter(f => {
      if (f.size > 10 * 1024 * 1024) {
        toast(`${f.name} is too large (max 10MB)`);
        return false;
      }
      return true;
    });

    selectedPhotos.push(...validFiles);
    renderPhotoPreview();
  }

  function renderPhotoPreview() {
    photoPreviewGrid.innerHTML = selectedPhotos.map((file, idx) => {
      const url = URL.createObjectURL(file);
      return `
        <div class="photo-preview-item">
          <img src="${url}" alt="Photo ${idx + 1}" />
          <button class="photo-preview-remove" onclick="window.removePhoto(${idx})">✕</button>
        </div>
      `;
    }).join('');

    // Hide upload area if 5 photos
    if (selectedPhotos.length >= 5) {
      photoUploadArea.style.display = 'none';
    } else {
      photoUploadArea.style.display = 'block';
    }
  }

  window.removePhoto = (idx) => {
    selectedPhotos.splice(idx, 1);
    renderPhotoPreview();
  };

  async function uploadPhotos() {
    if (selectedPhotos.length === 0) return [];

    const photoIds = [];
    let uploadErrors = [];

    for (let i = 0; i < selectedPhotos.length; i++) {
      const file = selectedPhotos[i];
      try {
        console.log(`Uploading photo ${i + 1}/${selectedPhotos.length}: ${file.name}`);
        
        // Create FormData for multipart upload
        const formData = new FormData();
        formData.append('file', file);
        formData.append('fileType', 'event_cover');

        // Upload through backend (avoids S3 CORS issues)
        const uploadRes = await fetch(API_BASE + '/v1/file/upload', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + token,
          },
          body: formData,
        });

        console.log(`Backend upload response status: ${uploadRes.status} for ${file.name}`);

        if (!uploadRes.ok) {
          const errorData = await uploadRes.json();
          console.error(`Backend upload failed for ${file.name}: status ${uploadRes.status}`, errorData);
          uploadErrors.push(`Failed to upload ${file.name}: ${errorData.message || 'Unknown error'}`);
          continue;
        }

        const response = await uploadRes.json();
        const fileId = response.fileId;

        if (fileId) {
          photoIds.push(fileId);
          console.log(`Photo uploaded successfully: ${fileId}`);
        } else {
          console.error('No fileId in response for', file.name, 'response:', response);
          uploadErrors.push(`No file ID returned for ${file.name}`);
        }
      } catch (error) {
        console.error('Error uploading photo:', file.name, error);
        uploadErrors.push(`Error uploading ${file.name}: ${error.message}`);
      }
    }

    if (uploadErrors.length > 0) {
      console.warn('Photo upload errors:', uploadErrors);
      // Show partial upload warning if some succeeded
      if (photoIds.length > 0) {
        toast(`Uploaded ${photoIds.length}/${selectedPhotos.length} photos. Errors: ${uploadErrors.join(', ')}`);
      } else {
        throw new Error(`Failed to upload all photos: ${uploadErrors.join(', ')}`);
      }
    }

    return photoIds;
  }


  function openEventModal(eventData = null) {
    editingEventId = eventData?.id || null;
    document.getElementById('eventModalTitle').textContent = eventData ? 'Edit Event' : 'Create Event';

    if (eventData) {
      // Parse date and time from ISO string
      const dateObj = new Date(eventData.date);
      const dateStr = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD

      document.getElementById('eventName').value = eventData.name || '';
      document.getElementById('eventCategory').value = eventData.category || '';
      document.getElementById('eventDescription').value = eventData.description || '';
      document.getElementById('eventVenue').value = eventData.venue || '';
      document.getElementById('eventDate').value = dateStr;
      document.getElementById('eventStartTime').value = eventData.startTime || '';
      document.getElementById('eventEndTime').value = eventData.endTime || '';
      document.getElementById('eventEntryType').value = eventData.entryType || 'free';
      document.getElementById('eventPrice').value = eventData.price || '';
      document.getElementById('eventCapacity').value = eventData.capacity || '';
      document.getElementById('eventDressCode').value = eventData.dressCode || '';
      document.getElementById('eventAgeRestriction').checked = eventData.ageRestriction || false;

      priceGroup.style.display = eventData.entryType === 'paid' ? 'flex' : 'none';
    } else {
      eventForm.reset();
      priceGroup.style.display = 'none';
    }

    // Reset photos
    selectedPhotos = [];
    photoFileInput.value = '';
    renderPhotoPreview();

    // Ensure loader is hidden when opening modal
    const loaderEl = document.querySelector('.event-save-loader');
    if (loaderEl) loaderEl.style.display = 'none';

    eventModal.classList.remove('hidden');
  }

  function closeEventModal() {
    eventModal.classList.add('hidden');
    eventForm.reset();
    editingEventId = null;
    priceGroup.style.display = 'none';
    selectedPhotos = [];
    photoFileInput.value = '';
    renderPhotoPreview();
    const loader = document.querySelector('.event-save-loader');
    if (loader) loader.style.display = 'none';
  }

  if (eventModalClose) eventModalClose.addEventListener('click', closeEventModal);
  if (eventModalCancel) eventModalCancel.addEventListener('click', closeEventModal);

  if (eventModalSave) {
    eventModalSave.addEventListener('click', async () => {
      if (!eventForm.checkValidity()) {
        eventForm.reportValidity();
        return;
      }

      // Show loader
      const loader = document.querySelector('.event-save-loader');
      if (loader) loader.style.display = 'flex';

      const payload = {
        name: document.getElementById('eventName').value,
        description: document.getElementById('eventDescription').value,
        date: new Date(document.getElementById('eventDate').value).toISOString(),
        startTime: document.getElementById('eventStartTime').value,
        endTime: document.getElementById('eventEndTime').value,
        venue: document.getElementById('eventVenue').value,
        category: document.getElementById('eventCategory').value,
        entryType: document.getElementById('eventEntryType').value,
        price: parseInt(document.getElementById('eventPrice').value) || 0,
        capacity: parseInt(document.getElementById('eventCapacity').value) || 0,
        dressCode: document.getElementById('eventDressCode').value,
        ageRestriction: document.getElementById('eventAgeRestriction').checked,
      };

      try {
        // Upload photos first
        if (selectedPhotos.length > 0) {
          console.log(`Starting photo upload for ${selectedPhotos.length} photos`);
          const uploadingToast = toast('Uploading photos...');
          try {
            const photoIds = await uploadPhotos();
            if (photoIds.length > 0) {
              payload.photoIds = photoIds;
              if (photoIds.length > 0) {
                payload.coverImageId = photoIds[0]; // First photo as cover
              }
              console.log(`Successfully uploaded ${photoIds.length} photos:`, photoIds);
            } else {
              console.error('No photos were uploaded successfully');
              toast('Error: Failed to upload any photos. Please try again.');
              return;
            }
          } catch (photoError) {
            console.error('Photo upload failed:', photoError);
            toast('Error uploading photos: ' + photoError.message);
            return;
          }
        }

        console.log('Saving event with payload:', payload);
        let response;
        if (editingEventId) {
          // PUT /v1/event/{id}
          console.log('Updating event:', editingEventId);
          response = await apiAbs(API_BASE + '/v1/event/' + editingEventId, {
            method: 'PUT',
            body: JSON.stringify(payload),
          });
        } else {
          // POST /v1/event
          console.log('Creating new event');
          response = await apiAbs(API_BASE + '/v1/event', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
        }

        console.log('Event save response:', response);
        
        // Handle wrapped response format: {message, data: {id, ...}}
        let eventId = null;
        if (response && response.data && response.data.id) {
          eventId = response.data.id;
        } else if (response && response.id) {
          eventId = response.id;
        }
        
        if (eventId) {
          toast(editingEventId ? 'Event updated successfully' : 'Event created successfully');
          closeEventModal();
          // Switch to events section and reload
          activateSection('events');
          setTimeout(() => loadEvents(1), 300);
        } else {
          console.error('Event save returned invalid response:', response);
          toast('Failed to save event - invalid response from server');
        }
      } catch (error) {
        console.error('Error saving event:', error);
        toast('Error saving event: ' + (error.message || 'Unknown error'));
      } finally {
        // Hide loader if exists
        const loader = document.querySelector('.event-save-loader');
        if (loader) loader.style.display = 'none';
      }
    });
  }

  // Global handlers for table actions
  window.editEventHandler = async (eventId) => {
    try {
      console.log('Fetching event:', eventId);
      const response = await apiAbs(API_BASE + '/v1/event/' + eventId);
      console.log('Event fetch response:', response);
      
      // Handle different response formats
      let eventData = null;
      if (response && response.id) {
        eventData = response;
      } else if (response && response.data && response.data.event) {
        eventData = response.data.event;
      } else if (response && response.data) {
        eventData = response.data;
      }

      if (eventData && eventData.id) {
        openEventModal(eventData);
      } else {
        toast('Failed to load event details - invalid response format');
      }
    } catch (error) {
      console.error('Error fetching event:', error);
      toast('Error loading event: ' + (error.message || 'Unknown error'));
    }
  };

  window.togglePostEvent = async (eventId, action) => {
    try {
      // Get current event data
      const response = await apiAbs(API_BASE + '/v1/event/' + eventId);
      if (!response || !response.data) {
        toast('Failed to load event');
        return;
      }

      const eventData = response.data.event || response.data;
      const newStatus = action === 'post' ? 'posted' : 'draft';

      // Update with new status
      const updatePayload = {
        name: eventData.name,
        description: eventData.description,
        date: eventData.date,
        startTime: eventData.startTime,
        endTime: eventData.endTime,
        venue: eventData.venue,
        category: eventData.category,
        entryType: eventData.entryType,
        price: eventData.price || 0,
        capacity: eventData.capacity || 0,
        dressCode: eventData.dressCode,
        ageRestriction: eventData.ageRestriction,
        status: newStatus,
      };

      const updateResponse = await apiAbs(API_BASE + '/v1/event/' + eventId, {
        method: 'PUT',
        body: JSON.stringify(updatePayload),
      });

      if (updateResponse && (updateResponse.message || updateResponse.data)) {
        toast(action === 'post' ? 'Event posted successfully' : 'Event unpublished');
        loadEvents(currentEventPage);
      } else {
        toast('Failed to update event status');
      }
    } catch (error) {
      console.error('Error toggling event status:', error);
      toast('Error updating event');
    }
  };

  // Delete Event Modal
  const eventDeleteModal = document.getElementById('eventDeleteModal');
  const eventDeleteCancel = document.getElementById('eventDeleteCancel');
  const eventDeleteConfirm = document.getElementById('eventDeleteConfirm');
  let deleteEventId = null;

  window.deleteEventHandler = (eventId, eventName) => {
    deleteEventId = eventId;
    document.getElementById('eventDeleteName').textContent = eventName;
    eventDeleteModal.classList.remove('hidden');
  };

  if (eventDeleteCancel) {
    eventDeleteCancel.addEventListener('click', () => {
      eventDeleteModal.classList.add('hidden');
      deleteEventId = null;
    });
  }

  if (eventDeleteConfirm) {
    eventDeleteConfirm.addEventListener('click', async () => {
      if (!deleteEventId) return;

      try {
        const response = await apiAbs(API_BASE + '/v1/event/' + deleteEventId, {
          method: 'DELETE',
        });

        if (response) {
          toast('Event deleted successfully');
          eventDeleteModal.classList.add('hidden');
          deleteEventId = null;
          loadEvents(1);
        } else {
          toast('Failed to delete event');
        }
      } catch (error) {
        console.error('Error deleting event:', error);
        toast('Error deleting event: ' + (error.message || 'Unknown error'));
      }
    });
  }

  // Event filter and search buttons
  const eventFilterBtn = document.getElementById('eventFilterBtn');
  const eventCreateBtn = document.getElementById('eventCreateBtn');

  if (eventFilterBtn) {
    eventFilterBtn.addEventListener('click', () => loadEvents(1));
  }

  if (eventCreateBtn) {
    eventCreateBtn.addEventListener('click', () => openEventModal());
  }

  const eventSearch = document.getElementById('eventSearch');
  if (eventSearch) {
    eventSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') loadEvents(1);
    });
  }

  document.getElementById('eventStatusFilter')?.addEventListener('change', () => loadEvents(1));
  document.getElementById('eventCategoryFilter')?.addEventListener('change', () => loadEvents(1));

  // ── Miscellaneous ──────────────────────────────────────────────────────────
  let _miscLoaded = false;

  const _miscFields = [
    ['misc-maleGuidelines', 'maleGuidelines'],
    ['misc-femGuidelines',  'femaleGuidelines'],
    ['misc-maleAbout',      'maleAboutApp'],
    ['misc-femAbout',       'femaleAboutApp'],
    ['misc-maleFaq',        'maleFaq'],
    ['misc-femFaq',         'femaleFaq'],
    ['misc-support',        'supportCredentials'],
    ['misc-tnc',            'termsAndConditions'],
    ['misc-privacy',        'privacyPolicy'],
    ['misc-childSafety',    'childSafetyStandards'],
    ['misc-childSafety',    'childSafetyStandards'],
    ['misc-malePay',        'malePaymentPolicy'],
    ['misc-femPay',         'femalePaymentPolicy'],
    ['misc-maleCancel',     'maleCancellationPolicy'],
    ['misc-femCancel',      'femaleCancellationPolicy'],
    ['misc-maleRefund',               'maleRefundPolicy'],
    ['misc-femRefund',                 'femaleRefundPolicy'],
    ['misc-disclaimerPoints',          'disclaimerPoints'],
  ];

  const _appVersionFields = [
    ['app-version-minIOSVersion',           'minIOSVersion'],
    ['app-version-latestIOSVersion',        'latestIOSVersion'],
    ['app-version-minAndroidBuildNumber',   'minAndroidBuildNumber'],
    ['app-version-latestAndroidBuildNumber','latestAndroidBuildNumber'],
    ['app-version-updateMessage',           'updateMessage'],
  ];

  const _paymentFields = [
    ['payment-mUserPlatformFeePercent', 'mUserPlatformFeePercent'],
    ['payment-fUserPlatformFeePercent', 'fUserPlatformFeePercent'],
  ];

  let _cockpitLoaded = false;

  async function loadCockpit() {
    if (_cockpitLoaded) return;
    const json = await apiAbs(API_BASE + '/v1/admin/settings');
    if (!json) { toast('Failed to load cockpit settings'); return; }
    
    // Load app version tab
    _appVersionFields.forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (el) el.value = json[key] || '';
    });
    const forceUpgradeEl = document.getElementById('app-version-forceUpgradeEnabled');
    if (forceUpgradeEl) forceUpgradeEl.checked = json.forceUpgradeEnabled || false;
    
    // Load payment tab
    _paymentFields.forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (el) el.value = json[key] || '';
    });
    
    // Load misc tab
    _miscFields.forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (el) el.value = json[key] || '';
    });
    // Load misc feature flag checkboxes
    const liveEventsEl = document.getElementById('events-liveEventsEnabled');
    if (liveEventsEl) liveEventsEl.checked = json.liveEventsEnabled || false;
    const selfieVerifEl = document.getElementById('misc-selfieVerificationEnabled');
    if (selfieVerifEl) selfieVerifEl.checked = json.selfieVerificationEnabled || false;
    const referAFriendEl = document.getElementById('appconfig-referAFriendEnabled');
    if (referAFriendEl) referAFriendEl.checked = json.referAFriendEnabled || false;
    const showLastSearchedEl = document.getElementById('appconfig-showLastSearchedClubsForMale');
    if (showLastSearchedEl) showLastSearchedEl.checked = json.showLastSearchedClubsForMale || false;
    const showLastBookedEl = document.getElementById('appconfig-showLastBookedPlaces');
    if (showLastBookedEl) showLastBookedEl.checked = json.showLastBookedPlaces || false;
    const showTopVisitedEl = document.getElementById('appconfig-showTopVisitedPlacesNearby');
    if (showTopVisitedEl) showTopVisitedEl.checked = json.showTopVisitedPlacesNearby || false;
    
    _cockpitLoaded = true;
    
    // Setup tab switching
    setupCockpitTabs();
  }

  function initCockpitCollapsibles() {
    const chevron = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="6 9 12 15 18 9"/></svg>';
    document.querySelectorAll('#section-cockpit .misc-group').forEach(group => {
      if (group.dataset.collapseReady) return;
      const title = group.querySelector('.misc-group-title');
      if (!title) return;
      group.dataset.collapseReady = '1';
      const body = document.createElement('div');
      body.className = 'misc-group-body';
      let node = title.nextSibling;
      while (node) {
        const next = node.nextSibling;
        body.appendChild(node);
        node = next;
      }
      group.appendChild(body);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'misc-group-min';
      btn.setAttribute('aria-label', 'Minimize section');
      btn.setAttribute('aria-expanded', 'true');
      btn.innerHTML = chevron;
      title.appendChild(btn);
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const collapsed = group.classList.toggle('is-collapsed');
        btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        btn.setAttribute('aria-label', collapsed ? 'Expand section' : 'Minimize section');
      });
    });
  }

  function setupCockpitTabs() {
    const tabButtons = document.querySelectorAll('.cockpit-tab');
    const tabContents = document.querySelectorAll('.cockpit-tab-content');
    
    tabButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        const tabName = button.dataset.tab;
        
        // Hide all tabs
        tabContents.forEach(content => content.classList.remove('active'));
        tabButtons.forEach(btn => btn.classList.remove('active'));
        
        // Show selected tab
        const selectedContent = document.getElementById('cockpit-tab-' + tabName);
        if (selectedContent) selectedContent.classList.add('active');
        button.classList.add('active');
      });
    });
  }

  async function saveAppVersion() {
    const payload = {};
    _appVersionFields.forEach(([id, key]) => {
      const el = document.getElementById(id);
      payload[key] = el ? el.value : '';
    });
    const forceUpgradeEl = document.getElementById('app-version-forceUpgradeEnabled');
    if (forceUpgradeEl) payload.forceUpgradeEnabled = forceUpgradeEl.checked;
    const result = await apiAbs(API_BASE + '/v1/admin/settings', {
      method: 'PATCH',
      body:   JSON.stringify(payload),
    });
    if (!result) { toast('Failed to save app version settings'); return; }
    toast('App version settings saved successfully');
  }

  async function savePayment() {
    const payload = {};
    _paymentFields.forEach(([id, key]) => {
      const el = document.getElementById(id);
      payload[key] = el ? el.value : '';
    });
    const result = await apiAbs(API_BASE + '/v1/admin/settings', {
      method: 'PATCH',
      body:   JSON.stringify(payload),
    });
    if (!result) { toast('Failed to save payment settings'); return; }
    toast('Payment settings saved successfully');
  }

  async function saveMisc() {
    const payload = {};
    _miscFields.forEach(([id, key]) => {
      const el = document.getElementById(id);
      payload[key] = el ? el.value : '';
    });
    const result = await apiAbs(API_BASE + '/v1/admin/settings', {
      method: 'PATCH',
      body:   JSON.stringify(payload),
    });
    if (!result) { toast('Failed to save miscellaneous settings'); return; }
    toast('Miscellaneous settings saved successfully');
  }

  async function saveAppConfigs() {
    const liveEventsEl = document.getElementById('events-liveEventsEnabled');
    const selfieVerifEl = document.getElementById('misc-selfieVerificationEnabled');
    const referAFriendEl = document.getElementById('appconfig-referAFriendEnabled');
    const showLastSearchedEl = document.getElementById('appconfig-showLastSearchedClubsForMale');
    const showLastBookedEl = document.getElementById('appconfig-showLastBookedPlaces');
    const showTopVisitedEl = document.getElementById('appconfig-showTopVisitedPlacesNearby');
    const payload = {
      liveEventsEnabled: liveEventsEl ? liveEventsEl.checked : false,
      selfieVerificationEnabled: selfieVerifEl ? selfieVerifEl.checked : false,
      referAFriendEnabled: referAFriendEl ? referAFriendEl.checked : false,
      showLastSearchedClubsForMale: showLastSearchedEl ? showLastSearchedEl.checked : false,
      showLastBookedPlaces: showLastBookedEl ? showLastBookedEl.checked : false,
      showTopVisitedPlacesNearby: showTopVisitedEl ? showTopVisitedEl.checked : false,
    };
    const result = await apiAbs(API_BASE + '/v1/admin/settings', {
      method: 'PATCH',
      body:   JSON.stringify(payload),
    });
    if (!result) { toast('Failed to save app configs'); return; }
    toast('App configs saved successfully');
  }

  let _eventsSettingsLoaded = false;

  async function loadEventsSettings() {
    if (_eventsSettingsLoaded) return;
    const json = await apiAbs(API_BASE + '/v1/admin/settings');
    if (!json) { toast('Failed to load events settings'); return; }
    
    const liveEventsEl = document.getElementById('events-liveEventsEnabled');
    if (liveEventsEl) liveEventsEl.checked = json.liveEventsEnabled || false;
    
    _eventsSettingsLoaded = true;
  }

  async function saveEventsSettings() {
    const liveEventsEl = document.getElementById('events-liveEventsEnabled');
    const payload = {
      liveEventsEnabled: liveEventsEl ? liveEventsEl.checked : false,
    };
    const result = await apiAbs(API_BASE + '/v1/admin/settings', {
      method: 'PATCH',
      body:   JSON.stringify(payload),
    });
    if (!result) { toast('Failed to save events settings'); return; }
    toast('Events settings saved successfully');
  }

  // ── Boot ────────────────────────────────────────────────────────────────────
  // Honour URL hash so back-links from other pages can land on a specific section.
  if (location.hash === '#subscription') {
    window.location.replace('subscription.html');
    return;
  }
  const _bootSection = window.location.hash.replace('#', '');
  activateSection(navHashes.includes(_bootSection) ? _bootSection : 'overview');
  initCockpitCollapsibles();

  const appVersionBtn = document.getElementById('appVersionSaveBtn');
  const paymentBtn = document.getElementById('paymentSaveBtn');
  const appConfigsBtn = document.getElementById('appConfigsSaveBtn');
  const miscBtn = document.getElementById('miscSaveBtn');
  const eventsBtn = document.getElementById('eventsSaveBtn');

  if (appVersionBtn)  appVersionBtn.addEventListener('click', saveAppVersion);
  if (paymentBtn)     paymentBtn.addEventListener('click', savePayment);
  if (appConfigsBtn)  appConfigsBtn.addEventListener('click', saveAppConfigs);
  if (miscBtn)        miscBtn.addEventListener('click', saveMisc);
  if (eventsBtn)      eventsBtn.addEventListener('click', saveEventsSettings);

  // ── Initialize Events List ──────────────────────────────────────────────────
  // Load events when the Events section is activated
  const eventsSection = document.getElementById('events-section');
  if (eventsSection) {
    loadEvents(1);
    loadEventsSettings();
  }

})();
