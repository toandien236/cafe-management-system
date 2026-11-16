const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const inventoryScript = fs.readFileSync(path.join(__dirname, '../js/inventory.js'), 'utf8');

function createInventoryContext({ currentItem = {}, auth = null, projectId = 'project-quan-cafe' } = {}) {
  const elements = new Map();
  const calls = [];
  const listeners = {};
  const submitButton = { disabled: false };
  let nextId = 0;
  let authCallback;

  function getElement(id) {
    if (!elements.has(id)) {
      elements.set(id, {
        value: '',
        dataset: {},
        style: {},
        children: [],
        hidden: false,
        handlers: {},
        addEventListener(type, callback) { this.handlers[type] = callback; },
        replaceChildren(...children) { this.children = children; },
        appendChild(child) { this.children.push(child); },
        append(...children) { this.children.push(...children); },
        querySelector() { return submitButton; },
        querySelectorAll() { return []; },
        reset() {}
      });
    }
    return elements.get(id);
  }

  const db = {
    collection(name) {
      return {
        doc(id) {
          const documentId = id || `generated-${++nextId}`;
          return {
            id: documentId,
            collection: name,
            set(payload) { calls.push({ collection: name, operation: 'set', id: documentId, payload }); },
            update(payload) { calls.push({ collection: name, operation: 'update', id: documentId, payload }); },
            delete() { calls.push({ collection: name, operation: 'delete', id: documentId }); }
          };
        },
        orderBy() { return this; },
        limit() { return this; },
        onSnapshot(callback) {
          listeners[name] = callback;
          return () => {};
        }
      };
    },
    batch() {
      return {
        set(reference, payload) { calls.push({ collection: 'inventory', operation: 'batch-set', id: reference.id, payload }); },
        async commit() { calls.push({ operation: 'batch-commit' }); }
      };
    },
    async runTransaction(callback) {
      const transaction = {
        async get() {
          return {
            exists: true,
            data() { return { code: 'NL-ITEM', name: 'Cà phê', unit: 'kg', quantity: 5, ...currentItem }; }
          };
        },
        update(reference, payload) { calls.push({ collection: 'inventory', operation: 'transaction-update', id: reference.id, payload }); },
        set(reference, payload) { calls.push({ collection: reference.collection, operation: 'transaction-set', id: reference.id, payload }); }
      };
      return callback(transaction);
    }
  };

  const context = vm.createContext({
    document: {
      readyState: 'loading',
      getElementById: getElement,
      createElement(tag) {
        return {
          tagName: tag,
          children: [],
          style: {},
          append(...children) { this.children.push(...children); },
          appendChild(child) { this.children.push(child); }
        };
      },
      addEventListener(type, callback) {
        if (type === 'DOMContentLoaded') context.onReady = callback;
      }
    },
    window: {
      firebaseDb: db,
      firebaseAuth: auth,
      firebaseProjectId: projectId,
      firebase: { firestore: { FieldValue: { serverTimestamp: () => 'SERVER_TIMESTAMP' } } },
      addEventListener() {},
      INVENTORY_STARTER_CATALOG: []
    },
    console: { error() {} },
    confirm: () => true,
    Intl,
    Date,
    Number,
    String,
    Array,
    Math,
    Set
  });

  if (auth) {
    auth.onAuthStateChanged = callback => { authCallback = callback; };
  }
  vm.runInContext(inventoryScript, context);

  return {
    context,
    getElement,
    calls,
    listeners,
    submitButton,
    notifyAuth(user) { authCallback(user); }
  };
}

