const assert = require('node:assert/strict');
const test = require('node:test');
const {
  getFirebaseProjectId,
  legacyDocumentId,
  mapInventory,
  mapStockMovement,
  latestReceiptDates,
  copyWithoutOverwriting
} = require('../scripts/migrate-supabase-inventory-to-firestore');

test('migration targets the existing Firebase project and rejects a different override', () => {
  const originalProjectId = process.env.FIREBASE_PROJECT_ID;
  const configuredProjectId = getFirebaseProjectId();
  try {
    process.env.FIREBASE_PROJECT_ID = configuredProjectId;
    assert.equal(getFirebaseProjectId(), configuredProjectId);
    process.env.FIREBASE_PROJECT_ID = 'different-firebase-project';
    assert.throws(() => getFirebaseProjectId(), /must match the existing \.firebaserc project/i);
  } finally {
    if (originalProjectId === undefined) delete process.env.FIREBASE_PROJECT_ID;
    else process.env.FIREBASE_PROJECT_ID = originalProjectId;
  }
});

test('legacy ids map to deterministic Firestore-safe ids', () => {
  assert.equal(legacyDocumentId('legacy/uuid'), 'legacy-bGVnYWN5L3V1aWQ');
  assert.equal(legacyDocumentId('legacy/uuid'), legacyDocumentId('legacy/uuid'));
  assert.throws(() => legacyDocumentId(''), /missing its id/i);
});

test('maps inventory fields and most recent import date without changing source records', () => {
  const source = {
    id: 'item-1',
    name: 'Cà phê',
    category: 'Cà phê',
    quantity: '5.25',
    unit: 'kg',
    min_stock: '2',
    price: '125000',
    supplier: 'Nhà cung cấp',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-04T00:00:00Z'
  };
  const sourceBefore = { ...source };
  const latest = latestReceiptDates([
    { item_id: 'item-1', created_at: '2026-01-02T00:00:00Z' },
    { item_id: 'item-1', created_at: '2026-01-03T00:00:00Z' }
  ]);
  const mapped = mapInventory(source, latest.get('item-1'));

  assert.equal(mapped.code, 'NL-ITEM-1');
  assert.equal(mapped.quantity, 5.25);
  assert.equal(mapped.price, 125000);
  assert.equal(mapped.received_at, '2026-01-03');
  assert.equal(mapped.legacy_supabase_id, 'item-1');
  assert.deepEqual(source, sourceBefore);
});

test('maps stock history references to migrated ingredient document ids', () => {
  const ids = new Map([['item-1', legacyDocumentId('item-1')]]);
  const mapped = mapStockMovement({
    id: 'import-1',
    item_id: 'item-1',
    item_name: 'Cà phê',
    quantity: '2',
    unit: 'kg',
    cost_price: '125000',
    total_cost: '250000',
    supplier: 'Nhà cung cấp',
    created_at: '2026-01-03T00:00:00Z',
    expiry_date: '2026-05-01'
  }, ids, 'stock_imports');

  assert.equal(mapped.item_id, legacyDocumentId('item-1'));
  assert.equal(mapped.quantity, 2);
  assert.equal(mapped.cost_price, 125000);
  assert.equal(mapped.expiry_date, '2026-05-01');
});

test('migration skips existing Firestore documents and never overwrites them', async () => {
  const calls = [];
  const firestore = {
    collection() {
      return {
        doc(id) {
          return {
            id,
            async get() { return { exists: id === legacyDocumentId('existing') }; }
          };
        }
      };
    },
    batch() {
      return {
        create(reference, data) { calls.push({ id: reference.id, data }); },
        async commit() { calls.push({ operation: 'commit' }); }
      };
    }
  };

  const result = await copyWithoutOverwriting(
    firestore,
    'inventory',
    [{ id: 'existing' }, { id: 'new' }],
    record => ({ name: record.id }),
    false
  );

  assert.deepEqual(result, { inserted: 1, skipped: 1 });
  assert.equal(calls.some(call => call.id === legacyDocumentId('existing')), false);
});

test('dry-run reports eligible rows without writing to Firestore', async () => {
  let batchCreated = false;
  const firestore = {
    collection() {
      return {
        doc(id) { return { id, async get() { return { exists: false }; } }; }
      };
    },
    batch() {
      batchCreated = true;
      return { create() {}, async commit() {} };
    }
  };

  const result = await copyWithoutOverwriting(
    firestore,
    'inventory',
    [{ id: 'new' }],
    record => ({ name: record.id }),
    true
  );
  assert.deepEqual(result, { inserted: 1, skipped: 0 });
  assert.equal(batchCreated, false);
});
