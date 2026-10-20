/**
 * ============================================================
 * MOCHA & MISO CAFE — SEED INVENTORY (46 NGUYÊN LIỆU MENU)
 * Nạp đầy đủ nguyên liệu theo danh sách 15 món ăn & đồ uống
 * Chạy lệnh: node scripts/seed-inventory.js
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

// Danh sách 46 nguyên liệu chuẩn (đã gộp Mascarpone trùng lặp)
const INGREDIENTS = [
  { name: 'Hạt cà phê Coorg', quantity: 25, unit: 'kg', price: 180000, min_stock: 5, category: 'Cà phê' },
  { name: 'Cà phê Ethiopia Yirgacheffe', quantity: 8, unit: 'kg', price: 320000, min_stock: 2, category: 'Cà phê' },
  { name: 'Bột matcha Uji', quantity: 5, unit: 'kg', price: 450000, min_stock: 1, category: 'Trà & Bột' },
  { name: 'Sữa tươi Nilgiri', quantity: 30, unit: 'lít', price: 35000, min_stock: 8, category: 'Sữa & Kem' },
  { name: 'Sữa yến mạch', quantity: 20, unit: 'lít', price: 55000, min_stock: 5, category: 'Sữa & Kem' },
  { name: 'Kem tươi whipping', quantity: 12, unit: 'lít', price: 95000, min_stock: 3, category: 'Sữa & Kem' },
  // Gộp "Kem mascarpone" (5 kg) + "Phô mai mascarpone bổ sung" (3 kg) => 8 kg
  { name: 'Kem mascarpone', quantity: 8, unit: 'kg', price: 220000, min_stock: 2, category: 'Bơ & Phô mai' },
  { name: 'Bơ lạt', quantity: 15, unit: 'kg', price: 220000, min_stock: 3, category: 'Bơ & Phô mai' },
  { name: 'Bơ quả Hass', quantity: 10, unit: 'kg', price: 90000, min_stock: 2, category: 'Rau củ & Trái cây' },
  { name: 'Bột mì', quantity: 30, unit: 'kg', price: 28000, min_stock: 8, category: 'Nguyên liệu bánh & Mì' },
  { name: 'Trứng gà', quantity: 300, unit: 'quả', price: 3000, min_stock: 60, category: 'Gia vị & Khác' },
  { name: 'Đường cát trắng', quantity: 20, unit: 'kg', price: 22000, min_stock: 5, category: 'Gia vị & Khác' },
  { name: 'Bột cacao nguyên chất', quantity: 5, unit: 'kg', price: 160000, min_stock: 1, category: 'Trà & Bột' },
  { name: 'Si-rô cacao đen', quantity: 8, unit: 'chai', price: 85000, min_stock: 2, category: 'Topping & Syrup' },
  { name: 'Si-rô lá phong', quantity: 5, unit: 'chai', price: 180000, min_stock: 1, category: 'Topping & Syrup' },
  { name: 'Mứt quả mọng', quantity: 6, unit: 'kg', price: 120000, min_stock: 2, category: 'Topping & Syrup' },
  { name: 'Quả mọng tươi', quantity: 5, unit: 'kg', price: 180000, min_stock: 1, category: 'Rau củ & Trái cây' },
  { name: 'Bột hạnh nhân', quantity: 4, unit: 'kg', price: 250000, min_stock: 1, category: 'Nguyên liệu bánh & Mì' },
  { name: 'Phô mai cream cheese', quantity: 8, unit: 'kg', price: 180000, min_stock: 2, category: 'Bơ & Phô mai' },
  { name: 'Bánh croissant', quantity: 40, unit: 'cái', price: 12000, min_stock: 10, category: 'Nguyên liệu bánh & Mì' },
  { name: 'Bánh brioche', quantity: 40, unit: 'cái', price: 12000, min_stock: 10, category: 'Nguyên liệu bánh & Mì' },
  { name: 'Bánh sourdough', quantity: 20, unit: 'ổ', price: 35000, min_stock: 5, category: 'Nguyên liệu bánh & Mì' },
  { name: 'Bánh mì sữa', quantity: 30, unit: 'cái', price: 8000, min_stock: 8, category: 'Nguyên liệu bánh & Mì' },
  { name: 'Mì linguine', quantity: 10, unit: 'kg', price: 75000, min_stock: 2, category: 'Nguyên liệu bánh & Mì' },
  { name: 'Đùi gà', quantity: 10, unit: 'kg', price: 95000, min_stock: 2, category: 'Hải sản & Thịt' },
  { name: 'Tôm sú', quantity: 5, unit: 'kg', price: 280000, min_stock: 1, category: 'Hải sản & Thịt' },
  { name: 'Vẹm tươi', quantity: 5, unit: 'kg', price: 120000, min_stock: 1, category: 'Hải sản & Thịt' },
  { name: 'Nghêu', quantity: 5, unit: 'kg', price: 70000, min_stock: 1, category: 'Hải sản & Thịt' },
  { name: 'Sò điệp', quantity: 3, unit: 'kg', price: 350000, min_stock: 1, category: 'Hải sản & Thịt' },
  { name: 'Bắp cải', quantity: 8, unit: 'kg', price: 25000, min_stock: 2, category: 'Rau củ & Trái cây' },
  { name: 'Cà chua', quantity: 5, unit: 'kg', price: 35000, min_stock: 1, category: 'Rau củ & Trái cây' },
  { name: 'Trứng hữu cơ', quantity: 100, unit: 'quả', price: 5000, min_stock: 20, category: 'Gia vị & Khác' },
  { name: 'Nấm truffle đen', quantity: 1, unit: 'kg', price: 1200000, min_stock: 0.2, category: 'Gia vị & Khác' },
  { name: 'Hồ trăn (pistachio)', quantity: 3, unit: 'kg', price: 550000, min_stock: 0.5, category: 'Topping & Syrup' },
  { name: 'Bạch đậu khấu', quantity: 1, unit: 'kg', price: 350000, min_stock: 0.2, category: 'Gia vị & Khác' },
  { name: 'Nước hoa hồng thực phẩm', quantity: 5, unit: 'chai', price: 80000, min_stock: 1, category: 'Topping & Syrup' },
  { name: 'Cam tươi', quantity: 5, unit: 'kg', price: 40000, min_stock: 1, category: 'Rau củ & Trái cây' },
  { name: 'Sốt tonkatsu', quantity: 5, unit: 'chai', price: 65000, min_stock: 1, category: 'Gia vị & Khác' },
  { name: 'Mayonnaise Nhật', quantity: 5, unit: 'chai', price: 75000, min_stock: 1, category: 'Gia vị & Khác' },
  { name: 'Dầu ô liu', quantity: 5, unit: 'lít', price: 160000, min_stock: 1, category: 'Gia vị & Khác' },
  { name: 'Nghệ tây', quantity: 100, unit: 'g', price: 250000, min_stock: 20, category: 'Gia vị & Khác' },
  { name: 'Vang trắng nấu ăn', quantity: 5, unit: 'chai', price: 180000, min_stock: 1, category: 'Gia vị & Khác' },
  { name: 'Muối', quantity: 5, unit: 'kg', price: 15000, min_stock: 1, category: 'Gia vị & Khác' },
  { name: 'Bột chiên xù panko', quantity: 5, unit: 'kg', price: 65000, min_stock: 1, category: 'Nguyên liệu bánh & Mì' },
  { name: 'Lá vàng thực phẩm', quantity: 10, unit: 'lá', price: 25000, min_stock: 2, category: 'Topping & Syrup' },
  { name: 'Kem vani', quantity: 5, unit: 'lít', price: 120000, min_stock: 1, category: 'Sữa & Kem' }
];

async function seedInventory() {
  console.log('═════════════════════════════════════════════════════════');
  console.log('  MOCHA & MISO CAFE — NẠP NGUYÊN LIỆU KHO (46 NGUYÊN LIỆU)');
  console.log('═════════════════════════════════════════════════════════');
  console.log(`  Supabase URL: ${SUPABASE_URL}\n`);

  // 1. Lấy danh sách hiện tại
  const existingRes = await apiRequest('GET', '/inventory?select=*');
  const existing = Array.isArray(existingRes.body) ? existingRes.body : [];
  console.log(`📦 Số nguyên liệu hiện có trong kho: ${existing.length}`);

  const existingMap = new Map();
  existing.forEach(item => {
    existingMap.set(item.name.toLowerCase().trim(), item);
  });

  let insertedCount = 0;
  let updatedCount = 0;
  let errorCount = 0;

  for (const item of INGREDIENTS) {
    const key = item.name.toLowerCase().trim();
    const found = existingMap.get(key);

    if (found) {
      // Cập nhật nguyên liệu đã có
      const updateRes = await apiRequest('PATCH', `/inventory?id=eq.${found.id}`, {
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        price: item.price,
        min_stock: item.min_stock,
        updated_at: new Date().toISOString()
      });
      if (updateRes.status >= 200 && updateRes.status < 300) {
        updatedCount++;
        console.log(`  🔄 Cập nhật: ${item.name} (${item.quantity} ${item.unit})`);
      } else {
        errorCount++;
        console.warn(`  ⚠️ Lỗi cập nhật ${item.name}:`, updateRes.body);
      }
    } else {
      // Thêm mới
      const insertRes = await apiRequest('POST', '/inventory', item);
      if (insertRes.status >= 200 && insertRes.status < 300) {
        insertedCount++;
        console.log(`  ✅ Thêm mới: ${item.name} (${item.quantity} ${item.unit} - ${item.price.toLocaleString('vi-VN')} VND)`);
      } else {
        errorCount++;
        console.warn(`  ⚠️ Lỗi thêm mới ${item.name}:`, insertRes.body);
      }
    }
  }

  // Tính tổng giá trị kho
  const finalRes = await apiRequest('GET', '/inventory?select=*');
  const finalItems = Array.isArray(finalRes.body) ? finalRes.body : [];
  const totalValue = finalItems.reduce((acc, cur) => acc + (Number(cur.quantity) || 0) * (Number(cur.price) || 0), 0);

  console.log('\n═════════════════════════════════════════════════════════');
  console.log('  🎉 HOÀN THÀNH NẠP NGUYÊN LIỆU KHO!');
  console.log('═════════════════════════════════════════════════════════');
  console.log(`  ➕ Thêm mới: ${insertedCount}`);
  console.log(`  🔄 Cập nhật: ${updatedCount}`);
  console.log(`  ❌ Lỗi: ${errorCount}`);
  console.log(`  📦 Tổng số loại nguyên liệu trong kho: ${finalItems.length}`);
  console.log(`  💰 Tổng giá trị kho: ${totalValue.toLocaleString('vi-VN')} VND\n`);
}

seedInventory().catch(console.error);
