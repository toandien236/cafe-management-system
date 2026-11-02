const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const adminSource = fs.readFileSync(path.join(__dirname, '..', 'admin.js'), 'utf8');

function createHarness({ storedReservations = [], writeError = null, db = null } = {}) {
  const elements = new Map();
  const events = { toasts: [], logs: [], unsubscribes: 0 };
  const document = {
    readyState: 'loading',
    addEventListener() {},
    getElementById(id) {
      if (!elements.has(id)) {
        elements.set(id, {
          textContent: '',
          innerHTML: '',
          hidden: false,
          disabled: false,
          value: '',
          dataset: {}
        });
      }
      return elements.get(id);
    }
  };
  let localValue = JSON.stringify(storedReservations);
  const context = vm.createContext({
    document,
    window: { firebaseDb: db, db, addEventListener() {} },
    localStorage: {
      getItem() { return localValue; },
      setItem(_key, value) {
        if (writeError) throw writeError;
        localValue = value;
      }
    },
    console: {
      warn: (...args) => events.logs.push(args),
      error: (...args) => events.logs.push(args)
    },
    setTimeout() { return 1; },
    setInterval() { return 1; },
    clearInterval() {},
    confirm: () => true
  });
  vm.runInContext(adminSource, context, { filename: 'admin.js' });
  context.__events = events;
  vm.runInContext(`
    renderTable = () => {};
    renderCustomers = () => {};
    renderOrders = () => {};
    renderRevenue = () => {};
    showToast = (message, type) => __events.toasts.push({ message, type });
  `, context);
  return {
    context,
    elements,
    events,
    get storedReservations() {
      return JSON.parse(localValue);
    }
  };
}

function evalInContext(context, source) {
  return vm.runInContext(source, context);
}

test('local reservation status is updated only after localStorage write succeeds', async () => {
  const reservation = {
    name: 'Local guest',
    email: 'guest@example.com',
    date: '2030-01-01',
    time: '1900',
    guests: 2,
    status: 'pending'
  };
  const harness = createHarness({ storedReservations: [reservation] });
  evalInContext(harness.context, `adminSessionActive = true; allReservations = [{
    ...${JSON.stringify(reservation)}, id: 'local_0_', isLocal: true
  }]`);

  await harness.context.window.updateBookingStatus('local_0_', 'Confirmed');

  assert.equal(evalInContext(harness.context, 'allReservations[0].status'), 'confirmed');
  assert.equal(harness.storedReservations[0].status, 'confirmed');
  assert.equal(harness.events.toasts.at(-1).type, 'info');
  assert.match(harness.events.toasts.at(-1).message, /cục bộ/);
});

test('local reservation status reports malformed storage and leaves in-memory state unchanged', async () => {
  const harness = createHarness({ storedReservations: [] });
  harness.context.localStorage.getItem = () => '{bad json';
  evalInContext(harness.context, `adminSessionActive = true; allReservations = [{
    id: 'local_0_', isLocal: true, status: 'pending', guests: 2
  }]`);

  await harness.context.window.updateBookingStatus('local_0_', 'Confirmed');

  assert.equal(evalInContext(harness.context, 'allReservations[0].status'), 'pending');
  assert.equal(harness.events.toasts.at(-1).type, 'error');
  assert.match(harness.events.toasts.at(-1).message, /Không lưu được/);
});

test('local reservation status rolls back when localStorage refuses the write', async () => {
  const harness = createHarness({
    storedReservations: [{ date: '2030-01-01', time: '1900', guests: 2, status: 'pending' }],
    writeError: new Error('quota')
  });
  evalInContext(harness.context, `adminSessionActive = true; allReservations = [{
    id: 'local_0_', isLocal: true, status: 'pending', date: '2030-01-01', time: '1900', guests: 2
  }]`);

  await harness.context.window.updateBookingStatus('local_0_', 'Confirmed');

  assert.equal(evalInContext(harness.context, 'allReservations[0].status'), 'pending');
  assert.equal(harness.events.toasts.at(-1).type, 'error');
});

