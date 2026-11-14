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

test('customer directory provides a scrollable table and page controls', () => {
  const adminHtml = fs.readFileSync(path.join(__dirname, '..', 'admin.html'), 'utf8');

  assert.match(adminHtml, /style\.css\?v=customer-history-scroll-20261114/);
  assert.match(adminHtml, /class="customer-care-list-scroll"/);
  assert.match(adminHtml, /id="customer-pagination"/);
  assert.match(adminHtml, /onclick="changeCustomersPage\(-1\)"/);
  assert.match(adminHtml, /onclick="changeCustomersPage\(1\)"/);
});

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
  assert.equal(elements.get('customer-summary').textContent, 'Hồ sơ khách: 1–1 / 1');
  assert.equal(elements.get('care-reservation-count').textContent, '2');
  assert.equal(elements.get('care-last-reservation').textContent, '2026-01-03');
  assert.match(elements.get('customers-tbody').innerHTML, /&lt;img src=x&gt;/);
  assert.doesNotMatch(elements.get('customers-tbody').innerHTML, /<img/);

  vm.runInContext('customerSearchQuery = "missing"', context);
  context.renderCustomers();
  assert.match(elements.get('customers-tbody').innerHTML, /Không tìm thấy/);
});

test('customer directory paginates 15 profiles and keeps the visit count column aligned', () => {
  const { context, elements } = loadAdminScript();
  context.reservationsForTest = Array.from({ length: 32 }, (_, index) => ({
    id: `reservation-${index + 1}`,
    name: `Guest ${index + 1}`,
    email: `guest-${index + 1}@example.com`,
    created_at: new Date(2026, 0, index + 1).toISOString(),
    date: `2026-01-${String(index + 1).padStart(2, '0')}`
  }));
  vm.runInContext('allReservations = reservationsForTest; reservationLoadState = "ready"; customerSearchQuery = ""', context);
  context.renderCustomers();

  const rowsOnPage = () => (elements.get('customers-tbody').innerHTML.match(/<tr>/g) || []).length;
  assert.equal(rowsOnPage(), 15);
  assert.equal(elements.get('customer-page-label').textContent, '1–15 / 32 khách · Trang 1/3');
  assert.equal(elements.get('customer-previous-page').disabled, true);
  assert.equal(elements.get('customer-next-page').disabled, false);
  assert.match(elements.get('customers-tbody').innerHTML, /<td>0<\/td>\s*<td>2026-01-/);

  context.window.changeCustomersPage(1);
  assert.equal(rowsOnPage(), 15);
  assert.equal(elements.get('customer-page-label').textContent, '16–30 / 32 khách · Trang 2/3');

  context.window.changeCustomersPage(1);
  assert.equal(rowsOnPage(), 2);
  assert.equal(elements.get('customer-page-label').textContent, '31–32 / 32 khách · Trang 3/3');
  assert.equal(elements.get('customer-next-page').disabled, true);

  vm.runInContext('customerSearchQuery = "guest-1@example.com"', context);
  context.renderCustomers();
  assert.equal(rowsOnPage(), 1);
  assert.equal(elements.get('customer-page-label').textContent, '1–1 / 1 khách · Trang 1/1');
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

test('preserves stats, reservation count and latest reservation date when reservations are deleted but visits remain', () => {
  const { context, elements } = loadAdminScript();
  const visits = [
    {
      id: 'visit-1',
      reservationId: 'res-archived-1',
      recordedAt: '2026-10-28T10:00:00Z',
      customer: { key: 'email:guest@example.com', name: 'Guest A', email: 'guest@example.com', phone: '0901234567' }
    }
  ];
  context.visitsForTest = visits;
  vm.runInContext('allReservations = []; allVisits = visitsForTest; reservationLoadState = "ready"; visitLoadState = "ready"; customerSearchQuery = ""', context);
  context.updateStats();
  context.renderCustomers();

  assert.equal(elements.get('stat-total').textContent, 1);
  assert.equal(elements.get('stat-confirmed').textContent, 1);
  assert.equal(elements.get('stat-guests').textContent, 2);
  assert.equal(elements.get('care-customer-count').textContent, '1');
  assert.equal(elements.get('care-reservation-count').textContent, '1');
  assert.equal(elements.get('care-last-reservation').textContent, '2026-10-28');
  assert.match(elements.get('customers-tbody').innerHTML, /Guest A/);
  assert.match(elements.get('customers-tbody').innerHTML, /<td>1<\/td>/);
  assert.match(elements.get('customers-tbody').innerHTML, /<td>2026-10-28<\/td>/);
});
