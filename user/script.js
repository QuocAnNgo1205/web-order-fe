// ---------- Config ----------
const API_BASE = (localStorage.getItem('BASE_URL') || 'http://localhost:3000/api').replace(/\/$/, '');

// ---------- Helpers ----------
const $ = (s) => document.querySelector(s);
const fmt = (n) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n || 0);
const getQuery = (k) => new URL(location.href).searchParams.get(k);

// ---------- State ----------
let TABLE = parseInt(getQuery('table') || '', 10);
if (!Number.isInteger(TABLE) || TABLE <= 0) TABLE = null;

let FOODS = [];
// cart: { [foodId]: { qty: number, food: FoodDoc } }
const CART = Object.create(null);

// ---------- UI mounts ----------
const tableBadge = $('#tableBadge');
const apiHint = $('#apiHint');
const cartBtn = $('#cartBtn');
const cartCount = $('#cartCount');
const drawer = $('#drawer');
const backdrop = $('#backdrop');
const closeDrawer = $('#closeDrawer');
const cartBody = $('#cartBody');
const subtotalEl = $('#subtotal');
const grid = $('#menuGrid');

// detail modal
const modal = $('#detailModal');
const detailOverlay = $('#detailOverlay');
const detailClose = $('#detailClose');
const detailImg = $('#detailImg');
const detailTitle = $('#detailTitle');
const detailPrice = $('#detailPrice');
const detailDesc = $('#detailDesc');

// ---------- Init navbar ----------
tableBadge.textContent = TABLE ? `Table ${TABLE}` : 'Table ? (use ?table=1)';
apiHint.textContent = `API: ${API_BASE}`;

// ---------- API ----------
async function api(path, options = {}) {
  const res = await fetch(API_BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    let msg = res.status + ' ' + res.statusText;
    try { const data = await res.json(); msg = data.error || msg; } catch {}
    throw new Error(msg);
  }
  try { return await res.json(); } catch { return null; }
}

// ---------- Data loaders ----------
async function loadFoods() {
  FOODS = await api('/foods');
}

// ---------- Cart ops ----------
function getQty(id) {
  return CART[id]?.qty || 0;
}
function setQty(food, qty) {
  const id = food._id;
  if (qty <= 0) {
    delete CART[id];
  } else {
    CART[id] = { qty, food };
  }
  updateCartBadge();
  updateCardQty(id, qty);
}
function inc(food) { setQty(food, getQty(food._id) + 1); }
function dec(food) { setQty(food, Math.max(0, getQty(food._id) - 1)); }

function cartCountTotal() {
  return Object.values(CART).reduce((s, it) => s + it.qty, 0);
}
function cartSubtotal() {
  return Object.values(CART).reduce((s, it) => s + it.qty * (it.food.price || 0), 0);
}
function updateCartBadge() {
  cartCount.textContent = cartCountTotal();
}

// ---------- Renderers ----------
function renderMenu() {
  grid.innerHTML = '';
  FOODS.forEach((f) => {
    const card = document.createElement('div');
    card.className = 'card';

    const imgWrap = document.createElement('div');
    imgWrap.className = 'thumb-wrap';
    const img = document.createElement('img');
    img.className = 'thumb';
    img.src = f.image || placeholder();
    img.alt = f.name;
    imgWrap.appendChild(img);
    card.appendChild(imgWrap);

    const content = document.createElement('div');
    content.className = 'content';
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = f.name;
    const price = document.createElement('div');
    price.className = 'price';
    price.textContent = fmt(f.price);
    const qtyRow = document.createElement('div');
    qtyRow.className = 'qty-row';
    const btnMinus = document.createElement('button');
    btnMinus.className = 'btn-qty';
    btnMinus.textContent = '−';
    const num = document.createElement('div');
    num.className = 'num';
    num.textContent = getQty(f._id);
    num.id = `qty-${f._id}`;
    const btnPlus = document.createElement('button');
    btnPlus.className = 'btn-qty';
    btnPlus.textContent = '+';

    qtyRow.append(btnMinus, num, btnPlus);
    content.append(title, price, qtyRow);
    card.appendChild(content);

    // events
    imgWrap.addEventListener('click', () => openDetail(f));
    btnPlus.addEventListener('click', () => inc(f));
    btnMinus.addEventListener('click', () => dec(f));

    grid.appendChild(card);
  });
}

function updateCardQty(id, qty) {
  const n = document.getElementById(`qty-${id}`);
  if (n) n.textContent = qty;
}

function renderCartDrawer() {
  cartBody.innerHTML = '';
  const items = Object.values(CART);
  if (items.length === 0) {
    cartBody.innerHTML = `<div class="muted">Your cart is empty.</div>`;
  } else {
    items.forEach(({ food, qty }) => {
      const line = document.createElement('div');
      line.className = 'line';
      const name = document.createElement('div');
      name.textContent = food.name;
      const qtyEl = document.createElement('div');
      qtyEl.textContent = '× ' + qty;
      const price = document.createElement('div');
      price.textContent = fmt(qty * (food.price || 0));
      cartBody.append(line);
      line.append(name, qtyEl, price);
    });
  }
  subtotalEl.textContent = fmt(cartSubtotal());
}

// ---------- Drawer / Modal ----------
function openDrawer() {
  renderCartDrawer();
  drawer.classList.add('open');
  backdrop.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
}
function closeDrawerFn() {
  drawer.classList.remove('open');
  backdrop.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');
}

function openDetail(f) {
  detailImg.src = f.image || placeholder();
  detailTitle.textContent = f.name;
  detailPrice.textContent = fmt(f.price);
  detailDesc.textContent = f.description || '';
  modal.classList.add('show');
  modal.setAttribute('aria-hidden', 'false');
}
function closeDetail() {
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden', 'true');
}

// ---------- Submit ----------
async function submitOrder() {
  if (!TABLE) {
    alert('Missing table number. Add ?table=1 to URL.');
    return;
  }
  const items = Object.values(CART).map(({ food, qty }) => ({ food: food._id, quantity: qty }));
  if (items.length === 0) {
    alert('Cart is empty.');
    return;
  }
  try {
    const res = await api('/orders', { method: 'POST', body: JSON.stringify({ table: TABLE, items }) });
    alert('Order created: ' + res._id);
    // reset
    Object.keys(CART).forEach(k => delete CART[k]);
    updateCartBadge();
    renderMenu();
    closeDrawerFn();
  } catch (e) {
    alert(e.message);
  }
}

// ---------- Events ----------
cartBtn.addEventListener('click', openDrawer);
closeDrawer.addEventListener('click', closeDrawerFn);
backdrop.addEventListener('click', closeDrawerFn);
detailOverlay.addEventListener('click', closeDetail);
detailClose.addEventListener('click', closeDetail);
$('#submitOrder').addEventListener('click', submitOrder);

// ---------- Placeholder image ----------
function placeholder() {
  const svg = encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='600' height='400'><rect width='100%' height='100%' fill='#f3f4f6'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='#9ca3af' font-family='sans-serif' font-size='20'>No image</text></svg>`);
  return `data:image/svg+xml;charset=utf-8,${svg}`;
}

// ---------- Boot ----------
(async function main() {
  try {
    await loadFoods();
    renderMenu();
    updateCartBadge();
  } catch (e) {
    grid.innerHTML = `<div class="muted">Failed to load menu: ${e.message}</div>`;
  }
})();
