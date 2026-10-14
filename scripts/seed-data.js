/**
 * ============================================================
 * MOCHA & MISO CAFE — SEED DATA SCRIPT (Node.js)
 * Tự động nạp dữ liệu mẫu vào PostgreSQL thông qua Supabase REST API
 * Chạy lệnh: node scripts/seed-data.js
 * ============================================================
 */

const https = require('https');

const SUPABASE_URL = "https://aueihxecpcfufgwqhxdl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1ZWloeGVjcGNmdWZnd3FoeGRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3ODE1NjMsImV4cCI6MjEwNjM1NzU2M30.u0DGDU4yaKKcNsXP5iUnuyHtlarlTzMgvYHtouT-Ksg";

const BASE_API = `${SUPABASE_URL}/rest/v1`;

function apiRequest(method, endpoint, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_API}${endpoint}`);
    const data = body ? JSON.stringify(body) : null;

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    };

    const req = https.request(options, (res) => {
      let resData = '';
      res.on('data', chunk => resData += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(resData || '[]') });
        } catch {
          resolve({ status: res.statusCode, body: resData });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// 1. Dữ liệu mẫu Thực đơn
const MENU_ITEMS = [
  { id: 'espresso',       name: 'Espresso hạt tuyển chọn',          category: 'Cà phê',     price: 35000, image: 'assets/menu_espresso.jpg',    description: 'Hương anh đào đen, cacao và hậu vị caramel.',          is_available: true },
  { id: 'cappuccino',     name: 'Cappuccino mịn màng',               category: 'Cà phê',     price: 45000, image: 'assets/menu_cappuccino.jpg',  description: 'Hai shot espresso, sữa béo ngậy và latte art.',        is_available: true },
  { id: 'coldbrew',       name: 'Cold brew ủ 18 giờ',                category: 'Cà phê',     price: 50000, image: 'assets/menu_coldbrew.jpg',    description: 'Mượt mà, ngọt dịu tự nhiên cùng cacao đen.',           is_available: true },
  { id: 'rose-coldbrew',  name: 'Cold brew hoa hồng bạch đậu khấu', category: 'Cà phê',     price: 55000, image: 'assets/menu_rosecoldbrew.png',description: 'Ethiopia Yirgacheffe, hoa hồng, bạch đậu khấu và cam.',is_available: true },
  { id: 'matcha',         name: 'Matcha latte Uji',                  category: 'Đồ uống',    price: 55000, image: 'assets/menu_matcha.jpg',      description: 'Matcha Uji đánh cùng sữa yến mạch thơm lành.',         is_available: true },
  { id: 'mocha',          name: 'Mocha đá cacao đậm',                category: 'Đồ uống',    price: 55000, image: 'assets/menu_icedmocha.jpg',   description: 'Espresso, cacao đen, sữa lạnh và kem tươi.',           is_available: true },
  { id: 'croissant',      name: 'Croissant bơ ngàn lớp',             category: 'Đồ ăn',      40000: 40000, price: 40000, image: 'assets/menu_croissant.jpg',   description: 'Croissant bơ kiểu Pháp, dùng nóng cùng mứt nhà làm.', is_available: true },
  { id: 'pancake',        name: 'Pancake soufflé bông xốp',          category: 'Đồ ăn',      price: 65000, image: 'assets/menu_pancakes.jpg',    description: 'Quả mọng, mascarpone và si-rô lá phong.',              is_available: true },
  { id: 'brioche',        name: 'Brioche gà hun khói',               category: 'Đồ ăn',      price: 75000, image: 'assets/menu_sandwich.jpg',    description: 'Gà hun khói, bơ quả, cà chua và aioli nấm truffle.',   is_available: true },
  { id: 'avocado-toast',  name: 'Sourdough bơ quả nấm truffle',      category: 'Đồ ăn',      price: 70000, image: 'assets/menu_avocadotoast.png',description: 'Bơ Hass, trứng chần, rau mầm và nấm truffle.',         is_available: true },
  { id: 'katsu-sando',    'name': 'Sandwich gà katsu giòn',            category: 'Đồ ăn',      price: 80000, image: 'assets/menu_katsusando.png',  description: 'Gà panko, bắp cải, tonkatsu và mayonnaise Nhật.',      is_available: true },
  { id: 'linguine',       name: 'Linguine hải sản miền biển',        category: 'Đồ ăn',      price: 95000, image: 'assets/matteophotopro2020-mussels-5342679_1920.jpg', description: 'Vẹm, tôm, nghêu và sò điệp cùng xốt kem nghệ tây.', is_available: true },
  { id: 'cheesecake',     name: 'Cheesecake cháy kiểu Basque',       category: 'Tráng miệng',price: 55000, image: 'assets/menu_cheesecake.jpg',  description: 'Mặt bánh caramel, ruột mềm mượt và xốt quả mọng.',    is_available: true },
  { id: 'matcha-opera',   name: 'Bánh opera matcha lá vàng',         category: 'Tráng miệng',price: 60000, image: 'assets/menu_matchaopera.png', description: 'Hạnh nhân, kem bơ matcha Uji và ganache chocolate.',   is_available: true },
  { id: 'raspberry-tart', name: 'Tart hồ trăn mâm xôi',             category: 'Tráng miệng',price: 60000, image: 'assets/menu_raspberrytart.png',description: 'Frangipane hồ trăn, mâm xôi tươi và kem vani.',       is_available: true }
];

// 2. Dữ liệu mẫu Kho nguyên liệu
const INVENTORY_ITEMS = [
  { id: '11111111-1111-1111-1111-111111111101', name: 'Hạt Cà phê Arabica Cầu Đất',    category: 'Cà phê',          quantity: 18.5, unit: 'kg',   min_stock: 5.0,  price: 280000 },
  { id: '11111111-1111-1111-1111-111111111102', name: 'Hạt Cà phê Robusta Buôn Ma Thuột', category: 'Cà phê',       quantity: 25.0, unit: 'kg',   min_stock: 8.0,  price: 160000 },
  { id: '11111111-1111-1111-1111-111111111103', name: 'Sữa tươi tiệt trùng Barista',     category: 'Sữa & Kem',       quantity: 42.0, unit: 'lít',  min_stock: 15.0, price: 34000  },
  { id: '11111111-1111-1111-1111-111111111104', name: 'Sữa đặc Ông Thọ',                category: 'Sữa & Kem',       quantity: 30.0, unit: 'lon',  min_stock: 10.0, price: 26000  },
  { id: '11111111-1111-1111-1111-111111111105', name: 'Bột Matcha Uji Kyoto',           category: 'Trà & Bột',        quantity: 4.2,  unit: 'kg',   min_stock: 1.5,  price: 850000 },
  { id: '11111111-1111-1111-1111-111111111106', name: 'Bột Cacao nguyên chất Dark',     category: 'Trà & Bột',        quantity: 6.8,  unit: 'kg',   min_stock: 2.0,  price: 220000 },
  { id: '11111111-1111-1111-1111-111111111107', name: 'Trà đen Ceylon Hoàng Gia',        category: 'Trà & Bột',        quantity: 3.5,  unit: 'kg',   min_stock: 1.0,  price: 320000 },
  { id: '11111111-1111-1111-1111-111111111108', name: 'Kem béo thực vật Richs',         category: 'Sữa & Kem',       quantity: 16.0, unit: 'hộp',  min_stock: 5.0,  price: 32000  },
  { id: '11111111-1111-1111-1111-111111111109', name: 'Bơ lạt Anchor New Zealand',      category: 'Bơ & Phô mai',     quantity: 8.5,  unit: 'kg',   min_stock: 3.0,  price: 210000 },
  { id: '11111111-1111-1111-1111-111111111110', name: 'Phô mai Mascarpone Tatua',        category: 'Bơ & Phô mai',     quantity: 5.0,  unit: 'hộp',  min_stock: 2.0,  price: 145000 },
  { id: '11111111-1111-1111-1111-111111111111', name: 'Syrup Vanilla Monin',             category: 'Syrup & Topping',  quantity: 6.0,  unit: 'chai', min_stock: 2.0,  price: 240000 },
  { id: '11111111-1111-1111-1111-111111111112', name: 'Syrup Caramel Monin',           category: 'Syrup & Topping',  quantity: 4.0,  unit: 'chai', min_stock: 2.0,  price: 240000 },
  { id: '11111111-1111-1111-1111-111111111113', name: 'Bột mì Bakers Choice số 11',     category: 'Nguyên liệu bánh', quantity: 35.0, unit: 'kg',   min_stock: 10.0, price: 28000  },
  { id: '11111111-1111-1111-1111-111111111114', name: 'Trứng gà tươi Ba Huân',          category: 'Nguyên liệu bánh', quantity: 85.0, unit: 'quả',  min_stock: 30.0, price: 3500   },
  { id: '11111111-1111-1111-1111-111111111115', name: 'Đường mía tự nhiên Biên Hòa',    category: 'Khác',             quantity: 40.0, unit: 'kg',   min_stock: 10.0, price: 25000  }
];

// 3. Dữ liệu mẫu Phiếu nhập kho
const STOCK_IMPORTS = [
  { item_id: '11111111-1111-1111-1111-111111111101', item_name: 'Hạt Cà phê Arabica Cầu Đất', quantity: 20, unit: 'kg',   cost_price: 280000, total_cost: 5600000, supplier: 'Nông sản Cầu Đất Farm', note: 'Nhập hạt rang mộc đợt đầu tháng' },
  { item_id: '11111111-1111-1111-1111-111111111103', item_name: 'Sữa tươi tiệt trùng Barista',  quantity: 50, unit: 'lít',  cost_price: 34000,  total_cost: 1700000, supplier: 'Đại lý Vinamilk Professional', note: 'Thùng 1L date mới' },
  { item_id: '11111111-1111-1111-1111-111111111105', item_name: 'Bột Matcha Uji Kyoto',        quantity: 5,  unit: 'kg',   cost_price: 850000, total_cost: 4250000, supplier: 'Công ty XNK Trà Nhật Bản', note: 'Matcha vụ xuân loại 1' },
  { item_id: '11111111-1111-1111-1111-111111111109', item_name: 'Bơ lạt Anchor New Zealand',   quantity: 10, unit: 'kg',   cost_price: 210000, total_cost: 2100000, supplier: 'Nhà phân phối Tân Nhất Hương', note: 'Bơ khối làm bánh croissant' },
  { item_id: '11111111-1111-1111-1111-111111111111', item_name: 'Syrup Vanilla Monin',          quantity: 6,  unit: 'chai', cost_price: 240000, total_cost: 1440000, supplier: 'Monin Vietnam Distributor', note: 'Chai thủy tinh 700ml' }
];

// 4. Dữ liệu mẫu Phiếu xuất kho
const STOCK_EXPORTS = [
  { item_id: '11111111-1111-1111-1111-111111111101', item_name: 'Hạt Cà phê Arabica Cầu Đất', quantity: 1.5, unit: 'kg',   reason: 'Xuất dùng quầy Bar', note: 'Pha chế ca sáng' },
  { item_id: '11111111-1111-1111-1111-111111111103', item_name: 'Sữa tươi tiệt trùng Barista',  quantity: 8.0, unit: 'lít',  reason: 'Xuất dùng quầy Bar', note: 'Pha latte và cappuccino' },
  { item_id: '11111111-1111-1111-1111-111111111105', item_name: 'Bột Matcha Uji Kyoto',        quantity: 0.8, unit: 'kg',   reason: 'Xuất dùng quầy Bar', note: 'Pha matcha latte' },
  { item_id: '11111111-1111-1111-1111-111111111109', item_name: 'Bơ lạt Anchor New Zealand',   quantity: 1.5, unit: 'kg',   reason: 'Xuất làm bánh',      note: 'Nướng mẻ bánh Croissant sáng' }
];

// 5. Dữ liệu mẫu Đơn đặt bàn
const RESERVATIONS = [
  { reservation_id: 'RES-829104', name: 'Nguyễn Hoàng Nam',    email: 'hoangnam.nguyen@gmail.com', phone: '0912345678', date: '2026-10-02', time: '14:30', guests: 2, notes: 'Bàn gần cửa sổ nhìn ra vườn cây, nhiều ánh sáng', status: 'confirmed', email_status: 'Sent' },
  { reservation_id: 'RES-619283', name: 'Trần Thị Mai Phương',  email: 'maiphuong.tran@gmail.com',  phone: '0987654321', date: '2026-10-02', time: '19:00', guests: 4, notes: 'Kỷ niệm ngày thành lập nhóm, cần góc yên tĩnh',  status: 'pending',   email_status: 'Pending' },
  { reservation_id: 'RES-440192', name: 'Lê Văn Khang',        email: 'khangle.design@gmail.com',  phone: '0903112233', date: '2026-10-03', time: '09:00', guests: 3, notes: 'Gặp đối tác trao đổi dự án',                      status: 'pending',   email_status: 'Pending' },
  { reservation_id: 'RES-918273', name: 'Phạm Minh Thư',       email: 'minhthu.pham@yahoo.com',    phone: '0938445566', date: '2026-10-01', time: '16:00', guests: 2, notes: 'Hẹn trà chiều',                                    status: 'confirmed', email_status: 'Sent' },
  { reservation_id: 'RES-302918', name: 'Đỗ Quang Huy',        email: 'quanghuy.do@outlook.com',   phone: '0977889900', date: '2026-09-30', time: '11:00', guests: 6, notes: 'Họp gia đình cuối tuần',                           status: 'cancelled', email_status: 'Sent' }
];

// 6. Dữ liệu mẫu Đơn gọi món tại bàn
const ORDERS = [
  {
    order_id: 'ORD-849201',
    table_number: '01',
    items: [
      { id: 'cappuccino', name: 'Cappuccino mịn màng', price: 45000, quantity: 2 },
      { id: 'croissant', name: 'Croissant bơ ngàn lớp', price: 40000, quantity: 1 }
    ],
    total: 130000,
    note: 'Ít đường, bánh hâm nóng giòn',
    status: 'new',
    payment_status: 'unpaid'
  },
  {
    order_id: 'ORD-739102',
    table_number: '03',
    items: [
      { id: 'matcha', name: 'Matcha latte Uji', price: 55000, quantity: 1 },
      { id: 'pancake', name: 'Pancake soufflé bông xốp', price: 65000, quantity: 1 }
    ],
    total: 120000,
    note: 'Matcha dùng sữa yến mạch',
    status: 'in_progress',
    payment_status: 'unpaid'
  },
  {
    order_id: 'ORD-628491',
    table_number: '05',
    items: [
      { id: 'coldbrew', name: 'Cold brew ủ 18 giờ', price: 50000, quantity: 1 },
      { id: 'brioche', name: 'Brioche gà hun khói', price: 75000, quantity: 1 }
    ],
    total: 125000,
    note: 'Không lấy ớt trong bánh',
    status: 'served',
    payment_status: 'unpaid'
  },
  {
    order_id: 'ORD-519284',
    table_number: '02',
    items: [
      { id: 'espresso', name: 'Espresso hạt tuyển chọn', price: 35000, quantity: 1 },
      { id: 'cheesecake', name: 'Cheesecake cháy kiểu Basque', price: 55000, quantity: 1 }
    ],
    total: 90000,
    note: '',
    status: 'completed',
    payment_status: 'paid',
    paid_at: new Date().toISOString()
  }
];

async function seedTable(tableName, items, primaryKey = 'id') {
  console.log(`\n🌱 Đang seed bảng [${tableName}] (${items.length} bản ghi)...`);
  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of items) {
    try {
      const res = await apiRequest('POST', `/${tableName}`, item);
      if (res.status === 201) {
        success++;
      } else if (res.status === 409 || (res.body && res.body.code === '23505')) {
        skipped++;
      } else {
        // Log detailed error
        console.warn(`  ⚠️ Lỗi thêm vào ${tableName}: HTTP ${res.status} -`, res.body?.message || res.body);
        failed++;
      }
    } catch (e) {
      console.warn(`  ❌ Lỗi kết nối khi seed ${tableName}:`, e.message);
      failed++;
    }
  }

  console.log(`   ↳ Kết quả: ✅ ${success} mới, ⏭️ ${skipped} đã tồn tại, ❌ ${failed} lỗi`);
}

async function runSeed() {
  console.log('═════════════════════════════════════════════════════════');
  console.log('  MOCHA & MISO CAFE — BẮT ĐẦU SEED DỮ LIỆU MẪU');
  console.log('═════════════════════════════════════════════════════════');
  console.log(`  Supabase URL: ${SUPABASE_URL}\n`);

  await seedTable('inventory', INVENTORY_ITEMS);
  await seedTable('stock_imports', STOCK_IMPORTS);
  await seedTable('stock_exports', STOCK_EXPORTS);
  await seedTable('reservations', RESERVATIONS);
  await seedTable('orders', ORDERS);

  console.log('\n═════════════════════════════════════════════════════════');
  console.log('  🎉 HOÀN THÀNH SEED DỮ LIỆU CHO TOÀN BỘ HỆ THỐNG!');
  console.log('═════════════════════════════════════════════════════════');
  console.log('\nBạn có thể mở các trang để kiểm tra:');
  console.log('  🌐 Cổng Quản trị (Xem đơn bàn & Đặt bàn): http://localhost:5500/admin.html');
  console.log('  📦 Quản lý Kho (Xem 15 nguyên liệu & phiếu xuất/nhập): http://localhost:5500/inventory.html');
  console.log('  📱 Gọi món tại bàn: http://localhost:5500/order.html?table=01\n');
}

runSeed().catch(console.error);
