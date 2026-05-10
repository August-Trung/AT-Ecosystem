import { Capacitor, CapacitorHttp } from "@capacitor/core";
import {
  BatteryCharging,
  Check,
  ChevronRight,
  Clipboard,
  Cpu,
  Download,
  FileText,
  Hash,
  KeyRound,
  Mail,
  Menu,
  MonitorSmartphone,
  Paperclip,
  QrCode,
  RefreshCw,
  RotateCcw,
  Send,
  Share2,
  ShieldCheck,
  Smartphone,
  WifiOff,
  X,
  ZoomIn,
  ZoomOut
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

type RemoteFile = {
  id: string;
  name: string;
  mime: string;
  size: number;
  sizeLabel?: string;
  kind?: string;
  downloadUrl: string;
};

type MobileCard = {
  type: string;
  title?: string;
  message?: string;
  email?: string;
  messages?: Array<Record<string, unknown>>;
  items?: Array<{ label: string; value: string; copy?: boolean }>;
  choices?: string[];
  image?: { src: string; alt: string; downloadUrl?: string; name?: string; mime?: string; size?: number };
  file?: RemoteFile;
  caption?: string;
  tone?: string;
};

type CommandResult = {
  ok: boolean;
  status: string;
  message: string;
  cards: MobileCard[];
  buttons: MobileButton[];
  files?: RemoteFile[];
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

type ImageViewerState = {
  src: string;
  title: string;
  caption?: string;
  file?: RemoteFile;
};

const STORAGE_KEY = "atRemoteConnection";
const LAST_ADDRESS_KEY = "atRemoteAddress";
const DEVICE_NAME_KEY = "atRemoteDeviceName";

const normalizeBaseUrl = (value: string) => value.trim().replace(/\/+$/, "");

const absoluteRemoteUrl = (baseUrl: string, url: string) => {
  const value = String(url || "").trim();
  if (!value) return "";
  if (/^data:/i.test(value) || /^blob:/i.test(value) || /^https?:\/\//i.test(value)) return value;
  const base = normalizeBaseUrl(baseUrl);
  return `${base}${value.startsWith("/") ? "" : "/"}${value}`;
};

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

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      resolve(value.includes(",") ? value.split(",", 2)[1] : value);
    };
    reader.onerror = () => reject(reader.error || new Error("Không đọc được tệp."));
    reader.readAsDataURL(file);
  });

