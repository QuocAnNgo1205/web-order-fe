// ------- Config -------
const API_BASE = (localStorage.getItem('BASE_URL') || 'http://localhost:3000/api').replace(/\/$/, '');
document.getElementById('apiLine').textContent = `API: ${API_BASE}`;

const $ = (s) => document.querySelector(s);
const el = (t, p={}) => Object.assign(document.createElement(t), p);
const fmt = (n) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n || 0);
const allowedStatuses = ['open', 'preparing', 'served', 'paid', 'cancelled'];

// ------- Tabs -------
const tabMenu = $('#tabMenu');
const tabOrders = $('#tabOrders');
const panelMenu = $('#panelMenu');
const panelOrders = $('#panelOrders');

tabMenu.onclick = () => {
  tabMenu.classList.add('active'); tabOrders.classList.remove('active');
  panelMenu.style.display = ''; panelOrders.style.display = 'none';
};
tabOrders.onclick = () => {
  tabOrders.classList.add('active'); tabMenu.classList.remove('active');
  panelOrders.style.display = ''; panelMenu.style.display = 'none';
  loadOrders();
};

// ------- API -------
async function api(path, options = {}) {
  const res = await fetch(API_BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    let msg = res.status + ' ' + res.statusText;
    try { const d = await res.json(); msg = d.error || msg; } catch {}
    throw new Error(msg);
  }
  try { return await res.json(); } catch { return null; }
}

// ================= MENU =================
const foodsGrid = $('#foodsGrid');
const newName = $('#newName');
const newPrice = $('#newPrice');
const newCategory = $('#newCategory');
const newImage = $('#newImage');
const newDesc = $('#newDesc');
const foodMsg = $('#foodMsg');

function resetCreateForm() {
  newName.value = '';
  newPrice.value = '';
  newCategory.value = 'General';
  newImage.value = '';
  newDesc.value = '';
  foodMsg.textContent = '';
}

async function loadFoods() {
  const foods = await api('/foods');
  foodsGrid.innerHTML = '';
  foods.forEach(f => foodsGrid.append(renderFoodCard(f)));
}

function renderFoodCard(f) {
  const card = el('div', { className: 'card' });
  const title = el('div', { innerHTML: `<strong>${f.name}</strong> <span class="muted">(${f.category || 'General'})</span>` });
  const img = el('img', { src: f.image || placeholder(), alt: f.name, style: 'width:100%;height:160px;object-fit:cover;border-radius:10px;margin:6px 0;background:#f1f5f9' });
  const price = el('div', { innerHTML: `<strong>${fmt(f.price)}</strong>` });
  const desc = el('div', { className: 'muted', textContent: f.description || '' });

  // Inline edit controls
  const nameI = el('input', { value: f.name });
  const priceI = el('input', { type:'number', min:'0', value: f.price });
  const catI = el('input', { value: f.category || 'General' });
  const imgI = el('input', { value: f.image || '' });
  const descI = el('textarea', { value: f.description || '' });

  const actions = el('div', { className: 'row', style: 'margin-top:8px' });
  const btnEdit = el('button', { className: 'btn', textContent: 'Edit' });
  const btnSave = el('button', { className: 'btn primary', textContent: 'Save', style: 'display:none' });
  const btnCancel = el('button', { className: 'btn ghost', textContent: 'Cancel', style: 'display:none' });
  const btnDelete = el('button', { className: 'btn ghost', textContent: 'Delete' });

  const formWrap = el('div', { style: 'display:none; margin-top:8px' });
  formWrap.append(
    row('Name', nameI),
    row('Price', priceI),
    row('Category', catI),
    row('Image URL', imgI),
    row('Description', descI)
  );

  btnEdit.onclick = () => { formWrap.style.display=''; btnSave.style.display=''; btnCancel.style.display=''; btnEdit.style.display='none'; };
  btnCancel.onclick = () => { formWrap.style.display='none'; btnSave.style.display='none'; btnCancel.style.display='none'; btnEdit.style.display=''; };
  btnSave.onclick = async () => {
    try {
      const body = {
        name: nameI.value.trim(),
        price: Number(priceI.value),
        category: catI.value.trim() || 'General',
        image: imgI.value.trim(),
        description: descI.value,
      };
      if (!body.name || Number.isNaN(body.price)) throw new Error('Name/price invalid');
      const updated = await api(`/foods/${f._id}`, { method: 'PATCH', body: JSON.stringify(body) });
      // Re-render card with updated info
      card.replaceWith(renderFoodCard(updated));
    } catch (e) { alert(e.message); }
  };

  btnDelete.onclick = async () => {
    if (!confirm('Delete this dish?')) return;
    try {
      await api(`/foods/${f._id}`, { method: 'DELETE' });
      card.remove();
    } catch (e) { alert(e.message); }
  };

  actions.append(btnEdit, btnSave, btnCancel, btnDelete);

  card.append(title, img, price, desc, actions, formWrap);
  return card;
}

function row(labelText, node) {
  const r = el('div', { className: 'row mb-8' });
  r.append(el('label', { style:'width:110px', textContent: labelText }), node);
  node.style.flex = '1';
  return r;
}

