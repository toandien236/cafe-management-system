const ORDER_MENU = window.CAFE_MENU;
if (!Array.isArray(ORDER_MENU)) throw new Error('Shared cafe menu data is unavailable.');

const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(value) || 0);
const tableNumber = new URLSearchParams(window.location.search).get('table');
const normalizedTableNumber = String(tableNumber || '').trim().padStart(2, '0');
let cart = [];
let activeCategory = 'Tất cả';
let isSubmittingOrder = false;

/* ──────────────────────────────────────────────────────────
   SAFE STORAGE HELPER (Idempotency & Tracking State)
   ────────────────────────────────────────────────────────── */
const memoryStorage = new Map();
const safeStorage = {
  getItem(key) {
    try {
      if (typeof sessionStorage !== 'undefined' && sessionStorage) return sessionStorage.getItem(key);
    } catch (e) {}
    return memoryStorage.get(key) || null;
  },
  setItem(key, value) {
    try {
      if (typeof sessionStorage !== 'undefined' && sessionStorage) {
        sessionStorage.setItem(key, value);
        return;
      }
    } catch (e) {}
    memoryStorage.set(key, String(value));
  },
  removeItem(key) {
    try {
      if (typeof sessionStorage !== 'undefined' && sessionStorage) {
        sessionStorage.removeItem(key);
        return;
      }
    } catch (e) {}
    memoryStorage.delete(key);
  }
};

function generateUuidV4() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function computeCartHash(table, items, note) {
  const normalized = (items || []).map(i => `${i.id}:${i.quantity}`).sort().join(';');
  return `${table}#${normalized}#${note}`;
}

/* ──────────────────────────────────────────────────────────
   PAGE INITIALIZATION
   ────────────────────────────────────────────────────────── */
function bootOrderPage() {
  const table = normalizedTableNumber;
  const isValidTable = /^\d{2}$/.test(table) && Number(table) > 0 && Number(table) <= 99;
  const tableLabelEl = document.getElementById('table-label');
  if (tableLabelEl) tableLabelEl.textContent = isValidTable ? `Bàn ${table}` : 'Không xác định bàn';

  if (!isValidTable) {
    const invalidTableEl = document.getElementById('invalid-table');
    if (invalidTableEl) invalidTableEl.hidden = false;
    return;
  }

  const appEl = document.getElementById('order-app');
  if (appEl) appEl.hidden = false;

  renderCategories();
  renderMenu();
  renderCart();

  // Restore active order status tracker if page is refreshed
  restoreActiveOrderTracking();
}

