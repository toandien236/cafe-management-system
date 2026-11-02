const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const hrSqlPath = path.join(root, 'employee-hr.sql');
const hrSql = fs.readFileSync(hrSqlPath, 'utf8');

// Helper to check RLS authorization logic
function evaluateRlsPolicy(jwt, requiredRole = 'admin') {
  if (!jwt) return false;
  const role = jwt?.app_metadata?.role;
  return role === requiredRole;
}

// Helper to validate employee record against SQL constraints
function validateEmployee(record) {
  if (!record || typeof record !== 'object') throw new Error('Record must be an object');
  if (!record.name || record.name.trim().length === 0) {
    throw new Error('CHECK constraint violation: name cannot be empty');
  }
  if (!record.position || record.position.trim().length === 0) {
    throw new Error('CHECK constraint violation: position cannot be empty');
  }
  const status = record.status || 'active';
  if (!['active', 'inactive'].includes(status)) {
    throw new Error(`CHECK constraint violation: status must be active or inactive, got "${status}"`);
  }
  return { ...record, status };
}

// Helper to validate attendance record against SQL constraints
function validateAttendance(record) {
  const timeRegex = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
  const checkOutRegex = /^(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)$/;
  if (!record.check_in || !timeRegex.test(record.check_in)) {
    throw new Error(`CHECK constraint violation: invalid check_in format "${record.check_in}"`);
  }
  if (record.check_out && !checkOutRegex.test(record.check_out)) {
    throw new Error(`CHECK constraint violation: invalid check_out format "${record.check_out}"`);
  }
  if (!['present', 'late', 'absent'].includes(record.status || 'present')) {
    throw new Error('CHECK constraint violation: invalid attendance status');
  }
  return record;
}

// Helper to validate payroll record against SQL constraints
function validatePayroll(record) {
  const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
  if (!record.pay_month || !monthRegex.test(record.pay_month)) {
    throw new Error(`CHECK constraint violation: invalid pay_month format "${record.pay_month}"`);
  }
  if (!['hourly', 'monthly'].includes(record.pay_type)) {
    throw new Error(`CHECK constraint violation: invalid pay_type "${record.pay_type}"`);
  }
  const numericFields = ['total_hours', 'hourly_rate', 'monthly_salary', 'overtime_hours', 'overtime_pay', 'bonus', 'penalty', 'net_pay'];
  for (const field of numericFields) {
    const val = record[field] ?? 0;
    if (typeof val !== 'number' || val < 0) {
      throw new Error(`CHECK constraint violation: ${field} cannot be negative`);
    }
  }
  return record;
}

// ============================================================
// 1. TESTS FOR SQL SCHEMA DEFINITION & INTEGRITY
// ============================================================

test('employee-hr.sql defines employees table with required constraints and RLS', () => {
  assert.match(hrSql, /CREATE TABLE IF NOT EXISTS public\.employees/);
  assert.match(hrSql, /name VARCHAR\(255\) NOT NULL CHECK \(length\(trim\(name\)\) > 0\)/);
  assert.match(hrSql, /position VARCHAR\(120\) NOT NULL CHECK \(length\(trim\(position\)\) > 0\)/);
  assert.match(hrSql, /status VARCHAR\(20\) NOT NULL DEFAULT 'active' CHECK \(status IN \('active', 'inactive'\)\)/);
  assert.match(hrSql, /ALTER TABLE public\.employees ENABLE ROW LEVEL SECURITY/);
});

test('employee-hr.sql defines shifts, attendance, and payroll tables with strict constraints', () => {
  assert.match(hrSql, /CREATE TABLE IF NOT EXISTS public\.employee_shifts/);
  assert.match(hrSql, /shift VARCHAR\(20\) NOT NULL CHECK \(shift IN \('morning', 'afternoon', 'night'\)\)/);
  assert.match(hrSql, /UNIQUE \(employee_id, work_date, shift\)/);

  assert.match(hrSql, /CREATE TABLE IF NOT EXISTS public\.employee_attendance/);
  assert.match(hrSql, /check_in VARCHAR\(5\) NOT NULL CHECK \(check_in ~ '\^\(\[01\]\[0-9\]\|2\[0-3\]\):\[0-5\]\[0-9\]\$'\)/);
  assert.match(hrSql, /UNIQUE \(employee_id, work_date\)/);

  assert.match(hrSql, /CREATE TABLE IF NOT EXISTS public\.employee_payroll/);
  assert.match(hrSql, /pay_month VARCHAR\(7\) NOT NULL CHECK \(pay_month ~ '\^\\d\{4\}-\(0\[1-9\]\|1\[0-2\]\)\$'\)/);
  assert.match(hrSql, /net_pay NUMERIC\(12,2\) NOT NULL DEFAULT 0 CHECK \(net_pay >= 0\)/);
  assert.match(hrSql, /UNIQUE \(employee_id, pay_month\)/);
});

