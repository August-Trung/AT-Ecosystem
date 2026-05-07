import ctypes
ctypes.windll.shcore.SetProcessDpiAwareness(1)

import tkinter as tk
import threading
import queue

notify_queue = queue.Queue()

WIDTH = 600
PADDING = 14
BG = "#2b2b2b"
FG = "#e8e8e8"


# ======================================================
#  MODERN SCROLLBAR — FIXED
# ======================================================
class ModernScrollbar(tk.Canvas):
    def __init__(self, parent, target_widget, **kwargs):
        kwargs.setdefault("bg", BG)
        super().__init__(parent, width=8, highlightthickness=0, bd=0, **kwargs)

        self.target = target_widget

        self.target.config(yscrollcommand=self._sync_thumb)

        self.bind("<Button-1>", self._click)
        self.bind("<B1-Motion>", self._drag)

        self.after(100, lambda: self._sync_thumb("0", "1"))

    def _sync_thumb(self, first, last=None):
        try:
            if last is None:
                last = float(first) + 0.1
            first = float(first)
            last = float(last)
        except:
            first, last = 0.0, 1.0

        h = max(1, self.winfo_height())
        y1 = first * h
        y2 = last * h

        self._draw_thumb(y1, y2)

    def _draw_thumb(self, y1, y2):
        self.delete("thumb")
        self.create_round_rect(
            2, y1, 6, y2,
            fill="#606060",
            outline="#606060",
            radius=4,
            tags="thumb"
        )

    def _click(self, event):
        self._move(event.y)

    def _drag(self, event):
        self._move(event.y)

    def _move(self, y):
        h = max(1, self.winfo_height())
        pos = max(0, min(1, y / h))
        self.target.yview_moveto(pos)

    def create_round_rect(self, x1, y1, x2, y2, radius=6, **kwargs):
        points = [
            x1 + radius, y1,
            x2 - radius, y1,
            x2, y1,
            x2, y1 + radius,
            x2, y2 - radius,
            x2, y2,
            x2 - radius, y2,
            x1 + radius, y2,
            x1, y2,
            x1, y2 - radius,
            x1, y1 + radius,
            x1, y1
        ]
        return self.create_polygon(points, smooth=True, **kwargs)


# ======================================================
#  POPUP UI
# ======================================================
def _show_popup(root, title, messages):
    win = tk.Toplevel(root)
    win.overrideredirect(True)
    win.attributes("-topmost", True)
    win.configure(bg=BG)

    width = WIDTH
    screen_w = win.winfo_screenwidth()
    screen_h = win.winfo_screenheight()

    left = screen_w - width
    top = 0
    height = screen_h - 80

    win.geometry(f"{width}x{height}+{left}+{top}")

    frame = tk.Frame(win, bg=BG)
    frame.pack(fill="both", expand=True)

    # Header với Title + Button Close
    header = tk.Frame(frame, bg=BG)
    header.pack(fill="x", padx=PADDING, pady=(10, 4))

    # ==== Drag window (kéo popup di chuyển) ====
    def start_move(event):
        win.x = event.x_root
        win.y = event.y_root

    def do_move(event):
        dx = event.x_root - win.x
        dy = event.y_root - win.y
        geom = win.geometry().split("+")
        x = int(geom[1]) + dx
        y = int(geom[2]) + dy
        win.geometry(f"+{x}+{y}")
        win.x = event.x_root
        win.y = event.y_root

    header.bind("<Button-1>", start_move)
    header.bind("<B1-Motion>", do_move)

    tk.Label(
        header, text=title, fg=FG, bg=BG,
        font=("Segoe UI", 12, "bold")
    ).pack(side="left", anchor="w")

    close_btn = tk.Button(
        header,
        text="✕",
        fg="#aaaaaa",
        bg=BG,
        activebackground=BG,
        activeforeground="white",
        bd=0,
        padx=6,
        pady=2,
        font=("Segoe UI", 12, "bold"),
        cursor="hand2",
        command=win.destroy
    )
    close_btn.pack(side="right")

    container = tk.Frame(frame, bg=BG)
    container.pack(fill="both", expand=True, padx=(PADDING - 4), pady=(0, 10))

    text = tk.Text(
        container,
        fg=FG, bg=BG, wrap="word",
        font=("Segoe UI", 11),
        relief="flat",
        insertontime=0
    )
    text.grid(row=0, column=0, sticky="nsew")

    scrollbar = ModernScrollbar(container, text, bg=BG)
    scrollbar.grid(row=0, column=1, sticky="ns")

    container.rowconfigure(0, weight=1)
    container.columnconfigure(0, weight=1)

    for mail in messages:
        from_text = f"📧 {mail.get('from', '')}"

        is_unread = mail.get("is_unread", False)
        has_attach = mail.get("has_attachment", False)

        # Insert FROM
        text.insert("end", from_text + "\n", ("from",))

        # ===== AI notes =====
        notes = mail.get("ai_note", [])

        if notes:
            for note in notes:
                text.insert("end", f"[{note}]  ", ("note_item",))
            text.insert("end", "\n")

        # Insert SUBJECT (with attachment)
        if has_attach:
            text.insert("end", "📎 ", ("attach",))
        text.insert("end", f"Tiêu đề: {mail.get('subject', '')}\n", ("subject",))

        # Snippet
        text.insert("end", f"{mail.get('snippet', '')}\n", ("snippet",))
        text.insert("end", "-" * 40 + "\n\n")
        

    # notes
    text.tag_config("from", foreground="#40C4FF", font=("Segoe UI", 11, "bold"))
    text.tag_config("read_label", foreground="#90A4AE", font=("Segoe UI", 10))
    text.tag_config("attach", foreground="#FFD740", font=("Segoe UI", 11))
    text.tag_config("subject", foreground="#FFAB40", font=("Segoe UI", 11, "bold"))
    text.tag_config("snippet", foreground="#ECEFF1")
    text.tag_config("note_item", foreground="#FACC15",font=("Segoe UI", 10, "bold"))
    text.config(state="disabled")

    win.after(25000, win.destroy)


# ======================================================
#  START TKINTER THREAD
# ======================================================
def start_tk_thread():
    root = tk.Tk()
    root.withdraw()

    def process_queue():
        try:
            while True:
                title, msg = notify_queue.get_nowait()
                _show_popup(root, title, msg)
        except queue.Empty:
            pass

        root.after(50, process_queue)

    process_queue()
    root.mainloop()


threading.Thread(target=start_tk_thread, daemon=True).start()


# ======================================================
#  PUBLIC API
# ======================================================
def show_notification(title: str, messages: list):
    notify_queue.put((title, messages))
