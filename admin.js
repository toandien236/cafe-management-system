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
    const auth = window.firebaseAuth;
    const methods = window.firebaseAuthMethods;
    if (!auth || !methods) return;
    clearInterval(waitForFirebase);
    initAdminAuth({
      onAuthStateChanged: callback => methods.onAuthStateChanged(auth, callback),
      signInWithEmailAndPassword: (email, password) => methods.signInWithEmailAndPassword(auth, email, password),
      signOut: () => methods.signOut(auth),
      sendPasswordResetEmail: email => methods.sendPasswordResetEmail(auth, email)
    });
    initAdminDashboard();
  }, 50);

  setTimeout(() => {
    clearInterval(waitForFirebase);
    if (!window.firebaseAuth || !window.firebaseAuthMethods) {
      showLoginError('Firebase chưa khởi tạo được. Kiểm tra mạng, cấu hình Firebase và bật Email/Password trong Firebase Authentication.');
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

function initAdminAuth(authApi) {
  const loginSection = document.getElementById('admin-login-section');
  const dashboard = document.getElementById('admin-dashboard-section');
  const loginForm = document.getElementById('admin-login-form');
  const logoutButton = document.getElementById('admin-logout-btn');
  const emailDisplay = document.getElementById('logged-admin-email');
  const resetButton = document.getElementById('admin-forgot-password');

  function showLoggedOut() {
    if (loginSection) {
      loginSection.hidden = false;
      loginSection.style.display = 'flex';
    }
    if (dashboard) {
      dashboard.hidden = true;
      dashboard.style.display = 'none';
    }
    if (ordersUnsubscribe) ordersUnsubscribe();
    if (reservationsUnsubscribe) reservationsUnsubscribe();
    ordersUnsubscribe = null;
    reservationsUnsubscribe = null;
    allOrders = [];
    allReservations = [];
  }

  authApi.onAuthStateChanged(async user => {
    if (user?.email?.toLowerCase() === ADMIN_EMAIL) {
      if (loginSection) {
        loginSection.hidden = true;
        loginSection.style.display = 'none';
      }
      if (dashboard) {
        dashboard.hidden = false;
        dashboard.style.display = 'block';
      }
      if (emailDisplay) emailDisplay.textContent = user.email;
      loadReservations();
      loadOrders();
    } else {
      showLoggedOut();
      if (user) {
        await authApi.signOut();
        showLoginError('Tài khoản Firebase này không có quyền truy cập cổng quản trị.');
      }
    }
  });

  if (loginForm) {
    loginForm.addEventListener('submit', async event => {
      event.preventDefault();
      const email = document.getElementById('admin-email')?.value.trim() || '';
      const password = document.getElementById('admin-password')?.value || '';
      const submit = document.getElementById('admin-login-submit');
      const buttonText = submit?.querySelector('.btn-text');
      const existingError = loginForm.querySelector('.form-error');
      if (existingError) existingError.remove();
      if (!email || !password) {
        showLoginError('Vui lòng nhập email quản trị và mật khẩu.');
        return;
      }
      if (email.toLowerCase() !== ADMIN_EMAIL) {
        showLoginError('Email này không có quyền truy cập cổng quản trị.');
        return;
      }
      if (submit) submit.disabled = true;
      if (buttonText) buttonText.textContent = 'Đang xác minh…';
      try {
        await authApi.signInWithEmailAndPassword(email, password);
      } catch (error) {
        const errors = {
          'auth/invalid-email': 'Vui lòng nhập địa chỉ email hợp lệ.',
          'auth/user-disabled': 'Tài khoản quản trị này đã bị vô hiệu hóa.',
          'auth/too-many-requests': 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau.',
          'auth/network-request-failed': 'Lỗi kết nối mạng. Vui lòng kiểm tra kết nối của bạn.',
          'auth/invalid-credential': 'Email hoặc mật khẩu Firebase không đúng.',
          'auth/wrong-password': 'Email hoặc mật khẩu Firebase không đúng.',
          'auth/user-not-found': 'Email hoặc mật khẩu Firebase không đúng.',
          'auth/operation-not-allowed': 'Chưa bật đăng nhập bằng Email/Password trong Firebase Authentication.'
        };
        console.error('[Firebase Admin Login Error]', error.code, error.message);
        showLoginError(errors[error.code] || error.message || 'Đăng nhập Firebase thất bại.');
      } finally {
        if (submit) submit.disabled = false;
        if (buttonText) buttonText.textContent = 'Đăng nhập';
      }
    });
  }

  if (resetButton) {
    resetButton.addEventListener('click', async () => {
      const email = document.getElementById('admin-email')?.value.trim() || '';
      if (!email) {
        showLoginError('Vui lòng nhập email để nhận liên kết đặt lại mật khẩu.');
        return;
      }
      try {
        await authApi.sendPasswordResetEmail(email);
        showLoginError('Đã gửi liên kết đặt lại mật khẩu Firebase. Hãy kiểm tra hộp thư đến và Spam.');
      } catch (error) {
        console.error('[Firebase Password Reset Error]', error.code, error.message);
        showLoginError('Không thể gửi email đặt lại mật khẩu Firebase. Hãy kiểm tra tài khoản và cấu hình Authentication.');
      }
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
      try {
        await authApi.signOut();
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
let reservationsUnsubscribe = null;
let customerSearchQuery = '';

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
      searchQuery = e.target.value.toLowerCase().trim();
      renderTable();
    });
  }

  const customerSearch = document.getElementById('customer-search');
  if (customerSearch) {
    customerSearch.addEventListener('input', (event) => {
      customerSearchQuery = event.target.value.trim().toLocaleLowerCase('vi');
      renderCustomers();
    });
  }

  const customersBody = document.getElementById('customers-tbody');
  if (customersBody) {
    customersBody.addEventListener('click', (event) => {
      const button = event.target.closest('[data-customer-history]');
      if (button) openCustomerHistory(button.dataset.customerHistory);
    });
  }

  const historyModal = document.getElementById('customer-history-modal');
  const historyClose = document.getElementById('customer-history-close');
  if (historyClose && historyModal) {
    historyClose.addEventListener('click', () => { historyModal.hidden = true; });
  }
  if (historyModal) {
    historyModal.addEventListener('click', (event) => {
      if (event.target === historyModal) historyModal.hidden = true;
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !historyModal.hidden) historyModal.hidden = true;
    });
  }

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

  const db = window.firebaseDb;
  const methods = window.firebaseFirestoreMethods;
  if (!db || !methods?.collection || !methods?.onSnapshot) {
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px;">Firestore chưa khởi tạo được. Kiểm tra cấu hình Firebase.</td></tr>';
    return;
  }
  if (reservationsUnsubscribe) reservationsUnsubscribe();
  reservationsUnsubscribe = methods.onSnapshot(
    methods.collection(db, 'reservations'),
    snapshot => {
      allReservations = snapshot.docs.map(document => ({ id: document.id, ...document.data() }));
      allReservations.sort((left, right) => {
        return getDateTime(right.createdAt || right.created_at) - getDateTime(left.createdAt || left.created_at);
      });
      updateStats();
      renderTable();
      renderCustomers();
    },
    error => {
      console.error('[Firestore] Could not load reservations:', error);
      if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px;">Không thể tải đặt bàn. Kiểm tra Firebase Rules và quyền tài khoản.</td></tr>';
      showToast('Không tải được đặt bàn từ Firestore.', 'error');
    }
  );
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

function customerIdentity(reservation, fallbackIndex) {
  const email = String(reservation.email || '').trim().toLowerCase();
  if (email) return `email:${email}`;

  const phone = String(reservation.phone || '').replace(/\D/g, '');
  if (phone) return `phone:${phone}`;

  return `reservation:${reservation.id || reservation.reservationId || reservation.reservation_id || fallbackIndex}`;
}

function getDateTime(value) {
  const date = value?.toDate ? value.toDate() : new Date(value || '');
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function buildCustomerProfiles(reservations) {
  const profiles = new Map();
  reservations.forEach((reservation, index) => {
    const id = customerIdentity(reservation, index);
    let profile = profiles.get(id);
    if (!profile) {
      profile = {
        id,
        name: reservation.name || reservation.customerName || 'Khách',
        email: reservation.email || '',
        phone: reservation.phone || '',
        reservations: []
      };
      profiles.set(id, profile);
    }
    profile.reservations.push(reservation);
    if (!profile.email && reservation.email) profile.email = reservation.email;
    if (!profile.phone && reservation.phone) profile.phone = reservation.phone;
    if ((!profile.name || profile.name === 'Khách') && (reservation.name || reservation.customerName)) {
      profile.name = reservation.name || reservation.customerName;
    }
  });

  return Array.from(profiles.values()).map(profile => {
    profile.reservations.sort((first, second) => {
      const firstDate = getDateTime(first.createdAt || first.created_at);
      const secondDate = getDateTime(second.createdAt || second.created_at);
      return secondDate - firstDate;
    });
    profile.latestReservation = profile.reservations[0];
    return profile;
  }).sort((first, second) => {
    const firstDate = getDateTime(first.latestReservation.createdAt || first.latestReservation.created_at);
    const secondDate = getDateTime(second.latestReservation.createdAt || second.latestReservation.created_at);
    return secondDate - firstDate || first.name.localeCompare(second.name, 'vi');
  });
}

function customerReservationDate(reservation) {
  if (reservation.date) return `${reservation.date}${reservation.time ? ` · ${formatTime(reservation.time)}` : ''}`;
  const createdAt = reservation.createdAt || reservation.created_at;
  if (!createdAt) return 'Chưa có ngày';
  const date = createdAt?.toDate ? createdAt.toDate() : new Date(createdAt);
  return Number.isNaN(date.getTime()) ? 'Chưa có ngày' : date.toLocaleString('vi-VN');
}

function renderCustomers() {
  const tbody = document.getElementById('customers-tbody');
  if (!tbody) return;

  const profiles = buildCustomerProfiles(allReservations);
  const reservationCount = document.getElementById('care-reservation-count');
  const customerCount = document.getElementById('care-customer-count');
  const lastReservation = document.getElementById('care-last-reservation');
  const latestProfile = profiles[0];

  if (customerCount) customerCount.textContent = String(profiles.length);
  if (reservationCount) reservationCount.textContent = String(allReservations.length);
  if (lastReservation) {
    lastReservation.textContent = latestProfile
      ? customerReservationDate(latestProfile.latestReservation)
      : 'Chưa có';
  }

  const filtered = profiles.filter(profile =>
    [profile.name, profile.email, profile.phone]
      .some(value => String(value || '').toLocaleLowerCase('vi').includes(customerSearchQuery))
  );

  if (!filtered.length) {
    const message = customerSearchQuery ? 'Không tìm thấy khách phù hợp.' : 'Chưa có dữ liệu đặt bàn.';
    tbody.innerHTML = `<tr><td colspan="6" class="customer-care-empty">${escapeHtml(message)}</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(profile => `
    <tr>
      <td><strong>${escapeHtml(profile.name)}</strong></td>
      <td>${profile.email ? escapeHtml(profile.email) : '—'}</td>
      <td>${profile.phone ? escapeHtml(profile.phone) : '—'}</td>
      <td>${profile.reservations.length}</td>
      <td>${escapeHtml(customerReservationDate(profile.latestReservation))}</td>
      <td><button type="button" class="btn-action btn-action--reply" data-customer-history="${escapeHtml(profile.id)}">Xem lịch sử</button></td>
    </tr>`).join('');
}

function openCustomerHistory(customerId) {
  const profile = buildCustomerProfiles(allReservations).find(item => item.id === customerId);
  const modal = document.getElementById('customer-history-modal');
  const content = document.getElementById('customer-history-content');
  if (!profile || !modal || !content) return;

  const title = document.getElementById('customer-history-title');
  if (title) title.textContent = `Lịch sử đặt bàn · ${profile.name}`;
  content.innerHTML = `
    <div class="customer-history-contact">
      ${profile.email ? `<span>${escapeHtml(profile.email)}</span>` : ''}
      ${profile.phone ? `<span>${escapeHtml(profile.phone)}</span>` : ''}
    </div>
    <div class="customer-history-list">${profile.reservations.map(reservation => {
      const notes = reservation.notes || reservation.specialRequest || '';
      const reservationId = reservation.reservationId || reservation.reservation_id;
      return `
        <article class="customer-history-item">
          <div>
            <strong>${escapeHtml(customerReservationDate(reservation))}</strong>
            <span>${Number(reservation.guests) || 2} khách · ${escapeHtml(getStatusLabel(reservation.status || 'pending'))}</span>
          </div>
          ${notes ? `<p>${escapeHtml(notes)}</p>` : ''}
          ${reservationId ? `<small>Mã đặt bàn: ${escapeHtml(reservationId)}</small>` : ''}
        </article>`;
    }).join('')}</div>`;
  modal.hidden = false;
}

function loadOrders() {
  const tbody = document.getElementById('orders-tbody');
  if (!tbody) return;
  const db = window.firebaseDb;
  const methods = window.firebaseFirestoreMethods;
  if (!db || !methods?.collection || !methods?.onSnapshot) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:40px;">Firestore chưa khởi tạo được. Kiểm tra cấu hình Firebase.</td></tr>';
    return;
  }

  if (ordersUnsubscribe) ordersUnsubscribe();
  ordersUnsubscribe = methods.onSnapshot(
    methods.collection(db, 'orders'),
    snapshot => {
      allOrders = snapshot.docs.map(document => ({ id: document.id, ...document.data() }));
      allOrders.sort((left, right) => getDateTime(right.createdAt || right.created_at) - getDateTime(left.createdAt || left.created_at));
      renderOrders();
      renderRevenue();
    },
    error => {
      console.error('[Firestore] Could not load orders:', error);
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:40px;">Không thể tải đơn gọi món. Kiểm tra Firebase Rules và quyền tài khoản.</td></tr>';
      showToast('Không tải được đơn gọi món từ Firestore.', 'error');
    }
  );
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

function getOrderStatusLabel(status) {
  return { new: 'Mới', preparing: 'Đang làm', in_progress: 'Đang làm', served: 'Đã phục vụ', completed: 'Hoàn tất', cancelled: 'Đã hủy' }[status] || status;
}

function renderOrders() {
  const tbody = document.getElementById('orders-tbody');
  if (!tbody) return;
  if (allOrders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:40px; color:var(--warm-gray);">Chưa có đơn gọi món.</td></tr>';
    return;
  }

  tbody.innerHTML = allOrders.map(order => {
    const items = Array.isArray(order.items) ? order.items : [];
    const status = order.status || 'new';
    const paymentStatus = order.paymentStatus || order.payment_status || 'unpaid';
    const orderId = order.orderId || order.order_id || order.id;
    const tableNumber = order.tableNumber || order.table_number || '--';
    return `
      <tr>
        <td><strong>${escapeHtml(orderId)}</strong><br><span class="order-table-number">Bàn ${escapeHtml(tableNumber)}</span></td>
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
}

window.updateOrderStatus = function(id, status) {
  const db = window.firebaseDb;
  const methods = window.firebaseFirestoreMethods;
  if (!db || !methods?.doc || !methods?.updateDoc || !id) return;
  const normalizedStatus = status === 'preparing' ? 'in_progress' : status;
  methods.updateDoc(methods.doc(db, 'orders', id), {
    status: normalizedStatus,
    updatedAt: new Date().toISOString()
  }).then(() => {
      showToast('Đã cập nhật trạng thái đơn gọi món.', 'success');
    })
    .catch(error => {
      console.error('[Firestore] Order status update failed:', error);
      showToast('Không thể cập nhật trạng thái đơn gọi món.', 'error');
    });
};

window.markOrderPaid = function(id) {
  const db = window.firebaseDb;
  const methods = window.firebaseFirestoreMethods;
  if (!db || !methods?.doc || !methods?.updateDoc || !id) return;
  const now = new Date().toISOString();
  methods.updateDoc(methods.doc(db, 'orders', id), {
    paymentStatus: 'paid',
    status: 'completed',
    paidAt: now,
    updatedAt: now
  }).then(() => {
    showToast('Đã ghi nhận thanh toán; doanh thu đã được cập nhật.', 'success');
  }).catch(error => {
    console.error('[Firestore] Order payment update failed:', error);
    showToast('Không thể cập nhật thanh toán cho đơn gọi món.', 'error');
  });
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
      const name  = (res.customerName || res.name || '').toLowerCase();
      const email = (res.email || '').toLowerCase();
      const phone = (res.phone || '').toLowerCase();
      if (!name.includes(searchQuery) && !email.includes(searchQuery) && !phone.includes(searchQuery)) {
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

    // Email status badge
    const emailStatus = res.emailStatus || res.email_status || 'Pending';
    const emailStatusLower = emailStatus.toLowerCase();
    const emailBadgeClass = `email-badge--${emailStatusLower === 'failed' ? 'failed' : (emailStatusLower === 'pending' ? 'pending' : 'sent')}`;

    const guestName = res.customerName || res.name || 'Khách';
    const notesText = res.specialRequest || res.notes || '';

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
            ${escapeHtml(getStatusLabel(rawStatus))}
          </span>
        </td>
        <td>
          <span class="email-badge ${emailBadgeClass}">
            ${escapeHtml(getEmailStatusLabel(emailStatus))}
          </span>
        </td>
        <td>
          <div class="action-btn-group">
            ${statusLower !== 'confirmed' ? `<button type="button" class="btn-action btn-action--approve" onclick="updateBookingStatus('${res.id}', 'Confirmed')">Xác nhận</button>` : ''}
            ${statusLower !== 'cancelled' ? `<button type="button" class="btn-action btn-action--cancel" onclick="updateBookingStatus('${res.id}', 'Cancelled')">Hủy</button>` : ''}
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
window.updateBookingStatus = function(id, newStatus) {
  const item = allReservations.find(r => r.id === id);
  const previousStatus = item ? item.status : null;
  const previousUpdatedAt = item ? item.updatedAt : null;
  const nowIso = new Date().toISOString();
  if (item) {
    item.status = newStatus;
    item.updatedAt = nowIso;
  }

  // Update localStorage
  try {
    const local = JSON.parse(localStorage.getItem('mocha_reservations') || '[]');
    local.forEach(r => {
      if (item && (r.email === item.email || r.reservationId === item.reservationId) && r.date === item.date && r.time === item.time) {
        r.status = newStatus;
        r.updatedAt = nowIso;
      }
    });
    localStorage.setItem('mocha_reservations', JSON.stringify(local));
  } catch (err) {}

  const db = window.firebaseDb;
  const methods = window.firebaseFirestoreMethods;
  if (db && methods?.doc && methods?.updateDoc && !String(id).startsWith('local_')) {
    methods.updateDoc(methods.doc(db, 'reservations', id), {
      status: newStatus.toLowerCase(),
      updatedAt: nowIso
    }).then(() => {
      // Fire status-change email via EmailJS
      const emailType = newStatus.toLowerCase() === 'confirmed' ? 'confirmed' : 'cancelled';
      if (item && item.email && (newStatus === 'Confirmed' || newStatus === 'Cancelled')) {
        if (typeof window.sendEmailJS === 'function') {
          window.sendEmailJS(item, emailType, id);
        }
      }
      showToast(`Đã cập nhật trạng thái đặt bàn thành "${getStatusLabel(newStatus)}".`, 'success');
    }).catch(err => {
      console.error('[Firestore] Reservation status update failed:', err);
      if (item) {
        item.status = previousStatus;
        item.updatedAt = previousUpdatedAt;
      }
      try {
        const local = JSON.parse(localStorage.getItem('mocha_reservations') || '[]');
        local.forEach(r => {
          if ((r.email === item?.email || r.reservationId === item?.reservationId) && r.date === item?.date && r.time === item?.time) {
            r.status = previousStatus;
            r.updatedAt = previousUpdatedAt;
          }
        });
        localStorage.setItem('mocha_reservations', JSON.stringify(local));
      } catch (storageError) {}
      updateStats();
      renderTable();
      renderCustomers();
      showToast('Không thể lưu trạng thái lên Firestore; số liệu đã được hoàn tác. Vui lòng thử lại.', 'error');
    });
  } else {
    // Local-only: still send email if available
    if (item && item.email && (newStatus === 'Confirmed' || newStatus === 'Cancelled')) {
      const emailType = newStatus.toLowerCase() === 'confirmed' ? 'confirmed' : 'cancelled';
      if (typeof window.sendEmailJS === 'function') {
        window.sendEmailJS(item, emailType, id);
      }
    }
    showToast(`Đã cập nhật trạng thái đặt bàn thành "${getStatusLabel(newStatus)}".`, 'info');
  }

  updateStats();
  renderTable();
  renderCustomers();
};

window.deleteBooking = function(id) {
  if (!confirm('Bạn có chắc muốn xóa lượt đặt bàn này không?')) return;

  const item = allReservations.find(r => r.id === id);
  allReservations = allReservations.filter(r => r.id !== id);

  // Remove from localStorage
  try {
    let local = JSON.parse(localStorage.getItem('mocha_reservations') || '[]');
    if (item) {
      local = local.filter(r => !(r.email === item.email && r.date === item.date && r.time === item.time));
    }
    localStorage.setItem('mocha_reservations', JSON.stringify(local));
  } catch (err) {}

  const db = window.firebaseDb;
  const methods = window.firebaseFirestoreMethods;
  if (db && methods?.doc && methods?.deleteDoc && !String(id).startsWith('local_')) {
    methods.deleteDoc(methods.doc(db, 'reservations', id)).then(() => {
      showToast('Đã xóa lượt đặt bàn.', 'success');
    }).catch(error => {
      console.error('[Firestore] Reservation delete failed:', error);
      showToast('Không thể xóa lượt đặt bàn trên Firestore.', 'error');
      loadReservations();
    });
  }

  updateStats();
  renderTable();
  renderCustomers();
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
