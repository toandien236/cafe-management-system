const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const adminSource = fs.readFileSync(path.join(__dirname, '..', 'admin.js'), 'utf8');
const adminHtml = fs.readFileSync(path.join(__dirname, '..', 'admin.html'), 'utf8');
const rulesSource = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');

function extractSource(startMarker, endMarker) {
  const start = adminSource.indexOf(startMarker);
  const end = adminSource.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `source section exists: ${startMarker}`);
  return adminSource.slice(start, end);
}

const diagnosticSource = extractSource('const ADMIN_EMAIL =', '\nfunction initAdminAuth(');
const customerDataSource = extractSource('function normalizeCustomerEmail(', '\nfunction renderCustomers(');
const visitLoadSource = extractSource('function stopReservationVisitsListener()', '\nfunction normalizeCustomerEmail(');
const visitSource = extractSource('async function recordReservationVisit(', '\nfunction loadOrders()');
const profileRenderSource = extractSource('function renderCustomerProfile(', '\nasync function recordReservationVisit(');
const renderTableSource = extractSource('function renderTable()', '\nfunction getStatusLabel(');
const statusSource = extractSource('window.updateBookingStatus = async function', '\nwindow.deleteBooking = async function');
const deleteSource = extractSource('window.deleteBooking = async function', '\n// Reply Modal Controls');

function createHarness({
  initialStatus = 'confirmed',
  storedStatus = initialStatus,
  storedVisit = null,
  email = ' LehWangDuong@Gmail.com ',
  deniedPath = null,
  commitError = null,
  deferVisitSnapshots = false
} = {}) {
  const events = {
    reads: [], writes: [], toasts: [], logs: [], transactionCount: 0,
    listenerCalls: 0, listenerUnsubscribes: 0, visitListenerCallbacks: []
  };
  let persistedVisit = storedVisit;
  const reservationData = {
    id: 'r-1', status: initialStatus, name: 'Guest One', customerName: 'Guest One',
    email: 'guest@example.com', phone: '0901234567', date: '2030-01-01', time: '1900', guests: 2
  };
  const db = {
    collection(name) {
      return {
        doc(id) {
          return {
            collection: name,
            id,
            path: `/${name}/${id}`
          };
        },
        onSnapshot(next) {
          if (name === 'reservationVisits') {
            events.listenerCalls++;
            const rows = persistedVisit ? [{ id: 'r-1', value: persistedVisit }] : [];
            const snapshot = { forEach: callback => rows.forEach(row => callback({ id: row.id, data: () => row.value })) };
            events.visitListenerCallbacks.push({ next, snapshot });
            if (!deferVisitSnapshots) queueMicrotask(() => next(snapshot));
          }
          return () => { events.listenerUnsubscribes++; };
        }
      };
    },
    async runTransaction(callback) {
      events.transactionCount++;
      const writes = [];
      const result = await callback({
        async get(ref) {
          events.reads.push(ref.path);
          if (ref.path === deniedPath) {
            throw Object.assign(new Error('denied'), { code: 'firestore/permission-denied' });
          }
          if (ref.collection === 'reservations') {
            return storedStatus === null
              ? { exists: false }
              : { exists: true, data: () => ({ ...reservationData, status: storedStatus }) };
          }
          return persistedVisit
            ? { exists: true, data: () => persistedVisit }
            : { exists: false };
        },
        set(ref, value) { writes.push({ ref, value }); }
      });
      if (commitError) throw commitError;
      events.writes.push(...writes);
      if (writes.length) persistedVisit = writes[0].value;
      return result;
    }
  };
  const auth = { currentUser: email ? { email, uid: 'private-test-uid' } : null };
  const sandbox = {
    window: {
      db,
      firebaseDb: db,
      firebaseAuth: auth,
      firebase: { firestore: { FieldValue: { serverTimestamp: () => 'SERVER_TIMESTAMP' } } }
    },
    allReservations: [reservationData],
    allVisits: [],
    adminSessionActive: true,
    visitLoadState: 'ready',
    reservationLoadState: 'ready',
    activeFilter: 'all',
    searchQuery: '',
    selectedCustomerKey: null,
    visitSavingIds: new Set(),
    serverAcknowledgedVisits: new Map(),
    reservationVisitsUnsubscribe: null,
    reservationVisitsListenerGeneration: 0,
    document: {
      getElementById(id) {
        if (id === 'bookings-tbody') return events.bookingsBody || (events.bookingsBody = { innerHTML: '' });
        if (id === 'customer-profile-body') return events.profileBody || (events.profileBody = { innerHTML: '', textContent: '' });
        return null;
      }
    },
    escapeHtml: value => String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])),
    formatTime: value => String(value || ''),
    getStatusLabel: status => String(status),
    getEmailStatusLabel: status => String(status),
    getVisitReservationId: visit => visit.reservationId || visit.id,
    confirm: () => true,
    showToast: (message, type) => events.toasts.push({ message, type }),
    renderCustomers() {},
    console: { warn: (...args) => events.logs.push(args) }
  };
  vm.createContext(sandbox);
  vm.runInContext(diagnosticSource, sandbox);
  vm.runInContext('adminSessionActive = true;', sandbox);
  vm.runInContext(customerDataSource, sandbox);
  vm.runInContext(renderTableSource, sandbox);
  vm.runInContext(visitLoadSource, sandbox);
  vm.runInContext(profileRenderSource, sandbox);
  vm.runInContext(visitSource, sandbox);
  return { sandbox, events };
}

