# Hướng dẫn chăm sóc khách hàng

## Truy cập hồ sơ

1. Mở `admin.html` và đăng nhập bằng tài khoản quản trị được Firestore cho phép.
2. Trong bảng đặt bàn, dùng ô tìm kiếm và các bộ lọc hiện có. Khu vực **Hồ sơ khách hàng** nằm ngay bên dưới bảng này.
3. Dùng ô tìm kiếm hồ sơ để lọc theo tên, email hoặc số điện thoại. Bảng hồ sơ tách riêng email và số điện thoại, số lượt đặt, số lượt ghé đã xác nhận, lần ghé gần nhất và thao tác xem chi tiết.
4. Chọn **Xem hồ sơ** để xem thông tin liên hệ, tổng lượt đặt và lịch sử gồm ngày, giờ, số khách, ghi chú, trạng thái đặt bàn và trạng thái lượt ghé.

Trong lúc tải, giao diện báo trạng thái đang tải. Khi chưa có dữ liệu, tìm kiếm không có kết quả hoặc Firestore không tải được, giao diện hiển thị thông báo tương ứng. Nếu chỉ còn bản sao `localStorage`, hồ sơ được đánh dấu là dữ liệu trên thiết bị và không thể ghi nhận lượt ghé.

Hồ sơ được tổng hợp từ các tài liệu trong `reservations`.

Tên không được dùng làm định danh. Email được bỏ khoảng trắng hai đầu, chuyển thành chữ thường và chỉ dùng làm định danh nếu có định dạng cơ bản hợp lệ; email thiếu hoặc lỗi không làm gộp hồ sơ. Số điện thoại được chuẩn hóa về chữ số; tiền tố Việt Nam `84` và `0084` được đổi về dạng `0...`. Đặt bàn chỉ có số điện thoại được gắn vào hồ sơ email khi số đó chỉ thuộc về một hồ sơ email.

Nếu một số điện thoại liên kết với nhiều email, các hồ sơ email được giữ riêng và có cảnh báo. Đặt bàn chỉ có số điện thoại đang bị chia sẻ trong trường hợp đó cũng được giữ riêng từng lượt để tránh suy đoán danh tính. Đặt bàn không có email hoặc số điện thoại đủ dài được giữ riêng theo mã đặt bàn. Dữ liệu thiếu hoặc cũ không được tự bổ sung từ tên hay ngày đặt.

## Đọc lịch sử đặt bàn

- Lịch sử hiển thị các đặt bàn đã tải được, kể cả trạng thái đang chờ, đã xác nhận hoặc đã hủy; mỗi dòng có ngày, giờ, số khách, ghi chú và trạng thái.
- Số lượt đặt bàn đếm tài liệu đặt bàn, không phải lượt ghé.
- Hồ sơ dùng tên mới nhất tìm thấy; nếu tên hoặc số liên hệ thay đổi, các giá trị khác nhau vẫn được giữ trong hồ sơ để nhân viên đối chiếu.
- Dữ liệu cũ thiếu ngày, giờ, email hoặc số điện thoại được hiển thị là chưa có thông tin. Hồ sơ không tự suy đoán các giá trị còn thiếu.
- Khi Firestore không tải được, cổng có thể hiển thị bản sao cục bộ trên thiết bị. Các đặt bàn cục bộ không thể ghi nhận lượt ghé và không đại diện cho dữ liệu dùng chung.
- Bản ghi lượt ghé lịch sử gắn với đặt bàn không ở trạng thái đã xác nhận được gắn nhãn cần rà soát và không được cộng vào số lượt ghé đã xác nhận.

## Ghi nhận lượt ghé

1. Xác nhận đặt bàn đang chờ trước khi phục vụ. Khi đặt bàn ở trạng thái **Đã xác nhận**, bảng đặt bàn hiển thị nút **Xác nhận khách đã đến**; trong lịch sử hồ sơ có nút **Ghi nhận đã ghé**.
2. Chỉ sau khi nhân viên xác nhận khách đã đến và được phục vụ, bấm nút rồi xác nhận hộp thoại.
3. Sau khi Firestore lưu thành công, nút được thay bằng trạng thái **Khách đã đến**, số lượt ghé và lần ghé gần nhất cập nhật theo thời điểm ghi nhận.

