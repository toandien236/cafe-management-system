const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { createReservationWithTable } = require('../functions/services/tableAssignment');
const tableConfig = require('../functions/config/tables');

class MemoryFirestore {
  constructor({ reservations = [], commitError = null } = {}) {
    this.reservations = new Map(reservations.map(([id, data]) => [id, { ...data }]));
    this.reservationRequests = new Map();
    this.tableAllocationDays = new Map();
    this.nextId = 1;
    this.commitError = commitError;
    this.transactionTail = Promise.resolve();
  }

  collection(name) {
    return {
      doc: id => {
        const resolvedId = id || `new-${this.nextId++}`;
        return { collection: name, id: resolvedId, path: `${name}/${resolvedId}` };
      },
      where: (field, operator, value) => ({ collection: name, field, operator, value, isQuery: true })
    };
  }

  async runTransaction(callback) {
    const transactionRun = this.transactionTail.then(async () => {
      const writes = [];
      const readDocument = ref => {
        const collection = this[ref.collection];
        const data = collection && collection.get(ref.id);
        return {
          id: ref.id,
          ref,
          exists: Boolean(data),
          data: () => data && { ...data }
        };
      };
      const transaction = {
        async get(target) {
          if (!target.isQuery) return readDocument(target);
          const rows = [...(thisDb[target.collection] || new Map()).entries()]
            .filter(([, data]) => target.operator === '==' && data[target.field] === target.value)
            .map(([id, data]) => ({ id, ref: thisDb.collection(target.collection).doc(id), data: () => ({ ...data }) }));
          return { forEach: callbackFn => rows.forEach(callbackFn) };
        },
        create(ref, data) { writes.push({ type: 'create', ref, data }); },
        update(ref, data) { writes.push({ type: 'update', ref, data }); },
        set(ref, data, options) { writes.push({ type: 'set', ref, data, options }); }
      };
      const thisDb = this;
      const result = await callback(transaction);
      if (this.commitError) throw this.commitError;
      for (const write of writes) {
        const collection = this[write.ref.collection];
        if (write.type === 'create') {
          if (collection.has(write.ref.id)) throw Object.assign(new Error('already exists'), { code: 'already-exists' });
          collection.set(write.ref.id, { ...write.data });
        } else if (write.type === 'update') {
          if (!collection.has(write.ref.id)) throw Object.assign(new Error('not found'), { code: 'not-found' });
          collection.set(write.ref.id, { ...collection.get(write.ref.id), ...write.data });
        } else {
          const previous = collection.get(write.ref.id) || {};
          collection.set(write.ref.id, write.options && write.options.merge
            ? { ...previous, ...write.data }
            : { ...write.data });
        }
      }
      return result;
    });
    this.transactionTail = transactionRun.catch(() => {});
    return transactionRun;
  }
}

function booking({ date = '2030-01-01', time = '1900', guests = 2, ...overrides } = {}) {
  return {
    name: 'Guest One', email: 'guest@example.com', phone: '0901234567',
    date, time, guests, notes: '', ...overrides
  };
}

let requestSequence = 0;
function create(db, input = booking()) {
  const requestId = input.requestId || `00000000-0000-4000-8000-${String(++requestSequence).padStart(12, '0')}`;
  return createReservationWithTable(db, { ...input, requestId }, { serverTimestamp: () => 'SERVER_TIMESTAMP' });
}

test('creates a reservation with a persisted table number and pending status', async () => {
  const db = new MemoryFirestore();
  const result = await create(db);
  const saved = db.reservations.get(result.reservationId);

  assert.equal(result.tableNumber, '01');
  assert.equal(saved.tableNumber, '01');
  assert.equal(saved.status, 'pending');
  assert.equal(db.tableAllocationDays.get('2030-01-01').revision, 1);
});

