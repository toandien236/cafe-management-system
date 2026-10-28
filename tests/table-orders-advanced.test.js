const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const {
  validateAndCalculateOrder,
  createVerifiedOrder,
  normalizeTableNumber
} = require('../functions/services/orderService');

/* ──────────────────────────────────────────────────────────
   ORD-05: SERVER-SIDE ORDER VERIFICATION TESTS
   ────────────────────────────────────────────────────────── */
test('ORD-05: Server verifies order items and recalculates total against official menu data', () => {
  const input = {
    tableNumber: '1',
    items: [
      { id: 'espresso', quantity: 2, price: 1000 }, // Client attempts to tamper price to 1000 VND
      { id: 'croissant', quantity: 1, price: 5000 }  // Client attempts to tamper price to 5000 VND
    ],
    note: 'Ít đường',
    requestId: 'a1b2c3d4-e5f6-4a1b-8c2d-123456789abc'
  };

  const verified = validateAndCalculateOrder(input);

  assert.equal(verified.tableNumber, '01');
  assert.equal(verified.items.length, 2);
  // Official price of espresso is 35,000 VND, croissant is 40,000 VND
  assert.equal(verified.items[0].price, 35000);
  assert.equal(verified.items[1].price, 40000);
  // Verified total: 35000 * 2 + 40000 * 1 = 110,000 VND
  assert.equal(verified.total, 110000);
  assert.equal(verified.note, 'Ít đường');
  assert.equal(verified.requestId, 'a1b2c3d4-e5f6-4a1b-8c2d-123456789abc');
  assert.ok(verified.payloadHash);
});

test('ORD-05: Server rejects order with invalid item ID or invalid quantity', () => {
  assert.throws(() => {
    validateAndCalculateOrder({
      tableNumber: '02',
      items: [{ id: 'non-existent-drink', quantity: 1 }]
    });
  }, /không tồn tại trong thực đơn/);

  assert.throws(() => {
    validateAndCalculateOrder({
      tableNumber: '02',
      items: [{ id: 'espresso', quantity: -1 }]
    });
  }, /phải là số nguyên từ 1 đến 50/);

  assert.throws(() => {
    validateAndCalculateOrder({
      tableNumber: '999',
      items: [{ id: 'espresso', quantity: 1 }]
    });
  }, /Số bàn không hợp lệ/);
});

/* ──────────────────────────────────────────────────────────
   ORD-06: IDEMPOTENCY TESTS (SERVER & CLIENT)
   ────────────────────────────────────────────────────────── */
test('ORD-06: Server createVerifiedOrder returns existing order without creating duplicate when requestId matches', async () => {
  const existingOrders = [];
  const mockDb = {
    collection: (name) => {
      assert.equal(name, 'orders');
      return {
        where: (field, op, value) => {
          assert.equal(field, 'requestId');
          assert.equal(op, '==');
          return {
            limit: () => ({
              get: async () => {
                const found = existingOrders.filter(o => o.requestId === value);
                return {
                  empty: found.length === 0,
                  docs: found.map(doc => ({ id: doc.id, data: () => doc }))
                };
              }
            })
          };
        },
        add: async (docData) => {
          const doc = { id: `doc-${Date.now()}`, ...docData };
          existingOrders.push(doc);
          return { id: doc.id };
        }
      };
    }
  };

  const orderPayload = {
    tableNumber: '05',
    items: [{ id: 'cappuccino', quantity: 1 }],
    requestId: 'b1c2d3e4-f5a6-4b7c-8d9e-123456789def'
  };

  // First submission
  const firstResult = await createVerifiedOrder(mockDb, orderPayload);
  assert.equal(firstResult.isDuplicate, false);
  assert.equal(firstResult.total, 45000);
  assert.equal(existingOrders.length, 1);

  // Duplicate retry with same requestId
  const secondResult = await createVerifiedOrder(mockDb, orderPayload);
  assert.equal(secondResult.isDuplicate, true);
  assert.equal(secondResult.orderId, firstResult.orderId);
  assert.equal(existingOrders.length, 1); // No second order created
});

/* ──────────────────────────────────────────────────────────
   ORD-07: CLIENT STATUS TRACKER & PROGRESS TESTS
   ────────────────────────────────────────────────────────── */
function createMockClassList() {
  const set = new Set();
  return {
    add(...classes) { classes.forEach(c => set.add(c)); },
    remove(...classes) { classes.forEach(c => set.delete(c)); },
    toggle(c, force) {
      if (force === undefined) {
        set.has(c) ? set.delete(c) : set.add(c);
      } else if (force) {
        set.add(c);
      } else {
        set.delete(c);
      }
    },
    contains(c) { return set.has(c); }
  };
}

