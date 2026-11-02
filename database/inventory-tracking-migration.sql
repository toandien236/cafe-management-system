-- Run this migration once against an existing Supabase database.
ALTER TABLE public.inventory
    ADD COLUMN IF NOT EXISTS supplier VARCHAR(255);

ALTER TABLE public.stock_imports
    ADD COLUMN IF NOT EXISTS batch_number VARCHAR(100),
    ADD COLUMN IF NOT EXISTS expiry_date DATE,
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
    ADD COLUMN IF NOT EXISTS actor_name VARCHAR(255);

ALTER TABLE public.stock_exports
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
    ADD COLUMN IF NOT EXISTS actor_name VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_stock_imports_expiry_date
    ON public.stock_imports (expiry_date)
    WHERE expiry_date IS NOT NULL;