function createStatusHarness({ email = ' LEHWANGDUONG@GMAIL.COM ', updateError = null, hasFirestore = true } = {}) {
  const events = { updates: [], toasts: [], logs: [], localStorageWrites: 0 };
  const db = hasFirestore ? {
    collection(name) {
      return { doc(id) { return { update: async fields => {
        events.updates.push({ path: `/${name}/${id}`, fields });
        if (updateError) throw updateError;
      } }; } };
    }
  } : null;
  const auth = { currentUser: email ? { email, uid: 'private-test-uid' } : null };
  const sandbox = {
    window: { db, firebaseDb: db, firebaseAuth: auth },
    allReservations: [{ id: 'r-1', status: 'pending', updatedAt: 'old-time' }],
    allVisits: [],
    getVisitReservationId: visit => visit.reservationId || visit.id,
    showToast: (message, type) => events.toasts.push({ message, type }),
    updateStats() {},
    renderTable() {},
    renderCustomers() {},
    getStatusLabel: status => status,
    localStorage: {
      getItem: () => '[]',
      setItem: () => { events.localStorageWrites++; }
    },
    console: { warn: (...args) => events.logs.push(args) }
  };
  vm.createContext(sandbox);
  vm.runInContext(diagnosticSource, sandbox);
  vm.runInContext(statusSource, sandbox);
  return { sandbox, events };
}

