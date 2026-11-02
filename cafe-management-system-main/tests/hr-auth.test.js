const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadHrAuth(user, options = {}) {
  const elements = new Map();
  const loginForm = {
    children: [],
    addEventListener(event, handler) {
      if (event === 'submit') this.submit = handler;
    },
    querySelector(selector) {
      return selector === '.form-error'
        ? this.children.find(child => child.className === 'form-error') || null
        : null;
    },
    appendChild(element) {
      this.children.push(element);
    },
    reset() {}
  };
  elements.set('admin-login-section', { hidden: false, style: {} });
  elements.set('admin-dashboard-section', { hidden: true, style: {} });
  elements.set('logged-admin-email', { textContent: '' });
  elements.set('admin-login-form', loginForm);
  elements.set('admin-email', { value: '' });
  elements.set('admin-password', { value: '' });
  elements.set('admin-login-submit', {
    disabled: false,
    querySelector: () => ({ textContent: 'Đăng nhập' })
  });
  elements.set('admin-forgot-password', { addEventListener(event, handler) { this.handler = handler; } });
  elements.set('admin-logout-btn', { addEventListener(event, handler) { this.handler = handler; } });
  elements.set('toast-container', { appendChild() {} });

  let deniedSignOuts = 0;
  const auth = user || options.auth ? {} : null;
  let intervalCallback;
  const methods = auth ? {
    onAuthStateChanged(_auth, callback) {
      Promise.resolve().then(() => callback(user));
    },
    signInWithEmailAndPassword: async (_auth, email, password) => {
      options.signIn?.(email, password);
    },
    signOut: async () => { deniedSignOuts += 1; },
    sendPasswordResetEmail: async () => {}
  } : null;
  const context = vm.createContext({
    document: {
      readyState: 'complete',
      getElementById(id) {
        return elements.get(id) || null;
      },
      createElement() {
        return { dataset: {}, setAttribute() {} };
      },
      addEventListener() {}
    },
    window: {
      firebaseAuth: auth,
      firebaseAuthMethods: methods,
      firebaseInitError: options.initError
    },
    console: { error() {} },
    setTimeout,
    setInterval(callback) {
      intervalCallback = callback;
      return 1;
    },
    clearInterval() {}
  });
  const source = fs.readFileSync(path.join(__dirname, '..', 'hr-auth.js'), 'utf8');
  vm.runInContext(source, context, { filename: 'hr-auth.js' });
  intervalCallback();
  return { elements, loginForm, deniedSignOuts: () => deniedSignOuts };
}

test('HR page reports missing Firebase configuration', () => {
  const { elements, loginForm } = loadHrAuth(null, { initError: new Error('missing config') });
  assert.equal(elements.get('admin-dashboard-section').hidden, true);
  assert.match(loginForm.children[0].textContent, /Không thể khởi tạo Firebase/);
});

test('Firebase admin account opens the HR dashboard', async () => {
  const { elements } = loadHrAuth({ email: 'lehwangduong@gmail.com' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(elements.get('admin-dashboard-section').hidden, false);
  assert.equal(elements.get('logged-admin-email').textContent, 'lehwangduong@gmail.com');
});

test('Firebase users other than the configured admin are signed out and denied access', async () => {
  const result = loadHrAuth({ email: 'staff@example.com' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(result.elements.get('admin-dashboard-section').hidden, true);
  assert.match(result.loginForm.children[0].textContent, /không có quyền truy cập/);
  assert.equal(result.deniedSignOuts(), 1);
});

test('HR sign-in only accepts the Firebase admin email', async () => {
  let signInCall;
  const { elements, loginForm } = loadHrAuth(null, {
    auth: true,
    signIn: (email, password) => { signInCall = { email, password }; }
  });
  elements.get('admin-email').value = 'other@example.com';
  elements.get('admin-password').value = 'password';
  await loginForm.submit({ preventDefault() {} });
  assert.equal(signInCall, undefined);
  assert.match(loginForm.children[0].textContent, /không có quyền truy cập/);

  elements.get('admin-email').value = 'lehwangduong@gmail.com';
  await loginForm.submit({ preventDefault() {} });
  assert.deepEqual(signInCall, { email: 'lehwangduong@gmail.com', password: 'password' });
});
