const ORDER_MENU = window.CAFE_MENU;
if (!Array.isArray(ORDER_MENU)) throw new Error('Shared cafe menu data is unavailable.');

const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(value) || 0);
const tableNumber = new URLSearchParams(window.location.search).get('table');
const normalizedTableNumber = String(tableNumber || '').trim().padStart(2, '0');
let cart = [];
let activeCategory = 'Tất cả';

function bootOrderPage() {
  const table = normalizedTableNumber;
  const isValidTable = /^\d{2}$/.test(table) && Number(table) > 0 && Number(table) <= 99;
  document.getElementById('table-label').textContent = isValidTable ? `Bàn ${table}` : 'Không xác định bàn';
  if (!isValidTable) {
    document.getElementById('invalid-table').hidden = false;
    return;
  }

  document.getElementById('order-app').hidden = false;
  renderCategories();
  renderMenu();
  renderCart();
}

function renderCategories() {
  const categories = ['Tất cả', ...new Set(ORDER_MENU.map(item => item.category))];
  document.getElementById('category-tabs').innerHTML = categories.map(category => `
    <button type="button" class="category-tab ${category === activeCategory ? 'active' : ''}" data-category="${category}">${category}</button>
  `).join('');
  document.querySelectorAll('.category-tab').forEach(button => {
    button.addEventListener('click', () => {
      activeCategory = button.dataset.category;
      renderCategories();
      renderMenu();
    });
  });
}

function renderMenu() {
  const visible = activeCategory === 'Tất cả' ? ORDER_MENU : ORDER_MENU.filter(item => item.category === activeCategory);
  document.getElementById('menu-count').textContent = `${visible.length} món`;
  document.getElementById('order-menu-grid').innerHTML = visible.map(item => `
    <article class="menu-item">
      <img src="${item.image}" alt="${item.name}" loading="lazy" />
      <div>
        <h3>${item.name}</h3>
        <p>${item.description}</p>
        <div class="menu-item-footer">
          <span class="menu-price">${money(item.price)}</span>
          <button type="button" class="add-item" data-add="${item.id}">Thêm món</button>
        </div>
      </div>
    </article>
  `).join('');
  document.querySelectorAll('[data-add]').forEach(button => {
    button.addEventListener('click', () => addToCart(button.dataset.add));
  });
}

function addToCart(itemId) {
  const existing = cart.find(line => line.id === itemId);
  if (existing) existing.quantity += 1;
  else cart.push({ id: itemId, quantity: 1 });
  renderCart();
}

function changeQuantity(itemId, delta) {
  const line = cart.find(item => item.id === itemId);
  if (!line) return;
  line.quantity += delta;
  cart = cart.filter(item => item.quantity > 0);
  renderCart();
}

function renderCart() {
  const cartItems = document.getElementById('cart-items');
  const count = cart.reduce((total, line) => total + line.quantity, 0);
  const total = cart.reduce((sum, line) => {
    const item = ORDER_MENU.find(menuItem => menuItem.id === line.id);
    return sum + (item ? item.price * line.quantity : 0);
  }, 0);
  document.getElementById('cart-count').textContent = count;
  document.getElementById('cart-total').textContent = money(total);
  document.getElementById('submit-order').disabled = cart.length === 0;
  cartItems.innerHTML = cart.length === 0 ? '<p class="empty-cart">Chọn món trong thực đơn để bắt đầu.</p>' : cart.map(line => {
    const item = ORDER_MENU.find(menuItem => menuItem.id === line.id);
    return `<div class="cart-row"><div><div class="cart-row-title">${item.name}</div><div class="cart-row-price">${money(item.price * line.quantity)}</div></div><div class="quantity-control"><button type="button" data-change="${item.id}" data-delta="-1" aria-label="Giảm ${item.name}">-</button><span>${line.quantity}</span><button type="button" data-change="${item.id}" data-delta="1" aria-label="Tăng ${item.name}">+</button></div></div>`;
  }).join('');
  document.querySelectorAll('[data-change]').forEach(button => {
    button.addEventListener('click', () => changeQuantity(button.dataset.change, Number(button.dataset.delta)));
  });
}

async function submitOrder() {
  if (cart.length === 0) return;
  const submitButton = document.getElementById('submit-order');
  submitButton.disabled = true;
  submitButton.textContent = 'Đang gửi đơn...';

  const items = cart.map(line => {
    const item = ORDER_MENU.find(menuItem => menuItem.id === line.id);
    return { id: item.id, name: item.name, price: item.price, quantity: line.quantity };
  });
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const orderId = `ORD-${Date.now().toString().slice(-8)}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const orderNote = document.getElementById('order-note') ? document.getElementById('order-note').value.trim() : '';

  try {
    const firestore = await window.firebaseFirestoreReady;
    if (!firestore || typeof firestore.methods.addDoc !== 'function') {
      throw new Error('Firebase Firestore is not available.');
    }

    const createdAt = new Date().toISOString();
    await firestore.methods.addDoc(firestore.methods.collection(firestore.db, 'orders'), {
      orderId,
      tableNumber: normalizedTableNumber,
      items,
      total,
      note: orderNote,
      status: 'new',
      paymentStatus: 'unpaid',
      createdAt,
      updatedAt: createdAt
    });

    document.getElementById('success-order-id').textContent = orderId;
    submitButton.textContent = 'Đã gửi đơn';
    submitButton.disabled = true;
    document.getElementById('order-success').hidden = false;
    cart = [];
  } catch (error) {
    console.error('[Order Submit Error]', error);
    const message = error.code === 'permission-denied'
      ? 'Firebase chưa cho phép nhận đơn từ QR. Vui lòng nhờ chủ dự án kiểm tra quyền ghi vào Firestore > orders.'
      : 'Chưa gửi được đơn lên Firebase. Vui lòng kiểm tra kết nối và thử lại.';
    alert(message);
    submitButton.disabled = false;
    submitButton.textContent = 'Gửi đơn gọi món';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  bootOrderPage();
  document.getElementById('submit-order').addEventListener('click', submitOrder);
  document.getElementById('new-order').addEventListener('click', () => {
    document.getElementById('order-success').hidden = true;
    document.getElementById('order-app').hidden = false;
    document.getElementById('submit-order').textContent = 'Gửi đơn gọi món';
    document.getElementById('submit-order').disabled = true;
    renderCart();
  });
});