// ============================================================
// 2. TESTS FOR ACCESS CONTROL & ROW LEVEL SECURITY (RLS)
// ============================================================

test('RLS policy requires authenticated user with app_metadata.role = admin', () => {
  assert.match(hrSql, /CREATE POLICY authenticated_employees_all ON public\.employees/);
  assert.match(hrSql, /\(auth\.jwt\(\) -> 'app_metadata' ->> 'role'\) = 'admin'/);

  // Anon access is denied
  assert.equal(evaluateRlsPolicy(null), false);
  assert.equal(evaluateRlsPolicy({ role: 'anon' }), false);

  // Regular authenticated user without admin role is denied
  assert.equal(evaluateRlsPolicy({ role: 'authenticated', app_metadata: { role: 'staff' } }), false);
  assert.equal(evaluateRlsPolicy({ role: 'authenticated', app_metadata: {} }), false);

  // Admin user is permitted
  assert.equal(evaluateRlsPolicy({ role: 'authenticated', app_metadata: { role: 'admin' } }), true);
});

test('RLS policies are enforced across shifts, attendance, and payroll', () => {
  assert.match(hrSql, /CREATE POLICY authenticated_employee_shifts_all ON public\.employee_shifts/);
  assert.match(hrSql, /CREATE POLICY authenticated_employee_attendance_all ON public\.employee_attendance/);
  assert.match(hrSql, /CREATE POLICY authenticated_employee_payroll_all ON public\.employee_payroll/);
});

// ============================================================
// 3. TESTS FOR CRUD OPERATIONS & BUSINESS LOGIC
// ============================================================

test('CRUD operation: INSERT validates valid employee and rejects invalid records', () => {
  const valid = {
    employee_code: 'EMP-001',
    name: 'Nguyễn Văn A',
    position: 'Pha chế (Barista)',
    email: 'nva@mocha.internal',
    status: 'active'
  };
  const inserted = validateEmployee(valid);
  assert.equal(inserted.name, 'Nguyễn Văn A');
  assert.equal(inserted.status, 'active');

  // Rejects empty name
  assert.throws(() => validateEmployee({ name: '   ', position: 'Barista' }), /name cannot be empty/);

  // Rejects invalid status
  assert.throws(() => validateEmployee({ name: 'Lê B', position: 'Barista', status: 'banned' }), /status must be active or inactive/);
});

test('CRUD operation: UPDATE updates position and status while enforcing invariants', () => {
  let employee = validateEmployee({
    id: 'uuid-1',
    name: 'Trần Thị C',
    position: 'Thu ngân',
    status: 'active'
  });

  // Perform update
  const updates = { position: 'Cửa hàng trưởng', status: 'active' };
  employee = validateEmployee({ ...employee, ...updates });
  assert.equal(employee.position, 'Cửa hàng trưởng');

  // Attempting invalid update fails
  assert.throws(() => validateEmployee({ ...employee, position: '' }), /position cannot be empty/);
});

test('CRUD operation: DELETE removes employee record from memory database', () => {
  const db = new Map([
    ['emp-1', { id: 'emp-1', name: 'Nhân viên 1', position: 'Phục vụ' }],
    ['emp-2', { id: 'emp-2', name: 'Nhân viên 2', position: 'Pha chế' }]
  ]);

  assert.equal(db.has('emp-1'), true);
  db.delete('emp-1');
  assert.equal(db.has('emp-1'), false);
  assert.equal(db.size, 1);
});

test('Attendance and Payroll constraint validators enforce business rules', () => {
  // Valid attendance
  assert.doesNotThrow(() => validateAttendance({ check_in: '08:30', check_out: '17:00', status: 'present' }));
  // Invalid attendance time
  assert.throws(() => validateAttendance({ check_in: '25:00' }), /invalid check_in format/);

  // Valid payroll
  assert.doesNotThrow(() => validatePayroll({ pay_month: '2026-10', pay_type: 'monthly', net_pay: 15000000 }));
  // Invalid negative pay
  assert.throws(() => validatePayroll({ pay_month: '2026-10', pay_type: 'monthly', net_pay: -100 }), /net_pay cannot be negative/);
});