function createDeleteHarness({ existingVisit = false, visitData = null, deniedPath = null, commitError = null } = {}) {
  const events = { reads: [], deletes: [], updates: [], toasts: [], logs: [], localStorageWrites: 0 };
  let persistedVisit = visitData || (existingVisit ? { reservationId: 'r-1', recordedAt: '2030-01-01T19:00:00Z', recordedBy: 'staff-1', source: 'staff-confirmed' } : null);
  const reservationData = {
    id: 'r-1', name: 'Guest One', customerName: 'Guest One', email: 'guest@example.com',
    phone: '0901234567', date: '2030-01-01', time: '1900', guests: 2, status: 'confirmed'
  };
  const db = {
    collection(name) {
      return { doc(id) { return { collection: name, id, path: `/${name}/${id}` }; } };
    },
    async runTransaction(callback) {
      const writes = [];
      const result = await callback({
        async get(ref) {
          events.reads.push(ref.path);
          if (ref.path === deniedPath) {
            throw Object.assign(new Error('denied'), { code: 'permission-denied' });
          }
          if (ref.collection === 'reservations') return { exists: true, data: () => reservationData };
          return persistedVisit
            ? { exists: true, data: () => persistedVisit }
            : { exists: false };
        },
        update(ref, value) { writes.push({ type: 'update', ref, value }); },
        delete(ref) { writes.push({ type: 'delete', ref }); }
      });
      if (commitError) throw commitError;
      writes.forEach(write => {
        if (write.type === 'update') {
          events.updates.push({ path: write.ref.path, value: write.value });
          if (write.ref.collection === 'reservationVisits') persistedVisit = { ...persistedVisit, ...write.value };
        } else {
          events.deletes.push(write.ref.path);
        }
      });
      events.visitAfterTransaction = persistedVisit;
      return result;
    }
  };
  const auth = { currentUser: { email: 'lehwangduong@gmail.com', uid: 'private-test-uid' } };
  const sandbox = {
    window: { db, firebaseDb: db, firebaseAuth: auth },
    allReservations: [reservationData],
    allVisits: persistedVisit ? [{ ...persistedVisit, id: 'r-1' }] : [],
    visitLoadState: 'ready',
    reservationLoadState: 'ready',
    serverAcknowledgedVisits: new Map(),
    document: {
      getElementById(id) {
        if (id === 'customer-profile-body') return events.profileBody || (events.profileBody = { innerHTML: '', textContent: '' });
        if (id === 'customer-profile-title') return events.profileTitle || (events.profileTitle = { textContent: '' });
        return null;
      }
    },
    escapeHtml: value => String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])),
    formatTime: value => String(value || ''),
    getStatusLabel: status => String(status),
    confirm: () => true,
    showToast: (message, type) => events.toasts.push({ message, type }),
    updateStats() {},
    renderTable() {},
    renderCustomers() {},
    localStorage: {
      getItem: () => '[]',
      setItem: () => { events.localStorageWrites++; }
    },
    console: { warn: (...args) => events.logs.push(args) }
  };
  vm.createContext(sandbox);
  vm.runInContext(diagnosticSource, sandbox);
  vm.runInContext(customerDataSource, sandbox);
  vm.runInContext(visitLoadSource, sandbox);
  vm.runInContext(profileRenderSource, sandbox);
  vm.runInContext(deleteSource, sandbox);
  return { sandbox, events };
}

test('creates one visit for a confirmed reservation', async () => {
  const { sandbox, events } = createHarness();
  await sandbox.recordReservationVisit('r-1');

  assert.deepEqual(events.reads, ['/reservations/r-1', '/reservationVisits/r-1']);
  assert.equal(events.writes.length, 1);
  assert.equal(events.writes[0].ref.path, '/reservationVisits/r-1');
  assert.deepEqual(Object.keys(events.writes[0].value).sort(), ['customer', 'recordedAt', 'recordedBy', 'reservationId', 'source']);
  assert.equal(events.writes[0].value.recordedBy, 'private-test-uid');
  assert.deepEqual(JSON.parse(JSON.stringify(events.writes[0].value.customer)), {
    key: 'email:guest@example.com', name: 'Guest One', email: 'guest@example.com',
    phone: '0901234567', phoneNormalized: '0901234567'
  });
  assert.equal(events.toasts.at(-1).type, 'success');
  assert.equal(sandbox.allVisits.length, 1);
  assert.match(events.bookingsBody.innerHTML, /Khách đã đến/);
  assert.doesNotMatch(events.bookingsBody.innerHTML, /data-visit-res-id="r-1"/);
  assert.equal(events.logs.length, 0);
});

test('reloaded reservation visit snapshot hides the arrival button and renders saved state', async () => {
  const { sandbox, events } = createHarness({
    storedVisit: {
      reservationId: 'r-1', recordedAt: '2030-01-01T19:00:00Z', recordedBy: 'staff-1', source: 'staff-confirmed',
      customer: { key: 'email:guest@example.com', name: 'Guest One', email: 'guest@example.com', phone: '0901234567', phoneNormalized: '0901234567' }
    }
  });
  sandbox.loadReservationVisits();
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(events.listenerCalls, 1);
  assert.equal(sandbox.visitLoadState, 'ready');
  assert.equal(sandbox.allVisits.length, 1);
  assert.match(events.bookingsBody.innerHTML, /Khách đã đến/);
  assert.doesNotMatch(events.bookingsBody.innerHTML, /data-visit-res-id="r-1"/);
});