function createOrderDOMContext({ table = '03', existingActiveOrder = null } = {}) {
  const elements = new Map([
    ['table-label', { textContent: '' }],
    ['invalid-table', { hidden: true }],
    ['order-app', { hidden: true }],
    ['category-tabs', { innerHTML: '' }],
    ['order-menu-grid', { innerHTML: '' }],
    ['menu-count', { textContent: '' }],
    ['cart-items', { innerHTML: '' }],
    ['cart-count', { textContent: '' }],
    ['cart-total', { textContent: '' }],
    ['submit-order', { disabled: false, textContent: 'Gửi đơn gọi món', addEventListener() {} }],
    ['order-note', { value: 'Nhiều đá' }],
    ['order-success', { hidden: true }],
    ['order-status-heading', { textContent: '' }],
    ['order-status-desc', { textContent: '' }],
    ['order-status-icon', { textContent: '' }],
    ['tracker-live-text', { textContent: '' }],
    ['order-table-display', { textContent: '' }],
    ['success-order-id', { textContent: '' }],
    ['order-summary-total', { textContent: '' }],
    ['order-summary-items', { innerHTML: '' }],
    ['step-new', { classList: createMockClassList() }],
    ['step-preparing', { classList: createMockClassList() }],
    ['step-served', { classList: createMockClassList() }],
    ['step-completed', { classList: createMockClassList() }],
    ['line-1', { classList: createMockClassList() }],
    ['line-2', { classList: createMockClassList() }],
    ['line-3', { classList: createMockClassList() }],
    ['new-order', { addEventListener() {} }]
  ]);

  const sessionStore = new Map();
  if (existingActiveOrder) {
    sessionStore.set('mocha_active_order', JSON.stringify(existingActiveOrder));
  }

  const document = {
    addEventListener() {},
    getElementById: id => elements.get(id),
    querySelectorAll: () => []
  };

  const context = vm.createContext({
    document,
    window: {
      location: { search: `?table=${table}` },
      sessionStorage: {
        getItem: k => sessionStore.get(k) || null,
        setItem: (k, v) => sessionStore.set(k, String(v)),
        removeItem: k => sessionStore.delete(k)
      }
    },
    sessionStorage: {
      getItem: k => sessionStore.get(k) || null,
      setItem: (k, v) => sessionStore.set(k, String(v)),
      removeItem: k => sessionStore.delete(k)
    },
    URLSearchParams,
    Intl,
    Date,
    Math,
    console: { error() {}, warn() {} },
    alert: () => {}
  });

  const menuSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'menu-data.js'), 'utf8');
  const orderSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'order.js'), 'utf8');
  vm.runInContext(menuSource, context, { filename: 'js/menu-data.js' });
  vm.runInContext(orderSource, context, { filename: 'js/order.js' });

  return { context, elements, sessionStore };
}

test('ORD-07: Tracker updates visual steps and messages as order transitions from new -> preparing -> served -> completed', () => {
  const { context, elements } = createOrderDOMContext({ table: '05' });

  const testOrder = {
    orderId: 'ORD-12345678-TEST',
    tableNumber: '05',
    status: 'new',
    items: [{ id: 'espresso', name: 'Espresso hạt tuyển chọn', price: 35000, quantity: 2 }],
    total: 70000
  };

  // 1. Initial status: 'new'
  context.renderOrderStatusTracker(testOrder);
  assert.equal(elements.get('order-status-heading').textContent, 'Nhân viên đang tiếp nhận món');
  assert.ok(elements.get('step-new').classList.contains('active'));
  assert.ok(!elements.get('step-preparing').classList.contains('active'));

  // 2. Status changes to 'preparing' (Barista is making the drinks)
  testOrder.status = 'preparing';
  context.renderOrderStatusTracker(testOrder);
  assert.equal(elements.get('order-status-heading').textContent, 'Barista đang pha chế món');
  assert.ok(elements.get('step-new').classList.contains('completed'));
  assert.ok(elements.get('step-preparing').classList.contains('active'));
  assert.ok(elements.get('line-1').classList.contains('completed'));

  // 3. Status changes to 'served' (Food/drinks brought to table)
  testOrder.status = 'served';
  context.renderOrderStatusTracker(testOrder);
  assert.equal(elements.get('order-status-heading').textContent, 'Món đã được mang ra bàn');
  assert.ok(elements.get('step-preparing').classList.contains('completed'));
  assert.ok(elements.get('step-served').classList.contains('active'));
  assert.ok(elements.get('line-2').classList.contains('completed'));

  // 4. Status changes to 'completed' (Paid)
  testOrder.status = 'completed';
  context.renderOrderStatusTracker(testOrder);
  assert.equal(elements.get('order-status-heading').textContent, 'Đơn hàng đã hoàn tất');
  assert.ok(elements.get('step-completed').classList.contains('active'));
  assert.ok(elements.get('line-3').classList.contains('completed'));
});

test('ORD-07: Restores active order tracking screen when customer refreshes the page', () => {
  const savedOrder = {
    orderId: 'ORD-88889999-RELOAD',
    tableNumber: '07',
    status: 'preparing',
    items: [{ id: 'matcha', name: 'Matcha latte Uji', price: 55000, quantity: 1 }],
    total: 55000
  };

  const { context, elements } = createOrderDOMContext({ table: '07', existingActiveOrder: savedOrder });

  context.restoreActiveOrderTracking();

  assert.equal(elements.get('order-success').hidden, false);
  assert.equal(elements.get('success-order-id').textContent, 'ORD-88889999-RELOAD');
  assert.equal(elements.get('order-status-heading').textContent, 'Barista đang pha chế món');
});
