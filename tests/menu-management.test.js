const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');

test('admin menu management exposes search, category, availability and edit controls in HTML & JS', () => {
  const html = fs.readFileSync(path.join(root, 'admin.html'), 'utf8');
  const js = fs.readFileSync(path.join(root, 'admin.js'), 'utf8');

  assert.match(html, /id="menu-search"/);
  assert.match(html, /id="menu-category-filter"/);
  assert.match(html, /id="menu-availability-filter"/);
  assert.match(html, /id="menu-item-available"/);
  assert.match(html, /id="btn-open-add-menu"/);
  assert.match(html, /id="menu-modal"/);
  assert.match(html, /id="menu-item-form"/);
  assert.match(html, /id="menu-delete-modal"/);
  assert.match(html, /id="menu-image-upload-area"/);
  assert.match(js, /function toggleMenuAvailability/);
  assert.match(js, /function openMenuModal/);
  assert.match(js, /function saveMenuItem/);
  assert.match(js, /function confirmDeleteMenuItem/);
  assert.match(js, /function handleImageFile/);
});

test('public menu listener excludes unavailable Firestore items', () => {
  const js = fs.readFileSync(path.join(root, 'js', 'menu-data.js'), 'utf8');

  assert.match(js, /data\.available !== false/);
  assert.match(js, /available: true/);
  assert.match(js, /CAFE_MENU_DEFAULT/);
  assert.match(js, /window\.onMenuUpdate/);
  assert.match(js, /window\._notifyMenuUpdate/);
});

test('Firestore rules protect menu writes and validate menu availability', () => {
  const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');

  assert.match(rules, /match \/menuItems\/\{itemId\}/);
  assert.match(rules, /allow read: if true/);
  assert.match(rules, /allow update: if isAdmin\(\)/);
  assert.match(rules, /request\.resource\.data\.available is bool/);
});

function createMockAdminEnv(initialStorage = {}) {
  const storage = { ...initialStorage };
  const elements = new Map();

  const makeElem = () => ({
    value: '',
    checked: true,
    hidden: false,
    textContent: '',
    innerHTML: '',
    style: {},
    classList: { add() {}, remove() {}, contains: () => false },
    addEventListener() {},
    appendChild() {},
    removeChild() {},
    setAttribute() {},
    reset() { this.value = ''; }
  });

  const doc = {
    readyState: 'complete',
    addEventListener() {},
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, makeElem());
      return elements.get(id);
    },
    querySelector() {
      return makeElem();
    },
    querySelectorAll() {
      return [];
    },
    createElement() {
      return makeElem();
    }
  };

  const win = {
    _menuUpdateListeners: [],
    onMenuUpdate(cb) { this._menuUpdateListeners.push(cb); },
    _notifyMenuUpdate() {
      this._menuUpdateListeners.forEach(fn => fn(this.CAFE_MENU));
    }
  };

  const context = vm.createContext({
    document: doc,
    window: win,
    console: { log() {}, warn() {}, error() {} },
    localStorage: {
      getItem: (k) => storage[k] || null,
      setItem: (k, v) => { storage[k] = String(v); },
      removeItem: (k) => { delete storage[k]; }
    },
    setTimeout() {},
    setInterval() {},
    clearInterval() {},
    Image: function() {
      this.src = '';
      this.onload = null;
    }
  });

  // Load menu-data.js first
  const menuSource = fs.readFileSync(path.join(root, 'js', 'menu-data.js'), 'utf8');
  vm.runInContext(menuSource, context, { filename: 'menu-data.js' });

  // Load admin.js
  const adminSource = fs.readFileSync(path.join(root, 'admin.js'), 'utf8');
  vm.runInContext(adminSource, context, { filename: 'admin.js' });

  const getEl = (id) => doc.getElementById(id);
  return { context, doc, getEl, storage, win };
}