test('replaces duplicate history listeners and ignores a stale empty snapshot', () => {
  const { sandbox, events } = createHarness({
    storedVisit: {
      reservationId: 'r-1', recordedAt: '2030-01-01T19:00:00Z', recordedBy: 'staff-1', source: 'staff-confirmed',
      customer: { key: 'email:guest@example.com', name: 'Guest One', email: 'guest@example.com', phone: '0901234567', phoneNormalized: '0901234567' }
    },
    deferVisitSnapshots: true
  });
  sandbox.loadReservationVisits();
  sandbox.loadReservationVisits();

  const staleEmptySnapshot = { forEach() {} };
  events.visitListenerCallbacks[0].next(staleEmptySnapshot);
  assert.equal(sandbox.visitLoadState, 'loading');
  events.visitListenerCallbacks[1].next(events.visitListenerCallbacks[1].snapshot);

  assert.equal(events.listenerCalls, 2);
  assert.equal(events.listenerUnsubscribes, 1);
  assert.equal(sandbox.visitLoadState, 'ready');
  assert.equal(sandbox.allVisits.length, 1);
  assert.doesNotMatch(events.bookingsBody.innerHTML, /data-visit-res-id="r-1"/);
});

test('does not duplicate an in-flight or already recorded visit', async () => {
  const { sandbox, events } = createHarness();
  const first = sandbox.recordReservationVisit('r-1');
  await sandbox.recordReservationVisit('r-1');
  await first;
  await sandbox.recordReservationVisit('r-1');

  assert.equal(events.transactionCount, 1);
  assert.equal(events.writes.length, 1);
  assert.equal(sandbox.allVisits.length, 1);
  assert.doesNotMatch(events.bookingsBody.innerHTML, /data-visit-res-id="r-1"/);
});

test('does not write a second visit when the transaction finds one', async () => {
  const { sandbox, events } = createHarness({
    storedVisit: { reservationId: 'r-1', source: 'staff-confirmed' }
  });
  await sandbox.recordReservationVisit('r-1');

  assert.equal(events.transactionCount, 1);
  assert.equal(events.writes.length, 0);
  assert.equal(sandbox.allVisits.length, 1);
  assert.equal(events.toasts.at(-1).type, 'info');
});

test('rejects a pending reservation before starting a transaction', async () => {
  const { sandbox, events } = createHarness({ initialStatus: 'pending' });
  await sandbox.recordReservationVisit('r-1');

  assert.equal(events.transactionCount, 0);
  assert.equal(events.writes.length, 0);
  assert.equal(events.toasts.at(-1).type, 'error');
});

test('rechecks Firestore status and rejects a reservation that changed to cancelled', async () => {
  const { sandbox, events } = createHarness({ initialStatus: 'confirmed', storedStatus: 'cancelled' });
  await sandbox.recordReservationVisit('r-1');

  assert.equal(events.transactionCount, 1);
  assert.equal(events.writes.length, 0);
  assert.equal(events.logs[0][1].code, 'reservation-not-confirmed');
  assert.equal(events.toasts.at(-1).type, 'error');
});

test('reports permission-denied with safe path and auth diagnostics', async () => {
  const { sandbox, events } = createHarness({ deniedPath: '/reservationVisits/r-1' });
  await sandbox.recordReservationVisit('r-1');

  assert.equal(events.writes.length, 0);
  assert.equal(events.logs.length, 1);
  assert.equal(events.logs[0][0], '[Firestore] create-reservation-visit');
  assert.deepEqual(JSON.parse(JSON.stringify(events.logs[0][1])), {
    code: 'permission-denied',
    step: 'read-existing-visit',
    paths: ['/reservations/r-1', '/reservationVisits/r-1'],
    auth: { signedIn: true, adminEmailMatches: true }
  });
  assert.match(events.toasts.at(-1).message, /Firestore từ chối đọc reservationVisits/);
  assert.equal(events.toasts.some(toast => toast.type === 'success'), false);
  assert.match(events.bookingsBody.innerHTML, /data-visit-res-id="r-1"/);
  assert.doesNotMatch(JSON.stringify(events.logs), /private-test-uid|LehWangDuong|token|password/i);
});

