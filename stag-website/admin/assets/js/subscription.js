/**
 * STAG Admin — Subscription Management
 */
(function () {
  'use strict';

  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    window.location.href = 'index.html';
    return;
  }

  const adminInfo = JSON.parse(localStorage.getItem(ADMIN_INFO_KEY) || '{}');
  const roleLabel = adminInfo.role || 'admin';
  const nameLabel = adminInfo.username || adminInfo.email || 'Admin';
  const avatarChar = nameLabel.charAt(0).toUpperCase();
  const profileAvatar = document.getElementById('profileAvatar');
  const profileName = document.getElementById('profileName');
  const profileRole = document.getElementById('profileRole');
  if (profileAvatar) profileAvatar.textContent = avatarChar;
  if (profileName) profileName.textContent = nameLabel;
  if (profileRole) profileRole.textContent = roleLabel;
  const headerAvatar = document.getElementById('headerAvatar');
  const headerAdminName = document.getElementById('headerAdminName');
  const adminBadge = document.getElementById('adminBadge');
  if (headerAvatar) headerAvatar.textContent = avatarChar;
  if (headerAdminName) headerAdminName.textContent = nameLabel;
  if (adminBadge) adminBadge.textContent = roleLabel;

  async function apiAbs(url, opts = {}) {
    const res = await fetch(url, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
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

  const toastEl = document.getElementById('toast');
  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 3000);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  const neverExpiresEl = document.getElementById('planNeverExpires');
  const expiryDaysEl = document.getElementById('planExpiryDays');
  const tableEl = document.getElementById('plansTable');
  const bodyEl = document.getElementById('plansBody');
  const emptyEl = document.getElementById('plansEmpty');
  const loaderEl = document.getElementById('plansLoader');
  const pagerEl = document.getElementById('plansPagination');
  const createPanel = document.getElementById('planCreatePanel');
  const createOpenBtn = document.getElementById('planCreateOpenBtn');
  const planDetailsModal = document.getElementById('planDetailsModal');
  const detailDescriptionEl = document.getElementById('detailPlanDescription');
  const detailDescriptionCountEl = document.getElementById('detailDescriptionCount');
  let detailPlanId = '';
  const PAGE_LIMIT = 10;
  let plans = [];
  let currentPage = 1;
  let pageLimit = PAGE_LIMIT;
  let totalPlans = 0;
  let sortKey = '';
  let sortDir = 'asc';

  function renderPagination(page, totalPages, onPageChange) {
    pagerEl.innerHTML = '';
    if (totalPages <= 1) return;
    const prev = document.createElement('button');
    prev.className = 'page-btn';
    prev.textContent = '‹';
    prev.disabled = page <= 1;
    prev.onclick = function () { onPageChange(page - 1); };
    pagerEl.appendChild(prev);
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);
    for (let p = start; p <= end; p++) {
      const btn = document.createElement('button');
      btn.className = 'page-btn' + (p === page ? ' active' : '');
      btn.textContent = p;
      btn.onclick = function () { onPageChange(p); };
      pagerEl.appendChild(btn);
    }
    const next = document.createElement('button');
    next.className = 'page-btn';
    next.textContent = '›';
    next.disabled = page >= totalPages;
    next.onclick = function () { onPageChange(page + 1); };
    pagerEl.appendChild(next);
  }

  function renderPager() {
    const totalPages = Math.max(1, Math.ceil(totalPlans / pageLimit));
    renderPagination(currentPage, totalPages, loadPlans);
  }

  function comparePlans(a, b) {
    const av = a[sortKey];
    const bv = b[sortKey];
    let cmp = 0;
    if (sortKey === 'name' || sortKey === 'status') {
      cmp = String(av || '').localeCompare(String(bv || ''), undefined, { sensitivity: 'base' });
    } else {
      cmp = Number(av) - Number(bv);
    }
    return sortDir === 'asc' ? cmp : -cmp;
  }

  function applySort() {
    if (!sortKey) return;
    plans.sort(comparePlans);
  }

  function syncSortHeaders() {
    document.querySelectorAll('#plansTable th[data-sort]').forEach(function (th) {
      const on = th.getAttribute('data-sort') === sortKey;
      th.classList.toggle('is-sorted', on);
      th.setAttribute('aria-sort', on ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none');
    });
  }

  function setNeverExpires(never) {
    neverExpiresEl.checked = never;
    document.querySelectorAll('.plan-expiry-pair').forEach(function (pair) {
      pair.classList.toggle('is-on', (pair.getAttribute('data-never') === 'true') === never);
    });
    expiryDaysEl.disabled = never;
  }

  function setCreatePanelOpen(open) {
    createPanel.hidden = !open;
    createOpenBtn.textContent = open ? 'Cancel' : 'Create plan';
    if (open) document.getElementById('planName').focus();
  }

  function showLoader(on) {
    loaderEl.hidden = !on;
    if (on) {
      tableEl.hidden = true;
      emptyEl.hidden = true;
      pagerEl.innerHTML = '';
    }
  }

  function upsertPlan(plan) {
    const idx = plans.findIndex(function (p) { return p.id === plan.id; });
    if (idx === -1) {
      plans.unshift(plan);
      return;
    }
    plans[idx] = Object.assign({}, plans[idx], plan);
  }

  function rowHtml(plan) {
    const expiry = plan.neverExpires ? 'Never' : (String(plan.expiryDays) + ' days');
    const deleted = plan.status === 'deleted';
    const active = plan.status === 'active';
    const rowClass = deleted ? 'plan-row--deleted' : (active ? '' : 'plan-row--inactive');
    const toggle = deleted
      ? ''
      : '<label class="toggle-switch toggle-switch--sm" title="' + (active ? 'Deactivate' : 'Activate') + '">' +
          '<input type="checkbox" data-toggle="' + esc(plan.id) + '"' + (active ? ' checked' : '') + '>' +
          '<span class="toggle-track"></span>' +
        '</label>';
    const deleteBtn = deleted
      ? ''
      : '<button class="btn-sm btn-danger" type="button" data-delete="' + esc(plan.id) + '"' +
          (active ? ' disabled title="Deactivate the plan before deleting"' : ' title="Delete plan"') +
        '>Delete</button>';
    return '<tr class="' + rowClass + '" data-plan-id="' + esc(plan.id) + '">' +
      '<td><button class="plan-name-link" type="button" data-plan-open="' + esc(plan.id) + '">' + esc(plan.name) + '</button></td>' +
      '<td>' + esc(plan.creditCount) + '</td>' +
      '<td>' + esc(plan.cost) + '</td>' +
      '<td>' + esc(plan.currency) + '</td>' +
      '<td>' + esc(expiry) + '</td>' +
      '<td class="plan-keep">' +
        '<div class="plan-status-cell">' +
          '<span class="plan-status is-' + esc(plan.status) + '">' + esc(plan.status) + '</span>' +
          toggle +
        '</div>' +
      '</td>' +
      '<td class="plan-keep">' + deleteBtn + '</td>' +
    '</tr>';
  }

  function formatDate(value) {
    if (!value) return 'Not available';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function openPlanDetails(plan) {
    if (!plan) return;
    detailPlanId = plan.id;
    document.getElementById('detailPlanName').textContent = plan.name || 'Unnamed plan';
    document.getElementById('detailPlanStatus').textContent = plan.status || 'Not specified';
    document.getElementById('detailPlanCredits').textContent = String(plan.creditCount == null ? 'Not specified' : plan.creditCount);
    document.getElementById('detailPlanPrice').textContent = (plan.currency || 'INR') + ' ' + Number(plan.cost || 0).toLocaleString('en-IN');
    document.getElementById('detailPlanPurpose').textContent = plan.purpose || 'Not specified';
    document.getElementById('detailPlanExpiry').textContent = plan.neverExpires ? 'Never expires' : (String(plan.expiryDays || 0) + ' days');
    document.getElementById('detailPlanCreated').textContent = formatDate(plan.createdAt);
    document.getElementById('detailPlanUpdated').textContent = formatDate(plan.updatedAt);
    detailDescriptionEl.value = plan.description || '';
    detailDescriptionCountEl.textContent = detailDescriptionEl.value.length + '/500';
    planDetailsModal.classList.remove('hidden');
    detailDescriptionEl.focus();
  }

  function closePlanDetails() {
    planDetailsModal.classList.add('hidden');
    detailPlanId = '';
  }

  function renderPlans() {
    showLoader(false);
    if (!plans.length) {
      bodyEl.innerHTML = '';
      tableEl.hidden = true;
      emptyEl.hidden = false;
      pagerEl.innerHTML = '';
      return;
    }
    applySort();
    bodyEl.innerHTML = plans.map(rowHtml).join('');
    tableEl.hidden = false;
    emptyEl.hidden = true;
    syncSortHeaders();
    renderPager();
  }

  function resetForm() {
    document.getElementById('planName').value = '';
    document.getElementById('planDescription').value = '';
    document.getElementById('planCreditCount').value = '';
    document.getElementById('planCost').value = '';
    document.getElementById('planCurrency').value = 'INR';
    expiryDaysEl.value = '';
    setNeverExpires(false);
  }

  async function loadPlans(page) {
    currentPage = page > 0 ? page : 1;
    showLoader(true);
    const result = await apiAbs(API_BASE + '/v1/subscription/plans?page=' + currentPage + '&limit=' + PAGE_LIMIT);
    if (!result.ok) {
      toast((result.data && result.data.message) || 'Failed to load plans');
      plans = [];
      totalPlans = 0;
      pageLimit = PAGE_LIMIT;
      renderPlans();
      return;
    }
    const payload = result.data || {};
    plans = payload.items || [];
    totalPlans = payload.total || 0;
    if (payload.limit > 0) pageLimit = payload.limit;
    if (payload.page > 0) currentPage = payload.page;
    renderPlans();
  }

  document.querySelector('.plan-expiry-row').addEventListener('click', function (ev) {
    const pair = ev.target.closest('.plan-expiry-pair');
    if (!pair) return;
    setNeverExpires(pair.getAttribute('data-never') === 'true');
  });
  setNeverExpires(false);
  setCreatePanelOpen(false);

  createOpenBtn.addEventListener('click', function () {
    if (createPanel.hidden) {
      setCreatePanelOpen(true);
      return;
    }
    resetForm();
    setCreatePanelOpen(false);
  });

  document.getElementById('planCreateBtn').addEventListener('click', async function () {
    const name = document.getElementById('planName').value.trim();
    const description = document.getElementById('planDescription').value.trim();
    const creditCount = parseInt(document.getElementById('planCreditCount').value, 10);
    const cost = parseFloat(document.getElementById('planCost').value);
    const currency = document.getElementById('planCurrency').value || 'INR';
    const neverExpires = neverExpiresEl.checked;
    const expiryDays = parseInt(document.getElementById('planExpiryDays').value, 10);

    if (!name) {
      toast('Name is required');
      return;
    }
    if (!(creditCount >= 1)) {
      toast('Credit count must be at least 1');
      return;
    }
    if (!(cost >= 0)) {
      toast('Cost must be 0 or greater');
      return;
    }
    if (!neverExpires && (!Number.isInteger(expiryDays) || expiryDays < 1)) {
      toast('Expiry period (days) must be at least 1');
      return;
    }

    const body = {
      name: name,
      description: description,
      creditCount: creditCount,
      cost: cost,
      currency: currency,
      neverExpires: neverExpires,
      expiryDays: neverExpires ? 1 : expiryDays,
    };
    const result = await apiAbs(API_BASE + '/v1/subscription/plans', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (!result.ok) {
      toast((result.data && result.data.message) || 'Create failed');
      return;
    }
    toast('Plan created');
    resetForm();
    setCreatePanelOpen(false);
    if (!result.data || !result.data.id) return;
    if (currentPage !== 1) {
      loadPlans(1);
      return;
    }
    upsertPlan(result.data);
    totalPlans += 1;
    if (plans.length > pageLimit) plans.length = pageLimit;
    renderPlans();
  });

  tableEl.addEventListener('click', function (ev) {
    const planButton = ev.target.closest('[data-plan-open]');
    if (planButton) {
      const plan = plans.find(function (item) { return item.id === planButton.getAttribute('data-plan-open'); });
      openPlanDetails(plan);
      return;
    }
    const th = ev.target.closest('th[data-sort]');
    if (!th || !tableEl.contains(th)) return;
    const key = th.getAttribute('data-sort');
    if (sortKey === key) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortKey = key;
      sortDir = 'asc';
    }
    renderPlans();
  });

  detailDescriptionEl.addEventListener('input', function () {
    detailDescriptionCountEl.textContent = detailDescriptionEl.value.length + '/500';
  });

  document.getElementById('planDetailsClose').addEventListener('click', closePlanDetails);
  planDetailsModal.addEventListener('click', function (ev) {
    if (ev.target === planDetailsModal) closePlanDetails();
  });
  document.getElementById('savePlanDescription').addEventListener('click', async function () {
    if (!detailPlanId) return;
    const saveButton = document.getElementById('savePlanDescription');
    saveButton.disabled = true;
    const result = await apiAbs(API_BASE + '/v1/subscription/plans/' + encodeURIComponent(detailPlanId), {
      method: 'PATCH',
      body: JSON.stringify({ description: detailDescriptionEl.value.trim() }),
    });
    saveButton.disabled = false;
    if (!result.ok) {
      toast((result.data && result.data.message) || 'Description update failed');
      return;
    }
    upsertPlan(result.data);
    renderPlans();
    closePlanDetails();
    toast('Plan description updated');
  });

  tableEl.addEventListener('change', async function (ev) {
    const toggleInput = ev.target.closest('[data-toggle]');
    if (!toggleInput) return;
    const id = toggleInput.getAttribute('data-toggle');
    toggleInput.disabled = true;
    const result = await apiAbs(API_BASE + '/v1/subscription/plans/' + encodeURIComponent(id) + '/toggle', {
      method: 'POST',
      body: '',
    });
    if (!result.ok) {
      toast((result.data && result.data.message) || 'Toggle failed');
      toggleInput.checked = !toggleInput.checked;
      toggleInput.disabled = false;
      return;
    }
    upsertPlan(result.data);
    renderPlans();
  });

  tableEl.addEventListener('click', async function (ev) {
    const deleteBtn = ev.target.closest('[data-delete]');
    if (!deleteBtn || deleteBtn.disabled) return;
    if (!confirm('Delete this plan from the shop? Purchases already bought keep their credits.')) {
      return;
    }
    const id = deleteBtn.getAttribute('data-delete');
    deleteBtn.disabled = true;
    const result = await apiAbs(API_BASE + '/v1/subscription/plans/' + encodeURIComponent(id), { method: 'DELETE' });
    if (!result.ok) {
      toast((result.data && result.data.message) || 'Delete failed');
      deleteBtn.disabled = false;
      return;
    }
    const existing = plans.find(function (p) { return p.id === id; });
    if (existing) existing.status = 'deleted';
    renderPlans();
  });

  async function loadDailyQuota() {
    const input = document.getElementById('dailyRequestLimit');
    const result = await apiAbs(API_BASE + '/v1/admin/settings');
    if (!result.ok || !result.data) {
      toast((result.data && result.data.message) || 'Failed to load daily free count');
      return;
    }
    const limit = result.data.dailyRequestLimit;
    input.value = Number.isInteger(limit) && limit >= 0 ? String(limit) : '0';
  }

  document.getElementById('dailyRequestLimitSave').addEventListener('click', async function () {
    const input = document.getElementById('dailyRequestLimit');
    const saveBtn = document.getElementById('dailyRequestLimitSave');
    const value = Number(input.value);
    if (!Number.isInteger(value) || value < 0) {
      toast('Daily free count must be 0 or greater');
      return;
    }
    saveBtn.disabled = true;
    const result = await apiAbs(API_BASE + '/v1/admin/settings', {
      method: 'PATCH',
      body: JSON.stringify({ dailyRequestLimit: value }),
    });
    saveBtn.disabled = false;
    if (!result.ok) {
      toast((result.data && result.data.message) || 'Failed to save daily free count');
      return;
    }
    const saved = result.data && result.data.dailyRequestLimit;
    input.value = Number.isInteger(saved) && saved >= 0 ? String(saved) : String(value);
    toast(value === 0 ? 'Daily free disabled' : 'Daily free count saved');
  });

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
      localStorage.clear();
      window.location.href = 'index.html';
    });
  }
  const sidebarToggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (sidebarToggle && sidebar && overlay) {
    sidebarToggle.addEventListener('click', function () {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('visible');
    });
    overlay.addEventListener('click', function () {
      sidebar.classList.remove('open');
      overlay.classList.remove('visible');
    });
  }

  loadDailyQuota();
  loadPlans();
})();
