(() => {
  const SHIFT_LABELS = { morning: 'Sáng', afternoon: 'Chiều', night: 'Tối' };
  const SHIFT_STARTS = { morning: '06:00', afternoon: '14:00', night: '22:00' };
  const SHIFT_ORDER = ['morning', 'afternoon', 'night'];
  let employees = [];
  let schedules = [];
  let attendance = [];
  let payroll = [];
  let active = false;

  const client = () => window.supabaseClient || window.supabaseDb;
  const today = () => new Date().toLocaleDateString('en-CA');
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const toast = (message, type = 'info') => window.showToast?.(message, type);
  const employeeName = id => employees.find(person => person.id === id)?.name || 'Nhân viên đã xóa';
  const employeeOptions = () => employees.filter(person => person.status !== 'inactive').map(person => `<option value="${escapeHtml(person.id)}">${escapeHtml(person.employee_code || '')} ${escapeHtml(person.name)}</option>`).join('');

  function parseTime(value) {
    const match = /^(\d{2}):(\d{2})$/.exec(value || '');
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (minutes > 59 || hours > 24 || (hours === 24 && minutes !== 0)) return null;
    return hours * 60 + minutes;
  }

  function workedMinutes(row) {
    const start = parseTime(row.check_in);
    const end = parseTime(row.check_out);
    if (start === null || end === null) return 0;
    return Math.max(0, end + (end < start ? 1440 : 0) - start);
  }

  function attendanceState(row) {
    if (row.status === 'absent') return 'Vắng';
    if (row.status === 'late') return 'Đi trễ';
    if (row.status === 'present') return 'Đúng giờ';
    return 'Chưa chấm công';
  }

  function selectHtml(id, label, options) {
    return `<label class="staff-field"><span>${label}</span><select id="${id}" required>${options}</select></label>`;
  }

  function render() {
    const employeeSelects = ['staff-shift-employee', 'staff-attendance-employee', 'staff-payroll-employee'];
    employeeSelects.forEach(id => {
      const select = document.getElementById(id);
      if (!select) return;
      const current = select.value;
      select.innerHTML = `<option value="">Chọn nhân viên</option>${employeeOptions()}`;
      if (employees.some(person => person.id === current)) select.value = current;
    });
    renderSchedules();
    renderAttendance();
    renderPayroll();
    renderReport();
  }

  function renderSchedules() {
    const body = document.getElementById('staff-schedule-rows');
    if (!body) return;
    body.innerHTML = schedules.length ? schedules.map(row => `<tr>
      <td>${escapeHtml(row.work_date)}</td><td>${escapeHtml(employeeName(row.employee_id))}</td><td>${SHIFT_LABELS[row.shift] || '—'}</td>
      <td>${escapeHtml(row.status === 'absent' ? 'Vắng' : 'Đã xếp')}</td><td><button type="button" class="btn-action btn-action--reply" data-shift-change="${escapeHtml(row.id)}">Đổi ca</button></td>
    </tr>`).join('') : '<tr><td colspan="5" class="staff-empty">Chưa có lịch làm.</td></tr>';
  }

  function renderAttendance() {
    const body = document.getElementById('staff-attendance-rows');
    if (!body) return;
    const filter = document.getElementById('staff-attendance-filter')?.value || '';
    const actual = attendance.filter(row => !filter || row.work_date === filter);
    const missing = schedules.filter(schedule => schedule.work_date < today() && (!filter || schedule.work_date === filter) && !attendance.some(row => row.employee_id === schedule.employee_id && row.work_date === schedule.work_date));
    const rows = actual.map(row => ({ ...row, virtual: false })).concat(missing.map(row => ({ ...row, check_in: '', check_out: '', status: 'absent', virtual: true })));
    body.innerHTML = rows.length ? rows.sort((a, b) => b.work_date.localeCompare(a.work_date)).map(row => `<tr>
      <td>${escapeHtml(row.work_date)}</td><td>${escapeHtml(employeeName(row.employee_id))}</td><td>${escapeHtml(row.check_in || '—')}</td><td>${escapeHtml(row.check_out || '—')}</td>
      <td>${row.virtual ? '0:00' : `${Math.floor(workedMinutes(row) / 60)}:${String(workedMinutes(row) % 60).padStart(2, '0')}`}</td><td>${attendanceState(row)}</td>
    </tr>`).join('') : '<tr><td colspan="6" class="staff-empty">Chưa có dữ liệu chấm công.</td></tr>';
  }

  function renderPayroll() {
    const body = document.getElementById('staff-payroll-rows');
    if (!body) return;
    const month = document.getElementById('staff-payroll-filter')?.value || '';
    const rows = payroll.filter(row => !month || row.pay_month === month);
    body.innerHTML = rows.length ? rows.map(row => `<tr><td>${escapeHtml(row.pay_month)}</td><td>${escapeHtml(employeeName(row.employee_id))}</td><td>${row.pay_type === 'monthly' ? 'Theo tháng' : 'Theo giờ'}</td><td>${Number(row.total_hours || 0).toFixed(2)}</td><td>${Number(row.net_pay || 0).toLocaleString('vi-VN')} ₫</td></tr>`).join('') : '<tr><td colspan="5" class="staff-empty">Chưa có bảng lương.</td></tr>';
  }

  function buildReportRows() {
    const month = document.getElementById('staff-report-month')?.value || '';
    const day = document.getElementById('staff-report-day')?.value || '';
    const relevantSchedules = schedules.filter(row => (!month || row.work_date.startsWith(month)) && (!day || row.work_date === day));
    const relevantAttendance = attendance.filter(row => (!month || row.work_date.startsWith(month)) && (!day || row.work_date === day));
    const payrollMonth = month || (day ? day.slice(0, 7) : '');
    const relevantPayroll = payroll.filter(row => !payrollMonth || row.pay_month === payrollMonth);
    const employeeIds = new Set([...employees.map(person => person.id), ...relevantSchedules.map(row => row.employee_id), ...relevantAttendance.map(row => row.employee_id)]);
    return [...employeeIds].map(id => {
      const employeeSchedules = relevantSchedules.filter(row => row.employee_id === id);
      const employeeAttendance = relevantAttendance.filter(row => row.employee_id === id);
      const absentSchedules = employeeSchedules.filter(schedule => schedule.work_date < today() && !employeeAttendance.some(row => row.work_date === schedule.work_date));
      const hours = employeeAttendance.reduce((sum, row) => sum + workedMinutes(row), 0) / 60;
      const late = employeeAttendance.filter(row => row.status === 'late').length;
      const absent = employeeAttendance.filter(row => row.status === 'absent').length + absentSchedules.length;
      const pay = relevantPayroll.filter(row => row.employee_id === id).reduce((sum, row) => sum + Number(row.net_pay || 0), 0);
      return { id, name: employeeName(id), status: employees.find(person => person.id === id)?.status === 'inactive' ? 'Đã nghỉ' : 'Đang làm', days: employeeAttendance.filter(row => row.status !== 'absent').length, hours, late, absent, pay };
    });
  }

  function renderReport() {
    const body = document.getElementById('staff-report-rows');
    if (!body) return;
    const rows = buildReportRows();
    document.getElementById('staff-report-count').textContent = String(rows.length);
    document.getElementById('staff-report-hours').textContent = rows.reduce((sum, row) => sum + row.hours, 0).toFixed(2);
    document.getElementById('staff-report-pay').textContent = `${rows.reduce((sum, row) => sum + row.pay, 0).toLocaleString('vi-VN')} ₫`;
    body.innerHTML = rows.length ? rows.map(row => `<tr><td>${escapeHtml(row.name)}</td><td>${row.status}</td><td>${row.days}</td><td>${row.hours.toFixed(2)}</td><td>${row.late}</td><td>${row.absent}</td><td>${row.pay.toLocaleString('vi-VN')} ₫</td></tr>`).join('') : '<tr><td colspan="7" class="staff-empty">Chưa có dữ liệu báo cáo.</td></tr>';
  }

  async function loadAll() {
    const db = client();
    if (!db?.from) return;
    const results = await Promise.all([
      db.from('employees').select('id, employee_code, name, status').order('name'),
      db.from('employee_shifts').select('*').order('work_date', { ascending: false }),
      db.from('employee_attendance').select('*').order('work_date', { ascending: false }),
      db.from('employee_payroll').select('*').order('pay_month', { ascending: false })
    ]);
    const failed = results.find(result => result.error);
    if (failed) {
      toast(`Không tải được dữ liệu nhân sự: ${failed.error.message}`, 'error');
      return;
    }
    [employees, schedules, attendance, payroll] = results.map(result => result.data || []);
    render();
  }

  function setPanel(panel) {
    document.querySelectorAll('[data-staff-panel]').forEach(node => { node.hidden = node.dataset.staffPanel !== panel; });
    document.querySelectorAll('[data-staff-tab]').forEach(node => { node.setAttribute('aria-selected', String(node.dataset.staffTab === panel)); });
  }

  async function submitSchedule(event) {
    event.preventDefault();
    const row = { work_date: document.getElementById('staff-shift-date').value, shift: document.getElementById('staff-shift-type').value, employee_id: document.getElementById('staff-shift-employee').value, status: 'scheduled' };
    const { error } = await client().from('employee_shifts').upsert(row, { onConflict: 'employee_id,work_date,shift' });
    if (error) return toast(`Không lưu được ca làm: ${error.message}`, 'error');
    event.target.reset();
    document.getElementById('staff-shift-date').value = today();
    await loadAll();
    toast('Đã phân ca cho nhân viên.', 'success');
  }

  async function changeShift(id) {
    const row = schedules.find(item => item.id === id);
    if (!row) return;
    const shift = SHIFT_ORDER[(SHIFT_ORDER.indexOf(row.shift) + 1) % SHIFT_ORDER.length];
    const { error } = await client().from('employee_shifts').update({ shift }).eq('id', id);
    if (error) return toast(`Không đổi được ca: ${error.message}`, 'error');
    await loadAll();
  }

  async function submitAttendance(event) {
    event.preventDefault();
    const date = document.getElementById('staff-attendance-date').value;
    const employeeId = document.getElementById('staff-attendance-employee').value;
    const checkIn = document.getElementById('staff-check-in').value.trim();
    const checkOut = document.getElementById('staff-check-out').value.trim();
    const start = parseTime(checkIn);
    const end = checkOut ? parseTime(checkOut) : null;
    if (start === null || (checkOut && end === null) || (end !== null && workedMinutes({ check_in: checkIn, check_out: checkOut }) <= 0)) return toast('Giờ vào/ra phải theo định dạng HH:mm. Có thể ghi 24:00 hoặc giờ ra qua ngày.', 'error');
    const shift = schedules.find(row => row.employee_id === employeeId && row.work_date === date);
    const expected = shift ? parseTime(SHIFT_STARTS[shift.shift]) : null;
    const status = expected !== null && start > expected + 10 ? 'late' : 'present';
    const row = { employee_id: employeeId, work_date: date, check_in: checkIn, check_out: checkOut || null, status };
    const { error } = await client().from('employee_attendance').upsert(row, { onConflict: 'employee_id,work_date' });
    if (error) return toast(`Không lưu được chấm công: ${error.message}`, 'error');
    event.target.reset();
    document.getElementById('staff-attendance-date').value = today();
    await loadAll();
    toast('Đã lưu chấm công.', 'success');
  }

  async function submitPayroll(event) {
    event.preventDefault();
    const employeeId = document.getElementById('staff-payroll-employee').value;
    const month = document.getElementById('staff-payroll-month').value;
    const type = document.getElementById('staff-pay-type').value;
    const hours = Number(document.getElementById('staff-pay-hours').value || 0);
    const hourlyRate = Number(document.getElementById('staff-hourly-rate').value || 0);
    const monthlySalary = Number(document.getElementById('staff-monthly-salary').value || 0);
    const overtime = Number(document.getElementById('staff-overtime-hours').value || 0);
    const bonus = Number(document.getElementById('staff-bonus').value || 0);
    const penalty = Number(document.getElementById('staff-penalty').value || 0);
    const gross = type === 'monthly' ? monthlySalary : hours * hourlyRate;
    const overtimePay = overtime * hourlyRate * 1.5;
    const row = { employee_id: employeeId, pay_month: month, pay_type: type, total_hours: hours, hourly_rate: hourlyRate, monthly_salary: monthlySalary, overtime_hours: overtime, overtime_pay: overtimePay, bonus, penalty, net_pay: Math.max(0, gross + overtimePay + bonus - penalty) };
    const { error } = await client().from('employee_payroll').upsert(row, { onConflict: 'employee_id,pay_month' });
    if (error) return toast(`Không lưu được bảng lương: ${error.message}`, 'error');
    await loadAll();
    toast('Đã lưu bảng lương.', 'success');
  }

  function fillPayrollHours() {
    const employeeId = document.getElementById('staff-payroll-employee')?.value;
    const month = document.getElementById('staff-payroll-month')?.value;
    if (!employeeId || !month) return;
    const minutes = attendance.filter(row => row.employee_id === employeeId && row.work_date.startsWith(month)).reduce((sum, row) => sum + workedMinutes(row), 0);
    document.getElementById('staff-pay-hours').value = (minutes / 60).toFixed(2);
  }

  function exportCsv() {
    const rows = buildReportRows();
    const values = [['Nhân viên', 'Trạng thái', 'Ngày công', 'Tổng giờ', 'Đi trễ', 'Vắng', 'Lương'], ...rows.map(row => [row.name, row.status, row.days, row.hours.toFixed(2), row.late, row.absent, row.pay])];
    const csv = '\uFEFF' + values.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.download = 'bao-cao-nhan-su.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  function initialize() {
    const mount = document.querySelector('[data-hr-mount]') || document.querySelector('.admin-orders-section');
    if (!mount || document.getElementById('staff-operations')) return;
    const section = document.createElement('section');
    section.id = 'staff-operations';
    section.className = 'staff-operations';
    section.hidden = true;
    section.innerHTML = `
      <div class="admin-section-heading"><div><span class="admin-section-kicker">Nhân sự</span><h2>Ca làm, chấm công, lương và báo cáo</h2><p>Quản lý lịch làm và tổng hợp giờ công theo ngày hoặc tháng.</p></div></div>
      <div class="staff-tabs" role="tablist"><button type="button" data-staff-tab="shifts" aria-selected="true">Ca làm</button><button type="button" data-staff-tab="attendance" aria-selected="false">Chấm công</button><button type="button" data-staff-tab="payroll" aria-selected="false">Bảng lương</button><button type="button" data-staff-tab="report" aria-selected="false">Báo cáo</button></div>
      <section data-staff-panel="shifts"><form class="staff-form" id="staff-shift-form"><h3>Phân ca</h3><label class="staff-field"><span>Ngày làm</span><input id="staff-shift-date" type="date" required></label>${selectHtml('staff-shift-type','Ca làm','<option value="morning">Sáng</option><option value="afternoon">Chiều</option><option value="night">Tối</option>')}${selectHtml('staff-shift-employee','Nhân viên','<option value="">Đang tải...</option>')}<button class="btn btn-primary" type="submit">Lưu ca</button></form><div class="admin-table-card staff-table"><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Ngày</th><th>Nhân viên</th><th>Ca</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody id="staff-schedule-rows"></tbody></table></div></div></section>
      <section data-staff-panel="attendance" hidden><form class="staff-form" id="staff-attendance-form"><h3>Chấm công theo ngày</h3><label class="staff-field"><span>Ngày</span><input id="staff-attendance-date" type="date" required></label>${selectHtml('staff-attendance-employee','Nhân viên','<option value="">Đang tải...</option>')}<label class="staff-field"><span>Giờ vào</span><input id="staff-check-in" type="text" inputmode="numeric" maxlength="5" placeholder="HH:mm" pattern="(?:[01][0-9]|2[0-3]):[0-5][0-9]" required></label><label class="staff-field"><span>Giờ ra</span><input id="staff-check-out" type="text" inputmode="numeric" maxlength="5" placeholder="HH:mm" pattern="(?:[01][0-9]|2[0-3]):[0-5][0-9]|24:00"></label><button class="btn btn-primary" type="submit">Lưu chấm công</button></form><div class="staff-filter"><label>Ngày xem <input id="staff-attendance-filter" type="date"></label></div><div class="admin-table-card staff-table"><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Ngày</th><th>Nhân viên</th><th>Vào</th><th>Ra</th><th>Số giờ</th><th>Trạng thái</th></tr></thead><tbody id="staff-attendance-rows"></tbody></table></div></div></section>
      <section data-staff-panel="payroll" hidden><form class="staff-form" id="staff-payroll-form"><h3>Lập bảng lương</h3>${selectHtml('staff-payroll-employee','Nhân viên','<option value="">Đang tải...</option>')}<label class="staff-field"><span>Tháng</span><input id="staff-payroll-month" type="month" required></label><label class="staff-field"><span>Hình thức</span><select id="staff-pay-type"><option value="hourly">Theo giờ</option><option value="monthly">Theo tháng</option></select></label><label class="staff-field"><span>Tổng giờ thường</span><input id="staff-pay-hours" type="number" min="0" step="0.25" value="0"></label><label class="staff-field"><span>Lương mỗi giờ</span><input id="staff-hourly-rate" type="number" min="0" step="1000" value="30000"></label><label class="staff-field"><span>Lương tháng</span><input id="staff-monthly-salary" type="number" min="0" step="100000" value="0"></label><label class="staff-field"><span>Giờ tăng ca</span><input id="staff-overtime-hours" type="number" min="0" step="0.25" value="0"></label><label class="staff-field"><span>Thưởng</span><input id="staff-bonus" type="number" min="0" value="0"></label><label class="staff-field"><span>Phạt</span><input id="staff-penalty" type="number" min="0" value="0"></label><button class="btn btn-primary" type="submit">Tính và lưu lương</button></form><div class="staff-filter"><label>Tháng xem <input id="staff-payroll-filter" type="month"></label></div><div class="admin-table-card staff-table"><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Tháng</th><th>Nhân viên</th><th>Hình thức</th><th>Tổng giờ</th><th>Thực nhận</th></tr></thead><tbody id="staff-payroll-rows"></tbody></table></div></div></section>
      <section data-staff-panel="report" hidden><div class="staff-report-filters"><label>Lọc tháng <input id="staff-report-month" type="month"></label><label>Lọc ngày <input id="staff-report-day" type="date"></label><button class="btn btn-outline" id="staff-export-report" type="button">Xuất CSV</button></div><div class="staff-summary"><article><span>Nhân viên</span><strong id="staff-report-count">0</strong></article><article><span>Tổng giờ làm</span><strong id="staff-report-hours">0</strong></article><article><span>Tổng lương</span><strong id="staff-report-pay">0 ₫</strong></article></div><div class="admin-table-card staff-table"><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Nhân viên</th><th>Trạng thái</th><th>Ngày công</th><th>Giờ làm</th><th>Đi trễ</th><th>Vắng</th><th>Lương</th></tr></thead><tbody id="staff-report-rows"></tbody></table></div></div></section>`;
    const employeeSection = document.getElementById('admin-employees-section');
    (employeeSection || mount).insertAdjacentElement('afterend', section);
    document.getElementById('staff-shift-date').value = today();
    document.getElementById('staff-attendance-date').value = today();
    document.getElementById('staff-payroll-month').value = today().slice(0, 7);
    document.getElementById('staff-payroll-filter').value = today().slice(0, 7);
    document.querySelectorAll('[data-staff-tab]').forEach(button => button.addEventListener('click', () => setPanel(button.dataset.staffTab)));
    document.getElementById('staff-shift-form').addEventListener('submit', submitSchedule);
    document.getElementById('staff-attendance-form').addEventListener('submit', submitAttendance);
    document.getElementById('staff-payroll-form').addEventListener('submit', submitPayroll);
    document.getElementById('staff-payroll-employee').addEventListener('change', fillPayrollHours);
    document.getElementById('staff-payroll-month').addEventListener('change', fillPayrollHours);
    document.getElementById('staff-schedule-rows').addEventListener('click', event => { const button = event.target.closest('[data-shift-change]'); if (button) changeShift(button.dataset.shiftChange); });
    document.getElementById('staff-export-report').addEventListener('click', exportCsv);
    ['staff-attendance-filter', 'staff-payroll-filter', 'staff-report-month', 'staff-report-day'].forEach(id => document.getElementById(id).addEventListener('change', render));
    const db = client();
    const setUser = session => {
      active = Boolean(session?.user);
      section.hidden = !active;
      if (active) loadAll();
    };
    if (db?.auth) {
      db.auth.getSession().then(({ data }) => setUser(data?.session));
      db.auth.onAuthStateChange((_event, session) => setUser(session));
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize);
  else initialize();
})();
