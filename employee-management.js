(() => {
  const EMPLOYEE_STORAGE_KEY = 'mocha_employees';
  const EMPLOYEE_DELETIONS_KEY = 'mocha_employee_deletions';
  let employees = [];
  let storageMode = 'supabase';
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
      ? 'Đang lưu trên thiết bị này; chưa đồng bộ Supabase.'
      : 'Đang đồng bộ với Supabase.';
    notice.classList.toggle('employee-storage-note--local', localOnly);
  }

  function rowData(employee) {
    return {
      name: employee.name,
      email: employee.email || null,
      phone: employee.phone || null,
      position: employee.position,
      status: employee.status === 'inactive' ? 'inactive' : 'active',
      updated_at: new Date().toISOString()
    };
  }

  function renderEmployees() {
    const tbody = document.getElementById('employees-tbody');
    if (!tbody) return;
    if (employees.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="employee-empty">Chưa có nhân viên.</td></tr>';
      return;
    }
    tbody.innerHTML = employees.map(employee => {
      const status = employee.status === 'inactive' ? 'inactive' : 'active';
      return `<tr>
        <td><strong>${escapeEmployeeHtml(employee.name)}</strong></td>
        <td>${employee.email ? `<div>${escapeEmployeeHtml(employee.email)}</div>` : ''}${employee.phone ? `<div>${escapeEmployeeHtml(employee.phone)}</div>` : ''}</td>
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
    document.getElementById('employee-name').value = employee ? employee.name || '' : '';
    document.getElementById('employee-email').value = employee ? employee.email || '' : '';
    document.getElementById('employee-phone').value = employee ? employee.phone || '' : '';
    document.getElementById('employee-position').value = employee ? employee.position || '' : '';
    document.getElementById('employee-status').value = employee && employee.status === 'inactive' ? 'inactive' : 'active';
    document.getElementById('employee-modal-title').textContent = employee ? 'Sửa hồ sơ nhân viên' : 'Thêm nhân viên';
    modal.hidden = false;
    document.getElementById('employee-name').focus();
  }

  async function saveEmployee(event) {
    event.preventDefault();
    const client = window.supabaseClient || window.supabaseDb;
    const id = document.getElementById('employee-id').value;
    const oldEmployee = employees.find(item => item.id === id);
    const employee = {
      id,
      name: document.getElementById('employee-name').value.trim(),
      email: document.getElementById('employee-email').value.trim(),
      phone: document.getElementById('employee-phone').value.trim(),
      position: document.getElementById('employee-position').value.trim(),
      status: document.getElementById('employee-status').value,
      created_at: oldEmployee?.created_at || new Date().toISOString()
    };
    if (!employee.name || !employee.position) return;
    const saveButton = document.getElementById('employee-save-btn');
    saveButton.disabled = true;
    try {
      if (!client || storageMode === 'local') throw new Error('Supabase chưa sẵn sàng');
      const payload = rowData(employee);
      let result;
      if (id && oldEmployee && !oldEmployee.pending_sync) {
        result = await client.from('employees').update(payload).eq('id', id).select().single();
      } else {
        result = await client.from('employees').insert({ ...payload, created_at: employee.created_at }).select().single();
      }
      if (result.error) throw result.error;
      const saved = result.data;
      employees = employees.filter(item => item.id !== id);
      employees.push(saved);
      writeEmployees();
      document.getElementById('employee-modal').hidden = true;
      event.target.reset();
      renderEmployees();
      showEmployeeToast(id ? 'Đã cập nhật nhân viên.' : 'Đã thêm nhân viên.', 'success');
    } catch (error) {
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
      showEmployeeToast('Đã lưu trên thiết bị này; Supabase sẽ đồng bộ khi kết nối lại.', 'info');
    } finally {
      saveButton.disabled = false;
    }
  }

  async function deleteEmployee(id) {
    const employee = employees.find(item => item.id === id);
    if (!employee || !confirm(`Xóa hồ sơ nhân viên ${employee.name || ''}?`)) return;
    const client = window.supabaseClient || window.supabaseDb;
    try {
      if (!client || storageMode === 'local' || employee.pending_sync) throw new Error('Supabase chưa sẵn sàng');
      const { error } = await client.from('employees').delete().eq('id', id);
      if (error) throw error;
      showEmployeeToast('Đã xóa nhân viên.', 'success');
    } catch (error) {
      storageMode = 'local';
      const ids = readDeletions();
      if (!String(id).startsWith('local_') && !ids.includes(id)) ids.push(id);
      writeDeletions(ids);
      showEmployeeToast('Đã xóa trên thiết bị này; Supabase sẽ đồng bộ khi kết nối lại.', 'info');
    }
    employees = employees.filter(item => item.id !== id);
    writeEmployees();
    renderEmployees();
    setStorageNotice();
  }

  async function syncPending(client, localEmployees, deletedIds) {
    for (const id of deletedIds) {
      const { error } = await client.from('employees').delete().eq('id', id);
      if (error) throw error;
    }
    for (const employee of localEmployees) {
      const payload = rowData(employee);
      if (employee.has_remote_record) {
        const { error } = await client.from('employees').update(payload).eq('id', employee.id);
        if (error) throw error;
      } else {
        const { error } = await client.from('employees').insert({ ...payload, created_at: employee.created_at });
        if (error) throw error;
      }
    }
    writeDeletions([]);
  }

  async function loadEmployees() {
    const client = window.supabaseClient || window.supabaseDb;
    employees = readEmployees();
    renderEmployees();
    if (!client || typeof client.from !== 'function') {
      storageMode = 'local';
      setStorageNotice();
      return;
    }
    try {
      const { data, error } = await client.from('employees').select('*').order('name', { ascending: true });
      if (error) throw error;
      const localPending = readEmployees().filter(item => item.pending_sync);
      const deletedIds = readDeletions();
      const deleted = new Set(deletedIds);
      const remote = (data || []).filter(item => !deleted.has(item.id));
      const remoteIds = new Set(remote.map(item => item.id));
      employees = remote.concat(localPending.filter(item => !remoteIds.has(item.id)));
      if (localPending.length || deletedIds.length) {
        if (syncing) return;
        syncing = true;
        await syncPending(client, localPending, deletedIds);
        syncing = false;
        const refreshed = await client.from('employees').select('*').order('name', { ascending: true });
        if (refreshed.error) throw refreshed.error;
        employees = refreshed.data || [];
        showEmployeeToast('Đã đồng bộ dữ liệu nhân viên với Supabase.', 'success');
      }
      storageMode = 'supabase';
      writeEmployees();
      setStorageNotice();
      renderEmployees();
    } catch (error) {
      syncing = false;
      storageMode = 'local';
      employees = readEmployees();
      setStorageNotice();
      renderEmployees();
      showEmployeeToast('Chưa tải được nhân viên từ Supabase. Dữ liệu local vẫn được giữ.', 'error');
      console.error('Employee Supabase error:', error);
    }
  }

  function initialize() {
    const orders = document.getElementById('admin-orders-section');
    if (!orders || document.getElementById('admin-employees-section')) return;
    const section = document.createElement('section');
    section.id = 'admin-employees-section';
    section.className = 'admin-employees-section';
    section.hidden = true;
    section.setAttribute('aria-labelledby', 'employees-heading');
    section.innerHTML = '<div class="admin-section-heading"><div><span class="admin-section-kicker">Nhân sự</span><h2 id="employees-heading">Quản lý nhân viên</h2><p id="employees-storage-note" class="employee-storage-note" role="status">Đang kết nối dữ liệu nhân viên...</p></div><button id="employee-add-btn" class="btn-action btn-action--approve" type="button">Thêm nhân viên</button></div><div class="admin-table-card"><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Họ và tên</th><th>Liên hệ</th><th>Chức vụ</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody id="employees-tbody"><tr><td colspan="5" class="employee-empty">Đang tải danh sách nhân viên...</td></tr></tbody></table></div></div>';
    orders.insertAdjacentElement('afterend', section);
    document.body.insertAdjacentHTML('beforeend', '<div id="employee-modal" class="admin-modal-overlay" hidden><form id="employee-form" class="admin-modal-card" aria-labelledby="employee-modal-title"><h3 id="employee-modal-title" class="admin-modal-title">Thêm nhân viên</h3><input id="employee-id" type="hidden"><div class="form-group employee-field"><input id="employee-name" class="form-input" type="text" maxlength="100" required><label class="form-label form-label--up" for="employee-name">Họ và tên</label></div><div class="form-group employee-field"><input id="employee-email" class="form-input" type="email" maxlength="254"><label class="form-label form-label--up" for="employee-email">Email</label></div><div class="form-group employee-field"><input id="employee-phone" class="form-input" type="tel" maxlength="30"><label class="form-label form-label--up" for="employee-phone">Số điện thoại</label></div><div class="form-group employee-field"><input id="employee-position" class="form-input" type="text" maxlength="80" required><label class="form-label form-label--up" for="employee-position">Chức vụ</label></div><div class="form-group employee-field"><label class="form-label form-label--up" for="employee-status">Trạng thái</label><select id="employee-status" class="form-input"><option value="active">Đang làm việc</option><option value="inactive">Đã nghỉ</option></select></div><div class="admin-modal-actions"><button id="employee-cancel-btn" class="btn btn-outline" type="button">Hủy</button><button id="employee-save-btn" class="btn btn-primary" type="submit">Lưu nhân viên</button></div></form></div>');
    const style = document.createElement('style');
    style.textContent = '.admin-employees-section{margin-top:64px}.employee-empty{text-align:center;padding:40px!important;color:var(--warm-gray)!important}.employee-storage-note{margin-top:6px;color:var(--success);font-size:12px}.employee-storage-note--local{color:#9b473e}.employee-status{display:inline-block;padding:5px 9px;border-radius:999px;font-size:12px;font-weight:600;white-space:nowrap}.employee-status--active{color:#286a59;background:#dceee7}.employee-status--inactive{color:#79594c;background:#eee4dd}.employee-actions{display:flex;gap:8px}.employee-field{margin-bottom:16px}.admin-modal-overlay[hidden]{display:none!important}';
    document.head.appendChild(style);
    document.getElementById('employee-add-btn').addEventListener('click', () => openEmployeeForm(''));
    document.getElementById('employee-cancel-btn').addEventListener('click', () => { document.getElementById('employee-modal').hidden = true; });
    document.getElementById('employee-form').addEventListener('submit', saveEmployee);
    document.getElementById('employees-tbody').addEventListener('click', event => {
      const button = event.target.closest('[data-employee-action]');
      if (!button) return;
      if (button.dataset.employeeAction === 'edit') openEmployeeForm(button.dataset.employeeId);
      if (button.dataset.employeeAction === 'delete') deleteEmployee(button.dataset.employeeId);
    });
    const client = window.supabaseClient || window.supabaseDb;
    const setUser = email => {
      const allowed = Boolean(email);
      section.hidden = !allowed;
      if (allowed) loadEmployees();
    };
    if (client?.auth) {
      client.auth.getSession().then(({ data }) => setUser(data?.session?.user?.email));
      client.auth.onAuthStateChange((_event, session) => setUser(session?.user?.email));
    } else {
      setUser(localStorage.getItem('mocha_admin_session'));
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize);
  else initialize();
})();
