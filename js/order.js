const ORDER_MENU = [
  { id: 'espresso', name: 'Espresso hạt tuyển chọn', category: 'Cà phê', price: 35000, image: 'assets/menu_espresso.jpg', description: 'Hương anh đào đen, cacao và hậu vị caramel.' },
  { id: 'cappuccino', name: 'Cappuccino mịn màng', category: 'Cà phê', price: 45000, image: 'assets/menu_cappuccino.jpg', description: 'Hai shot espresso, sữa béo ngậy và latte art.' },
  { id: 'coldbrew', name: 'Cold brew ủ 18 giờ', category: 'Cà phê', price: 50000, image: 'assets/menu_coldbrew.jpg', description: 'Mượt mà, ngọt dịu tự nhiên cùng cacao đen.' },
  { id: 'matcha', name: 'Matcha latte Uji', category: 'Đồ uống', price: 55000, image: 'assets/menu_matcha.jpg', description: 'Matcha Uji đánh cùng sữa yến mạch thơm lành.' },
  { id: 'mocha', name: 'Mocha đá cacao đậm', category: 'Đồ uống', price: 55000, image: 'assets/menu_icedmocha.jpg', description: 'Espresso, cacao đen, sữa lạnh và kem tươi.' },
  { id: 'croissant', name: 'Croissant bơ ngàn lớp', category: 'Đồ ăn', price: 40000, image: 'assets/menu_croissant.jpg', description: 'Croissant bơ kiểu Pháp, dùng nóng cùng mứt nhà làm.' },
  { id: 'pancake', name: 'Pancake soufflé bông xốp', category: 'Đồ ăn', price: 65000, image: 'assets/menu_pancakes.jpg', description: 'Quả mọng, mascarpone và si-rô lá phong.' },
  { id: 'brioche', name: 'Brioche gà hun khói', category: 'Đồ ăn', price: 75000, image: 'assets/menu_sandwich.jpg', description: 'Gà hun khói, bơ quả, cà chua và aioli nấm truffle.' },
  { id: 'cheesecake', name: 'Cheesecake cháy kiểu Basque', category: 'Tráng miệng', price: 55000, image: 'assets/menu_cheesecake.jpg', description: 'Mặt bánh caramel, ruột mềm mượt và xốt quả mọng.' },
  { id: 'linguine', name: 'Linguine hải sản miền biển', category: 'Đồ ăn', price: 95000, image: 'assets/matteophotopro2020-mussels-5342679_1920.jpg', description: 'Vẹm, tôm, nghêu và sò điệp cùng xốt kem nghệ tây.' },
  { id: 'rose-coldbrew', name: 'Cold brew hoa hồng bạch đậu khấu', category: 'Cà phê', price: 55000, image: 'assets/menu_rosecoldbrew.png', description: 'Ethiopia Yirgacheffe, hoa hồng, bạch đậu khấu và cam.' },
  { id: 'avocado-toast', name: 'Sourdough bơ quả nấm truffle', category: 'Đồ ăn', price: 70000, image: 'assets/menu_avocadotoast.png', description: 'Bơ Hass, trứng chần, rau mầm và nấm truffle.' },
  { id: 'katsu-sando', name: 'Sandwich gà katsu giòn', category: 'Đồ ăn', price: 80000, image: 'assets/menu_katsusando.png', description: 'Gà panko, bắp cải, tonkatsu và mayonnaise Nhật.' },
  { id: 'matcha-opera', name: 'Bánh opera matcha lá vàng', category: 'Tráng miệng', price: 60000, image: 'assets/menu_matchaopera.png', description: 'Hạnh nhân, kem bơ matcha Uji và ganache chocolate.' },
  { id: 'raspberry-tart', name: 'Tart hồ trăn mâm xôi', category: 'Tráng miệng', price: 60000, image: 'assets/menu_raspberrytart.png', description: 'Frangipane hồ trăn, mâm xôi tươi và kem vani.' }
];

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
  const orderId = `ORD-${Date.now().toString().slice(-8)}`;
  const orderNote = document.getElementById('order-note') ? document.getElementById('order-note').value.trim() : '';

  const client = window.supabaseClient || window.supabaseDb || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);

  try {
    if (client && typeof client.from === 'function') {
      const { data, error } = await client.from('orders').insert([{
        order_id: orderId,
        table_number: normalizedTableNumber,
        items: items,
        total: total,
        note: orderNote,
        status: 'new',
        payment_status: 'unpaid'
      }]).select().single();

      if (error) throw error;
    }

    // Save to local backup
    try {
      const localOrders = JSON.parse(localStorage.getItem('mocha_orders') || '[]');
      localOrders.unshift({ order_id: orderId, table_number: normalizedTableNumber, items, total, note: orderNote, status: 'new', payment_status: 'unpaid', created_at: new Date().toISOString() });
      localStorage.setItem('mocha_orders', JSON.stringify(localOrders));
    } catch (e) {}

    document.getElementById('success-order-id').textContent = orderId;
    submitButton.textContent = 'Đã gửi đơn';
    submitButton.disabled = true;
    document.getElementById('order-success').hidden = false;
    cart = [];
  } catch (error) {
    console.error('[Order Submit Error]', error);
    alert('Chưa gửi được đơn. Vui lòng kiểm tra kết nối và thử lại.');
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
