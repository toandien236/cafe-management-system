(() => {
  const EMPLOYEE_STORAGE_KEY = 'mocha_employees';
  const EMPLOYEE_DELETIONS_KEY = 'mocha_employee_deletions';
  let employees = [];
  let storageMode = 'firebase';
  let syncing = false;

  function escapeEmployeeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    })[character]);
  }

  function readEmployees() {
    try {
      const saved = JSON.parse(localStorage.getItem(EMPLOYEE_STORAGE_KEY) || '[]');
      return Array.isArray(saved) ? saved : [];
    } catch (error) {
      console.warn('Không đọc được nhân viên đã lưu:', error);
      return [];
    }
  }

  function writeEmployees() {
    try {
      localStorage.setItem(EMPLOYEE_STORAGE_KEY, JSON.stringify(employees));
      return true;
    } catch (error) {
      showEmployeeToast('Không thể lưu dữ liệu nhân viên trên thiết bị này.', 'error');
      return false;
    }
  }

  function readDeletions() {
    try {
      const saved = JSON.parse(localStorage.getItem(EMPLOYEE_DELETIONS_KEY) || '[]');
      return Array.isArray(saved) ? saved.filter(id => typeof id === 'string') : [];
    } catch (error) {
      return [];
    }
  }

  function writeDeletions(ids) {
    try {
      localStorage.setItem(EMPLOYEE_DELETIONS_KEY, JSON.stringify(ids));
      return true;
    } catch (error) {
      showEmployeeToast('Không thể lưu hàng đợi xóa nhân viên.', 'error');
      return false;
    }
  }

  function showEmployeeToast(message, type) {
    if (typeof window.showToast === 'function') {
      window.showToast(message, type);
      return;
    }
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type || 'info'}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  function setStorageNotice() {
    const notice = document.getElementById('employees-storage-note');
    if (!notice) return;
    const localOnly = storageMode === 'local';
    notice.textContent = localOnly
      ? 'Đang lưu trên thiết bị này; chưa đồng bộ Firebase.'
      : 'Đang đồng bộ với Firebase.';
    notice.classList.toggle('employee-storage-note--local', localOnly);
  }

  function rowData(employee) {
    return {
      employee_code: employee.employee_code || null,
      name: employee.name,
      birth_date: employee.birth_date || null,
      gender: employee.gender || null,
      email: employee.email || null,
      phone: employee.phone || null,
      address: employee.address || null,
      position: employee.position,
      status: employee.status === 'inactive' ? 'inactive' : 'active',
      updated_at: new Date().toISOString()
    };
  }

  function renderEmployees() {
    const tbody = document.getElementById('employees-tbody');
    if (!tbody) return;
    const query = (document.getElementById('employee-search')?.value || '').trim().toLocaleLowerCase('vi');
    const visibleEmployees = employees.filter(employee => [employee.employee_code, employee.name, employee.email, employee.phone, employee.position, employee.address]
      .some(value => String(value || '').toLocaleLowerCase('vi').includes(query)));
    if (visibleEmployees.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="employee-empty">Không có nhân viên khớp với tìm kiếm.</td></tr>';
      return;
    }
    tbody.innerHTML = visibleEmployees.map(employee => {
      const status = employee.status === 'inactive' ? 'inactive' : 'active';
      return `<tr>
        <td><strong>${escapeEmployeeHtml(employee.employee_code || '—')}</strong><div>${escapeEmployeeHtml(employee.name)}</div></td>
        <td>${employee.email ? `<div>${escapeEmployeeHtml(employee.email)}</div>` : ''}${employee.phone ? `<div>${escapeEmployeeHtml(employee.phone)}</div>` : ''}</td>
        <td>${employee.birth_date ? escapeEmployeeHtml(employee.birth_date) : '—'}<div>${escapeEmployeeHtml(employee.gender || '—')}</div></td>
        <td>${escapeEmployeeHtml(employee.address || '—')}</td>
        <td>${escapeEmployeeHtml(employee.position)}</td>
        <td><span class="employee-status employee-status--${status}">${status === 'active' ? 'Đang làm việc' : 'Đã nghỉ'}</span></td>
        <td><div class="employee-actions">
          <button class="btn-action btn-action--reply" type="button" data-employee-action="edit" data-employee-id="${escapeEmployeeHtml(employee.id)}">Sửa</button>
          <button class="btn-action btn-action--delete" type="button" data-employee-action="delete" data-employee-id="${escapeEmployeeHtml(employee.id)}">Xóa</button>
        </div></td>
      </tr>`;
    }).join('');
  }

  function openEmployeeForm(employeeId) {
    const employee = employees.find(item => item.id === employeeId);
    const form = document.getElementById('employee-form');
    const modal = document.getElementById('employee-modal');
    if (!form || !modal) return;
    form.reset();
    document.getElementById('employee-id').value = employee ? employee.id : '';
    document.getElementById('employee-code').value = employee ? employee.employee_code || '' : '';
    document.getElementById('employee-name').value = employee ? employee.name || '' : '';
    document.getElementById('employee-birth-date').value = employee ? employee.birth_date || '' : '';
    document.getElementById('employee-gender').value = employee ? employee.gender || '' : '';
    document.getElementById('employee-email').value = employee ? employee.email || '' : '';
    document.getElementById('employee-phone').value = employee ? employee.phone || '' : '';
    document.getElementById('employee-address').value = employee ? employee.address || '' : '';
    document.getElementById('employee-position').value = employee ? employee.position || '' : '';
    document.getElementById('employee-status').value = employee && employee.status === 'inactive' ? 'inactive' : 'active';
    document.getElementById('employee-modal-title').textContent = employee ? 'Sửa hồ sơ nhân viên' : 'Thêm nhân viên';
    modal.hidden = false;
    document.getElementById('employee-name').focus();
  }

  async function saveEmployee(event) {
    event.preventDefault();
    const db = window.firebaseDb;
    const methods = window.firebaseFirestoreMethods;
    const id = document.getElementById('employee-id').value;
    const oldEmployee = employees.find(item => item.id === id);
    const employee = {
      id,
      employee_code: document.getElementById('employee-code').value.trim(),
      name: document.getElementById('employee-name').value.trim(),
      birth_date: document.getElementById('employee-birth-date').value || null,
      gender: document.getElementById('employee-gender').value || null,
      email: document.getElementById('employee-email').value.trim(),
      phone: document.getElementById('employee-phone').value.trim(),
      address: document.getElementById('employee-address').value.trim(),
      position: document.getElementById('employee-position').value.trim(),
      status: document.getElementById('employee-status').value,
      created_at: oldEmployee?.created_at || new Date().toISOString()
    };
    if (!employee.employee_code || !employee.name || !employee.position) return;
    const duplicateCode = employees.find(item => item.id !== id && item.employee_code === employee.employee_code);
    if (duplicateCode) {
      showEmployeeToast('Mã nhân viên đã được sử dụng. Vui lòng nhập mã khác.', 'error');
      return;
    }
    const saveButton = document.getElementById('employee-save-btn');
    saveButton.disabled = true;
    try {
      if (!db || !methods || storageMode === 'local') throw new Error('Firebase chưa sẵn sàng');
      const payload = rowData(employee);
      if (id && oldEmployee && !oldEmployee.pending_sync) {
        await methods.updateDoc(methods.doc(db, 'employees', id), payload);
        employee.id = id;
      } else {
        const result = await methods.addDoc(methods.collection(db, 'employees'), { ...payload, created_at: employee.created_at });
        employee.id = result.id;
      }
      employees = employees.filter(item => item.id !== id);
      employees.push(employee);
      writeEmployees();
      document.getElementById('employee-modal').hidden = true;
      event.target.reset();
      renderEmployees();
      showEmployeeToast(id ? 'Đã cập nhật nhân viên.' : 'Đã thêm nhân viên.', 'success');
    } catch (error) {
      if (db && error?.code) {
        showEmployeeToast(`Không lưu được nhân viên: ${error.message || 'lỗi từ Firebase'}`, 'error');
        return;
      }
      storageMode = 'local';
      const localEmployee = {
        ...employee,
        id: id || `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        pending_sync: true,
        has_remote_record: Boolean(oldEmployee && !String(oldEmployee.id).startsWith('local_'))
      };
      employees = employees.filter(item => item.id !== id);
      employees.push(localEmployee);
      writeEmployees();
      document.getElementById('employee-modal').hidden = true;
      event.target.reset();
      renderEmployees();
      setStorageNotice();
      showEmployeeToast('Đã lưu trên thiết bị này; Firebase sẽ đồng bộ khi kết nối lại.', 'info');
    } finally {
      saveButton.disabled = false;
    }
  }

  async function deleteEmployee(id) {
    const employee = employees.find(item => item.id === id);
    if (!employee || !confirm(`Xóa hồ sơ nhân viên ${employee.name || ''}?`)) return;
    const db = window.firebaseDb;
    const methods = window.firebaseFirestoreMethods;
    try {
      if (!db || !methods || storageMode === 'local' || employee.pending_sync) throw new Error('Firebase chưa sẵn sàng');
      const related = await Promise.all(['employee_shifts', 'employee_attendance', 'employee_payroll']
        .map(name => methods.getDocs(methods.collection(db, name))));
      if (related.some(snapshot => snapshot.docs.some(item => item.data().employee_id === id))) {
        showEmployeeToast('Không thể xóa nhân viên đã có lịch ca, chấm công hoặc bảng lương.', 'error');
        return;
      }
      await methods.deleteDoc(methods.doc(db, 'employees', id));
      showEmployeeToast('Đã xóa nhân viên.', 'success');
    } catch (error) {
      if (db && error?.code) {
        showEmployeeToast(`Không xóa được nhân viên: ${error.message || 'lỗi từ Firebase'}`, 'error');
        return;
      }
      storageMode = 'local';
      const ids = readDeletions();
      if (!String(id).startsWith('local_') && !ids.includes(id)) ids.push(id);
      writeDeletions(ids);
      showEmployeeToast('Đã xóa trên thiết bị này; Firebase sẽ đồng bộ khi kết nối lại.', 'info');
    }
    employees = employees.filter(item => item.id !== id);
    writeEmployees();
    renderEmployees();
    setStorageNotice();
  }

  async function syncPending(db, methods, localEmployees, deletedIds) {
    for (const id of deletedIds) {
      await methods.deleteDoc(methods.doc(db, 'employees', id));
    }
    for (const employee of localEmployees) {
      const payload = rowData(employee);
      if (employee.has_remote_record) {
        await methods.setDoc(methods.doc(db, 'employees', employee.id), { ...payload, created_at: employee.created_at }, { merge: true });
      } else {
        await methods.setDoc(methods.doc(db, 'employees', employee.id), { ...payload, created_at: employee.created_at });
        employee.pending_sync = false;
      }
    }
    writeDeletions([]);
  }

  async function loadEmployees() {
    const db = window.firebaseDb;
    const methods = window.firebaseFirestoreMethods;
    employees = readEmployees();
    renderEmployees();
    if (!db || !methods) {
      storageMode = 'local';
      setStorageNotice();
      return;
    }
    try {
      const snapshot = await methods.getDocs(methods.collection(db, 'employees'));
      const data = snapshot.docs.map(item => ({ ...item.data(), id: item.id }));
      const localPending = readEmployees().filter(item => item.pending_sync);
      const deletedIds = readDeletions();
      const deleted = new Set(deletedIds);
      const remote = data.filter(item => !deleted.has(item.id));
      const remoteIds = new Set(remote.map(item => item.id));
      employees = remote.concat(localPending.filter(item => !remoteIds.has(item.id)));
      if (localPending.length || deletedIds.length) {
        if (syncing) return;
        syncing = true;
        try {
          await syncPending(db, methods, localPending, deletedIds);
          const refreshed = await methods.getDocs(methods.collection(db, 'employees'));
          employees = refreshed.docs.map(item => ({ ...item.data(), id: item.id }));
        } finally {
          syncing = false;
        }
        showEmployeeToast('Đã đồng bộ dữ liệu nhân viên với Firebase.', 'success');
      }
      storageMode = 'firebase';
      writeEmployees();
      setStorageNotice();
      renderEmployees();
    } catch (error) {
      syncing = false;
      storageMode = 'local';
      employees = readEmployees();
      setStorageNotice();
      renderEmployees();
      showEmployeeToast(`Chưa tải được nhân viên từ Firebase: ${error.message || 'lỗi kết nối'}. Dữ liệu trên thiết bị vẫn được giữ.`, 'error');
      console.error('Employee Firebase error:', error);
    }
  }

  function initialize() {
    const mount = document.querySelector('[data-hr-mount]') || document.querySelector('.admin-orders-section');
    if (!mount || document.getElementById('admin-employees-section')) return;
    const section = document.createElement('section');
    section.id = 'admin-employees-section';
    section.className = 'admin-employees-section';
    section.hidden = true;
    section.setAttribute('aria-labelledby', 'employees-heading');
    section.innerHTML = '<div class="admin-section-heading"><div><span class="admin-section-kicker">Nhân sự</span><h2 id="employees-heading">Quản lý nhân viên</h2><p id="employees-storage-note" class="employee-storage-note" role="status">Đang kết nối dữ liệu nhân viên...</p></div><div class="employee-toolbar"><input id="employee-search" type="search" class="form-input" placeholder="Tìm theo mã, tên, SĐT, chức vụ..." aria-label="Tìm kiếm nhân viên"><button id="employee-add-btn" class="btn-action btn-action--approve" type="button">Thêm nhân viên</button></div></div><div class="admin-table-card"><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Mã NV / Họ tên</th><th>Liên hệ</th><th>Ngày sinh / Giới tính</th><th>Địa chỉ</th><th>Chức vụ</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody id="employees-tbody"><tr><td colspan="7" class="employee-empty">Đang tải danh sách nhân viên...</td></tr></tbody></table></div></div>';
    mount.insertAdjacentElement('afterend', section);
    document.body.insertAdjacentHTML('beforeend', '<div id="employee-modal" class="admin-modal-overlay" hidden><form id="employee-form" class="admin-modal-card" aria-labelledby="employee-modal-title"><h3 id="employee-modal-title" class="admin-modal-title">Thêm nhân viên</h3><input id="employee-id" type="hidden"><div class="form-group employee-field"><input id="employee-code" class="form-input" type="text" maxlength="30" required><label class="form-label form-label--up" for="employee-code">Mã nhân viên</label></div><div class="form-group employee-field"><input id="employee-name" class="form-input" type="text" maxlength="100" required><label class="form-label form-label--up" for="employee-name">Họ và tên</label></div><div class="form-group employee-field"><input id="employee-birth-date" class="form-input" type="date"><label class="form-label form-label--up" for="employee-birth-date">Ngày sinh</label></div><div class="form-group employee-field"><label class="form-label form-label--up" for="employee-gender">Giới tính</label><select id="employee-gender" class="form-input"><option value="">Chưa chọn</option><option value="female">Nữ</option><option value="male">Nam</option><option value="other">Khác</option></select></div><div class="form-group employee-field"><input id="employee-email" class="form-input" type="email" maxlength="254"><label class="form-label form-label--up" for="employee-email">Email</label></div><div class="form-group employee-field"><input id="employee-phone" class="form-input" type="tel" maxlength="30"><label class="form-label form-label--up" for="employee-phone">Số điện thoại</label></div><div class="form-group employee-field"><input id="employee-address" class="form-input" type="text" maxlength="255"><label class="form-label form-label--up" for="employee-address">Địa chỉ</label></div><div class="form-group employee-field"><input id="employee-position" class="form-input" type="text" maxlength="80" required><label class="form-label form-label--up" for="employee-position">Chức vụ</label></div><div class="form-group employee-field"><label class="form-label form-label--up" for="employee-status">Trạng thái</label><select id="employee-status" class="form-input"><option value="active">Đang làm việc</option><option value="inactive">Đã nghỉ</option></select></div><div class="admin-modal-actions"><button id="employee-cancel-btn" class="btn btn-outline" type="button">Hủy</button><button id="employee-save-btn" class="btn btn-primary" type="submit">Lưu nhân viên</button></div></form></div>');
    const style = document.createElement('style');
    style.textContent = '.admin-employees-section{margin-top:64px}.employee-empty{text-align:center;padding:40px!important;color:var(--warm-gray)!important}.employee-storage-note{margin-top:6px;color:var(--success);font-size:12px}.employee-storage-note--local{color:#9b473e}.employee-status{display:inline-block;padding:5px 9px;border-radius:999px;font-size:12px;font-weight:600;white-space:nowrap}.employee-status--active{color:#286a59;background:#dceee7}.employee-status--inactive{color:#79594c;background:#eee4dd}.employee-actions{display:flex;gap:8px}.employee-field{margin-bottom:16px}.admin-modal-overlay[hidden]{display:none!important}';
    document.head.appendChild(style);
    document.getElementById('employee-add-btn').addEventListener('click', () => openEmployeeForm(''));
    document.getElementById('employee-cancel-btn').addEventListener('click', () => { document.getElementById('employee-modal').hidden = true; });
    document.getElementById('employee-form').addEventListener('submit', saveEmployee);
    document.getElementById('employee-search').addEventListener('input', renderEmployees);
    document.getElementById('employees-tbody').addEventListener('click', event => {
      const button = event.target.closest('[data-employee-action]');
      if (!button) return;
      if (button.dataset.employeeAction === 'edit') openEmployeeForm(button.dataset.employeeId);
      if (button.dataset.employeeAction === 'delete') deleteEmployee(button.dataset.employeeId);
    });
    const auth = window.firebaseAuth;
    const authMethods = window.firebaseAuthMethods;
    const setUser = user => {
      const allowed = user?.email?.toLowerCase() === 'lehwangduong@gmail.com';
      section.hidden = !allowed;
      if (allowed) loadEmployees();
    };
    if (auth && authMethods) {
      authMethods.onAuthStateChanged(auth, setUser, error => {
        console.error('Employee Firebase session error:', error);
        showEmployeeToast('Không thể xác minh phiên Firebase cho hồ sơ nhân viên.', 'error');
      });
    } else if (document.getElementById('employees-storage-note')) {
      document.getElementById('employees-storage-note').textContent = 'Chưa cấu hình Firebase; hồ sơ nhân viên chưa thể tải.';
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

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', waitForFirebase, { once: true });
  else waitForFirebase();
})();
