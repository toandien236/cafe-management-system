# [TESTING] Tổng Hợp & Đánh Giá Kiểm Thử Dự Án Quán Cà Phê Mocha & Miso

> **Mô tả:** Issue theo dõi toàn diện hiện trạng kiểm thử của dự án Cafe Management System (Mocha & Miso), bao gồm các tính năng đã hoàn thiện đạt chuẩn (`[x]`) và các hạng mục kiến trúc/mở rộng trong tương lai (`[ ]`).
> **Trạng thái bộ test tự động:** 11/11 file test — **82/82 bài test PASS 100%** (`npm test`).

---

## 1. Website Khách Hàng & Thực Đơn (Homepage & Menu)
- [x] **WEB-01: Giao diện thương hiệu Japandi:** Hiển thị câu chuyện quán, hình ảnh sân vườn, thông tin liên hệ và giờ mở cửa.
- [x] **WEB-02: Đồng nhất giá thực đơn:** 15 món trên trang chủ (`index.html`) và trang gọi món (`order.html`) đồng nhất với file dữ liệu chuẩn `js/menu-data.js` (*Passed: `tests/menu-prices.test.js`*).
- [x] **WEB-03: Responsive & Điều hướng:** Menu mobile trượt mượt mà, hỗ trợ cuộn và liên kết mỏ neo.
- [x] **WEB-04: Đồng bộ phiên bản script trang chủ:** `index.html` và bài test kiểm tra cache đã được đồng bộ phiên bản `v=13` (*Passed: `tests/reservation-form-assignment.test.js`*).

---

## 2. Đặt Bàn & Quản Lý Khách Hàng (Reservations & Customer Care)
- [x] **RSV-01: Form gửi yêu cầu đặt bàn:** Nhập tên, email, ngày giờ, số lượng khách (1-12 người), khóa nút gửi tránh double-click.
- [x] **RSV-02: Idempotency Key:** Cơ chế tạo request ID chống gửi lặp đơn đặt bàn khi mạng chậm/retry (*Passed: `tests/reservation-form-assignment.test.js`*).
- [x] **RSV-03: Không hiển thị số bàn cho khách:** Form đặt bàn của khách không yêu cầu chọn trước số bàn cứng (*Passed: `tests/table-assignment.test.js`*).
- [x] **RSV-04: Sửa lỗi Runtime Danh bạ khách hàng:** Đã bổ sung kiểm tra an toàn phương thức `tbody.closest`, danh bạ khách hàng tải mượt mà không lỗi (*Passed: `tests/customer-care.test.js`*).
- [x] **RSV-05: Sửa lỗi tạo & xóa lượt ghé (Visit Workflow):**
  - [x] Chuẩn hóa schema đối tượng lượt ghé khi xác nhận đặt bàn.
  - [x] Sửa triệt để hàm `deleteBooking()` trong `admin.js`, loại bỏ lỗi `ReferenceError: archivedReservation is not defined`.
  - [x] Bảo toàn trọn vẹn lịch sử độc lập của khách hàng khi xóa lịch đặt bàn (*Passed: `tests/admin-visit-workflow.test.js`*).

---

## 3. Gọi Món Tại Bàn Bằng QR & Xử Lý Đơn (QR Orders)
- [x] **ORD-01: Tạo mã QR theo bàn:** Trang `qr.html` tạo và in mã QR cho bàn từ `01` đến `99`.
- [x] **ORD-02: Giao diện gọi món theo bàn:** URL `order.html?table=NN` tự động kiểm tra số bàn hợp lệ; hiển thị thông báo lỗi nếu bàn không tồn tại (*Passed: `tests/table-orders.test.js`*).
- [x] **ORD-03: Giỏ hàng & Tạm tính:** Khách có thể chọn món, tăng/giảm số lượng, nhập ghi chú quầy bar/bếp và xem tổng tiền.
- [x] **ORD-04: Ghi nhận đơn vào Firestore:** Đơn hàng được đẩy trực tiếp lên collection `orders` với trạng thái ban đầu (*Passed: `tests/table-orders.test.js`*).
- [x] **ORD-05: Xác thực đơn hàng phía máy chủ:** Đã xây dựng Cloud Function `submitTableOrder` & service `validateAndCalculateOrder` xác thực toàn bộ giá món, tính tổng tiền theo menu gốc và bảo vệ quy tắc Firestore (*Passed: `tests/table-orders-advanced.test.js`*).
- [x] **ORD-06: Chống gửi đơn trùng lặp (Idempotency):** Đã bổ sung cơ chế khóa `requestId` (UUIDv4) + hash giỏ món ở client/sessionStorage và kiểm tra trùng lặp giao dịch phía server để ngăn chặn gửi đơn lặp khi gián đoạn mạng (*Passed: `tests/table-orders-advanced.test.js`*).
- [x] **ORD-07: Theo dõi trạng thái đơn cho khách:** Đã tích hợp giao diện tiến trình 4 giai đoạn trực quan (Đã gửi → Đang pha chế → Đã phục vụ → Hoàn tất) kèm kết nối Firestore thời gian thực và khôi phục khi tải lại trang (*Passed: `tests/table-orders-advanced.test.js`*).

