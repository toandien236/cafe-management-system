const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadAdminScript() {
  const elements = new Map();
  const loginForm = {
    handlers: {},
    addEventListener(type, handler) {
      this.handlers[type] = handler;
    },
    querySelector() {
      return null;
    },
    appendChild(element) {
      this.error = element;
    },
    reset() {}
  };
  const makeElement = () => ({
    hidden: false,
    style: {},
    addEventListener() {},
    querySelector() {
      return { textContent: '' };
    }
  });
  const document = {
    readyState: 'loading',
    addEventListener() {},
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, makeElement());
      return elements.get(id);
    },
    createElement() {
      return { setAttribute() {} };
    }
  };
  elements.set('admin-login-form', loginForm);
  elements.set('admin-email', { value: 'lehwangduong@gmail.com' });
  elements.set('admin-password', { value: 'firebase-password' });

  const context = vm.createContext({
    document,
    window: {},
    console: { error() {}, warn() {} },
    localStorage: { getItem: () => '[]', setItem() {}, removeItem() {} },
    setTimeout() {},
    setInterval() {},
    clearInterval() {},
    confirm: () => true
  });
  const source = fs.readFileSync(path.join(__dirname, '..', 'admin.js'), 'utf8');
  vm.runInContext(source, context, { filename: 'admin.js' });
  return { context, elements, loginForm };
}

test('admin login uses Firebase Auth with the configured admin email', async () => {
  const { context, elements, loginForm } = loadAdminScript();
  const calls = [];
  context.initAdminAuth({
    onAuthStateChanged() {},
    signInWithEmailAndPassword: async (email, password) => calls.push([email, password]),
    signOut: async () => {},
    sendPasswordResetEmail: async () => {}
  });

  await loginForm.handlers.submit({ preventDefault() {} });

  assert.deepEqual(calls, [['lehwangduong@gmail.com', 'firebase-password']]);
  assert.equal(elements.get('admin-login-form').error, undefined);
});

test('admin login blocks emails outside the configured admin account', async () => {
  const { context, elements, loginForm } = loadAdminScript();
  let signInCalled = false;
  elements.get('admin-email').value = 'someone@example.com';
  context.initAdminAuth({
    onAuthStateChanged() {},
    signInWithEmailAndPassword: async () => {
      signInCalled = true;
    },
    signOut: async () => {},
    sendPasswordResetEmail: async () => {}
  });

  await loginForm.handlers.submit({ preventDefault() {} });

  assert.equal(signInCalled, false);
  assert.match(loginForm.error.textContent, /không có quyền/);
});
