# Mocha & Miso — Hệ thống quản lý quán cà phê

Website giới thiệu thương hiệu và bộ công cụ vận hành quán cà phê: đặt bàn, gọi món QR, quản lý đơn và doanh thu, kho, cùng hồ sơ nhân sự.

![Giao diện Mocha & Miso](./screenshots/hero.png)

## Tính năng

| Phân hệ | Chức năng chính | Trang |
|---|---|---|
| Website khách hàng | Giới thiệu, xem thực đơn, gửi yêu cầu đặt bàn | [`index.html`](./index.html) |
| Quản trị | Đăng nhập Firebase, duyệt đặt bàn/đơn Firestore, cập nhật thanh toán, xem doanh thu | [`admin.html`](./admin.html) |
| Gọi món QR | Chọn món theo bàn, thêm ghi chú, gửi đơn | [`order.html`](./order.html?table=01) |
| Quản lý kho | Theo dõi nguyên liệu, tồn thấp, phiếu nhập và xuất | [`inventory.html`](./inventory.html) |
| Nhân sự | Hồ sơ nhân viên, ca, chấm công và bảng lương | [`hr.html`](./hr.html) |
| Mã QR | Tạo mã QR theo số bàn | [`qr.html`](./qr.html) |

## Kiến trúc hiện tại

- **Frontend:** HTML, CSS và JavaScript thuần; Firebase và Supabase SDK được tải từ CDN.
- **Cổng quản trị:** Firebase Authentication xác thực tài khoản quản trị cũ; đặt bàn, đơn và doanh thu trong cổng này đọc/ghi qua Cloud Firestore.
- **Nhân sự:** Firebase Authentication và Cloud Firestore dùng chung project với cổng quản trị; hồ sơ, ca, chấm công và bảng lương nằm trong các collection `employees`, `employee_shifts`, `employee_attendance` và `employee_payroll`.
- **Các phân hệ đang dùng Supabase:** Website đặt bàn và quản lý kho vẫn dùng Supabase Auth/PostgreSQL; cần project URL/anon key và schema/RLS đã được cấu hình.
- **Gọi món QR và quản trị đơn:** Trang QR ghi đơn vào Firestore; cổng quản trị cũng đọc/cập nhật đơn từ Firestore để doanh thu nhận đúng đơn đã thanh toán.
- **Trạng thái chuyển đổi:** Website đặt bàn và kho chưa đồng bộ trực tiếp với Firestore. Đặt bàn mới từ website chưa tự xuất hiện trong dashboard Firebase. HR dùng Firebase từ nay; dữ liệu HR cũ trong Supabase chưa được tự động di chuyển và vẫn còn nguyên ở nguồn.
- EmailJS là tích hợp tùy chọn phía client. Không đưa service-role key hoặc Firebase service-account vào trình duyệt.

## Chạy local

Yêu cầu: Python 3 hoặc Node.js 18+. Mở PowerShell tại thư mục dự án:

```powershell
python -m http.server 5500
```

Sau đó mở:

| Mục đích | Địa chỉ |
|---|---|
| Website khách | <http://localhost:5500/index.html> |
| Quản trị | <http://localhost:5500/admin.html> |
| Gọi món bàn 01 | <http://localhost:5500/order.html?table=01> |
| Quản lý kho | <http://localhost:5500/inventory.html> |
| Nhân sự | <http://localhost:5500/hr.html> |
| Tạo mã QR | <http://localhost:5500/qr.html> |

## Cấu hình Supabase

Các bước dưới đây chỉ áp dụng cho website đặt bàn và quản lý kho. Gọi món QR, quản trị đơn và HR hiện dùng Firebase/Firestore như mô tả ở trên.

