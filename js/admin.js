/**
 * ============================================================
 * MOCHA & MISO — ADMIN PORTAL JAVASCRIPT (SUPABASE / POSTGRESQL)
 * Admin authentication & reservation/order management system
 * ============================================================
 */

let allReservations = [];
let activeFilter    = 'all';
let searchQuery     = '';
let allOrders       = [];
let reservationsSubscription = null;
let ordersSubscription = null;

/* ──────────────────────────────────────────────────────────
   BOOT — initialize Admin Portal
   ────────────────────────────────────────────────────────── */
function bootAdmin() {
  const client = window.supabaseClient || window.supabaseDb;
  initAdminAuth(client);
  initAdminDashboard();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootAdmin);
} else {
  bootAdmin();
}

/* ──────────────────────────────────────────────────────────
   1. ADMIN AUTHENTICATION — Supabase Auth
   ────────────────────────────────────────────────────────── */
function initAdminAuth(client) {
  const loginSection = document.getElementById('admin-login-section');
  const dashSection  = document.getElementById('admin-dashboard-section');
  const loginForm    = document.getElementById('admin-login-form');
  const logoutBtn    = document.getElementById('admin-logout-btn');
  const emailDisplay = document.getElementById('logged-admin-email');
  const forgotPasswordBtn = document.getElementById('admin-forgot-password');

  function setAuthenticatedView(email) {
    if (emailDisplay) emailDisplay.textContent = email || 'Admin';
    if (loginSection) { loginSection.hidden = true; loginSection.style.display = 'none'; }
    if (dashSection) { dashSection.hidden = false; dashSection.style.display = 'block'; }
    loadReservations();
    loadOrders();
  }

  function setUnauthenticatedView() {
    if (loginSection) { loginSection.hidden = false; loginSection.style.display = 'flex'; }
    if (dashSection) { dashSection.hidden = true; dashSection.style.display = 'none'; }
    if (reservationsSubscription) { reservationsSubscription.unsubscribe(); reservationsSubscription = null; }
    if (ordersSubscription) { ordersSubscription.unsubscribe(); ordersSubscription = null; }
  }

  if (client && client.auth) {
    // Check active session
    client.auth.getSession().then(({ data: { session } }) => {
      if (session && session.user) {
        setAuthenticatedView(session.user.email);
      } else {
        setUnauthenticatedView();
      }
    }).catch(() => setUnauthenticatedView());

    // Listen for auth state change
    client.auth.onAuthStateChange((event, session) => {
      if (session && session.user) {
        setAuthenticatedView(session.user.email);
      } else {
        setUnauthenticatedView();
      }
    });
  } else {
    // Fallback: local session check
    const localSession = localStorage.getItem('mocha_admin_session');
    if (localSession) {
      setAuthenticatedView(localSession);
    } else {
      setUnauthenticatedView();
    }
  }

  // ── Login form submission ──────────────────────────────────
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const emailInput = document.getElementById('admin-email');
      const passInput  = document.getElementById('admin-password');
      const submitBtn  = document.getElementById('admin-login-submit');
      const btnText    = submitBtn ? submitBtn.querySelector('.btn-text') : null;

      const email = emailInput ? emailInput.value.trim() : '';
      const pass  = passInput  ? passInput.value.trim()  : '';

      const existingErr = loginForm.querySelector('.form-error');
      if (existingErr) existingErr.remove();

      if (!email || !pass) {
        showLoginError('Vui lòng nhập email quản trị và mật khẩu.');
        return;
      }

      if (btnText) btnText.textContent = 'Đang xác minh…';
      if (submitBtn) submitBtn.disabled = true;

      try {
        if (client && client.auth) {
          const { data, error } = await client.auth.signInWithPassword({
            email: email,
            password: pass
          });

          if (error) throw error;
          if (data && data.user) {
            setAuthenticatedView(data.user.email);
          }
        } else {
          // Demo fallback
          localStorage.setItem('mocha_admin_session', email);
          setAuthenticatedView(email);
        }
      } catch (err) {
        console.error('[Admin Login Error]', err);
        let msg = 'Truy cập bị từ chối: email hoặc mật khẩu không đúng.';
        if (err.message && err.message.toLowerCase().includes('invalid login credentials')) {
          msg = 'Email hoặc mật khẩu không chính xác.';
        } else if (err.message && err.message.toLowerCase().includes('rate limit')) {
          msg = 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau.';
        }
        showLoginError(msg);
      } finally {
        if (btnText) btnText.textContent = 'Đăng nhập';
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  if (forgotPasswordBtn) {
    forgotPasswordBtn.addEventListener('click', async () => {
      const emailInput = document.getElementById('admin-email');
      const email = emailInput ? emailInput.value.trim().toLowerCase() : '';
      if (!email) {
        showLoginError('Vui lòng nhập email quản trị để nhận liên kết đặt lại mật khẩu.');
        return;
      }
      try {
        if (client && client.auth) {
          const { error } = await client.auth.resetPasswordForEmail(email);
          if (error) throw error;
        }
        showLoginError('Đã gửi liên kết đặt lại mật khẩu đến email. Hãy kiểm tra cả hộp thư Spam.');
      } catch (err) {
        console.error('[Admin Password Reset Error]', err);
        showLoginError('Không thể gửi email đặt lại mật khẩu. Vui lòng kiểm tra lại tài khoản.');
      }
    });
  }

  // ── Logout ─────────────────────────────────────────────────
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        if (client && client.auth) {
          await client.auth.signOut();
        }
        localStorage.removeItem('mocha_admin_session');
        setUnauthenticatedView();
        if (loginForm) loginForm.reset();
      } catch (err) {
        console.warn('Lỗi đăng xuất:', err);
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
function initAdminDashboard() {
  const tabs = document.querySelectorAll('.admin-filter-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeFilter = tab.getAttribute('data-filter') || 'all';
      renderTable();
    });
  });

  const searchInput = document.getElementById('admin-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      renderTable();
    });
  }
}

