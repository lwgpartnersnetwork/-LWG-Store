/* =========================================================
   LWG Store — app.js (frontend-only, NO BACKEND)
   - Cart in localStorage
   - Header cart badge sync (all pages & tabs)
   - Mobile nav toggle
   - Footer year
   - Exposes window.__lwg helpers for other scripts
   ========================================================= */

/* ================ tiny DOM helper ================ */
const $ = (s, r = document) => r.querySelector(s);

/* ================ safe JSON helpers ============== */
function safeParse(json, fallback) {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : fallback;
  } catch {
    return fallback;
  }
}
function safeStringify(v) {
  try { return JSON.stringify(v); } catch { return '[]'; }
}

/* ================ cart helpers =================== */
function readCart() {
  // Always return an array of items {id, title?, price?, image?, qty}
  return safeParse(localStorage.getItem('lwg_cart'), []);
}

/** Merge duplicate IDs (defensive) */
function normalizeCart(arr) {
  const map = new Map();
  (Array.isArray(arr) ? arr : []).forEach(it => {
    const id = String(it?.id ?? '');
    const qty = Number(it?.qty ?? 0);
    if (!id || qty <= 0) return;
    map.set(id, (map.get(id) || 0) + qty);
  });
  return Array.from(map, ([id, qty]) => ({ id, qty }));
}

function writeCart(arr) {
  const normalized = normalizeCart(arr);
  localStorage.setItem('lwg_cart', safeStringify(normalized));
  updateCartBadge();
  // Let other scripts/pages react
  window.dispatchEvent(new Event('cart:changed'));
}

/* ================ badge ========================== */
function updateCartBadge() {
  const badge = document.getElementById('cartBadge');
  if (!badge) return;
  const totalQty = readCart().reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
  badge.textContent = String(totalQty);

  // Subtle micro-animation when the number changes
  badge.style.transform = 'scale(1.08)';
  badge.style.transition = 'transform 120ms ease';
  requestAnimationFrame(() => {
    setTimeout(() => { badge.style.transform = 'scale(1)'; }, 80);
  });
}

/* ================ one-time init ================== */
(function initCart() {
  // Optional: reset via ?resetcart=1
  const params = new URLSearchParams(location.search);
  if (!localStorage.getItem('lwg_cart') || params.get('resetcart') === '1') {
    writeCart([]);
  } else {
    // Sanitize any previous invalid value & merge duplicates
    writeCart(readCart());
  }
})();

/* ================ footer year ==================== */
function setYear() {
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
}

/* ================ DOM Ready ====================== */
document.addEventListener('DOMContentLoaded', () => {
  setYear();
  updateCartBadge();

  // Mobile nav toggle
  const toggle = $('.nav-toggle');
  const nav = $('#siteNav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    // Close on link click (nice on phones)
    nav.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => nav.classList.remove('open'));
    });
  }
});

/* ============== cross-tab sync =================== */
// When cart changes in another tab, keep the badge in sync here.
window.addEventListener('storage', (e) => {
  if (e.key === 'lwg_cart') updateCartBadge();
});

/* ============== global export ==================== */
window.__lwg = {
  readCart,
  writeCart,
  updateCartBadge
};