test('does not show a successful arrival when Firestore rejects the visit commit', async () => {
  const commitError = Object.assign(new Error('denied at commit'), { code: 'firestore/permission-denied' });
  const { sandbox, events } = createHarness({ commitError });
  await sandbox.recordReservationVisit('r-1');

  assert.equal(events.writes.length, 0);
  assert.equal(sandbox.allVisits.length, 0);
  assert.equal(events.logs[0][1].code, 'permission-denied');
  assert.equal(events.logs[0][1].step, 'commit-transaction');
  assert.equal(events.toasts.at(-1).type, 'error');
  assert.equal(events.toasts.some(toast => toast.type === 'success'), false);
  assert.match(events.bookingsBody.innerHTML, /data-visit-res-id="r-1"/);
  assert.doesNotMatch(events.bookingsBody.innerHTML, /Khách đã đến/);
});

test('reports unauthenticated separately without contacting Firestore', async () => {
  const { sandbox, events } = createHarness({ email: null });
  await sandbox.recordReservationVisit('r-1');

  assert.equal(events.transactionCount, 0);
  assert.equal(events.writes.length, 0);
  assert.equal(events.logs[0][1].code, 'unauthenticated');
  assert.equal(events.logs[0][1].step, 'preflight-auth');
  assert.equal(events.logs[0][1].auth.signedIn, false);
  assert.match(events.toasts.at(-1).message, /chưa đăng nhập/);
});

test('confirms a server reservation only after Firestore accepts the update', async () => {
  const { sandbox, events } = createStatusHarness();
  await sandbox.window.updateBookingStatus('r-1', 'Confirmed');

  assert.equal(events.updates.length, 1);
  assert.equal(events.updates[0].path, '/reservations/r-1');
  assert.equal(events.updates[0].fields.status, 'confirmed');
  assert.equal(sandbox.allReservations[0].status, 'Confirmed');
  assert.equal(events.localStorageWrites, 0);
  assert.equal(events.toasts.at(-1).type, 'success');
});

test('rolls back a denied confirmation and never reports local success', async () => {
  const { sandbox, events } = createStatusHarness({
    updateError: Object.assign(new Error('denied'), { code: 'permission-denied' })
  });
  await sandbox.window.updateBookingStatus('r-1', 'Confirmed');

  assert.equal(sandbox.allReservations[0].status, 'pending');
  assert.equal(events.localStorageWrites, 0);
  assert.equal(events.logs[0][1].code, 'permission-denied');
  assert.match(events.toasts.at(-1).message, /Firestore từ chối cập nhật đặt bàn/);
  assert.equal(events.toasts.at(-1).type, 'error');
});

test('does not change a server reservation when Firestore is unavailable', async () => {
  const { sandbox, events } = createStatusHarness({ hasFirestore: false });
  await sandbox.window.updateBookingStatus('r-1', 'Confirmed');

  assert.equal(sandbox.allReservations[0].status, 'pending');
  assert.equal(events.updates.length, 0);
  assert.equal(events.localStorageWrites, 0);
  assert.match(events.toasts.at(-1).message, /Mất kết nối Firestore/);
});

test('deletes a reservation without a visit after Firestore confirms it exists', async () => {
  const { sandbox, events } = createDeleteHarness();
  await sandbox.window.deleteBooking('r-1');

  assert.deepEqual(events.reads, ['/reservations/r-1', '/reservationVisits/r-1']);
  assert.deepEqual(events.deletes, ['/reservations/r-1']);
  assert.equal(sandbox.allReservations.length, 0);
});

