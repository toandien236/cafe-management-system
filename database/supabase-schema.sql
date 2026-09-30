-- ============================================================
-- MOCHA & MISO CAFE — SUPABASE SCHEMA (Full Setup)
-- Chạy toàn bộ script này trong Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- DROP existing tables để tránh xung đột khi chạy lại
-- ============================================================
DROP TABLE IF EXISTS public.stock_exports CASCADE;
DROP TABLE IF EXISTS public.stock_imports CASCADE;
DROP TABLE IF EXISTS public.inventory CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.reservations CASCADE;
DROP TABLE IF EXISTS public.menu_items CASCADE;

-- ============================================================
-- 1. RESERVATIONS (Đặt bàn online)
-- ============================================================
CREATE TABLE public.reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id VARCHAR(50) UNIQUE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    date VARCHAR(50) NOT NULL,
    time VARCHAR(50) NOT NULL,
    guests INTEGER NOT NULL DEFAULT 2 CHECK (guests >= 1 AND guests <= 50),
    notes TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
    email_status VARCHAR(50) NOT NULL DEFAULT 'Pending' CHECK (email_status IN ('Pending', 'Sent', 'Failed')),
    email_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. ORDERS (Đơn gọi món QR tại bàn)
-- ============================================================
CREATE TABLE public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id VARCHAR(50) NOT NULL UNIQUE,
    table_number VARCHAR(10) NOT NULL,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    total NUMERIC(12, 0) NOT NULL DEFAULT 0 CHECK (total >= 0),
    note TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'served', 'completed', 'cancelled')),
    payment_status VARCHAR(50) NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid')),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. INVENTORY (Kho nguyên vật liệu)
