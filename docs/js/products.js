/* =========================================================
   LWG Store — products.js (API-enabled with robust fallback)
   - Loads products from backend API (prefers server when logged in)
   - Falls back to localStorage (no login prompt)
   - Admin create/delete via JWT (SweetAlert login when you click Login)
   - Cart + WhatsApp checkout
   ========================================================= */

/* ========= PAYMENT META ========= */
const API_BASE = (window.API_BASE || "https://lwg-api-ackk.onrender.com/api");


const PAYMENT_METHODS = {
  orange: {
    label: 'Orange Money',
    info:
      'Account Name: LWG Partners Network\n' +
      'Wallet Number: +232 72 146 015\n' +
      'Note: Send payment reference with your name.'
  },
  africell: {
    label: 'Africell Money',
    info:
      'Account Name: LWG Partners Network\n' +
      'Wallet Number: +232 30 774 701\n' +
      'Note: Send payment reference with your name.'
  },
  bank: {
    label: 'Bank Transfer',
    info:
      'Bank: UBA\n' +
      'Account Name: LWG Partners Network\n' +
      'Account No: 5409-1003-0001-447\n' +
      'Branch: Freetown\n' +
      'Note: Include Order ID in transfer narration.'
  },
  cod: {
    label: 'Cash on Delivery',
    info: 'Pay the rider on delivery. Please keep the exact amount ready.'
  }
};

/* ========= YOUR API BASE (already includes /api) ========= */
/* uses window.API_BASE if set by app.js, else falls back to your Render URL */

/* ========= Feature flag ========= */
const USE_API_PRODUCTS = true; // prefer API when possible

/* ========= Local fallback store ========= */
const PKEY = 'lwg_products';

function seedLocalIfEmpty() {
  let arr;
  try {
    arr = JSON.parse(localStorage.getItem(PKEY) || '[]');
  } catch {
    arr = [];
  }
  if (!arr.length) {
    arr = [
      {
        id: 'L1',
        title: 'Men Classic T-Shirt',
        category: 'Men',
        price: 350,
        stock: 20,
        image: 'https://images.unsplash.com/photo-1520975922203-b2646e2718bf?w=600',
        description: 'Soft cotton tee — navy'
      },
      {
        id: 'L2',
        title: 'Women Summer Dress',
        category: 'Women',
        price: 520,
        stock: 15,
        image: 'https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?w=600',
        description: 'Lightweight and elegant'
      },
      {
        id: 'L3',
        title: 'Kids Sneakers',
        category: 'Kids',
        price: 450,
        stock: 25,
        image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600',
        description: 'Comfortable everyday sneakers'
      },
      {
        id: 'L4',
        title: 'Bluetooth Headphones',
        category: 'Electronics',
        price: 980,
        stock: 12,
        image: 'https://images.unsplash.com/photo-1518443895914-6ce5f3c1d7d0?w=600',
        description: 'Clear sound, long battery'
      }
    ];
    localStorage.setItem(PKEY, JSON.stringify(arr));
  }
  return arr;
}
const getLocalProducts = () => {
  try {
    return JSON.parse(localStorage.getItem(PKEY) || '[]');
  } catch {
    return [];
  }
};
const setLocalProducts = (arr) =>
  localStorage.setItem(PKEY, JSON.stringify(arr || []));

/* ========= API helpers ========= */
async function apiGetProducts() {
  const res = await fetch(`${API_BASE}/products`, {
    headers: { 'Content-Type': 'application/json' }
  });
  if (!res.ok) throw new Error(`GET /products ${res.status}`);
  return res.json();
}

async function apiCreateProduct(token, data) {
  const res = await fetch(`${API_BASE}/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      title: data.title,
      category: data.category || 'General',
      price: Number(data.price || 0),
      stock: Number(data.stock || 0),
      image_url: data.image || '',
      description: data.description || ''
    })
  });
  if (!res.ok) throw new Error(`POST /products ${res.status}`);
  return res.json();
}

async function apiDeleteProduct(token, id) {
  const res = await fetch(`${API_BASE}/products/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`DELETE /products ${res.status}`);
  return res.json();
}

