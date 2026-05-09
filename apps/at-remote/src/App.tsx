import {
  BatteryCharging,
  Check,
  ChevronRight,
  Clipboard,
  Cpu,
  Hash,
  KeyRound,
  Mail,
  MonitorSmartphone,
  Plus,
  QrCode,
  RefreshCw,
  Send,
  ShieldCheck,
  Smartphone,
  WifiOff,
  X
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type ConnectionStep = "checking" | "connect" | "pending" | "connected";
type MessageRole = "user" | "assistant";

type MobileButton = {
  label: string;
  command?: string;
  url?: string;
  tone?: "danger" | "neutral";
};

type MobileCard = {
  type: string;
  title?: string;
  message?: string;
  email?: string;
  messages?: Array<Record<string, unknown>>;
  items?: Array<{ label: string; value: string; copy?: boolean }>;
  choices?: string[];
  image?: { src: string; alt: string };
  caption?: string;
  tone?: string;
};

type CommandResult = {
  ok: boolean;
  status: string;
  message: string;
  cards: MobileCard[];
  buttons: MobileButton[];
  requiresConfirmation?: boolean;
};

type ChatMessage = {
  id: string;
  role: MessageRole;
  text: string;
  cards?: MobileCard[];
  buttons?: MobileButton[];
  status?: string;
};

type SavedConnection = {
  baseUrl: string;
  authKey: string;
  deviceName: string;
};

type QuickAction = {
  label: string;
  icon: typeof Mail;
  command?: string;
  prefix?: string;
  suffix?: string;
};

const STORAGE_KEY = "atRemoteConnection";
const LAST_ADDRESS_KEY = "atRemoteAddress";
const DEVICE_NAME_KEY = "atRemoteDeviceName";

const defaultBaseUrl = () => {
  const saved = localStorage.getItem(LAST_ADDRESS_KEY);
  if (saved) return saved;
  const port = window.location.port === "8765" ? window.location.port : "8765";
  return `${window.location.protocol}//${window.location.hostname}:${port}`;
};

const friendlyFetchError = () =>
  "Không kết nối được với máy tính. Máy tính chưa bật ATAssistant hoặc điện thoại và máy tính chưa cùng WiFi.";

const readSavedConnection = (): SavedConnection | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedConnection) : null;
  } catch {
    return null;
  }
};

const saveConnection = (value: SavedConnection) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  localStorage.setItem(LAST_ADDRESS_KEY, value.baseUrl);
  localStorage.setItem(DEVICE_NAME_KEY, value.deviceName);
};

const clearConnection = () => {
  localStorage.removeItem(STORAGE_KEY);
};

