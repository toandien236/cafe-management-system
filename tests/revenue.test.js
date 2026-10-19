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
