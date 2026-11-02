(() => {
  const ADMIN_EMAIL = 'lehwangduong@gmail.com';

  function showLoginMessage(message, isError = true) {
    const form = document.getElementById('admin-login-form');
    if (!form) return;
    let messageElement = form.querySelector('.form-error');
    if (!messageElement) {
      messageElement = document.createElement('p');
      messageElement.className = 'form-error';
      messageElement.setAttribute('role', isError ? 'alert' : 'status');
      form.appendChild(messageElement);
    }
    messageElement.textContent = message;
    messageElement.dataset.error = String(isError);
  }

  function setAuthenticatedView(isAuthenticated, email = '') {
    const loginSection = document.getElementById('admin-login-section');
    const dashboardSection = document.getElementById('admin-dashboard-section');
    const emailDisplay = document.getElementById('logged-admin-email');
    if (!loginSection || !dashboardSection) return;
    loginSection.hidden = isAuthenticated;
    loginSection.style.display = isAuthenticated ? 'none' : 'flex';
    dashboardSection.hidden = !isAuthenticated;
    dashboardSection.style.display = isAuthenticated ? 'block' : 'none';
    if (emailDisplay && email) emailDisplay.textContent = email;
  }

  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  function initialize() {
    const form = document.getElementById('admin-login-form');
    const forgotPasswordButton = document.getElementById('admin-forgot-password');
    const logoutButton = document.getElementById('admin-logout-btn');
    window.showToast = showToast;

    const methods = window.firebaseAuthMethods;
    const auth = window.firebaseAuth;
    if (!auth || !methods) {
      const reason = window.firebaseInitError?.message;
      showLoginMessage(reason
        ? `Không thể khởi tạo Firebase: ${reason}`
        : 'Firebase chưa khởi tạo được. Kiểm tra mạng, cấu hình Firebase và bật Email/Password trong Firebase Authentication.');
      return;
    }

    methods.onAuthStateChanged(auth, async user => {
      if (user?.email?.toLowerCase() === ADMIN_EMAIL) {
        setAuthenticatedView(true, user.email);
        showLoginMessage('', false);
        return;
      }
      setAuthenticatedView(false);
      if (user) {
        try {
          await methods.signOut(auth);
        } catch (error) {
          console.error('[HR Auth] Không thể đăng xuất tài khoản không có quyền:', error);
          showLoginMessage('Tài khoản này không có quyền truy cập quản lý nhân sự và không thể đăng xuất tự động.');
          return;
        }
        showLoginMessage('Tài khoản Firebase này không có quyền truy cập quản lý nhân sự.');
      }
    }, error => {
      console.error('[HR Auth] Không thể xác minh phiên Firebase:', error);
      setAuthenticatedView(false);
      showLoginMessage('Không thể xác minh phiên Firebase. Vui lòng tải lại trang hoặc đăng nhập lại.');
    });

    if (form) {
      form.addEventListener('submit', async event => {
        event.preventDefault();
        const email = document.getElementById('admin-email')?.value.trim() || '';
        const password = document.getElementById('admin-password')?.value || '';
        const submitButton = document.getElementById('admin-login-submit');
        const buttonText = submitButton?.querySelector('.btn-text');
        if (!email || !password) {
          showLoginMessage('Vui lòng nhập email quản trị và mật khẩu.');
          return;
        }
        if (email.toLowerCase() !== ADMIN_EMAIL) {
          showLoginMessage('Email này không có quyền truy cập quản lý nhân sự.');
          return;
        }

        if (submitButton) submitButton.disabled = true;
        if (buttonText) buttonText.textContent = 'Đang xác minh…';
        try {
          await methods.signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
          const errors = {
            'auth/invalid-email': 'Vui lòng nhập địa chỉ email hợp lệ.',
            'auth/user-disabled': 'Tài khoản quản trị này đã bị vô hiệu hóa.',
            'auth/too-many-requests': 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau.',
            'auth/network-request-failed': 'Lỗi kết nối mạng. Vui lòng kiểm tra kết nối.',
            'auth/invalid-credential': 'Email hoặc mật khẩu Firebase không đúng.',
            'auth/wrong-password': 'Email hoặc mật khẩu Firebase không đúng.',
            'auth/user-not-found': 'Email hoặc mật khẩu Firebase không đúng.',
            'auth/operation-not-allowed': 'Chưa bật đăng nhập bằng Email/Password trong Firebase Authentication.'
          };
          console.error('[HR Login Error]', error.code, error.message);
          showLoginMessage(errors[error.code] || error.message || 'Đăng nhập Firebase thất bại.');
        } finally {
          if (submitButton) submitButton.disabled = false;
          if (buttonText) buttonText.textContent = 'Đăng nhập';
        }
      });
    }

    if (forgotPasswordButton) {
      forgotPasswordButton.addEventListener('click', async () => {
        const email = document.getElementById('admin-email')?.value.trim() || '';
        if (!email) {
          showLoginMessage('Vui lòng nhập email để nhận liên kết đặt lại mật khẩu.');
          return;
        }
        if (email.toLowerCase() !== ADMIN_EMAIL) {
          showLoginMessage('Email này không có quyền truy cập quản lý nhân sự.');
          return;
        }
        try {
          await methods.sendPasswordResetEmail(auth, email);
          showLoginMessage('Đã gửi email đặt lại mật khẩu Firebase. Hãy kiểm tra hộp thư đến và Spam.', false);
        } catch (error) {
          console.error('[HR Password Reset Error]', error.code, error.message);
          showLoginMessage(error.message || 'Không thể gửi email đặt lại mật khẩu Firebase.');
        }
      });
    }

    if (logoutButton) {
      logoutButton.addEventListener('click', async () => {
        try {
          await methods.signOut(auth);
          form?.reset();
        } catch (error) {
          console.error('[HR Logout Error]', error);
          showToast('Không thể đăng xuất khỏi Firebase.', 'error');
        }
      });
    }
  }

  function waitForFirebase() {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (window.firebaseAuth && window.firebaseAuthMethods) {
        clearInterval(timer);
        initialize();
      } else if (window.firebaseInitError || attempts >= 200) {
        clearInterval(timer);
        initialize();
      }
    }, 50);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForFirebase, { once: true });
  } else {
    waitForFirebase();
  }
})();
