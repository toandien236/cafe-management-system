/**
 * ============================================================
 * MOCHA & MISO — ADMIN PORTAL JAVASCRIPT
 * Admin authentication & reservation management system
 * Authentication and business data: Firebase Auth + Cloud Firestore
 * ============================================================
 */

/* ──────────────────────────────────────────────────────────
   BOOT — wait for Firebase Auth and Firestore SDKs
   ────────────────────────────────────────────────────────── */
function bootAdmin() {
  const waitForFirebase = setInterval(() => {
    const authInstance = window.firebaseAuth || window.auth || (typeof firebase !== 'undefined' ? firebase.auth() : null);
    if (authInstance && (typeof authInstance.onAuthStateChanged === 'function'
      || typeof window.firebaseAuthMethods?.onAuthStateChanged === 'function')) {
      clearInterval(waitForFirebase);
      initAdminAuth(authInstance);
      initAdminDashboard();
    }
  }, 80);

  setTimeout(() => {
    clearInterval(waitForFirebase);
    const authInstance = window.firebaseAuth || window.auth;
    if (!authInstance) {
      showLoginError('Không tải được Firebase. Vui lòng tải lại trang.');
    }
  }, 10000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootAdmin, { once: true });
} else {
  bootAdmin();
}

/* ──────────────────────────────────────────────────────────
  1. ADMIN AUTHENTICATION — Firebase Auth
  ────────────────────────────────────────────────────────── */

const ADMIN_EMAIL = 'lehwangduong@gmail.com';
let adminSessionActive = false;

function normalizeAdminEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function observeFirebaseAuth(authInstance, callback, onError) {
  if (typeof authInstance?.onAuthStateChanged === 'function') {
    return authInstance.onAuthStateChanged(callback, onError);
  }
  const methods = window.firebaseAuthMethods;
  if (typeof methods?.onAuthStateChanged === 'function') {
    return methods.onAuthStateChanged(authInstance, callback, onError);
  }
  throw new Error('Firebase Auth observer is unavailable.');
}

function adminLoginErrorMessage(error) {
  const code = String(error && error.code || '');
  if (code === 'auth/invalid-email') return 'Vui lòng nhập địa chỉ email hợp lệ.';
  if (code === 'auth/user-disabled') return 'Tài khoản quản trị này đã bị vô hiệu hóa.';
  if (code === 'auth/too-many-requests') return 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau.';
  if (code === 'auth/network-request-failed') return 'Không kết nối được máy chủ đăng nhập Firebase. Kiểm tra mạng, VPN hoặc tiện ích chặn quảng cáo rồi thử lại.';
  if (code === 'auth/unauthorized-domain') return 'Firebase chưa cho phép tên miền hiện tại. Hãy thêm localhost hoặc tên miền website vào Firebase Authentication > Settings > Authorized domains.';
  if (code === 'auth/operation-not-allowed') return 'Chưa bật đăng nhập bằng email và mật khẩu trong Firebase Authentication.';
  if (code === 'auth/configuration-not-found') return 'Firebase Authentication chưa được cấu hình cho project này.';
  if (code === 'auth/invalid-api-key') return 'Cấu hình Firebase API key không hợp lệ. Hãy kiểm tra cấu hình ứng dụng web Firebase.';
  if (['auth/invalid-credential', 'auth/invalid-login-credentials', 'auth/wrong-password', 'auth/user-not-found'].includes(code)) {
    return 'Email hoặc mật khẩu không đúng.';
  }
  return 'Không thể đăng nhập vào Firebase. Vui lòng thử lại; nếu lỗi tiếp diễn, kiểm tra Console của trình duyệt.';
}

function setAdminView(isAuthenticated) {
  const loginSection = document.getElementById('admin-login-section');
  const dashboard = document.getElementById('admin-dashboard-section');
  if (loginSection) {
    loginSection.hidden = isAuthenticated;
    loginSection.style.display = isAuthenticated ? 'none' : 'flex';
  }
  if (dashboard) {
    dashboard.hidden = !isAuthenticated;
    dashboard.style.display = isAuthenticated ? 'block' : 'none';
  }
}

function firebaseSignIn(authInstance, email, password) {
  if (typeof authInstance?.signInWithEmailAndPassword === 'function') {
    return authInstance.signInWithEmailAndPassword(email, password);
  }
  const method = window.firebaseAuthMethods?.signInWithEmailAndPassword;
  if (typeof method === 'function') return method(authInstance, email, password);
  throw new Error('Firebase sign-in method is unavailable.');
}

function firebaseSignOut(authInstance) {
  if (typeof authInstance?.signOut === 'function') return authInstance.signOut();
  const method = window.firebaseAuthMethods?.signOut;
  if (typeof method === 'function') return method(authInstance);
  throw new Error('Firebase sign-out method is unavailable.');
}

function firebasePasswordReset(authInstance, email) {
  if (typeof authInstance?.sendPasswordResetEmail === 'function') {
    return authInstance.sendPasswordResetEmail(email);
  }
  const method = window.firebaseAuthMethods?.sendPasswordResetEmail;
  if (typeof method === 'function') return method(authInstance, email);
  throw new Error('Firebase password reset method is unavailable.');
}

function firestoreErrorCode(error) {
  return String(error && error.code || 'unknown').replace(/^firestore\//, '');
}

function logFirestoreDiagnostic(operation, error, {
  paths = [], authInstance = null, step = 'unspecified', operations = null
} = {}) {
  const resolvedAuth = authInstance || window.firebaseAuth || window.auth || null;
  const currentUser = resolvedAuth && resolvedAuth.currentUser;
  const details = {
    code: firestoreErrorCode(error),
    step,
    paths,
    auth: {
      signedIn: Boolean(currentUser),
      adminEmailMatches: Boolean(currentUser && normalizeAdminEmail(currentUser.email) === ADMIN_EMAIL)
    }
  };
  if (Array.isArray(operations)) details.operations = operations;
  console.warn(`[Firestore] ${operation}`, details);
}

function firestoreUserMessage(operation, error, step = '') {
  const code = firestoreErrorCode(error);
  if (code === 'unauthenticated') {
    return operation === 'read-visit-history'
      ? 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại bằng tài khoản quản trị để xem lịch sử lượt ghé.'
      : operation === 'delete-reservation'
        ? 'Phiên đăng nhập đã hết hạn; đặt bàn chưa bị xóa.'
        : operation === 'update-reservation-status'
          ? 'Phiên đăng nhập đã hết hạn; trạng thái đặt bàn chưa được cập nhật.'
          : 'Bạn chưa đăng nhập bằng tài khoản quản trị; chưa ghi nhận lượt ghé.';
  }
  if (code === 'permission-denied') {
    if (operation === 'update-reservation-status') {
      return step === 'preflight-auth'
        ? 'Tài khoản đang đăng nhập không khớp tài khoản quản trị được cấu hình.'
        : 'Firestore từ chối cập nhật đặt bàn. Trạng thái đã được hoàn tác; kiểm tra email admin và Rules đang áp dụng.';
    }
    if (operation === 'create-reservation-visit' && step === 'read-reservation') {
      return 'Firestore từ chối đọc đặt bàn. Kiểm tra quyền admin trong Rules đang áp dụng cho project này.';
    }
    if (operation === 'delete-reservation' && step === 'read-reservation') {
      return 'Firestore từ chối đọc đặt bàn; đặt bàn chưa bị xóa. Kiểm tra quyền đọc admin của /reservations trong Rules đang áp dụng.';
    }
    if (step === 'read-existing-visit') {
      return operation === 'delete-reservation'
        ? 'Firestore từ chối đọc reservationVisits; đặt bàn chưa bị xóa. Rules đang áp dụng cần cho admin đọc lịch sử lượt ghé.'
        : 'Firestore từ chối đọc reservationVisits. Rules đang áp dụng cần cho admin đọc lịch sử lượt ghé.';
    }
    if (operation === 'delete-reservation' && step === 'preserve-visit-customer') {
      return 'Firestore từ chối cập nhật snapshot khách của lượt ghé cũ; đặt bàn và lịch sử đều được giữ nguyên.';
    }
    if (operation === 'delete-reservation' && step === 'delete-reservation') {
      return 'Firestore từ chối thao tác xóa /reservations; đặt bàn chưa bị xóa. Log chẩn đoán ghi rõ path và trạng thái đăng nhập.';
    }
    if (operation === 'delete-reservation' && step === 'commit-transaction') {
      return 'Firestore từ chối commit transaction xóa. Đặt bàn và lượt ghé vẫn được giữ; lỗi commit nguyên tử không chỉ ra write nào bị từ chối. Xem log chẩn đoán để biết các thao tác đã thử.';
    }
    if (operation === 'create-reservation-visit' && ['create-visit', 'commit-transaction'].includes(step)) {
      return 'Firestore từ chối tạo lượt ghé. Kiểm tra Rules đang áp dụng có khớp schema và reservation confirmed không.';
    }
    return operation === 'read-visit-history'
      ? 'Firestore từ chối đọc lịch sử lượt ghé. Hãy kiểm tra tài khoản quản trị và Rules đã triển khai.'
      : operation === 'delete-reservation'
        ? 'Firestore từ chối thao tác xóa. Hãy kiểm tra tài khoản quản trị và Rules đã triển khai; đặt bàn chưa bị xóa.'
        : 'Firestore từ chối ghi lượt ghé. Hãy kiểm tra tài khoản quản trị và Rules đã triển khai.';
  }
  if (code === 'not-found') {
    return operation === 'update-reservation-status'
      ? 'Không tìm thấy đặt bàn trên Firestore; trạng thái chưa được cập nhật.'
      : operation === 'delete-reservation'
      ? 'Không tìm thấy đặt bàn trên Firestore; không có dữ liệu nào bị xóa.'
      : 'Không tìm thấy đặt bàn trên Firestore; chưa ghi nhận lượt ghé.';
  }
  if (['reservation-not-found', 'reservation-not-confirmed', 'reservation-invalid'].includes(code)) {
    return code === 'reservation-not-found'
      ? 'Không tìm thấy đặt bàn trên Firestore; chưa ghi nhận lượt ghé.'
      : 'Đặt bàn không còn hợp lệ hoặc chưa ở trạng thái đã xác nhận; chưa ghi nhận lượt ghé.';
  }
  if (code === 'failed-precondition') {
    return 'Firestore chưa đáp ứng điều kiện của thao tác. Kiểm tra Rules, cấu hình Firestore và log chẩn đoán.';
  }
  if (['unavailable', 'deadline-exceeded', 'network-request-failed'].includes(code)) {
    return operation === 'update-reservation-status'
      ? 'Mất kết nối Firestore; trạng thái đã được hoàn tác và chưa cập nhật lên máy chủ.'
      : 'Không kết nối được Firestore. Kiểm tra mạng rồi thử lại; chưa xác nhận thay đổi.';
  }
  return operation === 'read-visit-history'
    ? 'Không tải được lịch sử lượt ghé. Đặt bàn vẫn được giữ nguyên; hãy thử lại sau.'
    : operation === 'delete-reservation'
      ? 'Không thể kiểm tra/xóa đặt bàn an toàn. Đặt bàn chưa bị xóa; hãy thử lại sau.'
      : 'Không thể ghi nhận lượt ghé. Kiểm tra log Firestore và thử lại.';
}

function initAdminAuth(authInstance) {
  const loginSection = document.getElementById('admin-login-section');
  const dashboard = document.getElementById('admin-dashboard-section');
  const loginForm = document.getElementById('admin-login-form');
  const logoutButton = document.getElementById('admin-logout-btn');
  const emailDisplay = document.getElementById('logged-admin-email');
  const resetButton = document.getElementById('admin-forgot-password');

  // ── Session state driven by Firebase Auth ──────────────────
  observeFirebaseAuth(authInstance, async (user) => {
    // This client check only controls the admin UI; Firestore Rules remain authoritative.
    if (user && normalizeAdminEmail(user.email) === ADMIN_EMAIL) {
      // Authenticated: show dashboard
      adminSessionActive = true;
      if (emailDisplay) emailDisplay.textContent = user.email;
      setAdminView(true);
      if (loginForm) {
        const existingError = loginForm.querySelector('.form-error');
        if (existingError) existingError.remove();
        const passwordInput = document.getElementById('admin-password');
        if (passwordInput) passwordInput.value = '';
      }
      loadReservations();
      loadReservationVisits();
      loadOrders();
    } else {
      // Not authenticated: show login
      adminSessionActive = false;
      setAdminView(false);
      stopReservationVisitsListener();
      serverAcknowledgedVisits.clear();
      if (ordersUnsubscribe) {
        ordersUnsubscribe();
        ordersUnsubscribe = null;
      }
      const customerModal = document.getElementById('customer-profile-modal');
      const customerProfileBody = document.getElementById('customer-profile-body');
      const replyModal = document.getElementById('reply-modal');
      if (customerModal) customerModal.hidden = true;
      if (replyModal) replyModal.hidden = true;
      if (customerProfileBody) customerProfileBody.textContent = '';
      const replyEmail = document.getElementById('modal-guest-email');
      const replyMessage = document.getElementById('modal-message');
      if (replyEmail) replyEmail.value = '';
      if (replyMessage) replyMessage.value = '';
      selectedCustomerKey = null;
      allReservations = [];
      allVisits = [];
      allOrders = [];
      currentOrdersPage = 1;
      updateStats();
      renderTable();
      renderCustomers();
      renderOrders();

      if (user) {
        await firebaseSignOut(authInstance);
        showLoginError('Tài khoản này không có quyền truy cập cổng quản trị.');
      }
    }
  }, (error) => {
    console.error('[Firebase Auth State Error]', error && error.code);
    showLoginError('Không thể xác minh trạng thái đăng nhập Firebase. Kiểm tra kết nối mạng rồi tải lại trang.');
  });

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const emailInput = document.getElementById('admin-email');
      const passInput  = document.getElementById('admin-password');
      const submitBtn  = document.getElementById('admin-login-submit');
      const btnText    = submitBtn ? submitBtn.querySelector('.btn-text') : null;

      const email = normalizeAdminEmail(emailInput ? emailInput.value : '');
      // Passwords are opaque strings; trimming can silently change a valid
      // Firebase password that intentionally starts or ends with spaces.
      const pass  = passInput ? passInput.value : '';

      // Clear previous error
      const existingErr = loginForm.querySelector('.form-error');
      if (existingErr) existingErr.remove();

      if (!email || !pass) {
        showLoginError('Vui lòng nhập email quản trị và mật khẩu.');
        return;
      }

      if (email !== ADMIN_EMAIL) {
        showLoginError('Email này không có quyền truy cập cổng quản trị.');
        return;
      }
      if (submitBtn) submitBtn.disabled = true;
      if (btnText) btnText.textContent = 'Đang xác minh…';
      try {
        // Firebase Auth is the ONLY authentication gate
        await firebaseSignIn(authInstance, email, pass);
        // onAuthStateChanged above handles the view switch
      } catch (err) {
        console.error('[Admin Login Error]', err.code, err.message);
        showLoginError(adminLoginErrorMessage(err));
      } finally {
        if (submitBtn) submitBtn.disabled = false;
        if (btnText) btnText.textContent = 'Đăng nhập';
      }
    });
  }

  if (resetButton) {
    resetButton.addEventListener('click', async () => {
      const emailInput = document.getElementById('admin-email');
      const email = normalizeAdminEmail(emailInput ? emailInput.value : '');
      if (email !== ADMIN_EMAIL) {
        showLoginError(`Nhập đúng email quản trị ${ADMIN_EMAIL} để nhận liên kết đặt lại mật khẩu.`);
        return;
      }
      try {
        await firebasePasswordReset(authInstance, email);
        showLoginError('Đã gửi liên kết đặt lại mật khẩu đến email quản trị. Hãy kiểm tra cả thư mục Spam.');
      } catch (err) {
        console.error('[Admin Password Reset Error]', err.code, err.message);
        showLoginError('Không thể gửi email đặt lại mật khẩu. Hãy kiểm tra user này đã tồn tại trong Firebase.');
      }
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
      try {
        await firebaseSignOut(authInstance);
        // onAuthStateChanged above will flip back to login view
        if (loginForm) loginForm.reset();
      } catch (error) {
        console.error('[Firebase Admin Logout Error]', error);
        showToast('Không thể đăng xuất khỏi Firebase.', 'error');
      }
    });
  }
}

