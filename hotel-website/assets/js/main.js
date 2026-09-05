/* ================= Gour Hotels — shared behaviour ================= */

/* Mobile nav */
const menuToggle = document.querySelector('.menu-toggle');
const siteNav = document.querySelector('.site-nav');
menuToggle?.addEventListener('click', () => {
  const isOpen = siteNav.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded', String(isOpen));
});
document.querySelectorAll('.site-nav a').forEach((link) => link.addEventListener('click', () => {
  siteNav?.classList.remove('open');
  menuToggle?.setAttribute('aria-expanded', 'false');
}));

/* Default check-in/out dates to today & tomorrow, and stop past dates being pickable */
(function setDefaultDates(){
  const todayEl = document.querySelectorAll('input[type="date"].checkin');
  const tmrwEl = document.querySelectorAll('input[type="date"].checkout');
  const today = new Date();
  const tomorrow = new Date(Date.now() + 86400000);
  const fmt = (d) => d.toISOString().split('T')[0];
  todayEl.forEach((el) => { el.min = fmt(today); if(!el.value) el.value = fmt(today); });
  tmrwEl.forEach((el) => { el.min = fmt(tomorrow); if(!el.value) el.value = fmt(tomorrow); });
})();

/* Accordion (FAQ + Policies) */
document.querySelectorAll('.accordion-item').forEach((item) => {
  const q = item.querySelector('.accordion-q');
  q?.addEventListener('click', () => {
    const wasOpen = item.classList.contains('open');
    item.parentElement.querySelectorAll('.accordion-item').forEach((el) => el.classList.remove('open'));
    if (!wasOpen) item.classList.add('open');
  });
});

/* Gallery filter */
const filterBtns = document.querySelectorAll('.filter-btn');
const galleryItems = document.querySelectorAll('.gallery-item');
filterBtns.forEach((btn) => btn.addEventListener('click', () => {
  filterBtns.forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  const cat = btn.dataset.filter;
  galleryItems.forEach((item) => {
    item.style.display = (cat === 'all' || item.dataset.cat === cat) ? '' : 'none';
  });
}));

/* Dining menu tabs */
const menuTabBtns = document.querySelectorAll('.menu-tab-btn');
const menuPanels = document.querySelectorAll('.menu-panel');
menuTabBtns.forEach((btn) => btn.addEventListener('click', () => {
  menuTabBtns.forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  menuPanels.forEach((p) => p.style.display = (p.dataset.menu === btn.dataset.menu) ? '' : 'none');
}));

/* ================= Booking calculator (demo only, no payment is processed) ================= */
const roomRates = {
  heritage: { name: 'Heritage Room', rate: 3500 },
  deluxe: { name: 'Deluxe Room', rate: 4500 },
  premium: { name: 'Premium Suite', rate: 6800 },
  royal: { name: 'Royal Family Suite', rate: 9200 },
};

function nightsBetween(inDate, outDate) {
  const a = new Date(inDate);
  const b = new Date(outDate);
  const diff = Math.round((b - a) / 86400000);
  return diff > 0 ? diff : 1;
}

const bookingForm = document.getElementById('booking-form');
if (bookingForm) {
  const checkin = document.getElementById('bk-checkin');
  const checkout = document.getElementById('bk-checkout');
  const roomSelect = document.getElementById('bk-room');
  const adultsEl = document.getElementById('bk-adults');
  const childrenEl = document.getElementById('bk-children');

  const sumNights = document.getElementById('sum-nights');
  const sumRoom = document.getElementById('sum-room');
  const sumRate = document.getElementById('sum-rate');
  const sumSubtotal = document.getElementById('sum-subtotal');
  const sumTax = document.getElementById('sum-tax');
  const sumTotal = document.getElementById('sum-total');

  function recalc() {
    const room = roomRates[roomSelect.value] || roomRates.deluxe;
    const nights = nightsBetween(checkin.value, checkout.value);
    const subtotal = room.rate * nights;
    const tax = Math.round(subtotal * 0.12);
    const total = subtotal + tax;
    sumNights.textContent = nights;
    sumRoom.textContent = room.name;
    sumRate.textContent = '₹' + room.rate.toLocaleString('en-IN');
    sumSubtotal.textContent = '₹' + subtotal.toLocaleString('en-IN');
    sumTax.textContent = '₹' + tax.toLocaleString('en-IN');
    sumTotal.textContent = '₹' + total.toLocaleString('en-IN');
  }

  [checkin, checkout, roomSelect, adultsEl, childrenEl].forEach((el) => el?.addEventListener('input', recalc));
  recalc();

  const steps = document.querySelectorAll('.book-step');
  const stepPills = document.querySelectorAll('.step-pill');
  let currentStep = 0;

  function showStep(i) {
    steps.forEach((s, idx) => s.style.display = idx === i ? '' : 'none');
    stepPills.forEach((p, idx) => p.classList.toggle('active', idx === i));
    currentStep = i;
  }
  document.querySelectorAll('[data-next]').forEach((btn) => btn.addEventListener('click', () => showStep(Math.min(currentStep + 1, steps.length - 1))));
  document.querySelectorAll('[data-prev]').forEach((btn) => btn.addEventListener('click', () => showStep(Math.max(currentStep - 1, 0))));
  showStep(0);

  bookingForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const ref = 'GH' + Math.floor(100000 + Math.random() * 900000);
    document.getElementById('book-ref-number').textContent = ref;
    document.getElementById('confirm-name').textContent = document.getElementById('bk-name').value || 'Guest';
    document.getElementById('confirm-total').textContent = sumTotal.textContent;
    document.querySelector('.book-layout').style.display = 'none';
    document.querySelector('.book-steps').style.display = 'none';
    document.getElementById('confirm-panel').classList.add('show');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/* Contact form demo submit */
const contactForm = document.getElementById('contact-form');
contactForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  document.getElementById('contact-success').style.display = 'block';
  contactForm.reset();
  contactForm.style.display = 'none';
});

/* Dining reservation form demo submit */
const diningForm = document.getElementById('dining-form');
diningForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  document.getElementById('dining-success').style.display = 'block';
  diningForm.reset();
});

/* Guest counter steppers (used on home + booking) */
document.querySelectorAll('[data-step]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const targetId = btn.dataset.target;
    const input = document.getElementById(targetId);
    if (!input) return;
    const min = Number(input.min || 0);
    const max = Number(input.max || 99);
    let val = Number(input.value || 0) + Number(btn.dataset.step);
    val = Math.max(min, Math.min(max, val));
    input.value = val;
    input.dispatchEvent(new Event('input'));
  });
});
