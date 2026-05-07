# Chat Session History

Tai lieu nay tom tat phan lich su hoi thoai dang duoc them cho ATAssistant theo kieu session chat.

## Muc tieu

- luu moi doan hoi thoai thanh mot session rieng
- hien danh sach chat cu de mo lai
- cho phep GUI bam vao chat cu de xem noi dung da luu
- cho phep CLI list va mo lai chat cu
- khi mo lai session cu, engine nap lai text history de co the tiep tuc hoi thoai

## Luu tru

Du lieu duoc luu cuc bo trong:

- `app_settings/chat_sessions/<session_id>.json`

Moi session chua:

- `session_id`
- `title`
- `preview`
- `created_at`
- `updated_at`
- `message_count`
- `messages`

## GUI

- them sidebar `Lịch sử chat`
- them nut `Cuộc trò chuyện mới`
- bam vao session cu se load transcript vao khung chat hien tai
- menu tac vu o input da doi thanh `Xem lịch sử chat`

## CLI

Them cac lenh:

- `/new`
- `/history`
- `/open <id|stt>`

## File chinh

- `src/plugins/chat_session_service.py`
- `src/gui/chat_history_panel.py`
- `src/gui/chat_frame.py`
- `src/gui/main_gui.py`
- `src/cli/main_cli.py`
- `tests/test_chat_sessions.py`