1. Tạo project Supabase và cấu hình Project URL cùng anon key trong [`js/supabase.js`](./js/supabase.js), hoặc đặt `window.ENV_SUPABASE_URL` / `window.ENV_SUPABASE_ANON_KEY` trước khi khởi tạo client. Không đặt service-role key trong HTML, JavaScript client hoặc Git.
2. Với project **mới**, chạy [`database/supabase-schema.sql`](./database/supabase-schema.sql). Tập lệnh khởi tạo này có `DROP TABLE`; chỉ chạy trên project trống hoặc sau bản sao lưu và phê duyệt xóa dữ liệu.
3. Với project **đã có schema/dữ liệu**, không chạy tập lệnh có `DROP TABLE`. Chạy tập lệnh tăng dần [`database/firebase-to-supabase.sql`](./database/firebase-to-supabase.sql) chỉ khi cần chuẩn bị schema cho các luồng Supabase/migration; gọi món QR hiện tại không gọi RPC Supabase `create_order`.
4. Dữ liệu menu trong `seed-data.sql` phục vụ bảng Supabase/luồng RPC tương ứng, không cung cấp menu cho trang QR hiện tại (menu QR đang khai báo trong `js/order.js`). Phần còn lại của script thêm dữ liệu mẫu kho/đặt bàn/đơn; không chạy phần dữ liệu mẫu trên dữ liệu thật.
5. Tạo user trong Supabase Authentication và gán vai trò admin trong SQL Editor (dùng cho trang quản lý kho):

   ```sql
   UPDATE auth.users
   SET raw_app_meta_data =
     COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
   WHERE email = 'admin@example.com';
   ```

   Thay email mẫu bằng email thực. Đăng xuất rồi đăng nhập lại sau khi thay role để JWT nhận metadata mới. HR không sử dụng tài khoản Supabase; đăng nhập bằng tài khoản Firebase quản trị hiện có.

`employee-hr.sql` là schema Supabase cũ, không cần chạy cho HR hiện tại. Dữ liệu HR đã lưu tại Supabase không bị ứng dụng mới sửa hoặc xóa, nhưng cần một bước migration riêng nếu muốn đưa các bản ghi đó sang Firestore. Chưa có migration HR tự động.

## Chuyển dữ liệu Firestore hiện có

Tập lệnh nhập **chỉ** hai collection `reservations` và `orders`. Nó ánh xạ camelCase sang snake_case, lưu document ID gốc trong `source_firebase_id`, upsert theo ID này để có thể chạy lại an toàn, và không xóa hay sửa dữ liệu Firebase. Các tài khoản/mật khẩu Firebase không được chuyển.

1. Sao lưu Firestore và chạy schema Supabase ở trên trước. Sau đó thiết lập thông tin trong PowerShell; đường dẫn service-account phải nằm ngoài repository:

   ```powershell
   npm install
   $env:FIREBASE_PROJECT_ID = "firebase-project-id"
   $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\secure\firebase-service-account.json"
   $env:SUPABASE_URL = "https://your-project.supabase.co"
   $env:SUPABASE_SERVICE_ROLE_KEY = "your-service-role-key"
   $env:MIGRATION_DRY_RUN = "1"
   npm run migrate:firebase
   ```

2. Xem số lượng bản ghi đã kiểm tra và sửa các bản ghi thiếu/không hợp lệ ở nguồn trước khi ghi. Khi đã xác nhận project đích, chạy:

   ```powershell
   $env:MIGRATION_DRY_RUN = "0"
   npm run migrate:firebase
   ```

3. So sánh số bản ghi Firestore với các dòng có `source_firebase_id` trong Supabase, kiểm tra đặt bàn/đơn mẫu, RLS và đăng nhập admin. Chỉ chuyển traffic sau khi xác minh; giữ bản sao Firestore cho tới khi đối soát hoàn tất.

Service-role key và Firebase service-account chỉ dùng trên máy chạy migration; không dán vào chat, không commit, và xóa khỏi biến môi trường sau khi dùng (`Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY`, `Remove-Item Env:GOOGLE_APPLICATION_CREDENTIALS`).

## EmailJS

Email đặt bàn chỉ hoạt động khi Service ID, Template ID và Public Key được cấu hình trong `EMAILJS_CONFIG` tại [`index.html`](./index.html). Đây là public key phía trình duyệt; không đưa private key hoặc thông tin bí mật vào client.

## Kiểm thử

```powershell
node --test tests/customer-care.test.js tests/table-orders.test.js tests/revenue.test.js tests/hr-auth.test.js tests/admin-auth.test.js tests/firebase-migration.test.js
```

Các test kiểm tra Firebase Auth của cổng quản trị và HR, ghi đơn QR vào Firestore, hồ sơ khách, tổng hợp doanh thu và mapping migration.
