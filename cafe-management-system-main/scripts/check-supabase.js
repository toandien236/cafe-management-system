/**
 * Supabase Health Check Script (Node.js)
 * Kiểm tra kết nối và hoạt động của Supabase + PostgreSQL
 */

const https = require('https');

const SUPABASE_URL = "https://aueihxecpcfufgwqhxdl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1ZWloeGVjcGNmdWZnd3FoeGRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3ODE1NjMsImV4cCI6MjEwNjM1NzU2M30.u0DGDU4yaKKcNsXP5iUnuyHtlarlTzMgvYHtouT-Ksg";

const BASE_API = `${SUPABASE_URL}/rest/v1`;
const HEADERS = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

let passed = 0;
let failed = 0;

function httpRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_API}${path}`);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: { ...HEADERS, 'Content-Length': body ? Buffer.byteLength(body) : 0 }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data || '[]') });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function pass(name) {
  console.log(`  ✅ ${name}`);
  passed++;
}

function fail(name, detail) {
  console.log(`  ❌ ${name}`);
  if (detail) console.log(`     → ${detail}`);
  failed++;
}

async function runTests() {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  MOCHA & MISO — SUPABASE CONNECTION HEALTH CHECK');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  URL: ${SUPABASE_URL}`);
  console.log('');

  // Test 1: Kết nối cơ bản — Kiểm tra bảng reservations
  console.log('📋 [1/6] Kiểm tra bảng RESERVATIONS...');
  try {
    const r = await httpRequest('GET', '/reservations?limit=1&select=id,name,status');
    if (r.status === 200) {
      pass(`Bảng reservations tồn tại (${Array.isArray(r.body) ? r.body.length : 0} bản ghi đầu tiên trả về)`);
    } else if (r.status === 401 || r.status === 403) {
      fail('Bảng reservations', `HTTP ${r.status} — Kiểm tra RLS Policy (cho phép anon SELECT)`);
    } else if (r.status === 404) {
      fail('Bảng reservations', `HTTP 404 — Bảng chưa được tạo. Chạy supabase-schema.sql trước.`);
    } else {
      fail('Bảng reservations', `HTTP ${r.status}: ${JSON.stringify(r.body)}`);
    }
  } catch (e) {
    fail('Bảng reservations', e.message);
  }

  // Test 2: Bảng orders
  console.log('\n📦 [2/6] Kiểm tra bảng ORDERS...');
  try {
    const r = await httpRequest('GET', '/orders?limit=1&select=id,order_id,table_number,status');
    if (r.status === 200) {
      pass(`Bảng orders tồn tại (${Array.isArray(r.body) ? r.body.length : 0} bản ghi đầu tiên trả về)`);
    } else if (r.status === 404) {
      fail('Bảng orders', 'Bảng chưa được tạo. Chạy supabase-schema.sql.');
    } else {
      fail('Bảng orders', `HTTP ${r.status}: ${JSON.stringify(r.body)}`);
    }
  } catch (e) {
    fail('Bảng orders', e.message);
  }

  // Test 3: Bảng inventory
  console.log('\n🏪 [3/6] Kiểm tra bảng INVENTORY...');
  try {
    const r = await httpRequest('GET', '/inventory?limit=1&select=id,name,quantity,unit');
    if (r.status === 200) {
      pass(`Bảng inventory tồn tại (${Array.isArray(r.body) ? r.body.length : 0} bản ghi đầu tiên trả về)`);
    } else if (r.status === 404) {
      fail('Bảng inventory', 'Bảng chưa được tạo. Chạy supabase-schema.sql.');
    } else {
      fail('Bảng inventory', `HTTP ${r.status}: ${JSON.stringify(r.body)}`);
    }
  } catch (e) {
    fail('Bảng inventory', e.message);
  }

  // Test 4: Bảng stock_imports
  console.log('\n📥 [4/6] Kiểm tra bảng STOCK_IMPORTS...');
  try {
    const r = await httpRequest('GET', '/stock_imports?limit=1&select=id,item_name,quantity');
    if (r.status === 200) {
      pass(`Bảng stock_imports tồn tại`);
    } else if (r.status === 404) {
      fail('Bảng stock_imports', 'Bảng chưa được tạo. Chạy supabase-schema.sql.');
    } else {
      fail('Bảng stock_imports', `HTTP ${r.status}: ${JSON.stringify(r.body)}`);
    }
  } catch (e) {
    fail('Bảng stock_imports', e.message);
  }

  // Test 5: Bảng stock_exports
  console.log('\n📤 [5/6] Kiểm tra bảng STOCK_EXPORTS...');
  try {
    const r = await httpRequest('GET', '/stock_exports?limit=1&select=id,item_name,quantity');
    if (r.status === 200) {
      pass(`Bảng stock_exports tồn tại`);
    } else if (r.status === 404) {
      fail('Bảng stock_exports', 'Bảng chưa được tạo. Chạy supabase-schema.sql.');
    } else {
      fail('Bảng stock_exports', `HTTP ${r.status}: ${JSON.stringify(r.body)}`);
    }
  } catch (e) {
    fail('Bảng stock_exports', e.message);
  }

  // Test 6: Thử INSERT reservation (Public RLS insert test)
  console.log('\n✍️  [6/6] Kiểm tra INSERT công khai vào RESERVATIONS (RLS)...');
  const testReservation = {
    reservation_id: `TEST-${Date.now()}`,
    name: '__HEALTH_CHECK__',
    email: 'healthcheck@test.internal',
    phone: '0000000000',
    date: '2099-01-01',
    time: '10:00',
    guests: 1,
    notes: 'Automated health check – safe to delete',
    status: 'pending',
    email_status: 'Pending'
  };

  let insertedId = null;
  try {
    const r = await httpRequest('POST', '/reservations', JSON.stringify(testReservation));
    if (r.status === 201) {
      const record = Array.isArray(r.body) ? r.body[0] : r.body;
      insertedId = record?.id;
      pass(`INSERT thành công → ID: ${insertedId}`);
    } else if (r.status === 401 || r.status === 403) {
      fail('INSERT reservation', `HTTP ${r.status} — RLS Policy "Public guests can create reservations" chưa được áp dụng.`);
    } else if (r.status === 404) {
      fail('INSERT reservation', 'Bảng reservations chưa tồn tại. Chạy supabase-schema.sql.');
    } else {
      fail('INSERT reservation', `HTTP ${r.status}: ${JSON.stringify(r.body)}`);
    }
  } catch (e) {
    fail('INSERT reservation', e.message);
  }

  // Xóa bản ghi test nếu đã tạo được
  if (insertedId) {
    try {
      await httpRequest('DELETE', `/reservations?id=eq.${insertedId}`);
      console.log(`     🧹 Đã xóa bản ghi test (ID: ${insertedId})`);
    } catch (e) {
      console.log(`     ⚠️ Không thể tự xóa bản ghi test — vui lòng xóa thủ công trên Supabase Dashboard.`);
    }
  }

  // Kết quả
  console.log('\n═══════════════════════════════════════════════════');
  console.log(`  KẾT QUẢ: ${passed} PASSED  |  ${failed} FAILED`);
  console.log('═══════════════════════════════════════════════════');

  if (failed === 0) {
    console.log('\n  🎉 TẤT CẢ KIỂM TRA ĐÃ THÀNH CÔNG!');
    console.log('  Supabase đã kết nối và PostgreSQL hoạt động bình thường.');
    console.log('\n  Các trang có thể truy cập:');
    console.log('  🌐 http://localhost:5500/index.html       (Website & Đặt bàn)');
    console.log('  📱 http://localhost:5500/order.html?table=01  (Gọi món QR)');
    console.log('  🔐 http://localhost:5500/admin.html       (Cổng quản trị)');
    console.log('  📦 http://localhost:5500/inventory.html   (Quản lý kho)');
  } else {
    console.log('\n  ⚠️  Cần khắc phục các lỗi trên trước khi sử dụng.');
    console.log('  → Chạy file supabase-schema.sql trong SQL Editor của Supabase.');
    console.log('  → Kiểm tra lại URL và anon key trong supabase.js.');
  }
  console.log('');
}

runTests().catch(err => {
  console.error('\n❌ KHÔNG THỂ KẾT NỐI ĐẾN SUPABASE:', err.message);
  console.error('  Kiểm tra lại URL và anon key trong supabase.js.');
});
