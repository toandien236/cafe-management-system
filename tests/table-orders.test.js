const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadOrderScript(firebaseFirestoreReady, alert) {
  const elements = new Map([
    ['submit-order', { disabled: false, textContent: 'Gửi đơn gọi món' }],
    ['order-note', { value: 'Ít đá' }],
    ['success-order-id', { textContent: '' }],
    ['order-success', { hidden: true }]
  ]);
  const document = {
    addEventListener() {},
    getElementById(id) {
      return elements.get(id);
    }
  };
  const context = vm.createContext({
    document,
    window: { location: { search: '?table=1' }, firebaseFirestoreReady },
    URLSearchParams,
    Intl,
    Date,
    Math,
    console: { error() {} },
    alert
  });
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'order.js'), 'utf8');
  vm.runInContext(source, context, { filename: 'js/order.js' });
  vm.runInContext('cart = [{ id: "espresso", quantity: 2 }]', context);
  return { context, elements };
}

test('table order submission writes a Firebase order with normalized table and VND total', async () => {
  let savedOrder;
  const firebaseFirestoreReady = Promise.resolve({
    db: {},
    methods: {
      collection: (_db, name) => ({ name }),
      addDoc: async (collectionRef, order) => {
        assert.equal(collectionRef.name, 'orders');
        savedOrder = order;
      }
    }
  });
  const { context, elements } = loadOrderScript(firebaseFirestoreReady, () => assert.fail('Unexpected alert'));

  await context.submitOrder();

  assert.match(savedOrder.orderId, /^ORD-/);
  assert.equal(savedOrder.tableNumber, '01');
  assert.equal(savedOrder.total, 70000);
  assert.equal(savedOrder.items[0].price, 35000);
  assert.equal(savedOrder.items[0].quantity, 2);
  assert.equal(savedOrder.note, 'Ít đá');
  assert.equal(savedOrder.status, 'new');
  assert.equal(savedOrder.paymentStatus, 'unpaid');
  assert.ok(savedOrder.createdAt);
  assert.equal(savedOrder.updatedAt, savedOrder.createdAt);
  assert.equal(elements.get('success-order-id').textContent, savedOrder.orderId);
  assert.equal(elements.get('order-success').hidden, false);
});

test('table order submission does not show success when Firebase is unavailable', async () => {
  const messages = [];
  const { context, elements } = loadOrderScript(Promise.resolve(null), message => messages.push(message));

  await context.submitOrder();

  assert.equal(elements.get('order-success').hidden, true);
  assert.equal(elements.get('submit-order').disabled, false);
  assert.equal(elements.get('submit-order').textContent, 'Gửi đơn gọi món');
  assert.match(messages[0], /Firebase/);
});

test('table order submission explains when Firestore rules deny a customer order', async () => {
  const messages = [];
  const firebaseFirestoreReady = Promise.resolve({
    db: {},
    methods: {
      collection: (_db, name) => ({ name }),
      addDoc: async () => {
        throw Object.assign(new Error('Permission denied'), { code: 'permission-denied' });
      }
    }
  });
  const { context, elements } = loadOrderScript(firebaseFirestoreReady, message => messages.push(message));

  await context.submitOrder();

  assert.equal(elements.get('order-success').hidden, true);
  assert.equal(elements.get('submit-order').disabled, false);
  assert.equal(messages[0], 'Firebase chưa cho phép nhận đơn từ QR. Vui lòng nhờ chủ dự án kiểm tra quyền ghi vào Firestore > orders.');
});