test('order status updates report server errors and preserve the existing order state', async () => {
  const db = {
    collection() {
      return { doc() { return { update: async () => { throw Object.assign(new Error('offline'), { code: 'unavailable' }); } }; } };
    }
  };
  const harness = createHarness({ db });
  evalInContext(harness.context, `adminSessionActive = true; allOrders = [{ id: 'order-1', status: 'new', paymentStatus: 'unpaid' }]`);

  await harness.context.window.updateOrderStatus('order-1', 'preparing');

  assert.equal(evalInContext(harness.context, 'allOrders[0].status'), 'new');
  assert.equal(harness.events.toasts.at(-1).type, 'error');
  assert.match(harness.events.toasts.at(-1).message, /Trạng thái cũ vẫn được giữ/);
});

test('order status updates prevent duplicate writes while one request is pending', async () => {
  let resolveUpdate;
  let updateCalls = 0;
  const db = {
    collection() {
      return { doc() { return { update: () => {
        updateCalls++;
        return new Promise(resolve => { resolveUpdate = resolve; });
      } }; } };
    }
  };
  const harness = createHarness({ db });
  evalInContext(harness.context, `adminSessionActive = true; allOrders = [{ id: 'order-1', status: 'new', paymentStatus: 'unpaid' }]`);

  const firstUpdate = harness.context.window.updateOrderStatus('order-1', 'preparing');
  await harness.context.window.updateOrderStatus('order-1', 'preparing');
  assert.equal(updateCalls, 1);
  resolveUpdate();
  await firstUpdate;
  assert.equal(evalInContext(harness.context, 'allOrders[0].status'), 'preparing');
});

test('payment failures do not mark an order as paid', async () => {
  const db = {
    collection() {
      return { doc() { return { update: async () => { throw new Error('offline'); } }; } };
    }
  };
  const harness = createHarness({ db });
  evalInContext(harness.context, `adminSessionActive = true; allOrders = [{
    id: 'order-1', status: 'served', paymentStatus: 'unpaid', total: 70000
  }]`);

  await harness.context.window.markOrderPaid('order-1');

  assert.equal(evalInContext(harness.context, 'allOrders[0].paymentStatus'), 'unpaid');
  assert.equal(evalInContext(harness.context, 'allOrders[0].status'), 'served');
  assert.equal(harness.events.toasts.at(-1).type, 'error');
});

test('successful payment is shown only after Firestore accepts the update', async () => {
  const updates = [];
  const db = {
    collection() {
      return { doc(id) { return { update: async fields => updates.push({ id, fields }) }; } };
    }
  };
  const harness = createHarness({ db });
  evalInContext(harness.context, `adminSessionActive = true; allOrders = [{
    id: 'order-1', status: 'served', paymentStatus: 'unpaid', total: 70000
  }]`);

  await harness.context.window.markOrderPaid('order-1');

  assert.equal(updates.length, 1);
  assert.equal(updates[0].fields.paymentStatus, 'paid');
  assert.equal(evalInContext(harness.context, 'allOrders[0].status'), 'completed');
  assert.equal(evalInContext(harness.context, 'allOrders[0].paymentStatus'), 'paid');
  assert.equal(harness.events.toasts.at(-1).type, 'success');
});

test('reservation listeners are replaced and stale callbacks cannot overwrite a newer session', () => {
  const listeners = [];
  let unsubscribes = 0;
  const db = {
    collection() {
      return {
        onSnapshot(onData) {
          listeners.push(onData);
          return () => { unsubscribes++; };
        }
      };
    }
  };
  const harness = createHarness({ db });
  evalInContext(harness.context, 'adminSessionActive = true');
  harness.context.loadReservations();
  harness.context.loadReservations();
  assert.equal(unsubscribes, 1);

  const snapshot = reservation => ({
    forEach(callback) {
      callback({ id: reservation.id, data: () => reservation });
    }
  });
  listeners[1](snapshot({ id: 'ignored', status: 'pending', guests: 2 }));
  listeners[0](snapshot({ id: 'stale', status: 'pending', guests: 2 }));
  assert.equal(evalInContext(harness.context, 'allReservations[0].id'), 'ignored');

  harness.context.stopReservationsListener();
  assert.equal(unsubscribes, 2);
  listeners[1](snapshot({ id: 'after-logout', status: 'pending', guests: 2 }));
  assert.equal(evalInContext(harness.context, 'allReservations[0].id'), 'ignored');
});

