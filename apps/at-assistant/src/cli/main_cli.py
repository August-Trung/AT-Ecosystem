from __future__ import annotations

from src.core.env_loader import load_project_env

load_project_env()

import queue
import threading
import time
from datetime import datetime, timezone, timedelta

from src.core.engine import Engine
from src.core.result import ActionResult, ActionStatus
from src.core.alias.normalize import normalize_text
from src.core.voice_package_manager import VoicePackageManager
from src.core.voice_runtime import VoiceEventType, VoiceOrchestrator
from src.core.pin_service import PinService
from src.plugins.chat_session_service import ChatSessionService


class CLIApp:
    """CLI version of the assistant with text-first flow and optional one-shot voice input."""

    def __init__(self):
        self.engine = Engine()
        self.result_queue: queue.Queue[ActionResult] = queue.Queue()
        self.text_queue: queue.Queue[str] = queue.Queue()
        self.voice_packages = VoicePackageManager()
        self.voice_runtime = VoiceOrchestrator(self.voice_packages)
        self.chat_sessions = ChatSessionService()
        self.current_session_id = ""
        self.transcript: list[dict] = []
        # State machine cho luồng /pin (multi-step)
        # None = không ở trong luồng PIN
        # dict: {"mode": "set"|"change"|"clear", "step": str, "data": dict}
        self._pin_flow: dict | None = None

        threading.Thread(target=self._input_thread, daemon=True).start()

        print("Chatbot AI Desktop CLI — gõ 'q' để thoát")
        print("Gõ '/voice' để ghi một lượt lệnh bằng mic khi gói nhận lệnh giọng nói offline đã sẵn sàng.\n")
        print("Lệnh thêm: /new, /history, /open <id|stt>, /pin\n")
        self._start_new_session(show_notice=False)

    def _input_thread(self):
        while True:
            try:
                msg = input().strip()
                self.text_queue.put(msg)
            except Exception:
                pass

    def poll(self):
        self._poll_voice()
        self._poll_input()
        self._poll_engine()

    def _poll_voice(self):
        try:
            while True:
                event = self.voice_runtime.event_queue.get_nowait()
                if event.type == VoiceEventType.STARTED:
                    print("Mic đã bật cho một lượt nói.")
                    continue
                if event.type == VoiceEventType.LISTENING:
                    print("Đang nghe câu lệnh...")
                    continue
                if event.type == VoiceEventType.SPEECH_DETECTED:
                    print("Đã ghi nhận giọng nói, đang chuyển thành chữ...")
                    continue
                if event.type == VoiceEventType.TRANSCRIBING:
                    print("Đang nhận diện bằng Zipformer...")
                    continue
                if event.type == VoiceEventType.TRANSCRIPT:
                    transcript = normalize_text(event.transcript)
                    if transcript:
                        print(f"Transcript: {transcript}")
                        self._send(transcript)
                    continue
                if event.type == VoiceEventType.COMPLETED:
                    continue
                if event.type == VoiceEventType.CANCELLED and event.message:
                    print(event.message)
                    continue
                if event.type == VoiceEventType.UNAVAILABLE:
                    print(event.message or "Gói nhận lệnh giọng nói offline chưa sẵn sàng.")
                    continue
                if event.type == VoiceEventType.ERROR:
                    print(f"Lỗi voice: {event.message}")
        except queue.Empty:
            pass

    def _poll_input(self):
        if self.text_queue.empty():
            return

        msg = self.text_queue.get()
        lowered = msg.lower().strip()
        if lowered in {"q", "quit", "exit"}:
            print("Đang thoát...")
            raise SystemExit(0)

        # ── Luồng PIN đang mở: chuyển input vào state machine ────
        if self._pin_flow is not None:
            self._continue_pin_flow(msg.strip())
            return

        if lowered == "/pin":
            self._start_pin_flow()
            return

        if lowered in {"/voice", "voice", "mic"}:
            started = self.voice_runtime.start_listen_once()
            if not started and not self.voice_runtime.is_busy():
                print("Không thể bật mic lúc này.")
            return

        if lowered in {"/new", "/newchat"}:
            self._start_new_session()
            return

        if lowered in {"/history", "/sessions"}:
            self._print_session_history()
            return

        if lowered.startswith("/open "):
            self._open_session(msg.split(" ", 1)[1].strip())
            return

        self._send(msg)

    def _run_engine(self, text: str):
        try:
            result = self.engine.handle_turn(text)
        except Exception as e:
            result = ActionResult.err(f"Lỗi nội bộ: {e}")
        self.result_queue.put(result)

    def _poll_engine(self):
        try:
            while True:
                res = self.result_queue.get_nowait()
                self._handle_result(res)
        except queue.Empty:
            pass

    def _send(self, text: str):
        text = normalize_text(text)
        if not text:
            return

        self._ensure_active_session()
        self._append_transcript(role="user", text=text)
        self._persist_session()
        print(f"\nBạn: {text}")
        print("Bot đang xử lý...\n")
        threading.Thread(target=self._run_engine, args=(text,), daemon=True).start()

    def _handle_result(self, res: ActionResult):
        print("")

        if res.status == ActionStatus.SUCCESS:
            self._append_transcript(role="assistant", text=res.message, style="success")
            print(f"Bot: {res.message}")
            self._print_emails(res)
            self._persist_session()
            return

        if res.status == ActionStatus.ERROR:
            self._append_transcript(role="assistant", text=res.message, style="error")
            print(f"Lỗi: {res.message}")
            self._persist_session()
            return

        if res.status == ActionStatus.NEED_CONFIRM:
            self._append_transcript(role="assistant", text=res.message)
            self._append_transcript(role="assistant", text="Bạn đồng ý thực hiện không?")
            print(f"Bot: {res.message}")
            print("→ Nhập 'yes' hoặc 'no'")
            self._persist_session()
            return

        if res.status == ActionStatus.NEED_CHOICE:
            self._append_transcript(role="assistant", text=res.message)
            print(f"Bot: {res.message}\n")
            choices = res.data.get("choices", [])
            for i, c in enumerate(choices, 1):
                print(f"{i}. {c}")
            print("→ Nhập số tương ứng hoặc 'hủy' để bỏ qua")
            self._persist_session()
            return

        if res.status == ActionStatus.NEED_CLARIFY:
            self._append_transcript(role="assistant", text=res.message)
            print(f"Bot: {res.message}")
            q = res.data.get("question")
            if q and q != res.message:
                self._append_transcript(role="assistant", text=q)
                print("→", q)
            self._persist_session()
            return

        self._append_transcript(role="assistant", text=res.message)
        print(f"Bot: {res.message}")
        self._persist_session()

    def _print_emails(self, res: ActionResult):
        if not isinstance(res.data, dict):
            return
        json_data = res.data.get("json")
        if not json_data:
            return

        mails = json_data.get("data", [])
        if mails:
            for m in mails:
                self._append_transcript(
                    role="assistant",
                    kind="email_card",
                    text=f"{m.get('subject')} — từ {m.get('from')}",
                    payload=m,
                )
            print("===== EMAIL =====")
            for m in mails:
                print(f"- {m.get('subject')} — từ {m.get('from')}")
            print("=================\n")

        detail = json_data.get("detail")
        if detail:
            self._append_transcript(
                role="assistant",
                kind="email_detail",
                text=f"Email chi tiết: {detail.get('subject') or '(không tiêu đề)'}",
                payload=detail,
            )
            print("===== EMAIL DETAIL =====")
            print("Từ:", detail.get("from") or "N/A")
            print("Đến:", detail.get("to") or "N/A")
            print("Tiêu đề:", detail.get("subject") or "(không tiêu đề)")
            print("Nội dung:")
            print(detail.get("body") or detail.get("snippet") or "(trống)")
            print("========================\n")

        for hidden in json_data.get("hidden", []):
            self._append_transcript(role="assistant", text=f"• {hidden}")
            print("•", hidden)

    # ================================================================
    #  /pin — Quản lý PIN xác thực (state machine)
    # ================================================================

    def _start_pin_flow(self) -> None:
        """Khởi động luồng /pin: hiện trạng thái và menu lựa chọn."""
        svc = PinService()
        print()
        if svc.is_pin_set():
            print("🔒 PIN đang bật.")
            print("  1. Đổi PIN")
            print("  2. Xóa PIN")
            print("  3. Hủy")
            print("→ Nhập 1 / 2 / 3:")
            self._pin_flow = {"mode": "menu_with_pin", "step": "choose", "data": {}}
        else:
            print("🔓 PIN chưa đặt.")
            print("  1. Đặt PIN mới")
            print("  2. Hủy")
            print("→ Nhập 1 / 2:")
            self._pin_flow = {"mode": "menu_no_pin", "step": "choose", "data": {}}

    def _continue_pin_flow(self, value: str) -> None:
        """Xử lý từng bước trong luồng /pin."""
        if self._pin_flow is None:
            return

        mode = self._pin_flow["mode"]
        step = self._pin_flow["step"]
        data = self._pin_flow["data"]

        # ── Bước chọn menu ──────────────────────────────────────
        if step == "choose":
            if mode == "menu_no_pin":
                if value == "1":
                    print("Nhập PIN mới (4–6 chữ số):")
                    self._pin_flow = {"mode": "set", "step": "new_pin", "data": {}}
                else:
                    print("Đã hủy.")
                    self._pin_flow = None
                return

            if mode == "menu_with_pin":
                if value == "1":
                    print("Nhập PIN hiện tại:")
                    self._pin_flow = {"mode": "change", "step": "old_pin", "data": {}}
                elif value == "2":
                    print("Nhập PIN hiện tại để xác nhận xóa:")
                    self._pin_flow = {"mode": "clear", "step": "old_pin", "data": {}}
                else:
                    print("Đã hủy.")
                    self._pin_flow = None
                return

        # ── Đặt PIN mới ─────────────────────────────────────────
        if mode == "set":
            if step == "new_pin":
                data["new_pin"] = value
                print("Xác nhận PIN:")
                self._pin_flow["step"] = "confirm"
                return
            if step == "confirm":
                if value != data["new_pin"]:
                    print("PIN xác nhận không khớp. Hủy.")
                    self._pin_flow = None
                    return
                try:
                    PinService().set_pin(data["new_pin"])
                    print("✓ Đã đặt PIN thành công.")
                except ValueError as exc:
                    print(f"Lỗi: {exc}")
                self._pin_flow = None
                return

        # ── Đổi PIN ─────────────────────────────────────────────
        if mode == "change":
            if step == "old_pin":
                if not PinService().verify_pin(value):
                    print("PIN cũ không đúng. Hủy.")
                    self._pin_flow = None
                    return
                data["old_pin"] = value
                print("Nhập PIN mới (4–6 chữ số):")
                self._pin_flow["step"] = "new_pin"
                return
            if step == "new_pin":
                data["new_pin"] = value
                print("Xác nhận PIN mới:")
                self._pin_flow["step"] = "confirm"
                return
            if step == "confirm":
                if value != data["new_pin"]:
                    print("PIN xác nhận không khớp. Hủy.")
                    self._pin_flow = None
                    return
                try:
                    PinService().change_pin(data["old_pin"], data["new_pin"])
                    print("✓ Đã đổi PIN thành công.")
                except ValueError as exc:
                    print(f"Lỗi: {exc}")
                self._pin_flow = None
                return

        # ── Xóa PIN ─────────────────────────────────────────────
        if mode == "clear":
            if step == "old_pin":
                if not PinService().verify_pin(value):
                    print("PIN không đúng. Hủy.")
                    self._pin_flow = None
                    return
                PinService().clear_pin()
                print("✓ Đã xóa PIN. App sẽ không yêu cầu xác thực khi khởi động nữa.")
                self._pin_flow = None
                return

    def _start_new_session(self, show_notice: bool = True) -> None:
        if self.current_session_id and not self.chat_sessions.has_user_messages(self.transcript):
            try:
                self.chat_sessions.delete_session(self.current_session_id)
            except Exception:
                pass
        self.current_session_id = ""
        self.transcript = []
        self.engine.state.clear_conversation_context()
        welcome = (
            "Xin chào! Mình là AT Assistant.\n"
            "Gõ lệnh tiếng Việt hoặc tiếng Anh để bắt đầu."
        )
        self._append_transcript(role="assistant", text=welcome)
        if show_notice:
            print("Bắt đầu chat mới.")
            print(f"Bot: {welcome}")

    def _print_session_history(self) -> None:
        sessions = self.chat_sessions.list_sessions(limit=20)
        if not sessions:
            print("Chưa có lịch sử chat.")
            return
        print("===== CHAT HISTORY =====")
        for index, item in enumerate(sessions, 1):
            print(f"{index}. {item['session_id']} | {item['title']} | {item['message_count']} tin")
        print("========================")

    def _open_session(self, value: str) -> None:
        sessions = self.chat_sessions.list_sessions(limit=50)
        target_session_id = value
        if value.isdigit():
            index = int(value) - 1
            if index < 0 or index >= len(sessions):
                print("STT lịch sử chat không hợp lệ.")
                return
            target_session_id = str(sessions[index].get("session_id") or "")
        try:
            payload = self.chat_sessions.load_session(target_session_id)
        except Exception as exc:
            print(f"Không thể mở lịch sử chat: {exc}")
            return
        self.current_session_id = target_session_id
        self.transcript = [dict(item) for item in payload.get("messages") or []]
        self._restore_engine_history()
        print(f"===== CHAT {payload.get('title') or target_session_id} =====")
        for item in self.transcript:
            self._print_transcript_item(item)
        print("================================")

    def _restore_engine_history(self) -> None:
        self.engine.state.clear_conversation_context()
        for item in self.transcript:
            if str(item.get("kind") or "text") != "text":
                continue
            role = str(item.get("role") or "")
            text = str(item.get("text") or "")
            if role == "user":
                self.engine.state.push_history("user", text)
            elif role == "assistant":
                self.engine.state.push_history("assistant", text)

    def _print_transcript_item(self, item: dict) -> None:
        role = str(item.get("role") or "")
        kind = str(item.get("kind") or "text")
        text = str(item.get("text") or "")
        if role == "user":
            print(f"Bạn: {text}")
            return
        if role == "system":
            print(f"[System] {text}")
            return
        prefix = "Bot"
        if kind == "email_card":
            prefix = "Email"
        elif kind == "email_detail":
            prefix = "Email Detail"
        print(f"{prefix}: {text}")

    def _append_transcript(
        self,
        *,
        role: str,
        text: str,
        style: str = "normal",
        kind: str = "text",
        payload: dict | None = None,
    ) -> None:
        self.transcript.append(
            {
                "role": role,
                "kind": kind,
                "text": text,
                "style": style,
                "payload": payload or {},
                "created_at": datetime.now(timezone(timedelta(hours=7))).isoformat(),
            }
        )

    def _ensure_active_session(self) -> None:
        if self.current_session_id:
            return
        session = self.chat_sessions.create_session()
        self.current_session_id = str(session.get("session_id") or "")

    def _persist_session(self) -> None:
        if not self.chat_sessions.has_user_messages(self.transcript):
            if self.current_session_id:
                try:
                    self.chat_sessions.delete_session(self.current_session_id)
                except Exception:
                    pass
                self.current_session_id = ""
            return
        self._ensure_active_session()
        title = self.chat_sessions.build_title_from_messages(self.transcript)
        self.chat_sessions.save_session(
            self.current_session_id,
            title=title,
            messages=self.transcript,
        )


if __name__ == "__main__":
    app = CLIApp()
    while True:
        app.poll()
        time.sleep(0.05)
