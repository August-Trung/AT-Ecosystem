# AT Assistant

AT Assistant là trợ lý chạy trên máy Windows. Bạn có thể gõ tiếng Việt để nhờ app mở ứng dụng, tìm file, đọc Gmail, nhắc việc, chạy việc lặp lại, hoặc điều khiển máy từ xa qua Telegram.

App được thiết kế để dùng hằng ngày, không cần nhớ nhiều thao tác phức tạp. Bạn chỉ cần nói hoặc gõ điều mình muốn làm.

## App Có Thể Làm Gì?

- Mở ứng dụng như Notepad, Edge, Zalo, VS Code.
- Đóng một cửa sổ đang mở, hoặc đóng toàn bộ một ứng dụng khi bạn xác nhận.
- Xem máy đang mở những gì.
- Chuyển sang một ứng dụng hoặc một cửa sổ cụ thể.
- Tìm, mở, sao chép, di chuyển hoặc xóa file trong các thư mục được cho phép.
- Tìm kiếm web và mở YouTube.
- Điều khiển tab trình duyệt như chuyển tab, tải lại trang, đóng tab.
- Điều khiển nhạc/video trên web: phát, dừng, chuyển bài, lùi bài, tăng giảm âm lượng.
- Nhập chữ vào ô đang được chọn trên màn hình.
- Chụp màn hình để kiểm tra máy đang hiển thị gì.
- Đọc Gmail, gửi email và gửi email hàng loạt từ file Excel.
- Kết nối Google Drive để tìm, tải lên, tải xuống hoặc lấy link file.
- Tạo nhắc việc và hiện thông báo khi đến giờ.
- Tạo workflow để app tự chạy nhiều bước theo lịch.
- Hẹn giờ tắt máy, tắt máy vào giờ cụ thể, hủy lịch tắt máy hoặc bật chế độ ngủ đêm.
- Hẹn giờ đóng ứng dụng, đóng web/browser hoặc tab hiện tại khi app còn chạy nền.
- Hẹn giờ mở ứng dụng hoặc trang web, có thể lặp hằng ngày.
- Dùng preset nhanh như đi ngủ, ra ngoài, về máy, tập trung.
- Copy clipboard qua lại giữa điện thoại Telegram và máy tính.
- Gửi file vào Telegram để máy tự lưu vào Downloads.
- Đóng app nặng, đóng web giải trí hoặc đóng tất cả trừ app cần giữ.
- Bật chế độ ngủ quên: nếu máy idle trong khung giờ ngủ, app cảnh báo rồi xử lý theo cấu hình.
- Có thể lặp lịch hằng ngày và cảnh báo trước giờ thực hiện. Mặc định app cảnh báo trước 15 phút nếu lịch đủ dài.
- Điều khiển từ xa bằng Telegram khi app đang chạy hoặc đang nằm dưới khay hệ thống.

## Cách Dùng Cơ Bản

Mở AT Assistant, sau đó gõ yêu cầu vào ô chat.

Ví dụ:

- mở notepad
- tắt cửa sổ này
- máy đang mở gì
- chụp màn hình
- tìm file báo cáo
- nhắc tôi họp lúc 9 giờ sáng mai
- mở youtube nhạc thư giãn
- tắt máy sau 30 phút
- ngủ đêm 2 tiếng
- đóng chrome sau 30 phút
- tắt web lúc 23h30
- tắt máy lúc 23h30 hàng ngày cảnh báo trước 15 phút
- đóng chrome lúc 23h30 hàng ngày cảnh báo trước 10 phút
- mở chrome lúc 8h hàng ngày
- ra ngoài
- về nhà
- tập trung
- copy vào máy nội dung cần dán
- gửi clipboard
- đóng app nặng
- đóng tất cả trừ chrome và vscode
- bật chế độ ngủ quên sau 45 phút từ 23 đến 6