test('dashboard rejects malformed Firestore records while retaining valid reservations and orders', () => {
  const callbacks = {};
  const db = {
    collection(name) {
      return {
        onSnapshot(onData) {
          callbacks[name] = onData;
          return () => {};
        }
      };
    }
  };
  const harness = createHarness({ db });
  evalInContext(harness.context, 'adminSessionActive = true');
  harness.context.loadReservations();
  callbacks.reservations({
    forEach(callback) {
      callback({ id: 'valid-res', data: () => ({ status: 'pending', guests: 2, name: 'Guest' }) });
      callback({ id: 'invalid-res', data: () => ({ status: 'unexpected', guests: 2 }) });
    }
  });
  harness.context.loadOrders();
  callbacks.orders({
    forEach(callback) {
      callback({ id: 'valid-order', data: () => ({ status: 'new', total: 70000, items: [] }) });
      callback({ id: 'invalid-order', data: () => ({ status: 'new', total: -1 }) });
    }
  });

  assert.deepEqual(JSON.parse(JSON.stringify(evalInContext(harness.context, 'allReservations.map(item => item.id)'))), ['valid-res']);
  assert.deepEqual(JSON.parse(JSON.stringify(evalInContext(harness.context, 'allOrders.map(item => item.id)'))), ['valid-order']);
  assert.equal(harness.events.logs.length, 2);
});

test('reservation source status distinguishes local fallback from Firestore failure', () => {
  const localReservation = { date: '2030-01-01', time: '1900', guests: 2, status: 'pending' };
  const disconnected = createHarness({ storedReservations: [localReservation] });
  disconnected.context.loadReservations();
  assert.equal(disconnected.elements.get('reservations-source-status').dataset.state, 'local');
  assert.match(disconnected.elements.get('reservations-source-status').textContent, /không đồng bộ/);

  let onError;
  const db = {
    collection() {
      return { onSnapshot(_onData, errorCallback) { onError = errorCallback; return () => {}; } };
    }
  };
  const failed = createHarness({ storedReservations: [localReservation], db });
  evalInContext(failed.context, 'adminSessionActive = true');
  failed.context.loadReservations();
  onError(Object.assign(new Error('offline'), { code: 'unavailable' }));
  assert.equal(failed.elements.get('reservations-source-status').dataset.state, 'error');
  assert.match(failed.elements.get('reservations-source-status').textContent, /bản sao cục bộ/);
});

test('visit listener skips records with invalid timestamps', () => {
  let onSnapshot;
  const db = {
    collection() {
      return { onSnapshot(callback) { onSnapshot = callback; return () => {}; } };
    }
  };
  const harness = createHarness({ db });
  evalInContext(harness.context, 'adminSessionActive = true');
  harness.context.loadReservationVisits();
  onSnapshot({
    forEach(callback) {
      callback({ id: 'valid-visit', data: () => ({ recordedAt: '2030-01-01T19:00:00Z', source: 'staff-confirmed' }) });
      callback({ id: 'invalid-visit', data: () => ({ recordedAt: { toDate: () => new Date(NaN) }, source: 'staff-confirmed' }) });
    }
  });
  assert.deepEqual(JSON.parse(JSON.stringify(evalInContext(harness.context, 'allVisits.map(visit => visit.id)'))), ['valid-visit']);
  assert.equal(harness.events.logs.length, 1);
});

test('orders use an explicit currency unit and revenue dates use the cafe timezone', () => {
  const harness = createHarness();
  assert.equal(harness.context.getOrderAmountVnd(35000), 35000);
  assert.equal(harness.context.getOrderAmountVnd(35, 'VND_THOUSANDS'), 35000);
  assert.equal(harness.context.getOrderAmountVnd(-1), null);
  assert.equal(
    harness.context.getBusinessDateKey(new Date('2026-11-01T17:30:00.000Z')),
    '2026-11-02'
  );
});

test('revenue page loads only the canonical admin entry point', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'revenue.html'), 'utf8');
  assert.match(html, /src="admin\.js\?/);
  assert.doesNotMatch(html, /src="main\.js/);
  assert.equal(fs.existsSync(path.join(__dirname, '..', 'main.js')), false);
});
