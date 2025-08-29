// --- State ---
let BASE = localStorage.getItem('BASE_URL') || document.getElementById('baseUrl').value;
document.getElementById('baseUrl').value = BASE;
const allowedStatuses = ['open', 'preparing', 'served', 'paid', 'cancelled'];

const cart = [];

// --- Utils ---
const $ = (sel) => document.querySelector(sel);
const el = (tag, props = {}) => Object.assign(document.createElement(tag), props);

function showMsg(node, text, ok = true) {
  node.style.display = 'inline-block';
  node.className = 'msg ' + (ok ? 'success' : 'error');
  node.textContent = text;
  setTimeout(() => {
    node.style.display = 'none';
  }, 3000);
}

async function api(path, options = {}) {
  const url = BASE.replace(/\/$/, '') + path;
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!res.ok) {
    let msg = res.status + ' ' + res.statusText;
    try {
      const data = await res.json();
      msg = data.error || msg;
    } catch {}
    throw new Error(msg);
  }
  try {
    return await res.json();
  } catch {
    return null;
  }
}

// --- Foods ---
async function loadFoods() {
  const list = await api('/foods');
  const foodsDiv = $('#foods');
  foodsDiv.innerHTML = '';
  const select = $('#foodSelect');
  select.innerHTML = '';

  list.forEach((f) => {
    const card = el('div', { className: 'card' });
    const title = el('div', { innerHTML: '<strong>' + f.name + '</strong> <span class="pill">' + (f.category || 'General') + '</span>' });
    const price = el('div', { className: 'muted', textContent: Intl.NumberFormat().format(f.price) + ' đ' });
    const desc = el('div', { className: 'small', textContent: f.description || '' });
    card.append(title, price, desc);
    foodsDiv.append(card);

    const opt = el('option', { value: f._id, textContent: f.name + ' — ' + f.price + 'đ' });
    select.append(opt);
  });
}

// --- Cart ---
function renderCart() {
  const wrap = $('#cartList');
  wrap.innerHTML = '';
  if (cart.length === 0) {
    wrap.innerHTML = '<div class="muted">Cart is empty.</div>';
    return;
  }
  const table = el('table', { className: 'table' });
  const thead = el('thead');
  thead.innerHTML = '<tr><th>Food</th><th class="nowrap">Qty</th><th>Note</th><th></th></tr>';
  const tbody = el('tbody');
  cart.forEach((it, idx) => {
    const tr = el('tr');
    tr.append(el('td', { textContent: it.foodName }), el('td', { textContent: it.quantity }), el('td', { textContent: it.note || '' }), el('td', {}));
    const btn = el('button', { className: 'ghost', textContent: 'Remove' });
    btn.onclick = () => {
      cart.splice(idx, 1);
      renderCart();
    };
    tr.lastChild.append(btn);
    tbody.append(tr);
  });
  table.append(thead, tbody);
  wrap.append(table);
}