test('deletes a booking with a visit while preserving and backfilling its independent history', async () => {
  const { sandbox, events } = createDeleteHarness({ existingVisit: true });
  await sandbox.window.deleteBooking('r-1');

  assert.deepEqual(events.deletes, ['/reservations/r-1']);
  assert.equal(events.updates.length, 1);
  assert.equal(events.updates[0].path, '/reservationVisits/r-1');
  assert.equal(events.visitAfterTransaction.reservationId, 'r-1');
  assert.equal(events.visitAfterTransaction.recordedAt, '2030-01-01T19:00:00Z');
  assert.equal(events.visitAfterTransaction.recordedBy, 'staff-1');
  assert.equal(events.visitAfterTransaction.source, 'staff-confirmed');
  assert.equal(events.visitAfterTransaction.customer.key, 'email:guest@example.com');
  assert.equal(sandbox.allReservations.length, 0);
  assert.equal(sandbox.allVisits.length, 1);

  const [profile] = sandbox.buildCustomerProfiles();
  assert.equal(profile.name, 'Guest One');
  assert.deepEqual(JSON.parse(JSON.stringify(profile.emails)), ['guest@example.com']);
  assert.deepEqual(JSON.parse(JSON.stringify(profile.phones)), ['0901234567']);
  assert.equal(profile.reservations.length, 0);
  assert.equal(profile.visits.length, 1);
  assert.equal(profile.latestVisit.reservationId, 'r-1');
  assert.equal(sandbox.getVisitDate(profile.latestVisit), Date.parse('2030-01-01T19:00:00Z'));
  sandbox.renderCustomerProfile(profile);
  assert.equal(events.profileTitle.textContent, 'Guest One');
  assert.match(events.profileBody.innerHTML, /guest@example.com/);
  assert.match(events.profileBody.innerHTML, /r-1/);
  assert.match(events.profileBody.innerHTML, /Lần gần nhất/);
  assert.match(events.profileBody.innerHTML, /2030/);
  assert.equal(events.toasts.at(-1).type, 'success');
});

test('deleting a booking leaves a complete visit record unchanged', async () => {
  const visit = {
    reservationId: 'r-1', recordedAt: '2030-01-01T19:00:00Z', recordedBy: 'staff-1', source: 'staff-confirmed',
    customer: { key: 'email:guest@example.com', name: 'Guest One', email: 'guest@example.com', phone: '0901234567', phoneNormalized: '0901234567' }
  };
  const { sandbox, events } = createDeleteHarness({ visitData: visit });
  await sandbox.window.deleteBooking('r-1');

  assert.deepEqual(events.updates, []);
  assert.deepEqual(events.deletes, ['/reservations/r-1']);
  assert.deepEqual(JSON.parse(JSON.stringify(events.visitAfterTransaction)), visit);
  assert.equal(sandbox.allVisits.length, 1);
  assert.equal(sandbox.buildCustomerProfiles()[0].visits.length, 1);
});

test('retains a reservation when Firestore denies the delete transaction', async () => {
  const { sandbox, events } = createDeleteHarness({ deniedPath: '/reservationVisits/r-1' });
  await sandbox.window.deleteBooking('r-1');

  assert.equal(events.deletes.length, 0);
  assert.equal(sandbox.allReservations.length, 1);
  assert.equal(events.logs[0][1].code, 'permission-denied');
  assert.equal(events.logs[0][1].step, 'read-existing-visit');
  assert.match(events.toasts.at(-1).message, /đặt bàn chưa bị xóa/);
});

test('reports exact denied read path during delete preflight', async () => {
  const { sandbox, events } = createDeleteHarness({ deniedPath: '/reservations/r-1' });
  await sandbox.window.deleteBooking('r-1');

  assert.deepEqual(events.reads, ['/reservations/r-1']);
  assert.equal(events.deletes.length, 0);
  assert.equal(sandbox.allReservations.length, 1);
  assert.equal(events.logs[0][1].code, 'permission-denied');
  assert.equal(events.logs[0][1].step, 'read-reservation');
  assert.deepEqual(JSON.parse(JSON.stringify(events.logs[0][1].operations)), [
    { action: 'get', path: '/reservations/r-1' }
  ]);
  assert.match(events.toasts.at(-1).message, /từ chối đọc đặt bàn/);
});

