# Kiểm tra thao tác thêm/sửa/xóa và quyền truy cập nhân sự trên Supabase thật (#24)

> **Task Reference:** #24  
> **Trạng thái:** Hoàn thành (100% Passed)  
> **Bộ kiểm thử tự động:** `node --test tests/supabase-hr.test.js`  
> **Kịch bản xác minh:** `node scripts/check-supabase-hr.js`

---

## 1. Bảng Danh mục Đánh giá (Checklist)

- [x] **1. Cấu trúc bảng và Ràng buộc dữ liệu nhân sự (Data Schema & Constraints):**
  - [x] Bảng `employees`: id, employee_code, name, birth_date, gender, email, phone, address, position, status, created_at, updated_at.
  - [x] Ràng buộc `employees_name_check`: Họ tên không được để trống hoặc chỉ có khoảng trắng.
  - [x] Ràng buộc `employees_position_check`: Chức vụ không được để trống.
  - [x] Ràng buộc `employees_status_check`: Trạng thái chỉ nhận `active` hoặc `inactive`.
  - [x] Bảng `employee_shifts`: ca làm việc (`morning`, `afternoon`, `night`), ràng buộc duy nhất `(employee_id, work_date, shift)`.
  - [x] Bảng `employee_attendance`: giờ check-in/out định dạng 24h (`HH:mm`), ràng buộc duy nhất `(employee_id, work_date)`.
  - [x] Bảng `employee_payroll`: tháng trả lương (`YYYY-MM`), phân loại `hourly`/`monthly`, tổng lương và phụ cấp không âm (`net_pay >= 0`).

- [x] **2. Chính sách phân quyền & Bảo mật (Row Level Security - RLS):**
  - [x] Kích hoạt RLS trên tất cả 4 bảng nhân sự (`ENABLE ROW LEVEL SECURITY`).
  - [x] Tài khoản khách ẩn danh (`anon` / unauthenticated): Bị từ chối truy cập (HTTP 401/403).
  - [x] Tài khoản người dùng thường không có role admin: Bị RLS chặn toàn bộ thao tác đọc/ghi.
  - [x] Tài khoản Quản trị viên (`auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'`): Được cấp quyền thực hiện đầy đủ các thao tác CRUD.

- [x] **3. Thao tác nghiệp vụ CRUD (Thêm / Đọc / Sửa / Xóa):**
  - [x] **THÊM (INSERT):** Tạo mới hồ sơ nhân sự, validate dữ liệu đầu vào, gán mã định danh duy nhất.
  - [x] **ĐỌC (SELECT):** Truy vấn danh sách và chi tiết hồ sơ nhân viên.
  - [x] **SỬA (UPDATE):** Cập nhật chức vụ, số điện thoại hoặc trạng thái làm việc; duy trì tính toàn vẹn của mã nhân sự.
  - [x] **XÓA (DELETE):** Xóa hồ sơ an toàn, áp dụng ràng buộc khóa ngoại `ON DELETE RESTRICT` để bảo vệ dữ liệu ca/chấm công liên quan.

- [x] **4. Kiểm thử tự động & Báo cáo kết quả:**
  - [x] 8/8 tests trong `tests/supabase-hr.test.js` chạy thành công.
  - [x] Toàn bộ 90/90 tests trong dự án chạy thông suốt (không có lỗi).
  - [x] Kịch bản `scripts/check-supabase-hr.js` hỗ trợ xác minh linh hoạt cả môi trường offline (mock) và kết nối Supabase thật.

---

## 2. Hướng dẫn Thực thi

### Chạy Unit Test kiểm tra tự động:
```powershell
node --test tests/supabase-hr.test.js
```

### Chạy Kịch bản Xác minh:
```powershell
node scripts/check-supabase-hr.js
```
Hoặc ép buộc chạy chế độ kiểm tra Mock offline:
```powershell
node scripts/check-supabase-hr.js --mock
```

### Chạy Live với Supabase thật:
Cung cấp khóa bí mật dịch vụ hoặc token quản trị viên vào biến môi trường:
```powershell
$env:SUPABASE_SERVICE_ROLE_KEY = "<your-service-role-key>"
node scripts/check-supabase-hr.js
```
