import { Capacitor, CapacitorHttp } from "@capacitor/core";
import {
  BatteryCharging,
  Check,
  ChevronRight,
  Clipboard,
  Cpu,
  Hash,
  KeyRound,
  Mail,
  Menu,
  MonitorSmartphone,
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

type JsonRequestOptions = {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  data?: unknown;
};

const STORAGE_KEY = "atRemoteConnection";
const LAST_ADDRESS_KEY = "atRemoteAddress";
const DEVICE_NAME_KEY = "atRemoteDeviceName";

const normalizeBaseUrl = (value: string) => value.trim().replace(/\/+$/, "");

const currentLanBaseUrl = () => {
  if (!["http:", "https:"].includes(window.location.protocol)) return "";
  const host = window.location.hostname;
  if (!host) return "";
  const protocol = window.location.protocol === "https:" ? "https:" : "http:";
  return `${protocol}//${host}:8765`;
};

const defaultBaseUrl = () => {
  const params = new URLSearchParams(window.location.search);
  const explicitBase = params.get("base") || params.get("baseUrl");
  if (explicitBase) return normalizeBaseUrl(explicitBase);

  const lanBase = currentLanBaseUrl();
  if (params.has("code") && lanBase) return lanBase;
  if (lanBase && window.location.port === "8765") return lanBase;

  const saved = localStorage.getItem(LAST_ADDRESS_KEY);
  if (saved) return saved;
  return lanBase;
};

const friendlyFetchError = () =>
  "Không kết nối được với máy tính. Máy tính chưa bật ATAssistant hoặc điện thoại và máy tính chưa cùng WiFi.";

const isConnectionErrorMessage = (message: string) =>
  /failed to fetch|load failed|networkerror|network error|offline|timeout|timed out|cleartext|econn|java\.net|failed to connect|unable to resolve/i.test(
    message
  );

const friendlyConnectionError = (error: unknown) => {
  if (!(error instanceof Error)) return friendlyFetchError();
  const message = String(error.message || "").trim();
  if (!message || isConnectionErrorMessage(message)) return friendlyFetchError();
  return message;
};

const parseJsonData = <T,>(value: unknown): T => {
  if (typeof value !== "string") return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return value as T;
  }
};

