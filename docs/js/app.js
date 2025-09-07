/* ===================== API base ===================== *
 * Uses localhost when developing, otherwise your Render API.
 * IMPORTANT: the deployed base MUST NOT end with /api
 * because other scripts append /api/... to it.
 */
const API_BASE =
  location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    ? 'http://localhost:5000/api'
    : 'https://lwg-api-ackk.onrender.com';

// Make it available everywhere (e.g., products.js reads window.API_BASE)
window.API_BASE = API_BASE;

/* ==================== Common helpers ==================== */
const q = (s, r = document) => r.querySelector(s);

// Normalize + read cart safely
function readCart() {
  try {
    const raw = localStorage.getItem('lwg_cart');
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

function writeCart(arr) {
  localStorage.setItem('lwg_cart', JSON.stringify(Array.isArray(arr) ? arr : []));
  updateCartBadge();
  window.dispatchEvent(new Event('cart:changed'));
}

function setYear() {
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
}

function updateCartBadge() {
  const badge = document.getElementById('cartBadge');
  if (!badge) return;
  const totalQty = readCart().reduce((a, i) => a + (Number(i.qty) || 0), 0);
  badge.textContent = totalQty;
}

/* ==================== Init cart store ==================== */
(function initCart() {
  const params = new URLSearchParams(location.search);
  if (!localStorage.getItem('lwg_cart') || params.get('resetcart') === '1') {
    writeCart([]); // start clean
  } else {
    // if previously invalid, fix silently
    writeCart(readCart());
  }
})();

/* ==================== DOM Ready ==================== */
document.addEventListener('DOMContentLoaded', () => {
  setYear();
  updateCartBadge();

  // Mobile nav toggle
  const toggle = q('.nav-toggle');
  const nav = q('#siteNav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    // Close menu when a nav link is tapped (nice on phones)
    nav.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => nav.classList.remove('open'));
    });
  }
});

/* ==================== Global events ==================== */
// Any page updates the badge when cart changes
window.addEventListener('cart:changed', updateCartBadge);

// Expose helpers for products.js and other scripts
window.__lwg = { readCart, writeCart, updateCartBadge };