async function loadReservations() {
  const tbody = document.getElementById('bookings-tbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px;">Đang tải danh sách đặt bàn…</td></tr>';

  let localData = [];
  try {
    localData = JSON.parse(localStorage.getItem('mocha_reservations') || '[]');
    localData = localData.map((item, idx) => ({
      id: item.id || ('local_' + (item.createdAt || idx)),
      name: item.name || item.customerName,
      reservation_id: item.reservation_id || item.reservationId,
      email: item.email,
      phone: item.phone,
      date: item.date,
      time: item.time,
      guests: item.guests,
      notes: item.notes || item.specialRequest,
      status: item.status,
      email_status: item.email_status || item.emailStatus || 'Pending',
      created_at: item.created_at || item.createdAt
    }));
  } catch (err) {}

  const client = window.supabaseClient || window.supabaseDb;

  if (client && typeof client.from === 'function') {
    try {
      const { data, error } = await client
        .from('reservations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        allReservations = data;
      } else {
        allReservations = localData;
      }

      updateStats();
      renderTable();

      // Subscribe to Realtime Postgres Changes
      if (!reservationsSubscription && client.channel) {
        reservationsSubscription = client
          .channel('public:reservations')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => {
            loadReservations();
          })
          .subscribe();
      }
    } catch (err) {
      console.warn('Supabase reservations load notice:', err);
      allReservations = localData;
      updateStats();
      renderTable();
    }
  } else {
    allReservations = localData;
    updateStats();
    renderTable();
  }
}

function updateStats() {
  const totalEl     = document.getElementById('stat-total');
  const pendingEl   = document.getElementById('stat-pending');
  const confirmedEl = document.getElementById('stat-confirmed');
  const guestsEl    = document.getElementById('stat-guests');

  const total     = allReservations.length;
  const pending   = allReservations.filter(r => (r.status || 'pending').toLowerCase() === 'pending').length;
  const confirmed = allReservations.filter(r => (r.status || '').toLowerCase() === 'confirmed').length;
  const guests    = allReservations.reduce((sum, r) => sum + (parseInt(r.guests, 10) || 2), 0);

  if (totalEl) totalEl.textContent = total;
  if (pendingEl) pendingEl.textContent = pending;
  if (confirmedEl) confirmedEl.textContent = confirmed;
  if (guestsEl) guestsEl.textContent = guests;
}

/* ──────────────────────────────────────────────────────────
   3. ORDERS MANAGEMENT (POSTGRESQL / SUPABASE)
   ────────────────────────────────────────────────────────── */
async function loadOrders() {
  const tbody = document.getElementById('orders-tbody');
  if (!tbody) return;

  const client = window.supabaseClient || window.supabaseDb;

  let localOrders = [];
  try {
    localOrders = JSON.parse(localStorage.getItem('mocha_orders') || '[]');
  } catch (e) {}

  if (client && typeof client.from === 'function') {
    try {
      const { data, error } = await client
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      allOrders = (data && data.length > 0) ? data : localOrders;
      renderOrders();

      // Subscribe to Realtime Postgres Changes
      if (!ordersSubscription && client.channel) {
        ordersSubscription = client
          .channel('public:orders')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
            loadOrders();
          })
          .subscribe();
      }
    } catch (err) {
      console.warn('Orders load notice:', err);
      allOrders = localOrders;
      renderOrders();
    }
  } else {
    allOrders = localOrders;
    renderOrders();
  }
}

