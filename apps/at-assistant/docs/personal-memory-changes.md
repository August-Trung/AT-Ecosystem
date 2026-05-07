# Personal Memory Changes

Tai lieu nay tom tat cac thay doi vua duoc them de ho tro bo nho ca nhan cuc bo cho ATAssistant.

## Muc tieu

Them lop memory local bang JSON de ATAssistant bat dau dich chuyen tu mot bo parser lenh sang tro ly ca nhan co preference va history co the quan ly duoc.

Phan nay khong dung backend hay database.
Moi du lieu duoc luu cuc bo trong `app_settings/personal_memory.json`.

## Cac thay doi chinh

### 1. Them PersonalMemoryService

File moi:

- `src/plugins/personal_memory_service.py`

Service nay phu trach:

- tao va doc file `app_settings/personal_memory.json`
- luu preference
- luu ho so nguoi dung
- luu recent actions
- luu history cua cac thay doi memory
- xoa key memory theo ten
- clear history

## Cau truc JSON hien tai

```json
{
  "schema_version": 2,
  "profile": {
    "name": "",
    "timezone": "Asia/Ho_Chi_Minh",
    "job": "",
    "frequent_folders": [],
    "preferred_apps": [],
    "favorite_prompt_style": ""
  },
  "preferences": {
    "gmail_default_account": "",
    "favorite_report_folder": "",
    "open_file_app": ""
  },
  "entities": {},
  "pinned_knowledge": [],
  "recent_actions": [],
  "history": [],
  "updated_at": "..."
}
```

## Cac lenh moi da ho tro

### Xem memory

```text
xem memory
```

### Luu preference va ho so nguoi dung

```text
gmail mặc định là abc@gmail.com
folder báo cáo yêu thích là Documents/BaoCao
tên tôi là Khoa
múi giờ của tôi là Asia/Ho_Chi_Minh
công việc của tôi là tuyển dụng
thư mục hay dùng là Desktop, Documents
app hay dùng là chrome, vscode
mẫu câu ưa thích là ngắn gọn
mở file bằng VS Code
lưu báo cáo vào D:/Reports
```

### Entity memory

```text
nhớ anh Nam là nam@example.com
nhớ team marketing là marketing@company.com
nhớ folder báo cáo là D:/Reports
xem entity
xóa entity anh Nam
```

### Pinned knowledge

```text
ghim deadline demo: Demo vào thứ 6
ghim note sếp thích báo cáo PDF: luôn xuất file PDF trước khi gửi
xem ghi chú ghim
xóa ghi chú ghim deadline demo
```

### Xoa memory theo key

```text
xóa memory gmail_default_account
```

### Xoa toan bo history

```text
clear history
```

Lenh nay di qua buoc xac nhan `yes/no`.

## Tich hop vao router

File sua:

- `src/core/router.py`

Da them cac route moi:

- `SET_MEMORY`
- `VIEW_MEMORY`
- `DELETE_MEMORY_KEY`
- `CLEAR_MEMORY_HISTORY`

Router uu tien bat cac lenh memory nay truoc cac heuristic khac.

## Tich hop vao engine

File sua:

- `src/core/engine.py`

Da them:

- xu ly route memory moi
- xac nhan truoc khi `clear history`
- support execute tool cho memory trong `_execute_tool`
- auto ghi `recent_actions` cho cac action thanh cong

`recent_actions` khong ghi lai cac lenh quan ly memory de tranh history tu tham chieu.

Ngoai ra Engine da bat dau dung recent context de hieu mot so cau tham chieu ngan:

- `mở lại file lúc nãy`
- `gửi email cho người đó ...`

## Tich hop vao executor

File sua:

- `src/core/executor.py`

Da them cac ham:

- `_handle_set_memory`
- `_handle_view_memory`
- `_handle_delete_memory_key`
- `_handle_clear_memory_history`
- `_record_personal_recent_action`

Ngoai ra da noi `gmail_default_account` vao luong gui email:

- `_handle_send_email`
- `_handle_send_bulk_email`

Neu tai khoan Gmail mac dinh trong memory khong dung duoc, he thong fallback ve `GmailService()` mac dinh de tranh vo luong gui mail.

## Test da them

File moi:

- `tests/test_personal_memory.py`

Test bao gom:

- service set/delete/clear
- route cho memory commands
- engine flow cho set/view/delete/clear history

## Gioi han hien tai

- Chua mo rong memory thanh co che suy luan ca nhan hoa sau trong toan bo workflow.
- Chua tu dong dung `favorite_report_folder` de sua hanh vi tim file hay upload Drive.
- Chua co GUI rieng de chinh sua memory.
- Chua chay duoc `pytest` trong moi truong hien tai vi thieu `pytest`; moi kiem tra cu phap bang `python3 -m py_compile`.

## File lien quan

- `src/plugins/personal_memory_service.py`
- `src/core/router.py`
- `src/core/engine.py`
- `src/core/executor.py`
- `src/core/schema.py`
- `tests/test_personal_memory.py`