test('creates a Firestore ingredient with generated code and inventory fields', async () => {
  const { context, getElement, calls } = createInventoryContext();
  getElement('item-name').value = 'Hạt sen Huế';
  getElement('item-category').value = 'Topping & Syrup';
  getElement('item-quantity').value = '15';
  getElement('item-unit').value = 'kg';
  getElement('item-min').value = '3';
  getElement('item-price').value = '120000';
  getElement('item-supplier').value = 'Nông sản Huế';

  await vm.runInContext('handleSaveItem({ preventDefault() {} })', context);

  const insert = calls.find(call => call.collection === 'inventory' && call.operation === 'set');
  assert.ok(insert);
  assert.equal(insert.payload.code, `NL-${insert.id.toUpperCase()}`);
  assert.deepEqual({
    name: insert.payload.name,
    category: insert.payload.category,
    quantity: insert.payload.quantity,
    unit: insert.payload.unit,
    min_stock: insert.payload.min_stock,
    price: insert.payload.price,
    supplier: insert.payload.supplier
  }, {
    name: 'Hạt sen Huế',
    category: 'Topping & Syrup',
    quantity: 15,
    unit: 'kg',
    min_stock: 3,
    price: 120000,
    supplier: 'Nông sản Huế'
  });
  assert.match(insert.payload.received_at, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(insert.payload.created_at, 'SERVER_TIMESTAMP');
  assert.equal(getElement('inventory-message').dataset.error, 'false');
});

test('updates ingredient details in Firestore without overwriting current stock', async () => {
  const { context, getElement, calls } = createInventoryContext();
  vm.runInContext('itemId.value = "item-7"', context);
  getElement('item-name').value = 'Sữa đặc';
  getElement('item-category').value = 'Sữa & Kem';
  getElement('item-quantity').value = '12';
  getElement('item-unit').value = 'lon';
  getElement('item-min').value = '2';
  getElement('item-price').value = '25000';
  getElement('item-supplier').value = 'Nhà cung cấp B';

  await vm.runInContext('handleSaveItem({ preventDefault() {} })', context);

  const update = calls.find(call => call.operation === 'update');
  assert.equal(update.collection, 'inventory');
  assert.equal(update.id, 'item-7');
  assert.equal(update.payload.quantity, undefined);
  assert.equal(update.payload.price, 25000);
  assert.equal(update.payload.supplier, 'Nhà cung cấp B');
});

test('records stock receipt and stock adjustment in one Firestore transaction', async () => {
  const { context, getElement, calls } = createInventoryContext();
  vm.runInContext('inventoryItems = [{ id: "ingredient-1", code: "NL-1", name: "Cà phê", unit: "kg", quantity: 5 }]; currentUser = { uid: "admin-1", email: "lehwangduong@gmail.com" };', context);
  getElement('import-item').value = 'ingredient-1';
  getElement('import-date').value = '2026-11-14';
  getElement('import-quantity').value = '2.5';
  getElement('import-unit-price').value = '125000';
  getElement('import-supplier').value = 'Nhà cung cấp A';
  getElement('import-batch').value = 'LOT-42';
  getElement('import-expiry').value = '2027-03-15';
  getElement('import-note').value = 'Lô mới';

  await vm.runInContext('recordStockImport({ preventDefault() {} })', context);

  const update = calls.find(call => call.operation === 'transaction-update');
  const record = calls.find(call => call.operation === 'transaction-set');
  assert.equal(update.payload.quantity, 7.5);
  assert.equal(update.payload.received_at, '2026-11-14');
  assert.equal(update.payload.price, 125000);
  assert.equal(record.collection, 'stock_imports');
  assert.deepEqual({
    item_id: record.payload.item_id,
    item_name: record.payload.item_name,
    quantity: record.payload.quantity,
    cost_price: record.payload.cost_price,
    total_cost: record.payload.total_cost,
    supplier: record.payload.supplier,
    batch_number: record.payload.batch_number,
    expiry_date: record.payload.expiry_date,
    created_by: record.payload.created_by,
    actor_name: record.payload.actor_name
  }, {
    item_id: 'ingredient-1',
    item_name: 'Cà phê',
    quantity: 2.5,
    cost_price: 125000,
    total_cost: 312500,
    supplier: 'Nhà cung cấp A',
    batch_number: 'LOT-42',
    expiry_date: '2027-03-15',
    created_by: 'admin-1',
    actor_name: 'lehwangduong@gmail.com'
  });
});

test('rejects exports that exceed the latest Firestore quantity', async () => {
  const { context, getElement, calls } = createInventoryContext({ currentItem: { quantity: 2 } });
  vm.runInContext('inventoryItems = [{ id: "ingredient-1", name: "Cà phê", unit: "kg", quantity: 5 }]; currentUser = { uid: "admin-1", email: "lehwangduong@gmail.com" };', context);
  getElement('export-item').value = 'ingredient-1';
  getElement('export-quantity').value = '3';

  await vm.runInContext('recordStockExport({ preventDefault() {} })', context);

  assert.equal(calls.some(call => call.operation === 'transaction-update'), false);
  assert.match(getElement('inventory-message').textContent, /vượt quá/);
});

test('records valid stock exports together with the stock decrement', async () => {
  const { context, getElement, calls } = createInventoryContext({ currentItem: { quantity: 5 } });
  vm.runInContext('inventoryItems = [{ id: "ingredient-1", code: "NL-1", name: "Cà phê", unit: "kg", quantity: 5 }]; currentUser = { uid: "admin-1", email: "lehwangduong@gmail.com" };', context);
  getElement('export-item').value = 'ingredient-1';
  getElement('export-quantity').value = '1.25';
  getElement('export-reason').value = 'production';
  getElement('export-note').value = 'Pha chế';

  await vm.runInContext('recordStockExport({ preventDefault() {} })', context);

  const update = calls.find(call => call.operation === 'transaction-update');
  const record = calls.find(call => call.operation === 'transaction-set');
  assert.equal(update.payload.quantity, 3.75);
  assert.equal(record.collection, 'stock_exports');
  assert.equal(record.payload.quantity, 1.25);
  assert.equal(record.payload.reason, 'production');
  assert.equal(record.payload.created_by, 'admin-1');
});

test('shows low-stock alerts and searches by ingredient code', () => {
  const { context, getElement } = createInventoryContext();
  vm.runInContext('inventoryItems = [{ id: "1", code: "NL-CAFE", name: "Cà phê", quantity: 1, min_stock: 3, unit: "kg" }]; searchTerm = "nl-cafe"; renderInventory()', context);

  assert.equal(getElement('low-items').textContent, '1');
  assert.match(getElement('low-stock-alert').textContent, /Cà phê/);
  assert.equal(getElement('low-stock-alert').hidden, false);
  assert.equal(getElement('inventory-table-body').children.length, 1);
  assert.equal(getElement('inventory-table-body').children[0].children[0].children[0].children[1].textContent, 'NL-CAFE');
});

test('renders a compact mobile inventory card with expandable details and actions', () => {
  const { context, getElement } = createInventoryContext();
  vm.runInContext(`inventoryItems = [{
    id: "1",
    code: "NL-CAFE",
    name: "Cà phê",
    category: "Cà phê",
    quantity: 1,
    min_stock: 3,
    unit: "kg",
    price: 180000,
    supplier: "Nhà cung cấp A",
    received_at: "2026-11-15",
    updated_at: "2026-11-16"
  }]; renderInventory()`, context);

  const row = getElement('inventory-table-body').children[0];
  const mobileCell = row.children[9];
  const descendants = [];
  function collectDescendants(element) {
    (element.children || []).forEach(child => {
      descendants.push(child);
      collectDescendants(child);
    });
  }
  collectDescendants(mobileCell);
  const renderedText = [mobileCell, ...descendants].map(element => element.textContent).join(' ');

  assert.equal(mobileCell.className, 'inventory-mobile-card');
  assert.equal(row.children.length, 10);
  assert.match(renderedText, /Cà phê/);
  assert.match(renderedText, /1 kg/);
  assert.match(renderedText, /Nhà cung cấp A/);
  assert.equal(descendants.some(element => element.textContent === 'Thông tin chi tiết'), true);
  assert.equal(descendants.some(element => element.className === 'inventory-mobile-status is-low'), true);
  const controls = descendants.find(element => element.className === 'inventory-mobile-card-controls');
  const actions = descendants.find(element => element.className === 'inventory-mobile-actions');
  assert.equal(controls.children[1].textContent, 'Sửa');
  assert.equal(actions.children[0].textContent, 'Xóa');
});

test('allows the existing Firebase admin session and rejects other accounts', () => {
  const auth = {};
  const { context, getElement, notifyAuth } = createInventoryContext({ auth });
  vm.runInContext('initInventory()', context);
  notifyAuth({ email: 'lehwangduong@gmail.com', uid: 'admin-1' });
  assert.equal(getElement('inventory-app').hidden, false);
  assert.equal(getElement('inventory-auth-required').hidden, true);

  notifyAuth({ email: 'staff@example.com', uid: 'staff-1' });
  assert.equal(getElement('inventory-app').hidden, true);
  assert.match(getElement('inventory-auth-message').textContent, /không có quyền/);
});

test('clicking the add-ingredient button opens the modal for the authenticated admin', async () => {
  const auth = {};
  const { context, getElement, notifyAuth } = createInventoryContext({ auth });
  context.onReady();
  notifyAuth({ email: 'lehwangduong@gmail.com', uid: 'admin-1' });

  const addButton = getElement('add-item-btn');
  assert.equal(typeof addButton.handlers.click, 'function');
  await addButton.handlers.click();
  assert.equal(getElement('inventory-modal').style.display, 'flex');
  assert.equal(getElement('item-quantity').disabled, false);
});

test('explains how to resolve Firestore permission-denied writes', () => {
  const { context } = createInventoryContext();
  const message = vm.runInContext(
    'inventoryErrorMessage({ code: "permission-denied" }, "fallback")',
    context
  );
  assert.match(message, /triển khai firestore\.rules/);
  assert.match(message, /project-quan-cafe/);
});

test('blocks inventory access when browser Firebase config targets another project', () => {
  const auth = {};
  const { context, getElement, notifyAuth } = createInventoryContext({ auth, projectId: 'other-project' });
  vm.runInContext('initInventory()', context);
  notifyAuth({ email: 'lehwangduong@gmail.com', uid: 'admin-1' });

  assert.equal(getElement('inventory-app').hidden, true);
  assert.match(getElement('inventory-auth-message').textContent, /other-project/);
  assert.match(getElement('inventory-auth-message').textContent, /project-quan-cafe/);
});

test('Firestore rules restrict all inventory collections to the configured admin', () => {
  const rules = fs.readFileSync(path.join(__dirname, '../firestore.rules'), 'utf8');
  for (const collection of ['inventory', 'stock_imports', 'stock_exports']) {
    assert.match(rules, new RegExp(`match \\/${collection}\\/\\{`));
    assert.match(rules, new RegExp(`match \\/${collection}\\/\\{[^}]+\\} \\{\\s*allow read, write: if isAdmin\\(\\);`));
  }
});