function formatOrderMoney(value) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(value || 0));
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
    const paymentStatus = order.payment_status || order.paymentStatus || 'unpaid';
    const orderCode = order.order_id || order.orderId || order.id;
    const tableNum = order.table_number || order.tableNumber || '--';

    return `
      <tr>
        <td><strong>${escapeHtml(orderCode)}</strong><br><span class="order-table-number">Bàn ${escapeHtml(tableNum)}</span></td>
        <td>${items.map(item => `<div>${escapeHtml(item.name)} <strong>×${Number(item.quantity) || 0}</strong></div>`).join('')}${order.note ? `<small class="order-note">${escapeHtml(order.note)}</small>` : ''}</td>
        <td><strong>${formatOrderMoney(order.total)}</strong></td>
        <td><span class="order-status order-status--${escapeHtml(status)}">${getOrderStatusLabel(status)}</span></td>
        <td><span class="payment-status payment-status--${escapeHtml(paymentStatus)}">${paymentStatus === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán'}</span></td>
        <td><div class="order-actions">
          ${status === 'new' ? `<button class="btn-action btn-action--approve" type="button" onclick="updateOrderStatus('${order.id}', 'in_progress')">Bắt đầu làm</button>` : ''}
          ${(status === 'in_progress' || status === 'preparing') ? `<button class="btn-action btn-action--approve" type="button" onclick="updateOrderStatus('${order.id}', 'served')">Đã mang ra</button>` : ''}
          ${status === 'served' && paymentStatus !== 'paid' ? `<button class="btn-action btn-action--approve" type="button" onclick="markOrderPaid('${order.id}')">Đã thanh toán</button>` : ''}
          ${status !== 'completed' && status !== 'cancelled' ? `<button class="btn-action btn-action--cancel" type="button" onclick="updateOrderStatus('${order.id}', 'cancelled')">Hủy</button>` : ''}
        </div></td>
      </tr>`;
  }).join('');
}

window.updateOrderStatus = async function(id, status) {
  const client = window.supabaseClient || window.supabaseDb;
  if (!id) return;

  if (client && typeof client.from === 'function') {
    try {
      await client.from('orders').update({
        status: status
      }).eq('id', id);
    } catch (e) {
      console.warn('Order update notice:', e);
    }
  }

  // Update local state
  const target = allOrders.find(o => o.id === id);
  if (target) {
    target.status = status;
    renderOrders();
  }
};

window.markOrderPaid = async function(id) {
  const client = window.supabaseClient || window.supabaseDb;
  if (!id) return;

  const nowIso = new Date().toISOString();
  if (client && typeof client.from === 'function') {
    try {
      await client.from('orders').update({
        payment_status: 'paid',
        status: 'completed',
        paid_at: nowIso
      }).eq('id', id);
    } catch (e) {
      console.warn('Order payment update notice:', e);
    }
  }

  const target = allOrders.find(o => o.id === id);
  if (target) {
    target.payment_status = 'paid';
    target.status = 'completed';
    target.paid_at = nowIso;
    renderOrders();
  }
};

/* ──────────────────────────────────────────────────────────
   4. RENDER RESERVATIONS TABLE
   ────────────────────────────────────────────────────────── */
