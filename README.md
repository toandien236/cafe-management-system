# ☕ Mocha & Miso — Website & Hệ Thống Quản Lý Quán Cà Phê

<div align="center">

![Mocha & Miso](./assets/logo.jpg)

**Hệ thống quản lý quán cà phê phong cách Japandi với Backend PostgreSQL & Supabase.**

</div>

---

## 📑 Mục Lục
1. [Giới thiệu](#-giới-thiệu)
2. [Kiến Trúc Công Nghệ](#️-kiến-trúc-công-nghệ)
3. [Cấu Trúc Thư Mục Dự Án](#-cấu-trúc-thư-mục-dự-án)
4. [Hướng Dẫn Chạy Hệ Thống Ở Local](#-hướng-dẫn-chạy-hệ-thống-ở-local-để-phát-triển)
5. [Hướng Dẫn Thiết Lập Supabase & PostgreSQL](#-hướng-dẫn-thiết-lập-supabase--postgresql)
6. [Tạo Tài Khoản Quản Trị Viên (Admin)](#-tạo-tài-khoản-quản-trị-viên-admin)
7. [Kiểm Tra Kết Nối Tự Động (Health Check)](#-kiểm-tra-kết-nối-tự-động-health-check)
8. [Các Phân Hệ & Đường Dẫn Sử Dụng](#-các-phân-hệ--đường-dẫn-sử-dụng)

---

## 📖 Giới thiệu

**Mocha & Miso** là giải pháp toàn diện cho quán cà phê gồm:
* **Website thương hiệu:** Trải nghiệm thị giác cao cấp, hiệu ứng mượt mà (GSAP, Lenis), xem menu và đặt bàn trực tuyến.
* **Gọi món QR tại bàn (Mobile App):** Khách quét QR theo số bàn, chọn món, ghi chú và gửi đơn trực tiếp không cần tải ứng dụng.
* **Cổng quản trị (Admin Dashboard):** Quản lý đơn đặt bàn và đơn gọi món theo thời gian thực (Realtime), duyệt đơn, cập nhật thanh toán.
* **Quản trị kho nguyên vật liệu:** Quản lý tồn kho, định mức an toàn, tạo phiếu nhập/xuất kho tự động tính toán số dư.

---

## 🛠️ Kiến Trúc Công Nghệ

| Thành phần | Công nghệ sử dụng |
|---|---|
| **Cơ sở dữ liệu chính** | **PostgreSQL** (Tables, Foreign Keys, UUIDs, Triggers, RLS, Realtime) |
| **Backend as a Service** | **Supabase** (Auth, PostgREST API, Realtime Channels, Storage) |
| **Frontend UI** | HTML5, CSS3 hiện đại (Flexbox/Grid), JavaScript thuần (Vanilla ES6+) |
| **Hiệu ứng & Chuyển động** | GSAP 3, ScrollTrigger, SplitType, Lenis Smooth Scroll |
| **SDK & Thư viện** | `@supabase/supabase-js v2`, `QRCode.js`, `EmailJS` |

---

## 📁 Cấu Trúc Thư Mục Dự Án

Codebase được tổ chức phân tầng rõ ràng theo chuẩn module để dễ dàng mở rộng và bảo trì:

```
cafe-management-system/
├── assets/                     # Tài nguyên tĩnh (Hình ảnh sản phẩm, logo, banner)
├── css/                        # Tất cả các file Stylesheet
│   ├── style.css               # Giao diện chính (Website khách, Cổng Admin, Quản lý kho)
│   └── order.css               # Giao diện tối ưu Mobile cho ứng dụng Gọi món QR tại bàn
├── js/                         # Tất cả các file JavaScript xử lý logic
│   ├── supabase.js             # Khởi tạo Supabase Client & Cấu hình kết nối API
│   ├── main.js                 # Hiệu ứng Website, Form đặt bàn & gửi EmailJS
│   ├── admin.js                # Logic Cổng quản trị: Auth, Quản lý đơn & Realtime Listener
│   ├── order.js                # Logic Giỏ hàng, Menu & Gửi đơn gọi món PostgreSQL
│   └── inventory.js            # Logic Quản lý Kho: CRUD nguyên liệu, Nhập/Xuất kho
├── database/                   # Cơ sở dữ liệu
│   └── supabase-schema.sql     # Script khởi tạo toàn bộ Bảng, Indexes, Triggers, RLS & Seed data
├── scripts/                    # Các script tiện ích hỗ trợ phát triển & kiểm thử
│   └── check-supabase.js       # Script kiểm tra tự động kết nối & hoạt động của Supabase
├── screenshots/                # Hình ảnh minh họa giao diện trong tài liệu
├── index.html                  # Giao diện Website thương hiệu & Đặt bàn Online
├── admin.html                  # Giao diện Cổng Quản trị Viên (Dashboard)
├── order.html                  # Giao diện Gọi món tại bàn bằng mã QR
├── inventory.html              # Giao diện Quản trị Kho nguyên vật liệu
├── qr.html                     # Công cụ tạo & in mã QR cho từng bàn
└── README.md                   # Tài liệu hướng dẫn sử dụng & phát triển
```

---

## 💻 Hướng Dẫn Chạy Hệ Thống Ở Local Để Phát Triển

### Yêu cầu môi trường
* Đã cài đặt [Python 3.x](https://www.python.org/) **hoặc** [Node.js](https://nodejs.org/) (phiên bản 18+).

### Cách chạy nhanh Local Server

#### 👉 Cách 1: Sử dụng Python (Tích hợp sẵn, không cần cài thêm thư viện)
Mở Terminal / PowerShell tại thư mục dự án và chạy:
```powershell
python -m http.server 5500
```

#### 👉 Cách 2: Sử dụng Node.js `serve` hoặc `http-server`
```powershell
npx serve . -p 5500
# Hoặc
npx http-server -p 5500
```

#### 👉 Cách 3: Sử dụng Live Server trong Visual Studio Code
1. Cài Extension **Live Server** (`ritwickdey.LiveServer`) trên VS Code.
2. Nhấp chuột phải vào file `index.html` chọn **Open with Live Server**.

---

## 🗄️ Hướng Dẫn Thiết Lập Supabase & PostgreSQL

Nếu bạn muốn kết nối với một Project Supabase mới của riêng mình:

1. **Tạo Project mới:**
   * Truy cập [https://supabase.com](https://supabase.com) và tạo một project.
2. **Khởi tạo Database Schema:**
   * Vào mục **SQL Editor** trong Supabase Dashboard.
   * Sao chép toàn bộ nội dung file [`database/supabase-schema.sql`](database/supabase-schema.sql), dán vào ô nhập liệu và bấm **Run**.
   * Script sẽ tự động tạo:
     * `reservations` (Đơn đặt bàn)
     * `orders` (Đơn gọi món tại bàn)
     * `inventory` (Kho nguyên liệu)
     * `stock_imports` (Phiếu nhập kho)
     * `stock_exports` (Phiếu xuất kho)
     * `menu_items` (Danh mục thực đơn mẫu)
     * Cấu hình RLS Policies cho phép khách tạo đơn và nhân viên quản trị.
     * Bật Realtime publication cho tất cả các bảng.
3. **Cấu hình thông tin API:**
   * Vào **Project Settings** ➔ **API** trên Supabase Dashboard.
   * Lấy **Project URL** và **anon public key**, sau đó cập nhật vào file [`js/supabase.js`](js/supabase.js):
   ```javascript
   const SUPABASE_CONFIG = {
     url: "https://<your-project-id>.supabase.co",
     anonKey: "<your-anon-key>"
   };
   ```

---

## 🔐 Tạo Tài Khoản Quản Trị Viên (Admin)

Để đăng nhập vào Cổng Quản trị ([admin.html](admin.html)):

1. Truy cập Supabase Dashboard ➔ Chọn mục **Authentication** ➔ **Users**.
2. Nhấn nút **Add user** ➔ chọn **Create user**.
3. Nhập Email (ví dụ: `admin@mochaandmiso.com`) và Mật khẩu quản trị.
4. Mở [http://localhost:5500/admin.html](http://localhost:5500/admin.html) và đăng nhập bằng tài khoản vừa tạo.

---

## ✅ Kiểm Tra Kết Nối Tự Động (Health Check)

Dự án có sẵn script kiểm tra toàn diện hoạt động của Supabase và PostgreSQL. Chỉ cần chạy lệnh:

```powershell
node scripts/check-supabase.js
```

Script sẽ kiểm tra:
* Kết nối API Supabase
* Quyền truy cập các bảng (`reservations`, `orders`, `inventory`, `stock_imports`, `stock_exports`)
* Kiểm tra thử nghiệm tạo đơn và tự động dọn dẹp bản ghi test.

---

## 🌐 Các Phân Hệ & Đường Dẫn Sử Dụng

Khi server đang chạy tại port `5500`:

| Phân hệ | Đường dẫn Local | Mô tả |
|---|---|---|
| **🌐 Website Khách hàng** | [http://localhost:5500/index.html](http://localhost:5500/index.html) | Giới thiệu thương hiệu, Menu, Form đặt bàn online |
| **📱 Gọi món QR tại bàn** | [http://localhost:5500/order.html?table=01](http://localhost:5500/order.html?table=01) | Gọi món theo bàn (Bàn 01, 02... đổi tham số `?table=XX`) |
| **🔐 Cổng Quản trị (Admin)** | [http://localhost:5500/admin.html](http://localhost:5500/admin.html) | Xem thống kê, nhận đơn món Realtime, duyệt đặt bàn |
| **📦 Quản lý Kho** | [http://localhost:5500/inventory.html](http://localhost:5500/inventory.html) | Quản lý nguyên vật liệu, lập phiếu nhập kho & xuất kho |
| **🖨️ In mã QR bàn** | [http://localhost:5500/qr.html](http://localhost:5500/qr.html) | Sinh mã QR hàng loạt theo số lượng bàn của quán để in |
