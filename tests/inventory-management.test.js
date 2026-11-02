const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const inventoryScript = fs.readFileSync(path.join(__dirname, '../js/inventory.js'), 'utf8');

function createInventoryContext({ stubLoadInventory = true, client = null } = {}) {
  const elements = new Map();
  const calls = [];
  const importButton = { disabled: false };
  const exportButton = { disabled: false };
  const stats = { hidden: false };

  function getElement(id) {
    if (!elements.has(id)) {
      elements.set(id, {
        value: '',
        dataset: {},
        style: {},
        children: [],
        addEventListener() {},
        replaceChildren(...children) { this.children = children; },
        appendChild(child) { this.children.push(child); },
        append(...children) { this.children.push(...children); },
        querySelector() { return id === 'stock-import-form' ? importButton : exportButton; },
        querySelectorAll() { return []; },
        reset() {}
      });
    }
    return elements.get(id);
  }

  const supabaseClient = client || {
    auth: {
      async getUser() {
        return { data: { user: { id: 'user-123', email: 'manager@example.com', user_metadata: {} } }, error: null };
      }
    },
    from(table) {
      return {
        update(payload) {
          calls.push({ table, operation: 'update', payload });
          return {
            async eq(field, value) {
              calls.push({ table, operation: 'eq', field, value });
              return { error: null };
            }
          };
        },
        async insert(rows) {
          calls.push({ table, operation: 'insert', rows });
          return { error: null };
        }
      };
    }
  };
  const context = vm.createContext({
    document: {
      getElementById: getElement,
      querySelector() { return stats; },
      createElement() {
        return {
          children: [],
          style: {},
          append(...children) { this.children.push(...children); },
          appendChild(child) { this.children.push(child); }
        };
      },
      addEventListener() {}
    },
    window: { supabaseClient, INVENTORY_STARTER_CATALOG: [], addEventListener() {} },
    console: { error() {} },
    Intl,
    Date,
    Number,
    String,
    Array,
    Math
  });

  vm.runInContext(inventoryScript, context);
  if (stubLoadInventory) {
    vm.runInContext('inventoryItems = [{ id: "ingredient-1", name: "Cà phê", unit: "kg", quantity: 5, price: 100000 }]; loadInventory = async function () {}; loadHistory = async function () {};', context);
  }

  return { context, getElement, calls, importButton, exportButton, stats };
}

test('stock import records supplier, lot, expiry, cost and the current operator', async () => {
  const { context, getElement, calls, importButton } = createInventoryContext();
  getElement('import-item').value = 'ingredient-1';
  getElement('import-quantity').value = '2.5';
  getElement('import-unit-price').value = '125000';
  getElement('import-supplier').value = 'Nhà cung cấp A';
  getElement('import-batch').value = 'LOT-42';
  getElement('import-expiry').value = '2027-03-15';
  getElement('import-note').value = 'Lô mới';

  await vm.runInContext('recordStockImport({ preventDefault() {} })', context);

  const update = calls.find(call => call.table === 'inventory' && call.operation === 'update');
  const insert = calls.find(call => call.table === 'stock_imports' && call.operation === 'insert');
  assert.equal(update.payload.quantity, 7.5);
  assert.equal(update.payload.price, 125000);
  assert.equal(update.payload.supplier, 'Nhà cung cấp A');
  assert.deepEqual({ ...insert.rows[0] }, {
    item_id: 'ingredient-1',
    item_name: 'Cà phê',
    quantity: 2.5,
    unit: 'kg',
    cost_price: 125000,
    total_cost: 312500,
    supplier: 'Nhà cung cấp A',
    batch_number: 'LOT-42',
    expiry_date: '2027-03-15',
    created_by: 'user-123',
    actor_name: 'manager@example.com',
    note: 'Lô mới'
  });
  assert.equal(importButton.disabled, false);
});

test('stock export logs the actor and displays expanded import history details', async () => {
  const { context, getElement, calls, exportButton } = createInventoryContext();
  getElement('export-item').value = 'ingredient-1';
  getElement('export-quantity').value = '1.25';
  getElement('export-reason').value = 'production';
  getElement('export-note').value = 'Pha chế';

  await vm.runInContext('recordStockExport({ preventDefault() {} })', context);

  const insert = calls.find(call => call.table === 'stock_exports' && call.operation === 'insert');
  assert.equal(insert.rows[0].created_by, 'user-123');
  assert.equal(insert.rows[0].actor_name, 'manager@example.com');
  assert.equal(insert.rows[0].quantity, 1.25);
  assert.equal(exportButton.disabled, false);

  const historyRow = vm.runInContext('createImportHistoryRow({ created_at: "2026-11-02T03:00:00Z", item_name: "Cà phê", quantity: 2.5, unit: "kg", supplier: "Nhà cung cấp A", batch_number: "LOT-42", expiry_date: "2027-03-15", cost_price: 125000, total_cost: 312500, actor_name: "manager@example.com" })', context);
  assert.equal(historyRow.children.length, 10);
  assert.equal(historyRow.children[4].textContent, 'LOT-42');
  assert.equal(historyRow.children[5].textContent, '15/03/2027');
  assert.equal(historyRow.children[8].textContent, 'manager@example.com');
});

