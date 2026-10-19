const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadAdminScript(reservations = [], snapshotError = null) {
  const elements = new Map();
  const firebaseDb = {
    collection(collectionName) {
      assert.equal(collectionName, 'reservations');
      return {
        onSnapshot(onData, onError) {
          if (snapshotError) {
            onError(snapshotError);
          } else {
            onData({
              forEach(callback) {
                reservations.forEach(reservation => callback({
                  id: reservation.id,
                  data: () => reservation
                }));
              }
            });
          }
          return () => {};
        }
      };
    }
  };
  const document = {
    readyState: 'loading',
    addEventListener() {},
    getElementById(id) {
      if (!elements.has(id)) {
        elements.set(id, {
          innerHTML: '',
          textContent: '',
          hidden: true,
          classList: { toggle() {} },
          addEventListener() {},
          appendChild() {}
        });
      }
      return elements.get(id);
    },
    createElement() {
      return { style: {}, remove() {} };
    }
  };
  const context = vm.createContext({
    document,
    window: { firebaseDb },
    console: { ...console, warn() {} },
    localStorage: { getItem: () => JSON.stringify(reservations), setItem() {}, removeItem() {} },
    setTimeout: () => 0,
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
  context.reservationsForTest = [
    { id: 'older', name: 'Lan', email: 'LAN@example.com', created_at: '2026-01-01T10:00:00Z' },
    { id: 'newer', name: 'Lan Nguyen', email: 'lan@example.com', created_at: '2026-02-01T10:00:00Z' },
    { id: 'phone-a', name: 'Minh', phone: '+84 912-345-678', created_at: '2026-01-03T10:00:00Z' },
    { id: 'phone-b', name: 'Minh', phone: '84912345678', created_at: '2026-01-04T10:00:00Z' }
  ];
  vm.runInContext('allReservations = reservationsForTest', context);
  const profiles = context.buildCustomerProfiles();

  assert.equal(profiles.length, 2);
  const lan = profiles.find(profile => profile.emails[0] === 'lan@example.com');
  assert.equal(lan.reservations.length, 2);
  assert.equal(lan.latestReservation.id, 'newer');
  const minh = profiles.find(profile => profile.phones.length > 0);
  assert.equal(minh.reservations.length, 2);
});

test('reservations without contact details remain separate and profile history escapes customer content', () => {
  const { context, elements } = loadAdminScript();
  const reservations = [
    { id: 'private-1', name: '<script>alert(1)</script>', notes: '<b>note</b>', created_at: '2026-01-01T10:00:00Z' },
    { id: 'private-2', name: 'Guest', created_at: '2026-01-02T10:00:00Z' }
  ];
  context.reservationsForTest = reservations;
  vm.runInContext('allReservations = reservationsForTest', context);

  const profiles = context.buildCustomerProfiles();
  assert.equal(profiles.length, 2);
  context.openCustomerProfile('reservation:private-1');
  const content = elements.get('customer-profile-body').innerHTML;
  assert.equal(elements.get('customer-profile-title').textContent, '<script>alert(1)</script>');
  assert.match(content, /&lt;b&gt;note&lt;\/b&gt;/);
  assert.doesNotMatch(content, /<script>|<b>note/);
  assert.equal(elements.get('customer-profile-modal').hidden, false);
});

test('customer directory renders counts, supports search, and escapes table values', () => {
  const { context, elements } = loadAdminScript();
  context.reservationsForTest = [
    { id: '1', name: 'Guest', email: 'guest@example.com', created_at: '2026-01-02T10:00:00Z', date: '2026-01-02' },
    { id: '2', name: '<img src=x>', email: 'GUEST@example.com', created_at: '2026-01-03T10:00:00Z', date: '2026-01-03' }
  ];
  vm.runInContext('allReservations = reservationsForTest; reservationLoadState = "ready"; customerSearchQuery = ""', context);
  context.renderCustomers();

  assert.equal(elements.get('care-customer-count').textContent, '1');
  assert.equal(elements.get('care-reservation-count').textContent, '2');
  assert.equal(elements.get('care-last-reservation').textContent, '2026-01-03');
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

  vm.runInContext('adminSessionActive = true', context);
  context.loadReservations();

  assert.equal(elements.get('care-customer-count').textContent, '1');
  assert.equal(elements.get('care-reservation-count').textContent, '1');
  assert.match(elements.get('customers-tbody').innerHTML, /mai@example\.com/);
  assert.equal(elements.get('customer-load-notice').hidden, true);
});

test('Firestore reservation errors are visible in the customer directory', () => {
  const { context, elements } = loadAdminScript([], new Error('permission denied'));
  vm.runInContext('adminSessionActive = true', context);

  context.loadReservations();

  assert.equal(elements.get('customer-load-notice').hidden, false);
  assert.match(elements.get('customer-load-notice').textContent, /Không tải được đặt bàn từ Firestore/);
});