const newId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function App() {
  const [baseUrl, setBaseUrl] = useState(defaultBaseUrl());
  const [deviceName, setDeviceName] = useState(
    localStorage.getItem(DEVICE_NAME_KEY) || "Điện thoại của Trung"
  );
  const [pairCode, setPairCode] = useState(new URLSearchParams(window.location.search).get("code") || "");
  const [step, setStep] = useState<ConnectionStep>("checking");
  const [connection, setConnection] = useState<SavedConnection | null>(readSavedConnection());
  const [connectionText, setConnectionText] = useState("Đang kiểm tra kết nối");
  const [pairRequestId, setPairRequestId] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lastCommand, setLastCommand] = useState("");
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const activeBaseUrl = connection?.baseUrl || baseUrl;

  const checkHealth = useCallback(async () => {
    try {
      const response = await fetch(`${activeBaseUrl}/api/health`, { cache: "no-store" });
      if (!response.ok) throw new Error("offline");
      setConnectionText(connection ? "Đã kết nối" : "Kết nối với máy tính");
      setStep(connection ? "connected" : "connect");
    } catch {
      setConnectionText("Mất kết nối");
      if (connection) setStep("connected");
      else setStep("connect");
    }
  }, [activeBaseUrl, connection]);

  useEffect(() => {
    checkHealth();
    const id = window.setInterval(checkHealth, 3500);
    return () => window.clearInterval(id);
  }, [checkHealth]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (step !== "pending" || !pairRequestId) return;
    const id = window.setInterval(async () => {
      try {
        const response = await fetch(
          `${baseUrl}/api/pair/status?requestId=${encodeURIComponent(pairRequestId)}`,
          { cache: "no-store" }
        );
        const data = await response.json();
        if (data.status === "approved" && data.authKey) {
          const saved = { baseUrl, authKey: data.authKey as string, deviceName };
          saveConnection(saved);
          setConnection(saved);
          setStep("connected");
          setConnectionText("Đã kết nối");
          setMessages([
            {
              id: newId(),
              role: "assistant",
              text: "Đã kết nối với ATAssistant.",
              cards: [
                {
                  type: "message",
                  title: "Đã kết nối",
                  message: "Bạn có thể nhập yêu cầu hoặc dùng các nút nhanh."
                }
              ]
            }
          ]);
        }
        if (data.status === "rejected") {
          setStep("connect");
          setConnectionText("Mất kết nối");
        }
      } catch {
        setConnectionText("Mất kết nối");
      }
    }, 1400);
    return () => window.clearInterval(id);
  }, [baseUrl, deviceName, pairRequestId, step]);

  const submitPair = async (event?: FormEvent) => {
    event?.preventDefault();
    const cleanBase = baseUrl.trim().replace(/\/+$/, "");
    setBaseUrl(cleanBase);
    localStorage.setItem(LAST_ADDRESS_KEY, cleanBase);
    localStorage.setItem(DEVICE_NAME_KEY, deviceName.trim() || "Điện thoại");
    setBusy(true);
    try {
      const response = await fetch(`${cleanBase}/api/pair/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceName, pairCode })
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || friendlyFetchError());
      setPairRequestId(data.requestId);
      setStep("pending");
      setConnectionText("Đang chờ xác nhận trên ATAssistant");
    } catch (error) {
      setConnectionText(error instanceof Error ? error.message : friendlyFetchError());
      setStep("connect");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = () => {
    clearConnection();
    setConnection(null);
    setStep("connect");
    setConnectionText("Kết nối với máy tính");
  };

  const appendAssistantError = (text: string) => {
    setMessages((current) => [
      ...current,
      {
        id: newId(),
        role: "assistant",
        text,
        status: "error",
        cards: [{ type: "error", title: "Mất kết nối", message: text }],
        buttons: [{ label: "Thử lại", command: "__retry__" }]
      }
    ]);
  };

  const sendCommand = async (command: string) => {
    const clean = command.trim();
    if (!clean) return;
    if (clean === "__retry__") {
      if (lastCommand) void sendCommand(lastCommand);
      return;
    }
    if (!connection) {
      setStep("connect");
      return;
    }
    setLastCommand(clean);
    setDraft("");
    setMessages((current) => [...current, { id: newId(), role: "user", text: clean }]);
    setBusy(true);
    try {
      const response = await fetch(`${connection.baseUrl}/api/command`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-AT-Remote-Key": connection.authKey
        },
        body: JSON.stringify({ command: clean })
      });
      const data = (await response.json()) as CommandResult;
      if (!response.ok || data.status === "unauthorized") {
        throw new Error(friendlyFetchError());
      }
      setMessages((current) => [
        ...current,
        {
          id: newId(),
          role: "assistant",
          text: data.message,
          cards: data.cards,
          buttons: data.buttons,
          status: data.status
        }
      ]);
      setConnectionText("Đã kết nối");
    } catch (error) {
      appendAssistantError(error instanceof Error ? error.message : friendlyFetchError());
      setConnectionText("Mất kết nối");
    } finally {
      setBusy(false);
    }
  };

  const onSubmitCommand = (event: FormEvent) => {
    event.preventDefault();
    void sendCommand(draft);
  };

  const quickActions = useMemo<QuickAction[]>(
    () => [
      { label: "Email tạm", icon: Mail, command: "mo temp mail" },
      { label: "Tạo QR", icon: QrCode, prefix: "tạo qr ", suffix: " trong mmo" },
      { label: "Tạo mật khẩu", icon: KeyRound, command: "tạo mật khẩu trong mmo" },
      { label: "Hash text", icon: Hash, prefix: "hash sha256 ", suffix: " trong mmo" },
      { label: "Trạng thái máy", icon: Cpu, command: "trạng thái máy" }
    ],
    []
  );

  const runQuickAction = (action: QuickAction) => {
    if ("command" in action && action.command) {
      void sendCommand(action.command);
      return;
    }
    const selectedText = draft.trim();
    if (selectedText && action.prefix) {
      void sendCommand(`${action.prefix}${selectedText}${action.suffix || ""}`);
      return;
    }
    if (action.prefix) {
      setDraft(action.prefix);
      window.setTimeout(() => inputRef.current?.focus(), 30);
    }
  };

  if (step !== "connected") {
    return (
      <main className="connect-page">
        <section className="connect-card">
          <div className="brand-mark">
            <MonitorSmartphone size={34} />
          </div>
          <h1>AT Remote</h1>
          <p className="lead">Kết nối với máy tính</p>
          <div className={`status-pill ${connectionText === "Mất kết nối" ? "lost" : ""}`}>
            {connectionText === "Mất kết nối" ? <WifiOff size={16} /> : <ShieldCheck size={16} />}
            <span>{connectionText}</span>
          </div>

          {step === "pending" ? (
            <div className="waiting-panel">
              <Smartphone size={38} />
              <h2>Đang chờ xác nhận trên ATAssistant</h2>
              <p>Trên máy tính, mở Kết nối điện thoại và chọn Cho phép.</p>
              <button className="ghost-button" onClick={() => setStep("connect")}>
                Hủy
              </button>
            </div>
          ) : (
            <form className="connect-form" onSubmit={submitPair}>
              <label>
                Tên điện thoại
                <input value={deviceName} onChange={(event) => setDeviceName(event.target.value)} />
              </label>
              <label>
                Địa chỉ kết nối
                <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} inputMode="url" />
              </label>
              <label>
                Mã kết nối
                <input
                  value={pairCode}
                  onChange={(event) => setPairCode(event.target.value)}
                  inputMode="numeric"
                  maxLength={12}
                  placeholder="Nhập mã trên ATAssistant"
                />
              </label>
              <button className="primary-button" disabled={busy || !pairCode.trim()}>
                {busy ? <RefreshCw className="spin" size={18} /> : <ChevronRight size={18} />}
                Kết nối với máy tính
              </button>
            </form>
          )}

          <div className="hint-list">
            <p>Quét mã trên ATAssistant hoặc nhập mã kết nối.</p>
            <p>Điện thoại và máy tính cần cùng WiFi cho bản đầu tiên.</p>
            <p>Máy tính chưa bật ATAssistant thì điện thoại sẽ báo mất kết nối.</p>
            <p>Trên Android, chọn thêm vào màn hình chính để mở như app.</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">AT Remote</p>
          <h1>Kết quả</h1>
        </div>
        <button className={`connection-badge ${connectionText === "Mất kết nối" ? "lost" : ""}`} onClick={checkHealth}>
          {connectionText === "Mất kết nối" ? <WifiOff size={16} /> : <Check size={16} />}
          {connectionText === "Mất kết nối" ? "Mất kết nối" : "Đã kết nối"}
        </button>
      </header>

      <section className="quick-actions" aria-label="Nút nhanh">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <button key={action.label} onClick={() => runQuickAction(action)} disabled={busy}>
              <Icon size={18} />
              <span>{action.label}</span>
            </button>
          );
        })}
      </section>

      <section className="conversation" ref={listRef}>
        {messages.length === 0 ? (
          <div className="empty-state">
            <MonitorSmartphone size={42} />
            <h2>Nhập yêu cầu</h2>
            <p>ATAssistant sẽ xử lý trên máy tính và trả kết quả về đây.</p>
          </div>
        ) : (
          messages.map((message) => (
            <article key={message.id} className={`message ${message.role}`}>
              <p className="message-text">{message.text}</p>
              {message.cards?.map((card, index) => <ResultCard key={`${message.id}-${index}`} card={card} />)}
              {message.buttons && message.buttons.length > 0 ? (
                <div className="result-actions">
                  {message.buttons.map((button) => (
                    <button
                      key={`${button.label}-${button.command || button.url}`}
                      className={button.tone === "danger" ? "danger-button" : "secondary-button"}
                      onClick={() => {
                        if (button.url) window.open(button.url, "_blank", "noopener,noreferrer");
                        else if (button.command) void sendCommand(button.command);
                      }}
                    >
                      {button.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </article>
          ))
        )}
      </section>

      <form className="composer" onSubmit={onSubmitCommand}>
        <button type="button" className="icon-button" onClick={() => setDraft("")} aria-label="Xóa nội dung">
          <X size={18} />
        </button>
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Nhập yêu cầu"
          rows={1}
        />
        <button className="send-button" disabled={busy || !draft.trim()}>
          {busy ? <RefreshCw className="spin" size={18} /> : <Send size={18} />}
          <span>Gửi</span>
        </button>
      </form>

      <button className="disconnect" onClick={disconnect}>
        Đổi máy tính
      </button>
    </main>
  );
}

function ResultCard({ card }: { card: MobileCard }) {
  if (card.type === "image" && card.image) {
    return (
      <div className="result-card image-card">
        <h3>{card.title || "Ảnh kết quả"}</h3>
        <img src={card.image.src} alt={card.image.alt || "Kết quả"} />
        {card.caption ? <p>{card.caption}</p> : null}
      </div>
    );
  }

  if (card.type === "temp_mail") {
    return (
      <div className="result-card mail-card">
        <div className="card-title-row">
          <Mail size={18} />
          <h3>Email tạm</h3>
        </div>
        <CopyLine label="Email" value={card.email || ""} />
        <div className="inbox">
          {(card.messages || []).length === 0 ? (
            <p>Inbox chưa có mail.</p>
          ) : (
            (card.messages || []).map((item, index) => (
              <div className="mail-item" key={`${index}-${String(item.id || item.subject || "")}`}>
                <strong>{String(item.subject || "Không có tiêu đề")}</strong>
                <span>{String(item.from || "")}</span>
                <p>{String(item.intro || item.body || "")}</p>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  if (card.type === "system_status") {
    return (
      <div className="result-card status-card">
        <div className="card-title-row">
          <BatteryCharging size={18} />
          <h3>Trạng thái máy</h3>
        </div>
        <div className="metric-grid">
          {(card.items || []).map((item) => (
            <div key={item.label} className="metric">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (card.type === "copy") {
    return (
      <div className="result-card copy-card">
        <h3>{card.title || "Kết quả"}</h3>
        {(card.items || []).map((item) => (
          <CopyLine key={item.label} label={item.label} value={item.value} />
        ))}
      </div>
    );
  }

  if (card.type === "confirm") {
    return (
      <div className="result-card confirm-card">
        <h3>Cần xác nhận rõ ràng</h3>
        <p>{card.message}</p>
      </div>
    );
  }

  if (card.type === "choice") {
    return (
      <div className="result-card choice-card">
        <h3>{card.title || "Chọn một mục"}</h3>
        <ol>
          {(card.choices || []).map((choice) => (
            <li key={choice}>{choice}</li>
          ))}
        </ol>
      </div>
    );
  }

  return (
    <div className={`result-card ${card.type === "error" ? "error-card" : ""}`}>
      <h3>{card.title || "Kết quả"}</h3>
      <p>{card.message}</p>
    </div>
  );
}

function CopyLine({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="copy-line">
      <span>{label}</span>
      <code>{value}</code>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1200);
        }}
      >
        {copied ? <Check size={16} /> : <Clipboard size={16} />}
        {copied ? "Đã sao chép" : "Sao chép"}
      </button>
    </div>
  );
}

export default App;
