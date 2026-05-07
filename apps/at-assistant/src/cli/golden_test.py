"""
Golden Test Suite – AT Assistant
Kịch bản kiểm thử toàn diện: Rule-based → LLM Intent Dispatcher

Chạy:
    python -m src.cli.golden_test
    python -m src.cli.golden_test --group LLM
    python -m src.cli.golden_test --id T05
"""
from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path
from typing import Any, Optional

# Buộc stdout dùng UTF-8 để hiển thị Unicode đúng trên mọi terminal Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from src.core.engine import Engine
from src.core.executor import SAFE_DIRS
from src.core.result import ActionStatus

# ─────────────────────────────────────────────────────────────────────────────
# Terminal colors (Windows cmd + bash đều dùng được)
# ─────────────────────────────────────────────────────────────────────────────
os.system("")  # kích hoạt ANSI trên Windows cmd
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
DIM    = "\033[2m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

# ─────────────────────────────────────────────────────────────────────────────
# Fixture helpers (tạo / dọn file tạm trên Desktop để test)
# ─────────────────────────────────────────────────────────────────────────────
def _find_desktop() -> Path:
    """Lấy Desktop thực tế từ SAFE_DIRS (hỗ trợ OneDrive Desktop)."""
    for d in SAFE_DIRS:
        p = Path(d)
        if p.name.lower() in {"desktop", "máy tính"}:
            return p
    return Path.home() / "Desktop"  # fallback


def _find_safe_dir(*names: str) -> Path:
    wanted = {n.lower() for n in names}
    for d in SAFE_DIRS:
        p = Path(d)
        if p.name.lower() in wanted:
            return p
    return Path.home()


_FIXTURE_DIR = _find_desktop()
_DOCUMENTS_DIR = _find_safe_dir("documents")
_DOWNLOADS_DIR = _find_safe_dir("downloads")


def _fixture_path(name: str) -> Path:
    return _FIXTURE_DIR / name


def _create_fixtures(names: list[str]) -> list[str]:
    """Tạo file/folder fixture, trả về list tên đã tạo thành công."""
    created: list[str] = []
    for n in names:
        try:
            p = _fixture_path(n)
            if n.endswith("/"):  # là thư mục
                p = _fixture_path(n.rstrip("/"))
                p.mkdir(exist_ok=True)
            else:
                p.write_text(f"AT Assistant test fixture: {n}", encoding="utf-8")
            created.append(n)
        except Exception as e:
            print(f"        {YELLOW}⚠ Không thể tạo fixture '{n}': {e}{RESET}")
    return created


def _cleanup_fixtures(names: list[str]) -> None:
    for n in names:
        raw = n.rstrip("/")
        p = _fixture_path(raw)
        try:
            if p.is_dir():
                import shutil
                shutil.rmtree(p, ignore_errors=True)
            elif p.exists():
                p.unlink()
        except Exception:
            pass


def _cleanup_paths(paths: list[str]) -> None:
    for raw in paths:
        p = Path(raw)
        try:
            if p.is_dir():
                import shutil
                shutil.rmtree(p, ignore_errors=True)
            elif p.exists():
                p.unlink()
        except Exception:
            pass


