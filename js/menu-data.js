/**
 * ============================================================
 * MOCHA & MISO — MENU DATA (Dynamic Firestore + Hardcoded Fallback)
 * ============================================================
 * Menu items are loaded from Firestore collection 'menuItems'.
 * If Firestore is unavailable, falls back to the hardcoded default list.
 * All pages (order.html, index.html, admin.html) share this single source.
 * ============================================================
 */

// Hardcoded fallback menu — used when Firestore is unavailable
window.CAFE_MENU_DEFAULT = Object.freeze([
  { id: 'espresso', name: 'Espresso hạt tuyển chọn', category: 'Cà phê', price: 35000, image: 'assets/menu_espresso.jpg', description: 'Hương anh đào đen, cacao và hậu vị caramel.' },
  { id: 'cappuccino', name: 'Cappuccino mịn màng', category: 'Cà phê', price: 45000, image: 'assets/menu_cappuccino.jpg', description: 'Hai shot espresso, sữa béo ngậy và latte art.' },
  { id: 'coldbrew', name: 'Cold brew ủ 18 giờ', category: 'Cà phê', price: 50000, image: 'assets/menu_coldbrew.jpg', description: 'Mượt mà, ngọt dịu tự nhiên cùng cacao đen.' },
  { id: 'matcha', name: 'Matcha latte Uji', category: 'Đồ uống', price: 55000, image: 'assets/menu_matcha.jpg', description: 'Matcha Uji đánh cùng sữa yến mạch thơm lành.' },
  { id: 'mocha', name: 'Mocha đá cacao đậm', category: 'Đồ uống', price: 55000, image: 'assets/menu_icedmocha.jpg', description: 'Espresso, cacao đen, sữa lạnh và kem tươi.' },
  { id: 'croissant', name: 'Croissant bơ ngàn lớp', category: 'Đồ ăn', price: 40000, image: 'assets/menu_croissant.jpg', description: 'Croissant bơ kiểu Pháp, dùng nóng cùng mứt nhà làm.' },
  { id: 'pancake', name: 'Pancake soufflé bông xốp', category: 'Đồ ăn', price: 65000, image: 'assets/menu_pancakes.jpg', description: 'Quả mọng, mascarpone và si-rô lá phong.' },
  { id: 'brioche', name: 'Brioche gà hun khói', category: 'Đồ ăn', price: 75000, image: 'assets/menu_sandwich.jpg', description: 'Gà hun khói, bơ quả, cà chua và aioli nấm truffle.' },
  { id: 'cheesecake', name: 'Cheesecake cháy kiểu Basque', category: 'Tráng miệng', price: 55000, image: 'assets/menu_cheesecake.jpg', description: 'Mặt bánh caramel, ruột mềm mượt và xốt quả mọng.' },
  { id: 'linguine', name: 'Linguine hải sản miền biển', category: 'Đồ ăn', price: 95000, image: 'assets/matteophotopro2020-mussels-5342679_1920.jpg', description: 'Vẹm, tôm, nghêu và sò điệp cùng xốt kem nghệ tây.' },
  { id: 'rose-coldbrew', name: 'Cold brew hoa hồng bạch đậu khấu', category: 'Cà phê', price: 55000, image: 'assets/menu_rosecoldbrew.png', description: 'Ethiopia Yirgacheffe, hoa hồng, bạch đậu khấu và cam.' },
  { id: 'avocado-toast', name: 'Sourdough bơ quả nấm truffle', category: 'Đồ ăn', price: 70000, image: 'assets/menu_avocadotoast.png', description: 'Bơ Hass, trứng chần, rau mầm và nấm truffle.' },
  { id: 'katsu-sando', name: 'Sandwich gà katsu giòn', category: 'Đồ ăn', price: 80000, image: 'assets/menu_katsusando.png', description: 'Gà panko, bắp cải, tonkatsu và mayonnaise Nhật.' },
  { id: 'matcha-opera', name: 'Bánh opera matcha lá vàng', category: 'Tráng miệng', price: 60000, image: 'assets/menu_matchaopera.png', description: 'Hạnh nhân, kem bơ matcha Uji và ganache chocolate.' },
  { id: 'raspberry-tart', name: 'Tart hồ trăn mâm xôi', category: 'Tráng miệng', price: 60000, image: 'assets/menu_raspberrytart.png', description: 'Frangipane hồ trăn, mâm xôi tươi và kem vani.' }
].map(item => Object.freeze(item)));

// Helper to read cached menu from localStorage (available items only for customer views)
function getInitialMenu() {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('mocha_menu_items');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const available = parsed.filter(item => item && item.available !== false);
          if (available.length > 0) return available;
        }
      }
    }
  } catch (e) {
    console.warn('[Menu Storage Warning]', e);
  }
  return [...window.CAFE_MENU_DEFAULT];
}
window.getInitialMenu = getInitialMenu;

// Start with cached or default; will be updated by Firestore or storage events
window.CAFE_MENU = getInitialMenu();

// Listeners that want to know when menu data updates
window._menuUpdateListeners = [];
window.onMenuUpdate = function(callback) {
  window._menuUpdateListeners.push(callback);
};
window._notifyMenuUpdate = function() {
  window._menuUpdateListeners.forEach(fn => { try { fn(window.CAFE_MENU); } catch(e) { console.warn('[Menu Update Listener Error]', e); } });
};

