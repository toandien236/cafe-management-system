-- ============================================================
-- MOCHA & MISO CAFE — SEED 46 NGUYÊN LIỆU CHO QUẢN LÝ KHO (SQL)
-- Khởi tạo đầy đủ 46 nguyên liệu từ thực đơn 15 món của quán.
-- Chạy script này trong Supabase SQL Editor.
-- ============================================================

WITH ingredients (name, category, quantity, unit, min_stock, price, supplier) AS (
    VALUES
        ('Hạt cà phê Coorg', 'Cà phê', 25.000, 'kg', 5.000, 180000, 'Coorg Estate'),
        ('Cà phê Ethiopia Yirgacheffe', 'Cà phê', 8.000, 'kg', 2.000, 320000, 'Yirgacheffe Union'),
        ('Bột matcha Uji', 'Trà & Bột', 5.000, 'kg', 1.000, 450000, 'Uji Kyoto Farm'),
        ('Sữa tươi Nilgiri', 'Sữa & Kem', 30.000, 'lít', 8.000, 35000, 'Nilgiri Dairy'),
        ('Sữa yến mạch', 'Sữa & Kem', 20.000, 'lít', 5.000, 55000, 'Oatly Viet'),
        ('Kem tươi whipping', 'Sữa & Kem', 12.000, 'lít', 3.000, 95000, 'Anchor Dairy'),
        -- Gộp "Kem mascarpone" (5 kg) + "Phô mai mascarpone bổ sung" (3 kg) => 8 kg
        ('Kem mascarpone', 'Bơ & Phô mai', 8.000, 'kg', 2.000, 220000, 'Tatua Dairy'),
        ('Bơ lạt', 'Bơ & Phô mai', 15.000, 'kg', 3.000, 220000, 'Anchor Dairy'),
        ('Bơ quả Hass', 'Rau củ & Trái cây', 10.000, 'kg', 2.000, 90000, 'Da Lat Farm'),
        ('Bột mì', 'Nguyên liệu bánh & Mì', 30.000, 'kg', 8.000, 28000, 'Baker Choice'),
        ('Trứng gà', 'Gia vị & Khác', 300.000, 'quả', 60.000, 3000, 'Ba Huân'),
        ('Đường cát trắng', 'Gia vị & Khác', 20.000, 'kg', 5.000, 22000, 'Biên Hòa'),
        ('Bột cacao nguyên chất', 'Trà & Bột', 5.000, 'kg', 1.000, 160000, 'Barry Callebaut'),
        ('Si-rô cacao đen', 'Topping & Syrup', 8.000, 'chai', 2.000, 85000, 'Monin'),
        ('Si-rô lá phong', 'Topping & Syrup', 5.000, 'chai', 1.000, 180000, 'Maple Joe'),
        ('Mứt quả mọng', 'Topping & Syrup', 6.000, 'kg', 2.000, 120000, 'Andros'),
        ('Quả mọng tươi', 'Rau củ & Trái cây', 5.000, 'kg', 1.000, 180000, 'Da Lat Fresh'),
        ('Bột hạnh nhân', 'Nguyên liệu bánh & Mì', 4.000, 'kg', 1.000, 250000, 'Blue Diamond'),
        ('Phô mai cream cheese', 'Bơ & Phô mai', 8.000, 'kg', 2.000, 180000, 'Philadelphia'),
        ('Bánh croissant', 'Nguyên liệu bánh & Mì', 40.000, 'cái', 10.000, 12000, 'La Brioche Bakery'),
        ('Bánh brioche', 'Nguyên liệu bánh & Mì', 40.000, 'cái', 10.000, 12000, 'La Brioche Bakery'),
        ('Bánh sourdough', 'Nguyên liệu bánh & Mì', 20.000, 'ổ', 5.000, 35000, 'Craft Bakery'),
        ('Bánh mì sữa', 'Nguyên liệu bánh & Mì', 30.000, 'cái', 8.000, 8000, 'ABC Bakery'),
        ('Mì linguine', 'Nguyên liệu bánh & Mì', 10.000, 'kg', 2.000, 75000, 'Barilla'),
        ('Đùi gà', 'Hải sản & Thịt', 10.000, 'kg', 2.000, 95000, 'CP Foods'),
        ('Tôm sú', 'Hải sản & Thịt', 5.000, 'kg', 1.000, 280000, 'Hải sản Sạch Cà Mau'),
        ('Vẹm tươi', 'Hải sản & Thịt', 5.000, 'kg', 1.000, 120000, 'Hải sản Nha Trang'),
        ('Nghêu', 'Hải sản & Thịt', 5.000, 'kg', 1.000, 70000, 'Hải sản Bến Tre'),
        ('Sò điệp', 'Hải sản & Thịt', 3.000, 'kg', 1.000, 350000, 'Hải sản Phan Thiết'),
        ('Bắp cải', 'Rau củ & Trái cây', 8.000, 'kg', 2.000, 25000, 'Da Lat GAP'),
        ('Cà chua', 'Rau củ & Trái cây', 5.000, 'kg', 1.000, 35000, 'Da Lat GAP'),
        ('Trứng hữu cơ', 'Gia vị & Khác', 100.000, 'quả', 20.000, 5000, 'SanHa Farm'),
        ('Nấm truffle đen', 'Gia vị & Khác', 1.000, 'kg', 0.200, 1200000, 'Savini Tartufi'),
        ('Hồ trăn (pistachio)', 'Topping & Syrup', 3.000, 'kg', 0.500, 550000, 'Wonderful Pistachios'),
        ('Bạch đậu khấu', 'Gia vị & Khác', 1.000, 'kg', 0.200, 350000, 'Gia vị Việt'),
        ('Nước hoa hồng thực phẩm', 'Topping & Syrup', 5.000, 'chai', 1.000, 80000, 'Cortas'),
        ('Cam tươi', 'Rau củ & Trái cây', 5.000, 'kg', 1.000, 40000, 'Nông sản Miền Tây'),
        ('Sốt tonkatsu', 'Gia vị & Khác', 5.000, 'chai', 1.000, 65000, 'Bull-Dog'),
        ('Mayonnaise Nhật', 'Gia vị & Khác', 5.000, 'chai', 1.000, 75000, 'Kewpie'),
        ('Dầu ô liu', 'Gia vị & Khác', 5.000, 'lít', 1.000, 160000, 'Borges'),
        ('Nghệ tây', 'Gia vị & Khác', 100.000, 'g', 20.000, 250000, 'Bahraman Saffron'),
        ('Vang trắng nấu ăn', 'Gia vị & Khác', 5.000, 'chai', 1.000, 180000, 'Chateau Cooking'),
        ('Muối', 'Gia vị & Khác', 5.000, 'kg', 1.000, 15000, 'Muối Bạc Liêu'),
        ('Bột chiên xù panko', 'Nguyên liệu bánh & Mì', 5.000, 'kg', 1.000, 65000, 'Vĩnh Thuận'),
        ('Lá vàng thực phẩm', 'Topping & Syrup', 10.000, 'lá', 2.000, 25000, 'Gold Leaf Gourmet'),
        ('Kem vani', 'Sữa & Kem', 5.000, 'lít', 1.000, 120000, 'New Zealand Ice Cream')
)
INSERT INTO public.inventory (name, category, quantity, unit, min_stock, price, supplier)
SELECT 
    ingredients.name,
    ingredients.category,
    ingredients.quantity,
    ingredients.unit,
    ingredients.min_stock,
    ingredients.price,
    ingredients.supplier
FROM ingredients
WHERE NOT EXISTS (
    SELECT 1
    FROM public.inventory existing
    WHERE lower(trim(existing.name)) = lower(trim(ingredients.name))
);