function renderCategories() {
  const container = document.getElementById('category-tabs');
  if (!container) return;
  const categories = ['Tất cả', ...new Set(ORDER_MENU.map(item => item.category))];
  container.innerHTML = categories.map(category => `
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
  const countEl = document.getElementById('menu-count');
  const gridEl = document.getElementById('order-menu-grid');
  if (!gridEl) return;

  const visible = activeCategory === 'Tất cả' ? ORDER_MENU : ORDER_MENU.filter(item => item.category === activeCategory);
  if (countEl) countEl.textContent = `${visible.length} món`;

  gridEl.innerHTML = visible.map(item => `
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

  const cartCountEl = document.getElementById('cart-count');
  const cartTotalEl = document.getElementById('cart-total');
  const submitButton = document.getElementById('submit-order');

  if (cartCountEl) cartCountEl.textContent = count;
  if (cartTotalEl) cartTotalEl.textContent = money(total);
  if (submitButton) submitButton.disabled = cart.length === 0;

  if (cartItems) {
    cartItems.innerHTML = cart.length === 0 ? '<p class="empty-cart">Chọn món trong thực đơn để bắt đầu.</p>' : cart.map(line => {
      const item = ORDER_MENU.find(menuItem => menuItem.id === line.id);
      return `<div class="cart-row"><div><div class="cart-row-title">${item.name}</div><div class="cart-row-price">${money(item.price * line.quantity)}</div></div><div class="quantity-control"><button type="button" data-change="${item.id}" data-delta="-1" aria-label="Giảm ${item.name}">-</button><span>${line.quantity}</span><button type="button" data-change="${item.id}" data-delta="1" aria-label="Tăng ${item.name}">+</button></div></div>`;
    }).join('');
    document.querySelectorAll('[data-change]').forEach(button => {
      button.addEventListener('click', () => changeQuantity(button.dataset.change, Number(button.dataset.delta)));
    });
  }
}

/* ──────────────────────────────────────────────────────────
   ORDER SUBMISSION WITH IDEMPOTENCY (ORD-04 & ORD-06)
   ────────────────────────────────────────────────────────── */
async function submitOrder() {
  if (isSubmittingOrder) return;
  if (cart.length === 0) return;

  const submitButton = document.getElementById('submit-order');
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = 'Đang gửi đơn...';
  }
  isSubmittingOrder = true;

  const items = cart.map(line => {
    const item = ORDER_MENU.find(menuItem => menuItem.id === line.id);
    return { id: item.id, name: item.name, price: item.price, quantity: line.quantity };
  });
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const orderNote = document.getElementById('order-note') ? document.getElementById('order-note').value.trim() : '';

  // ORD-06 Idempotency: reuse requestId if retrying same cart submission
  const cartFingerprint = computeCartHash(normalizedTableNumber, items, orderNote);
  const storedHash = safeStorage.getItem('mocha_order_request_hash');
  let requestId = safeStorage.getItem('mocha_order_request_id');
  let orderId = safeStorage.getItem('mocha_order_id');

  if (!requestId || storedHash !== cartFingerprint || !orderId) {
    requestId = generateUuidV4();
    orderId = `ORD-${Date.now().toString().slice(-8)}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    safeStorage.setItem('mocha_order_request_id', requestId);
    safeStorage.setItem('mocha_order_request_hash', cartFingerprint);
    safeStorage.setItem('mocha_order_id', orderId);
  }

  try {
    const firestore = await window.firebaseFirestoreReady;
    if (!firestore || typeof firestore.methods?.addDoc !== 'function') {
      throw new Error('Firebase Firestore is not available.');
    }

    const createdAt = new Date().toISOString();
    const orderDoc = {
      orderId,
      requestId,
      tableNumber: normalizedTableNumber,
      items,
      total,
      note: orderNote,
      status: 'new',
      paymentStatus: 'unpaid',
      createdAt,
      updatedAt: createdAt
    };

    const docRef = await firestore.methods.addDoc(
      firestore.methods.collection(firestore.db, 'orders'),
      orderDoc
    );

    const docId = docRef?.id || orderId;

    // Clear pending idempotency keys after successful write
    safeStorage.removeItem('mocha_order_request_id');
    safeStorage.removeItem('mocha_order_request_hash');
    safeStorage.removeItem('mocha_order_id');

    // Save active order for live status tracking
    const orderRecord = { ...orderDoc, docId };
    safeStorage.setItem('mocha_active_order', JSON.stringify(orderRecord));

    const successOrderIdEl = document.getElementById('success-order-id');
    if (successOrderIdEl) successOrderIdEl.textContent = orderId;

    if (submitButton) {
      submitButton.textContent = 'Đã gửi đơn';
      submitButton.disabled = true;
    }

    const orderSuccessEl = document.getElementById('order-success');
    if (orderSuccessEl) orderSuccessEl.hidden = false;

    renderOrderStatusTracker(orderRecord);
    listenToOrderUpdates(docId, orderId, firestore);

    cart = [];
  } catch (error) {
    console.error('[Order Submit Error]', error);
    const message = error.code === 'permission-denied'
      ? 'Firebase chưa cho phép nhận đơn từ QR. Vui lòng nhờ chủ dự án kiểm tra quyền ghi vào Firestore > orders.'
      : 'Chưa gửi được đơn lên Firebase. Vui lòng kiểm tra kết nối và thử lại.';
    alert(message);
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = 'Gửi đơn gọi món';
    }
  } finally {
    isSubmittingOrder = false;
  }
}

/* ──────────────────────────────────────────────────────────
   ORDER STATUS TRACKER & PROGRESS (ORD-07)
   ────────────────────────────────────────────────────────── */
const STATUS_CONFIG = {
  new: {
    step: 1,
    heading: 'Nhân viên đang tiếp nhận món',
    desc: 'Đơn món của bạn đã chuyển tới quầy bar/bếp và đang được xếp hàng chuẩn bị.',
    icon: '🕒',
    liveText: 'Đang tiếp nhận đơn...'
  },
  preparing: {
    step: 2,
    heading: 'Barista đang pha chế món',
    desc: 'Đội ngũ quầy bar & bếp đang chuẩn bị những món đồ uống và món ăn tươi ngon cho bàn của bạn.',
    icon: '☕',
    liveText: 'Đang pha chế trực tiếp...'
  },
  in_progress: {
    step: 2,
    heading: 'Barista đang pha chế món',
    desc: 'Đội ngũ quầy bar & bếp đang chuẩn bị những món đồ uống và món ăn tươi ngon cho bàn của bạn.',
    icon: '☕',
    liveText: 'Đang pha chế trực tiếp...'
  },
  served: {
    step: 3,
    heading: 'Món đã được mang ra bàn',
    desc: 'Nhân viên đã phục vụ món tới bàn của quý khách. Chúc bạn có thời gian thư giãn ngon miệng!',
    icon: '✨',
    liveText: 'Đã phục vụ tại bàn'
  },
  completed: {
    step: 4,
    heading: 'Đơn hàng đã hoàn tất',
    desc: 'Cảm ơn quý khách đã ghé thăm Mocha & Miso! Hẹn gặp lại bạn lần sau.',
    icon: '✓',
    liveText: 'Đơn hàng hoàn tất'
  },
  cancelled: {
    step: 0,
    heading: 'Đơn hàng đã bị hủy',
    desc: 'Đơn hàng đã được hủy bởi quán. Vui lòng liên hệ nhân viên để được hỗ trợ.',
    icon: '✕',
    liveText: 'Đã hủy'
  }
};

function renderOrderStatusTracker(order) {
  if (!order) return;
  const rawStatus = String(order.status || 'new').toLowerCase();
  const cfg = STATUS_CONFIG[rawStatus] || STATUS_CONFIG.new;

  const headingEl = document.getElementById('order-status-heading');
  if (headingEl) headingEl.textContent = cfg.heading;

  const descEl = document.getElementById('order-status-desc');
  if (descEl) descEl.textContent = cfg.desc;

  const iconEl = document.getElementById('order-status-icon');
  if (iconEl) iconEl.textContent = cfg.icon;

  const liveTextEl = document.getElementById('tracker-live-text');
  if (liveTextEl) liveTextEl.textContent = cfg.liveText;

  const tableDisp = document.getElementById('order-table-display');
  if (tableDisp) tableDisp.textContent = order.tableNumber || normalizedTableNumber || '--';

  const orderIdDisp = document.getElementById('success-order-id');
  if (orderIdDisp) orderIdDisp.textContent = order.orderId || '';

  const totalDisp = document.getElementById('order-summary-total');
  if (totalDisp) totalDisp.textContent = money(order.total || 0);

  const itemsContainer = document.getElementById('order-summary-items');
  if (itemsContainer && Array.isArray(order.items)) {
    itemsContainer.innerHTML = order.items.map(i => `
      <div class="order-item-row">
        <span>${i.name} <strong>×${i.quantity}</strong></span>
        <span>${money((i.price || 0) * i.quantity)}</span>
      </div>
    `).join('');
  }

  // Update visual stepper steps & connector lines
  const steps = ['new', 'preparing', 'served', 'completed'];
  const stepNumber = cfg.step;

  steps.forEach((st, idx) => {
    const stepEl = document.getElementById(`step-${st}`);
    const lineEl = document.getElementById(`line-${idx + 1}`);

    if (stepEl && stepEl.classList) {
      if (typeof stepEl.classList.remove === 'function') {
        stepEl.classList.remove('active', 'completed');
      }
      if (idx + 1 < stepNumber) {
        if (typeof stepEl.classList.add === 'function') stepEl.classList.add('completed');
      } else if (idx + 1 === stepNumber) {
        if (typeof stepEl.classList.add === 'function') stepEl.classList.add('active');
      }
    }

    if (lineEl && lineEl.classList && typeof lineEl.classList.toggle === 'function') {
      lineEl.classList.toggle('completed', idx + 1 < stepNumber);
    }
  });
}

function listenToOrderUpdates(docId, orderId, firestore) {
  if (!firestore || !docId) return;
  const methods = firestore.methods || {};
  if (typeof methods.doc !== 'function' || typeof methods.onSnapshot !== 'function') return;

  try {
    const docRef = methods.doc(firestore.db, 'orders', docId);
    methods.onSnapshot(docRef, snapshot => {
      if (snapshot && typeof snapshot.data === 'function') {
        const data = snapshot.data();
        if (data) {
          data.docId = docId;
          safeStorage.setItem('mocha_active_order', JSON.stringify(data));
          renderOrderStatusTracker(data);
        }
      }
    }, error => {
      console.warn('[Order Status Listener Warning]', error);
    });
  } catch (err) {
    console.warn('[Order Status Setup Error]', err);
  }
}

function restoreActiveOrderTracking() {
  const activeOrderRaw = safeStorage.getItem('mocha_active_order');
  if (!activeOrderRaw) return;

  try {
    const activeOrder = JSON.parse(activeOrderRaw);
    if (activeOrder && activeOrder.orderId && activeOrder.tableNumber === normalizedTableNumber) {
      const orderSuccessEl = document.getElementById('order-success');
      if (orderSuccessEl) orderSuccessEl.hidden = false;

      renderOrderStatusTracker(activeOrder);

      // Reconnect Firestore real-time listener if available
      window.firebaseFirestoreReady?.then(firestore => {
        if (firestore && activeOrder.docId) {
          listenToOrderUpdates(activeOrder.docId, activeOrder.orderId, firestore);
        }
      });
    }
  } catch (e) {}
}

document.addEventListener('DOMContentLoaded', () => {
  bootOrderPage();
  const submitBtn = document.getElementById('submit-order');
  if (submitBtn) submitBtn.addEventListener('click', submitOrder);

  const newOrderBtn = document.getElementById('new-order');
  if (newOrderBtn) {
    newOrderBtn.addEventListener('click', () => {
      const successEl = document.getElementById('order-success');
      if (successEl) successEl.hidden = true;

      const appEl = document.getElementById('order-app');
      if (appEl) appEl.hidden = false;

      const submit = document.getElementById('submit-order');
      if (submit) {
        submit.textContent = 'Gửi đơn gọi món';
        submit.disabled = true;
      }
      renderCart();
    });
  }
});