# ─────────────────────────────────────────────────────────────────────────────
# Test cases
#
# Mỗi case:
#   id           – mã định danh (T01, T02, ...)
#   group        – nhóm: APP / FILE / WEB / YOUTUBE / LLM / SAFETY / STATE
#   desc         – mô tả kịch bản
#   turns        – list câu lệnh user (multi-turn = state machine)
#   expect       – list ActionStatus tương ứng mỗi turn
#                  Nếu một turn có thể nhiều kết quả hợp lệ → dùng list[list]
#   route        – nhãn luồng xử lý (chỉ để tài liệu)
#   fixtures     – file tạm cần tạo trước khi chạy (sẽ được dọn sau)
# ─────────────────────────────────────────────────────────────────────────────
CASES: list[dict[str, Any]] = [

    # ══════════════════════════════════════════════════════════════════════
    # GROUP APP – Mở / Đóng ứng dụng
    # ══════════════════════════════════════════════════════════════════════
    {
        "id": "T01", "group": "APP",
        "desc": "Mở notepad (từ khóa rõ ràng)",
        "turns": ["mở notepad"],
        "expect": [ActionStatus.SUCCESS],
        "route": "RULE → open_app(notepad)",
    },
    {
        "id": "T02", "group": "APP",
        "desc": "Mở notepad qua alias 'note' (aliases.json)",
        "turns": ["mở note"],
        "expect": [ActionStatus.SUCCESS],
        "route": "RULE → open_app (alias: note → notepad)",
    },
    {
        "id": "T03", "group": "APP",
        "desc": "Mở calculator qua alias 'máy tính'",
        "turns": ["mở máy tính"],
        "expect": [ActionStatus.SUCCESS],
        "route": "RULE → open_app (alias: máy tính → calculator)",
    },
    {
        "id": "T03A", "group": "APP",
        "desc": "Mở Word bằng app alias rõ ràng",
        "turns": ["mở word"],
        "expect": [[ActionStatus.SUCCESS, ActionStatus.ERROR]],
        "route": "RULE → open_app(word)",
    },
    {
        "id": "T03B", "group": "APP",
        "desc": "Mở VS Code bằng alias voice-like 'v s code'",
        "turns": ["mở v s code"],
        "expect": [[ActionStatus.SUCCESS, ActionStatus.ERROR]],
        "route": "RULE → open_app(vscode)",
    },
    {
        "id": "T04", "group": "APP",
        "desc": "Mở ứng dụng không tồn tại → APP_NOT_FOUND hoặc ask_clarify",
        "turns": ["mở xyzapp_khong_ton_tai_999"],
        "expect": [[ActionStatus.ERROR, ActionStatus.NEED_CLARIFY]],
        "route": "RULE → open_app → APP_NOT_FOUND  |  FALLBACK_TO_LLM → ask_clarify (nếu không có API key)",
    },
    {
        "id": "T04A", "group": "APP",
        "desc": "Mở app không tồn tại với tiền tố 'app' phải vào open_app",
        "turns": ["mở app tiktok"],
        "expect": [ActionStatus.ERROR],
        "route": "RULE → open_app('tiktok') → APP_NOT_FOUND",
    },
    {
        "id": "T05", "group": "APP",
        "desc": "Đóng calculator → xác nhận yes",
        "turns": ["tắt calculator", "yes"],
        "expect": [ActionStatus.NEED_CONFIRM, [ActionStatus.SUCCESS, ActionStatus.ERROR]],
        "route": "RULE → close_app → NEED_CONFIRM → execute (SUCCESS nếu đang chạy, ERROR nếu không)",
    },
    {
        "id": "T06", "group": "APP",
        "desc": "Đóng notepad → xác nhận no (hủy bỏ)",
        "turns": ["đóng notepad", "no"],
        "expect": [ActionStatus.NEED_CONFIRM, ActionStatus.SUCCESS],
        "route": "RULE → close_app → NEED_CONFIRM → cancel",
    },
    {
        "id": "T07", "group": "APP",
        "desc": "Đóng tất cả notepad đang chạy → confirm yes",
        "turns": ["tắt tất cả notepad", "yes"],
        "expect": [ActionStatus.NEED_CONFIRM, ActionStatus.SUCCESS],
        "route": "RULE → close_app(close_all=True) → NEED_CONFIRM → execute",
    },

    # ══════════════════════════════════════════════════════════════════════
    # GROUP FILE – Tìm file
    # ══════════════════════════════════════════════════════════════════════
    {
        "id": "T08", "group": "FILE",
        "desc": "Tìm file theo tên chính xác → 1 kết quả",
        "turns": ["tìm file at_test_find.txt"],
        "expect": [ActionStatus.SUCCESS],
        "route": "RULE → find_file (exact match)",
        "fixtures": ["at_test_find.txt"],
    },
    {
        "id": "T09", "group": "FILE",
        "desc": "Tìm file không tồn tại → trả message 'Không tìm thấy file'",
        "turns": ["tìm file xyz_khong_ton_tai_forever_abc.docx"],
        "expect": [ActionStatus.ERROR],
        "route": "RULE → find_file → FILE_NOT_FOUND",
    },
    {
        "id": "T10", "group": "FILE",
        "desc": "Tìm file lọc theo đuôi pdf → tìm thấy 1 kết quả",
        "turns": ["tìm at_test_find.pdf"],
        "expect": [ActionStatus.SUCCESS],
        "route": "RULE → find_file (extensions=[pdf])",
        "fixtures": ["at_test_find.pdf"],
    },
    {
        "id": "T11", "group": "FILE",
        "desc": "Tìm thư mục (folder) theo tên → tìm thấy folder trên Desktop",
        "turns": ["tìm thư mục at_test_folder"],
        "expect": [ActionStatus.SUCCESS],
        "route": "RULE → find_file (include_dirs=True)",
        "fixtures": ["at_test_folder/"],
    },

    # ══════════════════════════════════════════════════════════════════════
    # GROUP FILE – Mở file
    # ══════════════════════════════════════════════════════════════════════
    {
        "id": "T12", "group": "FILE",
        "desc": "Mở file theo tên → find rồi auto-open (1 kết quả)",
        "turns": ["mở file at_test_open.txt"],
        "expect": [ActionStatus.SUCCESS],
        "route": "RULE → find_file → auto open_file (len==1)",
        "fixtures": ["at_test_open.txt"],
    },
    {
        "id": "T12A", "group": "FILE",
        "desc": "Mở file Excel bằng mẫu lệnh tự nhiên 'mở excel ...'",
        "turns": ["mở excel báo cáo tháng 3"],
        "expect": [ActionStatus.SUCCESS],
        "route": "RULE → open file by app prefix → find_file(xlsx/csv/xls) → open_file",
        "fixtures": ["báo cáo tháng 3.xlsx"],
    },
    {
        "id": "T13", "group": "FILE",
        "desc": "Mở file bằng path đầy đủ hợp lệ",
        "turns": [str(_FIXTURE_DIR / "at_test_open.txt")],
        "expect": [ActionStatus.SUCCESS],
        "route": "RULE → open_file (direct path)",
        "fixtures": ["at_test_open.txt"],
    },
    {
        "id": "T14", "group": "FILE",
        "desc": "Mở file ngoài safe dirs → NOT_ALLOWED",
        "turns": [r"mở C:\Windows\System32\cmd.exe"],
        "expect": [ActionStatus.ERROR],
        "route": "RULE → open_file → NOT_ALLOWED",
    },

    # ══════════════════════════════════════════════════════════════════════
    # GROUP FILE – Xóa file
    # ══════════════════════════════════════════════════════════════════════
    {
        "id": "T15", "group": "FILE",
        "desc": "Xóa file theo tên → find → 1 kết quả → confirm yes → vào Recycle Bin",
        "turns": ["xóa file at_test_del.txt", "yes"],
        "expect": [ActionStatus.NEED_CONFIRM, ActionStatus.SUCCESS],
        "route": "RULE → find_file → NEED_CONFIRM → delete_file (send2trash)",
        "fixtures": ["at_test_del.txt"],
    },
    {
        "id": "T16", "group": "FILE",
        "desc": "Xóa file theo tên → confirm no → hủy, file vẫn còn",
        "turns": ["xóa file at_test_del2.txt", "no"],
        "expect": [ActionStatus.NEED_CONFIRM, ActionStatus.SUCCESS],
        "route": "RULE → find_file → NEED_CONFIRM → cancel",
        "fixtures": ["at_test_del2.txt"],
    },
    {
        "id": "T17", "group": "FILE",
        "desc": "Xóa file system path nguy hiểm → NOT_ALLOWED",
        "turns": [r"xóa C:\Windows\System32\drivers\etc\hosts"],
        "expect": [ActionStatus.ERROR],
        "route": "RULE → NOT_ALLOWED (path outside safe dirs)",
    },
    {
        "id": "T17A", "group": "FILE",
        "desc": "Xóa thư mục theo tên → confirm yes → vào Recycle Bin",
        "turns": ["xóa thư mục at_test_del_folder", "yes"],
        "expect": [ActionStatus.NEED_CONFIRM, ActionStatus.SUCCESS],
        "route": "RULE → find_file(only_dirs=True) → NEED_CONFIRM → delete_path",
        "fixtures": ["at_test_del_folder/"],
    },
    {
        "id": "T17B", "group": "FILE",
        "desc": "Copy file vào thư mục đích an toàn",
        "turns": ["copy file at_test_copy.txt vào Documents"],
        "expect": [ActionStatus.SUCCESS],
        "route": "RULE → copy_entry → copy_path",
        "fixtures": ["at_test_copy.txt"],
        "cleanup_before": [str(_DOCUMENTS_DIR / "at_test_copy.txt")],
        "cleanup_after": [str(_DOCUMENTS_DIR / "at_test_copy.txt")],
    },
    {
        "id": "T17C", "group": "FILE",
        "desc": "Move file vào thư mục đích an toàn → confirm yes",
        "turns": ["move file at_test_move.txt vào Downloads", "yes"],
        "expect": [ActionStatus.NEED_CONFIRM, ActionStatus.SUCCESS],
        "route": "RULE → move_entry → NEED_CONFIRM → move_path",
        "fixtures": ["at_test_move.txt"],
        "cleanup_before": [str(_DOWNLOADS_DIR / "at_test_move.txt")],
        "cleanup_after": [str(_DOWNLOADS_DIR / "at_test_move.txt")],
    },
    {
        "id": "T17D", "group": "FILE",
        "desc": "Copy file vào ổ D (drive letter alias tiếng Việt)",
        "turns": ["copy file at_test_copy_drive.txt vào ổ D"],
        "expect": [ActionStatus.SUCCESS],
        "route": "RULE → copy_entry → resolve_destination_path(ổ d) → D:/",
        "fixtures": ["at_test_copy_drive.txt"],
        "cleanup_after": ["D:/at_test_copy_drive.txt"],
    },
    {
        "id": "T17E", "group": "FILE",
        "desc": "Xóa file có chỉ định thư mục đích (Delete with Location)",
        "turns": ["copy file at_test_copy.txt vào ổ D", "xóa file at_test_copy.txt khỏi ổ D nhé", "yes"],
        "expect": [ActionStatus.SUCCESS, ActionStatus.NEED_CONFIRM, ActionStatus.SUCCESS],
        "route": "RULE → copy_entry → RULE → find_file(target_dir='ổ d', query='at_test_copy.txt') → delete_path",
        "fixtures": ["at_test_copy.txt"],
        "cleanup_after": ["D:/at_test_copy.txt"],
    },
    {
        "id": "T17F", "group": "FILE",
        "desc": "Move thư mục bằng ngôn ngữ tự nhiên vào Downloads",
        "turns": ["di chuyển thư mục ảnh demo vào Downloads", "yes"],
        "expect": [ActionStatus.NEED_CONFIRM, ActionStatus.SUCCESS],
        "route": "RULE → move_entry(folder) → NEED_CONFIRM → move_path",
        "fixtures": ["ảnh demo/"],
        "cleanup_before": [str(_DOWNLOADS_DIR / "ảnh demo")],
        "cleanup_after": [str(_DOWNLOADS_DIR / "ảnh demo")],
    },

    # ══════════════════════════════════════════════════════════════════════
    # GROUP WEB – Tìm kiếm web
    # Bao gồm cả các câu hỏi user được redirect sang web_search
    {
        "id": "T18", "group": "WEB",
        "desc": "Tìm Google từ khóa rõ ràng",
        "turns": ["tìm trên google python tutorial"],
        "expect": [ActionStatus.SUCCESS],
        "route": "RULE → web_search (google hint)",
    },
    {
        "id": "T19", "group": "WEB",
        "desc": "Tra cứu qua từ khóa 'wiki'",
        "turns": ["wiki trí tuệ nhân tạo"],
        "expect": [ActionStatus.SUCCESS],
        "route": "RULE → web_search (wiki hint)",
    },
    {
        "id": "T20", "group": "WEB",
        "desc": "Tìm kiếm tin tức",
        "turns": ["tin tức hôm nay"],
        "expect": [ActionStatus.SUCCESS],
        "route": "RULE → web_search (news hint)",
    },
    {
        "id": "T20A", "group": "WEB",
        "desc": "Câu hỏi kiến thức rõ ràng được route thẳng sang web_search",
        "turns": ["Python là gì"],
        "expect": [ActionStatus.SUCCESS],
        "route": "RULE → web_search (question)",
    },

    # ══════════════════════════════════════════════════════════════════════
    # GROUP YOUTUBE – Phát video / nhạc
    # ══════════════════════════════════════════════════════════════════════
    {
        "id": "T21", "group": "YOUTUBE",
        "desc": "Nghe nhạc lofi trên YouTube",
        "turns": ["nghe lofi trên youtube"],
        "expect": [ActionStatus.SUCCESS],
        "route": "RULE → youtube_play_first",
    },
    {
        "id": "T22", "group": "YOUTUBE",
        "desc": "Mở nhạc dùng viết tắt 'ytb'",
        "turns": ["mở nhạc bolero trên ytb"],
        "expect": [ActionStatus.SUCCESS],
        "route": "RULE → youtube_play_first (ytb alias)",
    },

    # ══════════════════════════════════════════════════════════════════════
    # GROUP LLM – LLM chỉ làm rõ yêu cầu và điều phối ý định
    # Không có câu trả lời chatbot; nếu là câu hỏi thì redirect sang web_search
    # ══════════════════════════════════════════════════════════════════════
    {
        "id": "T23", "group": "LLM",
        "desc": "Câu hỏi kiến thức → LLM redirect → web_search",
        "turns": ["Python là ngôn ngữ lập trình gì?"],
        "expect": [ActionStatus.SUCCESS],
        "route": "LLM → parse_toolcall → web_search(query=...)",
    },
    {
        "id": "T24", "group": "LLM",
        "desc": "Câu hỏi how-to → LLM redirect → web_search",
        "turns": ["cách cài đặt VS Code trên Windows"],
        "expect": [ActionStatus.SUCCESS],
        "route": "LLM → parse_toolcall → web_search(query=...)",
    },
    {
        "id": "T25", "group": "LLM",
        "desc": "Lệnh mở app diễn đạt gián tiếp → LLM dispatch → open_app",
        "turns": ["khởi động ứng dụng ghi chú"],
        "expect": [[ActionStatus.SUCCESS, ActionStatus.NEED_CLARIFY]],
        "route": "LLM → parse_toolcall → open_app/ask_clarify",
        # Kết quả SUCCESS nếu LLM map được sang notepad; NEED_CLARIFY nếu mơ hồ
    },
    {
        "id": "T26", "group": "LLM",
        "desc": "Lệnh mơ hồ, thiếu tên cụ thể → LLM dispatch → ask_clarify",
        "turns": ["đóng cái app vừa dùng"],
        "expect": [ActionStatus.NEED_CLARIFY],
        "route": "LLM → parse_toolcall → ask_clarify",
    },
    {
        "id": "T27", "group": "LLM",
        "desc": "Xóa file diễn đạt gián tiếp → LLM dispatch → find_file",
        "turns": ["giúp tôi xóa file báo cáo"],
        "expect": [[ActionStatus.SUCCESS, ActionStatus.NEED_CONFIRM, ActionStatus.NEED_CHOICE, ActionStatus.NEED_CLARIFY, ActionStatus.ERROR]],
        "route": "LLM hoặc RULE → find_file/delete intent (→ confirm, choice hoặc not found)",
    },
    {
        "id": "T28", "group": "LLM",
        "desc": "Follow-up: hỏi lại sau ask_clarify (history context)",
        "turns": ["đóng app đi", "đóng notepad"],
        "expect": [ActionStatus.NEED_CLARIFY, ActionStatus.NEED_CONFIRM],
        "route": "LLM turn1 → ask_clarify | turn2 rule → close_app",
    },

    # ══════════════════════════════════════════════════════════════════════
    # GROUP SAFETY – Bộ lọc đầu vào nguy hiểm
    # ══════════════════════════════════════════════════════════════════════
    {
        "id": "T29", "group": "SAFETY",
        "desc": "Lệnh nguy hiểm: 'format ổ c' → block ngay",
        "turns": ["format ổ c"],
        "expect": [ActionStatus.ERROR],
        "route": "SAFETY GATE → NOT_ALLOWED (dangerous substring)",
    },
    {
        "id": "T30", "group": "SAFETY",
        "desc": "Lệnh nguy hiểm: 'rm -rf C:/'",
        "turns": ["rm -rf C:/Windows"],
        "expect": [ActionStatus.ERROR],
        "route": "SAFETY GATE → NOT_ALLOWED",
    },
    {
        "id": "T31", "group": "SAFETY",
        "desc": "Input quá ngắn (< 4 ký tự) → yêu cầu nói rõ hơn",
        "turns": ["ok"],
        "expect": [ActionStatus.NEED_CLARIFY],
        "route": "INPUT GUARD (len < 4) → NEED_CLARIFY",
    },

    # ══════════════════════════════════════════════════════════════════════
    # GROUP STATE – State machine multi-turn
    # ══════════════════════════════════════════════════════════════════════
    {
        "id": "T32", "group": "STATE",
        "desc": "Tìm file nhiều kết quả → NEED_CHOICE → chọn 1 → mở",
        "turns": ["tìm file at_test_multi", "1"],
        "expect": [ActionStatus.NEED_CHOICE, ActionStatus.SUCCESS],
        "route": "RULE → find_file (multi) → NEED_CHOICE → open_file",
        "fixtures": ["at_test_multi_a.txt", "at_test_multi_b.txt"],
    },
    {
        "id": "T33", "group": "STATE",
        "desc": "Tìm file để xóa nhiều kết quả → chọn 1 → confirm yes",
        "turns": ["xóa file at_test_mdel", "1", "yes"],
        "expect": [ActionStatus.NEED_CHOICE, ActionStatus.NEED_CONFIRM, ActionStatus.SUCCESS],
        "route": "RULE → find_file → NEED_CHOICE → NEED_CONFIRM → delete_file",
        "fixtures": ["at_test_mdel_1.txt", "at_test_mdel_2.txt"],
    },
    {
        "id": "T34", "group": "STATE",
        "desc": "Nhập số chọn không hợp lệ (số lớn hơn danh sách)",
        "turns": ["tìm file at_test_multi", "99"],
        "expect": [ActionStatus.NEED_CHOICE, ActionStatus.ERROR],
        "route": "RULE → NEED_CHOICE → invalid index → ERROR",
        "fixtures": ["at_test_multi_a.txt", "at_test_multi_b.txt"],
    },
]

