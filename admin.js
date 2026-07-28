/**
 * ============================================================
 * MOCHA & MISO — ADMIN PORTAL JAVASCRIPT
 * Admin authentication & reservation management system
 * Authentication: Firebase Auth (email/password)
 * ============================================================
 */

/* ──────────────────────────────────────────────────────────
   BOOT — wait for Firebase SDKs to be ready before init
   ────────────────────────────────────────────────────────── */
function bootAdmin() {
  // Firebase SDKs are loaded with defer, so poll until ready
  const waitForFirebase = setInterval(() => {
    const authInstance = window.firebaseAuth || window.auth || (typeof firebase !== 'undefined' ? firebase.auth() : null);
    if (authInstance && typeof authInstance.onAuthStateChanged === 'function') {
      clearInterval(waitForFirebase);
      initAdminAuth(authInstance);
      initAdminDashboard();
    }
  }, 80);

  // Safety fallback: if Firebase never loads, show a clear error
  setTimeout(() => {
    clearInterval(waitForFirebase);
    const authInstance = window.firebaseAuth || window.auth;
    if (!authInstance) {
      showLoginError('Firebase failed to load. Please refresh the page.');
    }
  }, 8000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootAdmin);
} else {
  bootAdmin();
}

/* ──────────────────────────────────────────────────────────
   1. ADMIN AUTHENTICATION — Firebase Auth primary
   ────────────────────────────────────────────────────────── */