test('menu management: adding a new dish updates local state, storage, and customer menu', async () => {
  const { context, getEl, storage, win } = createMockAdminEnv();

  // Populate mock form fields for adding a dish
  getEl('menu-item-name').value = 'Bạc Xỉu Sữa Tươi Đặc Biệt';
  getEl('menu-item-category').value = 'Cà phê';
  getEl('menu-item-price').value = '42000';
  getEl('menu-item-description').value = 'Cà phê thơm lừng hoà quyện cùng sữa tươi Dalat.';
  getEl('menu-item-available').checked = true;
  getEl('menu-image-url').value = 'assets/bac_xiu.jpg';

  let menuUpdateNotified = false;
  win.onMenuUpdate((menu) => {
    menuUpdateNotified = true;
  });

  const fakeEvent = { preventDefault() {} };
  await context.saveMenuItem(fakeEvent);

  // Check that item is in localStorage
  assert.ok(storage['mocha_menu_items'], 'Item was written to localStorage');
  const savedList = JSON.parse(storage['mocha_menu_items']);
  const added = savedList.find(i => i.name === 'Bạc Xỉu Sữa Tươi Đặc Biệt');
  assert.ok(added, 'New dish exists in saved list');
  assert.equal(added.price, 42000);
  assert.equal(added.category, 'Cà phê');
  assert.equal(added.image, 'assets/bac_xiu.jpg');
  assert.equal(added.description, 'Cà phê thơm lừng hoà quyện cùng sữa tươi Dalat.');
  assert.equal(added.available, true);

  // Check that win.CAFE_MENU was updated and event fired
  assert.ok(menuUpdateNotified, 'window._notifyMenuUpdate was triggered');
  const customerItem = win.CAFE_MENU.find(i => i.name === 'Bạc Xỉu Sữa Tươi Đặc Biệt');
  assert.ok(customerItem, 'Dish is present in customer-facing CAFE_MENU');
});

test('menu management: editing an existing dish updates name, price, and category', async () => {
  const { context, getEl, storage, win } = createMockAdminEnv();

  // Add initial item
  getEl('menu-item-name').value = 'Trà Đào Cam Sả';
  getEl('menu-item-category').value = 'Đồ uống';
  getEl('menu-item-price').value = '45000';
  getEl('menu-item-description').value = 'Trà đào thơm mát.';
  getEl('menu-item-available').checked = true;
  await context.saveMenuItem({ preventDefault() {} });

  const savedList = JSON.parse(storage['mocha_menu_items']);
  const created = savedList.find(i => i.name === 'Trà Đào Cam Sả');
  assert.ok(created);

  // Open modal in edit mode
  context.openMenuModal(created.id);
  assert.equal(getEl('menu-item-name').value, 'Trà Đào Cam Sả');
  assert.equal(getEl('menu-item-price').value, 45000);

  // Edit item
  getEl('menu-item-name').value = 'Trà Đào Cam Sả Đặc Biệt';
  getEl('menu-item-price').value = '52000';
  await context.saveMenuItem({ preventDefault() {} });

  const updatedList = JSON.parse(storage['mocha_menu_items']);
  const updated = updatedList.find(i => i.id === created.id);
  assert.equal(updated.name, 'Trà Đào Cam Sả Đặc Biệt');
  assert.equal(updated.price, 52000);

  const customerItem = win.CAFE_MENU.find(i => i.id === created.id);
  assert.equal(customerItem.name, 'Trà Đào Cam Sả Đặc Biệt');
  assert.equal(customerItem.price, 52000);
});

test('menu management: toggling availability hides dish from customer menu', async () => {
  const { context, getEl, storage, win } = createMockAdminEnv();

  // Add item
  getEl('menu-item-name').value = 'Món Tạm Hết';
  getEl('menu-item-category').value = 'Đồ ăn';
  getEl('menu-item-price').value = '50000';
  getEl('menu-item-available').checked = true;
  await context.saveMenuItem({ preventDefault() {} });

  const list = JSON.parse(storage['mocha_menu_items']);
  const item = list.find(i => i.name === 'Món Tạm Hết');
  assert.equal(item.available, true);
  assert.ok(win.CAFE_MENU.some(i => i.id === item.id), 'Dish is initially available to customer');

  // Toggle availability to false
  await context.toggleMenuAvailability(item.id);

  const updatedList = JSON.parse(storage['mocha_menu_items']);
  const toggledItem = updatedList.find(i => i.id === item.id);
  assert.equal(toggledItem.available, false, 'Dish status toggled to unavailable');

  // Must not appear in customer CAFE_MENU when unavailable
  assert.ok(!win.CAFE_MENU.some(i => i.id === item.id), 'Unavailable dish is excluded from customer menu');

  // Toggle back to true
  await context.toggleMenuAvailability(item.id);
  assert.ok(win.CAFE_MENU.some(i => i.id === item.id), 'Re-opened dish appears in customer menu again');
});