---

## 4. Cổng Quản Trị & Báo Cáo Doanh Thu (Admin & Revenue)
- [x] **ADM-01: Xác thực tài khoản Admin:** Đăng nhập qua Firebase Auth, chặn email không thuộc quyền quản trị (*Passed: `tests/admin-auth.test.js`*).
- [x] **ADM-02: Đồng bộ đơn hàng thời gian thực:** Dashboard tự động cập nhật khi có đơn gọi món mới từ Firestore.
- [x] **REV-01: Tính doanh thu chuẩn:** Doanh thu chỉ tính trên các đơn đã thanh toán (`paid`), loại bỏ đơn hủy/chưa thanh toán (*Passed: `tests/revenue.test.js`*).
- [x] **REV-02: Phân trang & Đếm đơn:** Phân trang 15 đơn/trang, có bộ lọc theo ngày tạo đơn.
- [x] **REV-03: Sửa lỗi Runtime Bộ lọc ngày đơn hàng:** Đã gỡ bỏ đoạn code lỗi `res.archivedAt` trong hàm `clearOrdersCalendarDate()`, bộ lọc ngày hoạt động ổn định (*Passed: `tests/revenue.test.js`*).
- [x] **ADM-03: Đồng bộ phiên bản script trang Admin:** Đã khớp script tag trong `admin.html` với test case.

---

## 5. Quản Lý Kho & Nhân Sự (Inventory & HR)
- [x] **HR-01: Xác thực phân hệ HR:** Phân quyền quản lý HR bằng tài khoản Firebase Admin (*Passed: `tests/hr-auth.test.js`*).
- [x] **HR-02: Quản lý hồ sơ & Chấm công:** Giao diện `hr.html` hỗ trợ quản lý nhân viên, xếp ca làm việc và tính lương.
- [x] **INV-01: Quản lý nguyên liệu kho:** Giao diện `inventory.html` theo dõi tồn kho, ngưỡng tối thiểu, nhập/xuất kho.
- [ ] **INV-02: Trừ tồn kho tự động theo công thức món:** Đề xuất xây dựng định lượng nguyên liệu cho từng món trong thực đơn.
- [ ] **SYS-01: Thống nhất cơ sở dữ liệu:** Kho & HR đang dùng Supabase trong khi Gọi món & Admin dùng Firebase Firestore; cần luồng đồng bộ dữ liệu thống nhất.

---

## 6. Trạng Thái Bộ Kiểm Thử Tự Động (Automated Test Suite)
- **Tổng số:** 11 files test (`11 PASS` / `0 FAIL` — **82/82 tests pass 100%**)
  - [x] `admin-auth.test.js` — **PASS**
  - [x] `admin-visit-workflow.test.js` — **PASS**
  - [x] `customer-care.test.js` — **PASS**
  - [x] `firebase-migration.test.js` — **PASS**
  - [x] `functions-error-codes.test.js` — **PASS**
  - [x] `hr-auth.test.js` — **PASS**
  - [x] `menu-prices.test.js` — **PASS**
  - [x] `reservation-form-assignment.test.js` — **PASS**
  - [x] `revenue.test.js` — **PASS**
  - [x] `table-assignment.test.js` — **PASS**
  - [x] `table-orders.test.js` — **PASS**
- [x] **DEV-01: Cấu hình lệnh npm test trong package.json:** Đã thêm script `"test": "node --test tests/*.test.js"`, có thể chạy `npm test` trực tiếp mọi lúc.