async function apiLogin(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) throw new Error('Invalid credentials');
  return res.json(); // { token }
}

/* ========= Admin auth ========= */
const TOKEN_KEY = 'lwg_token';
const getToken = () => localStorage.getItem(TOKEN_KEY) || '';
const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
const clearToken = () => localStorage.removeItem(TOKEN_KEY);

/* Login prompt only when you click “Admin Login” (not on Save) */
async function ensureAdminLogin() {
  if (getToken()) return getToken();

  if (!window.Swal) {
    const email = prompt('Admin email:');
    const pass = prompt('Password:');
    const { token } = await apiLogin(email, pass);
    setToken(token);
    return token;
  }

  const { value: creds } = await Swal.fire({
    title: 'Admin Login',
    html:
      '<input id="sw-email" class="swal2-input" placeholder="Email" type="email">' +
      '<input id="sw-pass" class="swal2-input" placeholder="Password" type="password">',
    showCancelButton: true,
    focusConfirm: false,
    preConfirm: () => {
      const e = document.getElementById('sw-email').value.trim();
      const p = document.getElementById('sw-pass').value;
      if (!e || !p) Swal.showValidationMessage('Email and password required');
      return { email: e, pass: p };
    }
  });

  if (!creds) throw new Error('Login cancelled');

  const { token } = await apiLogin(creds.email, creds.pass);
  setToken(token);
  return token;
}

/* ========= Cache & wiring ========= */
let PRODUCTS_CACHE = [];

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('productForm');
  const list = document.getElementById('adminList');
  const clearBtn = document.getElementById('clearProducts');

  /* ------ SAVE PRODUCT (server when logged in; otherwise local) ------ */
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const fd = new FormData(form);
      const payload = {
        title: (fd.get('title') || '').trim(),
        category: (fd.get('category') || 'General').trim(),
        price: parseFloat(fd.get('price') || '0'),
        stock: parseInt(fd.get('stock') || '0', 10),
        image: (fd.get('image') || '').trim(),
        description: (fd.get('description') || '').trim()
      };

      if (!payload.title) {
        if (window.Swal) Swal.fire('Title is required');
        return;
      }

      try {
        let savedViaAPI = false;

        // Only hit the API if we’re already logged in
        if (USE_API_PRODUCTS && getToken()) {
          try {
            await apiCreateProduct(getToken(), payload);
            savedViaAPI = true;
            if (window.Swal)
              Swal.fire({
                icon: 'success',
                title: 'Saved to server',
                timer: 1200,
                showConfirmButton: false
              });
          } catch (apiErr) {
            console.warn('API create failed, using local fallback:', apiErr);
          }
        }

        // Local fallback (no login needed)
        if (!savedViaAPI) {
          const arr = getLocalProducts();
          arr.unshift({ id: 'L' + Date.now(), ...payload });
          setLocalProducts(arr);
          if (window.Swal)
            Swal.fire({
              icon: 'success',
              title: 'Saved locally (fallback)',
              timer: 1200,
              showConfirmButton: false
            });
        }

        form.reset();
        await loadProducts();
        renderAdmin();
      } catch (err) {
        console.error(err);
        if (window.Swal)
          Swal.fire({
            icon: 'error',
            title: 'Save failed',
            text: String(err.message || err)
          });
        else alert('Save failed: ' + err.message);
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      if (confirm('Delete ALL local products (dev only)?')) {
        localStorage.removeItem(PKEY);
        await loadProducts();
        renderAdmin();
      }
    });
  }

  if (list) loadProducts().then(renderAdmin);

  // Shop page
  const grid = document.getElementById('productGrid');
  const catSel = document.getElementById('categoryFilter');
  const search = document.getElementById('searchInput');

  if (grid) {
    loadProducts().then(() => {
      renderShop();
      const cats = Array.from(
        new Set(PRODUCTS_CACHE.map((p) => p.category))
      ).filter(Boolean);
      if (catSel) {
        cats.forEach((c) => {
          const o = document.createElement('option');
          o.value = c;
          o.textContent = c;
          catSel.appendChild(o);
        });
      }
    });
    catSel?.addEventListener('change', renderShop);
    search?.addEventListener('input', renderShop);
  }

  // Cart page
  if (document.getElementById('cartItems')) {
    document.getElementById('deliveryLocation')?.addEventListener('change', renderCart);
    document.getElementById('paymentMethod')?.addEventListener('change', updatePaymentInfo);
    renderCart();
    updatePaymentInfo();
  }
});