test('menu management: deleting a dish removes it from storage and customer view', async () => {
  const { context, getEl, storage, win } = createMockAdminEnv();

  // Add item
  getEl('menu-item-name').value = 'Món Sắp Bị Xóa';
  getEl('menu-item-category').value = 'Tráng miệng';
  getEl('menu-item-price').value = '30000';
  await context.saveMenuItem({ preventDefault() {} });

  const list = JSON.parse(storage['mocha_menu_items']);
  const item = list.find(i => i.name === 'Món Sắp Bị Xóa');
  assert.ok(item);

  // Open delete confirm modal
  context.openDeleteConfirm(item.id);

  // Confirm delete
  await context.confirmDeleteMenuItem();

  const afterDeleteList = JSON.parse(storage['mocha_menu_items']);
  assert.ok(!afterDeleteList.some(i => i.id === item.id), 'Item was deleted from storage');
  assert.ok(!win.CAFE_MENU.some(i => i.id === item.id), 'Item was removed from customer menu');
});

test('menu management: image handling supports base64 upload, URL, and fallback', async () => {
  const { context, getEl, storage } = createMockAdminEnv();

  // 1. Add item with simulated base64 uploaded image
  vm.runInContext("menuImageBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...';", context);
  getEl('menu-item-name').value = 'Bánh Croissant Bơ Tươi';
  getEl('menu-item-price').value = '38000';
  await context.saveMenuItem({ preventDefault() {} });

  let list = JSON.parse(storage['mocha_menu_items']);
  let item = list.find(i => i.name === 'Bánh Croissant Bơ Tươi');
  assert.equal(item.image, 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...', 'Uploaded base64 image saved');

  // 2. Add item without image falls back to default assets/menu_espresso.jpg
  vm.runInContext("menuImageBase64 = null;", context);
  getEl('menu-item-name').value = 'Cà Phê Muối';
  getEl('menu-item-price').value = '39000';
  getEl('menu-image-url').value = '';
  await context.saveMenuItem({ preventDefault() {} });

  list = JSON.parse(storage['mocha_menu_items']);
  item = list.find(i => i.name === 'Cà Phê Muối');
  assert.equal(item.image, 'assets/menu_espresso.jpg', 'Default image assigned when none provided');
});

test('menu management: Firestore empty or partial snapshot preserves locally added dishes', async () => {
  const { context, getEl, storage, win } = createMockAdminEnv();

  // Add a local custom dish
  getEl('menu-item-name').value = 'Sinh Tố Bơ Đắk Lắk';
  getEl('menu-item-category').value = 'Đồ uống';
  getEl('menu-item-price').value = '48000';
  await context.saveMenuItem({ preventDefault() {} });

  assert.ok(win.CAFE_MENU.some(i => i.name === 'Sinh Tố Bơ Đắk Lắk'), 'Local dish is in CAFE_MENU');

  // Simulate Firestore returning an empty collection []
  let snapshotCallback = null;
  win.firebaseDb = {
    collection: () => ({
      onSnapshot: (cb) => { snapshotCallback = cb; }
    })
  };
  win.loadMenuFromFirestore();

  if (snapshotCallback) {
    snapshotCallback({ docs: [] });
  }

  // The local dish MUST still be in CAFE_MENU!
  assert.ok(win.CAFE_MENU.some(i => i.name === 'Sinh Tố Bơ Đắk Lắk'), 'Local dish was preserved when Firestore returned 0 docs');
});