test('honors a customer-selected table from the configured 01–20 inventory and persists it', async () => {
  const db = new MemoryFirestore();
  const result = await create(db, booking({ tableNumber: '20' }));

  assert.deepEqual(tableConfig.tables.map(table => table.tableNumber), Array.from({ length: 20 }, (_, index) => String(index + 1).padStart(2, '0')));
  assert.equal(result.tableNumber, '20');
  assert.equal(db.reservations.get(result.reservationId).tableNumber, '20');
});

test('rejects a selected table occupied in an overlapping time without creating a reservation', async () => {
  const db = new MemoryFirestore({
    reservations: [['existing-07', booking({ tableNumber: '07', status: 'confirmed', time: '1900' })]]
  });

  await assert.rejects(create(db, booking({ tableNumber: '07', time: '2000' })), error => error.code === 'table-not-available');
  assert.equal(db.reservations.size, 1);
  assert.equal(db.reservationRequests.size, 0);
});

test('rejects a selected table that cannot seat the guest count without writing', async () => {
  const db = new MemoryFirestore();

  await assert.rejects(create(db, booking({ tableNumber: '01', guests: 3 })), error => error.code === 'table-capacity-exceeded');
  assert.equal(db.reservations.size, 0);
  assert.equal(db.reservationRequests.size, 0);
});

test('cancelled reservations do not block the customer from selecting that table again', async () => {
  const db = new MemoryFirestore({
    reservations: [['cancelled-13', booking({ tableNumber: '13', status: 'cancelled' })]]
  });
  const result = await create(db, booking({ tableNumber: '13' }));

  assert.equal(result.tableNumber, '13');
  assert.equal(db.reservations.get(result.reservationId).tableNumber, '13');
});

test('allocates different tables to overlapping reservations and reuses a table after the interval', async () => {
  const db = new MemoryFirestore();
  const first = await create(db, booking({ time: '1900' }));
  const overlapping = await create(db, booking({ time: '2000' }));
  const later = await create(db, booking({ time: '0730' }));

  assert.equal(first.tableNumber, '01');
  assert.equal(overlapping.tableNumber, '02');
  assert.equal(later.tableNumber, '01');
});

test('cancelled and deleted reservations do not hold a table', async () => {
  const db = new MemoryFirestore({
    reservations: [['cancelled', booking({ tableNumber: '01', status: 'cancelled' })]]
  });
  const result = await create(db, booking({ time: '1900' }));
  db.reservations.delete(result.reservationId);
  const afterDeletion = await create(db, booking({ time: '1900' }));

  assert.equal(result.tableNumber, '01');
  assert.equal(afterDeletion.tableNumber, '01');
});

test('fills in table assignments for legacy bookings atomically with the new reservation', async () => {
  const db = new MemoryFirestore({
    reservations: [['legacy', booking({ tableNumber: undefined, status: 'confirmed' })]]
  });
  const result = await create(db);

  assert.equal(db.reservations.get('legacy').tableNumber, '01');
  assert.equal(db.reservations.get('legacy').updatedAt, 'SERVER_TIMESTAMP');
  assert.equal(result.tableNumber, '02');
});

test('fails closed when no suitable table is available', async () => {
  const occupied = Array.from({ length: tableConfig.tables.length }, (_, index) => [
    `occupied-${index + 1}`,
    booking({ tableNumber: String(index + 1).padStart(2, '0'), status: 'confirmed' })
  ]);
  const db = new MemoryFirestore({ reservations: occupied });

  await assert.rejects(create(db), error => error.code === 'no-available-table');
  assert.equal(db.reservations.size, tableConfig.tables.length);
});

test('does not create a reservation when the transaction commit is rejected', async () => {
  const db = new MemoryFirestore({
    commitError: Object.assign(new Error('permission denied'), { code: 'permission-denied' })
  });

  await assert.rejects(create(db), error => error.code === 'permission-denied');
  assert.equal(db.reservations.size, 0);
  assert.equal(db.tableAllocationDays.size, 0);
});

