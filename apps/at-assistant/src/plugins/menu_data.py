from __future__ import annotations

from typing import Dict, Any

MENU: Dict[str, Dict[str, Any]] = {
    "1": {
        "title": "File / thư mục",
        "desc": "Tìm, mở, xóa, sao chép và di chuyển file hoặc thư mục trong vùng an toàn.",
        "steps": [
            "Bước 1: Nhập tên file hoặc thư mục bạn muốn thao tác.",
            "Bước 2: Nếu có nhiều kết quả, chatbot sẽ hiện danh sách để bạn chọn số.",
            "Bước 3: Sau khi chọn, hệ thống sẽ thực hiện lệnh bạn yêu cầu.",
        ],
        "examples": [
            "tìm file report",
            "mở file abc.txt",
            "xóa file test.txt",
            "copy file report.txt vào Documents",
            "move thư mục ảnh vào Downloads",
        ],
    },
    "2": {
        "title": "Ứng dụng",
        "desc": "Mở ứng dụng hoặc đóng ứng dụng đang chạy.",
        "steps": [
            "Bước 1: Nhập tên ứng dụng muốn mở hoặc đóng.",
            "Bước 2: Nếu tên chưa khớp chính xác, chatbot có thể gợi ý danh sách gần đúng.",
            "Bước 3: Chọn số hoặc xác nhận nếu là thao tác đóng ứng dụng.",
        ],
        "examples": [
            "mở chrome",
            "mở vscode",
            "đóng notepad",
            "đóng tất cả chrome",
            "ra ngoài",
            "về nhà",
            "tập trung",
            "đóng app nặng",
            "đóng tất cả trừ chrome và vscode",
        ],
    },
    "3": {
        "title": "Web và YouTube",
        "desc": "Tìm kiếm web bằng trình duyệt hoặc mở video trên YouTube.",
        "steps": [
            "Bước 1: Nhập nội dung bạn muốn tìm.",
            "Bước 2: Nếu là câu hỏi chung, hệ thống sẽ mở tìm kiếm web.",
            "Bước 3: Nếu là nội dung YouTube, hệ thống sẽ mở kết quả phù hợp.",
        ],
        "examples": [
            "Python là gì",
            "tra cứu cách dùng pandas",
            "mở nhạc lofi trên youtube",
            "play shape of you youtube",
        ],
    },
    "4": {
        "title": "Email",
        "desc": "Đăng nhập Gmail, xem email, đọc email, gửi, trả lời, ẩn hoặc bỏ ẩn email.",
        "steps": [
            "Bước 1: Đăng nhập Gmail nếu chưa đăng nhập.",
            "Bước 2: Nhập lệnh xem, đọc, gửi hoặc trả lời email.",
            "Bước 3: Với thao tác gửi hoặc trả lời, hệ thống sẽ hỏi thêm hoặc yêu cầu xác nhận trước khi gửi.",
        ],
        "examples": [
            "đăng nhập email",
            "email chưa đọc hôm nay",
            "đọc email số 1",
            "gửi email cho a@gmail.com tiêu đề Họp nội dung Chúng ta họp lúc 9h",
            "trả lời email số 1 rằng Tôi đã nhận được",
            "ẩn email abc@gmail.com",
            "bỏ ẩn email abc@gmail.com",
        ],
    },
    "5": {
        "title": "Email hàng loạt từ Excel",
        "desc": "Gửi nhiều email từ file Excel, có xem trước và xác nhận trước khi gửi.",
        "steps": [
            "Bước 1: Chuẩn bị file Excel .xlsx đúng format hệ thống hỗ trợ.",
            "Bước 2: Nhập lệnh gửi email theo file Excel.",
            "Bước 3: Chọn địa chỉ Gmail gửi nếu có nhiều địa chỉ.",
            "Bước 4: Xem trước toàn bộ email, rồi xác nhận gửi thật.",
        ],
        "examples": [
            'gửi email theo file "DanhSachUngVien.xlsx"',
        ],
    },
    "6": {
        "title": "Google Drive",
        "desc": "Kết nối Drive, chọn tài khoản, upload, tìm file, lấy link và tải file về máy.",
        "steps": [
            "Bước 1: Kết nối Google Drive nếu chưa kết nối.",
            "Bước 2: Nhập lệnh upload, tìm file, lấy link hoặc tải file.",
            "Bước 3: Nếu có nhiều tài khoản hoặc nhiều kết quả, chatbot sẽ yêu cầu bạn chọn.",
        ],
        "examples": [
            "kết nối google drive",
            "danh sách tài khoản google drive",
            "chọn tài khoản drive abc@gmail.com",
            "upload file report.docx lên google drive",
            "tìm file hợp đồng trên google drive",
            "lấy link file proposal trên google drive",
            "tải file proposal từ google drive về downloads",
        ],
    },
    "7": {
        "title": "Reminder / nhắc việc",
        "desc": "Tạo, xem, sửa, xóa, hoàn thành và nhắc lại reminder.",
        "steps": [
            "Bước 1: Nhập câu lệnh nhắc việc tự nhiên.",
            "Bước 2: Hệ thống sẽ nhận nội dung và thời gian cần nhắc.",
            "Bước 3: Bạn có thể xem danh sách, sửa, xóa, hoàn thành hoặc nhắc lại reminder.",
        ],
        "examples": [
            "nhắc tôi họp nhóm lúc 9h sáng mai",
            "xem reminder",
            "hoàn thành reminder 1",
            "xóa reminder 1",
            "sửa reminder 1 thành họp với khách lúc 10h sáng mai",
            "nhắc lại reminder 1 sau 15 phút",
        ],
    },
    "8": {
        "title": "Giọng nói",
        "desc": "Điều khiển bằng giọng nói trong GUI hoặc CLI khi gói offline đã sẵn sàng.",
        "steps": [
            "Bước 1: Mở GUI hoặc CLI.",
            "Bước 2: Trong GUI bấm mic, hoặc trong CLI gõ /voice.",
            "Bước 3: Nói lệnh ngắn như khi nhập text để hệ thống xử lý.",
        ],
        "examples": [
            "Trong CLI: /voice",
        ],
    },
    "9": {
        "title": "Nguồn máy / ngủ đêm",
        "desc": "Tắt máy, hẹn giờ tắt/mở app/web, hủy lịch, khóa máy, dùng chế độ ngủ đêm hoặc ngủ quên.",
        "steps": [
            "Bước 1: Nhập thời gian theo kiểu sau bao lâu hoặc vào giờ cụ thể.",
            "Bước 2: Với thao tác tắt máy, khởi động lại, ngủ đêm, đóng/mở app/web hoặc ngủ quên, hệ thống sẽ hỏi xác nhận trước.",
            "Bước 3: Có thể thêm hàng ngày hoặc cảnh báo trước 15 phút. Cảnh báo chỉ thông báo, không tự làm gì.",
            "Bước 4: Nếu đổi ý, nhập lệnh hủy hẹn giờ tắt máy, hủy hẹn đóng/mở app hoặc tắt chế độ ngủ quên.",
        ],
        "examples": [
            "tắt máy sau 30 phút",
            "tắt máy lúc 23h30",
            "ngủ đêm 2 tiếng",
            "hủy hẹn giờ tắt máy",
            "xem lịch tắt máy",
            "đóng chrome sau 30 phút",
            "tắt web lúc 23h30",
            "hủy hẹn đóng app",
            "tắt máy lúc 23h30 hàng ngày cảnh báo trước 15 phút",
            "đóng chrome lúc 23h30 hàng ngày cảnh báo trước 10 phút",
            "mở chrome lúc 8h hàng ngày",
            "hủy hẹn mở app",
            "bật chế độ ngủ quên sau 45 phút từ 23 đến 6",
            "trạng thái chế độ ngủ quên",
            "tắt chế độ ngủ quên",
        ],
    },
}


# =========================
# MENU CHÍNH
# =========================
def build_main_menu_message() -> str:
    lines = ["MENU CHỨC NĂNG", ""]

    for key, item in MENU.items():
        lines.append(f"[{key}] {item['title']}")
        lines.append(f"- {item['desc']}")
        lines.append("")

    lines.append("Chọn số để xem chi tiết.")
    lines.append("Ví dụ: 1")
    lines.append("Hoặc nhập: menu 1")

    return "\n".join(lines)


# =========================
# MENU CHI TIẾT
# =========================
def build_menu_item_message(key: str) -> str:
    item = MENU[key]

    lines = [
        f"[{key}] {item['title']}",
        "",
        f"Mô tả: {item['desc']}",
        "",
        "Các bước thực hiện:",
    ]

    # giữ nguyên "Bước 1"
    for step in item.get("steps", []):
        lines.append(step)

    # examples
    examples = item.get("examples", [])
    if examples:
        lines.append("")
        lines.append("Ví dụ:")
        for ex in examples:
            lines.append(f"- {ex}")

    lines.append("")
    lines.append("↩ Nhập menu để quay lại menu chính.")

    return "\n".join(lines)
