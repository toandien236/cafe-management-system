-- ============================================================
-- MOCHA & MISO CAFE — DATABASE SEED DATA (SQL)
-- Dữ liệu mẫu hoàn chỉnh cho các bảng:
-- 1. menu_items (15 món thực đơn)
-- 2. inventory (15 nguyên vật liệu kho)
-- 3. stock_imports (Phiếu nhập kho gần đây)
-- 4. stock_exports (Phiếu xuất kho pha chế)
-- 5. reservations (Đơn đặt bàn mẫu với các trạng thái)
-- 6. orders (Đơn gọi món tại bàn mẫu với các trạng thái)
-- ============================================================

-- 1. SEED MENU ITEMS
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
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    price = EXCLUDED.price,
    description = EXCLUDED.description,
    image = EXCLUDED.image;

-- 2. SEED INVENTORY (Kho nguyên vật liệu)
INSERT INTO public.inventory (id, name, category, quantity, unit, min_stock, price) VALUES
('11111111-1111-1111-1111-111111111101', 'Hạt Cà phê Arabica Cầu Đất',   'Cà phê',       18.500, 'kg',   5.000, 280000),
('11111111-1111-1111-1111-111111111102', 'Hạt Cà phê Robusta Buôn Ma Thuột','Cà phê',     25.000, 'kg',   8.000, 160000),
('11111111-1111-1111-1111-111111111103', 'Sữa tươi tiệt trùng Barista',    'Sữa & Kem',    42.000, 'lít', 15.000,  34000),
('11111111-1111-1111-1111-111111111104', 'Sữa đặc Ông Thọ',               'Sữa & Kem',    30.000, 'lon', 10.000,  26000),
('11111111-1111-1111-1111-111111111105', 'Bột Matcha Uji Kyoto',          'Trà & Bột',     4.200, 'kg',   1.500, 850000),
('11111111-1111-1111-1111-111111111106', 'Bột Cacao nguyên chất Dark',    'Trà & Bột',     6.800, 'kg',   2.000, 220000),
('11111111-1111-1111-1111-111111111107', 'Trà đen Ceylon Hoàng Gia',       'Trà & Bột',     3.500, 'kg',   1.000, 320000),
('11111111-1111-1111-1111-111111111108', 'Kem béo thực vật Richs',        'Sữa & Kem',    16.000, 'hộp',  5.000,  32000),
('11111111-1111-1111-1111-111111111109', 'Bơ lạt Anchor New Zealand',     'Bơ & Phô mai',  8.500, 'kg',   3.000, 210000),
('11111111-1111-1111-1111-111111111110', 'Phô mai Mascarpone Tatua',       'Bơ & Phô mai',  5.000, 'hộp',  2.000, 145000),
('11111111-1111-1111-1111-111111111111', 'Syrup Vanilla Monin',            'Syrup & Topping',6.000,'chai', 2.000, 240000),
('11111111-1111-1111-1111-111111111112', 'Syrup Caramel Monin',          'Syrup & Topping',4.000,'chai', 2.000, 240000),
('11111111-1111-1111-1111-111111111113', 'Bột mì Bakers Choice số 11',    'Nguyên liệu bánh',35.000,'kg',10.000,  28000),
('11111111-1111-1111-1111-111111111114', 'Trứng gà tươi Ba Huân',         'Nguyên liệu bánh',85.000,'quả',30.000,  3500),
('11111111-1111-1111-1111-111111111115', 'Đường mía tự nhiên Biên Hòa',   'Khác',         40.000, 'kg',  10.000,  25000)
ON CONFLICT (id) DO NOTHING;

-- 3. SEED STOCK IMPORTS (Phiếu nhập kho)
INSERT INTO public.stock_imports (item_id, item_name, quantity, unit, cost_price, total_cost, supplier, note, created_at) VALUES
('11111111-1111-1111-1111-111111111101', 'Hạt Cà phê Arabica Cầu Đất', 20.000, 'kg', 280000, 5600000, 'Nông sản Cầu Đất Farm', 'Nhập hạt rang mộc đợt đầu tháng', NOW() - INTERVAL '5 days'),
('11111111-1111-1111-1111-111111111103', 'Sữa tươi tiệt trùng Barista',  50.000, 'lít', 34000, 1700000, 'Đại lý Vinamilk Professional', 'Thùng 1L date mới', NOW() - INTERVAL '3 days'),
('11111111-1111-1111-1111-111111111105', 'Bột Matcha Uji Kyoto',        5.000,  'kg', 850000, 4250000, 'Công ty XNK Trà Nhật Bản', 'Matcha vụ xuân loại 1', NOW() - INTERVAL '4 days'),
('11111111-1111-1111-1111-111111111109', 'Bơ lạt Anchor New Zealand',   10.000, 'kg', 210000, 2100000, 'Nhà phân phối Tân Nhất Hương', 'Bơ khối làm bánh croissant', NOW() - INTERVAL '2 days'),
('11111111-1111-1111-1111-111111111111', 'Syrup Vanilla Monin',          6.000,  'chai',240000, 1440000, 'Monin Vietnam Distributor', 'Chai thủy tinh 700ml', NOW() - INTERVAL '1 day');