test('serializes concurrent allocation requests through the per-day transaction', async () => {
  const db = new MemoryFirestore();
  const results = await Promise.all([
    create(db, booking({ time: '1900' })),
    create(db, booking({ time: '1900' }))
  ]);

  assert.deepEqual(results.map(result => result.tableNumber).sort(), ['01', '02']);
  assert.equal(db.tableAllocationDays.get('2030-01-01').revision, 2);
});

test('returns the existing reservation when the same request is retried', async () => {
  const db = new MemoryFirestore();
  const input = booking({ requestId: '00000000-0000-4000-8000-123456789abc' });
  const first = await create(db, input);
  const retry = await create(db, input);

  assert.deepEqual(retry, first);
  assert.equal(db.reservations.size, 1);
  assert.equal(db.reservationRequests.size, 1);
  assert.equal(db.tableAllocationDays.get('2030-01-01').revision, 1);
});

test('rejects reuse of an idempotency key for different reservation details', async () => {
  const db = new MemoryFirestore();
  const requestId = '00000000-0000-4000-8000-123456789abd';
  await create(db, booking({ requestId, time: '1900' }));

  await assert.rejects(create(db, booking({ requestId, time: '2000' })), error => error.code === 'already-exists');
  assert.equal(db.reservations.size, 1);
  assert.equal(db.tableAllocationDays.get('2030-01-01').revision, 1);
});

test('includes the selected table in the idempotency fingerprint', async () => {
  const db = new MemoryFirestore();
  const requestId = '00000000-0000-4000-8000-123456789abf';
  await create(db, booking({ requestId, tableNumber: '05' }));

  await assert.rejects(create(db, booking({ requestId, tableNumber: '06' })), error => error.code === 'already-exists');
  assert.equal(db.reservations.size, 1);
  assert.equal([...db.reservations.values()][0].tableNumber, '05');
});

test('concurrent retries with the same request ID create only one reservation', async () => {
  const db = new MemoryFirestore();
  const input = booking({ requestId: '00000000-0000-4000-8000-123456789abe' });
  const results = await Promise.all([create(db, input), create(db, input)]);

  assert.equal(results[0].reservationId, results[1].reservationId);
  assert.equal(results[0].tableNumber, results[1].tableNumber);
  assert.equal(db.reservations.size, 1);
  assert.equal(db.tableAllocationDays.get('2030-01-01').revision, 1);
});

test('rejects invalid and past reservation dates before writing', async () => {
  const db = new MemoryFirestore();

  await assert.rejects(create(db, booking({ date: '2030-02-30' })), error => error.code === 'invalid-argument');
  await assert.rejects(create(db, booking({ date: '2000-01-01' })), error => error.code === 'invalid-argument');
  assert.equal(db.reservations.size, 0);
});

test('rejects untrusted field types instead of coercing them into valid booking data', async () => {
  const db = new MemoryFirestore();

  await assert.rejects(create(db, booking({ name: { text: 'Guest' } })), error => error.code === 'invalid-argument');
  await assert.rejects(create(db, booking({ guests: '2' })), error => error.code === 'invalid-argument');
  assert.equal(db.reservations.size, 0);
});

test('local Rules permit only paired public reservation writes and protect coordination documents', () => {
  const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
  const reservationsMatch = rules.match(/match \/reservations\/\{reservation\} \{([\s\S]*?)\n    \}/);

  assert.ok(reservationsMatch);
  assert.match(reservationsMatch[1], /allow create: if isValidPublicReservation\(reservation\)/);
  assert.match(rules, /match \/reservationRequests\/\{requestId\}/);
  assert.match(rules, /allow list: if isAdmin\(\)/);
  assert.match(rules, /match \/tableAllocationDays\/\{date\}/);
  assert.match(rules, /request\.resource\.data\.revision == resource\.data\.revision \+ 1/);
  assert.doesNotMatch(rules, /allow read, write: if true/);
});
