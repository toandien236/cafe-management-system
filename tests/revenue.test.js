const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadAdminScript() {
  const elements = new Map();
  const document = {
    readyState: 'loading',
    addEventListener() {},
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, { textContent: '', innerHTML: '' });
      return elements.get(id);
    }
  };
  const context = vm.createContext({
    document,
    window: {},
    console: { error() {}, warn() {} },
    localStorage: { getItem: () => '[]', setItem() {}, removeItem() {} },
    setTimeout() {},
    setInterval() {},
    clearInterval() {}
  });
  const source = fs.readFileSync(path.join(__dirname, '..', 'admin.js'), 'utf8');
  vm.runInContext(source, context, { filename: 'admin.js' });
  return { context, elements };
}

test('revenue totals only paid orders and groups them by payment date', () => {
  const { context, elements } = loadAdminScript();
  const now = new Date();
  const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15, 12).toISOString();
  context.ordersForTest = [
    {
      id: 'today',
      orderId: 'ORD-TODAY',
      tableNumber: '01',
      total: 70000,
      items: [{ price: 35000 }],
      paymentStatus: 'paid',
      paidAt: { toDate: () => now }
    },
    {
      id: 'last-month',
      order_id: 'ORD-OLD',
      table_number: '02',
      total: 25000,
      payment_status: 'paid',
      paid_at: previousMonth
    },
    { id: 'unpaid', total: 900000, paymentStatus: 'unpaid', paidAt: now.toISOString() },
    { id: 'legacy-paid', total: 40000, paymentStatus: 'paid' }
  ];

  vm.runInContext('allOrders = ordersForTest; renderRevenue()', context);

  const formatVnd = amount => new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0
  }).format(amount);
  assert.equal(elements.get('revenue-today').textContent, formatVnd(70000));
  assert.equal(elements.get('revenue-month').textContent, formatVnd(70000));
  assert.equal(elements.get('revenue-total').textContent, formatVnd(135000));
  assert.match(elements.get('revenue-tbody').innerHTML, /ORD-TODAY · Bàn 01/);
  assert.match(elements.get('revenue-tbody').innerHTML, /ORD-OLD · Bàn 02/);
  assert.doesNotMatch(elements.get('revenue-tbody').innerHTML, /unpaid/);
});

test('Firestore order snapshots refresh revenue totals and payment history', () => {
  const { context, elements } = loadAdminScript();
  const paidAt = new Date();
  const orders = [
    {
      id: 'paid-order',
      orderId: 'ORD-PAID',
      tableNumber: '03',
      total: 125000,
      paymentStatus: 'paid',
      paidAt: paidAt.toISOString()
    },
    {
      id: 'unpaid-order',
      orderId: 'ORD-UNPAID',
      tableNumber: '04',
      total: 80000,
      paymentStatus: 'unpaid'
    }
  ];
  context.window.firebaseDb = {
    collection(name) {
      assert.equal(name, 'orders');
      return {
        onSnapshot(onData) {
          onData({
            forEach(callback) {
              orders.forEach(order => callback({ id: order.id, data: () => order }));
            }
          });
          return () => {};
        }
      };
    }
  };

  vm.runInContext('adminSessionActive = true; loadOrders()', context);

  const expectedRevenue = new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0
  }).format(125000);
  assert.equal(elements.get('revenue-today').textContent, expectedRevenue);
  assert.equal(elements.get('revenue-month').textContent, expectedRevenue);
  assert.equal(elements.get('revenue-total').textContent, expectedRevenue);
  assert.match(elements.get('revenue-tbody').innerHTML, /ORD-PAID · Bàn 03/);
  assert.doesNotMatch(elements.get('revenue-tbody').innerHTML, /ORD-UNPAID/);
});