/* ========= Load products (API first; use local if API empty/unavailable) ========= */
async function loadProducts() {
  try {
    if (USE_API_PRODUCTS) {
      const apiRows = await apiGetProducts(); // may be []
      const local = getLocalProducts();

      // prefer local if server returns empty but local has items
      if ((apiRows || []).length === 0 && (local || []).length > 0) {
        PRODUCTS_CACHE = local;
        return PRODUCTS_CACHE;
      }

      PRODUCTS_CACHE = (apiRows || []).map((r) => ({
        id: r.id,
        title: r.title,
        category: r.category || 'General',
        price: Number(r.price || 0),
        stock: Number(r.stock || 0),
        image: r.image_url || '',
        description: r.description || ''
      }));
      return PRODUCTS_CACHE;
    }

    PRODUCTS_CACHE = seedLocalIfEmpty();
    return PRODUCTS_CACHE;
  } catch (err) {
    console.warn('API products failed, using local:', err);
    PRODUCTS_CACHE = seedLocalIfEmpty();
    return PRODUCTS_CACHE;
  }
}

/* ========= Cart helpers ========= */
function addToCart(item) {
  const api = window.__lwg;
  const cart = api.readCart();
  const found = cart.find((i) => String(i.id) === String(item.id));
  if (found) {
    found.qty = (Number(found.qty) || 0) + 1;
  } else {
    cart.push({
      id: item.id,
      title: item.title,
      price: item.price,
      image: item.image,
      qty: 1
    });
  }
  api.writeCart(cart);

  if (window.Swal) {
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: 'Added to cart',
      showConfirmButton: false,
      timer: 1200
    });
  }
}

function changeQty(id, delta) {
  const api = window.__lwg;
  const cart = api.readCart();
  const it = cart.find((i) => String(i.id) === String(id));
  if (!it) return;
  it.qty = (Number(it.qty) || 0) + delta;
  if (it.qty <= 0) {
    const idx = cart.findIndex((i) => String(i.id) === String(id));
    if (idx > -1) cart.splice(idx, 1);
  }
  api.writeCart(cart);
  renderCart();
}

function removeItem(id) {
  const api = window.__lwg;
  const cart = api.readCart().filter((i) => String(i.id) !== String(id));
  api.writeCart(cart);
  renderCart();
}

/* ========= Delivery + Payment UI ========= */
function getDeliveryFee() {
  const sel = document.getElementById('deliveryLocation');
  if (!sel || !sel.value) return 0;
  const [, feeRaw] = sel.value.split('|');
  const fee = Number(feeRaw);
  return isNaN(fee) ? 0 : fee;
}

function getDeliveryLocationLabel() {
  const sel = document.getElementById('deliveryLocation');
  if (!sel || !sel.value) return '';
  return sel.options[sel.selectedIndex].textContent || '';
}

function updatePaymentInfo() {
  const sel = document.getElementById('paymentMethod');
  const box = document.getElementById('paymentInfo');
  if (!sel || !box) return;

  const key = sel.value;
  if (!key || !PAYMENT_METHODS[key]) {
    box.style.display = 'none';
    box.textContent = '';
    return;
  }
  const meta = PAYMENT_METHODS[key];
  box.style.display = 'block';
  box.textContent = `${meta.label}\n${meta.info}`;
}

function getPaymentMeta() {
  const sel = document.getElementById('paymentMethod');
  if (!sel || !sel.value) return { label: '', info: '' };
  const key = sel.value;
  return PAYMENT_METHODS[key] || { label: '', info: '' };
}