test('shows the 46-item catalog as an explicitly non-editable preview when Supabase is unavailable', async () => {
  const { context, getElement, stats } = createInventoryContext({ stubLoadInventory: false, client: {} });
  const catalogScript = fs.readFileSync(path.join(__dirname, '../js/inventory-catalog.js'), 'utf8');
  vm.runInContext(catalogScript, context);

  await vm.runInContext('loadInventory()', context);

  const rows = getElement('inventory-table-body').children;
  assert.equal(rows.length, 46);
  assert.equal(new Set(rows.map(row => row.children[0].textContent)).size, 46);
  assert.equal(rows[0].children[2].textContent, 'Chưa nhập');
  assert.equal(rows[0].children[6].textContent, 'Chưa nhập tồn');
  assert.equal(rows[0].children[9].textContent, 'Danh sách xem trước');
  assert.equal(stats.hidden, true);
  assert.match(getElement('inventory-message').textContent, /chưa phải dữ liệu đã lưu/);
});

test('handleSaveItem inserts a new ingredient with full attributes and updates table', async () => {
  const { context, getElement, calls } = createInventoryContext();
  getElement('item-id').value = '';
  getElement('item-name').value = 'Hạt sen Huế';
  getElement('item-category').value = 'Topping & Syrup';
  getElement('item-quantity').value = '15';
  getElement('item-unit').value = 'kg';
  getElement('item-min').value = '3';
  getElement('item-price').value = '120000';
  getElement('item-supplier').value = 'Nông sản Huế';

  await vm.runInContext('handleSaveItem({ preventDefault() {} })', context);

  const insert = calls.find(call => call.table === 'inventory' && call.operation === 'insert');
  assert.ok(insert, 'Insert call to inventory must exist');
  assert.deepEqual({ ...insert.rows[0] }, {
    name: 'Hạt sen Huế',
    category: 'Topping & Syrup',
    quantity: 15,
    unit: 'kg',
    min_stock: 3,
    price: 120000,
    supplier: 'Nông sản Huế'
  });

  const items = vm.runInContext('inventoryItems', context);
  const addedItem = items.find(i => i.name === 'Hạt sen Huế');
  assert.ok(addedItem, 'Item must be added to inventoryItems');
  assert.equal(addedItem.quantity, 15);
  assert.equal(addedItem.unit, 'kg');
  assert.equal(addedItem.price, 120000);
});

test('handleSaveItem validates required fields and non-negative numbers', async () => {
  const { context, getElement, calls } = createInventoryContext();

  // Empty name
  getElement('item-name').value = '';
  getElement('item-unit').value = 'kg';
  await vm.runInContext('handleSaveItem({ preventDefault() {} })', context);
  assert.match(getElement('inventory-message').textContent, /Vui lòng nhập tên nguyên liệu/);

  // Negative quantity
  getElement('item-name').value = 'Sữa đặc';
  getElement('item-unit').value = 'lon';
  getElement('item-quantity').value = '-5';
  await vm.runInContext('handleSaveItem({ preventDefault() {} })', context);
  assert.match(getElement('inventory-message').textContent, /Tồn đầu kỳ phải là số không âm/);

  // Negative price
  getElement('item-quantity').value = '10';
  getElement('item-min').value = '2';
  getElement('item-price').value = '-1000';
  await vm.runInContext('handleSaveItem({ preventDefault() {} })', context);
  assert.match(getElement('inventory-message').textContent, /Giá nhập phải là số không âm/);
});

test('INVENTORY_STARTER_CATALOG contains 46 unique ingredients with valid quantities and prices', () => {
  const catalogScript = fs.readFileSync(path.join(__dirname, '../js/inventory-catalog.js'), 'utf8');
  const context = vm.createContext({ window: {} });
  vm.runInContext(catalogScript, context);

  const catalog = context.window.INVENTORY_STARTER_CATALOG;
  assert.equal(catalog.length, 46);
  assert.equal(new Set(catalog.map(i => i.name)).size, 46);
  catalog.forEach(item => {
    assert.ok(item.name, 'name must be defined');
    assert.ok(item.category, 'category must be defined');
    assert.ok(item.unit, 'unit must be defined');
    assert.ok(typeof item.quantity === 'number' && item.quantity >= 0, `quantity of ${item.name} must be >= 0`);
    assert.ok(typeof item.price === 'number' && item.price >= 0, `price of ${item.name} must be >= 0`);
    assert.ok(typeof item.min_stock === 'number' && item.min_stock >= 0, `min_stock of ${item.name} must be >= 0`);
  });
});
