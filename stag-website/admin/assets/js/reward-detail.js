/* STAG Admin - Reward detail page */
(function () {
  'use strict';

  const token = localStorage.getItem(TOKEN_KEY);
  const params = new URLSearchParams(window.location.search);
  const userId = params.get('id');
  const content = document.getElementById('rewardContent');
  const error = document.getElementById('rewardError');
  const transactions = document.getElementById('rewardTransactions');
  const empty = document.getElementById('rewardEmpty');

  if (!token || !userId) {
    window.location.href = token ? 'dashboard.html#rewards' : 'index.html';
    return;
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[char]));
  }

  function dateTime(value) {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
  }

  function detail(label, value) {
    return `<div class="reward-detail-field"><span>${label}</span><strong>${esc(value || '-')}</strong></div>`;
  }

  function personDetail(label, person) {
    if (!person) return '';
    const contact = [person.email, person.gender].filter(Boolean).join(' · ');
    return `<div class="reward-person-field"><span>${label}</span><strong>${esc(person.name || '-')}</strong><small>${esc(contact)}</small></div>`;
  }

  function transactionHtml(transaction) {
    const points = Number(transaction.points || 0);
    const club = transaction.club;
    const isEntryReward = transaction.type === 'entry';
    const isReferralReward = transaction.type === 'referral' || transaction.type === 'referral_signup';
    return `<article class="reward-transaction">
      <div class="reward-transaction-top">
        <div>
          <h3>${esc(club?.name || transaction.description || transaction.type || 'Reward transaction')}</h3>
          <p class="reward-detail-muted">${dateTime(transaction.createdAt)}</p>
        </div>
        <strong class="reward-points ${points < 0 ? 'reward-negative' : ''}">${points > 0 ? '+' : ''}${points} points</strong>
      </div>
      <div class="reward-detail-grid">
        ${detail('Description', transaction.description || transaction.type)}
        ${isEntryReward ? detail('Club address', club?.address) : ''}
        ${isEntryReward ? detail('Visit date', club ? dateTime(club.datetime) : '') : ''}
        ${isEntryReward ? detail('Status', club?.status) : ''}
        ${isEntryReward ? personDetail('Club entry partner', transaction.entryPartner) : ''}
        ${isReferralReward ? personDetail('Referral user', transaction.referralUser) : ''}
      </div>
    </article>`;
  }

  async function apiGet(url) {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (response.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      window.location.href = 'index.html';
      return null;
    }
    if (!response.ok) throw new Error('Request failed');
    return response.json();
  }

  async function load() {
    try {
      const data = await apiGet(API_BASE + '/v1/admin-dash/rewards/' + encodeURIComponent(userId));
      if (!data) return;
      document.getElementById('rewardUserName').textContent = data.name || '-';
      document.getElementById('rewardUserEmail').textContent = data.email || '-';
      document.getElementById('rewardUserPoints').textContent = Number(data.rewardPoints || 0).toLocaleString();
      const items = Array.isArray(data.transactions) ? data.transactions : [];
      if (items.length === 0) {
        empty.classList.remove('hidden');
      } else {
        transactions.innerHTML = items.map(transactionHtml).join('');
      }
      content.classList.remove('hidden');
    } catch (loadError) {
      error.classList.remove('hidden');
    }
  }

  load();
}());