const downloadBlob = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name || "at-remote-file";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
};

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
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [imageViewer, setImageViewer] = useState<ImageViewerState | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const stepRef = useRef<ConnectionStep>("checking");

  const setConnectionStep = useCallback((next: ConnectionStep) => {
    stepRef.current = next;
    setStep(next);
  }, []);

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  const activeBaseUrl = connection?.baseUrl || baseUrl;
  const statusTone =
    connectionText === "Mất kết nối" ? "lost" : connectionText === "Đã kết nối" ? "ready" : "neutral";

  const enterConnected = useCallback((saved: SavedConnection) => {
    saveConnection(saved);
    setConnection(saved);
    setPairRequestId("");
    setConnectionStep("connected");
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
  }, [setConnectionStep]);

  const checkHealth = useCallback(async () => {
    const isWaitingForApproval = () => stepRef.current === "pending";
    if (isWaitingForApproval()) {
      return;
    }
    if (!activeBaseUrl.trim()) {
      if (isWaitingForApproval()) return;
      setConnectionText(connection ? "Mất kết nối" : "Kết nối với máy tính");
      setConnectionStep(connection ? "connected" : "connect");
      return;
    }
    try {
      const response = await requestJson<Record<string, unknown>>(`${activeBaseUrl}/api/health`);
      if (!response.ok) throw new Error("offline");
      if (isWaitingForApproval()) return;
      setConnectionText(connection ? "Đã kết nối" : "Kết nối với máy tính");
      setConnectionStep(connection ? "connected" : "connect");
    } catch {
      if (isWaitingForApproval()) return;
      setConnectionText("Mất kết nối");
      setConnectionStep(connection ? "connected" : "connect");
    }
  }, [activeBaseUrl, connection, setConnectionStep]);

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
          setConnectionStep("connect");
          setConnectionText("Mất kết nối");
        }
      } catch {
        setConnectionText("Mất kết nối");
      }
    }, 1400);
    return () => window.clearInterval(id);
  }, [baseUrl, deviceName, enterConnected, pairRequestId, setConnectionStep, step]);

  const submitPair = async (event?: FormEvent) => {
    event?.preventDefault();
    if (busy || stepRef.current === "pending") return;
    const cleanBase = normalizeBaseUrl(baseUrl);
    setBaseUrl(cleanBase);
    if (!/^https?:\/\/[^/]+/i.test(cleanBase)) {
      setConnectionText("Nhập đúng địa chỉ hiển thị trên ATAssistant.");
      setConnectionStep("connect");
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
      setConnectionStep("pending");
      setConnectionText("Đang chờ xác nhận trên ATAssistant");
    } catch (error) {
      setConnectionText(friendlyConnectionError(error));
      setConnectionStep("connect");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = () => {
    clearConnection();
    setConnection(null);
    setShowQuickActions(false);
    setConnectionStep("connect");
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

  const remoteFileUrl = useCallback(
    (file: RemoteFile) => absoluteRemoteUrl(connection?.baseUrl || baseUrl, file.downloadUrl),
    [baseUrl, connection]
  );

  const fetchRemoteFile = useCallback(
    async (file: RemoteFile) => {
      const url = remoteFileUrl(file);
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error("Không tải được tệp từ máy tính.");
      return response.blob();
    },
    [remoteFileUrl]
  );

  const downloadRemoteFile = useCallback(
    async (file: RemoteFile) => {
      try {
        const blob = await fetchRemoteFile(file);
        downloadBlob(blob, file.name);
      } catch {
        const url = remoteFileUrl(file);
        if (url) window.open(url, "_blank", "noopener,noreferrer");
      }
    },
    [fetchRemoteFile, remoteFileUrl]
  );

  const shareRemoteFile = useCallback(
    async (file: RemoteFile) => {
      try {
        const blob = await fetchRemoteFile(file);
        const sharedFile = new File([blob], file.name, { type: file.mime || blob.type || "application/octet-stream" });
        const shareData = { title: file.name, files: [sharedFile] };
        if (navigator.canShare?.(shareData)) {
          await navigator.share(shareData);
          return;
        }
        await navigator.share?.({ title: file.name, text: file.name });
        downloadBlob(blob, file.name);
      } catch {
        await downloadRemoteFile(file);
      }
    },
    [downloadRemoteFile, fetchRemoteFile]
  );

  const openRemoteFile = useCallback(
    (file: RemoteFile) => {
      const url = remoteFileUrl(file);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    },
    [remoteFileUrl]
  );

  const uploadFile = async (file: File, command: string) => {
    if (!connection) {
      setConnectionStep("connect");
      return;
    }
    setBusy(true);
    setDraft("");
    setLastCommand(command.trim());
    setMessages((current) => [
      ...current,
      {
        id: newId(),
        role: "user",
        text: command.trim() ? `${command.trim()}\nTệp: ${file.name}` : `Gửi tệp: ${file.name}`
      }
    ]);
    try {
      const dataBase64 = await fileToBase64(file);
      const response = await requestJson<CommandResult>(`${connection.baseUrl}/api/upload`, {
        method: "POST",
        headers: {
          "X-AT-Remote-Key": connection.authKey
        },
        data: {
          name: file.name,
          mime: file.type || "application/octet-stream",
          size: file.size,
          command: command.trim(),
          dataBase64
        }
      });
      const data = response.data;
      if (!response.ok || data.status === "unauthorized") throw new Error(friendlyFetchError());
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
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const sendCommand = async (command: string) => {
    const clean = command.trim();
    if (!clean) return;
    if (clean === "__retry__") {
      if (lastCommand) void sendCommand(lastCommand);
      return;
    }
    if (!connection) {
      setConnectionStep("connect");
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
              <button className="ghost-button" onClick={() => setConnectionStep("connect")}>
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
              {message.cards?.map((card, index) => (
                <ResultCard
                  key={`${message.id}-${index}`}
                  card={card}
                  baseUrl={connection?.baseUrl || baseUrl}
                  onOpenImage={setImageViewer}
                  onOpenFile={openRemoteFile}
                  onDownloadFile={downloadRemoteFile}
                  onShareFile={shareRemoteFile}
                />
              ))}
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

      {showQuickActions ? (
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
          <button className="change-computer-action" type="button" onClick={disconnect}>
            <MonitorSmartphone size={18} />
            <span>Đổi máy tính</span>
          </button>
        </section>
      ) : null}

      <form className="composer" onSubmit={onSubmitCommand}>
        <input
          ref={fileInputRef}
          type="file"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void uploadFile(file, draft);
          }}
        />
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
        <button
          type="button"
          className="icon-button"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          aria-label="Đính kèm tệp"
        >
          <Paperclip size={18} />
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

      {imageViewer ? (
        <ImageViewer
          viewer={imageViewer}
          baseUrl={connection?.baseUrl || baseUrl}
          onClose={() => setImageViewer(null)}
          onDownload={downloadRemoteFile}
          onShare={shareRemoteFile}
        />
      ) : null}
    </main>
  );
}

function ResultCard({
  card,
  baseUrl,
  onOpenImage,
  onOpenFile,
  onDownloadFile,
  onShareFile
}: {
  card: MobileCard;
  baseUrl: string;
  onOpenImage: (viewer: ImageViewerState) => void;
  onOpenFile: (file: RemoteFile) => void;
  onDownloadFile: (file: RemoteFile) => void;
  onShareFile: (file: RemoteFile) => void;
}) {
  if (card.type === "image" && card.image) {
    const imageSrc = absoluteRemoteUrl(baseUrl, card.image.src);
    const file = card.file || (card.image.downloadUrl ? {
      id: card.image.downloadUrl,
      name: card.image.name || "image.png",
      mime: card.image.mime || "image/png",
      size: card.image.size || 0,
      downloadUrl: card.image.downloadUrl
    } : undefined);
    return (
      <div className="result-card image-card">
        <h3>{card.title || "Ảnh kết quả"}</h3>
        <button
          type="button"
          className="image-preview-button"
          onClick={() => onOpenImage({ src: imageSrc, title: card.title || "Ảnh kết quả", caption: card.caption, file })}
        >
          <img src={imageSrc} alt={card.image.alt || "Kết quả"} />
        </button>
        {card.caption ? <p>{card.caption}</p> : null}
        {file ? <FileActions file={file} onOpen={onOpenFile} onDownload={onDownloadFile} onShare={onShareFile} /> : null}
      </div>
    );
  }

  if (card.type === "file" && card.file) {
    return (
      <div className="result-card file-card">
        <div className="card-title-row">
          <FileText size={18} />
          <h3>{card.title || "Tệp"}</h3>
        </div>
        <p>{card.message || "Tệp đã sẵn sàng."}</p>
        <div className="file-summary">
          <strong>{card.file.name}</strong>
          <span>{card.file.sizeLabel || `${card.file.size || 0} B`}</span>
        </div>
        <FileActions file={card.file} onOpen={onOpenFile} onDownload={onDownloadFile} onShare={onShareFile} />
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

function FileActions({
  file,
  onOpen,
  onDownload,
  onShare
}: {
  file: RemoteFile;
  onOpen: (file: RemoteFile) => void;
  onDownload: (file: RemoteFile) => void;
  onShare: (file: RemoteFile) => void;
}) {
  return (
    <div className="file-actions">
      <button type="button" className="secondary-button" onClick={() => onOpen(file)}>
        <FileText size={16} />
        Mở
      </button>
      <button type="button" className="secondary-button" onClick={() => onDownload(file)}>
        <Download size={16} />
        Tải về
      </button>
      <button type="button" className="secondary-button" onClick={() => onShare(file)}>
        <Share2 size={16} />
        Chia sẻ
      </button>
    </div>
  );
}

function ImageViewer({
  viewer,
  baseUrl,
  onClose,
  onDownload,
  onShare
}: {
  viewer: ImageViewerState;
  baseUrl: string;
  onClose: () => void;
  onDownload: (file: RemoteFile) => void;
  onShare: (file: RemoteFile) => void;
}) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const pinchRef = useRef<{ distance: number; scale: number } | null>(null);
  const src = absoluteRemoteUrl(baseUrl, viewer.src);
  const zoom = (delta: number) => setScale((value) => Math.min(4, Math.max(0.5, Number((value + delta).toFixed(2)))));
  const pinchDistance = (touches: any) => {
    const first = touches[0];
    const second = touches[1];
    return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
  };
  const reset = () => {
    setScale(1);
    setRotation(0);
  };

  return (
    <div className="viewer-backdrop" role="dialog" aria-modal="true">
      <div className="viewer-top">
        <button type="button" className="icon-button" onClick={onClose} aria-label="Đóng">
          <X size={20} />
        </button>
        <div>
          <strong>{viewer.title}</strong>
          {viewer.caption ? <span>{viewer.caption}</span> : null}
        </div>
      </div>
      <div
        className="viewer-stage"
        onTouchStart={(event) => {
          if (event.touches.length === 2) {
            pinchRef.current = { distance: pinchDistance(event.touches), scale };
          }
        }}
        onTouchMove={(event) => {
          if (event.touches.length === 2 && pinchRef.current) {
            event.preventDefault();
            const next = pinchRef.current.scale * (pinchDistance(event.touches) / pinchRef.current.distance);
            setScale(Math.min(4, Math.max(0.5, Number(next.toFixed(2)))));
          }
        }}
        onTouchEnd={() => {
          pinchRef.current = null;
        }}
      >
        <img
          src={src}
          alt={viewer.title}
          style={{ transform: `scale(${scale}) rotate(${rotation}deg)` }}
          onDoubleClick={() => setScale((value) => (value >= 2 ? 1 : 2))}
          draggable={false}
        />
      </div>
      <div className="viewer-controls">
        <button type="button" onClick={() => zoom(0.25)} aria-label="Phóng to">
          <ZoomIn size={18} />
        </button>
        <button type="button" onClick={() => zoom(-0.25)} aria-label="Thu nhỏ">
          <ZoomOut size={18} />
        </button>
        <button type="button" onClick={() => setRotation((value) => value + 90)} aria-label="Xoay">
          <RotateCcw size={18} />
        </button>
        <button type="button" onClick={reset}>
          Đặt lại
        </button>
        {viewer.file ? (
          <>
            <button type="button" onClick={() => onDownload(viewer.file as RemoteFile)} aria-label="Tải về">
              <Download size={18} />
            </button>
            <button type="button" onClick={() => onShare(viewer.file as RemoteFile)} aria-label="Chia sẻ">
              <Share2 size={18} />
            </button>
          </>
        ) : null}
      </div>
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
