# Gán bàn cho lượt đặt

## Luồng hiện tại

- Khách có thể chọn bàn mong muốn B01–B20; lựa chọn này được lưu ở `requestedTableNumber` và không tự gán bàn. Biểu mẫu không gọi Cloud Function `createReservationWithTable`.
- Reservation được tạo ở trạng thái `pending`, email ở trạng thái `Pending`, không có `tableNumber`. Sau khi quán kiểm tra tình trạng bàn, admin có thể xác nhận và gán B01–B20 trong bảng quản trị; lựa chọn mong muốn được hiển thị làm gợi ý.
- Bảng admin kiểm tra các đặt chỗ đang hoạt động cùng ngày theo khoảng giữ bàn 120 phút và sức chứa cấu hình trước khi gán. Transaction tăng revision chung của ngày; nếu phiên admin khác vừa cập nhật danh sách bàn, thao tác cũ bị từ chối để nhân viên kiểm tra lại.
- Các reservation cũ có `tableNumber` tiếp tục hiển thị như trước. Reservation chưa có bàn hiển thị `Chưa gán` và có điều khiển gán bàn trong admin.

## Chống gửi trùng và quyền truy cập

- Trình duyệt giữ UUID và hash SHA-256 của nội dung đã gửi trong `sessionStorage`. Khi gửi lại cùng nội dung, trang đọc `reservationRequests/{requestId}` trước; nếu batch trước đã commit nhưng phản hồi bị mất, marker xác nhận lại đúng reservation.
- Tạo reservation và marker bằng một Firestore batch nguyên tử. Marker chỉ chứa UUID, hash và thời điểm tạo, không chứa thông tin khách. Marker bất biến và không cho truy vấn công khai; client chỉ có thể đọc một marker theo UUID.
- `firestore.rules` chỉ cho phép tạo reservation pending với tập trường và giới hạn dữ liệu định sẵn, kèm marker trong cùng batch. Chỉ admin đọc reservation. Không có quyền đọc/ghi công khai chung.
- `tableAllocationDays/{YYYY-MM-DD}` chỉ admin được đọc và cập nhật. Rules yêu cầu revision tăng đúng một bước và thời điểm server; reservation update chỉ cho admin gán bàn từ `01` đến `20`.
- Mã callable và bộ phân bổ cũ trong `functions/` vẫn nằm trong repository, nhưng website không tải Functions SDK và không gọi mã đó.

## Cấu hình sức chứa

Trang admin dùng cấu hình: B01–B04 sức chứa 2, B05–B08 sức chứa 4, B09–B10 sức chứa 6, B11 sức chứa 8, B12 sức chứa 12, B13–B20 sức chứa 4. Đây là cấu hình khởi đầu; hãy đối chiếu với sơ đồ bàn thật trước khi admin sử dụng thao tác gán.

Thời lượng giữ bàn để kiểm tra trùng hiện là 120 phút trong `admin.js`. Nếu quán dùng thời lượng khác, cập nhật giá trị này và kiểm tra lại các đặt chỗ đang hoạt động trước khi áp dụng.

## Triển khai Rules

Rules trong `firestore.rules` là thay đổi trong workspace, chưa được publish. Trước khi nhận đặt bàn trên website đang host, quản trị viên Firebase cần:

1. Chọn đúng project Firebase `project-quan-cafe` trong Console.
2. Mở **Firestore Database → Rules**, rà soát bản Rules trong repository và thay đổi Rules đang chạy để bao gồm quyền giới hạn cho `reservations`, `reservationRequests`, `reservationVisits`, `orders` và `tableAllocationDays`.
3. Kiểm thử tạo cặp reservation/marker hợp lệ, từ chối schema thừa hoặc thiếu marker, quyền đọc admin, gán bàn và cập nhật trạng thái bằng Rules Emulator hoặc Rules Playground.
4. Chỉ sau khi rà soát và kiểm thử, chủ dự án tự publish Rules từ Console. Chưa có Rules nào được publish bởi thay đổi này.

Nếu trang hiện báo `permission-denied`, Rules đang publish chưa cho phép cặp ghi mới hoặc chưa cho phép đọc marker tối giản. Không mở quyền đọc/ghi công khai để khắc phục.
