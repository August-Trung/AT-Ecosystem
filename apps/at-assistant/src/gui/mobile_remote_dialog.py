from __future__ import annotations

import threading
import webbrowser

import customtkinter as ctk

from src.gui.theme import FONT_FAMILY, FONT_SIZE_NORMAL, FONT_SIZE_SMALL, FONT_SIZE_TITLE
from src.integrations.mobile_remote import DEFAULT_REMOTE_PORT, MobileRemoteBridge, MobileRemoteSettingsStore


class MobileRemoteDialog(ctk.CTkToplevel):
    def __init__(
        self,
        master,
        *,
        palette: dict[str, str],
        bridge: MobileRemoteBridge,
        on_message=None,
        on_changed=None,
    ) -> None:
        super().__init__(master)
        self._palette = palette
        self._bridge = bridge
        self._on_message = on_message
        self._on_changed = on_changed
        self._store = MobileRemoteSettingsStore()
        self._qr_image = None

        settings = self._store.load()
        self.title("Kết nối điện thoại")
        self.geometry("760x720")
        self.minsize(680, 620)
        self.configure(fg_color=palette["BG_PRIMARY"])
        self.transient(master)
        self.grab_set()

        self.enabled_var = ctk.BooleanVar(value=bool(settings.get("enabled", False)))
        self.port_var = ctk.StringVar(value=str(settings.get("port") or DEFAULT_REMOTE_PORT))
        self.status_var = ctk.StringVar(value="")
        self.code_var = ctk.StringVar(value="")
        self.url_var = ctk.StringVar(value="")

        shell = ctk.CTkFrame(self, fg_color=palette["BG_SECONDARY"], corner_radius=14)
        shell.pack(fill="both", expand=True, padx=18, pady=18)
        shell.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(
            shell,
            text="Kết nối điện thoại",
            font=(FONT_FAMILY, FONT_SIZE_TITLE + 1, "bold"),
            text_color=palette["FG_PRIMARY"],
            anchor="w",
        ).grid(row=0, column=0, sticky="ew", padx=16, pady=(16, 6))

        ctk.CTkLabel(
            shell,
            text=(
                "Bật chế độ này để AT Remote trên điện thoại gửi yêu cầu về ATAssistant. "
                "Điện thoại và máy tính cần cùng WiFi cho bản đầu tiên."
            ),
            font=(FONT_FAMILY, FONT_SIZE_NORMAL),
            text_color=palette["FG_SECONDARY"],
            anchor="w",
            justify="left",
            wraplength=690,
        ).grid(row=1, column=0, sticky="ew", padx=16, pady=(0, 12))

        top = ctk.CTkFrame(shell, fg_color="transparent")
        top.grid(row=2, column=0, sticky="ew", padx=16, pady=(0, 10))
        top.grid_columnconfigure(1, weight=1)

        self.toggle = ctk.CTkSwitch(
            top,
            text="Bật kết nối điện thoại",
            variable=self.enabled_var,
            command=self._apply_enabled_state,
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            text_color=palette["FG_PRIMARY"],
            progress_color=palette["ACCENT"],
        )
        self.toggle.grid(row=0, column=0, sticky="w", padx=(0, 16), pady=4)

        ctk.CTkLabel(
            top,
            text="Cổng",
            font=(FONT_FAMILY, FONT_SIZE_SMALL, "bold"),
            text_color=palette["FG_SECONDARY"],
        ).grid(row=0, column=1, sticky="e", padx=(0, 8))
        ctk.CTkEntry(top, textvariable=self.port_var, width=90, font=(FONT_FAMILY, FONT_SIZE_NORMAL)).grid(row=0, column=2, sticky="e")

        ctk.CTkLabel(
            shell,
            textvariable=self.status_var,
            font=(FONT_FAMILY, FONT_SIZE_SMALL),
            text_color=palette["FG_SECONDARY"],
            anchor="w",
            justify="left",
            wraplength=690,
        ).grid(row=3, column=0, sticky="ew", padx=16, pady=(0, 10))

        pair_box = ctk.CTkFrame(shell, fg_color=palette["BG_PRIMARY"], corner_radius=12)
        pair_box.grid(row=4, column=0, sticky="ew", padx=16, pady=(0, 12))
        pair_box.grid_columnconfigure(0, weight=1)
        pair_box.grid_columnconfigure(1, weight=0)

        ctk.CTkLabel(
            pair_box,
            text="Mã kết nối",
            font=(FONT_FAMILY, FONT_SIZE_SMALL, "bold"),
            text_color=palette["FG_SECONDARY"],
            anchor="w",
        ).grid(row=0, column=0, sticky="ew", padx=14, pady=(12, 0))
        ctk.CTkLabel(
            pair_box,
            textvariable=self.code_var,
            font=(FONT_FAMILY, 32, "bold"),
            text_color=palette["FG_PRIMARY"],
            anchor="w",
        ).grid(row=1, column=0, sticky="ew", padx=14, pady=(0, 4))
        ctk.CTkLabel(
            pair_box,
            textvariable=self.url_var,
            font=(FONT_FAMILY, FONT_SIZE_SMALL),
            text_color=palette["FG_SECONDARY"],
            anchor="w",
            wraplength=470,
        ).grid(row=2, column=0, sticky="ew", padx=14, pady=(0, 12))

        self.qr_label = ctk.CTkLabel(pair_box, text="")
        self.qr_label.grid(row=0, column=1, rowspan=3, sticky="e", padx=14, pady=12)

        actions = ctk.CTkFrame(shell, fg_color="transparent")
        actions.grid(row=5, column=0, sticky="ew", padx=16, pady=(0, 12))
        actions.grid_columnconfigure((0, 1, 2), weight=1)
        ctk.CTkButton(
            actions,
            text="Đổi mã",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            fg_color=palette["ACCENT_CHOICE"],
            hover_color=palette["ACCENT_CHOICE_HOVER"],
            text_color=palette["FG_PRIMARY"],
            corner_radius=10,
            command=self._rotate_code,
        ).grid(row=0, column=0, sticky="ew", padx=(0, 4))
        ctk.CTkButton(
            actions,
            text="Mở AT Remote",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            fg_color=palette["ACCENT"],
            hover_color=palette["ACCENT_HOVER"],
            text_color="#ffffff",
            corner_radius=10,
            command=self._open_remote_url,
        ).grid(row=0, column=1, sticky="ew", padx=4)
        ctk.CTkButton(
            actions,
            text="Đóng",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            fg_color=palette["ACCENT_CHOICE"],
            hover_color=palette["ACCENT_CHOICE_HOVER"],
            text_color=palette["FG_PRIMARY"],
            corner_radius=10,
            command=self.destroy,
        ).grid(row=0, column=2, sticky="ew", padx=(4, 0))

        lists = ctk.CTkFrame(shell, fg_color="transparent")
        lists.grid(row=6, column=0, sticky="nsew", padx=16, pady=(0, 16))
        lists.grid_columnconfigure((0, 1), weight=1)
        shell.grid_rowconfigure(6, weight=1)

        self.pending_frame = ctk.CTkScrollableFrame(lists, fg_color=palette["BG_PRIMARY"], corner_radius=12, height=210)
        self.pending_frame.grid(row=0, column=0, sticky="nsew", padx=(0, 6))
        self.devices_frame = ctk.CTkScrollableFrame(lists, fg_color=palette["BG_PRIMARY"], corner_radius=12, height=210)
        self.devices_frame.grid(row=0, column=1, sticky="nsew", padx=(6, 0))

        self._refresh()
        self.after(1000, self._poll)

    def _apply_enabled_state(self) -> None:
        enabled = bool(self.enabled_var.get())
        try:
            port = int((self.port_var.get() or str(DEFAULT_REMOTE_PORT)).strip())
        except ValueError:
            port = DEFAULT_REMOTE_PORT
            self.port_var.set(str(port))
        if enabled:
            def worker() -> None:
                try:
                    self._bridge.start(port=port)
                    self.after(0, lambda: self._notify("Đã bật kết nối điện thoại.", "success"))
                except Exception as exc:
                    self.after(0, lambda: self._handle_start_error(exc))
                finally:
                    self.after(0, self._refresh)

            threading.Thread(target=worker, daemon=True).start()
        else:
            self._bridge.stop()
            self._notify("Đã tắt kết nối điện thoại.", "normal")
            self._refresh()
        if self._on_changed:
            self._on_changed()

    def _handle_start_error(self, exc: Exception) -> None:
        self.enabled_var.set(False)
        self._notify(f"Không bật được kết nối điện thoại: {exc}", "error")

    def _rotate_code(self) -> None:
        self._bridge.rotate_pair_code()
        self._refresh()

    def _open_remote_url(self) -> None:
        urls = self._bridge.snapshot().get("pairingUrls") or self._bridge.snapshot().get("urls") or []
        if urls:
            webbrowser.open(str(urls[0]))

    def _approve(self, request_id: str) -> None:
        result = self._bridge.approve_pair_request(request_id)
        if result.get("ok"):
            self._notify("Đã cho phép điện thoại kết nối.", "success")
        else:
            self._notify(str(result.get("message") or "Không duyệt được thiết bị."), "error")
        self._refresh()

    def _reject(self, request_id: str) -> None:
        self._bridge.reject_pair_request(request_id)
        self._notify("Đã từ chối thiết bị.", "normal")
        self._refresh()

    def _revoke(self, device_id: str) -> None:
        if self._bridge.revoke_device(device_id):
            self._notify("Đã xóa thiết bị khỏi danh sách kết nối.", "normal")
        self._refresh()

    def _refresh(self) -> None:
        snapshot = self._bridge.snapshot()
        running = bool(snapshot.get("running"))
        self.enabled_var.set(running)
        self.code_var.set(str(snapshot.get("pairCode") or "------") if running else "------")
        urls = list(snapshot.get("pairingUrls") or snapshot.get("urls") or [])
        self.url_var.set(str(urls[0]) if urls else "Chưa có địa chỉ. Hãy bật kết nối điện thoại.")
        if running:
            ready = "AT Remote đã sẵn sàng." if snapshot.get("staticAppReady") else "AT Remote cần được build trước khi mở trực tiếp từ cổng này."
            self.status_var.set(f"{ready} Điện thoại và máy tính cần cùng WiFi.")
        else:
            self.status_var.set("Đang tắt. Bật kết nối điện thoại để ghép đôi thiết bị.")
        self._render_qr(str(urls[0] if urls else ""))
        self._render_pending(list(snapshot.get("pending") or []))
        self._render_devices(list(snapshot.get("devices") or []))

    def _render_qr(self, url: str) -> None:
        if not url:
            self.qr_label.configure(text="", image=None)
            return
        try:
            import qrcode
            from PIL import Image
        except Exception:
            self.qr_label.configure(text="Quét mã\nsau khi cài qrcode", image=None)
            return
        try:
            image = qrcode.make(url).resize((132, 132))
            self._qr_image = ctk.CTkImage(light_image=image, dark_image=image, size=(132, 132))
            self.qr_label.configure(text="", image=self._qr_image)
        except Exception:
            self.qr_label.configure(text="", image=None)

    def _render_pending(self, items: list[dict]) -> None:
        for child in self.pending_frame.winfo_children():
            child.destroy()
        ctk.CTkLabel(
            self.pending_frame,
            text="Thiết bị đang chờ",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            text_color=self._palette["FG_PRIMARY"],
            anchor="w",
        ).pack(fill="x", padx=10, pady=(10, 6))
        if not items:
            ctk.CTkLabel(
                self.pending_frame,
                text="Chưa có thiết bị nào đang chờ xác nhận.",
                font=(FONT_FAMILY, FONT_SIZE_SMALL),
                text_color=self._palette["FG_SECONDARY"],
                anchor="w",
                justify="left",
                wraplength=300,
            ).pack(fill="x", padx=10, pady=(0, 10))
            return
        for item in items:
            row = ctk.CTkFrame(self.pending_frame, fg_color="transparent")
            row.pack(fill="x", padx=10, pady=6)
            ctk.CTkLabel(
                row,
                text=f"{item.get('deviceName') or 'Điện thoại'}\n{item.get('clientHost') or 'LAN'}",
                font=(FONT_FAMILY, FONT_SIZE_SMALL),
                text_color=self._palette["FG_PRIMARY"],
                anchor="w",
                justify="left",
            ).pack(fill="x", pady=(0, 6))
            buttons = ctk.CTkFrame(row, fg_color="transparent")
            buttons.pack(fill="x")
            request_id = str(item.get("id") or "")
            ctk.CTkButton(buttons, text="Cho phép", height=30, command=lambda rid=request_id: self._approve(rid)).pack(side="left", expand=True, fill="x", padx=(0, 4))
            ctk.CTkButton(buttons, text="Từ chối", height=30, fg_color=self._palette["ACCENT_CANCEL"], hover_color=self._palette["ACCENT_CANCEL_HOVER"], text_color="#1a1a2e", command=lambda rid=request_id: self._reject(rid)).pack(side="left", expand=True, fill="x", padx=(4, 0))

    def _render_devices(self, items: list[dict]) -> None:
        for child in self.devices_frame.winfo_children():
            child.destroy()
        ctk.CTkLabel(
            self.devices_frame,
            text="Thiết bị đã kết nối",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            text_color=self._palette["FG_PRIMARY"],
            anchor="w",
        ).pack(fill="x", padx=10, pady=(10, 6))
        if not items:
            ctk.CTkLabel(
                self.devices_frame,
                text="Chưa có thiết bị nào.",
                font=(FONT_FAMILY, FONT_SIZE_SMALL),
                text_color=self._palette["FG_SECONDARY"],
                anchor="w",
            ).pack(fill="x", padx=10, pady=(0, 10))
            return
        for item in items:
            row = ctk.CTkFrame(self.devices_frame, fg_color="transparent")
            row.pack(fill="x", padx=10, pady=6)
            ctk.CTkLabel(
                row,
                text=f"{item.get('name') or 'Điện thoại'}\nLần cuối: {item.get('lastSeen') or 'chưa có'}",
                font=(FONT_FAMILY, FONT_SIZE_SMALL),
                text_color=self._palette["FG_PRIMARY"],
                anchor="w",
                justify="left",
                wraplength=300,
            ).pack(fill="x", pady=(0, 6))
            device_id = str(item.get("id") or "")
            ctk.CTkButton(
                row,
                text="Xóa thiết bị",
                height=30,
                fg_color=self._palette["ACCENT_CANCEL"],
                hover_color=self._palette["ACCENT_CANCEL_HOVER"],
                text_color="#1a1a2e",
                command=lambda did=device_id: self._revoke(did),
            ).pack(fill="x")

    def _poll(self) -> None:
        if not self.winfo_exists():
            return
        self._refresh()
        self.after(1000, self._poll)

    def _notify(self, message: str, style: str = "normal") -> None:
        if self._on_message:
            self._on_message(message, style)