test('logs planned transaction operations when Firestore denies the atomic commit', async () => {
  const commitError = Object.assign(new Error('denied at commit'), { code: 'firestore/permission-denied' });
  const visit = {
    reservationId: 'r-1', recordedAt: '2030-01-01T19:00:00Z', recordedBy: 'staff-1', source: 'staff-confirmed',
    customer: { key: 'email:guest@example.com', name: 'Guest One', email: 'guest@example.com', phone: '0901234567', phoneNormalized: '0901234567' }
  };
  const { sandbox, events } = createDeleteHarness({ visitData: visit, commitError });
  await sandbox.window.deleteBooking('r-1');

  assert.equal(events.deletes.length, 0);
  assert.equal(sandbox.allReservations.length, 1);
  assert.equal(sandbox.allVisits.length, 1);
  assert.equal(events.logs[0][1].code, 'permission-denied');
  assert.equal(events.logs[0][1].step, 'commit-transaction');
  assert.deepEqual(JSON.parse(JSON.stringify(events.logs[0][1].operations)), [
    { action: 'get', path: '/reservations/r-1' },
    { action: 'get', path: '/reservationVisits/r-1' },
    { action: 'delete', path: '/reservations/r-1' },
    { action: 'commit' }
  ]);
  assert.match(events.toasts.at(-1).message, /commit transaction xóa/);
  assert.match(events.toasts.at(-1).message, /không chỉ ra write nào/);
  assert.doesNotMatch(events.toasts.at(-1).message, /Rules sai|admin không đúng/i);
  assert.doesNotMatch(JSON.stringify(events.logs[0][1].operations), /guest@example\.com|token|password/i);
});

test('distinguishes permission denied while preparing the reservation delete from commit denial', () => {
  const sandbox = { window: {}, console: { warn() {} } };
  vm.createContext(sandbox);
  vm.runInContext(diagnosticSource, sandbox);
  const message = vm.runInContext(
    "firestoreUserMessage('delete-reservation', { code: 'permission-denied' }, 'delete-reservation')",
    sandbox
  );
  assert.match(message, /từ chối thao tác xóa \/reservations/);
  assert.doesNotMatch(message, /commit transaction/);
});

test('explains a denied history read during deletion without implying the booking was removed', () => {
  const sandbox = { window: {}, console: { warn() {} } };
  vm.createContext(sandbox);
  vm.runInContext(diagnosticSource, sandbox);
  const message = vm.runInContext(
    "firestoreUserMessage('delete-reservation', { code: 'permission-denied' }, 'read-existing-visit')",
    sandbox
  );
  assert.match(message, /từ chối đọc reservationVisits/);
  assert.match(message, /đặt bàn chưa bị xóa/);
});

test('keeps the admin rule private and normalizes the email claim', () => {
  assert.match(rulesSource, /request\.auth\.token\.email\.trim\(\)\.lower\(\) == 'lehwangduong@gmail\.com'/);
  assert.match(rulesSource, /match \/reservationVisits\/{reservationId}/);
  assert.match(rulesSource, /hasAll\(\['reservationId', 'recordedAt', 'recordedBy', 'source', 'customer'\]\)/);
  assert.match(rulesSource, /allow read: if isAdmin\(\)/);
  assert.match(rulesSource, /allow update: if isAdmin\(\)[\s\S]*affectedKeys\(\)\.hasOnly\(\['customer', 'reservationId'\]\)/);
  assert.match(rulesSource, /allow delete: if false/);
  assert.match(rulesSource, /isValidVisitCustomerSnapshot\(\s*getAfter\(/);
  assert.doesNotMatch(rulesSource, /allow read: if true/);
});

test('admin actions have click handlers and the page loads the current script version', () => {
  assert.match(adminHtml, /admin\.js\?v=auth-view-switch/);
  assert.match(adminSource, /bookingsBody\.addEventListener\('click'/);
  assert.match(adminSource, /customersBody\.addEventListener\('click'/);
  assert.match(adminSource, /closest\('\[data-visit-res-id\]'\)/);
  assert.match(adminSource, /window\.deleteBooking = async function/);
  assert.match(adminSource, /data-visit-res-id="\$\{escapeHtml\(res\.id\)\}"/);
});

test('admin reservations do not display table numbers', () => {
  const { sandbox, events } = createHarness();
  const reservationsTable = adminHtml.match(/<table class="admin-table">[\s\S]*?<thead>([\s\S]*?)<\/thead>/);
  assert.ok(reservationsTable);
  assert.equal((reservationsTable[1].match(/<th>/g) || []).length, 7);
  sandbox.allReservations[0].tableNumber = '05';
  sandbox.allReservations[0].requestedTableNumber = '05';
  sandbox.renderTable();
  assert.doesNotMatch(events.bookingsBody.innerHTML, /B05|reservation-table-number|requestedTableNumber/);
});