Khi thao tác có rủi ro như tắt ứng dụng, xóa file hoặc tắt máy, app sẽ hỏi lại trước khi làm.
Với hẹn giờ tắt máy, app hỏi xác nhận ngay lúc đặt lịch; khi tới giờ Windows sẽ tự tắt và không hỏi lại.
Với hẹn giờ đóng/mở app/web, chế độ ngủ quên hoặc lịch lặp hàng ngày, AT Assistant cần còn đang chạy nền tới thời điểm đó. Cảnh báo trước giờ chỉ hiện thông báo, không tự xác nhận và không tự thay đổi lịch.

## Dùng Khi App Ẩn Xuống Khay

Nếu AT Assistant đang ở chế độ tray, app vẫn tiếp tục chạy nền. Bạn vẫn có thể gửi lệnh từ Telegram nếu Telegram Bot Bridge đang bật và đã cài đúng thông tin.

## Cài Đặt Quan Trọng

Bạn nên mở phần cài đặt trong app và kiểm tra các mục sau:

- Tên hiển thị: tên app dùng khi trò chuyện với bạn.
- Giọng nói offline: bật nếu muốn nói chuyện bằng giọng nói.
- Gmail: đăng nhập tài khoản Gmail nếu muốn đọc hoặc gửi email.
- Google Drive: đăng nhập nếu muốn dùng file trên Drive.
- Telegram Bot: nhập thông tin bot để điều khiển máy từ điện thoại.
- Khởi động cùng Windows: bật nếu muốn app tự chạy khi mở máy.
- Thư mục an toàn: chọn các thư mục mà app được phép thao tác file.

## Telegram Bot Bridge

Telegram Bot Bridge giúp bạn điều khiển AT Assistant từ điện thoại. Bạn có thể dùng trong chat riêng với bot hoặc trong group Telegram.

### Cần Chuẩn Bị

- Một bot Telegram.
- Mã token của bot.
- Mã user_id Telegram của bạn.
- Mã chat_id hoặc group_id nơi bạn muốn dùng bot.

user_id là mã số tài khoản Telegram của bạn. Nó không phải username.

chat_id hoặc group_id là mã số của cuộc trò chuyện hoặc group Telegram.

Command prefix là chữ mở đầu để bot biết tin nhắn nào là lệnh cho AT Assistant. Mặc định là `/at`.

Ví dụ khi prefix là `/at`, bạn gửi:

- /at máy đang mở gì
- /at mở notepad
- /at chụp màn hình

### Cách Tạo Bot

1. Mở Telegram và tìm BotFather.
2. Tạo bot mới.
3. BotFather sẽ gửi cho bạn token.
4. Không gửi token này cho người khác.

### Cách Lấy user_id Và group_id

Trong app, mở phần cài đặt Telegram và dùng chức năng kiểm tra/kết nối nếu có.

Nếu cần lấy thủ công, bạn có thể nhắn thử cho bot hoặc thêm bot vào group, sau đó xem thông tin cập nhật trong phần cài đặt hoặc log của app.

Người dùng thông thường chỉ cần nhớ:

- user_id là mã của người được phép điều khiển.
- group_id là mã của group được phép gửi lệnh.
- Nếu nhập sai một trong hai mã này, bot sẽ không nhận lệnh.

### Cài Trong App

Mở cài đặt Telegram trong AT Assistant, sau đó nhập:

- Tên bot để dễ nhận biết.
- Token bot.
- user_id được phép dùng.
- group_id hoặc chat_id được phép dùng.
- Command prefix, thường giữ mặc định là `/at`.

Sau khi lưu, bấm kiểm tra kết nối. Nếu thành công, app sẽ báo trong khung chat và bot cũng gửi tin nhắn test vào Telegram.

### Cách Dùng Qua Telegram

Gửi tin nhắn bắt đầu bằng `/at`.

Ví dụ:

