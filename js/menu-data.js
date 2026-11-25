/**
 * ============================================================
 * MOCHA & MISO â€” MENU DATA (Dynamic Firestore + Hardcoded Fallback)
 * ============================================================
 * Menu items are loaded from Firestore collection 'menuItems'.
 * If Firestore is unavailable, falls back to the hardcoded default list.
 * All pages (order.html, index.html, admin.html) share this single source.
 * ============================================================
 */

// Hardcoded fallback menu â€” used when Firestore is unavailable
window.CAFE_MENU_DEFAULT = Object.freeze([
  { id: 'espresso', name: 'Espresso háº¡t tuyá»ƒn chá»n', category: 'CÃ  phÃª', price: 35000, image: 'assets/menu_espresso.jpg', description: 'HÆ°Æ¡ng anh Ä‘Ã o Ä‘en, cacao vÃ  háº­u vá»‹ caramel.' },
  { id: 'cappuccino', name: 'Cappuccino má»‹n mÃ ng', category: 'CÃ  phÃª', price: 45000, image: 'assets/menu_cappuccino.jpg', description: 'Hai shot espresso, sá»¯a bÃ©o ngáº­y vÃ  latte art.' },
  { id: 'coldbrew', name: 'Cold brew á»§ 18 giá»', category: 'CÃ  phÃª', price: 50000, image: 'assets/menu_coldbrew.jpg', description: 'MÆ°á»£t mÃ , ngá»t dá»‹u tá»± nhiÃªn cÃ¹ng cacao Ä‘en.' },
  { id: 'matcha', name: 'Matcha latte Uji', category: 'Äá»“ uá»‘ng', price: 55000, image: 'assets/menu_matcha.jpg', description: 'Matcha Uji Ä‘Ã¡nh cÃ¹ng sá»¯a yáº¿n máº¡ch thÆ¡m lÃ nh.' },
  { id: 'mocha', name: 'Mocha Ä‘Ã¡ cacao Ä‘áº­m', category: 'Äá»“ uá»‘ng', price: 55000, image: 'assets/menu_icedmocha.jpg', description: 'Espresso, cacao Ä‘en, sá»¯a láº¡nh vÃ  kem tÆ°Æ¡i.' },
  { id: 'croissant', name: 'Croissant bÆ¡ ngÃ n lá»›p', category: 'Äá»“ Äƒn', price: 40000, image: 'assets/menu_croissant.jpg', description: 'Croissant bÆ¡ kiá»ƒu PhÃ¡p, dÃ¹ng nÃ³ng cÃ¹ng má»©t nhÃ  lÃ m.' },
  { id: 'pancake', name: 'Pancake soufflÃ© bÃ´ng xá»‘p', category: 'Äá»“ Äƒn', price: 65000, image: 'assets/menu_pancakes.jpg', description: 'Quáº£ má»ng, mascarpone vÃ  si-rÃ´ lÃ¡ phong.' },
  { id: 'brioche', name: 'Brioche gÃ  hun khÃ³i', category: 'Äá»“ Äƒn', price: 75000, image: 'assets/menu_sandwich.jpg', description: 'GÃ  hun khÃ³i, bÆ¡ quáº£, cÃ  chua vÃ  aioli náº¥m truffle.' },
  { id: 'cheesecake', name: 'Cheesecake chÃ¡y kiá»ƒu Basque', category: 'TrÃ¡ng miá»‡ng', price: 55000, image: 'assets/menu_cheesecake.jpg', description: 'Máº·t bÃ¡nh caramel, ruá»™t má»m mÆ°á»£t vÃ  xá»‘t quáº£ má»ng.' },
  { id: 'linguine', name: 'Linguine háº£i sáº£n miá»n biá»ƒn', category: 'Äá»“ Äƒn', price: 95000, image: 'assets/matteophotopro2020-mussels-5342679_1920.jpg', description: 'Váº¹m, tÃ´m, nghÃªu vÃ  sÃ² Ä‘iá»‡p cÃ¹ng xá»‘t kem nghá»‡ tÃ¢y.' },
  { id: 'rose-coldbrew', name: 'Cold brew hoa há»“ng báº¡ch Ä‘áº­u kháº¥u', category: 'CÃ  phÃª', price: 55000, image: 'assets/menu_rosecoldbrew.png', description: 'Ethiopia Yirgacheffe, hoa há»“ng, báº¡ch Ä‘áº­u kháº¥u vÃ  cam.' },
  { id: 'avocado-toast', name: 'Sourdough bÆ¡ quáº£ náº¥m truffle', category: 'Äá»“ Äƒn', price: 70000, image: 'assets/menu_avocadotoast.png', description: 'BÆ¡ Hass, trá»©ng cháº§n, rau máº§m vÃ  náº¥m truffle.' },
  { id: 'katsu-sando', name: 'Sandwich gÃ  katsu giÃ²n', category: 'Äá»“ Äƒn', price: 80000, image: 'assets/menu_katsusando.png', description: 'GÃ  panko, báº¯p cáº£i, tonkatsu vÃ  mayonnaise Nháº­t.' },
  { id: 'matcha-opera', name: 'BÃ¡nh opera matcha lÃ¡ vÃ ng', category: 'TrÃ¡ng miá»‡ng', price: 60000, image: 'assets/menu_matchaopera.png', description: 'Háº¡nh nhÃ¢n, kem bÆ¡ matcha Uji vÃ  ganache chocolate.' },
  { id: 'raspberry-tart', name: 'Tart há»“ trÄƒn mÃ¢m xÃ´i', category: 'TrÃ¡ng miá»‡ng', price: 60000, image: 'assets/menu_raspberrytart.png', description: 'Frangipane há»“ trÄƒn, mÃ¢m xÃ´i tÆ°Æ¡i vÃ  kem vani.' }
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
          // Mutate in-place so ORDER_MENU (const reference in order.js) stays in sync
          window.CAFE_MENU.length = 0;
          fresh.forEach(function(item) { window.CAFE_MENU.push(item); });
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
          const next = available.length > 0 ? available : [...window.CAFE_MENU_DEFAULT];
          // Mutate in-place so ORDER_MENU (const reference in order.js) stays in sync
          window.CAFE_MENU.length = 0;
          next.forEach(function(item) { window.CAFE_MENU.push(item); });
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
          const next2 = available.length > 0 ? available : [...window.CAFE_MENU_DEFAULT];
          // Mutate in-place so ORDER_MENU (const ref in order.js) stays linked
          window.CAFE_MENU.length = 0;
          next2.forEach(function(item) { window.CAFE_MENU.push(item); });
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
        category: data.category || 'Äá»“ uá»‘ng',
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