const requestJson = async <T,>(url: string, options: JsonRequestOptions = {}) => {
  const method = options.method || "GET";
  const headers: Record<string, string> = { ...(options.headers || {}) };
  if (method !== "GET" && options.data !== undefined && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.request({
      url,
      method,
      headers,
      data: options.data,
      responseType: "json",
      connectTimeout: 5000,
      readTimeout: 20000
    });
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      data: parseJsonData<T>(response.data)
    };
  }

  const response = await fetch(url, {
    method,
    headers,
    body: options.data === undefined ? undefined : JSON.stringify(options.data),
    cache: "no-store"
  });
  return {
    ok: response.ok,
    status: response.status,
    data: (await response.json()) as T
  };
};

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
  const [showQuickActions, setShowQuickActions] = useState(true);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const activeBaseUrl = connection?.baseUrl || baseUrl;
  const statusTone =
    connectionText === "Mất kết nối" ? "lost" : connectionText === "Đã kết nối" ? "ready" : "neutral";

  const enterConnected = useCallback((saved: SavedConnection) => {
    saveConnection(saved);
    setConnection(saved);
    setPairRequestId("");
    setStep("connected");
    setConnectionText("Đã kết nối");
    setMessages((current) =>
      current.length
        ? current
        : [
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
          ]
    );
  }, []);

  const checkHealth = useCallback(async () => {
    if (!activeBaseUrl.trim()) {
      setConnectionText(connection ? "Mất kết nối" : "Kết nối với máy tính");
      setStep(connection ? "connected" : "connect");
      return;
    }
    try {
      const response = await requestJson<Record<string, unknown>>(`${activeBaseUrl}/api/health`);
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
        const response = await requestJson<Record<string, unknown>>(
          `${baseUrl}/api/pair/status?requestId=${encodeURIComponent(pairRequestId)}`
        );
        const data = response.data;
        if (data.status === "approved" && data.authKey) {
          enterConnected({
            baseUrl: normalizeBaseUrl(baseUrl),
            authKey: data.authKey as string,
            deviceName: deviceName.trim() || "Điện thoại"
          });
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
  }, [baseUrl, deviceName, enterConnected, pairRequestId, step]);

  const submitPair = async (event?: FormEvent) => {
    event?.preventDefault();
    if (busy || step === "pending") return;
    const cleanBase = normalizeBaseUrl(baseUrl);
    setBaseUrl(cleanBase);
    if (!/^https?:\/\/[^/]+/i.test(cleanBase)) {
      setConnectionText("Nhập đúng địa chỉ hiển thị trên ATAssistant.");
      setStep("connect");
      return;
    }
    localStorage.setItem(LAST_ADDRESS_KEY, cleanBase);
    localStorage.setItem(DEVICE_NAME_KEY, deviceName.trim() || "Điện thoại");
    setBusy(true);
    try {
      const response = await requestJson<Record<string, unknown>>(`${cleanBase}/api/pair/request`, {
        method: "POST",
        data: { deviceName, pairCode }
      });
      const data = response.data;
      if (!response.ok || !data.ok) throw new Error(String(data.message || friendlyFetchError()));
      if (data.status === "approved" && typeof data.authKey === "string" && data.authKey) {
        enterConnected({
          baseUrl: cleanBase,
          authKey: data.authKey,
          deviceName: deviceName.trim() || "Điện thoại"
        });
        return;
      }
      if (!data.requestId) throw new Error("Máy tính chưa nhận được yêu cầu kết nối.");
      setPairRequestId(String(data.requestId || ""));
      setStep("pending");
      setConnectionText("Đang chờ xác nhận trên ATAssistant");
    } catch (error) {
      setConnectionText(friendlyConnectionError(error));
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
      const response = await requestJson<CommandResult>(`${connection.baseUrl}/api/command`, {
        method: "POST",
        headers: {
          "X-AT-Remote-Key": connection.authKey
        },
        data: { command: clean }
      });
      const data = response.data;
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
      appendAssistantError(friendlyConnectionError(error));
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
      { label: "Email tạm", icon: Mail, command: "mở temp mail" },
      { label: "Tạo QR", icon: QrCode, prefix: "tạo qr ", suffix: " trong mmo" },
      { label: "Tạo mật khẩu", icon: KeyRound, command: "tạo mật khẩu trong mmo" },
      { label: "Hash text", icon: Hash, prefix: "hash sha256 ", suffix: " trong mmo" },
      { label: "Trạng thái máy", icon: Cpu, command: "trạng thái máy" }
    ],
    []
  );

  const runQuickAction = (action: QuickAction) => {
    setShowQuickActions(false);
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
          <div className="connect-top">
            <div className="brand-lockup">
              <div className="brand-mark">
                <span>AT</span>
                <MonitorSmartphone size={20} />
              </div>
              <div>
                <p className="eyebrow">AT Remote</p>
                <h1>Kết nối điện thoại</h1>
              </div>
            </div>
            <div className={`status-pill ${statusTone}`}>
              {connectionText === "Mất kết nối" ? <WifiOff size={16} /> : <ShieldCheck size={16} />}
              <span>{connectionText}</span>
            </div>
          </div>
          <p className="lead">Nhập đúng địa chỉ và mã đang hiển thị trong ATAssistant trên máy tính.</p>

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
                <input
                  value={baseUrl}
                  onChange={(event) => setBaseUrl(event.target.value)}
                  inputMode="url"
                  placeholder="http://192.168.1.11:8765"
                />
                <span className="field-hint">Dùng đúng địa chỉ nằm dưới mã kết nối trên ATAssistant.</span>
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
              <button className="primary-button" disabled={busy || !baseUrl.trim() || !pairCode.trim()}>
                {busy ? <RefreshCw className="spin" size={18} /> : <ChevronRight size={18} />}
                Kết nối với máy tính
              </button>
            </form>
          )}

          <div className="hint-list">
            <div><span>1</span><p>Mở ATAssistant và bật Kết nối điện thoại.</p></div>
            <div><span>2</span><p>Điện thoại và máy tính cần cùng WiFi cho bản đầu tiên.</p></div>
            <div><span>3</span><p>Nếu báo mất kết nối, kiểm tra lại địa chỉ đang nhập.</p></div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div className="top-brand">
          <div className="brand-mark small">
            <span>AT</span>
          </div>
          <div>
            <p className="eyebrow">AT Remote</p>
            <h1>Kết quả</h1>
          </div>
        </div>
        <button className={`connection-badge ${statusTone}`} onClick={checkHealth}>
          {connectionText === "Mất kết nối" ? <WifiOff size={16} /> : <Check size={16} />}
          {connectionText === "Mất kết nối" ? "Mất kết nối" : "Đã kết nối"}
        </button>
      </header>

      <section className={`quick-actions ${showQuickActions ? "open" : "closed"}`} aria-label="Nút nhanh">
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
        <button
          type="button"
          className="icon-button"
          onClick={() => {
            if (draft.trim()) setDraft("");
            else setShowQuickActions((value) => !value);
          }}
          aria-label={draft.trim() ? "Xóa nội dung" : "Nút nhanh"}
        >
          {draft.trim() ? <X size={18} /> : <Menu size={19} />}
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
