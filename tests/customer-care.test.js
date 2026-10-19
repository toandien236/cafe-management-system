const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadAdminScript(reservations = []) {
  const elements = new Map();
  const firebaseFirestoreMethods = {
    collection(db, collectionName) {
      assert.equal(collectionName, 'reservations');
      return { db, collectionName };
    },
    onSnapshot(collection, onData) {
      onData({
        docs: reservations.map(reservation => ({
          id: reservation.id,
          data: () => reservation
        }))
      });
      return () => {};
    }
  };
  const document = {
    readyState: 'loading',
    addEventListener() {},
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, { innerHTML: '', textContent: '', hidden: true });
      return elements.get(id);
    }
  };
  const context = vm.createContext({
    document,
    window: { firebaseDb: {}, firebaseFirestoreMethods },
    console,
    localStorage: { getItem: () => JSON.stringify(reservations), setItem() {}, removeItem() {} },
    setTimeout,
    setInterval,
    clearInterval,
    clearTimeout,
    confirm: () => true
  });
  const source = fs.readFileSync(path.join(__dirname, '..', 'admin.js'), 'utf8');
  vm.runInContext(source, context, { filename: 'admin.js' });
  return { context, elements };
}

test('customer profiles merge normalized emails and order reservations newest first', () => {
  const { context } = loadAdminScript();
  const profiles = context.buildCustomerProfiles([
    { id: 'older', name: 'Lan', email: 'LAN@example.com', created_at: '2026-01-01T10:00:00Z' },
    { id: 'newer', name: 'Lan Nguyen', email: 'lan@example.com', created_at: '2026-02-01T10:00:00Z' },
    { id: 'phone-a', name: 'Minh', phone: '+84 912-345-678', created_at: '2026-01-03T10:00:00Z' },
    { id: 'phone-b', name: 'Minh', phone: '84912345678', created_at: '2026-01-04T10:00:00Z' }
  ]);

  assert.equal(profiles.length, 2);
  const lan = profiles.find(profile => profile.email === 'LAN@example.com');
  assert.equal(lan.reservations.length, 2);
  assert.equal(lan.latestReservation.id, 'newer');
  const minh = profiles.find(profile => profile.phone === '+84 912-345-678');
  assert.equal(minh.reservations.length, 2);
});

test('reservations without contact details remain separate and history escapes customer content', () => {
  const { context, elements } = loadAdminScript();
  const reservations = [
    { id: 'private-1', name: '<script>alert(1)</script>', notes: '<b>note</b>', created_at: '2026-01-01T10:00:00Z' },
    { id: 'private-2', name: 'Guest', created_at: '2026-01-02T10:00:00Z' }
  ];
  context.reservationsForTest = reservations;
  vm.runInContext('allReservations = reservationsForTest', context);

  const profiles = context.buildCustomerProfiles(reservations);
  assert.equal(profiles.length, 2);
  context.openCustomerHistory('reservation:private-1');
  const content = elements.get('customer-history-content').innerHTML;
  assert.equal(elements.get('customer-history-title').textContent, 'Lịch sử đặt bàn · <script>alert(1)</script>');
  assert.match(content, /&lt;b&gt;note&lt;\/b&gt;/);
  assert.doesNotMatch(content, /<script>|<b>note/);
});

test('customer directory renders counts, supports search, and escapes table values', () => {
  const { context, elements } = loadAdminScript();
  context.reservationsForTest = [
    { id: '1', name: '<img src=x>', email: 'guest@example.com', created_at: '2026-01-01T10:00:00Z', date: '2026-01-01' },
    { id: '2', name: 'Guest', email: 'GUEST@example.com', created_at: '2026-01-02T10:00:00Z', date: '2026-01-02' }
  ];
  vm.runInContext('allReservations = reservationsForTest; customerSearchQuery = ""', context);
  context.renderCustomers();

  assert.equal(elements.get('care-customer-count').textContent, '1');
  assert.equal(elements.get('care-reservation-count').textContent, '2');
  assert.match(elements.get('customers-tbody').innerHTML, /&lt;img src=x&gt;/);
  assert.doesNotMatch(elements.get('customers-tbody').innerHTML, /<img/);

  vm.runInContext('customerSearchQuery = "missing"', context);
  context.renderCustomers();
  assert.match(elements.get('customers-tbody').innerHTML, /Không tìm thấy/);
});

test('loading Firestore reservations populates the customer directory', () => {
  const { context, elements } = loadAdminScript([
    { id: 'reservation-1', name: 'Mai', email: 'mai@example.com', date: '2026-10-19', createdAt: '2026-10-18T09:00:00Z' }
  ]);

  context.loadReservations();

  assert.equal(elements.get('care-customer-count').textContent, '1');
  assert.equal(elements.get('care-reservation-count').textContent, '1');
  assert.match(elements.get('customers-tbody').innerHTML, /mai@example\.com/);
});