-- 4. SEED STOCK EXPORTS (Phiếu xuất kho)
INSERT INTO public.stock_exports (item_id, item_name, quantity, unit, reason, note, created_at) VALUES
('11111111-1111-1111-1111-111111111101', 'Hạt Cà phê Arabica Cầu Đất', 1.500, 'kg', 'Xuất dùng quầy Bar', 'Pha chế ca sáng', NOW() - INTERVAL '2 days'),
('11111111-1111-1111-1111-111111111103', 'Sữa tươi tiệt trùng Barista',  8.000, 'lít','Xuất dùng quầy Bar', 'Pha latte và cappuccino', NOW() - INTERVAL '1 day'),
('11111111-1111-1111-1111-111111111105', 'Bột Matcha Uji Kyoto',        0.800, 'kg', 'Xuất dùng quầy Bar', 'Pha matcha latte', NOW() - INTERVAL '1 day'),
('11111111-1111-1111-1111-111111111109', 'Bơ lạt Anchor New Zealand',   1.500, 'kg', 'Xuất làm bánh',      'Nướng mẻ bánh Croissant sáng', NOW() - INTERVAL '6 hours');

-- 5. SEED RESERVATIONS (Đơn đặt bàn mẫu)
INSERT INTO public.reservations (reservation_id, name, email, phone, date, time, guests, notes, status, email_status, created_at) VALUES
('RES-829104', 'Nguyễn Hoàng Nam',   'hoangnam.nguyen@gmail.com', '0912345678', '2026-10-02', '14:30', 2, 'Bàn gần cửa sổ nhìn ra vườn cây, nhiều ánh sáng', 'confirmed', 'Sent', NOW() - INTERVAL '2 hours'),
('RES-619283', 'Trần Thị Mai Phương', 'maiphuong.tran@gmail.com',  '0987654321', '2026-10-02', '19:00', 4, 'Kỷ niệm ngày thành lập nhóm, cần góc yên tĩnh',  'pending',   'Pending', NOW() - INTERVAL '1 hour'),
('RES-440192', 'Lê Văn Khang',       'khangle.design@gmail.com',  '0903112233', '2026-10-03', '09:00', 3, 'Gặp đối tác trao đổi dự án',                      'pending',   'Pending', NOW() - INTERVAL '30 minutes'),
('RES-918273', 'Phạm Minh Thư',      'minhthu.pham@yahoo.com',    '0938445566', '2026-10-01', '16:00', 2, 'Hẹn trà chiều',                                    'confirmed', 'Sent', NOW() - INTERVAL '1 day'),
('RES-302918', 'Đỗ Quang Huy',       'quanghuy.do@outlook.com',   '0977889900', '2026-09-30', '11:00', 6, 'Họp gia đình cuối tuần',                           'cancelled', 'Sent', NOW() - INTERVAL '2 days')
ON CONFLICT (reservation_id) DO NOTHING;

-- 6. SEED ORDERS (Đơn gọi món tại bàn mẫu)
INSERT INTO public.orders (order_id, table_number, items, total, note, status, payment_status, paid_at, created_at) VALUES
('ORD-849201', '01', '[
    {"id": "cappuccino", "name": "Cappuccino mịn màng", "price": 45000, "quantity": 2},
    {"id": "croissant", "name": "Croissant bơ ngàn lớp", "price": 40000, "quantity": 1}
]'::jsonb, 130000, 'Ít đường, bánh hâm nóng giòn', 'new', 'unpaid', NULL, NOW() - INTERVAL '8 minutes'),

('ORD-739102', '03', '[
    {"id": "matcha", "name": "Matcha latte Uji", "price": 55000, "quantity": 1},
    {"id": "pancake", "name": "Pancake soufflé bông xốp", "price": 65000, "quantity": 1}
]'::jsonb, 120000, 'Matcha dùng sữa yến mạch', 'in_progress', 'unpaid', NULL, NOW() - INTERVAL '18 minutes'),

('ORD-628491', '05', '[
    {"id": "coldbrew", "name": "Cold brew ủ 18 giờ", "price": 50000, "quantity": 1},
    {"id": "brioche", "name": "Brioche gà hun khói", "price": 75000, "quantity": 1}
]'::jsonb, 125000, 'Không lấy ớt trong bánh', 'served', 'unpaid', NULL, NOW() - INTERVAL '35 minutes'),

('ORD-519284', '02', '[
    {"id": "espresso", "name": "Espresso hạt tuyển chọn", "price": 35000, "quantity": 1},
    {"id": "cheesecake", "name": "Cheesecake cháy kiểu Basque", "price": 55000, "quantity": 1}
]'::jsonb, 90000, '', 'completed', 'paid', NOW() - INTERVAL '50 minutes', NOW() - INTERVAL '1 hour')
ON CONFLICT (order_id) DO NOTHING;
