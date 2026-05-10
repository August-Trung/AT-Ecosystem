from __future__ import annotations

import json
import os
import threading
import webbrowser

import customtkinter as ctk

try:
    from PIL import Image
except Exception:  # pragma: no cover
    Image = None

from src.core.app_paths import ensure_app_data_dir, resource_path
from src.gui.theme import FONT_FAMILY, FONT_SIZE_NORMAL, FONT_SIZE_SMALL, FONT_SIZE_TITLE
from src.integrations.mobile_remote import (
    DEFAULT_REMOTE_PORT,
    PERMISSION_GROUPS,
    MobileRemoteBridge,
    MobileRemoteSettingsStore,
)


REMOTE_PALETTE = {
    "BG_PRIMARY": "#f7f8ff",
    "BG_SECONDARY": "#ffffff",
    "BG_INPUT": "#fbfcff",
    "CARD_SOFT": "#fff2ed",
    "CARD_BLUE": "#f0edff",
    "FG_PRIMARY": "#151321",
    "FG_SECONDARY": "#667085",
    "FG_SUCCESS": "#0f8b5f",
    "FG_ERROR": "#e11d48",
    "ACCENT": "#ff5a3d",
    "ACCENT_HOVER": "#d9432a",
    "ACCENT_BLUE": "#7c3aed",
    "ACCENT_BLUE_HOVER": "#6025d1",
    "ACCENT_CANCEL": "#fff0f4",
    "ACCENT_CANCEL_HOVER": "#ffd9e3",
    "ACCENT_CHOICE": "#edf1f8",
    "ACCENT_CHOICE_HOVER": "#dfe6f1",
    "BORDER_COLOR": "#dde3f0",
}


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
        self._palette = {**palette, **REMOTE_PALETTE}
        self._bridge = bridge
        self._on_message = on_message
        self._on_changed = on_changed
        self._store = MobileRemoteSettingsStore()
        self._qr_image = None
        self._last_qr_url = ""
        self._last_pending_signature = ""
        self._last_devices_signature = ""
        self._permission_vars: list[ctk.BooleanVar] = []
        self._logo_image = self._load_logo_image()

        settings = self._store.load()
        ui = self._palette
        self.title("Kết nối điện thoại")
        self.geometry("860x680")
        self.minsize(760, 590)
        self.configure(fg_color=ui["BG_PRIMARY"])
        self.transient(master)
        self.grab_set()

        self.enabled_var = ctk.BooleanVar(value=bool(settings.get("enabled", False)))
        self.port_var = ctk.StringVar(value=str(settings.get("port") or DEFAULT_REMOTE_PORT))
        self.status_var = ctk.StringVar(value="")
        self.code_var = ctk.StringVar(value="")
        self.url_var = ctk.StringVar(value="")

        shell = ctk.CTkFrame(self, fg_color=ui["BG_PRIMARY"], corner_radius=0)
        shell.pack(fill="both", expand=True, padx=18, pady=18)
        shell.grid_columnconfigure(0, weight=1)
        shell.grid_rowconfigure(5, weight=1)

        header = ctk.CTkFrame(shell, fg_color="transparent")
        header.grid(row=0, column=0, sticky="ew", pady=(0, 14))
        header.grid_columnconfigure(1, weight=1)

        mark = ctk.CTkFrame(
            header,
            width=52,
            height=52,
            fg_color="#fffaf7",
            border_width=1,
            border_color="#ffd2c4",
            corner_radius=8,
        )
        mark.grid(row=0, column=0, sticky="nw", padx=(0, 12))
        mark.grid_propagate(False)
        if self._logo_image is not None:
            ctk.CTkLabel(mark, text="", image=self._logo_image).place(relx=0.5, rely=0.5, anchor="center")
        else:
            ctk.CTkLabel(
                mark,
                text="AT",
                font=(FONT_FAMILY, 18, "bold"),
                text_color=ui["ACCENT"],
            ).place(relx=0.5, rely=0.5, anchor="center")

        title_box = ctk.CTkFrame(header, fg_color="transparent")
        title_box.grid(row=0, column=1, sticky="ew")
        ctk.CTkLabel(
            title_box,
            text="Kết nối điện thoại",
            font=(FONT_FAMILY, FONT_SIZE_TITLE + 5, "bold"),
            text_color=ui["FG_PRIMARY"],
            anchor="w",
        ).pack(fill="x")
        ctk.CTkLabel(
            title_box,
            text="Cho phép AT Remote gửi yêu cầu về ATAssistant khi điện thoại và máy tính cùng WiFi.",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL),
            text_color=ui["FG_SECONDARY"],
            anchor="w",
            justify="left",
            wraplength=620,
        ).pack(fill="x", pady=(4, 0))

        control = ctk.CTkFrame(
            shell,
            fg_color=ui["BG_SECONDARY"],
            border_width=1,
            border_color=ui["BORDER_COLOR"],
            corner_radius=8,
        )
        control.grid(row=1, column=0, sticky="ew", pady=(0, 12))
        control.grid_columnconfigure(1, weight=1)

        self.toggle = ctk.CTkSwitch(
            control,
            text="Bật kết nối điện thoại",
            variable=self.enabled_var,
            command=self._apply_enabled_state,
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            text_color=ui["FG_PRIMARY"],
            progress_color=ui["ACCENT"],
            button_color="#ffffff",
        )
        self.toggle.grid(row=0, column=0, sticky="w", padx=16, pady=14)

        ctk.CTkLabel(
            control,
            text="Cổng",
            font=(FONT_FAMILY, FONT_SIZE_SMALL, "bold"),
            text_color=ui["FG_SECONDARY"],
        ).grid(row=0, column=1, sticky="e", padx=(0, 8))
        ctk.CTkEntry(
            control,
            textvariable=self.port_var,
            width=86,
            height=34,
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            fg_color=ui["BG_INPUT"],
            border_color=ui["BORDER_COLOR"],
            text_color=ui["FG_PRIMARY"],
        ).grid(row=0, column=2, sticky="e", padx=(0, 16))

        ctk.CTkLabel(
            shell,
            textvariable=self.status_var,
            font=(FONT_FAMILY, FONT_SIZE_NORMAL),
            text_color=ui["FG_SECONDARY"],
            anchor="w",
            justify="left",
            wraplength=800,
        ).grid(row=2, column=0, sticky="ew", pady=(0, 12))

        pair_box = ctk.CTkFrame(
            shell,
            fg_color=ui["CARD_SOFT"],
            border_width=1,
            border_color="#ffd2c4",
            corner_radius=8,
        )
        pair_box.grid(row=3, column=0, sticky="ew", pady=(0, 12))
        pair_box.grid_columnconfigure(0, weight=1)
        pair_box.grid_columnconfigure(1, weight=0)

        ctk.CTkLabel(
            pair_box,
            text="Mã kết nối",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            text_color=ui["FG_SECONDARY"],
            anchor="w",
        ).grid(row=0, column=0, sticky="ew", padx=18, pady=(16, 2))
        ctk.CTkLabel(
            pair_box,
            textvariable=self.code_var,
            font=(FONT_FAMILY, 36, "bold"),
            text_color=ui["FG_PRIMARY"],
            anchor="w",
        ).grid(row=1, column=0, sticky="ew", padx=18, pady=(0, 4))
        ctk.CTkLabel(
            pair_box,
            textvariable=self.url_var,
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            text_color=ui["ACCENT"],
            anchor="w",
            wraplength=560,
        ).grid(row=2, column=0, sticky="ew", padx=18, pady=(0, 16))

        qr_shell = ctk.CTkFrame(pair_box, fg_color="#ffffff", corner_radius=8)
        qr_shell.grid(row=0, column=1, rowspan=3, sticky="e", padx=16, pady=16)
        self.qr_label = ctk.CTkLabel(qr_shell, text="")
        self.qr_label.pack(padx=10, pady=10)

        actions = ctk.CTkFrame(shell, fg_color="transparent")
        actions.grid(row=4, column=0, sticky="ew", pady=(0, 12))
        actions.grid_columnconfigure((0, 1, 2, 3), weight=1)
        self._button(actions, "Đổi mã", self._rotate_code, 0, tone="neutral")
        self._button(actions, "Mở AT Remote", self._open_remote_url, 1, tone="primary")
        self._button(actions, "Mở thư mục tệp", self._open_uploads_folder, 2, tone="neutral")
        self._button(actions, "Đóng", self.destroy, 3, tone="neutral")

        lists = ctk.CTkFrame(shell, fg_color="transparent")
        lists.grid(row=5, column=0, sticky="nsew")
        lists.grid_columnconfigure((0, 1), weight=1)
        lists.grid_rowconfigure(0, weight=1)

        self.pending_frame = ctk.CTkScrollableFrame(
            lists,
            fg_color=ui["BG_SECONDARY"],
            border_width=1,
            border_color=ui["BORDER_COLOR"],
            corner_radius=8,
            height=220,
        )
        self.pending_frame.grid(row=0, column=0, sticky="nsew", padx=(0, 6))
        self.devices_frame = ctk.CTkScrollableFrame(
            lists,
            fg_color=ui["BG_SECONDARY"],
            border_width=1,
            border_color=ui["BORDER_COLOR"],
            corner_radius=8,
            height=220,
        )
        self.devices_frame.grid(row=0, column=1, sticky="nsew", padx=(6, 0))

        self._refresh()
        self.after(1000, self._poll)

    def _load_logo_image(self):
        if Image is None:
            return None
        try:
            image = Image.open(resource_path("assests", "icon_64.png")).convert("RGBA")
            return ctk.CTkImage(light_image=image.copy(), dark_image=image.copy(), size=(34, 34))
        except Exception:
            return None

    def _button(self, parent, text: str, command, column: int, *, tone: str) -> None:
        ui = self._palette
        if tone == "primary":
            fg = ui["ACCENT_BLUE"]
            hover = ui["ACCENT_BLUE_HOVER"]
            text_color = "#ffffff"
        else:
            fg = ui["ACCENT_CHOICE"]
            hover = ui["ACCENT_CHOICE_HOVER"]
            text_color = ui["FG_PRIMARY"]
        ctk.CTkButton(
            parent,
            text=text,
            height=38,
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            fg_color=fg,
            hover_color=hover,
            text_color=text_color,
            corner_radius=8,
            command=command,
        ).grid(row=0, column=column, sticky="ew", padx=(0 if column == 0 else 5, 0 if column == 2 else 5))

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

    def _open_uploads_folder(self) -> None:
        path = ensure_app_data_dir("mobile_uploads")
        try:
            os.startfile(path)  # type: ignore[attr-defined]
        except Exception:
            webbrowser.open(path.as_uri())

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

    def _set_permission(self, device_id: str, permissions: dict, key: str, enabled: bool) -> None:
        next_permissions = {**permissions, key: bool(enabled)}
        result = self._bridge.update_device_permissions(device_id, next_permissions)
        if result.get("ok"):
            self._notify("Đã cập nhật quyền điều khiển.", "success")
        else:
            self._notify(str(result.get("message") or "Chưa cập nhật được quyền."), "error")
        self._refresh()

    def _refresh(self) -> None:
        snapshot = self._bridge.snapshot()
        running = bool(snapshot.get("running"))
        self.enabled_var.set(running)
        self.code_var.set(str(snapshot.get("pairCode") or "------") if running else "------")
        urls = list(snapshot.get("pairingUrls") or snapshot.get("urls") or [])
        deep_links = list(snapshot.get("deepLinkUrls") or [])
        self.url_var.set(str(urls[0]) if urls else "Chưa có địa chỉ. Hãy bật kết nối điện thoại.")
        if running:
            ready = "AT Remote đã sẵn sàng." if snapshot.get("staticAppReady") else "Dùng app Android và nhập địa chỉ bên dưới."
            self.status_var.set(f"{ready} Điện thoại và máy tính cần cùng WiFi.")
        else:
            self.status_var.set("Đang tắt. Bật kết nối điện thoại để ghép nối thiết bị.")
        qr_url = str((deep_links or urls or [""])[0])
        if qr_url != self._last_qr_url:
            self._last_qr_url = qr_url
            self._render_qr(qr_url)

        pending = list(snapshot.get("pending") or [])
        pending_signature = json.dumps(
            [
                {
                    "id": item.get("id"),
                    "deviceName": item.get("deviceName"),
                    "clientHost": item.get("clientHost"),
                    "status": item.get("status"),
                }
                for item in pending
            ],
            ensure_ascii=False,
            sort_keys=True,
        )
        if pending_signature != self._last_pending_signature:
            self._last_pending_signature = pending_signature
            self._render_pending(pending)

        devices = list(snapshot.get("devices") or [])
        devices_signature = json.dumps(
            [
                {
                    "id": item.get("id"),
                    "name": item.get("name"),
                    "approvedAt": item.get("approvedAt"),
                    "permissions": item.get("permissions"),
                }
                for item in devices
            ],
            ensure_ascii=False,
            sort_keys=True,
        )
        if devices_signature != self._last_devices_signature:
            self._last_devices_signature = devices_signature
            self._render_devices(devices)

    def _render_qr(self, url: str) -> None:
        if not url:
            self.qr_label.configure(text="", image=None)
            return
        try:
            import qrcode
        except Exception:
            self.qr_label.configure(text="Cài qrcode để hiện mã", image=None)
            return
        try:
            image = qrcode.make(url).resize((148, 148))
            self._qr_image = ctk.CTkImage(light_image=image, dark_image=image, size=(148, 148))
            self.qr_label.configure(text="", image=self._qr_image)
        except Exception:
            self.qr_label.configure(text="", image=None)

    def _render_pending(self, items: list[dict]) -> None:
        ui = self._palette
        for child in self.pending_frame.winfo_children():
            child.destroy()
        ctk.CTkLabel(
            self.pending_frame,
            text="Thiết bị đang chờ",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            text_color=ui["FG_PRIMARY"],
            anchor="w",
        ).pack(fill="x", padx=12, pady=(12, 7))
        if not items:
            ctk.CTkLabel(
                self.pending_frame,
                text="Chưa có điện thoại nào đang chờ xác nhận.",
                font=(FONT_FAMILY, FONT_SIZE_SMALL),
                text_color=ui["FG_SECONDARY"],
                anchor="w",
                justify="left",
                wraplength=330,
            ).pack(fill="x", padx=12, pady=(0, 12))
            return
        for item in items:
            row = ctk.CTkFrame(self.pending_frame, fg_color=ui["CARD_BLUE"], corner_radius=8)
            row.pack(fill="x", padx=12, pady=6)
            ctk.CTkLabel(
                row,
                text=f"{item.get('deviceName') or 'Điện thoại'}\n{item.get('clientHost') or 'Cùng WiFi'}",
                font=(FONT_FAMILY, FONT_SIZE_SMALL),
                text_color=ui["FG_PRIMARY"],
                anchor="w",
                justify="left",
            ).pack(fill="x", padx=10, pady=(10, 7))
            buttons = ctk.CTkFrame(row, fg_color="transparent")
            buttons.pack(fill="x", padx=10, pady=(0, 10))
            request_id = str(item.get("id") or "")
            ctk.CTkButton(
                buttons,
                text="Cho phép",
                height=30,
                fg_color=ui["ACCENT"],
                hover_color=ui["ACCENT_HOVER"],
                text_color="#ffffff",
                command=lambda rid=request_id: self._approve(rid),
            ).pack(side="left", expand=True, fill="x", padx=(0, 4))
            ctk.CTkButton(
                buttons,
                text="Từ chối",
                height=30,
                fg_color=ui["ACCENT_CANCEL"],
                hover_color=ui["ACCENT_CANCEL_HOVER"],
                text_color=ui["FG_ERROR"],
                command=lambda rid=request_id: self._reject(rid),
            ).pack(side="left", expand=True, fill="x", padx=(4, 0))

    def _render_devices(self, items: list[dict]) -> None:
        ui = self._palette
        self._permission_vars = []
        for child in self.devices_frame.winfo_children():
            child.destroy()
        ctk.CTkLabel(
            self.devices_frame,
            text="Thiết bị đã kết nối",
            font=(FONT_FAMILY, FONT_SIZE_NORMAL, "bold"),
            text_color=ui["FG_PRIMARY"],
            anchor="w",
        ).pack(fill="x", padx=12, pady=(12, 7))
        if not items:
            ctk.CTkLabel(
                self.devices_frame,
                text="Chưa có điện thoại nào.",
                font=(FONT_FAMILY, FONT_SIZE_SMALL),
                text_color=ui["FG_SECONDARY"],
                anchor="w",
            ).pack(fill="x", padx=12, pady=(0, 12))
            return
        for item in items:
            row = ctk.CTkFrame(self.devices_frame, fg_color=ui["BG_INPUT"], corner_radius=8)
            row.pack(fill="x", padx=12, pady=6)
            ctk.CTkLabel(
                row,
                text=f"{item.get('name') or 'Điện thoại'}\nLần cuối: {item.get('lastSeen') or 'chưa có'}",
                font=(FONT_FAMILY, FONT_SIZE_SMALL),
                text_color=ui["FG_PRIMARY"],
                anchor="w",
                justify="left",
                wraplength=330,
            ).pack(fill="x", padx=10, pady=(10, 7))
            device_id = str(item.get("id") or "")
            permissions = dict(item.get("permissions") or {})
            permission_box = ctk.CTkFrame(row, fg_color="transparent")
            permission_box.pack(fill="x", padx=10, pady=(0, 8))
            for key, meta in PERMISSION_GROUPS.items():
                var = ctk.BooleanVar(value=bool(permissions.get(key, False)))
                self._permission_vars.append(var)
                ctk.CTkSwitch(
                    permission_box,
                    text=meta.get("label") or key,
                    variable=var,
                    command=lambda did=device_id, perms=permissions, group=key, value=var: self._set_permission(
                        did,
                        perms,
                        group,
                        bool(value.get()),
                    ),
                    font=(FONT_FAMILY, FONT_SIZE_SMALL, "bold"),
                    text_color=ui["FG_PRIMARY"],
                    progress_color=ui["ACCENT"],
                    button_color="#ffffff",
                ).pack(anchor="w", pady=2)
            ctk.CTkButton(
                row,
                text="Xóa thiết bị",
                height=30,
                fg_color=ui["ACCENT_CANCEL"],
                hover_color=ui["ACCENT_CANCEL_HOVER"],
                text_color=ui["FG_ERROR"],
                command=lambda did=device_id: self._revoke(did),
            ).pack(fill="x", padx=10, pady=(0, 10))

    def _poll(self) -> None:
        if not self.winfo_exists():
            return
        self._refresh()
        self.after(1000, self._poll)

    def _notify(self, message: str, style: str = "normal") -> None:
        if self._on_message:
            self._on_message(message, style)