Lượt ghé được lưu trong `reservationVisits` với ID tài liệu bằng ID tài liệu đặt bàn Firestore. Transaction đọc lại đặt bàn và tài liệu lượt ghé, chỉ ghi nếu đặt bàn vẫn đang xác nhận và chưa có lượt ghé. Bản ghi giữ ảnh chụp tên, email chuẩn hóa, số điện thoại và khóa khách ổn định để lịch sử vẫn thuộc đúng hồ sơ nếu đặt bàn gốc bị xóa. Nhấn lặp, tải lại hoặc thao tác đồng thời cho cùng đặt bàn không tạo thêm lượt.

Đặt bàn có thể được xóa khỏi danh sách mà không xóa lượt ghé. Khi gặp bản ghi lượt ghé cũ chưa có ảnh chụp thông tin khách, thao tác xóa bổ sung ảnh chụp từ đặt bàn trong cùng transaction trước khi xóa đặt bàn. Nếu transaction hoặc Rules đang áp dụng từ chối, đặt bàn được giữ lại. Rules local cần được triển khai riêng để tính năng này hoạt động trên Firebase thật.

Nếu ghi lượt ghé hoặc tải lịch sử thất bại, mở Developer Tools → Console và tìm dòng `[Firestore]`. Dòng này chỉ ghi tên thao tác, mã lỗi và thông báo đã lọc đường dẫn tài liệu/email; không ghi nội dung hồ sơ. `permission-denied` thường có nghĩa tài khoản chưa được Rules cho phép hoặc Rules chứa `reservationVisits` chưa được triển khai lên đúng Firebase project. `unavailable`, `deadline-exceeded` hoặc `network-request-failed` cần kiểm tra kết nối. `not-found` nghĩa là đặt bàn đã bị xóa hoặc không còn tồn tại. Hãy kiểm tra đang đăng nhập bằng tài khoản quản trị được cấu hình và Rules triển khai có các quyền riêng tư trong `firestore.rules` trước khi thử lại.

Đặt bàn đang chờ, đã hủy hoặc chỉ có trên thiết bị không thể được ghi nhận. Sau khi xác nhận đặt bàn, nút **Hủy** được ẩn; trạng thái đã xác nhận không thể chuyển ngược về chờ hoặc hủy. Đặt bàn không tự trở thành lượt ghé khi được xác nhận; trạng thái hoàn tất của đơn gọi món cũng không được dùng làm bằng chứng.

## Bảo mật và giới hạn

- Quy tắc Firestore chỉ cho tài khoản quản trị được đọc đặt bàn và lượt ghé. Khách có thể tạo yêu cầu đặt bàn theo lược đồ được kiểm tra, nhưng không thể đọc lịch sử khách hàng.
- Tên/email/số điện thoại không tạo mã khách hàng riêng. Hai người dùng chung email có thể được gom; số điện thoại dùng chung cùng nhiều email sẽ được cảnh báo và không tự gộp. Nhân viên cần xác minh các trường hợp liên hệ dùng chung.
- Lượt ghé chỉ gắn với đặt bàn. Hiện chưa có luồng ghi lượt ghé cho khách vãng lai.
- Xóa đặt bàn không xóa hồ sơ khách hoặc tài liệu lượt ghé. Firestore đọc đặt bàn và lượt ghé trong cùng transaction; nếu có lượt ghé, Rules chỉ cho phép xóa sau khi ảnh chụp nhận diện khách hợp lệ sẽ còn tồn tại.
- Lịch sử lượt ghé giữ mã đặt bàn tham chiếu sau khi đặt bàn bị xóa. Các bản ghi cũ được bổ sung snapshot khách trong transaction xóa; nếu không thể bổ sung an toàn, giao diện giữ nguyên đặt bàn.
- Chỉ đặt bàn đang chờ mới có thể chuyển sang xác nhận hoặc hủy. Đặt bàn đã xác nhận không có thao tác hủy; sau khi có lượt ghé, lịch sử cũng không thể bị xóa.
- Các sự kiện lượt ghé không thể bị xóa hoặc sửa. Rules chỉ cho phép bổ sung snapshot nhận diện còn thiếu trong cùng transaction xóa đặt bàn; không thay đổi thời điểm, nhân viên ghi nhận hoặc mã đặt bàn.
- Form nhận đặt bàn từ 1 đến 12 khách, theo các giờ có sẵn trong biểu mẫu. Ngày quá khứ được chặn ở trình duyệt theo múi giờ `Asia/Ho_Chi_Minh`; quy tắc Firestore kiểm tra định dạng ngày nhưng không tự tính ngày hiện tại.
- Việc xác minh khách thực sự đã được phục vụ vẫn do nhân viên thực hiện; ứng dụng không xác minh hiện diện bằng thiết bị hoặc hóa đơn.
