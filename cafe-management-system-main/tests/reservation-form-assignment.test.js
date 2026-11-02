const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { TextEncoder } = require('node:util');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const mainSource = fs.readFileSync(path.join(root, 'js', 'main.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const firebaseSource = fs.readFileSync(path.join(root, 'firebase.js'), 'utf8');
const rulesSource = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const start = mainSource.indexOf('const VALID_RESERVATION_TIMES =');
const end = mainSource.indexOf('function sendEmailJS(', start);
assert.ok(start >= 0 && end > start, 'reservation form source exists');
const reservationSource = mainSource.slice(start, end);

function createFormHarness({ commitBehavior = null, storedRequestId = null, storedRequestHash = null, existingRequests = [], sessionStorageAvailable = true } = {}) {
  const events = {
    commits: 0,
    writes: [],
    markerReadSources: [],
    toasts: [],
    logs: [],
    storage: null,
    sessionValues: new Map(),
    openedModalData: null
  };
  if (storedRequestId) events.sessionValues.set('mocha_reservation_request_id', storedRequestId);
  if (storedRequestHash) events.sessionValues.set('mocha_reservation_request_hash', storedRequestHash);

  const reservations = new Map();
  const requestMarkers = new Map(existingRequests);
  const collections = new Map([
    ['reservations', reservations],
    ['reservationRequests', requestMarkers]
  ]);
  const makeSnapshot = (map, id) => ({
    id,
    exists: map.has(id),
    data: () => map.get(id)
  });
  const db = {
    collection(name) {
      const map = collections.get(name);
      if (!map) throw new Error(`Unexpected collection: ${name}`);
      return {
        doc(id) {
          return {
            id,
            get: async options => {
              if (name === 'reservationRequests') events.markerReadSources.push(options && options.source);
              return makeSnapshot(map, id);
            }
          };
        }
      };
    },
    batch() {
      const writes = [];
      return {
        set(reference, data) { writes.push({ reference, data }); },
        async commit() {
          events.commits++;
          events.writes.push(...writes);
          if (commitBehavior) await commitBehavior({ writes, events, reservations, requestMarkers });
          if (writes.some(({ reference }) => collections.get(reference.collection).has(reference.id))) {
            throw Object.assign(new Error('create only'), { code: 'permission-denied' });
          }
          writes.forEach(({ reference, data }) => collections.get(reference.collection).set(reference.id, data));
        }
      };
    }
  };
  // Attach collection names to references so the in-memory batch can apply its writes.
  const originalCollection = db.collection.bind(db);
  db.collection = name => {
    const collection = originalCollection(name);
    const originalDoc = collection.doc;
    collection.doc = id => ({ ...originalDoc(id), collection: name });
    return collection;
  };

  const buttonText = { textContent: 'Xác nhận đặt bàn' };
  const submitButton = { disabled: false, querySelector: () => buttonText };
  const form = {
    hidden: false,
    style: {},
    listener: null,
    addEventListener(type, callback) { if (type === 'submit') this.listener = callback; },
    querySelector: () => null,
    insertBefore() {},
    appendChild() {},
    reset() {}
  };
  const success = { hidden: true, style: {} };
  const elements = {
    'reservation-form': form,
    'form-success': success,
    'res-submit': submitButton,
    'form-success-message': { textContent: '' },
    'res-name': { value: 'Guest One' },
    'res-email': { value: 'guest@example.com', checkValidity: () => true },
    'res-date': { value: '2099-01-01', min: '' },
    'res-time': { value: '1900' },
    'res-guests': { value: '2' },
    'res-phone': { value: '0901234567' },
    'res-notes': { value: '' },
    'res-another-btn': { addEventListener() {} }
  };
  const localStorage = {
    getItem: () => '[]',
    setItem(key, value) { events.storage = { key, value }; }
  };
  const sessionStorage = {
    getItem(key) {
      if (!sessionStorageAvailable) throw new Error('storage blocked');
      return events.sessionValues.get(key) || null;
    },
    setItem(key, value) {
      if (!sessionStorageAvailable) throw new Error('storage blocked');
      events.sessionValues.set(key, value);
    },
    removeItem(key) {
      if (!sessionStorageAvailable) throw new Error('storage blocked');
      events.sessionValues.delete(key);
    }
  };
  let randomSequence = 0;
  const sandbox = {
    TextEncoder,
    Uint8Array,
    window: {
      resetReservationGuests() {},
      sessionStorage,
      db,
      firebaseDb: db,
      firebaseProjectId: 'project-quan-cafe',
      firebase: { firestore: { FieldValue: { serverTimestamp: () => ({ serverTimestamp: true }) } } },
      crypto: {
        getRandomValues(bytes) {
          randomSequence++;
          for (let index = 0; index < bytes.length; index++) bytes[index] = (randomSequence + index) & 0xff;
          return bytes;
        },
        subtle: {
          async digest(algorithm, bytes) {
            assert.equal(algorithm, 'SHA-256');
            return crypto.createHash('sha256').update(Buffer.from(bytes)).digest();
          }
        }
      }
    },
    document: {
      getElementById: id => elements[id] || null,
      createElement: () => ({ setAttribute() {}, remove() {} })
    },
    localStorage,
    showToast: (message, type) => events.toasts.push({ message, type }),
    shakeField() {},
    openSuccessModal: data => { events.openedModalData = data; },
    console: { warn: (...args) => events.logs.push(args) }
  };
  vm.createContext(sandbox);
  vm.runInContext(reservationSource, sandbox);
  sandbox.initReservationForm();
  return { events, elements, form, success, submitButton, buttonText, sandbox, reservations, requestMarkers };
}

async function submit(harness) {
  await harness.form.listener({ preventDefault() {} });
}

test('writes an unassigned reservation and shows success only after Firestore acknowledges it', async () => {
  assert.doesNotMatch(reservationSource, /sendEmailJS\(/);
  const harness = createFormHarness();
  await submit(harness);

  assert.equal(harness.events.commits, 1);
  assert.equal(harness.success.hidden, false);
  assert.match(harness.elements['form-success-message'].textContent, /đặt bàn đã được lưu thành công/i);
  assert.equal(harness.events.toasts.at(-1).type, 'success');
  assert.equal(harness.events.openedModalData.reservationId, [...harness.reservations.keys()][0]);
  assert.equal(harness.events.openedModalData.tableNumber, undefined);
  assert.equal(harness.reservations.size, 1);
  assert.equal(harness.requestMarkers.size, 1);
  assert.deepEqual(harness.events.markerReadSources, ['server']);
  const reservation = [...harness.reservations.values()][0];
  const marker = [...harness.requestMarkers.values()][0];
  assert.equal(reservation.status, 'pending');
  assert.equal(reservation.emailStatus, 'Pending');
  assert.equal(reservation.tableNumber, undefined);
  assert.equal(Object.hasOwn(reservation, 'requestedTableNumber'), false);
  assert.equal(marker.reservationId, reservation.reservationId);
  assert.match(marker.payloadHash, /^[0-9a-f]{64}$/);
  assert.equal(harness.events.storage.key, 'mocha_reservations');
  assert.equal(harness.events.sessionValues.has('mocha_reservation_request_id'), false);
});

test('Firestore write failure keeps form values and does not show success', async () => {
  const harness = createFormHarness({
    commitBehavior: async () => { throw Object.assign(new Error('denied'), { code: 'permission-denied' }); }
  });
  await submit(harness);

  assert.equal(harness.events.commits, 1);
  assert.equal(harness.success.hidden, true);
  assert.equal(harness.events.toasts.some(toast => toast.type === 'success'), false);
  assert.equal(harness.events.storage, null);
  assert.equal(harness.events.openedModalData, null);
  assert.equal(harness.elements['res-name'].value, 'Guest One');
  assert.equal(harness.elements['res-email'].value, 'guest@example.com');
  assert.equal(harness.elements['res-date'].value, '2099-01-01');
  assert.equal(harness.submitButton.disabled, false);
  assert.match(harness.events.toasts.at(-1).message, /Rules của \/reservations và \/reservationRequests/i);
  assert.ok(harness.events.sessionValues.get('mocha_reservation_request_id'));
  assert.doesNotMatch(JSON.stringify(harness.events.logs), /Guest One|guest@example.com|0901234567|token|password/i);
});

test('does not send a request if the browser cannot persist its stable request ID', async () => {
  const harness = createFormHarness({ sessionStorageAvailable: false });
  await submit(harness);

  assert.equal(harness.events.commits, 0);
  assert.equal(harness.success.hidden, true);
  assert.equal(harness.elements['res-name'].value, 'Guest One');
  assert.match(harness.events.toasts.at(-1).message, /không lưu được mã yêu cầu/i);
});

test('retry after a failed write reuses the same ID and creates only one reservation', async () => {
  const harness = createFormHarness({
    commitBehavior: async ({ events }) => {
      if (events.commits === 1) throw Object.assign(new Error('offline'), { code: 'unavailable' });
    }
  });
  await submit(harness);
  const requestId = harness.events.sessionValues.get('mocha_reservation_request_id');
  assert.equal(harness.success.hidden, true);
  assert.ok(requestId);

  await submit(harness);
  assert.equal(harness.events.commits, 2);
  assert.equal(harness.reservations.size, 1);
  assert.equal(harness.requestMarkers.size, 1);
  assert.equal([...harness.reservations.keys()][0], requestId);
  assert.equal(harness.success.hidden, false);
});

test('same saved request ID is verified from its marker without creating duplicate documents', async () => {
  const first = createFormHarness();
  await submit(first);
  const reservationId = [...first.reservations.keys()][0];
  const requestHash = [...first.requestMarkers.values()][0].payloadHash;
  const retry = createFormHarness({
    storedRequestId: reservationId,
    storedRequestHash: requestHash,
    existingRequests: [[reservationId, first.requestMarkers.get(reservationId)]]
  });
  await submit(retry);

  assert.equal(retry.events.commits, 0);
  assert.equal(retry.reservations.size, 0);
  assert.equal(retry.requestMarkers.size, 1);
  assert.equal(retry.success.hidden, false);
  assert.equal(retry.events.openedModalData.reservationId, reservationId);
});

test('confirms an ambiguous commit only after the idempotency marker is readable', async () => {
  const harness = createFormHarness({
    commitBehavior: async ({ writes, requestMarkers, reservations, events }) => {
      writes.forEach(({ reference, data }) => {
        const target = reference.collection === 'reservations' ? reservations : requestMarkers;
        target.set(reference.id, data);
      });
      if (events.commits === 1) throw Object.assign(new Error('response lost'), { code: 'unavailable' });
    }
  });
  await submit(harness);

  assert.equal(harness.success.hidden, false);
  assert.equal(harness.events.commits, 1);
  assert.equal(harness.reservations.size, 1);
  assert.equal(harness.requestMarkers.size, 1);
});

test('client avoids Cloud Functions and does not ask guests to choose a table', () => {
  assert.doesNotMatch(mainSource, /supabase/i);
  assert.doesNotMatch(mainSource, /httpsCallable|createReservationWithTable/);
  assert.doesNotMatch(firebaseSource, /firebaseFunctions|\.functions\(/);
  assert.doesNotMatch(indexHtml, /firebase-functions-compat|res-table-number|tableNumber/);
  assert.doesNotMatch(indexHtml, /res-requested-table-number|Bàn mong muốn/);
  assert.doesNotMatch(mainSource, /requestedTableNumber|res-requested-table-number/);
  assert.match(indexHtml, /firebase\.js\?v=4/);
  assert.match(indexHtml, /js\/main\.js\?v=(?:9|13)/);
  assert.doesNotMatch(indexHtml, /form-success-table|modal-res-table/);
  assert.doesNotMatch(mainSource, /form-success-table|modal-res-table|formatAssignedTableNumber/);
  assert.match(rulesSource, /allow create: if isValidPublicReservation\(reservation\)/);
  assert.match(rulesSource, /requestedTableNumber\.matches\('\^\(0\[1-9\]\|1\[0-9\]\|20\)\$'\)/);
  assert.match(rulesSource, /match \/reservationRequests\//);
  assert.match(rulesSource, /allow list: if isAdmin\(\)/);
  assert.doesNotMatch(rulesSource, /allow read, write: if true/);
});
