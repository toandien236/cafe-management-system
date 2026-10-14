-- Thêm bảng quản lý nhân viên mà không ảnh hưởng dữ liệu hiện có.
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL CHECK (length(trim(name)) > 0),
    email VARCHAR(255),
    phone VARCHAR(50),
    position VARCHAR(120) NOT NULL CHECK (length(trim(position)) > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employees_name ON public.employees(name);
CREATE INDEX IF NOT EXISTS idx_employees_status ON public.employees(status);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;

DROP POLICY IF EXISTS authenticated_employees_all ON public.employees;
CREATE POLICY authenticated_employees_all
    ON public.employees
    FOR ALL
    TO authenticated
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() IS NOT NULL);