function initAdminAuth(authInstance) {
  const loginSection = document.getElementById('admin-login-section');
  const dashSection  = document.getElementById('admin-dashboard-section');
  const loginForm    = document.getElementById('admin-login-form');
  const logoutBtn    = document.getElementById('admin-logout-btn');
  const emailDisplay = document.getElementById('logged-admin-email');

  // ── Session state driven by Firebase Auth ──────────────────
  authInstance.onAuthStateChanged((user) => {
    if (user) {
      // Authenticated: show dashboard
      if (emailDisplay) emailDisplay.textContent = user.email;
      loginSection.hidden = true;
      loginSection.style.display = 'none';
      dashSection.hidden = false;
      dashSection.style.display = 'block';
      loadReservations();
    } else {
      // Not authenticated: show login
      loginSection.hidden = false;
      loginSection.style.display = 'flex';
      dashSection.hidden = true;
      dashSection.style.display = 'none';
    }
  });

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

      // Clear previous error
      const existingErr = loginForm.querySelector('.form-error');
      if (existingErr) existingErr.remove();

      if (!email || !pass) {
        showLoginError('Please enter both admin email and password.');
        return;
      }

      // Loading state
      if (btnText) btnText.textContent = 'Verifying…';
      if (submitBtn) submitBtn.disabled = true;

      try {
        // Firebase Auth is the ONLY authentication gate
        await authInstance.signInWithEmailAndPassword(email, pass);
        // onAuthStateChanged above handles the view switch
      } catch (err) {
        // Map Firebase error codes to friendly messages
        let msg = 'Access Denied: Invalid email or password.';
        if (err.code === 'auth/invalid-email') {
          msg = 'Please enter a valid email address.';
        } else if (err.code === 'auth/user-disabled') {
          msg = 'This admin account has been disabled.';
        } else if (err.code === 'auth/too-many-requests') {
          msg = 'Too many failed attempts. Please try again later.';
        } else if (err.code === 'auth/network-request-failed') {
          msg = 'Network error. Please check your connection.';
        } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
          msg = 'Access Denied: Invalid email or password.';
        } else if (err.code === 'auth/operation-not-allowed') {
          msg = 'Email/Password login is not enabled. Please contact the administrator.';
        }
        console.error('[Admin Login Error]', err.code, err.message);
        showLoginError(msg);
      } finally {
        if (btnText) btnText.textContent = 'Log In to Portal';
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  // ── Logout ─────────────────────────────────────────────────
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await authInstance.signOut();
        // onAuthStateChanged above will flip back to login view
        if (loginForm) loginForm.reset();
      } catch (err) {
        console.warn('Sign-out error:', err.message);
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
  if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px;">Fetching reservations…</td></tr>';

  // Read local backup array
  let localData = [];
  try {
    localData = JSON.parse(localStorage.getItem('mocha_reservations') || '[]');
    localData = localData.map((item, idx) => ({
      id: 'local_' + (item.createdAt || idx),
      isLocal: true,
      ...item
    }));
  } catch (err) {
    console.warn('LocalStorage read error:', err);
  }

  // Try Firestore live listener
  const dbInstance = window.db || window.firebaseDb || (typeof db !== 'undefined' ? db : null);

  if (dbInstance && typeof dbInstance.collection === 'function') {
    dbInstance.collection('reservations').onSnapshot((snapshot) => {
      const remoteData = [];
      snapshot.forEach(doc => {
        remoteData.push({ id: doc.id, ...doc.data() });
      });

      // Merge remote and local (avoid duplicates)
      const mergedMap = new Map();
      localData.forEach(item => mergedMap.set(item.email + '_' + item.date + '_' + item.time, item));
      remoteData.forEach(item => mergedMap.set(item.email + '_' + item.date + '_' + item.time, item));

      allReservations = Array.from(mergedMap.values());
      // Sort newest first
      allReservations.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      updateStats();
      renderTable();
    }, (error) => {
      console.warn('Firestore snapshot notice, rendering local backup:', error);
      allReservations = localData;
      updateStats();
      renderTable();
    });
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
  const pending   = allReservations.filter(r => (r.status || 'Pending').toLowerCase() === 'pending').length;
  const confirmed = allReservations.filter(r => (r.status || '').toLowerCase() === 'confirmed').length;
  const guests    = allReservations.reduce((sum, r) => sum + (parseInt(r.guests, 10) || 2), 0);

  if (totalEl) totalEl.textContent = total;
  if (pendingEl) pendingEl.textContent = pending;
  if (confirmedEl) confirmedEl.textContent = confirmed;
  if (guestsEl) guestsEl.textContent = guests;
}

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
          No reservations found matching your criteria.
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
    const emailStatus = res.emailStatus || 'Sent';
    const emailStatusLower = emailStatus.toLowerCase();
    const emailBadgeClass = `email-badge--${emailStatusLower === 'failed' ? 'failed' : (emailStatusLower === 'pending' ? 'pending' : 'sent')}`;

    const guestName = res.customerName || res.name || 'Guest';
    const notesText = res.specialRequest || res.notes || '';

    return `
      <tr data-id="${res.id}">
        <td>
          <div style="font-weight: 600; color: var(--bark);">${escapeHtml(guestName)}</div>
          <div style="font-size: 12px; color: var(--warm-gray);">${escapeHtml(res.email || '')}</div>
          ${res.phone ? `<div style="font-size: 12px; color: var(--coffee-mid);">${escapeHtml(res.phone)}</div>` : ''}
          ${res.reservationId ? `<div style="font-size: 11px; color: var(--coffee); font-family: monospace;">ID: ${escapeHtml(res.reservationId)}</div>` : ''}
        </td>
        <td>
          <div style="font-weight: 500;">${escapeHtml(res.date || 'TBD')}</div>
          <div style="font-size: 12px; color: var(--coffee-mid);">${timeFormatted}</div>
        </td>
        <td style="font-weight: 600; text-align: center;">
          ${res.guests || 2}
        </td>
        <td style="max-width: 180px; font-size: 13px; color: var(--coffee-mid);">
          ${notesText ? escapeHtml(notesText) : '<span style="color:#A08070; font-style:italic;">None</span>'}
        </td>
        <td>
          <span class="status-badge ${statusClass}">
            <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:currentColor;"></span>
            ${rawStatus}
          </span>
        </td>
        <td>
          <span class="email-badge ${emailBadgeClass}">
            ${emailStatus}
          </span>
        </td>
        <td>
          <div class="action-btn-group">
            ${statusLower !== 'confirmed' ? `<button type="button" class="btn-action btn-action--approve" onclick="updateBookingStatus('${res.id}', 'Confirmed')">Confirm</button>` : ''}
            ${statusLower !== 'cancelled' ? `<button type="button" class="btn-action btn-action--cancel" onclick="updateBookingStatus('${res.id}', 'Cancelled')">Cancel</button>` : ''}
            <button type="button" class="btn-action btn-action--reply" onclick="openReplyModal('${res.id}')">Reply</button>
            <button type="button" class="btn-action btn-action--delete" onclick="deleteBooking('${res.id}')">✕</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
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

  // Update Firestore if available
  const dbInstance = window.db || window.firebaseDb || (typeof db !== 'undefined' ? db : null);
  if (dbInstance && typeof dbInstance.collection === 'function' && !id.startsWith('local_')) {
    dbInstance.collection('reservations').doc(id).update({
      status: newStatus,
      updatedAt: nowIso
    }).then(() => {
      // Fire status-change email via EmailJS
      const emailType = newStatus.toLowerCase() === 'confirmed' ? 'confirmed' : 'cancelled';
      if (item && item.email && (newStatus === 'Confirmed' || newStatus === 'Cancelled')) {
        if (typeof window.sendEmailJS === 'function') {
          window.sendEmailJS(item, emailType, id);
        }
      }
      showToast(`Reservation ${newStatus}. Email sent to guest.`, 'success');
    }).catch(err => {
      console.warn('Firestore status update notice:', err);
      showToast(`Status updated locally to ${newStatus}.`, 'info');
    });
  } else {
    // Local-only: still send email if available
    if (item && item.email && (newStatus === 'Confirmed' || newStatus === 'Cancelled')) {
      const emailType = newStatus.toLowerCase() === 'confirmed' ? 'confirmed' : 'cancelled';
      if (typeof window.sendEmailJS === 'function') {
        window.sendEmailJS(item, emailType, id);
      }
    }
    showToast(`Status updated to ${newStatus}.`, 'info');
  }

  updateStats();
  renderTable();
};

window.deleteBooking = function(id) {
  if (!confirm('Are you sure you want to remove this reservation?')) return;

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

  // Remove from Firestore
  const dbInstance = window.db || window.firebaseDb || (typeof db !== 'undefined' ? db : null);
  if (dbInstance && typeof dbInstance.collection === 'function' && !id.startsWith('local_')) {
    dbInstance.collection('reservations').doc(id).delete().catch(err => {
      console.warn('Firestore delete notice:', err);
    });
  }

  updateStats();
  renderTable();
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
    const statusText = isCancelled ? 'update regarding your table request' : 'confirmation for your table reservation';
    msgInput.value = `Dear ${res.customerName || res.name || 'Valued Guest'},\n\nThank you for choosing Mocha & Miso Craft Café!\n\nThis is an official ${statusText} on ${res.date || 'your requested date'} at ${formatTime(res.time)} for ${res.guests || 2} guest(s).\n\nIf you have any questions or changes, feel free to contact us at (555) 234-5678.\n\nWarm regards,\nMocha & Miso Team\n124 Artisan Alley, Craft District`;
  }

  if (modal) modal.hidden = false;
};

// Reply Modal Send & Close Buttons
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
        showToast('No recipient email found.', 'error');
        return;
      }

      const cfg = window.EMAILJS_CONFIG;
      if (!cfg || cfg.publicKey === 'YOUR_PUBLIC_KEY' || typeof emailjs === 'undefined') {
        showToast('EmailJS not configured — please set up credentials first.', 'error');
        return;
      }

      const res = currentReplyResId ? allReservations.find(r => r.id === currentReplyResId) : null;

      sendBtn.textContent = 'Sending…';
      sendBtn.disabled = true;

      // Use sendEmailJS with 'custom' type and the typed body
      if (typeof window.sendEmailJS === 'function' && res) {
        const cfg2 = window.EMAILJS_CONFIG;
        const templateParams = {
          to_email:        email,
          customer_name:   res.customerName || res.name || 'Valued Guest',
          reservation_id:  res.reservationId || res.id || 'N/A',
          date:            res.date || 'TBD',
          time:            (typeof formatTime === 'function' ? formatTime(res.time) : res.time) || 'TBD',
          guests:          String(res.guests || 2),
          special_request: res.specialRequest || res.notes || 'None',
          subject:         'A Message from Mocha & Miso Café',
          message_body:    body,
          cafe_address:    '124 Artisan Alley, Craft District',
          cafe_phone:      '(555) 234-5678',
          maps_link:       'https://maps.google.com/?q=124+Artisan+Alley+Craft+District'
        };
        emailjs.send(cfg2.serviceId, cfg2.templateId, templateParams)
          .then(() => {
            showToast(`Email sent to ${email} ✓`, 'success');
            if (modal) modal.hidden = true;
          })
          .catch(err => {
            console.warn('[EmailJS Reply Error]', err);
            showToast('Email failed to send. Check EmailJS credentials.', 'error');
          })
          .finally(() => {
            sendBtn.textContent = 'Send Email';
            sendBtn.disabled = false;
          });
      } else {
        showToast('EmailJS not ready. Please configure credentials.', 'error');
        sendBtn.textContent = 'Send Email';
        sendBtn.disabled = false;
      }
    });
  }
});

// Utilities
function formatTime(timeStr) {
  if (!timeStr) return '';
  if (timeStr.length === 4) {
    const hrs = parseInt(timeStr.slice(0, 2), 10);
    const mins = timeStr.slice(2);
    const period = hrs >= 12 ? 'PM' : 'AM';
    const displayHrs = hrs % 12 || 12;
    return `${displayHrs}:${mins} ${period}`;
  }
  return timeStr;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