/* ========= Renderers ========= */
function renderAdmin() {
  const list = document.getElementById('adminList');
  if (!list) return;

  list.innerHTML = '';
  PRODUCTS_CACHE.forEach((p) => {
    const el = document.createElement('div');
    el.className = 'admin-item';
    el.innerHTML = `
      <div class="row">
        <strong>${p.title}</strong>
        <span>NLe ${(+p.price || 0).toFixed(2)}</span>
      </div>
      <div class="row small muted">
        <span>${p.category || 'General'}</span>
        <span>Stock: ${(+p.stock || 0)}</span>
      </div>
      <img src="${p.image || ''}" alt="" onerror="this.style.display='none'"/>
      <div class="actions">
        <button class="btn danger" data-del="${p.id}">Delete</button>
      </div>`;
    list.appendChild(el);
  });

  // delete (server if logged in, else local)
  list.querySelectorAll('button[data-del]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-del');
      try {
        let deleted = false;

        if (USE_API_PRODUCTS && getToken()) {
          try {
            await apiDeleteProduct(getToken(), id);
            deleted = true;
          } catch (e) {
            console.warn('API delete failed, try local:', e);
          }
        }
        if (!deleted) {
          setLocalProducts(
            getLocalProducts().filter((x) => String(x.id) !== String(id))
          );
        }

        await loadProducts();
        renderAdmin();
        if (window.Swal)
          Swal.fire({
            icon: 'success',
            title: 'Deleted',
            timer: 900,
            showConfirmButton: false
          });
      } catch (err) {
        console.error(err);
        if (window.Swal)
          Swal.fire({
            icon: 'error',
            title: 'Delete failed',
            text: String(err.message || err)
          });
        else alert('Delete failed: ' + err.message);
      }
    });
  });
}

function renderShop() {
  const grid = document.getElementById('productGrid');
  if (!grid) return;

  const catSel = document.getElementById('categoryFilter');
  const cat = catSel ? catSel.value : '';
  const q = (document.getElementById('searchInput')?.value || '').toLowerCase();

  const filtered = PRODUCTS_CACHE.filter(
    (p) =>
      (!cat || p.category === cat) &&
      (p.title.toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q))
  );

  grid.innerHTML = '';
  filtered.forEach((p) => {
    const card = document.createElement('div');
    card.className = 'product';
    card.innerHTML = `
      <div class="pimg">
        <img src="${p.image || ''}" alt=""
             onerror="this.parentElement.textContent='No Image'"/>
      </div>
      <div class="body">
        <strong>${p.title}</strong>
        <span class="small muted">${p.category || 'General'}</span>
        <span class="price">NLe ${(+p.price || 0).toFixed(2)}</span>
        <button class="btn primary">Add to Cart</button>
      </div>
    `;
    card.querySelector('button').addEventListener('click', () => addToCart(p));
    grid.appendChild(card);
  });

  if (!filtered.length) {
    grid.innerHTML = '<p class="muted">No products found.</p>';
  }
}