- /at máy đang mở gì
- /at tắt máy
- /at sleep
- /at đi ngủ
- /at ra ngoài
- /at về nhà
- /at tập trung
- /at mở chrome lúc 8h hàng ngày
- /at đóng app nặng
- /at đóng web giải trí
- /at copy vào máy đoạn text này
- /at gửi clipboard
- Gửi file trực tiếp cho bot để máy lưu vào Downloads.
- /at mở youtube nhạc nhẹ
- /at dừng nhạc
- /at tab edge đang mở
- /at nhập chữ xin chào mọi người

Khi app cần xác nhận hoặc cần bạn chọn một mục, Telegram sẽ hiện nút bấm. Với lệnh tắt máy, Telegram cũng hiện các nút nhanh như Sau 30p, Sau 1h, 23:30, Hằng ngày 23:30 và Hủy lịch.

## Một Số Lưu Ý Khi Điều Khiển Từ Xa

- Chỉ user_id và chat_id đã cho phép mới dùng được bot.
- Nếu danh sách cho phép đang trống, bot sẽ không mở public.
- Không đưa token bot lên mạng hoặc gửi cho người khác.
- Tắt cửa sổ chỉ đóng đúng cửa sổ bạn chọn nếu Windows cho phép.
- Đóng toàn bộ ứng dụng có thể đóng mọi cửa sổ thuộc ứng dụng đó.
- Các thao tác nguy hiểm sẽ hỏi xác nhận trước.
- Muốn điều khiển đúng từng tab Edge hoặc Chrome, nên mở trình duyệt bằng chế độ điều khiển từ xa trong app trước.

## Gmail Và Google Drive

Bạn đăng nhập Gmail hoặc Google Drive trong phần cài đặt của app.

Sau khi đăng nhập, bạn có thể yêu cầu app:

- đọc email mới
- tìm email
- gửi email
- gửi email hàng loạt
- tìm file trên Drive
- tải file lên Drive
- lấy link chia sẻ

Với gửi email hàng loạt, app sẽ cho xem trước trước khi gửi thật.

## Nhắc Việc

Bạn có thể gõ tự nhiên:

- nhắc tôi uống thuốc lúc 8 giờ tối
- nhắc tôi họp với khách sáng mai
- xem nhắc việc
- xóa nhắc việc số 1

Khi đến giờ, app sẽ hiện thông báo để bạn hoàn thành hoặc nhắc lại sau.

## Workflow

Workflow là danh sách nhiều việc app sẽ làm theo thứ tự.

Ví dụ:

- mở Edge
- mở một trang web
- chờ vài giây
- mở file báo cáo

Bạn có thể tạo workflow trong app, đặt lịch chạy, hoặc chạy thủ công khi cần.

## Khi Có Vấn Đề

Nếu Telegram không phản hồi:

- Kiểm tra AT Assistant còn đang chạy không.
- Kiểm tra bot token đã đúng chưa.
- Kiểm tra user_id và group_id đã đúng chưa.
- Kiểm tra bot đã được thêm vào group chưa.
- Kiểm tra tin nhắn có bắt đầu bằng `/at` không.

Nếu tiếng Việt hiển thị sai:

- Đảm bảo đang dùng bản app mới.
- Đảm bảo hệ thống và trình nhắn tin hỗ trợ tiếng Việt Unicode.

Nếu không thấy đúng danh sách tab trình duyệt:

- Mở Edge hoặc Chrome bằng chế độ điều khiển từ xa trong app.
- Sau đó thử lại lệnh xem tab.

Nếu Gmail hoặc Drive không chạy:

- Mở cài đặt.
- Đăng nhập lại tài khoản.
- Kiểm tra đúng tài khoản đang dùng.

## Dữ Liệu Của App

Cài đặt và dữ liệu cá nhân của app được lưu trên máy của bạn. Không chia sẻ thư mục cài đặt hoặc token bot cho người khác nếu bạn không muốn họ điều khiển máy.

## Dành Cho Người Cài Từ Mã Nguồn

Người dùng thông thường nên dùng bản app đã đóng gói.

Nếu bạn tự chạy từ mã nguồn, hãy cài các thư viện cần thiết rồi mở giao diện chính của app. Phần này dành cho người biết dùng Python.