function showLoginError(msg) {
  const loginForm = document.getElementById('admin-login-form');
  if (!loginForm) return;
  const existingErr = loginForm.querySelector('.form-error');
  if (existingErr) existingErr.remove();

  const errEl = document.createElement('div');
  errEl.className = 'form-error';
  errEl.setAttribute('role', 'alert');
  errEl.textContent = msg;
  loginForm.appendChild(errEl);
}

/* ──────────────────────────────────────────────────────────
   2. RESERVATION MANAGEMENT & DASHBOARD
   ────────────────────────────────────────────────────────── */
let allReservations = [];
let activeFilter    = 'all';
let searchQuery     = '';
let allOrders       = [];
let ordersUnsubscribe = null;
const ORDERS_PER_PAGE = 15;
let currentOrdersPage = 1;
let allVisits       = [];
let visitLoadState   = 'loading';
let reservationLoadState = 'loading';
let customerSearchQuery = '';
let selectedCustomerKey = null;
const visitSavingIds = new Set();
const serverAcknowledgedVisits = new Map();
let reservationVisitsUnsubscribe = null;
let reservationVisitsListenerGeneration = 0;

function initAdminDashboard() {
  // Filter tabs
  const tabs = document.querySelectorAll('.admin-filter-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeFilter = tab.getAttribute('data-filter') || 'all';
      renderTable();
    });
  });

  // Search input
  const searchInput = document.getElementById('admin-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = normalizeCustomerSearch(e.target.value);
      renderTable();
    });
  }

  const customerSearchInput = document.getElementById('customer-search');
  if (customerSearchInput) {
    customerSearchInput.addEventListener('input', (e) => {
      customerSearchQuery = e.target.value;
      renderCustomers();
    });
  }

  const customersBody = document.getElementById('customers-tbody');
  if (customersBody) {
    customersBody.addEventListener('click', (event) => {
      const profileButton = event.target.closest('[data-customer-key]');
      if (profileButton) {
        openCustomerProfile(profileButton.dataset.customerKey);
        return;
      }
      const visitButton = event.target.closest('[data-visit-res-id]');
      if (visitButton) recordReservationVisit(visitButton.dataset.visitResId);
    });
  }

  const bookingsBody = document.getElementById('bookings-tbody');
  if (bookingsBody) {
    bookingsBody.addEventListener('click', (event) => {
      const visitButton = event.target.closest('[data-visit-res-id]');
      if (visitButton) recordReservationVisit(visitButton.dataset.visitResId);
    });
  }

  const customerProfileBody = document.getElementById('customer-profile-body');
  if (customerProfileBody) {
    customerProfileBody.addEventListener('click', (event) => {
      const visitButton = event.target.closest('[data-visit-res-id]');
      if (visitButton) recordReservationVisit(visitButton.dataset.visitResId);
    });
  }

  const customerModal = document.getElementById('customer-profile-modal');
  const closeCustomerModal = () => {
    if (customerModal) customerModal.hidden = true;
    selectedCustomerKey = null;
  };
  const closeCustomerButton = document.getElementById('customer-profile-close');
  if (closeCustomerButton) closeCustomerButton.addEventListener('click', closeCustomerModal);
  if (customerModal) {
    customerModal.addEventListener('click', (event) => {
      if (event.target === customerModal) closeCustomerModal();
    });
    customerModal.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeCustomerModal();
    });
  }
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && customerModal && !customerModal.hidden) closeCustomerModal();
  });

  // Modal close handlers
  const cancelBtn = document.getElementById('modal-cancel-btn');
  const modal     = document.getElementById('reply-modal');
  if (cancelBtn && modal) {
    cancelBtn.addEventListener('click', () => { modal.hidden = true; });
  }

  // Send Email trigger
  const sendBtn = document.getElementById('modal-send-btn');
  if (sendBtn) {
    sendBtn.addEventListener('click', () => {
      const guestEmail = document.getElementById('modal-guest-email').value;
      const subject    = document.getElementById('modal-subject').value;
      const body       = document.getElementById('modal-message').value;

      const mailtoUrl = `mailto:${encodeURIComponent(guestEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.location.href = mailtoUrl;

      if (modal) modal.hidden = true;
    });
  }
}

function loadReservations() {
  const tbody = document.getElementById('bookings-tbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px;">Đang tải danh sách đặt bàn…</td></tr>';
  reservationLoadState = 'loading';
  renderCustomers();

  // Read local backup array
  let localData = [];
  try {
    localData = JSON.parse(localStorage.getItem('mocha_reservations') || '[]');
    localData = localData.map((item, idx) => ({
      ...item,
      id: `local_${idx}_${item.createdAt || ''}`,
      isLocal: true
    }));
  } catch (err) {
    console.warn('LocalStorage read error:', err);
  }

  // Try Firestore live listener
  const dbInstance = window.db || window.firebaseDb || (typeof db !== 'undefined' ? db : null);

  if (dbInstance && typeof dbInstance.collection === 'function') {
    dbInstance.collection('reservations').onSnapshot((snapshot) => {
      if (!adminSessionActive) return;
      const remoteData = [];
      snapshot.forEach(doc => {
        remoteData.push({ ...doc.data(), id: doc.id, isLocal: false });
      });

      // Firestore is authoritative when connected; local drafts are not global bookings.
      allReservations = remoteData;
      reservationLoadState = 'ready';
      // Sort newest first
      allReservations.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      updateStats();
      renderTable();
      renderCustomers();
    }, (error) => {
      if (!adminSessionActive) return;
      console.warn('Firestore snapshot notice, rendering local backup:', error);
      allReservations = localData;
      reservationLoadState = 'error';
      updateStats();
      renderTable();
      renderCustomers();
      showToast('Không tải được đặt bàn từ Firestore. Số liệu hiện chỉ gồm dữ liệu lưu trên thiết bị này.', 'error');
    });
  } else {
    allReservations = localData;
    reservationLoadState = 'local';
    updateStats();
    renderTable();
    renderCustomers();
  }
}

function updateStats() {
  const totalEl     = document.getElementById('stat-total');
  const pendingEl   = document.getElementById('stat-pending');
  const confirmedEl = document.getElementById('stat-confirmed');
  const guestsEl    = document.getElementById('stat-guests');

  const total     = allReservations.length;
  const pending   = allReservations.filter(r => (r.status || 'Pending').toLowerCase() === 'pending').length;
  const confirmed = allReservations.filter(r => (r.status || '').toLowerCase() === 'confirmed').length;
  const guests    = allReservations.reduce((sum, r) => sum + (parseInt(r.guests, 10) || 2), 0);

  if (totalEl) totalEl.textContent = total;
  if (pendingEl) pendingEl.textContent = pending;
  if (confirmedEl) confirmedEl.textContent = confirmed;
  if (guestsEl) guestsEl.textContent = guests;
}

function stopReservationVisitsListener() {
  reservationVisitsListenerGeneration += 1;
  if (typeof reservationVisitsUnsubscribe === 'function') {
    reservationVisitsUnsubscribe();
  }
  reservationVisitsUnsubscribe = null;
}

function mergeAcknowledgedVisits(snapshotVisits) {
  const visitsByReservationId = new Map();
  snapshotVisits.forEach(visit => {
    const reservationId = getVisitReservationId(visit);
    if (!reservationId) return;
    const normalizedVisit = { ...visit, id: visit.id || reservationId, reservationId };
    visitsByReservationId.set(reservationId, normalizedVisit);
    serverAcknowledgedVisits.set(reservationId, normalizedVisit);
  });
  serverAcknowledgedVisits.forEach((visit, reservationId) => {
    if (!visitsByReservationId.has(reservationId)) visitsByReservationId.set(reservationId, visit);
  });
  return Array.from(visitsByReservationId.values());
}

function loadReservationVisits() {
  stopReservationVisitsListener();
  const listenerGeneration = reservationVisitsListenerGeneration;
  const dbInstance = window.db || window.firebaseDb || (typeof db !== 'undefined' ? db : null);
  if (!dbInstance || typeof dbInstance.collection !== 'function') {
    visitLoadState = 'unavailable';
    renderTable();
    renderCustomers();
    return;
  }

  visitLoadState = 'loading';
  renderTable();
  reservationVisitsUnsubscribe = dbInstance.collection('reservationVisits').onSnapshot((snapshot) => {
    if (!adminSessionActive || listenerGeneration !== reservationVisitsListenerGeneration) return;
    const snapshotVisits = [];
    snapshot.forEach(doc => snapshotVisits.push({ ...doc.data(), id: doc.id }));
    allVisits = mergeAcknowledgedVisits(snapshotVisits);
    visitLoadState = 'ready';
    renderTable();
    renderCustomers();
  }, (error) => {
    if (!adminSessionActive || listenerGeneration !== reservationVisitsListenerGeneration) return;
    logFirestoreDiagnostic('read-visit-history', error, {
      paths: ['/reservationVisits'],
      step: 'listen-collection'
    });
    allVisits = mergeAcknowledgedVisits([]);
    visitLoadState = 'error';
    renderTable();
    renderCustomers();
    showToast(firestoreUserMessage('read-visit-history', error), 'error');
  });
}

function normalizeCustomerEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function getCustomerIdentityEmail(reservation) {
  const email = normalizeCustomerEmail(reservation && reservation.email);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function normalizeCustomerPhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('0084') && digits.length >= 13) digits = `0${digits.slice(4)}`;
  if (digits.startsWith('84') && digits.length >= 11) digits = `0${digits.slice(2)}`;
  return digits;
}

function normalizeCustomerSearch(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

function getCustomerReservationName(reservation) {
  return String(reservation.customerName || '').trim() || String(reservation.name || '').trim();
}

function getCustomerReservationPhone(reservation) {
  return String(reservation.phone || '').trim();
}

function getReservationSortKey(reservation) {
  const date = String(reservation.date || '');
  const time = String(reservation.time || '').replace(':', '').padStart(4, '0');
  return `${date}T${time}|${String(getReservationCreatedAt(reservation)).padStart(16, '0')}`;
}

function getReservationCreatedAt(reservation) {
  const value = reservation && (reservation.createdAt || reservation.created_at);
  if (!value) return 0;
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function addReservationToCustomer(profile, reservation) {
  profile.reservations.push(reservation);
}

function buildVisitCustomerSnapshot(reservation, reservationId) {
  const email = getCustomerIdentityEmail(reservation);
  const phone = getCustomerReservationPhone(reservation);
  const phoneNormalized = normalizeCustomerPhone(phone);
  const stableReservationId = String(reservationId || reservation.id || 'unknown');
  const key = email
    ? `email:${email}`
    : phoneNormalized
      ? `phone:${phoneNormalized}`
      : `reservation:${stableReservationId}`;
  return {
    key,
    name: getCustomerReservationName(reservation),
    email,
    phone,
    phoneNormalized
  };
}

function isVisitCustomerSnapshotValid(customer) {
  const allowedKeys = ['email', 'key', 'name', 'phone', 'phoneNormalized'];
  const customerKeys = customer && typeof customer === 'object' && !Array.isArray(customer)
    ? Object.keys(customer).sort()
    : [];
  return Boolean(customer && typeof customer === 'object' && !Array.isArray(customer)
    && customerKeys.length === allowedKeys.length
    && allowedKeys.every((key, index) => customerKeys[index] === key)
    && typeof customer.key === 'string' && customer.key.length > 0 && customer.key.length <= 300
    && typeof customer.name === 'string' && customer.name.length <= 500
    && typeof customer.email === 'string' && customer.email.length <= 512
    && typeof customer.phone === 'string' && customer.phone.length <= 100
    && typeof customer.phoneNormalized === 'string' && customer.phoneNormalized.length <= 40);
}

function buildCustomerProfiles() {
  const profilesByKey = new Map();
  const emailGroupsByPhone = new Map();
  const reservationProfileKeyById = new Map();
  const reservationsWithoutEmail = [];

  const ensureProfile = (key, ambiguousPhoneMatch = false) => {
    if (!profilesByKey.has(key)) {
      profilesByKey.set(key, { key, reservations: [], visits: [], customerSnapshots: [], ambiguousPhoneMatch });
    } else if (ambiguousPhoneMatch) {
      profilesByKey.get(key).ambiguousPhoneMatch = true;
    }
    return profilesByKey.get(key);
  };

  allReservations.forEach((reservation, index) => {
    const email = getCustomerIdentityEmail(reservation);
    const phone = normalizeCustomerPhone(getCustomerReservationPhone(reservation));
    if (!email) {
      reservationsWithoutEmail.push({ reservation, phone, index });
      return;
    }

    const key = `email:${email}`;
    addReservationToCustomer(ensureProfile(key), reservation);
    if (reservation.id) reservationProfileKeyById.set(String(reservation.id), key);
    if (phone.length >= 7) {
      if (!emailGroupsByPhone.has(phone)) emailGroupsByPhone.set(phone, new Set());
      emailGroupsByPhone.get(phone).add(key);
    }
  });

  emailGroupsByPhone.forEach(owners => {
    if (owners.size > 1) owners.forEach(key => ensureProfile(key, true));
  });

  const phoneOnlyGroups = new Map();
  reservationsWithoutEmail.forEach(({ reservation, phone, index }) => {
    if (phone.length < 7) {
      const key = `reservation:${reservation.id || index}`;
      addReservationToCustomer(ensureProfile(key), reservation);
      if (reservation.id) reservationProfileKeyById.set(String(reservation.id), key);
      return;
    }
    if (!phoneOnlyGroups.has(phone)) phoneOnlyGroups.set(phone, []);
    phoneOnlyGroups.get(phone).push(reservation);
  });

  phoneOnlyGroups.forEach((reservations, phone) => {
    const owners = emailGroupsByPhone.get(phone) || new Set();
    // A phone-only booking joins an email profile only when the phone points
    // to exactly one email. A phone known to belong to multiple email profiles
    // is too ambiguous to use for merging, even across other phone-only bookings.
    if (owners.size > 1) {
      reservations.forEach((reservation, index) => {
        const key = `reservation:${reservation.id || `ambiguous-phone-${phone}-${index}`}`;
        addReservationToCustomer(ensureProfile(key, true), reservation);
        if (reservation.id) reservationProfileKeyById.set(String(reservation.id), key);
      });
      return;
    }
    const key = owners.size === 1 ? Array.from(owners)[0] : `phone:${phone}`;
    const profile = ensureProfile(key);
    reservations.forEach(reservation => {
      addReservationToCustomer(profile, reservation);
      if (reservation.id) reservationProfileKeyById.set(String(reservation.id), key);
    });
  });

  const reservationsById = new Map(allReservations.filter(reservation => reservation.id)
    .map(reservation => [String(reservation.id), reservation]));
  const visitsByReservationId = new Map();
  allVisits.forEach(visit => {
    const reservationId = getVisitReservationId(visit);
    if (reservationId) visitsByReservationId.set(reservationId, visit);
  });

  visitsByReservationId.forEach((visit, reservationId) => {
    const linkedReservation = reservationsById.get(reservationId);
    const storedCustomer = visit.customer && typeof visit.customer === 'object' ? visit.customer : null;
    const customer = isVisitCustomerSnapshotValid(storedCustomer)
      ? storedCustomer
      : linkedReservation
        ? buildVisitCustomerSnapshot(linkedReservation, reservationId)
        : storedCustomer;
    const email = getCustomerIdentityEmail({ email: customer && customer.email });
    const phone = normalizeCustomerPhone(customer && (customer.phoneNormalized || customer.phone));
    let key = reservationProfileKeyById.get(reservationId);
    let ambiguousPhoneMatch = false;
    if (!key && email) {
      key = `email:${email}`;
    } else if (!key && phone.length >= 7) {
      const owners = emailGroupsByPhone.get(phone) || new Set();
      if (owners.size === 1) {
        key = Array.from(owners)[0];
      } else if (owners.size > 1) {
        key = `visit:${reservationId}`;
        ambiguousPhoneMatch = true;
      } else {
        key = `phone:${phone}`;
      }
    }
    if (!key) {
      const storedKey = String(customer && customer.key || '');
      key = /^(?:reservation|visit):/.test(storedKey) ? storedKey : `visit:${reservationId}`;
    }
    const profile = ensureProfile(key, ambiguousPhoneMatch);
    profile.visits.push({ ...visit, id: visit.id || reservationId, reservationId });
    if (customer) profile.customerSnapshots.push(customer);
  });

  return Array.from(profilesByKey.values()).map(profile => {
    profile.reservations.sort((a, b) => getReservationSortKey(b).localeCompare(getReservationSortKey(a)));
    profile.latestReservation = profile.reservations[0] || null;
    const names = Array.from(new Set([
      ...profile.reservations.map(getCustomerReservationName),
      ...profile.customerSnapshots.map(customer => String(customer.name || '').trim())
    ].filter(Boolean)));
    const emails = Array.from(new Set([
      ...profile.reservations.map(res => normalizeCustomerEmail(res.email)),
      ...profile.customerSnapshots.map(customer => normalizeCustomerEmail(customer.email))
    ].filter(Boolean)));
    const phonesByNormalizedValue = new Map();
    const phoneValues = [
      ...profile.reservations.map(getCustomerReservationPhone),
      ...profile.customerSnapshots.map(customer => String(customer.phone || ''))
    ];
    phoneValues.forEach(phone => {
      if (!phone) return;
      const normalizedPhone = normalizeCustomerPhone(phone);
      const key = normalizedPhone || `raw:${phone}`;
      if (!phonesByNormalizedValue.has(key)) phonesByNormalizedValue.set(key, phone);
    });
    const phones = Array.from(phonesByNormalizedValue.values());
    profile.name = names[0] || 'Khách chưa có tên';
    profile.names = names;
    profile.emails = emails;
    profile.phones = phones;
    profile.visits.sort((a, b) => getVisitDate(b) - getVisitDate(a));
    profile.latestVisit = profile.visits[0] || null;
    return profile;
  }).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}

function getVisitDate(visit) {
  const value = visit && (visit.recordedAt || visit.visitedAt);
  if (!value) return 0;
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function getVisitReservationId(visit) {
  return String((visit && (visit.reservationId || visit.id)) || '');
}

function formatVisitDate(visit) {
  const timestamp = getVisitDate(visit);
  if (!timestamp) return 'Chưa ghi nhận lượt ghé';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh'
  }).format(new Date(timestamp));
}

function getVisitLoadMessage() {
  if (visitLoadState === 'loading') return 'Đang tải lịch sử lượt ghé...';
  if (visitLoadState === 'error') return 'Không tải được dữ liệu lượt ghé';
  if (visitLoadState === 'unavailable') return 'Chưa kết nối dữ liệu lượt ghé';
  return 'Chưa có lượt ghé được xác nhận';
}

function renderCustomers() {
  const tbody = document.getElementById('customers-tbody');
  const customerCountEl = document.getElementById('care-customer-count');
  const reservationCountEl = document.getElementById('care-reservation-count');
  const latestReservationEl = document.getElementById('care-last-reservation');
  const noticeEl = document.getElementById('customer-load-notice');
  if (!tbody) return;

  if (noticeEl) {
    const notices = [];
    if (reservationLoadState === 'error') {
      notices.push('Không tải được đặt bàn từ Firestore; dữ liệu đang hiển thị chỉ là bản sao cục bộ trên thiết bị này.');
    } else if (reservationLoadState === 'local') {
      notices.push('Chưa kết nối Firestore; hồ sơ chỉ gồm dữ liệu đặt bàn cục bộ trên thiết bị này.');
    }
    if (visitLoadState === 'error') notices.push('Không tải được lịch sử lượt ghé.');
    noticeEl.textContent = notices.join(' ');
    noticeEl.hidden = notices.length === 0;
    if (noticeEl.classList) {
      noticeEl.classList.toggle('customer-load-notice--error', reservationLoadState === 'error' || visitLoadState === 'error');
    }
  }

  if (reservationLoadState === 'loading') {
    if (customerCountEl) customerCountEl.textContent = '…';
    if (reservationCountEl) reservationCountEl.textContent = '…';
    if (latestReservationEl) latestReservationEl.textContent = 'Đang tải…';
    tbody.innerHTML = '<tr><td colspan="6" class="customer-care-empty">Đang tải hồ sơ khách…</td></tr>';
    return;
  }

  const profiles = buildCustomerProfiles();
  const reservationCount = allReservations.length;
  const latestReservation = allReservations.reduce((latest, reservation) => (
    !latest || getReservationCreatedAt(reservation) > getReservationCreatedAt(latest)
      ? reservation
      : latest
  ), null);
  if (customerCountEl) {
    customerCountEl.textContent = reservationLoadState === 'local'
      ? `${profiles.length} · trên thiết bị`
      : String(profiles.length);
  }
  if (reservationCountEl) reservationCountEl.textContent = String(reservationCount);
  if (latestReservationEl) {
    latestReservationEl.textContent = latestReservation
      ? String(latestReservation.date || 'Chưa có ngày')
      : 'Chưa có';
  }

  const normalizedQuery = normalizeCustomerSearch(customerSearchQuery);
  const queryDigits = normalizeCustomerPhone(customerSearchQuery);
  const filtered = profiles.filter(profile => {
    if (!normalizedQuery) return true;
    const values = [profile.name, ...profile.names, ...profile.emails, ...profile.phones];
    const textMatch = values.some(value => normalizeCustomerSearch(value).includes(normalizedQuery));
    const phoneMatch = queryDigits.length >= 3 && profile.phones.some(phone => normalizeCustomerPhone(phone).includes(queryDigits));
    return textMatch || phoneMatch;
  });

  if (filtered.length === 0) {
    let message = 'Không tìm thấy khách hàng phù hợp.';
    if (!profiles.length) {
      message = reservationLoadState === 'error'
        ? 'Không thể tải hồ sơ khách hàng từ Firestore.'
        : reservationLoadState === 'local'
          ? 'Chưa có dữ liệu đặt bàn trên thiết bị này.'
          : 'Chưa có dữ liệu đặt bàn để tổng hợp hồ sơ.';
    }
    tbody.innerHTML = `<tr><td colspan="6" class="customer-care-empty">${message}</td></tr>`;
  } else {
    tbody.innerHTML = filtered.map(profile => {
      const emails = profile.emails.length
        ? profile.emails.map(email => `<span class="customer-contact-line">${escapeHtml(email)}</span>`).join('')
        : '<span class="customer-contact-line">Chưa cung cấp</span>';
      const phones = profile.phones.length
        ? profile.phones.map(phone => `<span class="customer-contact-line">${escapeHtml(phone)}</span>`).join('')
        : '<span class="customer-contact-line">Chưa cung cấp</span>';
      const duplicateHint = profile.ambiguousPhoneMatch
        ? '<span class="customer-contact-line">Số điện thoại có hồ sơ email khác; chưa tự gộp</span>'
        : '';
      return `
        <tr>
          <td><strong>${escapeHtml(profile.name)}</strong>${duplicateHint}</td>
          <td>${emails}</td>
          <td>${phones}</td>
          <td>${profile.reservations.length}</td>
          <td>${escapeHtml(profile.latestReservation && profile.latestReservation.date || 'Chưa có')}</td>
          <td><button type="button" class="customer-open-profile" data-customer-key="${escapeHtml(profile.key)}">Xem hồ sơ</button></td>
        </tr>
      `;
    }).join('');
  }

  if (selectedCustomerKey) {
    const currentProfile = profiles.find(profile => profile.key === selectedCustomerKey);
    if (currentProfile) renderCustomerProfile(currentProfile);
  }
}

function openCustomerProfile(key) {
  const profile = buildCustomerProfiles().find(item => item.key === key);
  if (!profile) return;
  selectedCustomerKey = key;
  renderCustomerProfile(profile);
  const modal = document.getElementById('customer-profile-modal');
  if (modal) modal.hidden = false;
}

function renderCustomerProfile(profile) {
  const title = document.getElementById('customer-profile-title');
  const note = document.getElementById('customer-profile-description');
  const body = document.getElementById('customer-profile-body');
  if (!body) return;

  if (title) title.textContent = profile.name;
  if (note) {
    note.textContent = profile.ambiguousPhoneMatch
      ? 'Số điện thoại này xuất hiện cùng nhiều email. Các hồ sơ được giữ riêng để tránh gộp nhầm khách.'
      : 'Thông tin được tổng hợp từ các lượt đặt bàn có email hoặc số điện thoại trùng sau khi chuẩn hóa.';
  }

  const emailText = profile.emails.join(', ') || 'Chưa cung cấp';
  const phoneText = profile.phones.join(', ') || 'Chưa cung cấp';
  const latestVisitText = visitLoadState === 'ready'
    ? (profile.latestVisit ? formatVisitDate(profile.latestVisit) : 'Chưa ghi nhận lượt ghé')
    : getVisitLoadMessage();
  const bookingRows = profile.reservations.map(reservation => {
    const status = reservation.status || 'pending';
    const linkedVisit = allVisits.find(item => getVisitReservationId(item) === reservation.id);
    const isConfirmed = String(status).toLowerCase() === 'confirmed';
    const visit = isConfirmed ? linkedVisit : null;
    const localOnly = reservation.isLocal || String(reservation.id || '').startsWith('local_');
    let visitControl;
    if (visit) {
      visitControl = `<span class="customer-visit-state">Đã ghi nhận · ${escapeHtml(formatVisitDate(visit))}</span>`;
    } else if (linkedVisit) {
      visitControl = '<span class="customer-visit-unavailable" title="Bản ghi lịch sử cần được quản trị viên rà soát">Bản ghi chưa được tính</span>';
    } else if (visitSavingIds.has(reservation.id)) {
      visitControl = '<button type="button" class="btn-action btn-action--reply" disabled>Đang ghi nhận...</button>';
    } else if (localOnly) {
      visitControl = '<button type="button" class="btn-action btn-action--reply" disabled title="Đặt bàn chỉ có trên thiết bị này">Chỉ có dữ liệu cục bộ</button>';
    } else if (!isConfirmed) {
      const statusMessage = String(status).toLowerCase() === 'cancelled'
        ? 'Đặt bàn đã hủy'
        : 'Chỉ ghi nhận khi đã xác nhận';
      visitControl = `<span class="customer-visit-unavailable">${statusMessage}</span>`;
    } else {
      visitControl = `<button type="button" class="btn-action btn-action--approve" data-visit-res-id="${escapeHtml(reservation.id)}">Ghi nhận đã ghé</button>`;
    }
    const notes = reservation.specialRequest || reservation.notes || '';
    return `
      <tr>
        <td>${escapeHtml(reservation.date || 'Không có ngày')}<br><span class="customer-contact-line">${escapeHtml(formatTime(String(reservation.time || '')) || 'Không có giờ')}</span></td>
        <td>${Number.isInteger(Number(reservation.guests)) ? Number(reservation.guests) : '—'}</td>
        <td>${notes ? escapeHtml(notes) : '<span class="customer-contact-line">Không có ghi chú</span>'}</td>
        <td><span class="status-badge status--${escapeHtml(String(status).toLowerCase())}">${escapeHtml(getStatusLabel(status))}</span></td>
        <td>${visitControl}</td>
      </tr>
    `;
  }).join('');

  const visitRows = profile.visits.map(visit => {
    const reservationId = getVisitReservationId(visit);
    return `<tr>
      <td>${escapeHtml(formatVisitDate(visit))}</td>
      <td>${reservationId ? escapeHtml(reservationId) : 'Không có mã đặt bàn'}</td>
    </tr>`;
  }).join('');

  const visitHistoryText = visitLoadState === 'ready'
    ? `${profile.visits.length} lượt ghé được ghi nhận`
    : getVisitLoadMessage();
  body.innerHTML = `
    <div class="customer-profile-summary">
      <div><strong>Email</strong><span>${escapeHtml(emailText)}</span></div>
      <div><strong>Số điện thoại</strong><span>${escapeHtml(phoneText)}</span></div>
      <div><strong>Lượt đặt bàn</strong><span>${profile.reservations.length}</span></div>
      <div><strong>Lượt ghé</strong><span>${escapeHtml(visitHistoryText)}<br>Lần gần nhất: ${escapeHtml(latestVisitText)}</span></div>
    </div>
    <h3 class="customer-history-heading">Lịch sử đặt bàn (${profile.reservations.length})</h3>
    <p class="customer-profile-note">Đặt bàn không tự động được tính là lượt ghé. Chỉ ghi nhận sau khi nhân viên xác nhận khách đã đến và được phục vụ.</p>
    <div class="admin-table-card">
      <div class="admin-table-wrap">
        <table class="admin-table customer-history-table">
          <thead><tr><th>Ngày và giờ</th><th>Số khách</th><th>Ghi chú</th><th>Trạng thái đặt bàn</th><th>Lượt ghé</th></tr></thead>
          <tbody>${bookingRows || '<tr><td colspan="5" class="customer-history-empty">Chưa có lịch sử đặt bàn.</td></tr>'}</tbody>
        </table>
      </div>
    </div>
    <h3 class="customer-history-heading">Lịch sử lượt ghé (${profile.visits.length})</h3>
    <div class="admin-table-card">
      <div class="admin-table-wrap">
        <table class="admin-table customer-history-table">
          <thead><tr><th>Ngày giờ ghé</th><th>Mã đặt bàn tham chiếu</th></tr></thead>
          <tbody>${visitRows || '<tr><td colspan="2" class="customer-history-empty">Chưa ghi nhận lượt ghé.</td></tr>'}</tbody>
        </table>
      </div>
    </div>
  `;
}

async function recordReservationVisit(reservationId) {
  const reservation = allReservations.find(item => item.id === reservationId);
  if (!reservation || reservation.isLocal || String(reservation.id).startsWith('local_')) {
    showToast('Chỉ có thể ghi nhận lượt ghé cho đặt bàn đã lưu trên Firestore.', 'error');
    return;
  }
  if (String(reservation.status || '').toLowerCase() !== 'confirmed') {
    showToast('Chỉ đặt bàn đã xác nhận mới đủ điều kiện ghi nhận lượt ghé.', 'error');
    return;
  }
  if (allVisits.some(visit => getVisitReservationId(visit) === reservationId)) {
    showToast('Đặt bàn này đã có lượt ghé được ghi nhận.', 'info');
    return;
  }
  if (visitSavingIds.has(reservationId)) return;
  if (!confirm(`Xác nhận khách đã đến quán và được phục vụ cho đặt bàn ngày ${reservation.date || 'không rõ ngày'}?`)) return;

  const dbInstance = window.db || window.firebaseDb || (typeof db !== 'undefined' ? db : null);
  const authInstance = window.firebaseAuth || window.auth || (typeof auth !== 'undefined' ? auth : null);
  const fieldValue = window.firebase && window.firebase.firestore && window.firebase.firestore.FieldValue;
  const user = authInstance && authInstance.currentUser;
  const diagnosticContext = {
    paths: [`/reservations/${reservationId}`, `/reservationVisits/${reservationId}`],
    authInstance,
    step: 'preflight-auth'
  };
  if (!user) {
    const error = Object.assign(new Error('No authenticated user'), { code: 'unauthenticated' });
    logFirestoreDiagnostic('create-reservation-visit', error, diagnosticContext);
    showToast(firestoreUserMessage('create-reservation-visit', error, diagnosticContext.step), 'error');
    return;
  }
  if (normalizeAdminEmail(user.email) !== ADMIN_EMAIL) {
    const error = Object.assign(new Error('Signed-in user is not the configured admin'), { code: 'permission-denied' });
    logFirestoreDiagnostic('create-reservation-visit', error, diagnosticContext);
    showToast(firestoreUserMessage('create-reservation-visit', error, diagnosticContext.step), 'error');
    return;
  }
  if (!dbInstance || typeof dbInstance.runTransaction !== 'function' || !fieldValue) {
    const error = Object.assign(new Error('Firestore transaction or server timestamp is unavailable'), { code: 'failed-precondition' });
    logFirestoreDiagnostic('create-reservation-visit', error, diagnosticContext);
    showToast('Firestore chưa sẵn sàng; chưa ghi nhận lượt ghé. Thử tải lại trang sau khi kết nối.', 'error');
    return;
  }

  visitSavingIds.add(reservationId);
  renderTable();
  renderCustomerProfile(buildCustomerProfiles().find(profile => profile.key === selectedCustomerKey) || {
    name: 'Khách hàng', reservations: [], emails: [], phones: [], visits: []
  });
  let transactionStep = 'create-document-references';
  try {
    const reservationRef = dbInstance.collection('reservations').doc(reservationId);
    const visitRef = dbInstance.collection('reservationVisits').doc(reservationId);
    const result = await dbInstance.runTransaction(async transaction => {
      // Keep all transaction reads ahead of the write in a deterministic order.
      transactionStep = 'read-reservation';
      const reservationSnapshot = await transaction.get(reservationRef);
      transactionStep = 'read-existing-visit';
      const existing = await transaction.get(visitRef);
      if (!reservationSnapshot.exists) {
        transactionStep = 'validate-reservation-exists';
        throw Object.assign(new Error('Reservation not found'), { code: 'reservation-not-found' });
      }
      if (String((reservationSnapshot.data() || {}).status || '').toLowerCase() !== 'confirmed') {
        transactionStep = 'validate-reservation-status';
        throw Object.assign(new Error('Reservation is not confirmed'), { code: 'reservation-not-confirmed' });
      }
      const customer = buildVisitCustomerSnapshot(reservationSnapshot.data() || reservation, reservationId);
      if (existing.exists) {
        const existingData = existing.data() || {};
        return {
          created: false,
          visit: {
            ...existingData,
            id: reservationId,
            reservationId,
            customer: isVisitCustomerSnapshotValid(existingData.customer) ? existingData.customer : customer
          }
        };
      }
      transactionStep = 'create-visit';
      transaction.set(visitRef, {
        reservationId,
        recordedAt: fieldValue.serverTimestamp(),
        recordedBy: user.uid,
        source: 'staff-confirmed',
        customer
      });
      transactionStep = 'commit-transaction';
      return {
        created: true,
        visit: { id: reservationId, reservationId, recordedAt: new Date(), recordedBy: user.uid, source: 'staff-confirmed', customer }
      };
    });

    if (!result.created) {
      if (result.visit) {
        serverAcknowledgedVisits.set(reservationId, result.visit);
        allVisits = mergeAcknowledgedVisits([...allVisits, result.visit]);
      }
      renderCustomers();
      renderTable();
      showToast('Đặt bàn này đã có lượt ghé; lượt thứ hai không được tạo.', 'info');
      return;
    }

    serverAcknowledgedVisits.set(reservationId, result.visit);
    allVisits = mergeAcknowledgedVisits([...allVisits, result.visit]);
    renderCustomers();
    renderTable();
    showToast('Đã ghi nhận lượt ghé cho đặt bàn này.', 'success');
  } catch (error) {
    logFirestoreDiagnostic('create-reservation-visit', error, { ...diagnosticContext, step: transactionStep });
    showToast(firestoreUserMessage('create-reservation-visit', error, transactionStep), 'error');
  } finally {
    visitSavingIds.delete(reservationId);
    renderTable();
    if (selectedCustomerKey) {
      const profile = buildCustomerProfiles().find(item => item.key === selectedCustomerKey);
      if (profile) renderCustomerProfile(profile);
    }
  }
}

function loadOrders() {
  const tbody = document.getElementById('orders-tbody');
  if (!tbody) return;
  const dbInstance = window.db || window.firebaseDb || (typeof db !== 'undefined' ? db : null);
  if (!dbInstance || typeof dbInstance.collection !== 'function') {
    allOrders = [];
    currentOrdersPage = 1;
    renderOrders();
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:40px;">Chưa kết nối được hệ thống đơn gọi món.</td></tr>';
    renderRevenueLoadMessage('Chưa kết nối được hệ thống đơn gọi món.');
    return;
  }

  if (ordersUnsubscribe) ordersUnsubscribe();
  ordersUnsubscribe = dbInstance.collection('orders').onSnapshot((snapshot) => {
    if (!adminSessionActive) return;
    allOrders = [];
    snapshot.forEach(doc => allOrders.push({ id: doc.id, ...doc.data() }));
    allOrders.sort((a, b) => getOrderCreatedAt(b) - getOrderCreatedAt(a));
    renderOrders();
    renderRevenue();
  }, (error) => {
    if (!adminSessionActive) return;
    console.warn('Orders snapshot notice:', error);
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:40px;">Không thể tải đơn gọi món.</td></tr>';
    const summary = document.getElementById('orders-summary');
    const pagination = document.getElementById('orders-pagination');
    if (summary) summary.textContent = 'Không thể tải danh sách đơn gọi món.';
    if (pagination) pagination.hidden = true;
    renderRevenueLoadMessage('Không thể tải dữ liệu doanh thu từ Firestore.');
  });
}

function renderRevenueLoadMessage(message) {
  const tbody = document.getElementById('revenue-tbody');
  if (tbody) tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:30px;">${escapeHtml(message)}</td></tr>`;
}

function getOrderAmountVnd(value, items) {
  const amount = Number(value || 0);
  const itemPrices = Array.isArray(items)
    ? items.map(item => Number(item.price)).filter(Number.isFinite)
    : [];
  const amountUsesThousands = itemPrices.length
    ? itemPrices.every(price => Math.abs(price) < 1000)
    : Math.abs(amount) < 1000;
  return amountUsesThousands ? amount * 1000 : amount;
}

function getOrderCreatedAt(order) {
  const value = order && (order.createdAt || order.created_at);
  if (!value) return 0;
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getOrdersDateRange() {
  return {
    from: String(document.getElementById('orders-date-from')?.value || ''),
    to: String(document.getElementById('orders-date-to')?.value || '')
  };
}

function getFilteredOrders() {
  const { from, to } = getOrdersDateRange();
  return [...allOrders]
    .filter(order => {
      if (!from && !to) return true;
      const createdAt = getOrderCreatedAt(order);
      if (!createdAt) return false;
      const createdDate = getLocalDateKey(new Date(createdAt));
      return (!from || createdDate >= from) && (!to || createdDate <= to);
    })
    .sort((a, b) => getOrderCreatedAt(b) - getOrderCreatedAt(a));
}

function formatOrdersDateLabel(value) {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

window.applyOrdersDateFilter = function() {
  currentOrdersPage = 1;
  renderOrders();
};

window.setOrdersDatePreset = function(preset) {
  const fromInput = document.getElementById('orders-date-from');
  const toInput = document.getElementById('orders-date-to');
  if (!fromInput || !toInput) return;
  const now = new Date();
  const today = getLocalDateKey(now);
  if (preset === 'today') {
    fromInput.value = today;
    toInput.value = today;
  } else if (preset === 'this-month') {
    fromInput.value = `${today.slice(0, 7)}-01`;
    toInput.value = `${today.slice(0, 7)}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;
  } else if (preset === 'this-year') {
    fromInput.value = `${now.getFullYear()}-01-01`;
    toInput.value = `${now.getFullYear()}-12-31`;
  } else if (preset === 'all') {
    fromInput.value = '';
    toInput.value = '';
  } else {
    return;
  }
  window.applyOrdersDateFilter();
};

function formatVnd(amount) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0
  }).format(amount);
}

function formatOrderMoney(value, items) {
  return formatVnd(getOrderAmountVnd(value, items));
}

function getOrderPaidDate(order) {
  const value = order.paidAt || order.paid_at;
  if (!value) return null;

  const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function renderRevenue() {
  const todayElement = document.getElementById('revenue-today');
  const monthElement = document.getElementById('revenue-month');
  const totalElement = document.getElementById('revenue-total');
  const tbody = document.getElementById('revenue-tbody');
  const todayKey = getLocalDateKey(new Date());
  const monthKey = todayKey.slice(0, 7);
  const paidOrders = allOrders.filter(order =>
    (order.paymentStatus || order.payment_status || '').toLowerCase() === 'paid'
  );

  let todayTotal = 0;
  let monthTotal = 0;
  let totalRevenue = 0;

  paidOrders.forEach(order => {
    const amount = getOrderAmountVnd(order.total, order.items);
    const paidDate = getOrderPaidDate(order);
    totalRevenue += amount;
    if (!paidDate) return;

    const paidDateKey = getLocalDateKey(paidDate);
    if (paidDateKey === todayKey) todayTotal += amount;
    if (paidDateKey.slice(0, 7) === monthKey) monthTotal += amount;
  });

  if (todayElement) todayElement.textContent = formatVnd(todayTotal);
  if (monthElement) monthElement.textContent = formatVnd(monthTotal);
  if (totalElement) totalElement.textContent = formatVnd(totalRevenue);
  if (!tbody) return;

  paidOrders.sort((left, right) => {
    const leftDate = getOrderPaidDate(left);
    const rightDate = getOrderPaidDate(right);
    return (rightDate ? rightDate.getTime() : 0) - (leftDate ? leftDate.getTime() : 0);
  });
  tbody.innerHTML = paidOrders.length === 0
    ? '<tr><td colspan="4" style="text-align:center; padding:30px;">Chưa có đơn đã thanh toán.</td></tr>'
    : paidOrders.map(order => {
      const paidDate = getOrderPaidDate(order);
      const orderId = order.orderId || order.order_id || order.id;
      const tableNumber = order.tableNumber || order.table_number || '--';
      const dateLabel = paidDate
        ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(paidDate)
        : '—';
      return `<tr>
        <td>${escapeHtml(dateLabel)}</td>
        <td>${escapeHtml(orderId)} · Bàn ${escapeHtml(tableNumber)}</td>
        <td><strong>${formatOrderMoney(order.total, order.items)}</strong></td>
        <td>Đã thanh toán</td>
      </tr>`;
    }).join('');
}

window.changeOrdersPage = function(direction) {
  const nextPage = currentOrdersPage + Number(direction);
  const pageCount = Math.ceil(allOrders.length / ORDERS_PER_PAGE);
  if (nextPage < 1 || nextPage > pageCount) return;
  currentOrdersPage = nextPage;
  renderOrders();
};

function getOrderStatusLabel(status) {
  return { new: 'Mới', preparing: 'Đang làm', served: 'Đã phục vụ', completed: 'Hoàn tất', cancelled: 'Đã hủy' }[status] || status;
}

function renderOrders() {
  const tbody = document.getElementById('orders-tbody');
  if (!tbody) return;
  const summary = document.getElementById('orders-summary');
  const pagination = document.getElementById('orders-pagination');
  const pageLabel = document.getElementById('orders-page-label');
  const previousButton = document.getElementById('orders-previous-page');
  const nextButton = document.getElementById('orders-next-page');
  const filterPeriod = document.getElementById('orders-filter-period');
  const { from, to } = getOrdersDateRange();
  const filteredOrders = getFilteredOrders();
  const activeOrderCount = filteredOrders.filter(order => {
    const status = String(order.status || 'new').toLowerCase();
    return status === 'new' || status === 'preparing' || status === 'in_progress';
  }).length;
  if (filterPeriod) {
    if (from && to) {
      filterPeriod.textContent = `Khoảng ngày: ${formatOrdersDateLabel(from)} – ${formatOrdersDateLabel(to)}`;
    } else if (from) {
      filterPeriod.textContent = `Từ ngày ${formatOrdersDateLabel(from)}`;
    } else if (to) {
      filterPeriod.textContent = `Đến ngày ${formatOrdersDateLabel(to)}`;
    } else {
      filterPeriod.textContent = 'Đang hiển thị toàn bộ thời gian';
    }
  }
  if (summary) {
    summary.textContent = `Đơn đang xử lý: ${activeOrderCount} · Kết quả: ${filteredOrders.length} / ${allOrders.length} đơn`;
  }

  if (filteredOrders.length === 0) {
    currentOrdersPage = 1;
    const emptyMessage = allOrders.length === 0
      ? 'Chưa có đơn gọi món.'
      : from || to
        ? 'Không có đơn gọi món trong khoảng ngày đã chọn.'
        : 'Chưa có đơn gọi món.';
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:40px; color:var(--warm-gray);">${emptyMessage}</td></tr>`;
    if (pagination) pagination.hidden = true;
    return;
  }

  const pageCount = Math.ceil(filteredOrders.length / ORDERS_PER_PAGE);
  currentOrdersPage = Math.min(Math.max(1, currentOrdersPage), pageCount);
  const firstOrderNumber = (currentOrdersPage - 1) * ORDERS_PER_PAGE;
  const pageOrders = filteredOrders.slice(firstOrderNumber, firstOrderNumber + ORDERS_PER_PAGE);
  tbody.innerHTML = pageOrders.map((order, index) => {
    const items = Array.isArray(order.items) ? order.items : [];
    const status = order.status || 'new';
    const paymentStatus = order.paymentStatus || 'unpaid';
    return `
      <tr>
        <td>${firstOrderNumber + index + 1}</td>
        <td><strong>${escapeHtml(order.orderId || order.id)}</strong><br><span class="order-table-number">Bàn ${escapeHtml(order.tableNumber || '--')}</span></td>
        <td>${items.map(item => `<div>${escapeHtml(item.name)} <strong>×${Number(item.quantity) || 0}</strong></div>`).join('')}${order.note ? `<small class="order-note">${escapeHtml(order.note)}</small>` : ''}</td>
        <td><strong>${formatOrderMoney(order.total, items)}</strong></td>
        <td><span class="order-status order-status--${escapeHtml(status)}">${getOrderStatusLabel(status)}</span></td>
        <td><span class="payment-status payment-status--${escapeHtml(paymentStatus)}">${paymentStatus === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán'}</span></td>
        <td><div class="order-actions">
          ${status === 'new' ? `<button class="btn-action btn-action--approve" type="button" onclick="updateOrderStatus('${order.id}', 'preparing')">Bắt đầu làm</button>` : ''}
          ${status === 'in_progress' || status === 'preparing' ? `<button class="btn-action btn-action--approve" type="button" onclick="updateOrderStatus('${order.id}', 'served')">Đã mang ra</button>` : ''}
          ${status === 'served' && paymentStatus !== 'paid' ? `<button class="btn-action btn-action--approve" type="button" onclick="markOrderPaid('${order.id}')">Đã thanh toán</button>` : ''}
          ${status !== 'completed' && status !== 'cancelled' ? `<button class="btn-action btn-action--cancel" type="button" onclick="updateOrderStatus('${order.id}', 'cancelled')">Hủy</button>` : ''}
        </div></td>
      </tr>`;
  }).join('');
  if (pagination) pagination.hidden = pageCount <= 1;
  if (pageLabel) {
    const lastOrderNumber = Math.min(firstOrderNumber + ORDERS_PER_PAGE, filteredOrders.length);
    pageLabel.textContent = `${firstOrderNumber + 1}–${lastOrderNumber} / ${filteredOrders.length} đơn · Trang ${currentOrdersPage}/${pageCount}`;
  }
  if (previousButton) previousButton.disabled = currentOrdersPage === 1;
  if (nextButton) nextButton.disabled = currentOrdersPage === pageCount;
  const scrollContainer = document.getElementById('orders-scroll-container');
  if (scrollContainer) scrollContainer.scrollTop = 0;
}

window.updateOrderStatus = function(id, status) {
  const dbInstance = window.db || window.firebaseDb || (typeof db !== 'undefined' ? db : null);
  if (!dbInstance || !id) return;
  dbInstance.collection('orders').doc(id).update({ status, updatedAt: new Date().toISOString() })
    .catch(error => console.warn('Order status update notice:', error));
};

window.markOrderPaid = function(id) {
  const dbInstance = window.db || window.firebaseDb || (typeof db !== 'undefined' ? db : null);
  if (!dbInstance || !id) return;
  dbInstance.collection('orders').doc(id).update({ paymentStatus: 'paid', status: 'completed', paidAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .catch(error => console.warn('Order payment update notice:', error));
};

function renderTable() {
  const tbody = document.getElementById('bookings-tbody');
  if (!tbody) return;

  let filtered = allReservations.filter(res => {
    // Filter status
    const resStatus = (res.status || 'Pending').toLowerCase();
    if (activeFilter !== 'all' && resStatus !== activeFilter.toLowerCase()) return false;

    // Filter search
    if (searchQuery) {
      const name = normalizeCustomerSearch(res.customerName || res.name || '');
      const email = normalizeCustomerSearch(res.email || '');
      const phone = normalizeCustomerPhone(res.phone || '');
      const queryPhone = normalizeCustomerPhone(searchQuery);
      if (!name.includes(searchQuery) && !email.includes(searchQuery)
          && (!queryPhone || !phone.includes(queryPhone))) {
        return false;
      }
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding: 48px; color: var(--warm-gray);">
          Không tìm thấy lượt đặt bàn phù hợp.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(res => {
    const rawStatus = res.status || 'Pending';
    const statusLower = rawStatus.toLowerCase();
    const statusClass = `status--${statusLower}`;
    const timeFormatted = formatTime(res.time);
    const hasRecordedVisit = allVisits.some(visit => getVisitReservationId(visit) === res.id);

    // Email status badge
    const emailStatus = res.emailStatus || res.email_status || 'Pending';
    const emailStatusLower = emailStatus.toLowerCase();
    const emailBadgeClass = `email-badge--${emailStatusLower === 'failed' ? 'failed' : (emailStatusLower === 'pending' ? 'pending' : 'sent')}`;

    const guestName = res.customerName || res.name || 'Khách';
    const notesText = res.specialRequest || res.notes || '';
    const localOnly = res.isLocal || String(res.id || '').startsWith('local_');
    let arrivalAction = '';
    if (statusLower === 'confirmed') {
      if (hasRecordedVisit) {
        arrivalAction = '<span class="customer-visit-state">Khách đã đến</span>';
      } else if (localOnly) {
        arrivalAction = '<span class="customer-visit-unavailable" title="Đặt bàn chỉ có trên thiết bị này">Chỉ có dữ liệu cục bộ</span>';
      } else if (visitSavingIds.has(res.id)) {
        arrivalAction = '<button type="button" class="btn-action btn-action--reply" disabled>Đang ghi nhận...</button>';
      } else if (visitLoadState !== 'ready') {
        arrivalAction = '<span class="customer-visit-unavailable">Chưa kiểm tra được lượt ghé</span>';
      } else {
        arrivalAction = `<button type="button" class="btn-action btn-action--approve" data-visit-res-id="${escapeHtml(res.id)}">Xác nhận khách đã đến</button>`;
      }
    }

    return `
      <tr data-id="${res.id}">
        <td>
          <div style="font-weight: 600; color: var(--bark);">${escapeHtml(guestName)}</div>
          <div style="font-size: 12px; color: var(--warm-gray);">${escapeHtml(res.email || '')}</div>
          ${res.phone ? `<div style="font-size: 12px; color: var(--coffee-mid);">${escapeHtml(res.phone)}</div>` : ''}
          ${(res.reservationId || res.reservation_id) ? `<div style="font-size: 11px; color: var(--coffee); font-family: monospace;">Mã: ${escapeHtml(res.reservationId || res.reservation_id)}</div>` : ''}
        </td>
        <td>
          <div style="font-weight: 500;">${escapeHtml(res.date || 'TBD')}</div>
          <div style="font-size: 12px; color: var(--coffee-mid);">${timeFormatted}</div>
        </td>
        <td style="font-weight: 600; text-align: center;">
          ${res.guests || 2}
        </td>
        <td style="max-width: 180px; font-size: 13px; color: var(--coffee-mid);">
          ${notesText ? escapeHtml(notesText) : '<span style="color:#A08070; font-style:italic;">Không có</span>'}
        </td>
        <td>
          <span class="status-badge ${statusClass}">
            <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:currentColor;"></span>
            ${statusLower === 'confirmed' && hasRecordedVisit ? 'Khách đã đến' : escapeHtml(getStatusLabel(rawStatus))}
          </span>
        </td>
        <td>
          <span class="email-badge ${emailBadgeClass}">
            ${escapeHtml(getEmailStatusLabel(emailStatus))}
          </span>
        </td>
        <td>
          <div class="action-btn-group">
            ${statusLower === 'pending' ? `<button type="button" class="btn-action btn-action--approve" onclick="updateBookingStatus('${res.id}', 'Confirmed')">Xác nhận</button>` : ''}
            ${statusLower === 'pending' && !hasRecordedVisit ? `<button type="button" class="btn-action btn-action--cancel" onclick="updateBookingStatus('${res.id}', 'Cancelled')">Hủy</button>` : ''}
            ${arrivalAction}
            <button type="button" class="btn-action btn-action--reply" onclick="openReplyModal('${res.id}')">Trả lời</button>
            <button type="button" class="btn-action btn-action--delete" onclick="deleteBooking('${res.id}')">✕</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

}

function getStatusLabel(status) {
  const labels = { pending: 'Đang chờ', confirmed: 'Đã xác nhận', cancelled: 'Đã hủy' };
  return labels[String(status).toLowerCase()] || status;
}

function getEmailStatusLabel(status) {
  const labels = { pending: 'Đang chờ', sent: 'Đã gửi', failed: 'Gửi thất bại' };
  return labels[String(status).toLowerCase()] || status;
}

// Toast helper for Admin Portal
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const iconMap = { success: '✓', error: '✕', info: 'ℹ' };
  toast.innerHTML = `
    <span style="font-weight: bold;">${iconMap[type] || 'ℹ'}</span>
    <span>${escapeHtml(message)}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'opacity 0.3s, transform 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Global action functions bound to window for onclick inline handlers
window.updateBookingStatus = async function(id, newStatus) {
  const reservationId = String(id || '');
  const targetStatus = String(newStatus).toLowerCase();
  if (!reservationId || !['confirmed', 'cancelled'].includes(targetStatus)) return;
  if (String(newStatus).toLowerCase() === 'cancelled'
      && allVisits.some(visit => getVisitReservationId(visit) === reservationId)) {
    showToast('Không thể hủy đặt bàn đã được ghi nhận là lượt ghé.', 'error');
    return;
  }
  const item = allReservations.find(r => r.id === reservationId);
  if (!item) {
    showToast('Không tìm thấy đặt bàn đang hiển thị; hãy tải lại danh sách rồi thử lại.', 'error');
    return;
  }
  const previousStatus = item ? item.status : null;
  const previousStatusNormalized = String(previousStatus || 'pending').toLowerCase();
  if (previousStatusNormalized !== 'pending') {
    showToast('Chỉ đặt bàn đang chờ mới có thể được xác nhận hoặc hủy.', 'error');
    return;
  }
  const previousUpdatedAt = item ? item.updatedAt : null;
  const nowIso = new Date().toISOString();
  const isLocalReservation = item.isLocal || reservationId.startsWith('local_');
  const dbInstance = window.db || window.firebaseDb || (typeof db !== 'undefined' ? db : null);
  const authInstance = window.firebaseAuth || window.auth || (typeof auth !== 'undefined' ? auth : null);
  const diagnosticContext = {
    paths: [`/reservations/${reservationId}`],
    authInstance,
    step: 'preflight-auth'
  };

  if (!isLocalReservation) {
    const user = authInstance && authInstance.currentUser;
    if (!user) {
      const error = Object.assign(new Error('No authenticated user'), { code: 'unauthenticated' });
      logFirestoreDiagnostic('update-reservation-status', error, diagnosticContext);
      showToast(firestoreUserMessage('update-reservation-status', error, diagnosticContext.step), 'error');
      return;
    }
    if (normalizeAdminEmail(user.email) !== ADMIN_EMAIL) {
      const error = Object.assign(new Error('Signed-in user is not the configured admin'), { code: 'permission-denied' });
      logFirestoreDiagnostic('update-reservation-status', error, diagnosticContext);
      showToast(firestoreUserMessage('update-reservation-status', error, diagnosticContext.step), 'error');
      return;
    }
    if (!dbInstance || typeof dbInstance.collection !== 'function') {
      const error = Object.assign(new Error('Firestore is unavailable'), { code: 'unavailable' });
      logFirestoreDiagnostic('update-reservation-status', error, { ...diagnosticContext, step: 'check-firestore' });
      showToast(firestoreUserMessage('update-reservation-status', error, 'check-firestore'), 'error');
      return;
    }
  }

  item.status = newStatus;
  item.updatedAt = nowIso;
  updateStats();
  renderTable();
  renderCustomers();

  if (isLocalReservation) {
    try {
      const local = JSON.parse(localStorage.getItem('mocha_reservations') || '[]');
      local.forEach(record => {
        if ((record.email === item.email || record.reservationId === item.reservationId)
            && record.date === item.date && record.time === item.time) {
          record.status = targetStatus;
          record.updatedAt = nowIso;
        }
      });
      localStorage.setItem('mocha_reservations', JSON.stringify(local));
    } catch (error) {
      console.warn('Local reservation update notice:', error && error.name || 'storage-error');
    }
    showToast(`Đã cập nhật trạng thái đặt bàn cục bộ thành "${getStatusLabel(newStatus)}".`, 'info');
    return;
  }

  try {
    await dbInstance.collection('reservations').doc(reservationId).update({
      status: targetStatus,
      updatedAt: nowIso
    });
    if (item.email && typeof window.sendEmailJS === 'function') {
      const emailType = targetStatus === 'confirmed' ? 'confirmed' : 'cancelled';
      try {
        const emailResult = window.sendEmailJS(item, emailType, reservationId);
        if (emailResult && typeof emailResult.catch === 'function') {
          emailResult.catch(error => console.warn('[EmailJS] status notification failed', error && error.code || 'unknown'));
        }
      } catch (error) {
        console.warn('[EmailJS] status notification failed', error && error.code || 'unknown');
      }
    }
    showToast(`Đã cập nhật trạng thái đặt bàn trên Firestore thành "${getStatusLabel(newStatus)}".`, 'success');
  } catch (error) {
    item.status = previousStatus;
    item.updatedAt = previousUpdatedAt;
    logFirestoreDiagnostic('update-reservation-status', error, {
      ...diagnosticContext,
      step: 'update-reservation'
    });
    updateStats();
    renderTable();
    renderCustomers();
    showToast(firestoreUserMessage('update-reservation-status', error, 'update-reservation'), 'error');
  }
};

window.deleteBooking = async function(id) {
  const reservationId = String(id || '');
  if (!reservationId) return;
  const dbInstance = window.db || window.firebaseDb || (typeof db !== 'undefined' ? db : null);
  const isLocalReservation = reservationId.startsWith('local_');
  if (!isLocalReservation && (!dbInstance || typeof dbInstance.collection !== 'function'
      || typeof dbInstance.runTransaction !== 'function')) {
    showToast('Firestore chưa sẵn sàng. Đặt bàn chưa bị xóa.', 'error');
    return;
  }
  if (!confirm('Bạn có chắc muốn xóa lượt đặt bàn này không?')) return;

  const item = allReservations.find(r => r.id === reservationId);

  if (!isLocalReservation) {
    const authInstance = window.firebaseAuth || window.auth || (typeof auth !== 'undefined' ? auth : null);
    let transactionStep = 'create-document-references';
    let transactionOperations = [];
    try {
      const reservationRef = dbInstance.collection('reservations').doc(reservationId);
      const visitRef = dbInstance.collection('reservationVisits').doc(reservationId);
      const result = await dbInstance.runTransaction(async transaction => {
        // Firestore may retry the callback; keep diagnostics scoped to its last attempt.
        transactionOperations = [];
        transactionStep = 'read-reservation';
        transactionOperations.push({ action: 'get', path: reservationRef.path });
        const reservationSnapshot = await transaction.get(reservationRef);
        transactionStep = 'read-existing-visit';
        transactionOperations.push({ action: 'get', path: visitRef.path });
        const visitSnapshot = await transaction.get(visitRef);
        if (!reservationSnapshot.exists) return { status: 'reservation-not-found' };
        let preservedVisit = null;
        if (visitSnapshot.exists) {
          const existingVisit = visitSnapshot.data() || {};
          if (existingVisit.reservationId && existingVisit.reservationId !== reservationId) {
            throw Object.assign(new Error('Visit record does not match its document ID'), { code: 'failed-precondition' });
          }
          preservedVisit = { ...existingVisit, id: reservationId, reservationId };
          if (!isVisitCustomerSnapshotValid(existingVisit.customer)) {
            transactionStep = 'preserve-visit-customer';
            const visitUpdate = {
              customer: buildVisitCustomerSnapshot(reservationSnapshot.data() || {}, reservationId)
            };
            if (!existingVisit.reservationId) visitUpdate.reservationId = reservationId;
            transactionOperations.push({ action: 'update', path: visitRef.path, fields: Object.keys(visitUpdate).sort() });
            preservedVisit.customer = buildVisitCustomerSnapshot(reservationSnapshot.data() || {}, reservationId);
            transaction.update(visitRef, visitUpdate);
          }
        }
        transactionStep = 'delete-reservation';
        transactionOperations.push({ action: 'delete', path: reservationRef.path });
        transaction.delete(reservationRef);
        transactionStep = 'commit-transaction';
        transactionOperations.push({ action: 'commit' });
        return { status: 'deleted', visit: preservedVisit };
      });
      if (result.status === 'reservation-not-found') {
        showToast('Không tìm thấy đặt bàn trên Firestore; không có dữ liệu nào bị xóa.', 'error');
        return;
      }
      if (result.visit) {
        serverAcknowledgedVisits.set(reservationId, result.visit);
        allVisits = mergeAcknowledgedVisits([...allVisits, result.visit]);
      }
    } catch (error) {
      logFirestoreDiagnostic('delete-reservation', error, {
        paths: [`/reservations/${reservationId}`, `/reservationVisits/${reservationId}`],
        authInstance,
        step: transactionStep,
        operations: transactionOperations
      });
      showToast(firestoreUserMessage('delete-reservation', error, transactionStep), 'error');
      return;
    }
  }

  allReservations = allReservations.filter(r => r.id !== reservationId);

  // Remove from localStorage
  try {
    let local = JSON.parse(localStorage.getItem('mocha_reservations') || '[]');
    if (item) {
      local = local.filter(r => !(r.email === item.email && r.date === item.date && r.time === item.time));
    }
    localStorage.setItem('mocha_reservations', JSON.stringify(local));
  } catch (err) {}

  updateStats();
  renderTable();
  renderCustomers();
  if (!isLocalReservation) {
    showToast('Đã xóa đặt bàn; lịch sử lượt ghé được giữ nguyên.', 'success');
  }
};

// Reply Modal Controls
let currentReplyResId = null; // Track which reservation the reply modal is for

window.openReplyModal = function(id) {
  const res = allReservations.find(r => r.id === id);
  if (!res) return;

  currentReplyResId = id; // Store for the send handler

  const modal      = document.getElementById('reply-modal');
  const emailInput = document.getElementById('modal-guest-email');
  const msgInput   = document.getElementById('modal-message');

  if (emailInput) emailInput.value = res.email || '';
  if (msgInput) {
    const isCancelled = (res.status || '').toLowerCase() === 'cancelled';
    const statusText = isCancelled ? 'cập nhật về yêu cầu đặt bàn' : 'xác nhận đặt bàn';
    msgInput.value = `Kính gửi ${res.customerName || res.name || 'Quý khách'},\n\nCảm ơn bạn đã chọn Mocha & Miso!\n\nĐây là thông tin ${statusText} của bạn vào ngày ${res.date || 'ngày bạn yêu cầu'} lúc ${formatTime(res.time)} dành cho ${res.guests || 2} khách.\n\nNếu cần hỗ trợ hoặc thay đổi thông tin, vui lòng liên hệ chúng tôi qua số (555) 234-5678.\n\nThân mến,\nĐội ngũ Mocha & Miso\n124 Artisan Alley, Craft District`;
  }

  if (modal) modal.hidden = false;
};

// Reply Modal Send & Close Buttons
function initReplyModalHandlers() {
  const modal = document.getElementById('reply-modal');
  const cancelBtn = document.getElementById('modal-cancel-btn');
  const sendBtn = document.getElementById('modal-send-btn');

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      if (modal) modal.hidden = true;
    });
  }

  if (sendBtn) {
    sendBtn.addEventListener('click', () => {
      const email = document.getElementById('modal-guest-email')?.value?.trim() || '';
      const body  = document.getElementById('modal-message')?.value?.trim() || '';

      if (!email) {
        showToast('Chưa có địa chỉ email người nhận.', 'error');
        return;
      }

      const cfg = window.EMAILJS_CONFIG;
      if (!cfg || cfg.publicKey === 'YOUR_PUBLIC_KEY' || typeof emailjs === 'undefined') {
        showToast('EmailJS chưa được cấu hình. Vui lòng thiết lập thông tin xác thực trước.', 'error');
        return;
      }

      const res = currentReplyResId ? allReservations.find(r => r.id === currentReplyResId) : null;

      sendBtn.textContent = 'Đang gửi…';
      sendBtn.disabled = true;

      // Use sendEmailJS with 'custom' type and the typed body
      if (typeof window.sendEmailJS === 'function' && res) {
        const cfg2 = window.EMAILJS_CONFIG;
        const templateParams = {
          to_email:        email,
          customer_name:   res.customerName || res.name || 'Quý khách',
          reservation_id:  res.reservationId || res.id || 'N/A',
          date:            res.date || 'TBD',
          time:            (typeof formatTime === 'function' ? formatTime(res.time) : res.time) || 'TBD',
          guests:          String(res.guests || 2),
          special_request: res.specialRequest || res.notes || 'Không có',
          subject:         'Tin nhắn từ Mocha & Miso Café',
          message_body:    body,
          cafe_address:    '124 Artisan Alley, Craft District',
          cafe_phone:      '(555) 234-5678',
          maps_link:       'https://maps.google.com/?q=124+Artisan+Alley+Craft+District'
        };
        emailjs.send(cfg2.serviceId, cfg2.templateId, templateParams)
          .then(() => {
            showToast(`Đã gửi email đến ${email} ✓`, 'success');
            if (modal) modal.hidden = true;
          })
          .catch(err => {
            console.warn('[EmailJS Reply Error]', err);
            showToast('Không gửi được email. Vui lòng kiểm tra cấu hình EmailJS.', 'error');
          })
          .finally(() => {
            sendBtn.textContent = 'Gửi email';
            sendBtn.disabled = false;
          });
      } else {
        showToast('EmailJS chưa sẵn sàng. Vui lòng cấu hình thông tin xác thực.', 'error');
        sendBtn.textContent = 'Gửi email';
        sendBtn.disabled = false;
      }
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initReplyModalHandlers, { once: true });
} else {
  initReplyModalHandlers();
}

// Utilities
function formatTime(timeStr) {
  if (!timeStr) return '';
  const [hourText, minuteText] = timeStr.includes(':')
    ? timeStr.split(':')
    : [timeStr.slice(0, 2), timeStr.slice(2)];
  const hours = Number.parseInt(hourText, 10);
  if (!Number.isFinite(hours) || !/^\d{2}$/.test(minuteText)) return timeStr;

  const period = hours < 11 ? 'sáng' : hours < 13 ? 'trưa' : hours < 18 ? 'chiều' : 'tối';
  return `${hours % 12 || 12}:${minuteText} ${period}`;
}

window.sendEmailJS = function(reservation, type, id) {
  const config = window.EMAILJS_CONFIG;
  if (!config || config.publicKey === 'YOUR_PUBLIC_KEY' || typeof emailjs === 'undefined') {
    showToast('Trạng thái đặt bàn đã lưu nhưng EmailJS chưa được cấu hình; email chưa được gửi.', 'error');
    return Promise.resolve(false);
  }

  const subjects = {
    confirmed: 'Đặt bàn đã được xác nhận — Mocha & Miso Café',
    cancelled: 'Đặt bàn đã bị hủy — Mocha & Miso Café'
  };
  const messages = {
    confirmed: 'Tin vui! Đội ngũ của chúng tôi đã xác nhận đặt bàn. Rất mong được đón tiếp bạn!',
    cancelled: 'Rất tiếc, yêu cầu đặt bàn của bạn đã bị hủy. Vui lòng liên hệ với chúng tôi nếu bạn muốn đặt lại.'
  };
  const params = {
    to_email: reservation.email || '',
    customer_name: reservation.customerName || reservation.name || 'Quý khách',
    reservation_id: reservation.reservationId || reservation.reservation_id || id || 'N/A',
    date: reservation.date || 'TBD',
    time: formatTime(reservation.time) || reservation.time || 'TBD',
    guests: String(reservation.guests || 2),
    special_request: reservation.specialRequest || reservation.notes || 'Không có',
    subject: subjects[type] || subjects.confirmed,
    message_body: messages[type] || messages.confirmed,
    cafe_address: '124 Artisan Alley, Craft District',
    cafe_phone: '(555) 234-5678',
    maps_link: 'https://maps.google.com/?q=124+Artisan+Alley+Craft+District'
  };

  const db = window.firebaseDb;
  const methods = window.firebaseFirestoreMethods;
  const saveEmailStatus = (status, errorMessage) => {
    if (!db || !methods?.doc || !methods?.updateDoc || !id || String(id).startsWith('local_')) {
      return Promise.resolve();
    }
    return methods.updateDoc(methods.doc(db, 'reservations', id), {
      emailStatus: status,
      ...(errorMessage ? { emailError: errorMessage } : {})
    });
  };

  return emailjs.send(config.serviceId, config.templateId, params).then(async () => {
    try {
      await saveEmailStatus('Sent', null);
    } catch (error) {
      console.error('[Firestore] Could not save reservation email status:', error);
    }
    showToast(`Đã gửi email đến ${reservation.email || 'khách'}.`, 'success');
    return true;
  }).catch(async error => {
    console.error('[EmailJS] Reservation status email failed:', error);
    try {
      await saveEmailStatus('Failed', String(error.message || error).slice(0, 1000));
    } catch (statusError) {
      console.error('[Firestore] Could not save reservation email failure:', statusError);
    }
    showToast('Không gửi được email thông báo đặt bàn.', 'error');
    return false;
  });
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
