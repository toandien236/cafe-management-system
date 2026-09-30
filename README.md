# ☕ Mocha & Miso — Website & Hệ Thống Quản Lý Quán Cà Phê

<div align="center">

![Mocha & Miso](./assets/logo.jpg)

**Hệ thống quản lý quán cà phê phong cách Japandi với Backend PostgreSQL & Supabase.**

</div>

---

## 🛠️ Kiến Trúc Công Nghệ Mới (PostgreSQL + Supabase)

| Tầng | Công nghệ |
|---|---|
| **Cơ sở dữ liệu chính** | **PostgreSQL** (Tables, Foreign Keys, UUIDs, Triggers, Indexes) |
| **Backend & Cloud Services** | **Supabase** (Auth, PostgREST API, Realtime Publications, Row Level Security - RLS) |
| **Giao diện Frontend** | HTML5, CSS3 hiện đại, JavaScript thuần (Vanilla JS), Supabase JS SDK |
| **Hiệu ứng & Trải nghiệm** | GSAP 3, ScrollTrigger, SplitType, Lenis Smooth Scroll |
| **Email thông báo** | EmailJS & Transactional Email |

---

## 📁 Cấu trúc Dự Án

```
cafe-management-system/
├── index.html              # Website thương hiệu dành cho khách hàng & Đặt bàn
├── admin.html              # Cổng quản trị (Dashboard, Quản lý đơn bàn & Đặt bàn)
├── admin.js                # Logic Quản trị & Supabase Auth / Realtime
├── inventory.html          # Phân hệ Quản trị Kho nguyên vật liệu
├── inventory.js            # Logic Quản trị Kho, Nhập/Xuất kho với Supabase
├── order.html              # Ứng dụng gọi món bằng mã QR tại bàn (Mobile-First)
├── order.js                # Logic giỏ hàng & Gửi đơn món lên PostgreSQL
├── qr.html                 # Công cụ sinh mã QR theo số bàn
├── supabase.js             # Cấu hình kết nối Supabase Client SDK
├── supabase-schema.sql     # Script khởi tạo Database PostgreSQL & RLS trên Supabase
├── main.js                 # Xử lý hiệu ứng website, Form đặt bàn & EmailJS
├── style.css               # Giao diện tổng thể phong cách Japandi
├── order.css               # Giao diện dành riêng cho ứng dụng gọi món tại bàn
├── assets/                 # Hình ảnh sản phẩm, logo và không gian quán
└── screenshots/            # Ảnh chụp màn hình giao diện
```

---

## 🚀 Hướng Dẫn Thiết Lập Môi Trường (Supabase + PostgreSQL)

### Bước 1: Khởi tạo Project trên Supabase
1. Truy cập [https://supabase.com](https://supabase.com) và đăng ký / đăng nhập tài khoản.
2. Tạo một project mới (ví dụ: `cafe-management-system`).
3. Chọn database password và region gần nhất (ví dụ: Singapore).

### Bước 2: Chạy Script PostgreSQL Schema
1. Mở mục **SQL Editor** trong Supabase Dashboard.
2. Sao chép toàn bộ nội dung file [`supabase-schema.sql`](supabase-schema.sql) và dán vào SQL Editor.
3. Bấm **Run** để khởi tạo các bảng:
   - `reservations` (Đơn đặt bàn)
   - `orders` (Đơn gọi món tại bàn)
   - `inventory` (Nguyên vật liệu kho)
   - `stock_imports` (Phiếu nhập kho)
   - `stock_exports` (Phiếu xuất kho)
   - `menu_items` (Danh mục thực đơn)
   - Cùng toàn bộ Triggers tự động cập nhật `updated_at`, Indexes và chính sách bảo mật **Row Level Security (RLS)**.

### Bước 3: Cấu hình API Key trong `supabase.js`
1. Vào mục **Project Settings** -> **API** trong Supabase Dashboard.
2. Lấy **Project URL** và **anon public key**.
3. Cập nhật vào file [`supabase.js`](supabase.js):
```javascript
const SUPABASE_CONFIG = {
  url: "https://your-project.supabase.co",
  anonKey: "your-anon-key-here"
};
```

### Bước 4: Tạo tài khoản Quản trị viên (Admin)
1. Vào mục **Authentication** -> **Users** trong Supabase Dashboard.
2. Bấm **Add user** -> **Create user** (nhập email quản trị và mật khẩu mong muốn).
3. Đăng nhập tại `admin.html` bằng tài khoản này.

---

## 💻 Chạy Dự Án Trên Môi Trường Local

Bạn có thể chạy dự án với bất kỳ HTTP server tĩnh nào:

```bash
# Sử dụng Python built-in server:
python -m http.server 5500

# Hoặc sử dụng Live Server (VS Code Extension)
# Hoặc sử dụng npx serve:
npx serve .
```

Mở trình duyệt:
- 🌐 Website khách hàng: `http://localhost:5500/index.html`
- 📱 Gọi món tại bàn: `http://localhost:5500/order.html?table=01`
- 🔐 Cổng quản trị: `http://localhost:5500/admin.html`
- 📦 Quản lý kho: `http://localhost:5500/inventory.html`
- 🖨️ In mã QR bàn: `http://localhost:5500/qr.html`