test('table orders show 15 numbered orders per scrollable page and count active orders', () => {
  const { context, elements } = loadAdminScript();
  context.ordersForTest = Array.from({ length: 32 }, (_, index) => {
    const number = index + 1;
    const status = {
      32: 'new',
      31: 'preparing',
      30: 'in_progress',
      29: 'served',
      28: 'completed',
      27: 'cancelled'
    }[number] || 'completed';
    return {
      id: `order-${number}`,
      orderId: `ORD-${number}`,
      status,
      createdAt: new Date(2026, 0, 1, 0, number).toISOString()
    };
  });
  vm.runInContext('allOrders = ordersForTest; renderOrders()', context);

  const rowsOnPage = () => (elements.get('orders-tbody').innerHTML.match(/<tr>/g) || []).length;
  assert.equal(rowsOnPage(), 15);
  assert.match(elements.get('orders-tbody').innerHTML, /<td>1<\/td>\s*<td><strong>ORD-32<\/strong>/);
  assert.match(elements.get('orders-tbody').innerHTML, /<td>15<\/td>\s*<td><strong>ORD-18<\/strong>/);
  assert.equal(elements.get('orders-summary').textContent, 'Đơn đang xử lý: 3 · Kết quả: 32 / 32 đơn');
  assert.equal(elements.get('orders-page-label').textContent, '1–15 / 32 đơn · Trang 1/3');
  assert.equal(elements.get('orders-previous-page').disabled, true);
  assert.equal(elements.get('orders-next-page').disabled, false);

  context.window.changeOrdersPage(1);
  assert.equal(rowsOnPage(), 15);
  assert.match(elements.get('orders-tbody').innerHTML, /<td>16<\/td>\s*<td><strong>ORD-17<\/strong>/);
  assert.equal(elements.get('orders-page-label').textContent, '16–30 / 32 đơn · Trang 2/3');

  context.window.changeOrdersPage(1);
  assert.equal(rowsOnPage(), 2);
  assert.match(elements.get('orders-tbody').innerHTML, /<td>31<\/td>\s*<td><strong>ORD-2<\/strong>/);
  assert.equal(elements.get('orders-page-label').textContent, '31–32 / 32 đơn · Trang 3/3');
  assert.equal(elements.get('orders-next-page').disabled, true);

  context.window.changeOrdersPage(-1);
  assert.equal(elements.get('orders-page-label').textContent, '16–30 / 32 đơn · Trang 2/3');
});

test('order date range filters by created day and refreshes from Firestore snapshots', () => {
  const { context, elements } = loadAdminScript();
  const orderAtLocalTime = (day, orderId) => ({
    id: orderId,
    orderId,
    status: 'preparing',
    createdAt: new Date(2026, 9, day, 12).toISOString()
  });
  let orders = [
    orderAtLocalTime(19, 'ORD-TODAY-A'),
    orderAtLocalTime(18, 'ORD-YESTERDAY'),
    orderAtLocalTime(19, 'ORD-TODAY-B')
  ];
  let snapshotCallback;
  context.window.firebaseDb = {
    collection(name) {
      assert.equal(name, 'orders');
      return {
        onSnapshot(onData) {
          snapshotCallback = onData;
          onData({
            forEach(callback) {
              orders.forEach(order => callback({ id: order.id, data: () => order }));
            }
          });
          return () => {};
        }
      };
    }
  };
  vm.runInContext('adminSessionActive = true; loadOrders()', context);
  elements.get('orders-date-from').value = '2026-10-19';
  elements.get('orders-date-to').value = '2026-10-19';
  context.window.applyOrdersDateFilter();

  assert.equal((elements.get('orders-tbody').innerHTML.match(/<tr>/g) || []).length, 2);
  assert.match(elements.get('orders-tbody').innerHTML, /ORD-TODAY-A/);
  assert.match(elements.get('orders-tbody').innerHTML, /ORD-TODAY-B/);
  assert.doesNotMatch(elements.get('orders-tbody').innerHTML, /ORD-YESTERDAY/);
  assert.equal(elements.get('orders-summary').textContent, 'Đơn đang xử lý: 2 · Kết quả: 2 / 3 đơn');
  assert.equal(elements.get('orders-filter-period').textContent, 'Khoảng ngày: 19/10/2026 – 19/10/2026');

  orders = [...orders, orderAtLocalTime(19, 'ORD-TODAY-C')];
  snapshotCallback({
    forEach(callback) {
      orders.forEach(order => callback({ id: order.id, data: () => order }));
    }
  });
  assert.equal((elements.get('orders-tbody').innerHTML.match(/<tr>/g) || []).length, 3);
  assert.equal(elements.get('orders-summary').textContent, 'Đơn đang xử lý: 3 · Kết quả: 3 / 4 đơn');

  context.window.setOrdersDatePreset('all');
  assert.equal(elements.get('orders-date-from').value, '');
  assert.equal(elements.get('orders-date-to').value, '');
  assert.equal((elements.get('orders-tbody').innerHTML.match(/<tr>/g) || []).length, 4);
});

test('order date presets select today, month, and year boundaries', () => {
  const { context, elements } = loadAdminScript();
  const now = new Date();
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('-');

  context.window.setOrdersDatePreset('today');
  assert.equal(elements.get('orders-date-from').value, today);
  assert.equal(elements.get('orders-date-to').value, today);

  context.window.setOrdersDatePreset('this-month');
  assert.equal(elements.get('orders-date-from').value, `${today.slice(0, 7)}-01`);
  assert.equal(elements.get('orders-date-to').value, `${today.slice(0, 7)}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`);

  context.window.setOrdersDatePreset('this-year');
  assert.equal(elements.get('orders-date-from').value, `${now.getFullYear()}-01-01`);
  assert.equal(elements.get('orders-date-to').value, `${now.getFullYear()}-12-31`);
});