// --- Orders ---
async function loadOrders() {
  const list = await api('/orders');
  const root = $('#orders');
  root.innerHTML = '';

  if (!Array.isArray(list) || list.length === 0) {
    root.innerHTML = '<div class="muted">No orders yet.</div>';
    return;
  }

  list.forEach((o) => {
    const card = el('div', { className: 'card' });
    const header = el('div', {
      innerHTML:
        '<strong>Order #' +
        o._id +
        '</strong> — Table ' +
        o.table +
        ' — <span class="pill">' +
        o.status +
        '</span>' +
        ' <span class="right">Subtotal: ' +
        Intl.NumberFormat().format(o.subtotal || 0) +
        ' đ</span>',
    });
    card.append(header);

    // items
    const itemsTbl = el('table', { className: 'table', style: 'margin-top:8px' });
    const thead = el('thead');
    thead.innerHTML = '<tr><th>Food</th><th>Qty</th><th>Note</th></tr>';
    const tbody = el('tbody');
    (o.items || []).forEach((it) => {
      const name = (it.food && (it.food.name || it.food._id)) || it.food || '';
      const tr = el('tr');
      tr.append(el('td', { textContent: name }), el('td', { textContent: it.quantity }), el('td', { textContent: it.note || '' }));
      tbody.append(tr);
    });
    itemsTbl.append(thead, tbody);
    card.append(itemsTbl);

    // actions: add item, set status
    const actions = el('div', { className: 'row', style: 'margin-top:8px' });

    // add item controls
    const addSel = el('select', { className: 'w-64' });
    const addQty = el('input', { type: 'number', min: 1, value: 1, className: 'w-64' });
    const addBtn = el('button', { className: 'ghost', textContent: 'Add item' });
    const msg = el('span', { id: 'msg-' + o._id, className: 'msg', style: 'display:none' });

    // populate options from global food select
    const globalSelect = $('#foodSelect');
    if (globalSelect) {
      Array.from(globalSelect.options).forEach((op) => {
        addSel.append(el('option', { value: op.value, textContent: op.textContent }));
      });
    }

    addBtn.onclick = async () => {
      try {
        const body = { items: [{ food: addSel.value, quantity: Number(addQty.value) }] };
        await api(`/orders/${o._id}/add-items`, { method: 'PATCH', body: JSON.stringify(body) });
        showMsg(msg, 'Added item ✔');
        await loadOrders();
      } catch (e) {
        showMsg(msg, e.message, false);
      }
    };

    // status controls
    const statusSel = el('select', { className: 'w-64' });
    allowedStatuses.forEach((s) => statusSel.append(el('option', { value: s, textContent: s, selected: o.status === s })));
    const statusBtn = el('button', { className: 'ghost', textContent: 'Update status' });
    statusBtn.onclick = async () => {
      try {
        await api(`/orders/${o._id}/status`, { method: 'PATCH', body: JSON.stringify({ status: statusSel.value }) });
        await loadOrders();
      } catch (e) {
        alert(e.message);
      }
    };

    actions.append(
      el('label', { textContent: 'Add item' }),
      addSel,
      addQty,
      addBtn,
      msg,
      el('span', { innerHTML: '&nbsp;&nbsp;&nbsp;' }),
      el('label', { textContent: 'Status' }),
      statusSel,
      statusBtn
    );
    card.append(actions);
    root.append(card);
  });
}

// --- Event wiring ---
document.getElementById('applyBase').onclick = () => {
  BASE = document.getElementById('baseUrl').value.trim().replace(/\/$/, '');
  localStorage.setItem('BASE_URL', BASE);
  document.getElementById('baseApplied').textContent = 'Applied: ' + BASE;
  loadFoods();
  loadOrders();
};

document.getElementById('refreshAll').onclick = () => {
  loadFoods();
  loadOrders();
};
document.getElementById('refreshOrders').onclick = () => {
  loadOrders();
};

document.getElementById('addToCart').onclick = () => {
  const sel = document.getElementById('foodSelect');
  const qty = Number(document.getElementById('foodQty').value || 1);
  const note = document.getElementById('foodNote').value;
  if (!sel.value) return;
  cart.push({ food: sel.value, foodName: sel.options[sel.selectedIndex].textContent, quantity: qty, note });
  renderCart();
};

document.getElementById('clearCart').onclick = () => {
  cart.length = 0;
  renderCart();
};

document.getElementById('createOrder').onclick = async () => {
  const table = Number(document.getElementById('tableNumber').value || 0);
  const orderMsg = document.getElementById('orderMsg');
  if (!table) {
    showMsg(orderMsg, 'Table is required', false);
    return;
  }
  if (cart.length === 0) {
    showMsg(orderMsg, 'Cart is empty', false);
    return;
  }

  const items = cart.map((c) => ({ food: c.food, quantity: c.quantity, note: c.note }));
  try {
    const res = await api('/orders', { method: 'POST', body: JSON.stringify({ table, items }) });
    showMsg(orderMsg, 'Order created: ' + res._id);
    cart.length = 0;
    renderCart();
    document.getElementById('tableNumber').value = '';
    await loadOrders();
  } catch (e) {
    showMsg(orderMsg, e.message, false);
  }
};

// init
loadFoods().then(loadOrders);