$('#btnCreateFood').onclick = async () => {
  try {
    const body = {
      name: newName.value.trim(),
      price: Number(newPrice.value),
      description: newDesc.value,
      category: (newCategory.value || 'General').trim(),
      image: newImage.value.trim(),
    };
    if (!body.name || Number.isNaN(body.price)) {
      foodMsg.textContent = 'Name and price are required'; return;
    }
    await api('/foods', { method:'POST', body: JSON.stringify(body) });
    foodMsg.textContent = '✅ Created';
    await loadFoods();
    resetCreateForm();
  } catch (e) {
    foodMsg.textContent = '❌ ' + e.message;
  }
};
$('#btnResetFood').onclick = resetCreateForm;

// ================= ORDERS =================
const ordersList = $('#ordersList');
const filterStatus = $('#filterStatus');
const sortTime = $('#sortTime');
$('#refreshOrders').onclick = () => loadOrders();

const servedTicks = new Map(); // UI-only: key = `${orderId}:${itemIndex}` => boolean

async function loadOrders() {
  const all = await api('/orders');
  // filter by status
  const s = filterStatus.value;
  let list = s === 'all' ? all : all.filter(o => o.status === s);
  // sort
  const key = sortTime.value === 'asc' ? 1 : -1;
  list.sort((a,b) => (new Date(a.createdAt) - new Date(b.createdAt)) * key);

  ordersList.innerHTML = '';
  if (list.length === 0) {
    ordersList.innerHTML = `<div class="muted">No orders</div>`;
    return;
  }
  list.forEach(o => ordersList.append(renderOrderCard(o)));
}

function renderOrderCard(o) {
  const card = el('div', { className: 'card mb-12' });

  const head = el('div', { className: 'row mb-8' });
  const title = el('div', { innerHTML: `<strong>#${o._id}</strong> — Table <strong>${o.table}</strong>` });
  const pill = el('span', { className: `pill status-${o.status}`, textContent: o.status });
  const created = el('span', { className: 'muted', textContent: new Date(o.createdAt).toLocaleString() });
  head.append(title, pill, created);
  head.style.justifyContent = 'space-between';

  // items table with tick
  const tbl = el('table', { className: 'table' });
  const thead = el('thead');
  thead.innerHTML = '<tr><th>Served</th><th>Food</th><th>Qty</th><th>Note</th><th>Price</th></tr>';
  const tbody = el('tbody');
  (o.items || []).forEach((it, idx) => {
    const tr = el('tr');
    const key = `${o._id}:${idx}`;
    const cb = el('input', { type:'checkbox', checked: servedTicks.get(key) || false });
    cb.onchange = () => servedTicks.set(key, cb.checked);
    const name = (it.food && (it.food.name || it.food._id)) || it.food || '';
    const price = (it.food && it.food.price) ? it.food.price : 0;
    tr.append(
      el('td', { appendChild: cb }),
      el('td', { textContent: name }),
      el('td', { textContent: it.quantity }),
      el('td', { textContent: it.note || '' }),
      el('td', { textContent: fmt(price * it.quantity) }),
    );
    tbody.append(tr);
  });
  tbl.append(thead, tbody);

  const subtotal = el('div', { className: 'row', style: 'justify-content:space-between; margin-top:8px' });
  subtotal.append(el('div', { className: 'muted', textContent: 'Subtotal' }), el('div', { innerHTML: `<strong>${fmt(o.subtotal || 0)}</strong>` }));

  // status update
  const controls = el('div', { className: 'row', style: 'margin-top:8px' });
  const sel = el('select');
  allowedStatuses.forEach(s => sel.append(el('option', { value: s, textContent: s, selected: o.status === s })));
  const btnUpdate = el('button', { className:'btn', textContent: 'Update status' });
  btnUpdate.onclick = async () => {
    try {
      await api(`/orders/${o._id}/status`, { method:'PATCH', body: JSON.stringify({ status: sel.value }) });
      await loadOrders();
    } catch (e) { alert(e.message); }
  };

  // convenience: if all checked -> mark served
  const btnMarkServed = el('button', { className: 'btn ghost', textContent: 'Mark order as served' });
  btnMarkServed.onclick = async () => {
    try {
      await api(`/orders/${o._id}/status`, { method:'PATCH', body: JSON.stringify({ status: 'served' }) });
      await loadOrders();
    } catch (e) { alert(e.message); }
  };

  controls.append(sel, btnUpdate, btnMarkServed);

  card.append(head, tbl, subtotal, controls);
  return card;
}

// ------- Placeholder image -------
function placeholder() {
  const svg = encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='600' height='400'><rect width='100%' height='100%' fill='#f3f4f6'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='#9ca3af' font-family='sans-serif' font-size='20'>No image</text></svg>`);
  return `data:image/svg+xml;charset=utf-8,${svg}`;
}

// ------- Boot -------
(async function init() {
  await loadFoods();     // preload for Menu tab
  // Orders load on first switch to Orders tab
})();