function renderCart() {
  const container = document.getElementById('cartItems');
  if (!container) return;

  const api = window.__lwg;
  const cart = api.readCart();
  container.innerHTML = '';
  let subtotal = 0;

  cart.forEach((item) => {
    const qty = +item.qty || 0;
    const price = +item.price || 0;
    const line = price * qty;
    subtotal += line;

    const row = document.createElement('div');
    row.className = 'cart-item';
    row.innerHTML = `
      <img src="${item.image || ''}" alt=""/>
      <div>
        <strong>${item.title}</strong>
        <div class="small muted">NLe ${price.toFixed(2)}</div>
      </div>
      <div class="qty">
        <button data-id="${item.id}" data-delta="-1">-</button>
        <span>${qty}</span>
        <button data-id="${item.id}" data-delta="1">+</button>
      </div>
      <button class="btn" data-remove="${item.id}">Remove</button>
    `;
    container.appendChild(row);
  });

  const fee = getDeliveryFee();
  const grand = subtotal + fee;

  document.getElementById('cartSubtotal')?.textContent =
    subtotal.toFixed(2);
  document.getElementById('deliveryFee')?.textContent = fee.toFixed(2);
  document.getElementById('cartTotal')?.textContent = grand.toFixed(2);

  container.querySelectorAll('button[data-delta]').forEach((b) => {
    b.addEventListener('click', () =>
      changeQty(b.getAttribute('data-id'), parseInt(b.getAttribute('data-delta'), 10))
    );
  });
  container.querySelectorAll('button[data-remove]').forEach((b) => {
    b.addEventListener('click', () =>
      removeItem(b.getAttribute('data-remove'))
    );
  });

  // Checkout via WhatsApp (+ optional server save)
  const checkoutBtn = document.getElementById('checkoutBtn');
  if (checkoutBtn) {
    checkoutBtn.textContent = 'Checkout via WhatsApp';
    checkoutBtn.onclick = async () => {
      if (!cart.length) {
        if (window.Swal) {
          await Swal.fire({
            icon: 'warning',
            title: 'Empty Cart',
            text: 'Add items before checkout.',
            confirmButtonColor: '#002F5F'
          });
        } else alert('Your cart is empty.');
        return;
      }

      const name = (document.getElementById('custName')?.value || '').trim();
      const address = (document.getElementById('custAddress')?.value || '').trim();
      const phone = (document.getElementById('custPhone')?.value || '').trim();
      const locationLabel = getDeliveryLocationLabel() || 'Not selected';
      const payment = getPaymentMeta();

      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const fallbackOrderId = `LWG-${now.getFullYear()}${pad(
        now.getMonth() + 1
      )}${pad(now.getDate())}-${pad(now.getHours())}${pad(
        now.getMinutes()
      )}${pad(now.getSeconds())}`;

      const payload = {
        customer_name: name,
        phone,
        address,
        delivery_location: locationLabel,
        delivery_fee: fee,
        subtotal,
        total: subtotal + fee,
        payment_method: payment.label || '',
        payment_info: payment.info || '',
        source_url: location.href,
        items: cart.map((i) => ({
          title: i.title,
          price: Number(i.price),
          qty: Number(i.qty),
          image_url: i.image || ''
        }))
      };

      if (window.Swal) {
        await Swal.fire({
          title: 'Saving your order…',
          allowOutsideClick: false,
          showConfirmButton: false,
          didOpen: () => Swal.showLoading()
        });
      }

      let serverOrder = null;
      try {
        const res = await fetch(`${API_BASE}/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        serverOrder = res.ok ? await res.json() : null;
      } catch {
        serverOrder = null;
      }
      const orderId = serverOrder?.id ? `#${serverOrder.id}` : fallbackOrderId;

      if (window.Swal) Swal.close();

      const lines = cart.map((i, idx) => {
        const price = Number(i.price) || 0;
        const qty = Number(i.qty) || 0;
        const lineTotal = price * qty;
        return `${idx + 1}. ${i.title}  |  Qty: ${qty}  |  @ NLe ${price.toFixed(
          2
        )}  |  Line: NLe ${lineTotal.toFixed(2)}`;
      });

      const message = `NEW ORDER — ${orderId}
Items:
${lines.join('\n')}

Subtotal: NLe ${subtotal.toFixed(2)}
Delivery (${locationLabel}): NLe ${fee.toFixed(2)}
Grand Total: NLe ${(subtotal + fee).toFixed(2)}

Customer: ${name || '—'} | ${phone || '—'}
Address: ${address || '—'}

Payment: ${payment.label || '—'}
${payment.info ? 'Payment Details:\n' + payment.info + '\n' : ''}Source: ${
        location.href
      }`;

      window.open(
        `https://wa.me/23272146015?text=${encodeURIComponent(message)}`,
        '_blank',
        'noopener'
      );

      if (window.Swal) {
        Swal.fire({
          icon: 'success',
          title: 'Order sent to WhatsApp',
          timer: 1500,
          showConfirmButton: false
        });
      }

      window.__lwg.writeCart([]);
      setTimeout(() => location.reload(), 1800);
    };
  }
}

/* ========= Admin helpers for page buttons ========= */
window.LWG_AUTH = {
  async login() {
    return ensureAdminLogin();
  },
  logout() {
    clearToken();
  },
  isLoggedIn() {
    return !!getToken();
  }
};

/* ========= Events ========= */
window.addEventListener('admin:refresh', async () => {
  await loadProducts();
  renderAdmin();
});

window.addEventListener('cart:changed', () => {
  try {
    renderCart();
  } catch {}
});