// Cross-tab real-time sync via BroadcastChannel (instant 0ms delivery across tabs)
if (typeof BroadcastChannel !== 'undefined') {
  try {
    const menuChannel = new BroadcastChannel('mocha_menu_sync');
    menuChannel.onmessage = function(event) {
      if (event.data && event.data.type === 'MENU_UPDATED') {
        const fresh = getInitialMenu();
        if (fresh && fresh.length > 0) {
          window.CAFE_MENU = fresh;
          window._notifyMenuUpdate();
        }
      }
    };
    window._broadcastMenuUpdate = function() {
      try { menuChannel.postMessage({ type: 'MENU_UPDATED' }); } catch(e) {}
    };
  } catch (e) {}
}

// Cross-tab real-time sync via localStorage storage event
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('storage', function(e) {
    if (e.key === 'mocha_menu_items' && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (Array.isArray(parsed)) {
          const available = parsed.filter(item => item && item.available !== false);
          window.CAFE_MENU = available.length > 0 ? available : [...window.CAFE_MENU_DEFAULT];
          window._notifyMenuUpdate();
        }
      } catch (err) {
        console.warn('[Menu Storage Event Error]', err);
      }
    }
  });
}

// Storage poller: ensures sync across tabs even if opened as file:/// or across browser windows
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function' && typeof setInterval !== 'undefined') {
  let lastMenuSnapshot = null;
  try {
    if (typeof localStorage !== 'undefined') {
      lastMenuSnapshot = localStorage.getItem('mocha_menu_items');
    }
  } catch(e) {}

  setInterval(function() {
    try {
      if (typeof localStorage === 'undefined') return;
      const current = localStorage.getItem('mocha_menu_items');
      if (current && current !== lastMenuSnapshot) {
        lastMenuSnapshot = current;
        const parsed = JSON.parse(current);
        if (Array.isArray(parsed)) {
          const available = parsed.filter(item => item && item.available !== false);
          window.CAFE_MENU = available.length > 0 ? available : [...window.CAFE_MENU_DEFAULT];
          window._notifyMenuUpdate();
        }
      }
    } catch(e) {}
  }, 600);
}

// Load menu from Firestore and set up real-time listener
window._menuFirestoreLoaded = false;
window._menuFirestoreUnsubscribe = null;

window.loadMenuFromFirestore = function() {
  const dbInstance = window.db || window.firebaseDb || null;
  if (!dbInstance) return;

  function processSnapshotDocs(docs) {
    const rawItems = [];
    docs.forEach(function(doc) {
      const data = typeof doc.data === 'function' ? doc.data() : doc;
      rawItems.push({
        id: doc.id || data.id,
        name: data.name || '',
        category: data.category || 'Đồ uống',
        price: Number(data.price) || 0,
        image: data.image || 'assets/menu_espresso.jpg',
        description: data.description || '',
        available: data.available !== false,
        createdAt: data.createdAt || ''
      });
    });

    // Read current local items from localStorage
    let localItems = [];
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('mocha_menu_items');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) localItems = parsed;
        }
      }
    } catch (e) {}

    // Merge: never lose locally added dishes if Firestore collection is empty or partially populated
    const mergedMap = new Map();
    // 1. Keep all valid local items
    localItems.forEach(function(item) {
      if (item && item.id) mergedMap.set(item.id, item);
    });
    // 2. Overlay Firestore documents (cloud truth)
    rawItems.forEach(function(item) {
      if (item && item.id) mergedMap.set(item.id, item);
    });

    let allItems = Array.from(mergedMap.values());
    if (allItems.length === 0) {
      allItems = window.CAFE_MENU_DEFAULT.map(function(item) { return { ...item, available: true }; });
    }

    // Sort in JavaScript (avoids Firestore missing-index / missing-field filtering)
    allItems.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));

    // Cache merged list to localStorage for offline and cross-tab sync
    try {
      if (typeof localStorage !== 'undefined' && allItems.length > 0) {
        localStorage.setItem('mocha_menu_items', JSON.stringify(allItems));
      }
    } catch (e) {}

    // Public menu only includes available items
    const availableItems = allItems
      .filter(data => data.available !== false)
      .map(item => ({ ...item, available: true }));

    window.CAFE_MENU = availableItems.length > 0 ? availableItems : [...window.CAFE_MENU_DEFAULT];
    window._menuFirestoreLoaded = true;
    window._notifyMenuUpdate();
  }

  // Compat API (firebase.firestore())
  if (typeof dbInstance.collection === 'function') {
    window._menuFirestoreUnsubscribe = dbInstance.collection('menuItems')
      .onSnapshot(function(snapshot) {
        processSnapshotDocs(snapshot.docs || []);
      }, function(error) {
        console.warn('[Menu Firestore] Could not load menu items, using cached/default:', error);
      });
    return;
  }

  // Modular API
  const methods = window.firebaseFirestoreMethods;
  if (methods && typeof methods.collection === 'function' && typeof methods.onSnapshot === 'function') {
    const colRef = methods.collection(dbInstance, 'menuItems');
    window._menuFirestoreUnsubscribe = methods.onSnapshot(colRef, function(snapshot) {
      processSnapshotDocs(snapshot.docs || []);
    }, function(error) {
      console.warn('[Menu Firestore] Could not load menu items, using cached/default:', error);
    });
  }
};
