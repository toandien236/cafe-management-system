-- Apply this migration in the Supabase SQL Editor for the project before using HR operations.
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_code VARCHAR(30),
    name VARCHAR(255) NOT NULL CHECK (length(trim(name)) > 0),
    birth_date DATE,
    gender VARCHAR(20),
    email VARCHAR(255),
    phone VARCHAR(50),
    address VARCHAR(255),
    position VARCHAR(120) NOT NULL CHECK (length(trim(position)) > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.employees
    ADD COLUMN IF NOT EXISTS employee_code VARCHAR(30),
    ADD COLUMN IF NOT EXISTS birth_date DATE,
    ADD COLUMN IF NOT EXISTS gender VARCHAR(20),
    ADD COLUMN IF NOT EXISTS address VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS employees_employee_code_unique
    ON public.employees (employee_code)
    WHERE employee_code IS NOT NULL;

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS authenticated_employees_all ON public.employees;
CREATE POLICY authenticated_employees_all ON public.employees
    FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;

CREATE TABLE IF NOT EXISTS public.employee_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
    work_date DATE NOT NULL,
    shift VARCHAR(20) NOT NULL CHECK (shift IN ('morning', 'afternoon', 'night')),
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'absent')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (employee_id, work_date, shift)
);

CREATE TABLE IF NOT EXISTS public.employee_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
    work_date DATE NOT NULL,
    check_in VARCHAR(5) NOT NULL CHECK (check_in ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
    check_out VARCHAR(5) CHECK (check_out IS NULL OR check_out ~ '^(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)$'),
    status VARCHAR(20) NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'late', 'absent')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (employee_id, work_date)
);

CREATE TABLE IF NOT EXISTS public.employee_payroll (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
    pay_month VARCHAR(7) NOT NULL CHECK (pay_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
    pay_type VARCHAR(20) NOT NULL CHECK (pay_type IN ('hourly', 'monthly')),
    total_hours NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (total_hours >= 0),
    hourly_rate NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (hourly_rate >= 0),
    monthly_salary NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (monthly_salary >= 0),
    overtime_hours NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (overtime_hours >= 0),
    overtime_pay NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (overtime_pay >= 0),
    bonus NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (bonus >= 0),
    penalty NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (penalty >= 0),
    net_pay NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (net_pay >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (employee_id, pay_month)
);

CREATE INDEX IF NOT EXISTS employee_shifts_work_date_idx ON public.employee_shifts(work_date);
CREATE INDEX IF NOT EXISTS employee_attendance_work_date_idx ON public.employee_attendance(work_date);
CREATE INDEX IF NOT EXISTS employee_payroll_pay_month_idx ON public.employee_payroll(pay_month);

ALTER TABLE public.employee_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_payroll ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS authenticated_employee_shifts_all ON public.employee_shifts;
CREATE POLICY authenticated_employee_shifts_all ON public.employee_shifts
    FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS authenticated_employee_attendance_all ON public.employee_attendance;
CREATE POLICY authenticated_employee_attendance_all ON public.employee_attendance
    FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS authenticated_employee_payroll_all ON public.employee_payroll;
CREATE POLICY authenticated_employee_payroll_all ON public.employee_payroll
    FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_shifts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_attendance TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_payroll TO authenticated;