-- ============================================================
CREATE TABLE public.inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'Khác',
    quantity NUMERIC(12, 3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    unit VARCHAR(50) NOT NULL DEFAULT 'kg',
    min_stock NUMERIC(12, 3) NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
    price NUMERIC(12, 0) NOT NULL DEFAULT 0 CHECK (price >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. STOCK IMPORTS (Phiếu Nhập Kho)
-- ============================================================
CREATE TABLE public.stock_imports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID REFERENCES public.inventory(id) ON DELETE SET NULL,
    item_name VARCHAR(255) NOT NULL,
    quantity NUMERIC(12, 3) NOT NULL CHECK (quantity > 0),
    unit VARCHAR(50) NOT NULL,
    cost_price NUMERIC(12, 0) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
    total_cost NUMERIC(12, 0) NOT NULL DEFAULT 0 CHECK (total_cost >= 0),
    supplier VARCHAR(255),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 5. STOCK EXPORTS (Phiếu Xuất Kho)
-- ============================================================
CREATE TABLE public.stock_exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID REFERENCES public.inventory(id) ON DELETE SET NULL,
    item_name VARCHAR(255) NOT NULL,
    quantity NUMERIC(12, 3) NOT NULL CHECK (quantity > 0),
    unit VARCHAR(50) NOT NULL,
    reason VARCHAR(255),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 6. MENU ITEMS (Thực đơn — optional dynamic)
-- ============================================================
CREATE TABLE public.menu_items (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    price NUMERIC(12, 0) NOT NULL DEFAULT 0 CHECK (price >= 0),
    image TEXT,
    description TEXT,
    is_available BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_reservations_status ON public.reservations(status);
CREATE INDEX idx_reservations_created_at ON public.reservations(created_at DESC);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_table ON public.orders(table_number);
CREATE INDEX idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX idx_inventory_category ON public.inventory(category);

-- ============================================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reservations_updated_at
    BEFORE UPDATE ON public.reservations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_inventory_updated_at
    BEFORE UPDATE ON public.inventory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_menu_items_updated_at
    BEFORE UPDATE ON public.menu_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- GRANT PRIVILEGES (Bắt buộc để Supabase JS SDK hoạt động)
-- ============================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT ON public.reservations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reservations TO authenticated;

GRANT SELECT, INSERT ON public.orders TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory TO authenticated;

GRANT SELECT, INSERT ON public.stock_imports TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_imports TO authenticated;

GRANT SELECT, INSERT ON public.stock_exports TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_exports TO authenticated;

GRANT SELECT ON public.menu_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_items TO authenticated;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- RESERVATIONS RLS
CREATE POLICY "anon_can_insert_reservations"
    ON public.reservations FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_can_select_reservations"
    ON public.reservations FOR SELECT TO anon USING (true);

CREATE POLICY "auth_all_reservations"
    ON public.reservations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ORDERS RLS
CREATE POLICY "anon_can_insert_orders"
    ON public.orders FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_can_select_orders"
    ON public.orders FOR SELECT TO anon USING (true);

CREATE POLICY "auth_all_orders"
    ON public.orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- INVENTORY RLS
CREATE POLICY "anon_can_select_inventory"
    ON public.inventory FOR SELECT TO anon USING (true);

CREATE POLICY "anon_can_insert_inventory"
    ON public.inventory FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_can_update_inventory"
    ON public.inventory FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon_can_delete_inventory"
    ON public.inventory FOR DELETE TO anon USING (true);

CREATE POLICY "auth_all_inventory"
    ON public.inventory FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- STOCK IMPORTS RLS
CREATE POLICY "anon_can_select_stock_imports"
    ON public.stock_imports FOR SELECT TO anon USING (true);

CREATE POLICY "anon_can_insert_stock_imports"
    ON public.stock_imports FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "auth_all_stock_imports"
    ON public.stock_imports FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- STOCK EXPORTS RLS
CREATE POLICY "anon_can_select_stock_exports"
    ON public.stock_exports FOR SELECT TO anon USING (true);

CREATE POLICY "anon_can_insert_stock_exports"
    ON public.stock_exports FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "auth_all_stock_exports"
    ON public.stock_exports FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- MENU ITEMS RLS
CREATE POLICY "anon_can_select_menu_items"
    ON public.menu_items FOR SELECT TO anon USING (true);

CREATE POLICY "auth_all_menu_items"
    ON public.menu_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- SUPABASE REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_imports;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_exports;

-- ============================================================
-- SEED DATA — Dữ liệu mẫu thực đơn
-- ============================================================
INSERT INTO public.menu_items (id, name, category, price, image, description, is_available) VALUES
('espresso',       'Espresso hạt tuyển chọn',          'Cà phê',     35000, 'assets/menu_espresso.jpg',    'Hương anh đào đen, cacao và hậu vị caramel.',          true),
('cappuccino',     'Cappuccino mịn màng',               'Cà phê',     45000, 'assets/menu_cappuccino.jpg',  'Hai shot espresso, sữa béo ngậy và latte art.',        true),
('coldbrew',       'Cold brew ủ 18 giờ',                'Cà phê',     50000, 'assets/menu_coldbrew.jpg',    'Mượt mà, ngọt dịu tự nhiên cùng cacao đen.',           true),
('rose-coldbrew',  'Cold brew hoa hồng bạch đậu khấu', 'Cà phê',     55000, 'assets/menu_rosecoldbrew.png','Ethiopia Yirgacheffe, hoa hồng, bạch đậu khấu và cam.',true),
('matcha',         'Matcha latte Uji',                  'Đồ uống',    55000, 'assets/menu_matcha.jpg',      'Matcha Uji đánh cùng sữa yến mạch thơm lành.',         true),
('mocha',          'Mocha đá cacao đậm',                'Đồ uống',    55000, 'assets/menu_icedmocha.jpg',   'Espresso, cacao đen, sữa lạnh và kem tươi.',           true),
('croissant',      'Croissant bơ ngàn lớp',             'Đồ ăn',      40000, 'assets/menu_croissant.jpg',   'Croissant bơ kiểu Pháp, dùng nóng cùng mứt nhà làm.', true),
('pancake',        'Pancake soufflé bông xốp',          'Đồ ăn',      65000, 'assets/menu_pancakes.jpg',    'Quả mọng, mascarpone và si-rô lá phong.',              true),
('brioche',        'Brioche gà hun khói',               'Đồ ăn',      75000, 'assets/menu_sandwich.jpg',    'Gà hun khói, bơ quả, cà chua và aioli nấm truffle.',   true),
('avocado-toast',  'Sourdough bơ quả nấm truffle',      'Đồ ăn',      70000, 'assets/menu_avocadotoast.png','Bơ Hass, trứng chần, rau mầm và nấm truffle.',         true),
('katsu-sando',    'Sandwich gà katsu giòn',            'Đồ ăn',      80000, 'assets/menu_katsusando.png',  'Gà panko, bắp cải, tonkatsu và mayonnaise Nhật.',      true),
('linguine',       'Linguine hải sản miền biển',        'Đồ ăn',      95000, 'assets/matteophotopro2020-mussels-5342679_1920.jpg','Vẹm, tôm, nghêu và sò điệp cùng xốt kem nghệ tây.',true),
('cheesecake',     'Cheesecake cháy kiểu Basque',       'Tráng miệng',55000, 'assets/menu_cheesecake.jpg',  'Mặt bánh caramel, ruột mềm mượt và xốt quả mọng.',    true),
('matcha-opera',   'Bánh opera matcha lá vàng',         'Tráng miệng',60000, 'assets/menu_matchaopera.png', 'Hạnh nhân, kem bơ matcha Uji và ganache chocolate.',   true),
('raspberry-tart', 'Tart hồ trăn mâm xôi',             'Tráng miệng',60000, 'assets/menu_raspberrytart.png','Frangipane hồ trăn, mâm xôi tươi và kem vani.',       true)
ON CONFLICT (id) DO NOTHING;
