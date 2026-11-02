# Kế hoạch và kết quả kiểm thử Issue #5

## Kết quả đã chạy

| ID | Trường hợp | Kết quả thực tế |
|---|---|---|
| JS-01 | `node --check` cho toàn bộ tệp JavaScript trong repository | Đạt: 15 tệp |
| CUS-01 | Chuẩn hóa email không phân biệt chữ hoa/thường; chuẩn hóa số `+84`, `0084` và `0` | Đạt trong Node VM |
| CUS-02 | Cùng email hợp lệ được gom; email lỗi không dùng làm định danh; cùng tên với email khác không bị gộp | Đạt trong Node VM |
| CUS-03 | Số điện thoại dùng chung nhiều email được cảnh báo; hồ sơ chỉ có số điện thoại được giữ riêng khi số đó mơ hồ | Đạt trong Node VM |
| CUS-04 | Đặt bàn chỉ có số điện thoại được gắn vào hồ sơ email duy nhất; thiếu cả email và số điện thoại thì từng đặt bàn giữ riêng | Đạt trong Node VM |
| CUS-05 | Chỉ lượt ghé gắn với đặt bàn đã xác nhận được cộng; lần ghé gần nhất lấy từ thời điểm ghi nhận | Đạt trong Node VM |
| CUS-06 | Chi tiết hiển thị ghi chú và đủ 5 cột lịch sử đặt bàn | Đạt trong Node VM |
| CUS-07 | Tìm hồ sơ theo tên, email không phân biệt chữ hoa/thường và số điện thoại đã chuẩn hóa; kết quả rỗng có thông báo | Đạt trong Node VM |
| VIS-01 | Nút xác nhận khách đến chỉ xuất hiện với đặt bàn Firestore đã xác nhận, chưa ghé; ghi thành công đổi trạng thái và ẩn nút; snapshot nạp lại giữ trạng thái đã ghé | Đạt trong Node VM |
| VIS-02 | Transaction tạo đúng một lượt ghé; thao tác lặp và snapshot cũ không ghi trùng; pending bị chặn cả ở giao diện và khi Firestore trả trạng thái khác | Đạt trong Node VM giả lập Firestore |
| VIS-03 | Khi đọc hoặc commit lượt ghé lỗi, không báo thành công/ẩn nút; log mã và đường dẫn an toàn; các nhóm lỗi có thông báo riêng | Đạt trong Node VM: commit `permission-denied` giữ nút và không thêm lượt; log không chứa token/mật khẩu |
| DEL-01 | Xóa Firestore đọc reservation và visit trong cùng transaction; nếu cần thì bổ sung snapshot định danh cho visit cũ; chỉ xóa booking sau transaction thành công | Đạt trong Node VM mock: lượt ghé và snapshot khách còn nguyên sau xóa; profile vẫn hiện khi reservation gốc không còn |
| HIST-02 | Lỗi listener lượt ghé ghi diagnostic và thông báo theo mã; snapshot rỗng vẫn là trạng thái hợp lệ không có lượt ghé | Đạt trong Node VM: permission denial và snapshot rỗng; Rules/Firebase thật cần kiểm thử tích hợp |
| BOOK-01 | Biểu mẫu từ chối tên bắt buộc trống, email sai, ngày quá khứ theo giờ Việt Nam, giờ ngoài danh sách, số khách thập phân hoặc trên 12 | Đạt trong Node VM với DOM mock |
| BOOK-02 | Ngày Việt Nam chuyển lúc 17:00 UTC; 16 giờ trong HTML khớp mã client và Firestore Rules; giới hạn khách 1–12 đồng bộ | Đạt bằng Node/Python |
| BOOK-03 | Gửi dữ liệu hợp lệ hai lần khi lần đầu đang chờ | Đạt trong DOM mock: chỉ có một batch Firestore đang chạy; nút gửi bị khóa tới khi phản hồi |
| BOOK-04 | Thử lại sau lỗi ghi và gửi lại một yêu cầu đã lưu bằng cùng UUID | Đạt trong Node VM: ID được giữ khi lỗi; marker xác nhận lượt đã lưu và không tạo tài liệu trùng |
| BOOK-05 | Firestore từ chối ghi | Đạt trong DOM mock: không hiện thành công, giữ nguyên dữ liệu biểu mẫu và báo kiểm tra Rules |
| HTML-01 | Parse `admin.html` và `index.html`, kiểm tra ID trùng và vị trí hồ sơ sau bảng đặt bàn | Đạt bằng Python `HTMLParser`; không phải validator HTML5 đầy đủ |
| GIT-01 | `git diff --check` | Đạt |

## Chưa thể kiểm thử tích hợp

