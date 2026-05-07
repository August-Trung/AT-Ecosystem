# src/core/executor.py
from __future__ import annotations

import os
import platform
import re
import shlex
import shutil
import socket
import subprocess
import time
import ctypes
import unicodedata
import threading
import psutil
import requests
from datetime import datetime, timedelta
from pathlib import Path, PurePosixPath
from urllib.parse import quote
from typing import Any, List, Optional
import win32api
import win32clipboard
import win32con
import win32gui
import win32process
import pythoncom

from send2trash import send2trash
import win32com.client
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from src.core.result import ActionResult, ErrorCode
from src.core.config_store import load_aliases

from src.core.result import ActionStatus
from src.core.app_paths import ensure_app_data_dir
from src.plugins.email_service import GmailService, HiddenEmailService
from src.plugins.email_trigger_detector import gmail_trigger_detector
from src.plugins.bulk_email_service import BulkEmailService
from src.plugins.google_auth_service import GoogleAuthService
from src.plugins.google_drive_service import GoogleDriveService
from src.plugins.reminder_service import ReminderService
from src.plugins.personal_memory_service import PersonalMemoryService
from src.plugins.recent_apps_service import RecentAppsService
from src.plugins.menu_data import MENU, build_main_menu_message, build_menu_item_message
from src.plugins.workflow_service import WorkflowService
from src.plugins.custom_app_service import CustomAppService

# =========================
# Config / Safety
# =========================