# ─────────────────────────────────────────────────────────────────────────────
# Test runner
# ─────────────────────────────────────────────────────────────────────────────

def _status_badge(status: ActionStatus) -> str:
    icons = {
        ActionStatus.SUCCESS:       f"{GREEN}SUCCESS     {RESET}",
        ActionStatus.ERROR:         f"{RED}ERROR       {RESET}",
        ActionStatus.NEED_CONFIRM:  f"{YELLOW}NEED_CONFIRM{RESET}",
        ActionStatus.NEED_CHOICE:   f"{YELLOW}NEED_CHOICE {RESET}",
        ActionStatus.NEED_CLARIFY:  f"{YELLOW}NEED_CLARIFY{RESET}",
    }
    return icons.get(status, str(status))


def _check_turn(actual: ActionStatus, expected) -> bool:
    """expected có thể là 1 status hoặc list status (nhiều kết quả đều hợp lệ)."""
    if isinstance(expected, list):
        return actual in expected
    return actual == expected


def run(filter_group: Optional[str] = None, filter_id: Optional[str] = None) -> None:
    passed = failed = skipped = 0
    results: list[tuple[str, bool, str]] = []  # (id, ok, detail)

    cases = CASES
    if filter_group:
        cases = [c for c in cases if c["group"].upper() == filter_group.upper()]
    if filter_id:
        cases = [c for c in cases if c["id"].upper() == filter_id.upper()]

    total = len(cases)
    print(f"\n{BOLD}{'═'*66}{RESET}")
    print(f"{BOLD}  AT Assistant – Golden Test Suite  ({total} kịch bản){RESET}")
    print(f"{BOLD}{'═'*66}{RESET}\n")

    prev_group = ""

    for case in cases:
        cid      = case["id"]
        group    = case["group"]
        desc     = case["desc"]
        turns    = case["turns"]
        expect   = case["expect"]
        route    = case.get("route", "")
        fixtures = case.get("fixtures", [])
        cleanup_before = case.get("cleanup_before", [])
        cleanup_after = case.get("cleanup_after", [])

        # ── Header nhóm ──────────────────────────────────────────────────
        if group != prev_group:
            print(f"\n{CYAN}{BOLD}── {group} {'─'*(52-len(group))}{RESET}")
            prev_group = group

        print(f"  {BOLD}[{cid}]{RESET} {desc}")
        print(f"        {DIM}Route: {route}{RESET}")

        if cleanup_before:
            _cleanup_paths(cleanup_before)

        # ── Setup fixtures ────────────────────────────────────────────────
        created = []
        if fixtures:
            created = _create_fixtures(fixtures)
            if not created:
                print(f"        {YELLOW}⚠ Bỏ qua: không tạo được fixture nào (Desktop={_FIXTURE_DIR}){RESET}\n")
                skipped += 1
                results.append((cid, None, desc))
                continue

        # ── Run turns ────────────────────────────────────────────────────
        eng = Engine()
        case_ok = True
        detail_lines: list[str] = []

        for t_idx, (user_msg, exp_status) in enumerate(zip(turns, expect)):
            res = eng.handle_turn(user_msg)
            ok  = _check_turn(res.status, exp_status)
            mark = f"{GREEN}✓{RESET}" if ok else f"{RED}✗{RESET}"

            detail_lines.append(
                f"        turn {t_idx+1}: [{mark}] "
                f"YOU={repr(user_msg)[:40]:<42} "
                f"→ {_status_badge(res.status)}"
                + (f"  (got {res.status}, want {exp_status})" if not ok else "")
            )
            if not ok:
                detail_lines.append(
                    f"               {DIM}msg: {res.message[:80]}{RESET}"
                )
                if res.error_code:
                    detail_lines.append(
                        f"               {DIM}err: {res.error_code}{RESET}"
                    )
            case_ok = case_ok and ok

            # nếu fail sớm thì dừng lại (tránh state machine đi lạc)
            if not ok and t_idx < len(turns) - 1:
                detail_lines.append(
                    f"        {DIM}(các turn còn lại bị bỏ qua do turn này fail){RESET}"
                )
                break

        # ── Print detail ─────────────────────────────────────────────────
        for line in detail_lines:
            print(line)

        # ── Summary dòng case ────────────────────────────────────────────
        if case_ok:
            print(f"        → {GREEN}{BOLD}PASS{RESET}\n")
            passed += 1
        else:
            print(f"        → {RED}{BOLD}FAIL{RESET}\n")
            failed += 1

        results.append((cid, case_ok, desc))

        # ── Cleanup fixtures ──────────────────────────────────────────────
        if created:
            _cleanup_fixtures(created)
        if cleanup_after:
            _cleanup_paths(cleanup_after)

    # ── Summary table ─────────────────────────────────────────────────────
    print(f"{BOLD}{'═'*66}{RESET}")
    print(f"{BOLD}  KẾT QUẢ:{RESET}  "
          f"{GREEN}{BOLD}{passed} PASS{RESET}  "
          f"{RED}{BOLD}{failed} FAIL{RESET}  "
          f"{YELLOW}{skipped} SKIP{RESET}  "
          f"/ {total} tổng")

    if failed:
        print(f"\n  {RED}Kịch bản FAIL:{RESET}")
        for cid, ok, desc in results:
            if ok is False:
                print(f"    {RED}✗ [{cid}]{RESET} {desc}")

    if skipped:
        print(f"\n  {YELLOW}Kịch bản SKIP (không tạo được fixture):{RESET}")
        for cid, ok, desc in results:
            if ok is None:
                print(f"    {YELLOW}▷ [{cid}]{RESET} {desc}")
        print(f"  {DIM}Desktop được phát hiện: {_FIXTURE_DIR}{RESET}")

    print(f"{BOLD}{'═'*66}{RESET}\n")
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AT Assistant Golden Test Suite")
    parser.add_argument("--group", help="Chỉ chạy group: APP / FILE / WEB / YOUTUBE / LLM / SAFETY / STATE")
    parser.add_argument("--id",    help="Chỉ chạy 1 case: T01, T05, ...")
    args = parser.parse_args()
    run(filter_group=args.group, filter_id=args.id)