| ID | Trường hợp cần kiểm tra | Trạng thái / bước thực hiện |
|---|---|---|
| UI-01 | Gửi biểu mẫu trong trình duyệt với dữ liệu hợp lệ, gửi thật lên Firestore và kiểm tra thông báo thành công/thất bại | Chưa chạy trình duyệt với Firebase thật; các nhánh validation đã được kiểm tra bằng DOM mock ở BOOK-01 |
| UI-02 | Gửi liên tiếp hai lần với Firestore thật khi yêu cầu đầu đang xử lý hoặc khi phản hồi commit bị mất | Chưa chạy Firebase thật; DOM mock ở BOOK-03/04 xác nhận batch đơn và đối chiếu marker idempotency |
| UI-03 | Tìm hồ sơ theo tên, email và số điện thoại; mở lịch sử ngày/giờ, ghi chú và trạng thái trên trình duyệt | Chưa chạy giao diện trong trình duyệt |
| UI-04 | Nhân viên xác nhận đã phục vụ; thao tác đồng thời từ hai tab/thiết bị không tăng số lượt | Chưa chạy với Firebase thật; Node VM chỉ mô phỏng lần ghi lặp tuần tự |
| SEC-01 | Khách ẩn danh không đọc reservations hoặc reservationVisits; admin được phép đọc và tạo lượt ghé | Chưa chạy Firebase Rules Emulator |
| SEC-02 | Tạo lượt ghé cho đặt bàn pending/cancelled/không tồn tại, timestamp không phải server timestamp; sửa/xóa lượt ghé hoặc hủy đặt bàn đã ghé | Chưa chạy Firebase Rules Emulator; các thao tác phải bị từ chối |
| SEC-03 | Xóa đặt bàn đã có lượt ghé và giữ nguyên visit; visit cũ thiếu snapshot chỉ được bổ sung trong transaction xóa; lượt ghé mới bắt buộc có snapshot khách hợp lệ | Chưa chạy Firebase Rules Emulator; Rules local cho phép xóa khi visit có snapshot hợp lệ, chỉ cho cập nhật snapshot legacy đồng thời với xóa booking, và từ chối xóa visit |
| SEC-04 | Tài khoản admin thực tế có email claim khớp `isAdmin()` và Rules `reservationVisits` đã triển khai đúng Firebase project | Chưa thể xác minh khi không có phiên đăng nhập hoặc quyền truy cập Firebase; Console diagnostic sẽ cho biết `permission-denied` nếu thao tác bị từ chối |
| HIST-01 | Đơn gọi món hoàn tất không tự tạo lượt ghé; dữ liệu cũ thiếu liên hệ/ngày; bản ghi lượt ghé cũ gắn với đặt bàn chưa xác nhận | Chưa chạy trên bộ dữ liệu Firebase; Node VM kiểm tra hồ sơ không gộp theo tên và không cộng lượt ghé cũ không đủ điều kiện |

`node --test` chạy bộ kiểm thử Node VM trong `tests/`; `functions/package.json` không khai báo script riêng. Firebase CLI 15.33.0 đã cài; chạy CLI với config mặc định vướng `EPERM` ở configstore, còn `--version` hoạt động khi đặt `XDG_CONFIG_HOME` riêng. Lần này không chạy Rules Emulator, không đăng nhập và không triển khai; vì vậy chưa biên dịch/kiểm tra `firestore.rules` trên Emulator hoặc xác minh Rules đang publish. Các kiểm tra DOM/Firestore giả lập không thay thế kiểm thử Rules Emulator, thao tác đồng thời thật hoặc kiểm thử trình duyệt. Thay đổi Rules trong workspace cần được triển khai riêng lên đúng project Firebase để có hiệu lực; chưa có lệnh triển khai nào được chạy.

## Gán số bàn

| ID | Trường hợp | Kết quả thực tế |
|---|---|---|
| TABLE-01 | Khách có thể chọn bàn mong muốn B01–B20; reservation mới lưu lựa chọn ở `requestedTableNumber`, giữ `tableNumber` trống và có trạng thái `pending`, `emailStatus: Pending` | Đạt trong Node VM |
| TABLE-02 | Batch tạo reservation và marker idempotency cùng lúc; marker không chứa thông tin khách | Đạt trong Node VM |
| TABLE-03 | Firestore từ chối ghi thì không hiện thành công, giữ nguyên biểu mẫu (kể cả bàn mong muốn) và giữ UUID để thử lại | Đạt trong DOM mock |
| TABLE-04 | Retry cùng nội dung dùng lại UUID; marker của lượt đã lưu ngăn tạo tài liệu thứ hai | Đạt trong Node VM |
| TABLE-05 | Commit báo lỗi sau khi server đã lưu chỉ được báo thành công khi đọc được marker | Đạt trong Node VM |
| TABLE-06 | Admin tiếp tục hiển thị bản ghi cũ có bàn và bản ghi chưa được gán bàn | Đạt trong Node VM |
| TABLE-07 | Gán bàn admin kiểm tra sức chứa và khung giờ 120 phút; revision theo ngày được tăng trong transaction | Kiểm tra helper trong Node VM; transaction Firebase thật chưa chạy |
| TABLE-08 | Rules giới hạn schema public, bắt buộc reservation/marker trong cùng batch, không cấp quyền đọc reservation cho khách | Kiểm tra cấu hình Rules; chưa biên dịch Rules Emulator |
| TABLE-09 | Đổi bàn mong muốn sau lần ghi thất bại tạo request ID/hash mới, không dùng nhầm idempotency marker cũ | Đạt trong Node VM |
| TABLE-10 | Để trống bàn mong muốn thì không ghi trường `requestedTableNumber` và không gán `tableNumber` | Đạt trong Node VM |

Các kiểm thử `tests/table-assignment.test.js` còn kiểm tra bộ phân bổ callable cũ trong `functions/`; website hiện không tải SDK hoặc gọi đường đi này.

Lần kiểm tra hiện tại: `node --test` đạt 57/57; `node --check` đạt cho 15 tệp JavaScript; `git diff --check` đạt. Chưa chạy Firebase Emulator hoặc Firebase thật. Cần kiểm tra Rules Emulator và thử ghi/gán bàn trên project sau khi chủ dự án rà soát và tự publish Rules.