ALLOWED_APPS = {
    "chrome": {"path": r"C:\Program Files\Google\Chrome\Application\chrome.exe"},
    "edge": {"path": r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"},
    "notepad": {"path": r"C:\Windows\System32\notepad.exe"},
    "calculator": {"path": r"C:\Windows\System32\calc.exe"},
    "vscode": {"path": None},
    "zalo": {"path": None},
    "sql_server": {"path": None},
    "postgres": {"path": None},
    "pgadmin": {"path": None},
    "datagrip": {"path": None},
    "word": {"path": None},
    "excel": {"path": None},
    "powerpoint": {"path": None},
    "outlook": {"path": None},
    "visual_studio": {"path": None},  # Visual Studio (C#)
}

PROCESS_NAME = {
    "chrome": "chrome.exe",
    "edge": "msedge.exe",
    "notepad": "notepad.exe",
    "calculator": "calc.exe",
    "vscode": "Code.exe",
    "visual_studio": "devenv.exe",
    "zalo": "Zalo.exe",
    "sql_server": "Ssms.exe",
    "postgres": "postgres.exe",
    "pgadmin": "pgAdmin4.exe",
    "datagrip": "datagrip64.exe",
    "word": "WINWORD.EXE",
    "excel": "EXCEL.EXE",
    "powerpoint": "POWERPNT.EXE",
    "outlook": "OUTLOOK.EXE",
}

MULTI_PROCESS_APPS = {"zalo"}

START_MENU_DIRS = [
    Path(os.environ.get("APPDATA", "")) / "Microsoft/Windows/Start Menu/Programs",
    Path(os.environ.get("PROGRAMDATA", "")) / "Microsoft/Windows/Start Menu/Programs",
]

APP_ALIASES = {
    "vs code": "vscode",
    "visual studio code": "vscode",
    "vscode": "vscode",
    "code": "vscode",
    "microsoft word": "word",
    "ms word": "word",
    "winword": "word",
    "microsoft excel": "excel",
    "ms excel": "excel",
    "excel": "excel",
    "power point": "powerpoint",
    "microsoft powerpoint": "powerpoint",
    "powerpoint": "powerpoint",
    "microsoft outlook": "outlook",
    "outlook": "outlook",
    "google": "chrome",
    "gg": "chrome",
    "microsoft edge": "edge",
    "edge": "edge",
    "ms edge": "edge",
    "sql server": "sql_server",
    "ssms": "sql_server",
    "sql management studio": "sql_server",
    "sql server management studio": "sql_server",
    "postgres": "postgres",
    "postgre": "postgres",
    "postgresql": "postgres",
    "pgadmin": "pgadmin",
    "datagrip": "datagrip",
    "data grip": "datagrip",
    "jetbrains datagrip": "datagrip",
    "visual studio": "visual_studio",
    "visualstudio": "visual_studio",
    "microsoft visual studio": "visual_studio",
}

APP_QUERY_ALIASES = {
    "edge": ["edge", "microsoft edge", "ms edge"],
    "word": ["word", "winword", "microsoft word", "ms word"],
    "excel": ["excel", "microsoft excel", "ms excel"],
    "powerpoint": ["powerpoint", "power point", "microsoft powerpoint"],
    "outlook": ["outlook", "microsoft outlook"],
    "vscode": ["vscode", "vs code", "visual studio code", "code"],
    "sql_server": [
        "sql server management studio",
        "sql management studio",
        "microsoft sql server management studio",
        "ssms",
        "sql server",
        "sqlserver",
    ],
    "postgres": ["postgres", "postgre", "postgresql"],
    "pgadmin": ["pgadmin", "pgadmin 4", "postgresql pgadmin", "pgadmin4"],
    "datagrip": ["jetbrains datagrip", "data grip", "datagrip"],
}

APP_OPEN_FILE_HINTS = {
    "word": ["doc", "docx"],
    "excel": ["xls", "xlsx", "csv"],
    "powerpoint": ["ppt", "pptx"],
}

MAX_SHUTDOWN_DELAY_SECONDS = 315_360_000
DEFAULT_NIGHT_SLEEP_SHUTDOWN_SECONDS = 2 * 60 * 60
DEFAULT_SCHEDULE_WARNING_MINUTES = 15
SECONDS_PER_DAY = 24 * 60 * 60
_SCHEDULED_POWER_STATE: dict[str, Any] = {}
_SCHEDULED_POWER_TIMERS: dict[str, threading.Timer] = {}
_SCHEDULED_CLOSE_TASKS: dict[str, dict[str, Any]] = {}
_SCHEDULED_CLOSE_LOCK = threading.Lock()
_SCHEDULED_OPEN_TASKS: dict[str, dict[str, Any]] = {}
_SCHEDULED_OPEN_LOCK = threading.Lock()
_IDLE_GUARD_STATE: dict[str, Any] = {}
_IDLE_GUARD_LOCK = threading.Lock()

DISTRACTING_WEB_KEYWORDS = {
    "youtube",
    "facebook",
    "tiktok",
    "instagram",
    "netflix",
    "reddit",
    "x.com",
    "twitter",
    "shorts",
    "reels",
}


# =========================
# SAFE_DIRS (Desktop/Documents/Downloads + OneDrive)
# =========================

SAFE_DIRS: list[str] = []
DRIVE_ROOT_SEARCH_DEPTH = 3

_one = os.environ.get("OneDrive")
_user = Path(os.environ.get("USERPROFILE", str(Path.home())))

for p in [
    (Path(_one) / "Desktop") if _one else None,
    (Path(_one) / "Máy tính") if _one else None,  # OneDrive VN
    (Path(_one) / "Documents") if _one else None,
    (Path(_one) / "Downloads") if _one else None,
    _user / "Desktop",
    _user / "Documents",
    _user / "Downloads",
    Path("D:/"),
    Path("E:/"),
]:
    if p and p.exists():
        SAFE_DIRS.append(str(p))


# =========================
# Helpers
# =========================


def _norm_app_key(app_name: str) -> str:
    t = (app_name or "").strip().lower()

    # 1) alias từ configs/aliases.json (data-driven)
    cfg = load_aliases()
    app_aliases = cfg.get("app_aliases") or {}
    if t in app_aliases:
        t = str(app_aliases[t]).strip().lower()

    # 2) alias nội bộ (bạn đã có)
    if "visual studio" in t and "code" in t:
        return "vscode"
    if t in {"vs code", "vscode", "visual studio code"}:
        return "vscode"
    if "visual studio" in t and "code" not in t:
        return "visual_studio"
    return APP_ALIASES.get(t, t)


def _extract_exe(record) -> Optional[str]:
    if isinstance(record, dict):
        p = record.get("path")
        return p if isinstance(p, str) and p.strip() else None
    if isinstance(record, str):
        return record
    return None


def _is_safe_path(path: Path) -> bool:
    sp = str(path.resolve())
    for d in SAFE_DIRS:
        try:
            if sp.startswith(str(Path(d).resolve())):
                return True
        except Exception:
            continue
    return False


def _resolve_virtual_path(raw_path: str) -> Path:
    r"""
    Map các path ảo kiểu LLM hay bịa:
      /Desktop/abc.txt  -> <Desktop thật>\abc.txt
      /Documents/x.docx -> <Documents thật>\x.docx
      /Downloads/a.zip  -> <Downloads thật>\a.zip
    """
    s = (raw_path or "").strip().replace("\\", "/")
    if not s:
        return Path(raw_path)

    # Chỉ xử lý dạng "/Desktop/xxx" hoặc "Desktop/xxx"
    s2 = s[1:] if s.startswith("/") else s
    parts = PurePosixPath(s2).parts
    if not parts:
        return Path(raw_path)

    top = (parts[0] or "").lower()
    rest = parts[1:]

    def pick_safe_folder(kind: str) -> Optional[Path]:
        kind = kind.lower()
        for d in SAFE_DIRS:
            p = Path(d)
            name = p.name.lower()
            if kind == "desktop":
                if name in {"desktop", "máy tính"}:
                    return p
            elif kind == "documents":
                if name == "documents":
                    return p
            elif kind == "downloads":
                if name == "downloads":
                    return p
        return None

    if top in {"desktop", "documents", "downloads"}:
        base = pick_safe_folder(top)
        if base and rest:
            return (base / Path(*rest)).resolve()
        if base and not rest:
            return base.resolve()

    return Path(raw_path).resolve()


def is_safe_path(raw_path: str) -> bool:
    try:
        p = _resolve_virtual_path(raw_path)
    except Exception:
        return False
    return _is_safe_path(p)


def _safe_dir_aliases() -> dict[str, Path]:
    mapping: dict[str, Path] = {}
    for d in SAFE_DIRS:
        p = Path(d)
        name = p.name.lower()
        if name in {"desktop", "máy tính"}:
            mapping["desktop"] = p
        elif name == "documents":
            mapping["documents"] = p
        elif name == "downloads":
            mapping["downloads"] = p
    return mapping


def _is_drive_root_dir(raw_path: str) -> bool:
    normalized = (raw_path or "").replace("\\", "/").strip().rstrip("/")
    return bool(re.fullmatch(r"[a-zA-Z]:", normalized))


def _relative_search_depth(base: Path, current: Path) -> int:
    try:
        return len(current.relative_to(base).parts)
    except Exception:
        return 0


def resolve_destination_path(raw_dst: str) -> Optional[str]:
    q = (raw_dst or "").strip()
    if not q:
        return None

    aliases = _safe_dir_aliases()
    q_norm = q.lower().strip()
    alias_map = {
        "desktop": "desktop",
        "màn hình": "desktop",
        "man hinh": "desktop",
        "máy tính": "desktop",
        "may tinh": "desktop",
        "documents": "documents",
        "document": "documents",
        "tài liệu": "documents",
        "tai lieu": "documents",
        "downloads": "downloads",
        "download": "downloads",
        "thư mục tải xuống": "downloads",
        "tai xuong": "downloads",
    }

    # Drive letter aliases (Vietnamese & English)
    drive_alias_map = {
        "ổ d": "D:/",
        "o d": "D:/",
        "drive d": "D:/",
        "ổ e": "E:/",
        "o e": "E:/",
        "drive e": "E:/",
    }

    # Check drive letter alias first
    drive_path_str = drive_alias_map.get(q_norm)
    if drive_path_str:
        drive_path = Path(drive_path_str)
        if drive_path.exists() and drive_path.is_dir() and _is_safe_path(drive_path):
            return str(drive_path.resolve())
        return None

    alias_key = alias_map.get(q_norm)
    if alias_key and alias_key in aliases:
        return str(aliases[alias_key].resolve())

    try:
        dst = _resolve_virtual_path(q)
    except Exception:
        dst = None

    if dst and dst.exists() and dst.is_dir() and _is_safe_path(dst):
        return str(dst.resolve())

    found = find_file(query=q, include_dirs=True, only_dirs=True)
    if found.status != ActionStatus.SUCCESS:
        return None

    matches = found.data.get("files", [])
    if len(matches) == 1:
        return matches[0]
    return None


def resolve_app_path(app_query: str) -> str | None:
    pythoncom.CoInitialize()
    q_raw = (app_query or "").strip().lower()
    q = re.sub(r"[\s\-_]+", "", q_raw)

    if not q:
        pythoncom.CoUninitialize()
        return None

    special = resolve_special_app_path(q)
    if special:
        pythoncom.CoUninitialize()
        return special

    shell = win32com.client.Dispatch("WScript.Shell")

    try:
        # 1. Tìm trong Start Menu (existing)
        for base in START_MENU_DIRS:
            if not base.exists():
                continue

            for lnk in base.rglob("*.lnk"):
                name_raw = lnk.stem.lower()
                name = re.sub(r"[\s\-_]+", "", name_raw)

                exact_match = q == name
                prefix_match = len(q) >= 3 and name.startswith(q)
                contains_match = len(q) >= 4 and q in name

                if exact_match or prefix_match or contains_match:
                    try:
                        sc = shell.CreateShortcut(str(lnk))
                        target = sc.TargetPath
                        if target and target.lower().endswith(".exe"):
                            return target
                    except Exception:
                        pass
                # dùng q (đã normalize) so với name (đã normalize)
                if not (exact_match or prefix_match or contains_match):
                    continue

        # 2. THÊM: Tìm trực tiếp trong Program Files
        common_paths = [
            Path(f"C:/Program Files/{q.title()}"),
            Path(f"C:/Program Files (x86)/{q.title()}"),
            Path(os.environ.get("LOCALAPPDATA", "")) / "Programs" / q.title(),
        ]

        for base in common_paths:
            if base.exists():
                for exe in base.rglob("*.exe"):
                    stem = exe.stem.lower()
                    if (
                        q == stem
                        or (len(q) >= 3 and stem.startswith(q))
                        or (len(q) >= 4 and q in stem)
                    ):
                        return str(exe)

        return None
    finally:
        pythoncom.CoUninitialize()


def resolve_special_app_path(q: str) -> str | None:
    sql_server_candidates = [
        Path(
            r"C:/Program Files (x86)/Microsoft SQL Server Management Studio 20/Common7/IDE/Ssms.exe"
        ),
        Path(
            r"C:/Program Files/Microsoft SQL Server Management Studio 20/Common7/IDE/Ssms.exe"
        ),
        Path(
            r"C:/Program Files (x86)/Microsoft SQL Server Management Studio 19/Common7/IDE/Ssms.exe"
        ),
        Path(
            r"C:/Program Files/Microsoft SQL Server Management Studio 19/Common7/IDE/Ssms.exe"
        ),
        Path(
            r"C:/Program Files (x86)/Microsoft SQL Server Management Studio 18/Common7/IDE/Ssms.exe"
        ),
        Path(
            r"C:/Program Files/Microsoft SQL Server Management Studio 18/Common7/IDE/Ssms.exe"
        ),
    ]

    special_map = {
        "sqlservermanagementstudio": sql_server_candidates,
        "sqlmanagementstudio": sql_server_candidates,
        "microsoftsqlservermanagementstudio": sql_server_candidates,
        "ssms": sql_server_candidates,
        "sqlserver": sql_server_candidates,
        "pgadmin": [
            Path(r"C:/Program Files/pgAdmin 4/bin/pgAdmin4.exe"),
            Path(r"C:/Program Files (x86)/pgAdmin 4/bin/pgAdmin4.exe"),
        ],
        "pgadmin4": [
            Path(r"C:/Program Files/pgAdmin 4/bin/pgAdmin4.exe"),
            Path(r"C:/Program Files (x86)/pgAdmin 4/bin/pgAdmin4.exe"),
        ],
    }

    candidates = special_map.get(q)
    if not candidates:
        return None

    for candidate in candidates:
        if candidate.exists():
            return str(candidate)
    return None


def resolve_office_app_path(app_key: str) -> str | None:
    queries = APP_QUERY_ALIASES.get(app_key) or [app_key]
    for query in queries:
        exe = resolve_app_path(query)
        if exe:
            return exe
    return None


def extract_app_and_remainder(user_text: str) -> tuple[Optional[str], str]:
    raw = (user_text or "").strip()
    if not raw:
        return None, ""

    normalized = re.sub(r"\s+", " ", raw.lower()).strip()
    candidates: list[tuple[str, str]] = []

    for canonical in ALLOWED_APPS:
        candidates.append((canonical, canonical))

    cfg = load_aliases()
    for alias, canonical in (cfg.get("app_aliases") or {}).items():
        if canonical in ALLOWED_APPS:
            candidates.append((alias.lower().strip(), canonical))

    for alias, canonical in APP_ALIASES.items():
        if canonical in ALLOWED_APPS:
            candidates.append((alias.lower().strip(), canonical))

    seen: set[tuple[str, str]] = set()
    ordered = sorted(candidates, key=lambda item: len(item[0]), reverse=True)
    for alias, canonical in ordered:
        item = (alias, canonical)
        if item in seen:
            continue
        seen.add(item)
        if normalized == alias:
            return canonical, ""
        if normalized.startswith(alias + " "):
            return canonical, normalized[len(alias) :].strip()

    return None, normalized


def _resolve_custom_app_record(app_name: str, normalized_key: str = "") -> dict | None:
    service = CustomAppService()
    for candidate in [app_name, normalized_key]:
        record = service.find_app(candidate)
        if record:
            return record
    return None


def _build_custom_app_prompt_result(
    app_name: str,
    *,
    alias: str = "",
    reason: str = "not_found",
    target_path: str = "",
    display_name: str = "",
    require_confirmation: bool = False,
) -> ActionResult:
    requested_alias = (alias or app_name or "").strip()
    return ActionResult.err(
        f"Không tìm thấy ứng dụng '{app_name}'. Hãy chọn file .exe hoặc .lnk để lưu cho lần sau.",
        code=ErrorCode.APP_NOT_FOUND,
        prompt_custom_app_selection=True,
        custom_app_alias=requested_alias,
        custom_app_reason=reason,
        custom_app_target_path=target_path,
        custom_app_display_name=display_name or requested_alias,
        custom_app_requires_confirmation=require_confirmation,
    )


def open_app_target(
    target_path: str,
    *,
    app_key: str = "",
    display_name: str = "",
    arguments: str = "",
    working_dir: str = "",
) -> ActionResult:
    target = str(target_path or "").strip().strip('"').strip("'")
    if not target:
        return ActionResult.err(
            "Thiếu đường dẫn ứng dụng.",
            code=ErrorCode.APP_NOT_FOUND,
        )

    try:
        path = Path(target).expanduser().resolve()
    except Exception as e:
        return ActionResult.err(
            "Đường dẫn ứng dụng không hợp lệ.",
            code=ErrorCode.INTERNAL_ERROR,
            dev_message=str(e),
        )

    if not path.exists():
        return ActionResult.err(
            f"Đường dẫn không tồn tại: {path}",
            code=ErrorCode.APP_NOT_FOUND,
        )

    suffix = path.suffix.lower()
    if suffix not in {".exe", ".lnk"}:
        return ActionResult.err(
            "Chỉ hỗ trợ mở file .exe hoặc .lnk.",
            code=ErrorCode.NOT_ALLOWED,
        )

    resolved_key = (app_key or path.stem).strip().lower().replace(" ", "_")
    resolved_name = (display_name or path.stem).strip() or resolved_key

    try:
        if suffix == ".lnk":
            os.startfile(str(path))
            pid = None
            process_name = path.name
        else:
            cmd = [str(path)]
            if arguments.strip():
                cmd.extend(shlex.split(arguments, posix=False))
            cwd = working_dir.strip() or str(path.parent)
            proc = subprocess.Popen(cmd, cwd=cwd)
            pid = proc.pid
            process_name = path.name
        try:
            RecentAppsService().record_app(
                resolved_key, exe_path=str(path), display_name=resolved_name
            )
        except Exception:
            pass
        return ActionResult.ok(
            f"Đã mở {resolved_name}",
            app=resolved_key,
            exe=str(path),
            pid=pid,
            process_name=process_name,
            display_name=resolved_name,
        )
    except Exception as e:
        return ActionResult.err(
            f"Lỗi khi mở '{resolved_name}'.",
            code=ErrorCode.INTERNAL_ERROR,
            dev_message=str(e),
        )


# =========================
# Public actions (tools) — ALWAYS return ActionResult
# =========================


def open_app(app_name: str) -> ActionResult:
    key = _norm_app_key(app_name)
    if not key:
        return ActionResult.err("Không có tên ứng dụng.", code=ErrorCode.UNKNOWN)

    record = ALLOWED_APPS.get(key)
    if record is None:
        record = {"path": None}
        ALLOWED_APPS[key] = record

    exe = _extract_exe(record)

    if not exe:
        exe = (
            resolve_office_app_path(key)
            or resolve_app_path(key)
            or resolve_app_path(app_name)
        )

        if not exe:
            return ActionResult.err(
                f"Không tìm thấy ứng dụng '{app_name}'.",
                code=ErrorCode.APP_NOT_FOUND,
                dev_message="Không resolve được đường dẫn .exe từ Start Menu.",
            )

        record["path"] = exe

    try:
        if not Path(exe).exists():
            return ActionResult.err(
                f"Đường dẫn không tồn tại: {exe}",
                code=ErrorCode.APP_NOT_FOUND,
            )
    except Exception as e:
        return ActionResult.err(
            "Đường dẫn .exe không hợp lệ.",
            code=ErrorCode.INTERNAL_ERROR,
            dev_message=str(e),
        )

    try:
        p = subprocess.Popen([exe])
        # Record to recent apps list
        try:
            RecentAppsService().record_app(key, exe_path=exe)
        except Exception:
            pass
        return ActionResult.ok(
            f"Đã mở {app_name}",
            app=key,
            exe=exe,
            pid=p.pid,
            process_name=os.path.basename(exe),
        )

    except Exception as e:
        return ActionResult.err(
            f"Lỗi khi mở '{app_name}'.",
            code=ErrorCode.INTERNAL_ERROR,
            dev_message=str(e),
        )


def close_app(
    app_name: str,
    _hint: dict | None = None,
    prefer_active: bool = True,
    close_all: bool = False,
) -> ActionResult:
    """
    Ưu tiên đóng đúng instance đang focus (foreground window) nếu nó thuộc app đang yêu cầu.
    Sau đó fallback: PID trong history -> match exe/process_name -> scan (đều max_kill=1).
    """
    key = (app_name or "").strip().lower()
    is_multi = key in MULTI_PROCESS_APPS

    if close_all:
        key = (app_name or "").strip().lower()

        # ưu tiên dùng process_name/exe nếu map được (ổn định hơn "contains")
        proc_name = ""
        exe_hint = ""
        if _hint:
            proc_name = (_hint.get("process_name") or "").lower()
            exe_hint = (_hint.get("exe") or "").lower()

        # nếu không có hint, lấy process name từ PROCESS_NAME mapping nếu có
        if not proc_name:
            proc_name = (PROCESS_NAME.get(key) or "").lower()

        # kill ALL match (max_kill rất lớn)
        killed = _kill_by_predicate(
            lambda info: (
                (
                    proc_name
                    and (
                        info["name"] == proc_name
                        or (is_multi and proc_name in info["name"])
                    )
                )
                or (exe_hint and info["exe"] and info["exe"].lower() == exe_hint)
                or (
                    key
                    and (
                        (info["name"] and key in info["name"])
                        or (info["exe"] and key in info["exe"].lower())
                    )
                )
            ),
            label=f"{app_name} (close_all)",
            max_kill=10_000,
        )

        if killed:
            return ActionResult.ok(f"Đã đóng TẤT CẢ {app_name}. ({killed} process)")
        return ActionResult.err(
            f"Không thấy process nào của '{app_name}' để đóng.",
            code=ErrorCode.APP_NOT_RUNNING,
        )

    # 0) NEW: ưu tiên đóng process đang ở foreground (đúng "cái tôi đang mở")
    if prefer_active:
        fg_pid = _get_foreground_pid()
        if fg_pid:
            try:
                p = psutil.Process(fg_pid)
                pname = (p.name() or "").lower()
                pexe = (p.exe() or "").lower()

                hint_proc = ((_hint or {}).get("process_name") or "").lower()
                hint_exe = ((_hint or {}).get("exe") or "").lower()

                # Chỉ đóng nếu foreground đúng app user yêu cầu
                match = False
                if hint_exe and pexe and pexe == hint_exe:
                    match = True
                elif hint_proc and pname and pname == hint_proc:
                    match = True
                elif key and pname and key in pname:
                    match = True
                elif key and pexe and key in pexe:
                    match = True

                if match:
                    p.terminate()
                    try:
                        p.wait(timeout=3)
                    except psutil.TimeoutExpired:
                        p.kill()
                    return ActionResult.ok(
                        f"Đã đóng {app_name} (foreground pid={fg_pid})."
                    )

            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
            except Exception as e:
                return ActionResult.err(
                    f"Không đóng được {app_name}.", dev_message=str(e)
                )

    # 1) Cách 1: đóng theo PID nếu có (chắc nhất)
    if _hint:
        pid = _hint.get("pid")
        if pid:
            try:
                p = psutil.Process(pid)
                p.terminate()
                try:
                    p.wait(timeout=3)
                except psutil.TimeoutExpired:
                    p.kill()
                return ActionResult.ok(f"Đã đóng {app_name} (pid={pid}).")
            except psutil.NoSuchProcess:
                pass  # PID không còn, rơi xuống cách dưới
            except Exception as e:
                return ActionResult.err(
                    f"Không đóng được {app_name}.", dev_message=str(e)
                )

        # 2) Nếu không có PID, dùng process_name/exe (vẫn rất tốt)
        proc_name = (_hint.get("process_name") or "").lower()
        exe_hint = (_hint.get("exe") or "").lower()

        if proc_name or exe_hint:
            killed = _kill_by_predicate(
                lambda info: (
                    proc_name
                    and (
                        info["name"] == proc_name
                        or (is_multi and proc_name in info["name"])
                    )
                )
                or (exe_hint and info["exe"] and info["exe"].lower() == exe_hint),
                label=f"{app_name} (from history)",
                max_kill=10_000 if is_multi else 1,
            )
            if killed:
                return ActionResult.ok(f"Đã đóng {app_name}. ({killed} process)")

    process_names = {
        (PROCESS_NAME.get(key) or "").lower(),
        key.lower(),
    }
    process_names.discard("")
    exe_names = {
        os.path.basename((_extract_exe(ALLOWED_APPS.get(key) or {}) or "")).lower(),
    }
    exe_names.discard("")

    # 3) Fallback scan: ưu tiên exact match theo process/exe basename
    killed = _kill_by_predicate(
        lambda info: info["name"] in process_names
        or os.path.basename(info["exe"]).lower() in exe_names,
        label=f"{app_name} (scan exact)",
        max_kill=10_000 if is_multi else 1,
    )

    if not killed and key in {"word", "excel", "powerpoint", "outlook"}:
        killed = _kill_by_predicate(
            lambda info: key in info["name"]
            or key in os.path.basename(info["exe"]).lower(),
            label=f"{app_name} (scan office fallback)",
            max_kill=10_000 if is_multi else 1,
        )

    if killed:
        return ActionResult.ok(f"Đã đóng {app_name}. ({killed} process)")
    return ActionResult.err(
        f"Không biết process của '{app_name}'.", code=ErrorCode.PROCESS_UNKNOWN
    )


def _kill_by_predicate(pred, label: str, max_kill: int = 1) -> int:
    killed = 0
    for p in psutil.process_iter(["pid", "name", "exe"]):
        try:
            name = (p.info.get("name") or "").lower()
            exe = p.info.get("exe") or ""
            info = {"pid": p.info["pid"], "name": name, "exe": exe}

            if pred(info):
                proc = psutil.Process(info["pid"])
                proc.terminate()
                try:
                    proc.wait(timeout=3)
                except psutil.TimeoutExpired:
                    proc.kill()
                killed += 1
                if killed >= max_kill:
                    break
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
        except Exception:
            continue
    return killed


FRIENDLY_PROCESS_NAMES = {
    "applicationframehost.exe": "Ứng dụng Windows",
    "chrome.exe": "Google Chrome",
    "code.exe": "Visual Studio Code",
    "codex.exe": "Codex",
    "discord.exe": "Discord",
    "explorer.exe": "File Explorer",
    "firefox.exe": "Firefox",
    "msedge.exe": "Microsoft Edge",
    "notepad.exe": "Notepad",
    "notepad++.exe": "Notepad++",
    "python.exe": "Python",
    "telegram.exe": "Telegram",
    "winword.exe": "Microsoft Word",
    "excel.exe": "Microsoft Excel",
    "powerpnt.exe": "Microsoft PowerPoint",
    "zalo.exe": "Zalo",
}

HIDDEN_PROCESS_NAMES = {
    "audiodg.exe",
    "conhost.exe",
    "csrss.exe",
    "ctfmon.exe",
    "dwm.exe",
    "fontdrvhost.exe",
    "lsass.exe",
    "memcompression",
    "msmpeng.exe",
    "registry",
    "runtimebroker.exe",
    "searchhost.exe",
    "securityhealthservice.exe",
    "services.exe",
    "sihost.exe",
    "smartscreen.exe",
    "smss.exe",
    "spoolsv.exe",
    "startmenuexperiencehost.exe",
    "svchost.exe",
    "system",
    "system idle process",
    "taskhostw.exe",
    "wininit.exe",
    "winlogon.exe",
    "wudfhost.exe",
}


def _format_memory_mb(value: float) -> str:
    if value >= 1024:
        return f"{value / 1024:.1f} GB"
    return f"{value:.0f} MB"


def _friendly_process_name(process_name: str) -> str:
    cleaned = (process_name or "").strip()
    lower = cleaned.lower()
    if lower in FRIENDLY_PROCESS_NAMES:
        return FRIENDLY_PROCESS_NAMES[lower]
    if cleaned.lower().endswith(".exe"):
        return cleaned[:-4]
    return cleaned or "Ứng dụng"


def _collect_visible_window_titles() -> dict[int, list[str]]:
    titles: dict[int, list[str]] = {}

    def _visit(hwnd, _extra):
        try:
            if not win32gui.IsWindowVisible(hwnd):
                return True
            title = win32gui.GetWindowText(hwnd).strip()
            if not title:
                return True
            _, pid = win32process.GetWindowThreadProcessId(hwnd)
            if pid:
                titles.setdefault(int(pid), []).append(title)
        except Exception:
            pass
        return True

    try:
        win32gui.EnumWindows(_visit, None)
    except Exception:
        return {}
    return titles


def _collect_visible_windows() -> list[dict[str, Any]]:
    windows: list[dict[str, Any]] = []
    try:
        foreground = int(win32gui.GetForegroundWindow() or 0)
    except Exception:
        foreground = 0

    def _visit(hwnd, _extra):
        try:
            if not win32gui.IsWindowVisible(hwnd):
                return True
            title = win32gui.GetWindowText(hwnd).strip()
            if not title:
                return True
            _, pid = win32process.GetWindowThreadProcessId(hwnd)
            pid = int(pid or 0)
            if not pid:
                return True
            try:
                proc = psutil.Process(pid)
                process_name = str(proc.name() or "")
                exe = str(proc.exe() or "")
                memory = proc.memory_info()
                memory_mb = int(getattr(memory, "rss", 0) or 0) / 1024 / 1024
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                return True
            except Exception:
                process_name = ""
                exe = ""
                memory_mb = 0.0
            windows.append(
                {
                    "hwnd": int(hwnd),
                    "pid": pid,
                    "title": title,
                    "name": process_name,
                    "display_name": _friendly_process_name(process_name),
                    "exe": exe,
                    "memory_mb": float(memory_mb),
                    "is_foreground": int(hwnd) == foreground,
                }
            )
        except Exception:
            pass
        return True

    try:
        win32gui.EnumWindows(_visit, None)
    except Exception:
        return []
    windows.sort(
        key=lambda item: (
            0 if item.get("is_foreground") else 1,
            str(item.get("display_name") or "").lower(),
            str(item.get("title") or "").lower(),
        )
    )
    return windows


def _find_window_for_pids(pids: list[int]) -> int | None:
    wanted = {int(pid) for pid in pids if int(pid or 0) > 0}
    if not wanted:
        return None
    matches: list[int] = []

    def _visit(hwnd, _extra):
        try:
            if not win32gui.IsWindowVisible(hwnd):
                return True
            title = win32gui.GetWindowText(hwnd).strip()
            if not title:
                return True
            _, pid = win32process.GetWindowThreadProcessId(hwnd)
            if int(pid or 0) in wanted:
                matches.append(hwnd)
                return False
        except Exception:
            pass
        return True

    try:
        win32gui.EnumWindows(_visit, None)
    except Exception:
        return None
    return matches[0] if matches else None


def _find_youtube_window() -> int | None:
    matches: list[tuple[int, int]] = []
    browser_names = {"chrome.exe", "msedge.exe", "firefox.exe", "brave.exe", "opera.exe", "browser.exe"}

    def _visit(hwnd, _extra):
        try:
            if not win32gui.IsWindowVisible(hwnd):
                return True
            title = win32gui.GetWindowText(hwnd).strip()
            if not title:
                return True
            _, pid = win32process.GetWindowThreadProcessId(hwnd)
            proc_name = ""
            try:
                proc_name = psutil.Process(int(pid)).name().lower()
            except Exception:
                proc_name = ""
            title_lower = title.lower()
            score = 0
            if "youtube" in title_lower or "youtu.be" in title_lower:
                score += 10
            if proc_name in browser_names:
                score += 3
            if score > 0:
                matches.append((score, hwnd))
        except Exception:
            pass
        return True

    try:
        win32gui.EnumWindows(_visit, None)
    except Exception:
        return None
    if not matches:
        return None
    matches.sort(key=lambda item: item[0], reverse=True)
    return matches[0][1]


def _find_browser_window(title_keywords: list[str] | None = None) -> int | None:
    matches: list[tuple[int, int]] = []
    browser_names = {"chrome.exe", "msedge.exe", "firefox.exe", "brave.exe", "opera.exe", "browser.exe"}
    keywords = [item.lower() for item in (title_keywords or []) if item.strip()]

    def _visit(hwnd, _extra):
        try:
            if not win32gui.IsWindowVisible(hwnd):
                return True
            title = win32gui.GetWindowText(hwnd).strip()
            if not title:
                return True
            _, pid = win32process.GetWindowThreadProcessId(hwnd)
            try:
                proc_name = psutil.Process(int(pid)).name().lower()
            except Exception:
                proc_name = ""
            if proc_name not in browser_names:
                return True
            title_lower = title.lower()
            score = 3
            if keywords:
                if not any(keyword in title_lower for keyword in keywords):
                    return True
                score += 10
            matches.append((score, hwnd))
        except Exception:
            pass
        return True

    try:
        win32gui.EnumWindows(_visit, None)
    except Exception:
        return None
    if not matches:
        return None
    matches.sort(key=lambda item: item[0], reverse=True)
    return matches[0][1]


def _focus_window(hwnd: int) -> None:
    if win32gui.IsIconic(hwnd):
        win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
    else:
        win32gui.ShowWindow(hwnd, win32con.SW_SHOW)
    win32gui.SetForegroundWindow(hwnd)


def focus_process_window(pid: int = 0, pids: list[int] | None = None, name: str = "") -> ActionResult:
    target_pids = [int(item) for item in (pids or []) if int(item or 0) > 0]
    if not target_pids and int(pid or 0) > 0:
        target_pids = [int(pid)]
    hwnd = _find_window_for_pids(target_pids)
    if not hwnd:
        return ActionResult.err("Không tìm thấy cửa sổ của ứng dụng này.", code=ErrorCode.PROCESS_UNKNOWN)
    try:
        _focus_window(hwnd)
        return ActionResult.ok(f"Đã chuyển sang {name or 'ứng dụng'}.")
    except Exception as exc:
        return ActionResult.err(f"Không thể chuyển sang ứng dụng: {exc}", code=ErrorCode.UNKNOWN)


def focus_window(hwnd: int = 0, title: str = "") -> ActionResult:
    hwnd = int(hwnd or 0)
    if not hwnd or not win32gui.IsWindow(hwnd):
        return ActionResult.err("Không tìm thấy cửa sổ đã chọn.", code=ErrorCode.PROCESS_UNKNOWN)
    try:
        _focus_window(hwnd)
        return ActionResult.ok(f"Đã chuyển sang cửa sổ: {(title or 'cửa sổ').strip()}.")
    except Exception as exc:
        return ActionResult.err(f"Không thể chuyển sang cửa sổ: {exc}", code=ErrorCode.UNKNOWN)


def close_window(hwnd: int = 0, title: str = "", name: str = "") -> ActionResult:
    hwnd = int(hwnd or 0)
    if not hwnd or not win32gui.IsWindow(hwnd):
        return ActionResult.err("Không tìm thấy cửa sổ đã chọn.", code=ErrorCode.PROCESS_UNKNOWN)
    label = (title or name or "cửa sổ").strip()
    try:
        win32gui.PostMessage(hwnd, win32con.WM_CLOSE, 0, 0)
        return ActionResult.ok(f"Đã gửi lệnh đóng cửa sổ: {label}.")
    except Exception as exc:
        return ActionResult.err(f"Không thể đóng cửa sổ: {exc}", code=ErrorCode.UNKNOWN)


def list_open_windows(limit: int = 20) -> ActionResult:
    rows = _collect_visible_windows()[: max(1, int(limit or 20))]
    if not rows:
        return ActionResult.ok("Không thấy cửa sổ nào đang mở.", windows=[])

    lines = ["Cửa sổ đang mở:"]
    for index, item in enumerate(rows, 1):
        marker = " [đang dùng]" if item.get("is_foreground") else ""
        title = str(item.get("title") or "").strip()
        display = str(item.get("display_name") or item.get("name") or "Ứng dụng").strip()
        lines.append(f"{index}. {title}{marker}")
        lines.append(f"   Ứng dụng: {display} - {_format_memory_mb(float(item.get('memory_mb') or 0))}")
    lines.append("\nBấm số bên dưới để chọn đúng cửa sổ và xem hành động.")

    choices = [
        f"{item.get('title') or 'Cửa sổ'} - {item.get('display_name') or item.get('name') or 'Ứng dụng'}"
        for item in rows
    ]
    result = ActionResult.need_choice(
        message="\n".join(lines),
        choices=choices,
        action="open_window",
    )
    result.data["windows"] = rows
    result.data["choices_already_in_message"] = True
    return result


def list_running_apps(limit: int = 12) -> ActionResult:
    window_titles = _collect_visible_window_titles()
    foreground_pid = _get_foreground_pid()
    groups: dict[str, dict] = {}
    for proc in psutil.process_iter(["pid", "name", "exe", "username", "memory_info"]):
        try:
            pid = int(proc.info.get("pid") or 0)
            name = str(proc.info.get("name") or "").strip()
            if not pid or not name:
                continue
            lower = name.lower()
            titles = window_titles.get(pid, [])
            if lower in HIDDEN_PROCESS_NAMES and not titles:
                continue
            if not titles and lower not in FRIENDLY_PROCESS_NAMES:
                continue
            memory = proc.info.get("memory_info")
            memory_mb = int(getattr(memory, "rss", 0) or 0) / 1024 / 1024
            exe = str(proc.info.get("exe") or "")
            key = lower
            item = groups.setdefault(
                key,
                {
                    "name": name,
                    "display_name": _friendly_process_name(name),
                    "pids": [],
                    "pid": pid,
                    "exe": exe,
                    "memory_mb": 0.0,
                    "process_count": 0,
                    "window_titles": [],
                    "is_foreground": False,
                },
            )
            item["pids"].append(pid)
            item["memory_mb"] = float(item.get("memory_mb") or 0) + memory_mb
            item["process_count"] = int(item.get("process_count") or 0) + 1
            item["window_titles"].extend(titles[:2])
            if foreground_pid == pid:
                item["is_foreground"] = True
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
        except Exception:
            continue

    rows = list(groups.values())
    rows.sort(
        key=lambda item: (
            1 if item.get("is_foreground") else 0,
            len(item.get("window_titles") or []),
            float(item.get("memory_mb") or 0),
        ),
        reverse=True,
    )
    rows = rows[: max(1, int(limit or 12))]
    if not rows:
        return ActionResult.ok("Không thấy ứng dụng đang mở.", running_apps=[])

    lines = ["Máy đang mở:"]
    for index, item in enumerate(rows, 1):
        marker = " [đang dùng]" if item.get("is_foreground") else ""
        process_note = f", {item['process_count']} tiến trình" if int(item.get("process_count") or 0) > 1 else ""
        lines.append(
            f"{index}. {item['display_name']}{marker} - {_format_memory_mb(float(item['memory_mb']))}{process_note}"
        )
        titles = []
        for title in item.get("window_titles") or []:
            if title not in titles:
                titles.append(title)
            if len(titles) >= 2:
                break
        if titles:
            preview = " | ".join(title[:70] for title in titles)
            lines.append(f"   Cửa sổ: {preview}")
    lines.append("\nBấm số bên dưới để chọn ứng dụng và xem các hành động. Nếu muốn đóng một cửa sổ cụ thể, gửi: cửa sổ đang mở.")

    choices = [
        f"{item['display_name']} - {_format_memory_mb(float(item['memory_mb']))}"
        for item in rows
    ]
    result = ActionResult.need_choice(
        message="\n".join(lines),
        choices=choices,
        action="running_app",
    )
    result.data["processes"] = rows
    result.data["choices_already_in_message"] = True
    return result


def close_process_id(pid: int = 0, name: str = "", pids: list[int] | None = None) -> ActionResult:
    target_pids = [int(item) for item in (pids or []) if int(item or 0) > 0]
    if not target_pids and int(pid or 0) > 0:
        target_pids = [int(pid)]
    if not target_pids:
        return ActionResult.err("Không tìm thấy process để tắt.", code=ErrorCode.PROCESS_UNKNOWN)

    closed = 0
    denied = 0
    try:
        for target_pid in target_pids:
            try:
                proc = psutil.Process(target_pid)
                proc.terminate()
                try:
                    proc.wait(timeout=3)
                except psutil.TimeoutExpired:
                    proc.kill()
                closed += 1
            except psutil.NoSuchProcess:
                continue
            except psutil.AccessDenied:
                denied += 1
        display_name = name or "ứng dụng"
        if closed:
            return ActionResult.ok(f"Đã đóng toàn bộ {display_name}.")
        if denied:
            return ActionResult.err("Không đủ quyền để tắt ứng dụng này.", code=ErrorCode.NOT_ALLOWED)
        return ActionResult.err("Ứng dụng này không còn chạy.", code=ErrorCode.PROCESS_UNKNOWN)
    except Exception as exc:
        return ActionResult.err(f"Không thể tắt process: {exc}", code=ErrorCode.UNKNOWN)


def close_browser_apps() -> ActionResult:
    results = [
        close_app("edge", prefer_active=False, close_all=True),
        close_app("chrome", prefer_active=False, close_all=True),
    ]
    successes = [item for item in results if item.status == ActionStatus.SUCCESS]
    if successes:
        return ActionResult.ok(
            "Đã đóng các trình duyệt đang chạy:\n"
            + "\n".join(item.message for item in successes),
            closed_count=len(successes),
        )
    return ActionResult.ok("Không thấy Edge/Chrome đang chạy để đóng.", closed_count=0)


def close_visible_running_apps(limit: int = 30) -> ActionResult:
    listed = list_running_apps(limit=limit)
    processes = list(listed.data.get("processes") or [])
    if not processes:
        return ActionResult.ok("Không thấy ứng dụng đang mở để đóng.", closed_count=0)

    current_pid = os.getpid()
    closed_messages: list[str] = []
    failed_messages: list[str] = []
    for item in processes:
        pids = [
            int(pid)
            for pid in list(item.get("pids") or [])
            if int(pid or 0) > 0 and int(pid or 0) != current_pid
        ]
        if not pids:
            continue
        name = str(item.get("display_name") or item.get("name") or "").strip()
        result = close_process_id(pids=pids, name=name)
        if result.status == ActionStatus.SUCCESS:
            closed_messages.append(result.message)
        else:
            failed_messages.append(result.message)

    if closed_messages:
        message = "Đã đóng các ứng dụng đang mở:\n" + "\n".join(closed_messages)
        if failed_messages:
            message += "\nKhông đóng được:\n" + "\n".join(failed_messages[:5])
        return ActionResult.ok(
            message,
            closed_count=len(closed_messages),
            failed_count=len(failed_messages),
        )
    if failed_messages:
        return ActionResult.err(
            "Không đóng được ứng dụng nào:\n" + "\n".join(failed_messages[:5]),
            code=ErrorCode.UNKNOWN,
            failed_count=len(failed_messages),
        )
    return ActionResult.ok("Không có ứng dụng phù hợp để đóng.", closed_count=0)


def _format_scheduled_close_action(action: str, args: dict[str, Any]) -> str:
    if action == "close_app":
        app_name = str(args.get("app_name") or "ứng dụng").strip()
        return f"đóng {app_name}"
    if action == "close_browsers":
        return "đóng web/browser đang chạy"
    if action == "close_current_tab":
        return "đóng tab hiện tại"
    if action == "close_running_apps":
        return "đóng các ứng dụng đang mở"
    return action


def _coerce_warning_minutes(value: Any, delay_seconds: int) -> int:
    if value is None or value == "":
        minutes = DEFAULT_SCHEDULE_WARNING_MINUTES
    else:
        try:
            minutes = int(float(value))
        except (TypeError, ValueError):
            minutes = DEFAULT_SCHEDULE_WARNING_MINUTES
    minutes = max(0, min(minutes, 24 * 60))
    if minutes <= 0 or delay_seconds <= minutes * 60:
        return 0
    return minutes


def _show_schedule_warning(title: str, message: str) -> None:
    try:
        ctypes.windll.user32.MessageBoxW(
            0,
            str(message or ""),
            str(title or "AT Assistant"),
            0x00001000 | 0x00000030,
        )
    except Exception:
        try:
            print(f"{title}: {message}")
        except Exception:
            pass


def _show_schedule_warning_async(title: str, message: str) -> threading.Thread:
    thread = threading.Thread(
        target=lambda: _show_schedule_warning(title, message),
        daemon=True,
    )
    thread.start()
    return thread


def _start_schedule_warning_timer(
    *,
    delay_seconds: int,
    warning_minutes: int,
    title: str,
    message: str,
) -> threading.Timer | None:
    warning_seconds = int(warning_minutes or 0) * 60
    if warning_seconds <= 0 or delay_seconds <= warning_seconds:
        return None
    timer = threading.Timer(
        max(0, int(delay_seconds) - warning_seconds),
        lambda: _show_schedule_warning(title, message),
    )
    timer.daemon = True
    timer.start()
    return timer


def _run_scheduled_close_action(action: str, args: dict[str, Any]) -> ActionResult:
    if action == "close_app":
        return close_app(
            app_name=str(args.get("app_name") or ""),
            close_all=bool(args.get("close_all", False)),
            prefer_active=False,
        )
    if action == "close_browsers":
        return close_browser_apps()
    if action == "close_current_tab":
        return browser_control("close_tab")
    if action == "close_running_apps":
        return close_visible_running_apps(limit=int(args.get("limit") or 30))
    return ActionResult.err("Lệnh hẹn đóng không hợp lệ.", code=ErrorCode.UNKNOWN)


def _new_scheduled_close_id() -> str:
    return f"close_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{int(time.time() * 1000) % 1000:03d}"


def _scheduled_close_target_at(delay_seconds: int, target_at: str = "") -> str:
    target = (target_at or "").strip()
    if target:
        return target
    return (datetime.now().astimezone() + timedelta(seconds=delay_seconds)).isoformat()


def _list_scheduled_close_tasks() -> ActionResult:
    with _SCHEDULED_CLOSE_LOCK:
        pending = [
            {
                key: value
                for key, value in dict(task).items()
                if key not in {"timer", "warning_timer"}
            }
            for task in _SCHEDULED_CLOSE_TASKS.values()
            if str(task.get("status") or "") == "pending"
        ]
    if not pending:
        return ActionResult.ok("Chưa có lịch đóng app/web nào đang chờ.", scheduled_close_tasks=[])

    lines = ["Lịch đóng app/web đang chờ:"]
    for item in pending:
        repeat_label = " hàng ngày" if item.get("repeat") == "daily" else ""
        warning_label = ""
        if int(item.get("warning_minutes") or 0) > 0:
            warning_label = f", cảnh báo trước {int(item.get('warning_minutes') or 0)} phút"
        lines.append(
            f"- {item['id']}: {_format_scheduled_close_action(str(item.get('action') or ''), dict(item.get('args') or {}))} lúc {_format_power_target(str(item.get('target_at') or ''))}{repeat_label}{warning_label}"
        )
    return ActionResult.ok("\n".join(lines), scheduled_close_tasks=pending)


def _cancel_scheduled_close_tasks(task_id: str = "") -> ActionResult:
    cancelled = 0
    with _SCHEDULED_CLOSE_LOCK:
        tasks = list(_SCHEDULED_CLOSE_TASKS.values())
        for task in tasks:
            if task_id and task.get("id") != task_id:
                continue
            if str(task.get("status") or "") != "pending":
                continue
            timer = task.get("timer")
            try:
                timer.cancel()
            except Exception:
                pass
            warning_timer = task.get("warning_timer")
            try:
                warning_timer.cancel()
            except Exception:
                pass
            task["status"] = "cancelled"
            cancelled += 1
    if cancelled:
        return ActionResult.ok(f"Đã hủy {cancelled} lịch đóng app/web.", cancelled_count=cancelled)
    return ActionResult.ok("Không có lịch đóng app/web nào đang chờ để hủy.", cancelled_count=0)


def schedule_close(
    action: str,
    delay_seconds: int = 0,
    target_at: str = "",
    task_id: str = "",
    repeat: str = "",
    warning_minutes: int | None = None,
    **args: Any,
) -> ActionResult:
    action = (action or "").strip().lower()
    if action in {"status", "list"}:
        return _list_scheduled_close_tasks()
    if action == "cancel":
        return _cancel_scheduled_close_tasks(task_id=task_id)

    seconds = _coerce_shutdown_delay(delay_seconds)
    if seconds <= 0:
        return ActionResult.err("Thiếu thời gian hẹn đóng app/web.", code=ErrorCode.UNKNOWN)

    task_args = dict(args)
    target = _scheduled_close_target_at(seconds, target_at)
    task_id = task_id or _new_scheduled_close_id()
    repeat = (repeat or "").strip().lower()
    warning_value = _coerce_warning_minutes(warning_minutes, seconds)

    def run_task() -> None:
        with _SCHEDULED_CLOSE_LOCK:
            task = _SCHEDULED_CLOSE_TASKS.get(task_id)
            if not task or task.get("status") != "pending":
                return
            task["status"] = "running"
        result = _run_scheduled_close_action(action, task_args)
        with _SCHEDULED_CLOSE_LOCK:
            task = _SCHEDULED_CLOSE_TASKS.get(task_id)
            if task:
                task["status"] = "completed" if result.status == ActionStatus.SUCCESS else "failed"
                task["result_message"] = result.message
        if repeat == "daily":
            try:
                next_target = datetime.fromisoformat(target) + timedelta(seconds=SECONDS_PER_DAY)
            except ValueError:
                next_target = datetime.now().astimezone() + timedelta(seconds=SECONDS_PER_DAY)
            schedule_close(
                action,
                delay_seconds=SECONDS_PER_DAY,
                target_at=next_target.isoformat(),
                task_id=task_id,
                repeat=repeat,
                warning_minutes=warning_value,
                **task_args,
            )

    timer = threading.Timer(seconds, run_task)
    timer.daemon = True
    warning_timer = _start_schedule_warning_timer(
        delay_seconds=seconds,
        warning_minutes=warning_value,
        title="Sắp đóng app/web",
        message=(
            f"Còn khoảng {warning_value} phút nữa AT Assistant sẽ "
            f"{_format_scheduled_close_action(action, task_args)}."
        ),
    )
    with _SCHEDULED_CLOSE_LOCK:
        _SCHEDULED_CLOSE_TASKS[task_id] = {
            "id": task_id,
            "action": action,
            "args": task_args,
            "delay_seconds": seconds,
            "target_at": target,
            "created_at": datetime.now().astimezone().isoformat(),
            "status": "pending",
            "repeat": repeat,
            "warning_minutes": warning_value,
            "timer": timer,
            "warning_timer": warning_timer,
        }
    timer.start()

    return ActionResult.ok(
        f"Đã hẹn {_format_scheduled_close_action(action, task_args)} lúc {_format_power_target(target)} "
        f"(sau khoảng {_format_power_delay(seconds)})"
        + (" và lặp lại hàng ngày" if repeat == "daily" else "")
        + (f". Sẽ cảnh báo trước {warning_value} phút" if warning_value else "")
        + ". Lịch này chỉ chạy nếu AT Assistant còn đang chạy nền.",
        scheduled_close_task={
            "id": task_id,
            "action": action,
            "args": task_args,
            "delay_seconds": seconds,
            "target_at": target,
            "status": "pending",
            "repeat": repeat,
            "warning_minutes": warning_value,
        },
    )


def _normalize_match_text(value: str) -> str:
    folded = unicodedata.normalize("NFD", str(value or "").lower())
    folded = "".join(ch for ch in folded if unicodedata.category(ch) != "Mn")
    folded = re.sub(r"[^a-z0-9\s._-]", " ", folded)
    return re.sub(r"\s+", " ", folded).strip()


def _process_matches_app(item: dict[str, Any], app_key: str) -> bool:
    key = _norm_app_key(app_key)
    if not key:
        return False
    process_name = str(item.get("name") or "").lower()
    display_name = _normalize_match_text(str(item.get("display_name") or ""))
    exe = _normalize_match_text(str(item.get("exe") or ""))
    canonical_process = PROCESS_NAME.get(key, "").lower()
    aliases = [key, *APP_QUERY_ALIASES.get(key, []), *[alias for alias, canonical in APP_ALIASES.items() if canonical == key]]
    if canonical_process and process_name == canonical_process:
        return True
    return any(_normalize_match_text(alias) in display_name or _normalize_match_text(alias) in exe for alias in aliases)


def close_heavy_apps(limit: int = 3, min_memory_mb: int = 300) -> ActionResult:
    listed = list_running_apps(limit=30)
    processes = list(listed.data.get("processes") or [])
    if not processes:
        return ActionResult.ok("Không thấy ứng dụng đang mở để đóng.", closed_count=0)

    current_pid = os.getpid()
    candidates = [
        item
        for item in processes
        if float(item.get("memory_mb") or 0) >= max(0, int(min_memory_mb or 0))
        and current_pid not in [int(pid or 0) for pid in list(item.get("pids") or [])]
    ]
    candidates.sort(key=lambda item: float(item.get("memory_mb") or 0), reverse=True)
    candidates = candidates[: max(1, min(10, int(limit or 3)))]
    if not candidates:
        return ActionResult.ok(
            f"Không có ứng dụng đang mở nào dùng từ {int(min_memory_mb or 0)} MB RAM trở lên.",
            closed_count=0,
        )

    closed_messages: list[str] = []
    failed_messages: list[str] = []
    for item in candidates:
        name = str(item.get("display_name") or item.get("name") or "ứng dụng").strip()
        result = close_process_id(
            pids=[int(pid) for pid in list(item.get("pids") or []) if int(pid or 0) > 0],
            name=name,
        )
        if result.status == ActionStatus.SUCCESS:
            closed_messages.append(f"{name} ({_format_memory_mb(float(item.get('memory_mb') or 0))})")
        else:
            failed_messages.append(f"{name}: {result.message}")

    if closed_messages:
        message = "Đã đóng app nặng:\n" + "\n".join(f"- {line}" for line in closed_messages)
        if failed_messages:
            message += "\nKhông đóng được:\n" + "\n".join(f"- {line}" for line in failed_messages[:5])
        return ActionResult.ok(message, closed_count=len(closed_messages), failed_count=len(failed_messages))
    return ActionResult.err(
        "Không đóng được app nặng nào:\n" + "\n".join(failed_messages[:5]),
        code=ErrorCode.UNKNOWN,
        closed_count=0,
        failed_count=len(failed_messages),
    )


def close_visible_running_apps_except(except_apps: list[str] | None = None, limit: int = 30) -> ActionResult:
    keep = [_norm_app_key(item) for item in list(except_apps or []) if str(item or "").strip()]
    listed = list_running_apps(limit=limit)
    processes = list(listed.data.get("processes") or [])
    if not processes:
        return ActionResult.ok("Không thấy ứng dụng đang mở để đóng.", closed_count=0, kept_apps=keep)

    current_pid = os.getpid()
    closed_messages: list[str] = []
    failed_messages: list[str] = []
    kept_messages: list[str] = []
    for item in processes:
        name = str(item.get("display_name") or item.get("name") or "ứng dụng").strip()
        if any(_process_matches_app(item, app_key) for app_key in keep):
            kept_messages.append(name)
            continue
        pids = [
            int(pid)
            for pid in list(item.get("pids") or [])
            if int(pid or 0) > 0 and int(pid or 0) != current_pid
        ]
        if not pids:
            continue
        result = close_process_id(pids=pids, name=name)
        if result.status == ActionStatus.SUCCESS:
            closed_messages.append(name)
        else:
            failed_messages.append(f"{name}: {result.message}")

    lines = []
    if closed_messages:
        lines.append("Đã đóng các ứng dụng đang mở, trừ danh sách giữ lại:")
        lines.extend(f"- {name}" for name in closed_messages)
    else:
        lines.append("Không có ứng dụng phù hợp để đóng.")
    if kept_messages:
        lines.append("Đã giữ lại: " + ", ".join(dict.fromkeys(kept_messages)))
    if failed_messages:
        lines.append("Không đóng được:\n" + "\n".join(f"- {line}" for line in failed_messages[:5]))
    return ActionResult.ok(
        "\n".join(lines),
        closed_count=len(closed_messages),
        failed_count=len(failed_messages),
        kept_apps=keep,
    )


def close_distracting_web(keywords: list[str] | None = None) -> ActionResult:
    patterns = {_normalize_match_text(item) for item in (keywords or []) if str(item or "").strip()}
    if not patterns:
        patterns = set(DISTRACTING_WEB_KEYWORDS)

    try:
        tabs, browser, port = _fetch_browser_debug_tabs("")
    except Exception as exc:
        return ActionResult.need_clarify(
            message=(
                "Chưa đọc được tab browser để đóng web giải trí. "
                "Hãy mở Edge/Chrome bằng chế độ remote trước."
            ),
            question=f"Gửi: mở edge remote. Chi tiết: {exc}",
        )

    matches: list[dict[str, Any]] = []
    for tab in tabs:
        haystack = _normalize_match_text(f"{tab.get('title') or ''} {tab.get('url') or ''}")
        if any(pattern and pattern in haystack for pattern in patterns):
            matches.append(tab)

    if not matches:
        return ActionResult.ok("Không thấy tab web giải trí nào đang mở.", closed_count=0)

    closed: list[str] = []
    failed: list[str] = []
    for tab in matches:
        result = browser_tab_control(
            "close",
            tab_id=str(tab.get("id") or ""),
            port=int(tab.get("port") or port or 0),
            title=str(tab.get("title") or ""),
            url=str(tab.get("url") or ""),
        )
        title = str(tab.get("title") or tab.get("url") or "tab").strip()
        if result.status == ActionStatus.SUCCESS:
            closed.append(title)
        else:
            failed.append(f"{title}: {result.message}")

    message = f"Đã đóng {len(closed)} tab web giải trí trên {browser}."
    if closed:
        message += "\n" + "\n".join(f"- {title[:100]}" for title in closed[:10])
    if failed:
        message += "\nKhông đóng được:\n" + "\n".join(f"- {line}" for line in failed[:5])
    return ActionResult.ok(message, closed_count=len(closed), failed_count=len(failed))


def _format_scheduled_open_action(action: str, args: dict[str, Any]) -> str:
    if action == "open_app":
        return f"mở {str(args.get('app_name') or 'ứng dụng').strip()}"
    if action == "open_url":
        return f"mở {str(args.get('url') or 'web').strip()}"
    return action


def _new_scheduled_open_id() -> str:
    return f"open_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{int(time.time() * 1000) % 1000:03d}"


def _run_scheduled_open_action(action: str, args: dict[str, Any]) -> ActionResult:
    if action == "open_app":
        return open_app(str(args.get("app_name") or ""))
    if action == "open_url":
        return open_url(str(args.get("url") or ""), browser=str(args.get("browser") or "default"))
    return ActionResult.err("Lệnh hẹn mở không hợp lệ.", code=ErrorCode.UNKNOWN)


def _list_scheduled_open_tasks() -> ActionResult:
    with _SCHEDULED_OPEN_LOCK:
        pending = [
            {key: value for key, value in dict(task).items() if key not in {"timer", "warning_timer"}}
            for task in _SCHEDULED_OPEN_TASKS.values()
            if str(task.get("status") or "") == "pending"
        ]
    if not pending:
        return ActionResult.ok("Chưa có lịch mở app/web nào đang chờ.", scheduled_open_tasks=[])

    lines = ["Lịch mở app/web đang chờ:"]
    for item in pending:
        repeat_label = " hàng ngày" if item.get("repeat") == "daily" else ""
        warning = int(item.get("warning_minutes") or 0)
        warning_label = f", cảnh báo trước {warning} phút" if warning else ""
        lines.append(
            f"- {item['id']}: {_format_scheduled_open_action(str(item.get('action') or ''), dict(item.get('args') or {}))} lúc {_format_power_target(str(item.get('target_at') or ''))}{repeat_label}{warning_label}"
        )
    return ActionResult.ok("\n".join(lines), scheduled_open_tasks=pending)


def _cancel_scheduled_open_tasks(task_id: str = "") -> ActionResult:
    cancelled = 0
    with _SCHEDULED_OPEN_LOCK:
        for task in list(_SCHEDULED_OPEN_TASKS.values()):
            if task_id and task.get("id") != task_id:
                continue
            if str(task.get("status") or "") != "pending":
                continue
            for timer_key in ("timer", "warning_timer"):
                try:
                    task.get(timer_key).cancel()
                except Exception:
                    pass
            task["status"] = "cancelled"
            cancelled += 1
    if cancelled:
        return ActionResult.ok(f"Đã hủy {cancelled} lịch mở app/web.", cancelled_count=cancelled)
    return ActionResult.ok("Không có lịch mở app/web nào đang chờ để hủy.", cancelled_count=0)


def schedule_open(
    action: str,
    delay_seconds: int = 0,
    target_at: str = "",
    task_id: str = "",
    repeat: str = "",
    warning_minutes: int | None = None,
    **args: Any,
) -> ActionResult:
    action = (action or "").strip().lower()
    if action in {"status", "list"}:
        return _list_scheduled_open_tasks()
    if action == "cancel":
        return _cancel_scheduled_open_tasks(task_id=task_id)

    seconds = _coerce_shutdown_delay(delay_seconds)
    if seconds <= 0:
        return ActionResult.err("Thiếu thời gian hẹn mở app/web.", code=ErrorCode.UNKNOWN)
    if action not in {"open_app", "open_url"}:
        return ActionResult.err("Lệnh hẹn mở không hợp lệ.", code=ErrorCode.UNKNOWN)

    task_args = dict(args)
    target = _scheduled_close_target_at(seconds, target_at)
    task_id = task_id or _new_scheduled_open_id()
    repeat = (repeat or "").strip().lower()
    warning_value = _coerce_warning_minutes(warning_minutes, seconds)

    def run_task() -> None:
        with _SCHEDULED_OPEN_LOCK:
            task = _SCHEDULED_OPEN_TASKS.get(task_id)
            if not task or task.get("status") != "pending":
                return
            task["status"] = "running"
        result = _run_scheduled_open_action(action, task_args)
        with _SCHEDULED_OPEN_LOCK:
            task = _SCHEDULED_OPEN_TASKS.get(task_id)
            if task:
                task["status"] = "completed" if result.status == ActionStatus.SUCCESS else "failed"
                task["result_message"] = result.message
        if repeat == "daily":
            try:
                next_target = datetime.fromisoformat(target) + timedelta(seconds=SECONDS_PER_DAY)
            except ValueError:
                next_target = datetime.now().astimezone() + timedelta(seconds=SECONDS_PER_DAY)
            schedule_open(
                action,
                delay_seconds=SECONDS_PER_DAY,
                target_at=next_target.isoformat(),
                task_id=task_id,
                repeat=repeat,
                warning_minutes=warning_value,
                **task_args,
            )

    timer = threading.Timer(seconds, run_task)
    timer.daemon = True
    warning_timer = _start_schedule_warning_timer(
        delay_seconds=seconds,
        warning_minutes=warning_value,
        title="Sắp mở app/web",
        message=(
            f"Còn khoảng {warning_value} phút nữa AT Assistant sẽ "
            f"{_format_scheduled_open_action(action, task_args)}."
        ),
    )
    with _SCHEDULED_OPEN_LOCK:
        _SCHEDULED_OPEN_TASKS[task_id] = {
            "id": task_id,
            "action": action,
            "args": task_args,
            "delay_seconds": seconds,
            "target_at": target,
            "created_at": datetime.now().astimezone().isoformat(),
            "status": "pending",
            "repeat": repeat,
            "warning_minutes": warning_value,
            "timer": timer,
            "warning_timer": warning_timer,
        }
    timer.start()

    return ActionResult.ok(
        f"Đã hẹn {_format_scheduled_open_action(action, task_args)} lúc {_format_power_target(target)} "
        f"(sau khoảng {_format_power_delay(seconds)})"
        + (" và lặp lại hàng ngày" if repeat == "daily" else "")
        + (f". Sẽ cảnh báo trước {warning_value} phút" if warning_value else "")
        + ". Lịch này chỉ chạy nếu AT Assistant còn đang chạy nền.",
        scheduled_open_task={
            "id": task_id,
            "action": action,
            "args": task_args,
            "delay_seconds": seconds,
            "target_at": target,
            "status": "pending",
            "repeat": repeat,
            "warning_minutes": warning_value,
        },
    )


def clipboard_bridge(action: str, text: str = "") -> ActionResult:
    action = (action or "").strip().lower()
    try:
        if action in {"set", "copy_to_pc", "write"}:
            value = str(text or "")
            if not value:
                return ActionResult.need_clarify(
                    message="Mình chưa có nội dung để đưa vào clipboard máy.",
                    question="Bạn muốn copy nội dung gì vào máy?",
                )
            win32clipboard.OpenClipboard()
            try:
                win32clipboard.EmptyClipboard()
                win32clipboard.SetClipboardData(win32con.CF_UNICODETEXT, value)
            finally:
                win32clipboard.CloseClipboard()
            preview = value if len(value) <= 200 else value[:200] + "..."
            return ActionResult.ok(f"Đã đưa nội dung vào clipboard máy:\n{preview}", clipboard_text=value)

        if action in {"get", "send_to_telegram", "read"}:
            win32clipboard.OpenClipboard()
            try:
                if not win32clipboard.IsClipboardFormatAvailable(win32con.CF_UNICODETEXT):
                    return ActionResult.ok("Clipboard máy hiện không có text.", clipboard_text="")
                value = win32clipboard.GetClipboardData(win32con.CF_UNICODETEXT)
            finally:
                win32clipboard.CloseClipboard()
            value = str(value or "")
            if not value:
                return ActionResult.ok("Clipboard máy hiện đang rỗng.", clipboard_text="")
            return ActionResult.ok("Clipboard máy:\n" + value[:3500], clipboard_text=value)

        if action == "clear":
            win32clipboard.OpenClipboard()
            try:
                win32clipboard.EmptyClipboard()
            finally:
                win32clipboard.CloseClipboard()
            return ActionResult.ok("Đã xóa clipboard máy.", clipboard_text="")
        return ActionResult.err("Lệnh clipboard không hợp lệ.", code=ErrorCode.UNKNOWN)
    except Exception as exc:
        return ActionResult.err(f"Không thể thao tác clipboard: {exc}", code=ErrorCode.UNKNOWN)


class _LASTINPUTINFO(ctypes.Structure):
    _fields_ = [("cbSize", ctypes.c_uint), ("dwTime", ctypes.c_uint)]


def _get_idle_seconds() -> int:
    info = _LASTINPUTINFO()
    info.cbSize = ctypes.sizeof(_LASTINPUTINFO)
    if not ctypes.windll.user32.GetLastInputInfo(ctypes.byref(info)):
        return 0
    elapsed_ms = ctypes.windll.kernel32.GetTickCount() - info.dwTime
    return max(0, int(elapsed_ms / 1000))


def _coerce_day_minute(value: Any, fallback: int = 0) -> int:
    try:
        minutes = int(value)
    except (TypeError, ValueError):
        minutes = int(fallback or 0)
    return max(0, min(24 * 60 - 1, minutes))


def _format_day_minute(value: Any) -> str:
    minutes = _coerce_day_minute(value)
    hour, minute = divmod(minutes, 60)
    return f"{hour:02d}:{minute:02d}"


def _within_idle_guard_window(now: datetime, start_minutes: int, end_minutes: int) -> bool:
    start = _coerce_day_minute(start_minutes)
    end = _coerce_day_minute(end_minutes)
    current = now.hour * 60 + now.minute
    if start == end:
        return True
    if start < end:
        return start <= current < end
    return current >= start or current < end


def _public_idle_guard_state() -> dict[str, Any]:
    return {key: value for key, value in dict(_IDLE_GUARD_STATE).items() if key not in {"timer", "grace_timer"}}


def _cancel_idle_guard_timers() -> None:
    for key in ("timer", "grace_timer"):
        timer = _IDLE_GUARD_STATE.pop(key, None)
        try:
            timer.cancel()
        except Exception:
            pass


def _schedule_idle_guard_tick(interval_seconds: int = 60) -> None:
    timer = threading.Timer(max(5, int(interval_seconds or 60)), _idle_guard_tick)
    timer.daemon = True
    _IDLE_GUARD_STATE["timer"] = timer
    timer.start()


def _run_idle_guard_power_action(power_action: str, idle_minutes: int) -> None:
    with _IDLE_GUARD_LOCK:
        if not _IDLE_GUARD_STATE.get("enabled"):
            return
    if _get_idle_seconds() < max(1, int(idle_minutes or 1)) * 60:
        return
    system_power(power_action)


def _idle_guard_tick() -> None:
    with _IDLE_GUARD_LOCK:
        state = dict(_IDLE_GUARD_STATE)
    if not state.get("enabled"):
        return

    now = datetime.now().astimezone()
    idle_minutes = max(1, int(state.get("idle_minutes") or 45))
    start_minutes = _coerce_day_minute(
        state.get("start_minutes"),
        int(state.get("start_hour") or 23) * 60,
    )
    end_minutes = _coerce_day_minute(
        state.get("end_minutes"),
        int(state.get("end_hour") or 6) * 60,
    )
    power_action = str(state.get("power_action") or "hibernate")
    grace_minutes = max(0, int(state.get("grace_minutes") or 10))
    today_key = now.strftime("%Y-%m-%d")

    if (
        _within_idle_guard_window(now, start_minutes, end_minutes)
        and _get_idle_seconds() >= idle_minutes * 60
        and state.get("last_triggered_date") != today_key
    ):
        with _IDLE_GUARD_LOCK:
            _IDLE_GUARD_STATE["last_triggered_date"] = today_key
        if grace_minutes > 0:
            grace_timer = threading.Timer(
                grace_minutes * 60,
                lambda: _run_idle_guard_power_action(power_action, idle_minutes),
            )
            grace_timer.daemon = True
            with _IDLE_GUARD_LOCK:
                _IDLE_GUARD_STATE["grace_timer"] = grace_timer
            grace_timer.start()
        else:
            _run_idle_guard_power_action(power_action, idle_minutes)
        _show_schedule_warning_async(
            "Chế độ ngủ quên",
            (
                f"Máy đã không thao tác khoảng {idle_minutes} phút. "
                f"AT Assistant sẽ {power_action} sau {grace_minutes} phút nếu bạn vẫn không dùng máy."
            ),
        )

    with _IDLE_GUARD_LOCK:
        if _IDLE_GUARD_STATE.get("enabled"):
            _schedule_idle_guard_tick()


def lazy_idle_guard(
    action: str = "enable",
    idle_minutes: int = 45,
    start_hour: int = 23,
    end_hour: int = 6,
    start_minutes: int | None = None,
    end_minutes: int | None = None,
    grace_minutes: int = 10,
    power_action: str = "hibernate",
) -> ActionResult:
    action = (action or "").strip().lower()
    if action in {"status", "list"}:
        state = _public_idle_guard_state()
        if not state.get("enabled"):
            return ActionResult.ok("Chế độ ngủ quên đang tắt.", idle_guard=state)
        return ActionResult.ok(
            (
                "Chế độ ngủ quên đang bật: "
                f"idle {state.get('idle_minutes')} phút, khung "
                f"{_format_day_minute(state.get('start_minutes', int(state.get('start_hour') or 23) * 60))}-"
                f"{_format_day_minute(state.get('end_minutes', int(state.get('end_hour') or 6) * 60))}, "
                f"chờ thêm {state.get('grace_minutes')} phút rồi "
                f"{state.get('power_action')}."
            ),
            idle_guard=state,
        )
    if action in {"disable", "cancel", "off"}:
        with _IDLE_GUARD_LOCK:
            _cancel_idle_guard_timers()
            _IDLE_GUARD_STATE.clear()
        return ActionResult.ok("Đã tắt chế độ ngủ quên.", idle_guard={})
    if action not in {"enable", "on"}:
        return ActionResult.err("Lệnh chế độ ngủ quên không hợp lệ.", code=ErrorCode.UNKNOWN)

    idle = max(1, min(24 * 60, int(idle_minutes or 45)))
    start = _coerce_day_minute(start_minutes, int(start_hour or 23) * 60)
    end = _coerce_day_minute(end_minutes, int(end_hour or 6) * 60)
    grace = max(0, min(120, int(grace_minutes or 10)))
    power = (power_action or "hibernate").strip().lower()
    if power not in {"hibernate", "light_sleep", "lock", "monitor_off", "shutdown"}:
        power = "hibernate"

    with _IDLE_GUARD_LOCK:
        _cancel_idle_guard_timers()
        _IDLE_GUARD_STATE.clear()
        _IDLE_GUARD_STATE.update(
            {
                "enabled": True,
                "idle_minutes": idle,
                "start_hour": start // 60,
                "end_hour": end // 60,
                "start_minutes": start,
                "end_minutes": end,
                "grace_minutes": grace,
                "power_action": power,
                "created_at": datetime.now().astimezone().isoformat(),
                "last_triggered_date": "",
            }
        )
        _schedule_idle_guard_tick(interval_seconds=60)
    return ActionResult.ok(
        (
            f"Đã bật chế độ ngủ quên: trong khung {_format_day_minute(start)}-{_format_day_minute(end)}, nếu máy idle {idle} phút "
            f"thì cảnh báo và chờ {grace} phút rồi {power}. AT Assistant cần còn chạy nền."
        ),
        idle_guard=_public_idle_guard_state(),
    )


def _coerce_shutdown_delay(delay_seconds: Any) -> int:
    try:
        seconds = int(float(delay_seconds or 0))
    except (TypeError, ValueError):
        return 0
    return max(0, min(seconds, MAX_SHUTDOWN_DELAY_SECONDS))


def _format_power_delay(seconds: int) -> str:
    seconds = max(0, int(seconds or 0))
    hours, remainder = divmod(seconds, 3600)
    minutes, secs = divmod(remainder, 60)
    parts: list[str] = []
    if hours:
        parts.append(f"{hours} giờ")
    if minutes:
        parts.append(f"{minutes} phút")
    if secs or not parts:
        parts.append(f"{secs} giây")
    return " ".join(parts)


def _format_power_target(target_at: str) -> str:
    value = (target_at or "").strip()
    if not value:
        return ""
    try:
        target = datetime.fromisoformat(value)
    except ValueError:
        return value
    return target.strftime("%H:%M %d/%m/%Y")


def _run_shutdown_command(args: list[str]) -> None:
    completed = subprocess.run(args, capture_output=True, text=True, check=False)
    if completed.returncode == 0:
        return
    detail = (completed.stderr or completed.stdout or "").strip()
    if not detail:
        detail = f"exit code {completed.returncode}"
    raise RuntimeError(detail)


def _public_scheduled_power_state() -> dict[str, Any]:
    return {
        key: value
        for key, value in dict(_SCHEDULED_POWER_STATE).items()
        if key not in {"timer", "warning_timer"}
    }


def _cancel_power_timers() -> None:
    for key in ("timer", "warning_timer"):
        timer = _SCHEDULED_POWER_TIMERS.pop(key, None)
        try:
            timer.cancel()
        except Exception:
            pass


def _run_power_now(action: str) -> ActionResult:
    if action == "shutdown":
        subprocess.Popen(["shutdown", "/s", "/t", "0"])
        return ActionResult.ok("Đang tắt máy.")
    if action == "restart":
        subprocess.Popen(["shutdown", "/r", "/t", "0"])
        return ActionResult.ok("Đang khởi động lại máy.")
    return ActionResult.err("Lệnh nguồn máy không hợp lệ.", code=ErrorCode.UNKNOWN)


def _record_scheduled_power(
    action: str,
    delay_seconds: int,
    target_at: str = "",
    *,
    repeat: str = "",
    warning_minutes: int = 0,
) -> str:
    target = (target_at or "").strip()
    if not target:
        target = (datetime.now().astimezone() + timedelta(seconds=delay_seconds)).isoformat()
    _SCHEDULED_POWER_STATE.clear()
    _SCHEDULED_POWER_STATE.update(
        {
            "action": action,
            "delay_seconds": int(delay_seconds),
            "target_at": target,
            "created_at": datetime.now().astimezone().isoformat(),
            "repeat": repeat,
            "warning_minutes": int(warning_minutes or 0),
        }
    )
    return target


def _format_scheduled_power_message(action: str, delay_seconds: int, target_at: str) -> str:
    action_label = "tắt máy" if action == "shutdown" else "khởi động lại máy"
    target_label = _format_power_target(target_at)
    if target_label:
        return (
            f"Đã hẹn {action_label} lúc {target_label} "
            f"(sau khoảng {_format_power_delay(delay_seconds)})."
        )
    return f"Đã hẹn {action_label} sau {_format_power_delay(delay_seconds)}."


def _schedule_power_timer(
    action: str,
    delay_seconds: int,
    target_at: str = "",
    *,
    repeat: str = "",
    warning_minutes: int = 0,
) -> ActionResult:
    _cancel_power_timers()
    target = _record_scheduled_power(
        action,
        delay_seconds,
        target_at,
        repeat=repeat,
        warning_minutes=warning_minutes,
    )

    def run_task() -> None:
        if repeat == "daily":
            try:
                next_target = datetime.fromisoformat(target) + timedelta(seconds=SECONDS_PER_DAY)
            except ValueError:
                next_target = datetime.now().astimezone() + timedelta(seconds=SECONDS_PER_DAY)
            _schedule_power_timer(
                action,
                SECONDS_PER_DAY,
                next_target.isoformat(),
                repeat=repeat,
                warning_minutes=warning_minutes,
            )
        _run_power_now(action)

    timer = threading.Timer(delay_seconds, run_task)
    timer.daemon = True
    _SCHEDULED_POWER_TIMERS["timer"] = timer
    warning_timer = _start_schedule_warning_timer(
        delay_seconds=delay_seconds,
        warning_minutes=warning_minutes,
        title="Sắp tắt/khởi động lại máy",
        message=(
            f"Còn khoảng {warning_minutes} phút nữa máy sẽ "
            f"{'tắt' if action == 'shutdown' else 'khởi động lại'}."
        ),
    )
    if warning_timer is not None:
        _SCHEDULED_POWER_TIMERS["warning_timer"] = warning_timer
    timer.start()

    action_label = "tắt máy" if action == "shutdown" else "khởi động lại máy"
    return ActionResult.ok(
        f"Đã hẹn {action_label} lúc {_format_power_target(target)} "
        f"(sau khoảng {_format_power_delay(delay_seconds)})"
        + (" và lặp lại hàng ngày" if repeat == "daily" else "")
        + (f". Sẽ cảnh báo trước {warning_minutes} phút" if warning_minutes else "")
        + ". Lịch này chỉ chạy nếu AT Assistant còn đang chạy nền.",
        scheduled_power=_public_scheduled_power_state(),
        delay_seconds=delay_seconds,
        target_at=target,
    )


def _handle_night_sleep(
    delay_seconds: int = 0,
    target_at: str = "",
    warning_minutes: int | None = None,
    repeat: str = "",
) -> ActionResult:
    seconds = _coerce_shutdown_delay(delay_seconds) or DEFAULT_NIGHT_SLEEP_SHUTDOWN_SECONDS
    scheduled = system_power(
        "shutdown",
        delay_seconds=seconds,
        target_at=target_at,
        warning_minutes=warning_minutes,
        repeat=repeat,
    )
    if scheduled.status != ActionStatus.SUCCESS:
        return scheduled

    muted = media_control("mute")
    light_sleep = system_power("light_sleep")
    details = [
        "Đã bật chế độ ngủ đêm.",
        scheduled.message,
        "Máy đã được khóa và tắt màn hình.",
    ]
    if muted.status == ActionStatus.SUCCESS:
        details.append("Âm thanh đã được mute.")
    else:
        details.append("Không mute được âm thanh, nhưng lịch tắt máy vẫn đã được đặt.")
    if light_sleep.status != ActionStatus.SUCCESS:
        details.append(light_sleep.message)
    return ActionResult.ok(
        "\n".join(details),
        scheduled_power=dict(_SCHEDULED_POWER_STATE),
        delay_seconds=seconds,
        target_at=_SCHEDULED_POWER_STATE.get("target_at", ""),
    )


def system_power(
    action: str,
    delay_seconds: int = 0,
    target_at: str = "",
    repeat: str = "",
    warning_minutes: int | None = None,
    **_: Any,
) -> ActionResult:
    action = (action or "").strip().lower()
    repeat = (repeat or "").strip().lower()
    try:
        if action in {"shutdown_status", "power_status"}:
            target_at = str(_SCHEDULED_POWER_STATE.get("target_at") or "")
            delay = int(_SCHEDULED_POWER_STATE.get("delay_seconds") or 0)
            scheduled_action = str(_SCHEDULED_POWER_STATE.get("action") or "")
            if target_at and scheduled_action:
                repeat_label = " hàng ngày" if _SCHEDULED_POWER_STATE.get("repeat") == "daily" else ""
                warning_value = int(_SCHEDULED_POWER_STATE.get("warning_minutes") or 0)
                warning_label = f", cảnh báo trước {warning_value} phút" if warning_value else ""
                message = _format_scheduled_power_message(scheduled_action, delay, target_at)
                return ActionResult.ok(
                    f"{message}{repeat_label}{warning_label}",
                    scheduled_power=_public_scheduled_power_state(),
                )
            return ActionResult.ok(
                "AT Assistant chưa ghi nhận lịch tắt máy nào đang chờ. Nếu Windows còn lịch từ trước, bạn có thể hủy bằng lệnh: hủy hẹn giờ tắt máy.",
                scheduled_power={},
            )

        if action == "cancel_shutdown":
            _cancel_power_timers()
            try:
                _run_shutdown_command(["shutdown", "/a"])
            except RuntimeError:
                pass
            _SCHEDULED_POWER_STATE.clear()
            return ActionResult.ok("Đã gửi lệnh hủy lịch tắt máy/khởi động lại nếu Windows đang có lịch chờ.")

        if action in {"night_sleep", "sleep_timer"}:
            return _handle_night_sleep(
                delay_seconds=delay_seconds,
                target_at=target_at,
                warning_minutes=warning_minutes,
                repeat=repeat,
            )

        if action == "shutdown":
            seconds = _coerce_shutdown_delay(delay_seconds)
            if seconds > 0:
                warning_value = _coerce_warning_minutes(warning_minutes, seconds)
                if repeat == "daily":
                    return _schedule_power_timer(
                        "shutdown",
                        seconds,
                        target_at,
                        repeat=repeat,
                        warning_minutes=warning_value,
                    )
                _cancel_power_timers()
                _run_shutdown_command(["shutdown", "/s", "/t", str(seconds)])
                target = _record_scheduled_power(
                    "shutdown",
                    seconds,
                    target_at,
                    repeat=repeat,
                    warning_minutes=warning_value,
                )
                warning_timer = _start_schedule_warning_timer(
                    delay_seconds=seconds,
                    warning_minutes=warning_value,
                    title="Sắp tắt máy",
                    message=f"Còn khoảng {warning_value} phút nữa máy sẽ tắt.",
                )
                if warning_timer is not None:
                    _SCHEDULED_POWER_TIMERS["warning_timer"] = warning_timer
                return ActionResult.ok(
                    _format_scheduled_power_message("shutdown", seconds, target)
                    + (f" Sẽ cảnh báo trước {warning_value} phút." if warning_value else ""),
                    scheduled_power=_public_scheduled_power_state(),
                    delay_seconds=seconds,
                    target_at=target,
                )
            return _run_power_now("shutdown")

        if action == "restart":
            seconds = _coerce_shutdown_delay(delay_seconds)
            if seconds > 0:
                warning_value = _coerce_warning_minutes(warning_minutes, seconds)
                if repeat == "daily":
                    return _schedule_power_timer(
                        "restart",
                        seconds,
                        target_at,
                        repeat=repeat,
                        warning_minutes=warning_value,
                    )
                _cancel_power_timers()
                _run_shutdown_command(["shutdown", "/r", "/t", str(seconds)])
                target = _record_scheduled_power(
                    "restart",
                    seconds,
                    target_at,
                    repeat=repeat,
                    warning_minutes=warning_value,
                )
                warning_timer = _start_schedule_warning_timer(
                    delay_seconds=seconds,
                    warning_minutes=warning_value,
                    title="Sắp khởi động lại máy",
                    message=f"Còn khoảng {warning_value} phút nữa máy sẽ khởi động lại.",
                )
                if warning_timer is not None:
                    _SCHEDULED_POWER_TIMERS["warning_timer"] = warning_timer
                return ActionResult.ok(
                    _format_scheduled_power_message("restart", seconds, target)
                    + (f" Sẽ cảnh báo trước {warning_value} phút." if warning_value else ""),
                    scheduled_power=_public_scheduled_power_state(),
                    delay_seconds=seconds,
                    target_at=target,
                )
            return _run_power_now("restart")

        if action in {"sleep", "sleep_deep"}:
            subprocess.Popen(["rundll32.exe", "powrprof.dll,SetSuspendState", "0,1,0"])
            return ActionResult.ok("Đang chuyển máy sang sleep sâu.")
        if action == "hibernate":
            subprocess.Popen(["shutdown", "/h"])
            return ActionResult.ok("Đang chuyển máy sang hibernate.")
        if action == "lock":
            subprocess.Popen(["rundll32.exe", "user32.dll,LockWorkStation"])
            return ActionResult.ok("Đã khóa máy.")
        if action == "monitor_off":
            _turn_monitor_off()
            return ActionResult.ok("Đã tắt màn hình. Máy vẫn đang chạy.")
        if action == "light_sleep":
            subprocess.Popen(["rundll32.exe", "user32.dll,LockWorkStation"])
            time.sleep(0.2)
            _turn_monitor_off()
            return ActionResult.ok("Đã khóa máy và tắt màn hình. Máy vẫn đang chạy nếu Windows không tự sleep.")
        return ActionResult.err("Lệnh nguồn máy không hợp lệ.", code=ErrorCode.UNKNOWN)
    except Exception as exc:
        return ActionResult.err(f"Không thể thực hiện lệnh nguồn máy: {exc}", code=ErrorCode.UNKNOWN)


def _turn_monitor_off() -> None:
    win32gui.PostMessage(
        win32con.HWND_BROADCAST,
        win32con.WM_SYSCOMMAND,
        win32con.SC_MONITORPOWER,
        2,
    )


def _press_vk(vk_code: int, modifiers: list[int] | None = None) -> None:
    modifiers = modifiers or []
    for modifier in modifiers:
        win32api.keybd_event(modifier, 0, 0, 0)
    win32api.keybd_event(vk_code, 0, 0, 0)
    win32api.keybd_event(vk_code, 0, win32con.KEYEVENTF_KEYUP, 0)
    for modifier in reversed(modifiers):
        win32api.keybd_event(modifier, 0, win32con.KEYEVENTF_KEYUP, 0)


_HELD_KEY_CODES: dict[str, int] = {}
_HELD_KEY_REPEAT_STOPS: dict[str, threading.Event] = {}
_HELD_KEY_REPEAT_LOCK = threading.Lock()


def _fold_key_name(value: str) -> str:
    text = unicodedata.normalize("NFD", str(value or "").strip().lower())
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = text.replace("+", " ")
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


_KEY_NAME_ALIASES = {
    "control": "ctrl",
    "ctrl": "ctrl",
    "shift": "shift",
    "alt": "alt",
    "menu": "alt",
    "windows": "win",
    "window": "win",
    "win": "win",
    "cmd": "win",
    "command": "win",
    "enter": "enter",
    "return": "enter",
    "esc": "escape",
    "escape": "escape",
    "tab": "tab",
    "space": "space",
    "spacebar": "space",
    "backspace": "backspace",
    "delete": "delete",
    "del": "delete",
    "insert": "insert",
    "ins": "insert",
    "home": "home",
    "end": "end",
    "page up": "pageup",
    "pageup": "pageup",
    "pgup": "pageup",
    "page down": "pagedown",
    "pagedown": "pagedown",
    "pgdn": "pagedown",
    "up": "up",
    "arrow up": "up",
    "mui ten len": "up",
    "down": "down",
    "arrow down": "down",
    "mui ten xuong": "down",
    "left": "left",
    "arrow left": "left",
    "mui ten trai": "left",
    "right": "right",
    "arrow right": "right",
    "mui ten phai": "right",
    "caps lock": "capslock",
    "capslock": "capslock",
}


_KEY_VK_CODES = {
    "ctrl": win32con.VK_CONTROL,
    "shift": win32con.VK_SHIFT,
    "alt": win32con.VK_MENU,
    "win": getattr(win32con, "VK_LWIN", 0x5B),
    "enter": win32con.VK_RETURN,
    "escape": win32con.VK_ESCAPE,
    "tab": win32con.VK_TAB,
    "space": win32con.VK_SPACE,
    "backspace": win32con.VK_BACK,
    "delete": win32con.VK_DELETE,
    "insert": win32con.VK_INSERT,
    "home": win32con.VK_HOME,
    "end": win32con.VK_END,
    "pageup": win32con.VK_PRIOR,
    "pagedown": win32con.VK_NEXT,
    "up": win32con.VK_UP,
    "down": win32con.VK_DOWN,
    "left": win32con.VK_LEFT,
    "right": win32con.VK_RIGHT,
    "capslock": win32con.VK_CAPITAL,
}

for _index in range(1, 25):
    _KEY_VK_CODES[f"f{_index}"] = getattr(win32con, f"VK_F{_index}", 0x6F + _index)


_KEY_DISPLAY_NAMES = {
    "ctrl": "Ctrl",
    "shift": "Shift",
    "alt": "Alt",
    "win": "Win",
    "enter": "Enter",
    "escape": "Esc",
    "tab": "Tab",
    "space": "Space",
    "backspace": "Backspace",
    "delete": "Delete",
    "insert": "Insert",
    "home": "Home",
    "end": "End",
    "pageup": "Page Up",
    "pagedown": "Page Down",
    "up": "Up",
    "down": "Down",
    "left": "Left",
    "right": "Right",
    "capslock": "Caps Lock",
}


def _normalize_keyboard_keys(keys: Any) -> list[tuple[str, int]]:
    if isinstance(keys, str):
        raw_items = re.split(r"[\s+,]+", keys.strip())
    elif isinstance(keys, (list, tuple)):
        raw_items = [str(item) for item in keys]
    else:
        raw_items = []

    normalized: list[tuple[str, int]] = []
    for raw_item in raw_items:
        key = _fold_key_name(raw_item)
        if not key:
            continue
        key = _KEY_NAME_ALIASES.get(key, key)
        if len(key) == 1 and key.isalpha():
            vk_code = ord(key.upper())
        elif len(key) == 1 and key.isdigit():
            vk_code = ord(key)
        else:
            vk_code = _KEY_VK_CODES.get(key)
        if vk_code is None:
            raise ValueError(raw_item)
        normalized.append((key, vk_code))
    return normalized


def _display_keyboard_keys(keys: list[tuple[str, int]]) -> str:
    names = []
    for key, _vk_code in keys:
        names.append(_KEY_DISPLAY_NAMES.get(key, key.upper() if len(key) == 1 else key))
    return " + ".join(names)


def _key_down(key: str, vk_code: int) -> None:
    if key not in _HELD_KEY_CODES:
        win32api.keybd_event(vk_code, 0, 0, 0)
        _HELD_KEY_CODES[key] = vk_code
    _start_key_repeat_if_needed(key, vk_code)


def _key_up(key: str, vk_code: int) -> None:
    _stop_key_repeat(key)
    win32api.keybd_event(vk_code, 0, win32con.KEYEVENTF_KEYUP, 0)
    _HELD_KEY_CODES.pop(key, None)


def _is_repeatable_key(key: str) -> bool:
    if len(key) == 1 and key.isalnum():
        return True
    return key in {
        "space",
        "backspace",
        "delete",
        "left",
        "right",
        "up",
        "down",
        "pageup",
        "pagedown",
    }


def _start_key_repeat_if_needed(key: str, vk_code: int) -> None:
    if not _is_repeatable_key(key):
        return
    with _HELD_KEY_REPEAT_LOCK:
        if key in _HELD_KEY_REPEAT_STOPS:
            return
        stop_event = threading.Event()
        _HELD_KEY_REPEAT_STOPS[key] = stop_event

    # Emit one repeat immediately. Some apps do not treat a single synthetic
    # keydown as typematic repeat, especially for printable keys.
    win32api.keybd_event(vk_code, 0, 0, 0)

    def repeat_worker() -> None:
        if stop_event.wait(0.35):
            return
        while not stop_event.is_set():
            win32api.keybd_event(vk_code, 0, 0, 0)
            stop_event.wait(0.06)

    threading.Thread(target=repeat_worker, daemon=True).start()


def _stop_key_repeat(key: str) -> None:
    with _HELD_KEY_REPEAT_LOCK:
        stop_event = _HELD_KEY_REPEAT_STOPS.pop(key, None)
    if stop_event is not None:
        stop_event.set()


def _paste_text(text: str) -> None:
    win32clipboard.OpenClipboard()
    try:
        win32clipboard.EmptyClipboard()
        win32clipboard.SetClipboardData(win32con.CF_UNICODETEXT, text)
    finally:
        win32clipboard.CloseClipboard()
    time.sleep(0.05)
    _press_vk(ord("V"), [win32con.VK_CONTROL])


def _click_foreground_window_ratio(x_ratio: float, y_ratio: float) -> None:
    hwnd = win32gui.GetForegroundWindow()
    if not hwnd:
        return
    left, top, right, bottom = win32gui.GetWindowRect(hwnd)
    width = max(1, right - left)
    height = max(1, bottom - top)
    x = int(left + width * max(0.0, min(1.0, x_ratio)))
    y = int(top + height * max(0.0, min(1.0, y_ratio)))
    win32api.SetCursorPos((x, y))
    win32api.mouse_event(win32con.MOUSEEVENTF_LEFTDOWN, x, y, 0, 0)
    win32api.mouse_event(win32con.MOUSEEVENTF_LEFTUP, x, y, 0, 0)
    time.sleep(0.08)


class _GUID(ctypes.Structure):
    _fields_ = [
        ("Data1", ctypes.c_ulong),
        ("Data2", ctypes.c_ushort),
        ("Data3", ctypes.c_ushort),
        ("Data4", ctypes.c_ubyte * 8),
    ]


def _guid(value: str) -> _GUID:
    import uuid

    parsed = uuid.UUID(value)
    data4 = (ctypes.c_ubyte * 8).from_buffer_copy(parsed.bytes[8:])
    return _GUID(parsed.time_low, parsed.time_mid, parsed.time_hi_version, data4)


def _set_system_mute(muted: bool) -> None:
    clsid_mm_device_enumerator = _guid("BCDE0395-E52F-467C-8E3D-C4579291692E")
    iid_mm_device_enumerator = _guid("A95664D2-9614-4F35-A746-DE8DB63617E6")
    iid_audio_endpoint_volume = _guid("5CDF2C82-841E-4546-9722-0CF74078229A")
    clsctx_all = 23
    e_render = 0
    e_console = 0

    enumerator = ctypes.c_void_p()
    device = ctypes.c_void_p()
    endpoint = ctypes.c_void_p()
    try:
        pythoncom.CoInitialize()
    except Exception:
        pass
    try:
        hr = ctypes.oledll.ole32.CoCreateInstance(
            ctypes.byref(clsid_mm_device_enumerator),
            None,
            clsctx_all,
            ctypes.byref(iid_mm_device_enumerator),
            ctypes.byref(enumerator),
        )
        if hr != 0:
            raise OSError(f"CoCreateInstance failed: 0x{hr & 0xFFFFFFFF:08X}")

        enum_vtbl = ctypes.cast(enumerator, ctypes.POINTER(ctypes.POINTER(ctypes.c_void_p))).contents
        get_default_audio_endpoint = ctypes.WINFUNCTYPE(
            ctypes.HRESULT,
            ctypes.c_void_p,
            ctypes.c_int,
            ctypes.c_int,
            ctypes.POINTER(ctypes.c_void_p),
        )(enum_vtbl[4])
        hr = get_default_audio_endpoint(enumerator, e_render, e_console, ctypes.byref(device))
        if hr != 0:
            raise OSError(f"GetDefaultAudioEndpoint failed: 0x{hr & 0xFFFFFFFF:08X}")

        device_vtbl = ctypes.cast(device, ctypes.POINTER(ctypes.POINTER(ctypes.c_void_p))).contents
        activate = ctypes.WINFUNCTYPE(
            ctypes.HRESULT,
            ctypes.c_void_p,
            ctypes.POINTER(_GUID),
            ctypes.c_ulong,
            ctypes.c_void_p,
            ctypes.POINTER(ctypes.c_void_p),
        )(device_vtbl[3])
        hr = activate(device, ctypes.byref(iid_audio_endpoint_volume), clsctx_all, None, ctypes.byref(endpoint))
        if hr != 0:
            raise OSError(f"Activate IAudioEndpointVolume failed: 0x{hr & 0xFFFFFFFF:08X}")

        endpoint_vtbl = ctypes.cast(endpoint, ctypes.POINTER(ctypes.POINTER(ctypes.c_void_p))).contents
        set_mute = ctypes.WINFUNCTYPE(
            ctypes.HRESULT,
            ctypes.c_void_p,
            ctypes.c_int,
            ctypes.c_void_p,
        )(endpoint_vtbl[14])
        hr = set_mute(endpoint, 1 if muted else 0, None)
        if hr != 0:
            raise OSError(f"SetMute failed: 0x{hr & 0xFFFFFFFF:08X}")
    finally:
        release_type = ctypes.WINFUNCTYPE(ctypes.c_ulong, ctypes.c_void_p)
        for pointer in (endpoint, device, enumerator):
            if pointer:
                try:
                    vtbl = ctypes.cast(pointer, ctypes.POINTER(ctypes.POINTER(ctypes.c_void_p))).contents
                    release_type(vtbl[2])(pointer)
                except Exception:
                    pass


def _get_system_audio_state() -> dict[str, Any]:
    clsid_mm_device_enumerator = _guid("BCDE0395-E52F-467C-8E3D-C4579291692E")
    iid_mm_device_enumerator = _guid("A95664D2-9614-4F35-A746-DE8DB63617E6")
    iid_audio_endpoint_volume = _guid("5CDF2C82-841E-4546-9722-0CF74078229A")
    clsctx_all = 23
    e_render = 0
    e_console = 0
    enumerator = ctypes.c_void_p()
    device = ctypes.c_void_p()
    endpoint = ctypes.c_void_p()
    try:
        pythoncom.CoInitialize()
    except Exception:
        pass
    try:
        hr = ctypes.oledll.ole32.CoCreateInstance(
            ctypes.byref(clsid_mm_device_enumerator),
            None,
            clsctx_all,
            ctypes.byref(iid_mm_device_enumerator),
            ctypes.byref(enumerator),
        )
        if hr != 0:
            raise OSError(f"CoCreateInstance failed: 0x{hr & 0xFFFFFFFF:08X}")
        enum_vtbl = ctypes.cast(enumerator, ctypes.POINTER(ctypes.POINTER(ctypes.c_void_p))).contents
        get_default_audio_endpoint = ctypes.WINFUNCTYPE(
            ctypes.HRESULT,
            ctypes.c_void_p,
            ctypes.c_int,
            ctypes.c_int,
            ctypes.POINTER(ctypes.c_void_p),
        )(enum_vtbl[4])
        hr = get_default_audio_endpoint(enumerator, e_render, e_console, ctypes.byref(device))
        if hr != 0:
            raise OSError(f"GetDefaultAudioEndpoint failed: 0x{hr & 0xFFFFFFFF:08X}")
        device_vtbl = ctypes.cast(device, ctypes.POINTER(ctypes.POINTER(ctypes.c_void_p))).contents
        activate = ctypes.WINFUNCTYPE(
            ctypes.HRESULT,
            ctypes.c_void_p,
            ctypes.POINTER(_GUID),
            ctypes.c_ulong,
            ctypes.c_void_p,
            ctypes.POINTER(ctypes.c_void_p),
        )(device_vtbl[3])
        hr = activate(device, ctypes.byref(iid_audio_endpoint_volume), clsctx_all, None, ctypes.byref(endpoint))
        if hr != 0:
            raise OSError(f"Activate IAudioEndpointVolume failed: 0x{hr & 0xFFFFFFFF:08X}")
        endpoint_vtbl = ctypes.cast(endpoint, ctypes.POINTER(ctypes.POINTER(ctypes.c_void_p))).contents
        get_volume = ctypes.WINFUNCTYPE(
            ctypes.HRESULT,
            ctypes.c_void_p,
            ctypes.POINTER(ctypes.c_float),
        )(endpoint_vtbl[9])
        get_mute = ctypes.WINFUNCTYPE(
            ctypes.HRESULT,
            ctypes.c_void_p,
            ctypes.POINTER(ctypes.c_int),
        )(endpoint_vtbl[15])
        volume = ctypes.c_float(0.0)
        muted = ctypes.c_int(0)
        hr = get_volume(endpoint, ctypes.byref(volume))
        if hr != 0:
            raise OSError(f"GetMasterVolumeLevelScalar failed: 0x{hr & 0xFFFFFFFF:08X}")
        hr = get_mute(endpoint, ctypes.byref(muted))
        if hr != 0:
            raise OSError(f"GetMute failed: 0x{hr & 0xFFFFFFFF:08X}")
        return {"muted": bool(muted.value), "volume_percent": int(round(float(volume.value) * 100))}
    finally:
        release_type = ctypes.WINFUNCTYPE(ctypes.c_ulong, ctypes.c_void_p)
        for pointer in (endpoint, device, enumerator):
            if pointer:
                try:
                    vtbl = ctypes.cast(pointer, ctypes.POINTER(ctypes.POINTER(ctypes.c_void_p))).contents
                    release_type(vtbl[2])(pointer)
                except Exception:
                    pass


def media_control(action: str) -> ActionResult:
    action = (action or "").strip().lower()
    if action in {"mute", "unmute"}:
        try:
            _set_system_mute(action == "mute")
            return ActionResult.ok("Đã tắt tiếng máy." if action == "mute" else "Đã bật tiếng máy.")
        except Exception as exc:
            return ActionResult.err(f"Không thể đổi trạng thái mute của máy: {exc}", code=ErrorCode.UNKNOWN)

    mapping = {
        "play_pause": (win32con.VK_MEDIA_PLAY_PAUSE, "Đã gửi lệnh tạm dừng/phát tiếp."),
        "next": (win32con.VK_MEDIA_NEXT_TRACK, "Đã chuyển bài tiếp theo."),
        "previous": (win32con.VK_MEDIA_PREV_TRACK, "Đã quay lại bài trước."),
        "mute_toggle": (win32con.VK_VOLUME_MUTE, "Đã đảo trạng thái mute."),
        "volume_up": (win32con.VK_VOLUME_UP, "Đã tăng âm lượng."),
        "volume_down": (win32con.VK_VOLUME_DOWN, "Đã giảm âm lượng."),
    }
    item = mapping.get(action)
    if not item:
        return ActionResult.err("Lệnh media không hợp lệ.", code=ErrorCode.UNKNOWN)
    try:
        _press_vk(item[0])
        return ActionResult.ok(item[1])
    except Exception as exc:
        return ActionResult.err(f"Không thể gửi phím media: {exc}", code=ErrorCode.UNKNOWN)


def youtube_control(action: str, pid: int = 0, pids: list[int] | None = None, name: str = "", hwnd: int = 0) -> ActionResult:
    action = (action or "").strip().lower()
    mapping = {
        "play_pause": (ord("K"), [], "Đã gửi lệnh phát/tạm dừng YouTube."),
        "next": (ord("N"), [win32con.VK_SHIFT], "Đã chuyển video YouTube tiếp theo."),
        "previous": (ord("P"), [win32con.VK_SHIFT], "Đã chuyển về video YouTube trước."),
        "mute": (ord("M"), [], "Đã bật/tắt tiếng YouTube."),
        "volume_up": (win32con.VK_UP, [], "Đã tăng âm lượng YouTube."),
        "volume_down": (win32con.VK_DOWN, [], "Đã giảm âm lượng YouTube."),
        "forward": (ord("L"), [], "Đã tua tới 10 giây trên YouTube."),
        "rewind": (ord("J"), [], "Đã tua lùi 10 giây trên YouTube."),
        "fullscreen": (ord("F"), [], "Đã bật/tắt toàn màn hình YouTube."),
    }
    item = mapping.get(action)
    if not item:
        return ActionResult.err("Lệnh YouTube không hợp lệ.", code=ErrorCode.UNKNOWN)
    try:
        target_pids = [int(item) for item in (pids or []) if int(item or 0) > 0]
        if not target_pids and int(pid or 0) > 0:
            target_pids = [int(pid)]
        target_hwnd = int(hwnd or 0)
        if target_hwnd and not win32gui.IsWindow(target_hwnd):
            return ActionResult.err("Không tìm thấy cửa sổ YouTube/browser đã chọn.", code=ErrorCode.PROCESS_UNKNOWN)
        if not target_hwnd:
            target_hwnd = _find_window_for_pids(target_pids) if target_pids else (_find_youtube_window() or 0)
        if target_hwnd:
            _focus_window(target_hwnd)
            time.sleep(0.2)
        elif target_pids:
            return ActionResult.err("Không tìm thấy cửa sổ YouTube/browser đã chọn.", code=ErrorCode.PROCESS_UNKNOWN)
        else:
            fallback = media_control(
                {
                    "play_pause": "play_pause",
                    "next": "next",
                    "previous": "previous",
                    "mute": "mute",
                    "volume_up": "volume_up",
                    "volume_down": "volume_down",
                }.get(action, "")
            )
            if fallback.status == ActionStatus.SUCCESS:
                return ActionResult.ok(f"{fallback.message}\nKhông tìm thấy cửa sổ YouTube nên đã dùng media key Windows.")
            return ActionResult.err("Không tìm thấy cửa sổ YouTube để điều khiển.", code=ErrorCode.PROCESS_UNKNOWN)
        _press_vk(item[0], item[1])
        return ActionResult.ok(item[2])
    except Exception as exc:
        return ActionResult.err(f"Không thể điều khiển YouTube: {exc}", code=ErrorCode.UNKNOWN)


def browser_control(
    action: str,
    pid: int = 0,
    pids: list[int] | None = None,
    name: str = "",
    text: str = "",
    submit: bool = False,
    hwnd: int = 0,
) -> ActionResult:
    action = (action or "").strip().lower()
    mapping = {
        "close_tab": (ord("W"), [win32con.VK_CONTROL], "Đã đóng tab hiện tại."),
        "next_tab": (win32con.VK_TAB, [win32con.VK_CONTROL], "Đã chuyển sang tab kế tiếp."),
        "previous_tab": (win32con.VK_TAB, [win32con.VK_CONTROL, win32con.VK_SHIFT], "Đã chuyển về tab trước."),
        "new_tab": (ord("T"), [win32con.VK_CONTROL], "Đã mở tab mới."),
        "reload": (win32con.VK_F5, [], "Đã tải lại trang."),
        "hard_reload": (win32con.VK_F5, [win32con.VK_CONTROL], "Đã tải lại trang bỏ cache."),
        "stop_loading": (win32con.VK_ESCAPE, [], "Đã dừng tải trang."),
        "back": (win32con.VK_LEFT, [win32con.VK_MENU], "Đã quay lại trang trước."),
        "forward": (win32con.VK_RIGHT, [win32con.VK_MENU], "Đã tiến tới trang sau."),
        "scroll_down": (win32con.VK_NEXT, [], "Đã cuộn xuống."),
        "scroll_up": (win32con.VK_PRIOR, [], "Đã cuộn lên."),
        "page_top": (win32con.VK_HOME, [], "Đã về đầu trang."),
        "page_bottom": (win32con.VK_END, [], "Đã về cuối trang."),
        "zoom_in": (ord("="), [win32con.VK_CONTROL], "Đã phóng to trang."),
        "zoom_out": (ord("-"), [win32con.VK_CONTROL], "Đã thu nhỏ trang."),
        "zoom_reset": (ord("0"), [win32con.VK_CONTROL], "Đã đưa zoom về mặc định."),
        "reopen_closed_tab": (ord("T"), [win32con.VK_CONTROL, win32con.VK_SHIFT], "Đã mở lại tab vừa đóng."),
        "duplicate_tab": (ord("K"), [win32con.VK_MENU, win32con.VK_SHIFT], "Đã nhân đôi tab hiện tại."),
        "address_bar": (ord("L"), [win32con.VK_CONTROL], "Đã chọn thanh địa chỉ."),
        "find_in_page": (ord("F"), [win32con.VK_CONTROL], "Đã mở tìm kiếm trong trang."),
        "bookmark": (ord("D"), [win32con.VK_CONTROL], "Đã mở lưu bookmark."),
    }
    try:
        target_pids = [int(item) for item in (pids or []) if int(item or 0) > 0]
        if not target_pids and int(pid or 0) > 0:
            target_pids = [int(pid)]
        target_hwnd = int(hwnd or 0)
        if target_hwnd:
            if not win32gui.IsWindow(target_hwnd):
                return ActionResult.err("Không tìm thấy cửa sổ browser đã chọn.", code=ErrorCode.PROCESS_UNKNOWN)
            _focus_window(target_hwnd)
            time.sleep(0.2)
        elif target_pids:
            focused = focus_process_window(pids=target_pids, name=name)
            if focused.status != ActionStatus.SUCCESS:
                return focused
            time.sleep(0.2)
        elif action in {"tiktok_comment_text", "tiktok_comment_send", "tiktok_comment_focus"}:
            hwnd = _find_browser_window(["tiktok"])
            if hwnd:
                _focus_window(hwnd)
                time.sleep(0.2)

        cleaned_text = str(text or "")
        if action in {"type_text", "type_text_enter"}:
            if not cleaned_text:
                return ActionResult.err("Bạn chưa nhập nội dung cần dán.", code=ErrorCode.UNKNOWN)
            _paste_text(cleaned_text)
            if action == "type_text_enter" or submit:
                time.sleep(0.05)
                _press_vk(win32con.VK_RETURN)
                return ActionResult.ok("Đã nhập text và nhấn Enter.")
            return ActionResult.ok("Đã nhập text.")

        if action == "address_text":
            if not cleaned_text:
                return ActionResult.err("Bạn chưa nhập địa chỉ cần mở.", code=ErrorCode.UNKNOWN)
            _press_vk(ord("L"), [win32con.VK_CONTROL])
            time.sleep(0.05)
            _paste_text(cleaned_text)
            if submit:
                time.sleep(0.05)
                _press_vk(win32con.VK_RETURN)
                return ActionResult.ok("Đã nhập địa chỉ và mở trang.")
            return ActionResult.ok("Đã nhập địa chỉ vào thanh địa chỉ.")

        if action == "find_text":
            if not cleaned_text:
                return ActionResult.err("Bạn chưa nhập từ khóa cần tìm.", code=ErrorCode.UNKNOWN)
            _press_vk(ord("F"), [win32con.VK_CONTROL])
            time.sleep(0.05)
            _paste_text(cleaned_text)
            return ActionResult.ok("Đã nhập từ khóa tìm trong trang.")

        if action in {"tiktok_comment_text", "tiktok_comment_send"}:
            if not cleaned_text:
                return ActionResult.err("Bạn chưa nhập nội dung comment.", code=ErrorCode.UNKNOWN)
            _click_foreground_window_ratio(0.70, 0.96)
            _paste_text(cleaned_text)
            if action == "tiktok_comment_send" or submit:
                time.sleep(0.05)
                _press_vk(win32con.VK_RETURN)
                return ActionResult.ok("Đã nhập và gửi comment TikTok.")
            return ActionResult.ok("Đã nhập comment TikTok. Bạn có thể gửi tiếp nếu muốn.")

        if action == "tiktok_comment_focus":
            _click_foreground_window_ratio(0.70, 0.96)
            return ActionResult.ok("Đã chọn ô comment TikTok.")

        item = mapping.get(action)
        if not item:
            return ActionResult.err("Lệnh tab/trình duyệt không hợp lệ.", code=ErrorCode.UNKNOWN)
        _press_vk(item[0], item[1])
        return ActionResult.ok(item[2])
    except Exception as exc:
        return ActionResult.err(f"Không thể gửi phím trình duyệt: {exc}", code=ErrorCode.UNKNOWN)


def keyboard_control(
    action: str,
    count: int = 1,
    keys: Any = None,
    duration_seconds: float = 0,
) -> ActionResult:
    action = (action or "").strip().lower()
    count = max(1, min(100, int(count or 1)))
    mapping = {
        "enter": (win32con.VK_RETURN, [], "Đã nhấn Enter."),
        "escape": (win32con.VK_ESCAPE, [], "Đã nhấn Esc."),
        "tab": (win32con.VK_TAB, [], "Đã nhấn Tab."),
        "backspace": (win32con.VK_BACK, [], "Đã nhấn Backspace."),
        "delete": (win32con.VK_DELETE, [], "Đã nhấn Delete."),
        "space": (win32con.VK_SPACE, [], "Đã nhấn Space."),
        "select_all": (ord("A"), [win32con.VK_CONTROL], "Đã chọn tất cả."),
        "copy": (ord("C"), [win32con.VK_CONTROL], "Đã copy."),
        "paste": (ord("V"), [win32con.VK_CONTROL], "Đã paste."),
        "cut": (ord("X"), [win32con.VK_CONTROL], "Đã cut."),
        "undo": (ord("Z"), [win32con.VK_CONTROL], "Đã undo."),
        "redo": (ord("Y"), [win32con.VK_CONTROL], "Đã redo."),
    }
    try:
        if action in {"hold", "key_down", "press_hold"}:
            parsed_keys = _normalize_keyboard_keys(keys)
            if not parsed_keys:
                return ActionResult.err("Bạn chưa nói rõ cần giữ phím nào.", code=ErrorCode.UNKNOWN)
            for key, vk_code in parsed_keys:
                _key_down(key, vk_code)
            label = _display_keyboard_keys(parsed_keys)
            duration = max(0.0, min(30.0, float(duration_seconds or 0)))
            if duration > 0:
                time.sleep(duration)
                for key, vk_code in reversed(parsed_keys):
                    _key_up(key, vk_code)
                return ActionResult.ok(f"Đã giữ {label} trong {duration:g} giây rồi thả.")
            return ActionResult.ok(f"Đang giữ {label}. Gửi 'thả {label}' hoặc 'thả hết phím' để thả.")

        if action in {"release", "key_up"}:
            parsed_keys = _normalize_keyboard_keys(keys)
            if not parsed_keys:
                return ActionResult.err("Bạn chưa nói rõ cần thả phím nào.", code=ErrorCode.UNKNOWN)
            for key, vk_code in reversed(parsed_keys):
                _key_up(key, vk_code)
            return ActionResult.ok(f"Đã thả {_display_keyboard_keys(parsed_keys)}.")

        if action == "release_all":
            if not _HELD_KEY_CODES:
                return ActionResult.ok("Không có phím nào đang được giữ.")
            held = list(_HELD_KEY_CODES.items())
            for key, vk_code in reversed(held):
                _key_up(key, vk_code)
            display = _display_keyboard_keys(held)
            return ActionResult.ok(f"Đã thả tất cả phím đang giữ: {display}.")

        if action in {"press_combo", "hotkey"}:
            parsed_keys = _normalize_keyboard_keys(keys)
            if not parsed_keys:
                return ActionResult.err("Bạn chưa nói rõ tổ hợp phím cần nhấn.", code=ErrorCode.UNKNOWN)
            for key, vk_code in parsed_keys:
                win32api.keybd_event(vk_code, 0, 0, 0)
                time.sleep(0.01)
            for key, vk_code in reversed(parsed_keys):
                win32api.keybd_event(vk_code, 0, win32con.KEYEVENTF_KEYUP, 0)
                _HELD_KEY_CODES.pop(key, None)
                time.sleep(0.01)
            return ActionResult.ok(f"Đã nhấn tổ hợp {_display_keyboard_keys(parsed_keys)}.")

        if action == "delete_line":
            _press_vk(win32con.VK_HOME, [win32con.VK_SHIFT])
            _press_vk(win32con.VK_DELETE)
            return ActionResult.ok("Đã xóa dòng hiện tại.")
        item = mapping.get(action)
        if not item:
            return ActionResult.err("Lệnh bàn phím không hợp lệ.", code=ErrorCode.UNKNOWN)
        repeat = count if action in {"backspace", "delete", "tab", "space"} else 1
        for _ in range(repeat):
            _press_vk(item[0], item[1])
            time.sleep(0.02)
        if repeat > 1:
            return ActionResult.ok(f"{item[2]} ({repeat} lần)")
        return ActionResult.ok(item[2])
    except Exception as exc:
        return ActionResult.err(f"Không thể gửi phím: {exc}", code=ErrorCode.UNKNOWN)


def mouse_control(action: str, x: int = 0, y: int = 0) -> ActionResult:
    action = (action or "").strip().lower()

    def click_current(button: str = "left") -> None:
        cx, cy = win32api.GetCursorPos()
        if button == "right":
            win32api.mouse_event(win32con.MOUSEEVENTF_RIGHTDOWN, cx, cy, 0, 0)
            win32api.mouse_event(win32con.MOUSEEVENTF_RIGHTUP, cx, cy, 0, 0)
        else:
            win32api.mouse_event(win32con.MOUSEEVENTF_LEFTDOWN, cx, cy, 0, 0)
            win32api.mouse_event(win32con.MOUSEEVENTF_LEFTUP, cx, cy, 0, 0)

    try:
        if action == "click_center":
            _click_foreground_window_ratio(0.50, 0.50)
            return ActionResult.ok("Đã click giữa cửa sổ hiện tại.")
        if action == "click_bottom_right":
            _click_foreground_window_ratio(0.90, 0.92)
            return ActionResult.ok("Đã click góc dưới phải cửa sổ hiện tại.")
        if action == "click_ratio":
            _click_foreground_window_ratio(float(x) / 100.0, float(y) / 100.0)
            return ActionResult.ok(f"Đã click vị trí {x}%, {y}% trong cửa sổ hiện tại.")
        if action == "double_click":
            click_current("left")
            time.sleep(0.08)
            click_current("left")
            return ActionResult.ok("Đã double click.")
        if action == "right_click":
            click_current("right")
            return ActionResult.ok("Đã click chuột phải.")
        return ActionResult.err("Lệnh chuột không hợp lệ.", code=ErrorCode.UNKNOWN)
    except Exception as exc:
        return ActionResult.err(f"Không thể điều khiển chuột: {exc}", code=ErrorCode.UNKNOWN)


def take_screenshot() -> ActionResult:
    try:
        from PIL import ImageGrab

        image = ImageGrab.grab()
        out_dir = ensure_app_data_dir("telegram")
        path = out_dir / f"screenshot_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
        image.save(path)
        return ActionResult.ok(
            "Đã chụp màn hình.",
            telegram_photo_path=str(path),
            path=str(path),
        )
    except Exception as exc:
        return ActionResult.err(f"Không thể chụp màn hình: {exc}", code=ErrorCode.UNKNOWN)


def system_status() -> ActionResult:
    try:
        cpu = psutil.cpu_percent(interval=0.2)
        memory = psutil.virtual_memory()
        disk_root = Path(os.environ.get("SystemDrive", "C:") + "\\")
        disk = psutil.disk_usage(str(disk_root))
        battery = psutil.sensors_battery()
        boot_time = datetime.fromtimestamp(psutil.boot_time())
        uptime_seconds = max(0, int(time.time() - psutil.boot_time()))
        uptime_hours = uptime_seconds // 3600
        uptime_minutes = (uptime_seconds % 3600) // 60

        foreground = ""
        try:
            hwnd = win32gui.GetForegroundWindow()
            foreground = win32gui.GetWindowText(hwnd).strip() if hwnd else ""
        except Exception:
            foreground = ""

        battery_line = "Pin: không có thông tin"
        if battery is not None:
            plugged = "đang sạc" if battery.power_plugged else "không sạc"
            battery_line = f"Pin: {battery.percent:.0f}% ({plugged})"

        lines = [
            "Trạng thái máy:",
            f"Máy: {socket.gethostname()}",
            f"Hệ điều hành: {platform.system()} {platform.release()}",
            f"CPU: {cpu:.0f}%",
            f"RAM: {memory.percent:.0f}% ({_format_memory_mb(memory.used / 1024 / 1024)} / {_format_memory_mb(memory.total / 1024 / 1024)})",
            f"Ổ {disk_root.drive or 'C:'}: {disk.percent:.0f}% đã dùng, còn {_format_memory_mb(disk.free / 1024 / 1024)}",
            battery_line,
            f"Uptime: {uptime_hours}h {uptime_minutes}m",
        ]
        if foreground:
            lines.append(f"Đang dùng: {foreground[:120]}")
        try:
            audio = _get_system_audio_state()
            audio_line = "mute" if audio.get("muted") else "đang bật tiếng"
            lines.append(f"Âm thanh: {audio_line}, volume {audio.get('volume_percent')}%")
        except Exception:
            audio = {}
        return ActionResult.ok(
            "\n".join(lines),
            cpu_percent=cpu,
            ram_percent=memory.percent,
            disk_percent=disk.percent,
            battery_percent=(battery.percent if battery else None),
            audio=audio,
            boot_time=boot_time.isoformat(),
            foreground_window=foreground,
        )
    except Exception as exc:
        return ActionResult.err(f"Không thể lấy trạng thái máy: {exc}", code=ErrorCode.UNKNOWN)


def _browser_debug_candidates(browser: str = "") -> list[tuple[str, int]]:
    browser = (browser or "").strip().lower()
    candidates = [
        ("edge", 9222),
        ("chrome", 9223),
        ("edge", 9223),
        ("chrome", 9222),
        ("edge", 9224),
        ("chrome", 9224),
    ]
    if browser in {"edge", "chrome"}:
        ordered = [item for item in candidates if item[0] == browser]
        ordered.extend(item for item in candidates if item[0] != browser)
        return ordered
    return candidates


def _fetch_browser_debug_tabs(browser: str = "") -> tuple[list[dict[str, Any]], str, int]:
    last_error = ""
    for detected_browser, port in _browser_debug_candidates(browser):
        base = f"http://127.0.0.1:{port}"
        try:
            response = requests.get(f"{base}/json/list", timeout=0.8)
            response.raise_for_status()
            payload = response.json()
        except Exception as exc:
            last_error = str(exc)
            continue
        tabs: list[dict[str, Any]] = []
        for item in payload if isinstance(payload, list) else []:
            if not isinstance(item, dict):
                continue
            if item.get("type") != "page":
                continue
            tab = {
                "id": str(item.get("id") or ""),
                "title": str(item.get("title") or "").strip() or "(không có tiêu đề)",
                "url": str(item.get("url") or "").strip(),
                "browser": detected_browser,
                "port": port,
            }
            if tab["id"]:
                tabs.append(tab)
        if tabs:
            return tabs, detected_browser, port
        last_error = "DevTools không trả về tab page nào."
    raise RuntimeError(last_error or "Không tìm thấy browser DevTools đang mở.")


def list_browser_tabs(browser: str = "default", limit: int = 20) -> ActionResult:
    try:
        tabs, detected_browser, port = _fetch_browser_debug_tabs(browser)
    except Exception as exc:
        return ActionResult.need_clarify(
            message=(
                "Chưa đọc được danh sách tab thật từ Edge/Chrome.\n"
                "Hãy mở browser bằng lệnh: mở edge remote hoặc mở chrome remote, rồi thử lại."
            ),
            question=f"Chi tiết kỹ thuật: {exc}",
        )
    rows = tabs[: max(1, int(limit or 20))]
    lines = [f"Tab {detected_browser.title()} đang mở (DevTools port {port}):"]
    for index, tab in enumerate(rows, 1):
        url = str(tab.get("url") or "")
        lines.append(f"{index}. {tab.get('title')}")
        if url:
            lines.append(f"   {url[:120]}")
    lines.append("\nBấm số để chọn tab, hoặc gửi: đóng tab số 2 / chuyển tab số 2 / reload tab số 2.")
    choices = [str(tab.get("title") or f"Tab {index}") for index, tab in enumerate(rows, 1)]
    result = ActionResult.need_choice("\n".join(lines), choices, action="browser_tab")
    result.data["tabs"] = rows
    result.data["browser"] = detected_browser
    result.data["port"] = port
    result.data["choices_already_in_message"] = True
    return result


def browser_tab_control(action: str, tab_id: str = "", port: int = 0, title: str = "", url: str = "") -> ActionResult:
    action = (action or "").strip().lower()
    tab_id = str(tab_id or "").strip()
    port = int(port or 0)
    if not tab_id or not port:
        return ActionResult.err("Không tìm thấy tab đã chọn.", code=ErrorCode.UNKNOWN)
    base = f"http://127.0.0.1:{port}"
    try:
        if action == "activate":
            response = requests.get(f"{base}/json/activate/{quote(tab_id, safe='')}", timeout=1.5)
            response.raise_for_status()
            return ActionResult.ok(f"Đã chuyển sang tab: {title or tab_id}.")
        if action == "close":
            response = requests.get(f"{base}/json/close/{quote(tab_id, safe='')}", timeout=1.5)
            response.raise_for_status()
            return ActionResult.ok(f"Đã đóng tab: {title or tab_id}.")
        if action == "reload":
            activated = browser_tab_control("activate", tab_id=tab_id, port=port, title=title, url=url)
            if activated.status != ActionStatus.SUCCESS:
                return activated
            time.sleep(0.1)
            return browser_control("reload")
        return ActionResult.err("Lệnh tab không hợp lệ.", code=ErrorCode.UNKNOWN)
    except Exception as exc:
        return ActionResult.err(f"Không thể điều khiển tab: {exc}", code=ErrorCode.UNKNOWN)


def remote_overview() -> ActionResult:
    parts: list[str] = []
    status = system_status()
    if status.status == ActionStatus.SUCCESS:
        parts.append(status.message)
    apps = list_running_apps(limit=8)
    if apps.status == ActionStatus.NEED_CHOICE:
        parts.append(apps.message.split("\n\n", 1)[0])
    windows = list_open_windows(limit=8)
    if windows.status == ActionStatus.NEED_CHOICE:
        parts.append(windows.message.split("\n\n", 1)[0])
    try:
        tabs, browser, port = _fetch_browser_debug_tabs("")
        lines = [f"Tab browser ({browser}, port {port}):"]
        for index, tab in enumerate(tabs[:8], 1):
            lines.append(f"{index}. {tab.get('title')}")
        parts.append("\n".join(lines))
    except Exception:
        parts.append("Tab browser: chưa bật DevTools remote debugging.")
    return ActionResult.ok("\n\n".join(parts))


def remote_preset(action: str) -> ActionResult:
    action = (action or "").strip().lower()
    if action == "quiet":
        return media_control("mute")
    if action == "away":
        muted = media_control("mute")
        locked = system_power("light_sleep")
        messages = ["Đã bật preset ra ngoài."]
        messages.append(muted.message)
        messages.append(locked.message)
        status = ActionStatus.SUCCESS if locked.status == ActionStatus.SUCCESS else locked.status
        if status == ActionStatus.SUCCESS:
            return ActionResult.ok("\n".join(messages))
        return locked
    if action == "back":
        results = [
            open_app("chrome"),
            open_app("vscode"),
        ]
        messages = ["Đã bật preset về máy:"]
        opened = 0
        for result in results:
            messages.append(result.message)
            if result.status == ActionStatus.SUCCESS:
                opened += 1
        return ActionResult.ok("\n".join(messages), opened_count=opened)
    if action == "focus":
        web = close_distracting_web()
        muted = media_control("mute")
        if web.status == ActionStatus.NEED_CLARIFY:
            web.message = "Preset tập trung cần đọc được tab browser.\n" + web.message
            return web
        messages = ["Đã bật preset tập trung.", web.message, muted.message]
        return ActionResult.ok("\n".join(messages))
    if action == "cleanup":
        res = list_running_apps(limit=12)
        if res.status == ActionStatus.NEED_CHOICE:
            res.message = "Dọn máy: chọn ứng dụng cần xử lý.\n\n" + res.message
        return res
    if action == "sleep":
        return system_power("night_sleep")
    return ActionResult.err("Preset điều khiển từ xa không hợp lệ.", code=ErrorCode.UNKNOWN)


def prepare_telegram_document(path: str) -> ActionResult:
    try:
        p = _resolve_virtual_path(path)
    except Exception as exc:
        return ActionResult.err("Đường dẫn file không hợp lệ.", code=ErrorCode.INVALID_PATH, dev_message=str(exc))
    if not p.exists() or not p.is_file():
        return ActionResult.err("Không tìm thấy file để gửi.", code=ErrorCode.FILE_NOT_FOUND)
    if not _is_safe_path(p):
        return ActionResult.err("Không cho phép gửi file ngoài vùng an toàn.", code=ErrorCode.NOT_ALLOWED)
    return ActionResult.ok(
        f"Đã chuẩn bị gửi file: {p.name}",
        telegram_document_path=str(p),
        path=str(p),
    )


def _get_foreground_pid() -> int | None:
    try:
        hwnd = win32gui.GetForegroundWindow()
        if not hwnd:
            return None
        _, pid = win32process.GetWindowThreadProcessId(hwnd)
        return int(pid) if pid else None
    except Exception:
        return None


def find_file(
    query: str,
    extensions: Optional[List[str]] = None,
    include_dirs: bool = False,
    only_dirs: bool = False,
    search_dir: Optional[str] = None,
) -> ActionResult:
    def _score_match(path: Path) -> tuple[int, int, int, str]:
        name = path.name.lower()
        stem = path.stem.lower()
        exact_name = int(name == q)
        exact_stem = int(stem == q)
        starts_with = int(name.startswith(q) or stem.startswith(q))
        contains = int(q in name or q in stem)
        file_bonus = int(path.is_file())
        return (
            exact_name,
            exact_stem,
            starts_with,
            contains + file_bonus,
            -len(name),
            str(path).lower(),
        )

    q = (query or "").strip().lower()
    if not q:
        return ActionResult.err(
            "Bạn cần nhập tên file cần tìm.", code=ErrorCode.UNKNOWN
        )

    exts = [e.lower().lstrip(".") for e in (extensions or [])]
    results: List[str] = []

    if search_dir:
        dirs_to_search = [search_dir]
        exact_lookup_dirs = [search_dir]
    else:
        # Keep recursive search bounded to common safe folders, but still allow
        # exact root-level matches on drive roots like D:/filename.docx.
        dirs_to_search = SAFE_DIRS
        exact_lookup_dirs = SAFE_DIRS

    # Fast path: exact filename lookup in safe dirs (especially Desktop)
    if q and not any(sep in q for sep in ("/", "\\")):
        candidate_names = [q]
        if exts and "." not in q:
            candidate_names = [f"{q}.{e}" for e in exts]

        for d in exact_lookup_dirs:
            base = Path(d)
            if not base.exists():
                continue
            for name in candidate_names:
                p = base / name
                if only_dirs and p.is_dir():
                    return ActionResult.ok(
                        "Tìm thấy kết quả.",
                        files=[str(p)],
                        truncated=False,
                        query=query,
                        extensions=extensions or [],
                        include_dirs=include_dirs,
                        only_dirs=only_dirs,
                        safe_dirs=dirs_to_search,
                    )
                if not only_dirs and p.is_file():
                    return ActionResult.ok(
                        "Tìm thấy kết quả.",
                        files=[str(p)],
                        truncated=False,
                        query=query,
                        extensions=extensions or [],
                        include_dirs=include_dirs,
                        only_dirs=only_dirs,
                        safe_dirs=dirs_to_search,
                    )

    for d in dirs_to_search:
        base = Path(d)
        if not base.exists():
            continue

        try:
            for root, dirs, files in os.walk(
                base, topdown=True, onerror=lambda e: None
            ):
                if _is_drive_root_dir(str(base)):
                    depth = _relative_search_depth(base, Path(root))
                    if depth >= DRIVE_ROOT_SEARCH_DEPTH:
                        dirs[:] = []

                if include_dirs:
                    for name in dirs:
                        if q in name.lower():
                            results.append(str(Path(root) / name))

                if only_dirs:
                    continue

                for name in files:
                    if q not in name.lower():
                        continue
                    p = Path(root) / name
                    if exts and p.suffix.lower().lstrip(".") not in exts:
                        continue
                    results.append(str(p))
        except Exception:
            continue

    if results:
        unique_paths: list[str] = []
        seen_paths: set[str] = set()
        for item in sorted(
            results,
            key=lambda raw: _score_match(Path(raw)),
            reverse=True,
        ):
            if item in seen_paths:
                continue
            seen_paths.add(item)
            unique_paths.append(item)
        truncated = len(unique_paths) > 10
        results = unique_paths[:10]
    else:
        truncated = False

    return ActionResult.ok(
        "Tìm thấy kết quả." if results else "Không tìm thấy.",
        files=results,
        truncated=truncated,
        query=query,
        include_dirs=include_dirs,
        only_dirs=only_dirs,
        safe_dirs=dirs_to_search,
    )


def open_file(path: str) -> ActionResult:
    try:
        p = Path(path).resolve()
    except Exception as e:
        return ActionResult.err(
            "Đường dẫn file không hợp lệ.",
            code=ErrorCode.INVALID_PATH,
            dev_message=str(e),
        )

    if not _is_safe_path(p):
        return ActionResult.err(
            "Không cho phép mở file ngoài thư mục an toàn (Desktop/Documents/Downloads).",
            code=ErrorCode.NOT_ALLOWED,
        )

    if not p.exists():
        return ActionResult.err("File không tồn tại.", code=ErrorCode.FILE_NOT_FOUND)

    try:
        memory = PersonalMemoryService()
        preferred_app = str(memory.get_preference("open_file_app", "") or "").strip()
        if preferred_app:
            exe = resolve_office_app_path(
                _norm_app_key(preferred_app)
            ) or resolve_app_path(preferred_app)
            if exe and Path(exe).exists():
                subprocess.Popen([exe, str(p)])
                return ActionResult.ok(
                    f"Đã mở file: {p.name} bằng {preferred_app}",
                    path=str(p),
                    app=_norm_app_key(preferred_app),
                )
        os.startfile(str(p))
        return ActionResult.ok(f"Đã mở file: {p.name}", path=str(p))
    except Exception as e:
        return ActionResult.err(
            "Lỗi khi mở file.",
            code=ErrorCode.INTERNAL_ERROR,
            dev_message=str(e),
        )


def delete_file(path: str) -> ActionResult:
    """
    Xóa file theo path nhưng chỉ cho phép trong SAFE_DIRS.
    Xóa vào Recycle Bin (an toàn).
    """
    try:
        p = _resolve_virtual_path(path)
    except Exception as e:
        return ActionResult.err(
            "Đường dẫn file không hợp lệ.",
            code=ErrorCode.INVALID_PATH,
            dev_message=str(e),
        )

    if not _is_safe_path(p):
        return ActionResult.err(
            "Không cho phép xóa file ngoài thư mục an toàn.",
            code=ErrorCode.NOT_ALLOWED,
        )

    if not p.exists():
        return ActionResult.err("File không tồn tại.", code=ErrorCode.FILE_NOT_FOUND)

    if p.is_dir():
        return ActionResult.err(
            "Hiện chỉ hỗ trợ xóa FILE, chưa hỗ trợ xóa thư mục.",
            code=ErrorCode.NOT_A_FILE,
        )

    try:
        send2trash(str(p))
        return ActionResult.ok(f"Đã đưa vào Thùng rác: {p.name}", path=str(p))
    except Exception as e:
        return ActionResult.err(
            "Lỗi khi xóa file.",
            code=ErrorCode.INTERNAL_ERROR,
            dev_message=str(e),
        )


def delete_path(path: str) -> ActionResult:
    try:
        p = _resolve_virtual_path(path)
    except Exception as e:
        return ActionResult.err(
            "Đường dẫn không hợp lệ.",
            code=ErrorCode.INVALID_PATH,
            dev_message=str(e),
        )

    if not _is_safe_path(p):
        return ActionResult.err(
            "Không cho phép xóa file/thư mục ngoài thư mục an toàn.",
            code=ErrorCode.NOT_ALLOWED,
        )

    if not p.exists():
        return ActionResult.err("Mục không tồn tại.", code=ErrorCode.FILE_NOT_FOUND)

    try:
        send2trash(str(p))
        kind = "thư mục" if p.is_dir() else "file"
        return ActionResult.ok(f"Đã đưa {kind} vào Thùng rác: {p.name}", path=str(p))
    except Exception as e:
        return ActionResult.err(
            "Lỗi khi xóa file/thư mục.",
            code=ErrorCode.INTERNAL_ERROR,
            dev_message=str(e),
        )


def _prepare_src_dst(
    src: str, dst: str
) -> tuple[Optional[tuple[Path, Path]], Optional[ActionResult]]:
    try:
        src_path = _resolve_virtual_path(src)
        dst_path = _resolve_virtual_path(dst)
    except Exception as e:
        return None, ActionResult.err(
            "Đường dẫn nguồn/đích không hợp lệ.",
            code=ErrorCode.INVALID_PATH,
            dev_message=str(e),
        )

    if not _is_safe_path(src_path) or not _is_safe_path(dst_path):
        return None, ActionResult.err(
            "Chỉ cho phép thao tác trong thư mục an toàn.",
            code=ErrorCode.NOT_ALLOWED,
        )

    if not src_path.exists():
        return None, ActionResult.err(
            "Nguồn không tồn tại.", code=ErrorCode.FILE_NOT_FOUND
        )

    if not dst_path.exists():
        return None, ActionResult.err(
            "Thư mục đích không tồn tại.", code=ErrorCode.FILE_NOT_FOUND
        )

    if not dst_path.is_dir():
        return None, ActionResult.err(
            "Đích phải là thư mục.",
            code=ErrorCode.NOT_A_DIRECTORY,
        )

    return (src_path, dst_path), None


def copy_path(src: str, dst: str) -> ActionResult:
    prepared, err = _prepare_src_dst(src, dst)
    if err or not prepared:
        return err

    src_path, dst_dir = prepared
    target = dst_dir / src_path.name

    if target.exists():
        return ActionResult.err(
            "Đích đã tồn tại mục cùng tên.",
            code=ErrorCode.PATH_ALREADY_EXISTS,
            src=str(src_path),
            dst=str(target),
        )

    try:
        if src_path.is_dir():
            shutil.copytree(src_path, target)
            return ActionResult.ok(
                f"Đã copy thư mục '{src_path.name}' vào {dst_dir}",
                src=str(src_path),
                dst=str(target),
            )

        shutil.copy2(src_path, target)
        return ActionResult.ok(
            f"Đã copy file '{src_path.name}' vào {dst_dir}",
            src=str(src_path),
            dst=str(target),
        )
    except Exception as e:
        return ActionResult.err(
            "Lỗi khi copy file/thư mục.",
            code=ErrorCode.INTERNAL_ERROR,
            dev_message=str(e),
        )


def move_path(src: str, dst: str) -> ActionResult:
    prepared, err = _prepare_src_dst(src, dst)
    if err or not prepared:
        return err

    src_path, dst_dir = prepared
    target = dst_dir / src_path.name

    try:
        if src_path.is_dir():
            try:
                dst_dir.resolve().relative_to(src_path.resolve())
                return ActionResult.err(
                    "Không thể di chuyển thư mục vào bên trong chính nó.",
                    code=ErrorCode.NOT_ALLOWED,
                    src=str(src_path),
                    dst=str(dst_dir),
                )
            except ValueError:
                pass

        if target.exists():
            return ActionResult.err(
                "Đích đã tồn tại mục cùng tên.",
                code=ErrorCode.PATH_ALREADY_EXISTS,
                src=str(src_path),
                dst=str(target),
            )

        shutil.move(str(src_path), str(dst_dir))
        return ActionResult.ok(
            f"Đã di chuyển '{src_path.name}' vào {dst_dir}",
            src=str(src_path),
            dst=str(target),
        )
    except Exception as e:
        return ActionResult.err(
            "Lỗi khi di chuyển file/thư mục.",
            code=ErrorCode.INTERNAL_ERROR,
            dev_message=str(e),
        )


def open_url(url: str, browser: str = "default") -> ActionResult:
    url = (url or "").strip()
    if not url:
        return ActionResult.err("URL rỗng.", code=ErrorCode.UNKNOWN)

    try:
        if browser == "default":
            os.startfile(url)
            return ActionResult.ok(f"Đã mở: {url}", url=url, browser="default")

        browser_paths = {
            "chrome": r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            "edge": r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        }
        exe = browser_paths.get((browser or "").lower())

        if not exe or not Path(exe).exists():
            os.startfile(url)
            return ActionResult.ok(
                f"Đã mở bằng trình duyệt mặc định (không tìm thấy {browser}).",
                url=url,
                browser="default",
            )

        subprocess.Popen([exe, url])
        return ActionResult.ok(f"Đã mở bằng {browser}: {url}", url=url, browser=browser)
    except Exception as e:
        return ActionResult.err(
            "Lỗi khi mở URL.",
            code=ErrorCode.INTERNAL_ERROR,
            dev_message=str(e),
            url=url,
        )


def _format_workflow_step(step: dict, index: int) -> str:
    step_type = str(step.get("type") or "").strip()
    params = step.get("params") or {}
    if step_type == "open_app":
        return f"{index}. Mở ứng dụng: {params.get('app_name') or ''}".strip()
    if step_type == "open_url":
        browser = str(params.get("browser") or "default").strip()
        browser_text = "" if browser == "default" else f" bằng {browser}"
        return f"{index}. Mở URL{browser_text}: {params.get('url') or ''}".strip()
    if step_type == "open_file":
        return f"{index}. Mở file: {params.get('path') or ''}".strip()
    if step_type == "wait":
        return f"{index}. Chờ {params.get('seconds', 0)} giây"
    return f"{index}. {step_type}"


def _execute_workflow_step(step: dict[str, object]) -> ActionResult:
    step_type = str(step.get("type") or "").strip().lower()
    params = dict(step.get("params") or {})
    if step_type == "open_app":
        return open_app(app_name=str(params.get("app_name") or ""))
    if step_type == "open_url":
        return open_url(
            url=str(params.get("url") or ""),
            browser=str(params.get("browser") or "default"),
        )
    if step_type == "open_file":
        return open_file(path=str(params.get("path") or ""))
    if step_type == "wait":
        seconds = float(params.get("seconds") or 0)
        time.sleep(max(0, seconds))
        return ActionResult.ok(f"Đã chờ {seconds:g} giây.", seconds=seconds)
    return ActionResult.err(
        f"Step workflow không hỗ trợ: {step_type or '(trống)'}",
        code=ErrorCode.UNKNOWN,
    )


def _run_workflow_once(
    workflow: dict[str, object],
) -> tuple[list[dict[str, object]], int, dict[str, object] | None]:
    steps = list(workflow.get("steps") or [])
    continue_on_error = bool(workflow.get("continue_on_error", False))
    step_results: list[dict[str, object]] = []
    success_count = 0
    failed_step: dict[str, object] | None = None

    for index, step in enumerate(steps, start=1):
        result = _execute_workflow_step(step)
        step_results.append(
            {
                "index": index,
                "step": step,
                "status": str(result.status.value),
                "message": result.message,
                "error_code": str(result.error_code.value) if result.error_code else "",
            }
        )
        if result.status == ActionStatus.SUCCESS:
            success_count += 1
            continue
        failed_step = {"index": index, "step": step, "result": result}
        if not continue_on_error:
            break

    return step_results, success_count, failed_step


def _handle_list_workflows(enabled_only: bool = False) -> ActionResult:
    try:
        workflows = WorkflowService().list_workflows(enabled_only=enabled_only)
        if not workflows:
            return ActionResult.ok("Chưa có workflow nào.", workflows=[])
        lines: list[str] = []
        for index, workflow in enumerate(workflows, start=1):
            status = "bật" if bool(workflow.get("enabled", True)) else "tắt"
            step_count = len(workflow.get("steps") or [])
            description = str(workflow.get("description") or "").strip()
            run_policy = workflow.get("run_policy") or {}
            mode = str(run_policy.get("mode") or "manual")
            mode_text = {
                "manual": "thủ công",
                "repeat": f"lặp {int(run_policy.get('repeat_count') or 1)} lần",
                "scheduled": "theo lịch",
            }.get(mode, mode)
            line = f"{index}. {workflow.get('name') or workflow.get('id')} [{status}] - {step_count} bước - {mode_text}"
            if description:
                line += f"\n   {description}"
            lines.append(line)
        return ActionResult.ok(
            "Danh sách workflow:\n" + "\n".join(lines),
            workflows=workflows,
        )
    except Exception as e:
        return ActionResult.err(
            "Không thể lấy danh sách workflow.",
            code=ErrorCode.UNKNOWN,
            dev_message=str(e),
        )


def _handle_delete_workflow(workflow_ref: str) -> ActionResult:
    try:
        service = WorkflowService()
        workflow = service.find_workflow(workflow_ref)
        if not workflow:
            return ActionResult.err(
                f"Không tìm thấy workflow '{workflow_ref}'.",
                code=ErrorCode.FILE_NOT_FOUND,
            )
        deleted = service.delete_workflow(str(workflow.get("id") or ""))
        return ActionResult.ok(
            f"Đã xóa workflow '{deleted.get('name') or deleted.get('id')}'.",
            workflow=deleted,
        )
    except Exception as e:
        return ActionResult.err(
            "Không thể xóa workflow.",
            code=ErrorCode.UNKNOWN,
            dev_message=str(e),
        )


def _handle_run_workflow(workflow_ref: str) -> ActionResult:
    try:
        service = WorkflowService()
        workflow = service.find_workflow(workflow_ref)
        if not workflow:
            return ActionResult.err(
                f"Không tìm thấy workflow '{workflow_ref}'.",
                code=ErrorCode.FILE_NOT_FOUND,
            )
        if not bool(workflow.get("enabled", True)):
            return ActionResult.err(
                f"Workflow '{workflow.get('name') or workflow.get('id')}' đang tắt.",
                code=ErrorCode.NOT_ALLOWED,
            )

        steps = list(workflow.get("steps") or [])
        if not steps:
            return ActionResult.err(
                f"Workflow '{workflow.get('name') or workflow.get('id')}' chưa có bước nào.",
                code=ErrorCode.UNKNOWN,
            )

        run_policy = workflow.get("run_policy") or {}
        mode = str(run_policy.get("mode") or "manual").strip().lower() or "manual"
        repeat_count = (
            int(run_policy.get("repeat_count") or 1) if mode == "repeat" else 1
        )
        repeat_interval_seconds = (
            float(run_policy.get("repeat_interval_seconds") or 0)
            if mode == "repeat"
            else 0.0
        )
        start_delay_seconds = float(run_policy.get("start_delay_seconds") or 0)
        if start_delay_seconds > 0:
            time.sleep(start_delay_seconds)

        cycle_summaries: list[dict[str, object]] = []
        failed_cycle: dict[str, object] | None = None
        total_success = 0
        total_steps = len(steps) * repeat_count

        for cycle_index in range(1, repeat_count + 1):
            step_results, success_count, failed_step = _run_workflow_once(workflow)
            total_success += success_count
            cycle_summary = {
                "cycle": cycle_index,
                "step_results": step_results,
                "success_count": success_count,
                "failed_step": failed_step,
            }
            cycle_summaries.append(cycle_summary)
            if failed_step and not bool(workflow.get("continue_on_error", False)):
                failed_cycle = cycle_summary
                break
            if cycle_index < repeat_count and repeat_interval_seconds > 0:
                time.sleep(repeat_interval_seconds)

        summary_lines = [
            f"Workflow: {workflow.get('name') or workflow.get('id')}",
            f"Mode: {mode}",
            f"Đã chạy {total_success}/{total_steps} bước thành công.",
        ]
        if start_delay_seconds > 0:
            summary_lines.append(
                f"Độ trễ trước khi chạy: {start_delay_seconds:g} giây."
            )
        if mode == "repeat":
            summary_lines.append(
                f"Số chu kỳ: {len(cycle_summaries)}/{repeat_count}, nghỉ giữa các lần: {repeat_interval_seconds:g} giây."
            )
        for cycle_summary in cycle_summaries:
            cycle = int(cycle_summary["cycle"])
            if repeat_count > 1:
                summary_lines.append(f"Lần chạy {cycle}:")
            for item in cycle_summary["step_results"]:
                summary_lines.append(
                    f"- {_format_workflow_step(item['step'], int(item['index']))}: {item['message']}"
                )

        if failed_cycle is not None:
            result = failed_cycle["failed_step"]["result"]
            return ActionResult.err(
                "\n".join(summary_lines + ["Workflow đã dừng tại bước lỗi."]),
                code=result.error_code or ErrorCode.UNKNOWN,
                workflow=workflow,
                workflow_results=cycle_summaries,
            )

        return ActionResult.ok(
            "\n".join(summary_lines),
            workflow=workflow,
            workflow_results=cycle_summaries,
        )
    except Exception as e:
        return ActionResult.err(
            "Không thể chạy workflow.",
            code=ErrorCode.UNKNOWN,
            dev_message=str(e),
        )


def youtube_search(query: str, browser: str = "default") -> ActionResult:
    import urllib.parse

    q = (query or "").strip()
    if not q:
        return ActionResult.err(
            "Không có nội dung để tìm trên YouTube.", code=ErrorCode.UNKNOWN
        )

    url = "https://www.youtube.com/results?search_query=" + urllib.parse.quote(q)
    return open_url(url, browser=browser)


def youtube_play_first(query: str, browser: str = "default") -> ActionResult:
    q = (query or "").strip()
    if not q:
        return ActionResult.err(
            "Không có nội dung để tìm trên YouTube.", code=ErrorCode.UNKNOWN
        )

    try:
        from yt_dlp import YoutubeDL
    except Exception as e:
        return ActionResult.err(
            "Thiếu thư viện yt-dlp. Bạn hãy cài: pip install yt-dlp",
            code=ErrorCode.INTERNAL_ERROR,
            dev_message=str(e),
        )

    try:
        ydl_opts = {
            "quiet": True,
            "skip_download": True,
            "noplaylist": True,
            "extract_flat": True,
        }

        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(f"ytsearch1:{q}", download=False)
            entries = info.get("entries") or []
            if not entries:
                return ActionResult.err(
                    f"Không tìm thấy video phù hợp cho: {q}",
                    code=ErrorCode.FILE_NOT_FOUND,
                )

            v = entries[0]
            video_id = v.get("id")
            title = v.get("title") or "Video"
            if not video_id:
                return ActionResult.err(
                    f"Không lấy được video_id cho: {q}",
                    code=ErrorCode.INTERNAL_ERROR,
                )

            url = f"https://www.youtube.com/watch?v={video_id}"
            opened = open_url(url, browser=browser)
            if opened.status != ActionStatus.SUCCESS:
                return opened

            # keep message short + stable
            return ActionResult.ok(
                f"{opened.message}\n(Tự chọn: {title})",
                url=url,
                title=title,
                query=q,
                browser=browser,
            )

    except Exception as e:
        return ActionResult.err(
            "Lỗi khi tự chọn video YouTube.",
            code=ErrorCode.INTERNAL_ERROR,
            dev_message=str(e),
        )


def web_search(query: str) -> ActionResult:
    import urllib.parse

    q = (query or "").strip()
    if not q:
        return ActionResult.err("Không có nội dung để tìm.", code=ErrorCode.UNKNOWN)

    try:
        url = "https://www.google.com/search?q=" + urllib.parse.quote(q)
        os.startfile(url)
        return ActionResult.ok(f"Đã mở trình duyệt tìm: {q}", query=q, url=url)
    except Exception as e:
        return ActionResult.err(
            "Lỗi khi mở trình duyệt.",
            code=ErrorCode.INTERNAL_ERROR,
            dev_message=str(e),
        )


def guess_app_name(user_text: str, allow_prefix: bool = False) -> Optional[str]:
    """
    Nhận text đã strip action (vd: 'notepad', 'chrome', 'vs code')
    Trả về app_key chuẩn (vd: 'notepad', 'chrome', 'vscode') nếu match tốt.
    Không mở app, không side-effect.
    """
    q = (user_text or "").strip().lower()
    if not q:
        return None

    if allow_prefix:
        key, _ = extract_app_and_remainder(q)
        if key:
            return key

    # normalize qua alias trước
    key = _norm_app_key(q)

    # 1) match trực tiếp allowlist
    if key in ALLOWED_APPS:
        return key

    # 2) thử resolve từ start menu (nhẹ, có thể cache sau)
    exe = resolve_app_path(key) or resolve_app_path(q)
    if exe:
        # nếu tìm ra exe thì coi như match app hợp lệ
        # lưu lại để lần sau khỏi scan
        ALLOWED_APPS[key] = {"path": exe}
        return key

    return None


def open_app(app_name: str, confirm_before_custom_picker: bool = False) -> ActionResult:
    key = _norm_app_key(app_name)
    raw_name = (app_name or "").strip().lower()
    remote_debug = "remote" in raw_name or "debug" in raw_name
    if remote_debug:
        if "chrome" in raw_name:
            key = "chrome"
        elif "edge" in raw_name:
            key = "edge"
    if not key:
        return ActionResult.err("KhĂ´ng cĂ³ tĂªn á»©ng dá»¥ng.", code=ErrorCode.UNKNOWN)

    custom_record = _resolve_custom_app_record(app_name, key)
    if custom_record:
        if not CustomAppService().validate_target(custom_record):
            return _build_custom_app_prompt_result(
                app_name,
                alias=str(custom_record.get("alias") or app_name),
                reason="missing_target",
                target_path=str(custom_record.get("target_path") or ""),
                display_name=str(custom_record.get("display_name") or ""),
                require_confirmation=confirm_before_custom_picker,
            )
        return open_app_target(
            str(custom_record.get("target_path") or ""),
            app_key=str(custom_record.get("alias") or key or app_name),
            display_name=str(custom_record.get("display_name") or app_name),
            arguments=str(custom_record.get("arguments") or ""),
            working_dir=str(custom_record.get("working_dir") or ""),
        )

    record = ALLOWED_APPS.get(key)
    if record is None:
        record = {"path": None}
        ALLOWED_APPS[key] = record

    exe = _extract_exe(record)
    if not exe:
        exe = (
            resolve_office_app_path(key)
            or resolve_app_path(key)
            or resolve_app_path(app_name)
        )
        if not exe:
            return _build_custom_app_prompt_result(
                app_name,
                alias=app_name if key == app_name else key,
                reason="not_found",
                require_confirmation=confirm_before_custom_picker,
            )
        record["path"] = exe

    try:
        if not Path(exe).exists():
            return _build_custom_app_prompt_result(
                app_name,
                alias=app_name if key == app_name else key,
                reason="missing_target",
                target_path=exe,
                display_name=app_name,
                require_confirmation=confirm_before_custom_picker,
            )
    except Exception as e:
        return ActionResult.err(
            "ÄÆ°á»ng dáº«n .exe khĂ´ng há»£p lá»‡.",
            code=ErrorCode.INTERNAL_ERROR,
            dev_message=str(e),
        )

    arguments = ""
    if remote_debug and key in {"edge", "chrome"}:
        port = 9222 if key == "edge" else 9223
        profile_dir = ensure_app_data_dir(f"{key}_remote_profile")
        arguments = f"--remote-debugging-port={port} --user-data-dir=\"{profile_dir}\""

    result = open_app_target(
        exe,
        app_key=key,
        display_name=app_name,
        arguments=arguments,
    )
    if remote_debug and result.status == ActionStatus.SUCCESS:
        port = 9222 if key == "edge" else 9223
        result.message = f"Đã mở {key} remote. Sau vài giây có thể gửi: tab {key} đang mở."
        result.data["browser_debug_port"] = port
    return result


def guess_app_name(user_text: str, allow_prefix: bool = False) -> Optional[str]:
    q = (user_text or "").strip().lower()
    if not q:
        return None

    if allow_prefix:
        key, _ = extract_app_and_remainder(q)
        if key:
            return key

    custom_record = _resolve_custom_app_record(q, _norm_app_key(q))
    if custom_record:
        return str(custom_record.get("alias") or q)

    key = _norm_app_key(q)
    if key in ALLOWED_APPS:
        return key

    exe = resolve_app_path(key) or resolve_app_path(q)
    if exe:
        ALLOWED_APPS[key] = {"path": exe}
        return key

    return None


def _handle_list_custom_apps() -> ActionResult:
    apps = CustomAppService().list_apps()
    if not apps:
        return ActionResult.ok("Chưa có ứng dụng đã lưu.", custom_apps=[])
    lines = []
    for index, item in enumerate(apps, start=1):
        alias = str(item.get("alias") or "")
        display = str(item.get("display_name") or alias)
        path = str(item.get("target_path") or "")
        lines.append(f"{index}. {alias} -> {display}\n{path}")
    return ActionResult.ok(
        "Danh sách ứng dụng đã lưu:\n" + "\n".join(lines),
        custom_apps=apps,
    )


def _handle_delete_custom_app(app_ref: str) -> ActionResult:
    deleted = CustomAppService().delete_app(app_ref)
    alias = str(deleted.get("alias") or app_ref)
    return ActionResult.ok(
        f"Đã xóa ứng dụng đã lưu '{alias}'.",
        custom_app=deleted,
    )


def _email_page_size_for(date: str) -> int:
    normalized = (date or "").strip().lower()
    if normalized == "latest":
        return 10
    return 20


def _handle_check_email(
    mode: str,
    limit: int = 0,
    page_token: str = "",
    append: bool = False,
) -> ActionResult:
    try:
        emailService = GmailService()

        status, date = mode.split(":")
        page_size = int(limit or 0) or _email_page_size_for(date)

        page = emailService.get_emails_page(
            date=date,
            status=status,
            limit=page_size,
            page_token=page_token or "",
        )
        mails = page.get("emails") or []
        next_page_token = str(page.get("next_page_token") or "")

        vi_status = {"read": "đã đọc", "unread": "chưa đọc", "any": ""}[status]

        vi_date = {
            "today": "hôm nay",
            "yesterday": "hôm qua",
            "latest": "gần nhất",
        }.get(
            date,
            (
                datetime.strptime(date, "%Y/%m/%d").strftime("%d/%m/%Y")
                if re.fullmatch(r"\d{4}/\d{2}/\d{2}", date)
                else date
            ),
        )

        period_label = "ngày"
        if re.fullmatch(r"\d{4}/\d{2}", date):
            year, month = date.split("/")
            vi_date = f"tháng {int(month)}/{year}"
            period_label = "tháng"

        # no email
        if not mails:
            if append and page_token:
                return ActionResult.ok(
                    "Không còn email nào để tải thêm.",
                    json={
                        "data": [],
                        "pagination": {
                            "mode": mode,
                            "page_size": page_size,
                            "next_page_token": "",
                            "append": True,
                            "has_more": False,
                        },
                    },
                )
            if status == "any":
                return ActionResult.ok(
                    f"Không có email trong {period_label} {vi_date}."
                )
            return ActionResult.ok(
                f"Không có email {vi_status} trong {period_label} {vi_date}."
            )

        # found email
        if status == "any":
            msg = f"Tìm thấy {len(mails)} email trong {period_label} {vi_date}:"
        else:
            msg = f"Tìm thấy {len(mails)} email {vi_status} trong {period_label} {vi_date}:"

        lst = gmail_trigger_detector(mails)
        if next_page_token:
            msg += '\nGõ "xem thêm email" để tải thêm.'

        return ActionResult.ok(
            msg,
            json={
                "data": lst,
                "summary_pending": True,
                "pagination": {
                    "mode": mode,
                    "page_size": page_size,
                    "next_page_token": next_page_token,
                    "append": append,
                    "has_more": bool(next_page_token),
                },
            },
        )

    except Exception as e:
        return ActionResult.err(
            "Lỗi khi lấy email.", code=ErrorCode.UNKNOWN, dev_message=str(e)
        )


def _handle_email_login(account_email: str = "", prompt_select: bool = True) -> ActionResult:
    try:
        auth_service = GoogleAuthService("gmail")
        creds, address = auth_service.get_credentials(
            scopes=GmailService.SCOPES,
            account_email=(account_email or "").strip().lower() or None,
            legacy_token_names=["token.json"],
            prompt_select=prompt_select,
        )
        service = build("gmail", "v1", credentials=creds)
        profile = service.users().getProfile(userId="me").execute()
        address = (profile.get("emailAddress") or address or "unknown").strip().lower()
        return ActionResult.ok(
            f"Đăng nhập Gmail thành công: {address}",
            email=address,
            profile=profile,
        )
    except Exception as e:
        return ActionResult.err(
            "Không thể đăng nhập Gmail.",
            code=ErrorCode.UNKNOWN,
            dev_message=str(e),
        )


def _handle_email_list_accounts() -> ActionResult:
    try:
        auth_service = GoogleAuthService("gmail")
        accounts = auth_service.list_accounts()
        if not accounts:
            return ActionResult.ok(
                "ChÆ°a cĂ³ tĂ i khoáº£n Gmail nĂ o Ä‘Æ°á»£c káº¿t ná»‘i.",
                gmail_accounts=[],
            )
        lines = [
            f"{idx + 1}. {item['email']}"
            + (" (Ä‘ang dĂ¹ng)" if item.get("is_active") else "")
            for idx, item in enumerate(accounts)
        ]
        return ActionResult.ok(
            "Danh sĂ¡ch tĂ i khoáº£n Gmail Ä‘Ă£ káº¿t ná»‘i:\n" + "\n".join(lines),
            gmail_accounts=accounts,
        )
    except Exception as e:
        return ActionResult.err(
            "KhĂ´ng thá»ƒ láº¥y danh sĂ¡ch tĂ i khoáº£n Gmail.",
            code=ErrorCode.UNKNOWN,
            dev_message=str(e),
        )


def _handle_email_set_account(email: str) -> ActionResult:
    try:
        selected = GoogleAuthService("gmail").set_active_account(email)
        try:
            PersonalMemoryService().set_preference(
                "gmail_default_account", selected["email"]
            )
        except Exception:
            pass
        return ActionResult.ok(
            f"ÄĂ£ chá»n tĂ i khoáº£n Gmail: {selected['email']}",
            gmail_account=selected,
        )
    except Exception as e:
        return ActionResult.err(
            "KhĂ´ng thá»ƒ chá»n tĂ i khoáº£n Gmail.",
            code=ErrorCode.UNKNOWN,
            dev_message=str(e),
        )


def _handle_email_logout_account(email: str = "") -> ActionResult:
    try:
        auth_service = GoogleAuthService("gmail")
        target = (email or auth_service.get_active_account() or "").strip().lower()
        if not target:
            return ActionResult.ok("Hiá»‡n chÆ°a cĂ³ tĂ i khoáº£n Gmail nĂ o Ä‘ang Ä‘Æ°á»£c chá»n.")
        removed = auth_service.remove_account(target)
        next_active = auth_service.get_active_account()
        message = f"ÄĂ£ Ä‘Äƒng xuáº¥t Gmail khá»i tĂ i khoáº£n {target}."
        if next_active:
            message += f"\nTĂ i khoáº£n Ä‘ang dĂ¹ng hiá»‡n táº¡i: {next_active}."
        else:
            message += "\nHiá»‡n chÆ°a cĂ³ tĂ i khoáº£n Gmail nĂ o Ä‘ang Ä‘Æ°á»£c chá»n."
        return ActionResult.ok(
            message,
            gmail_account={
                "email": target,
                "removed": bool(removed.get("removed")),
                "active_email": next_active,
            },
        )
    except Exception as e:
        return ActionResult.err(
            "KhĂ´ng thá»ƒ Ä‘Äƒng xuáº¥t tĂ i khoáº£n Gmail.",
            code=ErrorCode.UNKNOWN,
            dev_message=str(e),
        )


def _handle_read_email(message_id: str) -> ActionResult:
    try:
        email_service = GmailService()
        detail = email_service.get_message_detail(message_id)
        return ActionResult.ok(
            f"Đã mở email: {detail.get('subject') or '(không tiêu đề)'}",
            json={"detail": detail},
            email=detail,
        )
    except Exception as e:
        return ActionResult.err(
            "Không thể đọc email.",
            code=ErrorCode.UNKNOWN,
            dev_message=str(e),
        )


def _handle_send_email(
    to: str,
    subject: str,
    body: str,
    cc: str = "",
    bcc: str = "",
    attachments: list[str] | None = None,
) -> ActionResult:
    try:
        memory = PersonalMemoryService()
        preferred_account = str(
            memory.get_preference("gmail_default_account", "") or ""
        ).strip()
        try:
            email_service = GmailService(account_email=preferred_account or None)
        except Exception:
            email_service = GmailService()
        sent = email_service.send_email(
            to=to,
            subject=subject,
            body=body,
            cc=cc or None,
            bcc=bcc or None,
            attachments=attachments or None,
            include_signature=True,
        )
        return ActionResult.ok(
            f"Đã gửi email tới {to}",
            sent=sent,
            to=to,
            subject=subject,
        )
    except Exception as e:
        return ActionResult.err(
            "Không thể gửi email.",
            code=ErrorCode.UNKNOWN,
            dev_message=str(e),
        )


def _preview_bulk_email(
    file_path: str,
    preview_rows: list[dict] | None = None,
    invalid_rows: list[dict] | None = None,
    total_valid: int | None = None,
    total_invalid: int | None = None,
) -> ActionResult:
    try:
        service = BulkEmailService()
        parsed = service.parse_excel(file_path)
        preview_rows = parsed.get("preview_rows", [])
        invalid_rows = parsed.get("invalid_rows", [])
        total_valid = parsed.get("total_valid", 0)
        total_invalid = parsed.get("total_invalid", 0)

        summary = [
            f"Đã đọc file Excel: {Path(file_path).name}",
            f"Số email hợp lệ: {total_valid}",
        ]
        if total_invalid:
            summary.append(f"Số dòng lỗi/bỏ qua: {total_invalid}")
        if preview_rows:
            summary.append("Bên dưới là toàn bộ nội dung email sẽ gửi để bạn xem lại.")
        if invalid_rows:
            first_invalid = invalid_rows[:3]
            summary.append(
                "Lỗi mẫu: "
                + " | ".join(
                    f"dòng {item['row_number']}: {item['reason']}"
                    for item in first_invalid
                )
            )
        summary.append("Cột file đính kèm hỗ trợ nhiều file, ngăn cách bằng dấu ';'.")
        summary.append(
            "Chưa gửi email. Chỉ khi bạn bấm Đồng ý thì hệ thống mới bắt đầu gửi."
        )

        return ActionResult.ok(
            "\n".join(summary),
            preview_rows=preview_rows,
            invalid_rows=invalid_rows,
            total_valid=total_valid,
            total_invalid=total_invalid,
            file_path=file_path,
        )
    except Exception as e:
        return ActionResult.err(
            "Không thể đọc file Excel gửi email.",
            code=ErrorCode.UNKNOWN,
            dev_message=str(e),
        )


def _get_bulk_email_senders() -> ActionResult:
    try:
        email_service = GmailService()
        senders = email_service.list_sender_aliases()
        return ActionResult.ok(
            "Đã lấy danh sách địa chỉ gửi khả dụng.",
            senders=senders,
        )
    except Exception as e:
        return ActionResult.err(
            "Không thể lấy danh sách địa chỉ gửi từ Gmail.",
            code=ErrorCode.UNKNOWN,
            dev_message=str(e),
        )


def _handle_send_bulk_email(
    file_path: str,
    preview_rows: list[dict] | None = None,
    invalid_rows: list[dict] | None = None,
    total_valid: int | None = None,
    total_invalid: int | None = None,
    from_address: str = "",
) -> ActionResult:
    try:
        service = BulkEmailService()
        parsed = service.parse_excel(file_path)
        memory = PersonalMemoryService()
        preferred_account = (
            str(memory.get_preference("gmail_default_account", "") or "")
            .strip()
            .lower()
        )
        effective_from_address = (from_address or preferred_account).strip().lower()
        try:
            email_service = GmailService(account_email=preferred_account or None)
        except Exception:
            email_service = GmailService()

        results: list[dict[str, str | int]] = []
        success_count = 0
        failed_count = 0

        for item in parsed["valid_rows"]:
            try:
                attachments: list[str] = []
                attachment_paths = item.get("attachment_paths") or []
                for attachment_path in attachment_paths:
                    if not is_safe_path(attachment_path):
                        raise ValueError("file đính kèm nằm ngoài thư mục an toàn")
                    attachments.append(attachment_path)
                email_service.send_email(
                    to=item["to"],
                    subject=item["subject"],
                    body=item["body"],
                    cc=item.get("cc") or None,
                    bcc=item.get("bcc") or None,
                    attachments=attachments,
                    from_address=effective_from_address or None,
                    include_signature=True,
                )
                success_count += 1
                results.append(
                    {
                        "row_number": item["row_number"],
                        "email": item["to"],
                        "cc": item.get("cc", ""),
                        "bcc": item.get("bcc", ""),
                        "attachment_paths": attachments,
                        "from_address": effective_from_address,
                        "status": "sent",
                    }
                )
            except Exception as send_error:
                failed_count += 1
                results.append(
                    {
                        "row_number": item["row_number"],
                        "email": item["to"],
                        "cc": item.get("cc", ""),
                        "bcc": item.get("bcc", ""),
                        "attachment_paths": item.get("attachment_paths", []),
                        "from_address": effective_from_address,
                        "status": "failed",
                        "error": str(send_error),
                    }
                )

        for item in parsed["invalid_rows"]:
            results.append(
                {
                    "row_number": item["row_number"],
                    "email": item.get("email", ""),
                    "cc": item.get("cc", ""),
                    "bcc": item.get("bcc", ""),
                    "attachment_paths": item.get("attachment_paths", []),
                    "status": "skipped",
                    "error": item["reason"],
                }
            )

        log_path = service.write_send_log(
            source_file=file_path,
            results=results,
            total_success=success_count,
            total_failed=failed_count,
        )
        result_excel_path = service.export_result_workbook(
            source_file=file_path,
            results=results,
        )

        message = [
            f"Đã xử lý gửi email từ file {Path(file_path).name}.",
            f"Địa chỉ gửi: {effective_from_address or '(mặc định của tài khoản Gmail hiện tại)'}",
            f"Gửi thành công: {success_count}",
        ]
        if failed_count:
            message.append(f"Gửi lỗi: {failed_count}")
        if parsed["total_invalid"]:
            message.append(f"Bỏ qua do dữ liệu lỗi: {parsed['total_invalid']}")
        message.append(f"Excel kết quả: {result_excel_path}")
        message.append(f"Log kết quả: {log_path}")

        return ActionResult.ok(
            "\n".join(message),
            bulk_email={
                "source_file": file_path,
                "from_address": effective_from_address,
                "success_count": success_count,
                "failed_count": failed_count,
                "invalid_count": parsed["total_invalid"],
                "result_excel_path": result_excel_path,
                "log_path": log_path,
                "results": results,
            },
        )
    except Exception as e:
        return ActionResult.err(
            "Không thể gửi email hàng loạt từ file Excel.",
            code=ErrorCode.UNKNOWN,
            dev_message=str(e),
        )


def _handle_set_memory(key: str, value) -> ActionResult:
    try:
        service = PersonalMemoryService()
        updated = service.set_value(key, value, source="chat")
        return ActionResult.ok(
            f"Đã lưu memory cho '{updated['key']}'.",
            memory_update=updated,
            _skip_personal_history=True,
        )
    except Exception as e:
        return ActionResult.err(
            "Không thể lưu memory.",
            code=ErrorCode.UNKNOWN,
            dev_message=str(e),
        )


def _handle_view_memory() -> ActionResult:
    try:
        service = PersonalMemoryService()
        payload = service.view_memory()
        return ActionResult.ok(
            _format_memory_message(payload, include_history_details=True),
            memory=payload,
            _skip_personal_history=True,
        )
    except Exception as e:
        return ActionResult.err(
            "Không thể đọc memory.",
            code=ErrorCode.UNKNOWN,
            dev_message=str(e),
        )


def _handle_delete_memory_key(key: str) -> ActionResult:
    try:
        service = PersonalMemoryService()
        deleted = service.delete_key(key, source="chat")
        return ActionResult.ok(
            f"Đã xóa memory key '{deleted['key']}'.",
            memory_delete=deleted,
            _skip_personal_history=True,
        )
    except Exception as e:
        return ActionResult.err(
            "Không thể xóa memory key.",
            code=ErrorCode.UNKNOWN,
            dev_message=str(e),
        )


def _handle_clear_memory_history() -> ActionResult:
    try:
        service = PersonalMemoryService()
        cleared = service.clear_history()
        return ActionResult.ok(
            "Đã xóa history của personal memory.",
            memory_history=cleared,
            _skip_personal_history=True,
        )
    except Exception as e:
        return ActionResult.err(
            "Không thể xóa history memory.",
            code=ErrorCode.UNKNOWN,
            dev_message=str(e),
        )


def _handle_set_entity_memory(
    alias: str, value, kind: str = "generic", notes: str = ""
) -> ActionResult:
    try:
        service = PersonalMemoryService()
        entity = service.set_entity(
            alias=alias, value=value, kind=kind, notes=notes, source="chat"
        )
        return ActionResult.ok(
            f"Đã lưu entity '{entity['alias']}'.",
            entity=entity,
            _skip_personal_history=True,
        )
    except Exception as e:
        return ActionResult.err(
            "Không thể lưu entity memory.",
            code=ErrorCode.UNKNOWN,
            dev_message=str(e),
        )


def _handle_view_entity_memory() -> ActionResult:
    try:
        service = PersonalMemoryService()
        entities = service.list_entities()
        payload = service.view_memory()
        return ActionResult.ok(
            _format_memory_message(payload, include_history_details=True),
            entities=entities,
            memory=payload,
            _skip_personal_history=True,
        )
    except Exception as e:
        return ActionResult.err(
            "Không thể đọc entity memory.",
            code=ErrorCode.UNKNOWN,
            dev_message=str(e),
        )


def _handle_delete_entity_memory(alias: str) -> ActionResult:
    try:
        service = PersonalMemoryService()
        entity = service.delete_entity(alias, source="chat")
        return ActionResult.ok(
            f"Đã xóa entity '{entity.get('alias') or alias}'.",
            entity_delete=entity,
            _skip_personal_history=True,
        )
    except Exception as e:
        return ActionResult.err(
            "Không thể xóa entity memory.",
            code=ErrorCode.UNKNOWN,
            dev_message=str(e),
        )


def _handle_add_pinned_knowledge(title: str, content: str) -> ActionResult:
    try:
        service = PersonalMemoryService()
        pinned = service.add_pinned_knowledge(
            title=title, content=content, source="chat"
        )
        return ActionResult.ok(
            f"Đã ghim ghi chú '{pinned['title']}'.",
            pinned_knowledge=pinned,
            _skip_personal_history=True,
        )
    except Exception as e:
        return ActionResult.err(
            "Không thể ghim ghi chú.",
            code=ErrorCode.UNKNOWN,
            dev_message=str(e),
        )


def _handle_view_pinned_knowledge() -> ActionResult:
    try:
        service = PersonalMemoryService()
        pinned = service.list_pinned_knowledge()
        payload = service.view_memory()
        return ActionResult.ok(
            _format_memory_message(payload, include_history_details=True),
            pinned_knowledge=pinned,
            memory=payload,
            _skip_personal_history=True,
        )
    except Exception as e:
        return ActionResult.err(
            "Không thể đọc pinned knowledge.",
            code=ErrorCode.UNKNOWN,
            dev_message=str(e),
        )


def _handle_delete_pinned_knowledge(title: str) -> ActionResult:
    try:
        service = PersonalMemoryService()
        pinned = service.delete_pinned_knowledge(title, source="chat")
        return ActionResult.ok(
            f"Đã xóa ghi chú ghim '{pinned.get('title') or title}'.",
            pinned_delete=pinned,
            _skip_personal_history=True,
        )
    except Exception as e:
        return ActionResult.err(
            "Không thể xóa ghi chú ghim.",
            code=ErrorCode.UNKNOWN,
            dev_message=str(e),
        )


def _record_personal_recent_action(
    command: str,
    status: str,
    result_message: str,
    metadata: dict | None = None,
) -> None:
    service = PersonalMemoryService()
    service.learn_from_action(
        command=command,
        status=status,
        result_message=result_message,
        metadata=metadata or {},
    )


def _format_memory_message(
    payload: dict,
    *,
    include_history_details: bool = False,
    history_limit: int = 10,
) -> str:
    profile = payload.get("profile") or {}
    preferences = payload.get("preferences") or {}
    entities = payload.get("entities") or {}
    pinned_knowledge = payload.get("pinned_knowledge") or []
    recent_actions = payload.get("recent_actions") or []
    history = payload.get("history") or []

    message_lines = [
        "Thông tin memory hiện tại:",
        f"- Tên: {profile.get('name') or '(chưa có)'}",
        f"- Múi giờ: {profile.get('timezone') or '(chưa có)'}",
        f"- Công việc: {profile.get('job') or '(chưa có)'}",
        f"- Gmail mặc định: {preferences.get('gmail_default_account') or '(chưa có)'}",
        f"- Folder báo cáo yêu thích: {preferences.get('favorite_report_folder') or '(chưa có)'}",
        f"- App mở file mặc định: {preferences.get('open_file_app') or '(chưa có)'}",
        f"- Thư mục hay dùng: {', '.join(profile.get('frequent_folders') or []) or '(chưa có)'}",
        f"- App hay dùng: {', '.join(profile.get('preferred_apps') or []) or '(chưa có)'}",
        f"- Mẫu câu ưa thích: {profile.get('favorite_prompt_style') or '(chưa có)'}",
        f"- Entity memory: {len(entities)}",
        f"- Pinned knowledge: {len(pinned_knowledge)}",
        f"- Recent actions: {len(recent_actions)}",
        f"- History: {len(history)}",
    ]

    if not include_history_details:
        return "\n".join(message_lines)

    if recent_actions:
        message_lines.append("")
        message_lines.append("Recent actions:")
        for item in recent_actions[-history_limit:]:
            timestamp = _format_memory_timestamp(item.get("timestamp"))
            command = str(item.get("command") or "").strip() or "(không có lệnh)"
            status = str(item.get("status") or "").strip() or "unknown"
            result_message = str(item.get("result_message") or "").strip()
            line = f"- [{timestamp}] {command} -> {status}"
            if result_message:
                line += f" | {result_message}"
            message_lines.append(line)

    if entities:
        message_lines.append("")
        message_lines.append("Entity memory:")
        for alias in sorted(entities.keys())[:history_limit]:
            item = entities.get(alias) or {}
            title = item.get("alias") or alias
            kind = item.get("kind") or "generic"
            value = _format_memory_value(item.get("value"))
            message_lines.append(f"- {title} ({kind}): {value}")

    if pinned_knowledge:
        message_lines.append("")
        message_lines.append("Pinned knowledge:")
        for item in pinned_knowledge[:history_limit]:
            title = str(item.get("title") or "(không tiêu đề)")
            content = str(item.get("content") or "").strip()
            message_lines.append(f"- {title}: {content}")

    if history:
        message_lines.append("")
        message_lines.append("Lịch sử thay đổi memory:")
        for item in history[-history_limit:]:
            timestamp = _format_memory_timestamp(item.get("timestamp"))
            action = str(item.get("action") or "").strip() or "update"
            key = str(item.get("key") or "").strip() or "(unknown)"
            value = _format_memory_value(item.get("value"))
            message_lines.append(f"- [{timestamp}] {action} {key} = {value}")

    return "\n".join(message_lines)


def _format_memory_timestamp(value) -> str:
    text = str(value or "").strip()
    if not text:
        return "không rõ thời gian"
    try:
        dt = datetime.fromisoformat(text)
        return dt.strftime("%d/%m/%Y %H:%M")
    except Exception:
        return text


def _format_memory_value(value) -> str:
    if isinstance(value, list):
        return ", ".join(str(item) for item in value) if value else "(rỗng)"
    if value in ("", None):
        return "(trống)"
    return str(value)


def _handle_reply_email(
    message_id: str, body: str, reply_all: bool = False
) -> ActionResult:
    try:
        email_service = GmailService()
        detail = email_service.get_message_detail(message_id)
        sent = email_service.reply_email(
            message_id=message_id, body=body, reply_all=reply_all
        )
        return ActionResult.ok(
            f"Đã trả lời email: {detail.get('subject') or '(không tiêu đề)'}",
            sent=sent,
            email=detail,
        )
    except Exception as e:
        return ActionResult.err(
            "Không thể trả lời email.",
            code=ErrorCode.UNKNOWN,
            dev_message=str(e),
        )


def _handle_mark_email(message_id: str, unread: bool = False) -> ActionResult:
    try:
        email_service = GmailService()
        detail = email_service.get_message_detail(message_id)
        if unread:
            email_service.mark_as_unread(message_id)
            action_text = "chưa đọc"
        else:
            email_service.mark_as_read(message_id)
            action_text = "đã đọc"
        return ActionResult.ok(
            f"Đã đánh dấu email '{detail.get('subject') or '(không tiêu đề)'}' là {action_text}.",
            email=detail,
            unread=unread,
        )
    except Exception as e:
        return ActionResult.err(
            "Không thể cập nhật trạng thái email.",
            code=ErrorCode.UNKNOWN,
            dev_message=str(e),
        )


def _handle_archive_email(message_id: str) -> ActionResult:
    try:
        email_service = GmailService()
        detail = email_service.get_message_detail(message_id)
        email_service.archive_message(message_id)
        return ActionResult.ok(
            f"Đã lưu trữ email: {detail.get('subject') or '(không tiêu đề)'}",
            email=detail,
        )
    except Exception as e:
        return ActionResult.err(
            "Không thể lưu trữ email.",
            code=ErrorCode.UNKNOWN,
            dev_message=str(e),
        )


def _handle_drive_login(
    account_email: str = "", prompt_select: bool = True
) -> ActionResult:
    try:
        drive_service = GoogleDriveService(account_email=account_email or None)
        connected = drive_service.connect(
            account_email=account_email or None, prompt_select=prompt_select
        )
        profile = connected.get("profile") or {}
        user = profile.get("user") or {}
        email = user.get("emailAddress") or connected.get("email") or account_email
        display_name = user.get("displayName") or ""
        message = f"Đã kết nối Google Drive với tài khoản {email}."
        if display_name:
            message = f"Đã kết nối Google Drive với tài khoản {display_name} <{email}>."
        return ActionResult.ok(
            message,
            drive_account={
                "email": email,
                "display_name": display_name,
                "storage_quota": profile.get("storageQuota") or {},
            },
        )
    except Exception as e:
        return ActionResult.err(
            _format_google_drive_error(e),
            code=ErrorCode.UNKNOWN,
            dev_message=str(e),
        )


def _handle_drive_list_accounts() -> ActionResult:
    try:
        drive_service = GoogleDriveService()
        accounts = drive_service.list_connected_accounts()
        if not accounts:
            return ActionResult.ok(
                "Chưa có tài khoản Google Drive nào được kết nối.", drive_accounts=[]
            )
        lines = [
            f"{idx + 1}. {item['email']}"
            + (" (đang dùng)" if item.get("is_active") else "")
            for idx, item in enumerate(accounts)
        ]
        return ActionResult.ok(
            "Danh sách tài khoản Google Drive đã kết nối:\n" + "\n".join(lines),
            drive_accounts=accounts,
        )
    except Exception as e:
        return ActionResult.err(
            _format_google_drive_error(
                e, fallback="Không thể lấy danh sách tài khoản Google Drive."
            ),
            code=ErrorCode.UNKNOWN,
            dev_message=str(e),
        )


def _handle_drive_logout(account_email: str = "") -> ActionResult:
    try:
        drive_service = GoogleDriveService()
        result = drive_service.logout(account_email=account_email or None)
        email = result.get("email") or account_email
        next_active = result.get("active_email") or ""
        message = f"Đã đăng xuất Google Drive khỏi tài khoản {email}."
        if next_active:
            message += f"\nTài khoản đang dùng hiện tại: {next_active}."
        else:
            message += "\nHiện chưa có tài khoản Google Drive nào đang được chọn."
        return ActionResult.ok(
            message,
            drive_account={
                "email": email,
                "active_email": next_active,
            },
        )
    except Exception as e:
        return ActionResult.err(
            _format_google_drive_error(e, fallback="Không thể đăng xuất Google Drive."),
            code=ErrorCode.UNKNOWN,
            dev_message=str(e),
        )


def _handle_drive_set_account(email: str) -> ActionResult:
    try:
        drive_service = GoogleDriveService()
        selected = drive_service.set_active_account(email)
        return ActionResult.ok(
            f"Đã chọn tài khoản Google Drive: {selected['email']}",
            drive_account=selected,
        )
    except Exception as e:
        return ActionResult.err(
            _format_google_drive_error(
                e, fallback="Không thể chọn tài khoản Google Drive."
            ),
            code=ErrorCode.UNKNOWN,
            dev_message=str(e),
        )


def _handle_search_drive_files(query: str, max_results: int = 10) -> ActionResult:
    try:
        drive_service = GoogleDriveService()
        files = drive_service.search_files(query=query, max_results=max_results)
        active_account = drive_service.get_active_account()
        if not files:
            return ActionResult.ok(
                f"Không tìm thấy file nào trên Google Drive cho từ khóa '{query}'.",
                drive_files=[],
                active_drive_account=active_account,
            )
        lines = [
            f"{idx + 1}. {item['name']} ({item['id']})"
            for idx, item in enumerate(files)
        ]
        return ActionResult.ok(
            "Đã tìm thấy các file trên Google Drive:\n" + "\n".join(lines),
            drive_files=files,
            active_drive_account=active_account,
        )
    except Exception as e:
        return ActionResult.err(
            _format_google_drive_error(
                e, fallback="Không thể tìm file trên Google Drive."
            ),
            code=ErrorCode.UNKNOWN,
            dev_message=str(e),
        )


def _handle_drive_upload(
    file_path: str,
    folder_id: str = "",
    folder_ref: str = "",
    create_folder_if_missing: bool = False,
) -> ActionResult:
    try:
        path = Path(file_path).resolve()
        if not path.exists() or not path.is_file():
            return ActionResult.err(
                f"Không tìm thấy file để upload: {file_path}",
                code=ErrorCode.FILE_NOT_FOUND,
            )
        if not is_safe_path(str(path)):
            return ActionResult.err(
                "Không cho phép upload file ngoài thư mục an toàn.",
                code=ErrorCode.NOT_ALLOWED,
            )
        drive_service = GoogleDriveService()
        resolved_folder = None
        target_folder_id = folder_id or ""
        if folder_ref:
            resolved_folder = drive_service.resolve_folder(
                folder_ref,
                create_if_missing=create_folder_if_missing,
            )
            target_folder_id = resolved_folder.get("id") or ""

        uploaded = drive_service.upload_file(
            local_path=str(path), folder_id=target_folder_id or None
        )
        target_message = " lên Google Drive."
        if resolved_folder:
            target_message = f" vào folder '{resolved_folder.get('name') or folder_ref}' trên Google Drive."
        return ActionResult.ok(
            f"Đã upload file '{uploaded['name']}'{target_message}",
            drive_file=uploaded,
            drive_folder=resolved_folder or {},
            active_drive_account=drive_service.get_active_account(),
        )
    except Exception as e:
        return ActionResult.err(
            _format_google_drive_error(
                e, fallback="Không thể upload file lên Google Drive."
            ),
            code=ErrorCode.UNKNOWN,
            dev_message=str(e),
        )


def _handle_drive_get_link(file_id: str, make_public: bool = False) -> ActionResult:
    try:
        drive_service = GoogleDriveService()
        detail = drive_service.get_share_link(file_id=file_id, make_public=make_public)
        link = detail.get("web_view_link") or detail.get("web_content_link") or ""
        if not link:
            return ActionResult.err(
                "Không lấy được link chia sẻ của file Google Drive.",
                code=ErrorCode.UNKNOWN,
            )
        message = f"Link file Google Drive '{detail.get('name') or file_id}': {link}"
        if make_public:
            message += "\nFile đã được cấp quyền xem công khai."
        return ActionResult.ok(
            message,
            drive_file=detail,
            link=link,
            active_drive_account=drive_service.get_active_account(),
        )
    except Exception as e:
        return ActionResult.err(
            _format_google_drive_error(
                e, fallback="Không thể lấy link file Google Drive."
            ),
            code=ErrorCode.UNKNOWN,
            dev_message=str(e),
        )


def _handle_drive_trash(file_id: str) -> ActionResult:
    try:
        drive_service = GoogleDriveService()
        item = drive_service.trash_item(file_id)
        return ActionResult.ok(
            f"Đã chuyển '{item.get('name') or file_id}' vào thùng rác Google Drive.",
            drive_file=item,
            active_drive_account=drive_service.get_active_account(),
        )
    except Exception as e:
        return ActionResult.err(
            _format_google_drive_error(
                e, fallback="Không thể xóa file Google Drive."
            ),
            code=ErrorCode.UNKNOWN,
            dev_message=str(e),
        )


def _resolve_drive_download_path(destination: str, filename: str) -> Path:
    cleaned_destination = (destination or "").strip()
    default_dir = resolve_destination_path("downloads")
    if not cleaned_destination:
        if not default_dir:
            raise ValueError("Không resolve được thư mục Downloads an toàn.")
        return Path(default_dir) / filename

    resolved_dir = resolve_destination_path(cleaned_destination)
    if resolved_dir:
        return Path(resolved_dir) / filename

    raw_path = Path(cleaned_destination).expanduser()
    if raw_path.is_absolute():
        candidate = raw_path if raw_path.suffix else raw_path / filename
    else:
        candidate = (Path(default_dir) / raw_path) if default_dir else raw_path
        if not candidate.suffix:
            candidate = candidate / filename

    parent = candidate.parent.resolve()
    if not parent.exists():
        raise ValueError(f"Thư mục đích không tồn tại: {parent}")
    if not is_safe_path(str(parent)):
        raise ValueError("Thư mục lưu file nằm ngoài thư mục an toàn.")
    return candidate


def _handle_drive_download(file_id: str, destination: str = "") -> ActionResult:
    try:
        drive_service = GoogleDriveService()
        detail = drive_service.get_share_link(file_id=file_id, make_public=False)
        target = _resolve_drive_download_path(
            destination, detail.get("name") or f"{file_id}.bin"
        )
        downloaded = drive_service.download_file(file_id=file_id, save_to=str(target))
        return ActionResult.ok(
            f"Đã tải file Google Drive '{downloaded['name']}' về {downloaded['saved_to']}",
            drive_file=downloaded,
            active_drive_account=drive_service.get_active_account(),
        )
    except Exception as e:
        return ActionResult.err(
            _format_google_drive_error(
                e, fallback="Không thể tải file từ Google Drive."
            ),
            code=ErrorCode.UNKNOWN,
            dev_message=str(e),
        )


def _format_google_drive_error(
    exc: Exception, fallback: str = "Không thể kết nối Google Drive."
) -> str:
    if isinstance(exc, (FileNotFoundError, ValueError, RuntimeError)):
        message = str(exc).strip()
        if message:
            return message
    if isinstance(exc, HttpError):
        details = str(getattr(exc, "error_details", "") or "")
        text = f"{exc}\n{details}".lower()
        if (
            "accessnotconfigured" in text
            or "google drive api has not been used in project" in text
        ):
            return (
                "Google Drive API chưa được bật cho project Google Cloud đang dùng. "
                "Hãy bật `Google Drive API` trong Google Cloud Console, đợi vài phút rồi thử lại."
            )
        if "insufficient authentication scopes" in text:
            return (
                "Tài khoản Google hiện chưa được cấp đủ quyền cho Google Drive. "
                "Hãy kết nối lại Google Drive để cấp lại quyền."
            )
        if exc.resp.status == 401:
            return "Phiên đăng nhập Google Drive đã hết hạn hoặc không hợp lệ. Hãy kết nối lại tài khoản."
        if exc.resp.status == 403:
            return "Google từ chối truy cập Google Drive cho project hoặc tài khoản hiện tại. Hãy kiểm tra API, scope và quyền truy cập."
    return fallback


def _format_reminder_time(raw_due_at: str) -> str:
    value = (raw_due_at or "").strip()
    if not value:
        return "(chưa có thời gian)"
    try:
        due_at = datetime.fromisoformat(value)
    except ValueError:
        return value

    weekday_map = {
        0: "Thứ 2",
        1: "Thứ 3",
        2: "Thứ 4",
        3: "Thứ 5",
        4: "Thứ 6",
        5: "Thứ 7",
        6: "Chủ nhật",
    }
    weekday = weekday_map.get(due_at.weekday(), "")
    time_fmt = "%H:%M:%S" if due_at.second else "%H:%M"
    return f"{due_at.strftime(time_fmt)} - {weekday}, {due_at.strftime('%d/%m/%Y')}"


def _format_reminder_line(index: int, item: dict) -> str:
    due_at = _format_reminder_time((item.get("due_at") or "").strip())
    status = (item.get("status") or "pending").strip().lower()
    display_status = "Đang chờ"
    if status == "completed":
        display_status = "Đã xong"
    elif status == "in_progress":
        display_status = "Đang làm"
    else:
        raw_due = (item.get("due_at") or "").strip()
        try:
            due_dt = datetime.fromisoformat(raw_due) if raw_due else None
        except ValueError:
            due_dt = None
        if due_dt is not None and due_dt < datetime.now(due_dt.tzinfo):
            display_status = "Quá hạn"
    title = (item.get("title") or item.get("message") or "(không có tiêu đề)").strip()
    return f"{index}. [{display_status}] {title} - {due_at}"


def _handle_create_reminder(
    title: str,
    message: str,
    due_at: str,
    timezone_name: str = "Asia/Saigon",
) -> ActionResult:
    try:
        service = ReminderService()
        reminder = service.create_reminder(
            title=title,
            message=message,
            due_at=due_at,
            timezone_name=timezone_name,
        )
        return ActionResult.ok(
            f"Đã tạo reminder '{reminder['title']}' vào {_format_reminder_time(reminder['due_at'])}",
            reminder=reminder,
        )
    except Exception as e:
        return ActionResult.err(
            "Không thể tạo reminder.",
            code=ErrorCode.UNKNOWN,
            dev_message=str(e),
        )


def _handle_list_reminders(status: str = "") -> ActionResult:
    try:
        service = ReminderService()
        reminders = service.list_reminders(status=status or None)
        if not reminders:
            return ActionResult.ok("Chưa có reminder nào.", reminders=[])
        lines = [
            _format_reminder_line(idx + 1, item) for idx, item in enumerate(reminders)
        ]
        return ActionResult.ok(
            "Danh sách reminder:\n" + "\n".join(lines),
            reminders=reminders,
        )
    except Exception as e:
        return ActionResult.err(
            "Không thể lấy danh sách reminder.",
            code=ErrorCode.UNKNOWN,
            dev_message=str(e),
        )


def _handle_import_task_list(
    task_text: str, timezone_name: str = "Asia/Saigon"
) -> ActionResult:
    try:
        service = ReminderService()
        payload = service.import_task_list(task_text, timezone_name=timezone_name)
        created = payload.get("created") or []
        skipped = payload.get("skipped") or []
        if not created:
            return ActionResult.err(
                "Không nhập được công việc nào.",
                code=ErrorCode.UNKNOWN,
                skipped=skipped,
            )

        lines = [f"Đã nhập {len(created)} công việc thành reminder."]
        if skipped:
            lines.append(f"Bỏ qua {len(skipped)} dòng không hợp lệ.")
        preview = []
        for idx, item in enumerate(created[:5], start=1):
            preview.append(_format_reminder_line(idx, item))
        if preview:
            lines.append("\n".join(preview))
        return ActionResult.ok(
            "\n".join(lines),
            reminders=created,
            skipped=skipped,
        )
    except Exception as e:
        return ActionResult.err(
            "Không thể nhập danh sách công việc.",
            code=ErrorCode.UNKNOWN,
            dev_message=str(e),
        )


def _handle_complete_reminder(reminder_id: str) -> ActionResult:
    try:
        service = ReminderService()
        reminder = service.complete_reminder(reminder_id)
        return ActionResult.ok(
            f"Đã hoàn thành reminder '{reminder.get('title') or reminder.get('message') or reminder_id}'.",
            reminder=reminder,
        )
    except Exception as e:
        return ActionResult.err(
            "Không thể hoàn thành reminder.",
            code=ErrorCode.UNKNOWN,
            dev_message=str(e),
        )


def _handle_update_reminder(
    reminder_id: str,
    title: str = "",
    message: str = "",
    due_at: str = "",
) -> ActionResult:
    try:
        service = ReminderService()
        reminder = service.update_reminder(
            reminder_id,
            title=title or None,
            message=message or None,
            due_at=due_at or None,
        )
        return ActionResult.ok(
            f"Đã cập nhật reminder '{reminder.get('title') or reminder_id}'"
            f" vào {_format_reminder_time(reminder.get('due_at') or '')}.",
            reminder=reminder,
        )
    except Exception as e:
        return ActionResult.err(
            "Không thể cập nhật reminder.",
            code=ErrorCode.UNKNOWN,
            dev_message=str(e),
        )


def _handle_snooze_reminder(reminder_id: str, minutes: int) -> ActionResult:
    try:
        service = ReminderService()
        reminder = service.snooze_reminder(reminder_id, minutes=minutes)
        return ActionResult.ok(
            f"Đã snooze reminder '{reminder.get('title') or reminder_id}' thêm {minutes} phút,"
            f" tới {_format_reminder_time(reminder.get('due_at') or '')}.",
            reminder=reminder,
        )
    except Exception as e:
        return ActionResult.err(
            "Không thể snooze reminder.",
            code=ErrorCode.UNKNOWN,
            dev_message=str(e),
        )


def _handle_delete_reminder(reminder_id: str) -> ActionResult:
    try:
        service = ReminderService()
        reminder = service.delete_reminder(reminder_id)
        return ActionResult.ok(
            f"Đã xóa reminder '{reminder.get('title') or reminder.get('message') or reminder_id}'.",
            reminder=reminder,
        )
    except Exception as e:
        return ActionResult.err(
            "Không thể xóa reminder.",
            code=ErrorCode.UNKNOWN,
            dev_message=str(e),
        )


def _handle_email_settings(mode: str, email: str = None):
    if mode == "accounts":
        return _handle_email_list_accounts()

    if mode == "set_account":
        if not email:
            return ActionResult.err("Báº¡n chÆ°a cung cáº¥p email Ä‘á»ƒ chá»n.")
        return _handle_email_set_account(email)

    if mode == "logout_account":
        return _handle_email_logout_account(email or "")

    emailService = GmailService()
    hiddenEmailService = HiddenEmailService()

    # hide email
    if mode == "hide":
        if not email:
            return ActionResult.err("Bạn chưa cung cấp email để ẩn.")
        ok = hiddenEmailService.add(email)
        msg = "Đã ẩn email." if ok else "Email đã được ẩn từ trước."
        return ActionResult.ok(msg, data={"email": email})

    # unhide email
    if mode == "unhide":
        if not email:
            return ActionResult.err("Bạn chưa cung cấp email để bỏ ẩn.")
        ok = hiddenEmailService.remove(email)
        msg = "Đã bỏ ẩn email." if ok else "Email này không nằm trong danh sách ẩn."
        return ActionResult.ok(msg, data={"email": email})

    if mode == "logout":
        ok = emailService.logout()

        if ok:
            return ActionResult.ok(
                "Đã đăng xuất Gmail. Lần sau sử dụng sẽ yêu cầu đăng nhập lại."
            )
        else:
            return ActionResult.ok("Bạn chưa đăng nhập Gmail.")

    # show hidden list
    lst = hiddenEmailService.list_hidden()
    if not lst:
        return ActionResult.ok("Không có email nào đang bị ẩn.")
    return ActionResult.ok("Danh sách email đang bị ẩn:", json={"hidden": lst})


# def _handle_menu_route(self, key: str = "") -> ActionResult:
#         normalized_key = (key or "").strip()

#         if not normalized_key:
#             # Cho phép user gõ số ngay ở turn sau
#             self.state.last_choices = list(MENU.keys())
#             self.state.last_action = "menu"
#             self.state.last_action_meta = {}

#             return ActionResult.ok(
#                 build_main_menu_message(),
#                 menu=list(MENU.keys()),
#             )

#         if normalized_key not in MENU:
#             # vẫn giữ last_choices để user nhập lại số
#             self.state.last_choices = list(MENU.keys())
#             self.state.last_action = "menu"
#             self.state.last_action_meta = {}

#             return ActionResult.need_clarify(
#                 message="Mục menu không hợp lệ.",
#                 question="Bạn hãy nhập lại số menu, ví dụ: 1",
#                 slots={"expect": "menu_number"},
#             )

#         # Khi user đã vào 1 mục cụ thể, có thể tiếp tục cho phép bấm số khác
#         self.state.last_choices = list(MENU.keys())
#         self.state.last_action = "menu"
#         self.state.last_action_meta = {}

#         return ActionResult.ok(
#             build_menu_item_message(normalized_key),
#             menu_key=normalized_key,
#         )


def build_menu_response(key: str = "") -> ActionResult:
    normalized_key = (key or "").strip()

    if not normalized_key:
        return ActionResult.ok(
            build_main_menu_message(),
            menu=list(MENU.keys()),
        )

    if normalized_key not in MENU:
        return ActionResult.need_clarify(
            message="Mục menu không hợp lệ.",
            question="Bạn hãy nhập lại số menu, ví dụ: 1",
            slots={"expect": "menu_number"},
        )

    return ActionResult.ok(
        build_menu_item_message(normalized_key),
        menu_key=normalized_key,
    )