function renderTable() {
  const tbody = document.getElementById('bookings-tbody');
  if (!tbody) return;

  let filtered = allReservations.filter(res => {
    const resStatus = (res.status || 'pending').toLowerCase();
    if (activeFilter !== 'all' && resStatus !== activeFilter.toLowerCase()) return false;

    if (searchQuery) {
      const name  = (res.name || res.customerName || '').toLowerCase();
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
    const rawStatus = res.status || 'pending';
    const statusLower = rawStatus.toLowerCase();
    const statusClass = `status--${statusLower}`;
    const timeFormatted = formatTime(res.time);

    const emailStatus = res.email_status || res.emailStatus || 'Sent';
    const emailStatusLower = emailStatus.toLowerCase();
    const emailBadgeClass = `email-badge--${emailStatusLower === 'failed' ? 'failed' : (emailStatusLower === 'pending' ? 'pending' : 'sent')}`;

    const guestName = res.name || res.customerName || 'Khách';
    const notesText = res.notes || res.specialRequest || '';
    const resCode   = res.reservation_id || res.reservationId || res.id;

    return `
      <tr data-id="${res.id}">
        <td>
          <div style="font-weight: 600; color: var(--bark);">${escapeHtml(guestName)}</div>
          <div style="font-size: 12px; color: var(--warm-gray);">${escapeHtml(res.email || '')}</div>
          ${res.phone ? `<div style="font-size: 12px; color: var(--coffee-mid);">${escapeHtml(res.phone)}</div>` : ''}
          ${resCode ? `<div style="font-size: 11px; color: var(--coffee); font-family: monospace;">Mã: ${escapeHtml(resCode)}</div>` : ''}
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
            ${statusLower !== 'confirmed' ? `<button type="button" class="btn-action btn-action--approve" onclick="updateBookingStatus('${res.id}', 'confirmed')">Xác nhận</button>` : ''}
            ${statusLower !== 'cancelled' ? `<button type="button" class="btn-action btn-action--cancel" onclick="updateBookingStatus('${res.id}', 'cancelled')">Hủy</button>` : ''}
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

// Global booking actions
window.updateBookingStatus = async function(id, newStatus) {
  const item = allReservations.find(r => r.id === id);
  const normalizedStatus = newStatus.toLowerCase();
  const client = window.supabaseClient || window.supabaseDb;

  if (item) item.status = normalizedStatus;
  updateStats();
  renderTable();

  if (client && typeof client.from === 'function' && !String(id).startsWith('local_')) {
    try {
      const { error } = await client.from('reservations').update({
        status: normalizedStatus
      }).eq('id', id);

      if (error) throw error;

      if (item && item.email && (normalizedStatus === 'confirmed' || normalizedStatus === 'cancelled')) {
        if (typeof window.sendEmailJS === 'function') {
          window.sendEmailJS(item, normalizedStatus, id);
        }
      }
      showToast(`Đặt bàn ${getStatusLabel(normalizedStatus).toLowerCase()}. Email đã được gửi cho khách.`, 'success');
    } catch (err) {
      console.warn('Booking status update notice:', err);
      showToast('Đã lưu thay đổi trạng thái.', 'info');
    }
  } else {
    showToast(`Đã cập nhật trạng thái thành "${getStatusLabel(normalizedStatus)}".`, 'info');
  }
};

window.deleteBooking = async function(id) {
  if (!confirm('Bạn có chắc muốn xóa lượt đặt bàn này không?')) return;

  allReservations = allReservations.filter(r => r.id !== id);
  updateStats();
  renderTable();

  const client = window.supabaseClient || window.supabaseDb;
  if (client && typeof client.from === 'function' && !String(id).startsWith('local_')) {
    try {
      await client.from('reservations').delete().eq('id', id);
    } catch (err) {
      console.warn('Delete booking notice:', err);
    }
  }
};

// Reply Modal
let currentReplyResId = null;

window.openReplyModal = function(id) {
  const res = allReservations.find(r => r.id === id);
  if (!res) return;

  currentReplyResId = id;
  const modal      = document.getElementById('reply-modal');
  const emailInput = document.getElementById('modal-guest-email');
  const msgInput   = document.getElementById('modal-message');

  if (emailInput) emailInput.value = res.email || '';
  if (msgInput) {
    const isCancelled = (res.status || '').toLowerCase() === 'cancelled';
    const statusText = isCancelled ? 'cập nhật về yêu cầu đặt bàn' : 'xác nhận đặt bàn';
    msgInput.value = `Kính gửi ${res.name || res.customerName || 'Quý khách'},\n\nCảm ơn bạn đã chọn Mocha & Miso!\n\nĐây là thông tin ${statusText} của bạn vào ngày ${res.date || 'ngày bạn yêu cầu'} lúc ${formatTime(res.time)} dành cho ${res.guests || 2} khách.\n\nNếu cần hỗ trợ hoặc thay đổi thông tin, vui lòng liên hệ chúng tôi qua số (555) 234-5678.\n\nThân mến,\nĐội ngũ Mocha & Miso\n124 Artisan Alley, Craft District`;
  }

  if (modal) modal.hidden = false;
};

document.addEventListener('DOMContentLoaded', () => {
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

      if (typeof window.sendEmailJS === 'function' && res) {
        const templateParams = {
          to_email:        email,
          customer_name:   res.name || res.customerName || 'Quý khách',
          reservation_id:  res.reservation_id || res.reservationId || res.id || 'N/A',
          date:            res.date || 'TBD',
          time:            formatTime(res.time) || res.time || 'TBD',
          guests:          String(res.guests || 2),
          special_request: res.notes || res.specialRequest || 'Không có',
          subject:         'Tin nhắn từ Mocha & Miso Café',
          message_body:    body,
          cafe_address:    '124 Artisan Alley, Craft District',
          cafe_phone:      '(555) 234-5678',
          maps_link:       'https://maps.google.com/?q=124+Artisan+Alley+Craft+District'
        };

        emailjs.send(cfg.serviceId, cfg.templateId, templateParams)
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
      }
    });
  }
});

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

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
