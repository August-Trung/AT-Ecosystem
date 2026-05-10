import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor, CapacitorHttp } from "@capacitor/core";
import {
  BatteryCharging,
  Check,
  ChevronRight,
  Clipboard,
  Cpu,
  Download,
  FileText,
  FolderOpen,
  Hash,
  History,
  KeyRound,
  Laptop,
  Mail,
  Menu,
  MonitorSmartphone,
  Paperclip,
  QrCode,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Share2,
  Shield,
  ShieldCheck,
  Smartphone,
  Trash2,
  WifiOff,
  X,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type ConnectionStep = "checking" | "connect" | "pending" | "connected";
type MessageRole = "user" | "assistant";
type AppView = "chat" | "files" | "permissions";

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
  savedAt?: string;
  storageName?: string;
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
  pending?: boolean;
  time?: string;
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
  view?: AppView;
  action?: "clear-history";
};

type JsonRequestOptions = {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  data?: unknown;
  connectTimeout?: number;
  readTimeout?: number;
};

type ImageViewerState = {
  src: string;
  title: string;
  caption?: string;
  file?: RemoteFile;
};

type HealthPayload = {
  ok?: boolean;
  name?: string;
  status?: string;
  pairCode?: string;
  urls?: string[];
  pairingUrls?: string[];
  deepLinkUrls?: string[];
  staticAppReady?: boolean;
};

type DiscoveredComputer = {
  baseUrl: string;
  name: string;
  pairCode: string;
  status: string;
};

type PermissionGroup = {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
};

const STORAGE_KEY = "atRemoteConnection";
const LAST_ADDRESS_KEY = "atRemoteAddress";
const DEVICE_NAME_KEY = "atRemoteDeviceName";
const CHAT_HISTORY_PREFIX = "atRemoteChatHistory:";
const MAX_STORED_MESSAGES = 120;

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

const isAndroidDevice = () => /android/i.test(navigator.userAgent || "") || Capacitor.getPlatform() === "android";

const pairDeepLink = (base: string, code: string) =>
  `atremote://pair?base=${encodeURIComponent(normalizeBaseUrl(base))}&code=${encodeURIComponent(code || "")}`;

const parsePairUrl = (rawUrl: string) => {
  try {
    const url = new URL(rawUrl);
    if (url.protocol === "atremote:" && url.hostname === "pair") {
      return {
        base: normalizeBaseUrl(url.searchParams.get("base") || ""),
        code: url.searchParams.get("code") || ""
      };
    }
    if (url.searchParams.has("code")) {
      const inferredBase =
        url.port && url.port !== "8765"
          ? `${url.protocol}//${url.hostname}:8765`
          : `${url.protocol}//${url.host}`;
      const base = url.searchParams.get("base") || url.searchParams.get("baseUrl") || inferredBase;
      return {
        base: normalizeBaseUrl(base),
        code: url.searchParams.get("code") || ""
      };
    }
  } catch {
    return null;
  }
  return null;
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

const normalizePrivateIpv4 = (host: string) => {
  const value = String(host || "").trim();
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) return "";
  const parts = value.split(".").map((item) => Number(item));
  if (parts.some((item) => !Number.isInteger(item) || item < 0 || item > 255)) return "";
  return parts.join(".");
};

const subnetFromBaseUrl = (value: string) => {
  try {
    const host = normalizePrivateIpv4(new URL(value).hostname);
    if (!host) return "";
    return host.split(".").slice(0, 3).join(".");
  } catch {
    return "";
  }
};

const discoverySubnets = (base: string) => {
  const preferred = subnetFromBaseUrl(base) || subnetFromBaseUrl(localStorage.getItem(LAST_ADDRESS_KEY) || "") || "192.168.1";
  return Array.from(new Set([preferred, "192.168.1", "192.168.0", "10.0.0", "10.0.1"]));
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
      connectTimeout: options.connectTimeout ?? 5000,
      readTimeout: options.readTimeout ?? 20000
    });
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      data: parseJsonData<T>(response.data)
    };
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), options.readTimeout ?? options.connectTimeout ?? 20000);
  try {
    const response = await fetch(url, {
      method,
      headers,
      body: options.data === undefined ? undefined : JSON.stringify(options.data),
      cache: "no-store",
      signal: controller.signal
    });
    return {
      ok: response.ok,
      status: response.status,
      data: (await response.json()) as T
    };
  } finally {
    window.clearTimeout(timeout);
  }
};

const readChatHistory = (baseUrl: string): ChatMessage[] => {
  try {
    const raw = localStorage.getItem(`${CHAT_HISTORY_PREFIX}${normalizeBaseUrl(baseUrl)}`);
    const parsed = raw ? (JSON.parse(raw) as ChatMessage[]) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => item && !item.pending).slice(-MAX_STORED_MESSAGES) : [];
  } catch {
    return [];
  }
};

const saveChatHistory = (baseUrl: string, messages: ChatMessage[]) => {
  const clean = messages.filter((item) => !item.pending).slice(-MAX_STORED_MESSAGES);
  localStorage.setItem(`${CHAT_HISTORY_PREFIX}${normalizeBaseUrl(baseUrl)}`, JSON.stringify(clean));
};

const clearChatHistory = (baseUrl: string) => {
  localStorage.removeItem(`${CHAT_HISTORY_PREFIX}${normalizeBaseUrl(baseUrl)}`);
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

const timeLabel = () => new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

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

const connectedWelcomeMessage = (): ChatMessage => ({
  id: newId(),
  role: "assistant",
  text: "Đã kết nối với ATAssistant.",
  time: timeLabel(),
  cards: [
    {
      type: "message",
      title: "Đã kết nối",
      message: "Bạn có thể nhập yêu cầu hoặc dùng các nút nhanh."
    }
  ]
});

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
  const [view, setView] = useState<AppView>("chat");
  const [discovering, setDiscovering] = useState(false);
  const [discoveredComputers, setDiscoveredComputers] = useState<DiscoveredComputer[]>([]);
  const [uploads, setUploads] = useState<RemoteFile[]>([]);
  const [uploadsBusy, setUploadsBusy] = useState(false);
  const [uploadsMessage, setUploadsMessage] = useState("");
  const [permissions, setPermissions] = useState<PermissionGroup[]>([]);
  const [permissionsBusy, setPermissionsBusy] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const stepRef = useRef<ConnectionStep>("checking");
  const stickToBottomRef = useRef(true);
  const autoDiscoveryStartedRef = useRef(false);

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

  const applyPairLaunch = useCallback((url: string) => {
    const pair = parsePairUrl(url);
    if (!pair) return false;
    if (pair.base) {
      setBaseUrl(pair.base);
      localStorage.setItem(LAST_ADDRESS_KEY, pair.base);
    }
    if (pair.code) setPairCode(pair.code);
    setConnection(null);
    setConnectionStep("connect");
    setConnectionText("Kết nối với máy tính");
    return true;
  }, [setConnectionStep]);

  useEffect(() => {
    applyPairLaunch(window.location.href);
    if (!Capacitor.isNativePlatform() && isAndroidDevice()) {
      const pair = parsePairUrl(window.location.href);
      const key = pair ? `atRemoteDeepLink:${pair.base}:${pair.code}` : "";
      if (pair?.base && pair.code && sessionStorage.getItem(key) !== "tried") {
        sessionStorage.setItem(key, "tried");
        window.setTimeout(() => {
          window.location.href = pairDeepLink(pair.base, pair.code);
        }, 300);
      }
    }

    if (!Capacitor.isNativePlatform()) return;
    let removeListener: (() => void) | undefined;
    void CapacitorApp.getLaunchUrl().then((result) => {
      if (result?.url) applyPairLaunch(result.url);
    });
    void CapacitorApp.addListener("appUrlOpen", (event) => {
      applyPairLaunch(event.url);
    }).then((handle) => {
      removeListener = () => {
        void handle.remove();
      };
    });
    return () => removeListener?.();
  }, [applyPairLaunch]);

  const enterConnected = useCallback((saved: SavedConnection) => {
    saveConnection(saved);
    setConnection(saved);
    setPairRequestId("");
    setConnectionStep("connected");
    setConnectionText("Đã kết nối");
    setView("chat");
    const history = readChatHistory(saved.baseUrl);
    setMessages((current) =>
      current.length
        ? current
        : history.length
          ? history
        : [connectedWelcomeMessage()]
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
    if (!stickToBottomRef.current) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!connection?.baseUrl || messages.length === 0) return;
    saveChatHistory(connection.baseUrl, messages);
  }, [connection?.baseUrl, messages]);

  useEffect(() => {
    if (!connection?.baseUrl || messages.length > 0) return;
    const history = readChatHistory(connection.baseUrl);
    setMessages(history.length ? history : [connectedWelcomeMessage()]);
  }, [connection?.baseUrl, messages.length]);

  const handleConversationScroll = () => {
    const element = listRef.current;
    if (!element) return;
    stickToBottomRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 120;
  };

  useEffect(() => {
    if (step !== "pending" || !pairRequestId) return;
    let stopped = false;
    const poll = async () => {
      try {
        const response = await requestJson<Record<string, unknown>>(
          `${baseUrl}/api/pair/status?requestId=${encodeURIComponent(pairRequestId)}`,
          { connectTimeout: 2500, readTimeout: 5000 }
        );
        if (stopped) return;
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
        if (!stopped) setConnectionText("Đang chờ xác nhận trên ATAssistant");
      }
    };
    void poll();
    const id = window.setInterval(poll, 900);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
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
        data: { deviceName, pairCode },
        connectTimeout: 3500,
        readTimeout: 7000
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
    setView("chat");
    setConnectionStep("connect");
    setConnectionText("Kết nối với máy tính");
  };

  const scanForComputers = useCallback(async () => {
    if (discovering) return;
    setDiscovering(true);
    setDiscoveredComputers([]);
    setConnectionText("Đang tìm máy tính trong WiFi");
    const found: DiscoveredComputer[] = [];
    const seen = new Set<string>();
    const remember = (item: DiscoveredComputer) => {
      if (seen.has(item.baseUrl)) return;
      seen.add(item.baseUrl);
      found.push(item);
      setDiscoveredComputers([...found]);
      if (found.length === 1) {
        setBaseUrl(item.baseUrl);
        if (item.pairCode) setPairCode(item.pairCode);
        localStorage.setItem(LAST_ADDRESS_KEY, item.baseUrl);
      }
    };
    const probe = async (candidate: string) => {
      try {
        const response = await requestJson<HealthPayload>(`${candidate}/api/health`, {
          connectTimeout: 650,
          readTimeout: 900
        });
        const data = response.data;
        if (response.ok && data?.ok && String(data.name || "").toLowerCase().includes("atassistant")) {
          remember({
            baseUrl: candidate,
            name: data.name || "ATAssistant",
            pairCode: String(data.pairCode || ""),
            status: data.status || "ready"
          });
        }
      } catch {
        // Không hiện lỗi từng địa chỉ; người dùng chỉ cần thấy máy nào tìm được.
      }
    };
    try {
      for (const subnet of discoverySubnets(baseUrl)) {
        const hosts = Array.from({ length: 254 }, (_, index) => `http://${subnet}.${index + 1}:8765`);
        let cursor = 0;
        const workers = Array.from({ length: 28 }, async () => {
          while (cursor < hosts.length && found.length < 5) {
            const next = hosts[cursor];
            cursor += 1;
            await probe(next);
          }
        });
        await Promise.all(workers);
        if (found.length > 0) break;
      }
      if (found.length === 0) {
        setConnectionText("Không kết nối được với máy tính");
      } else {
        setConnectionText("Đã tìm thấy máy tính");
      }
    } finally {
      setDiscovering(false);
    }
  }, [baseUrl, discovering]);

  useEffect(() => {
    if (step !== "connect" || connection || autoDiscoveryStartedRef.current) return;
    autoDiscoveryStartedRef.current = true;
    void scanForComputers();
  }, [connection, scanForComputers, step]);

  const appendAssistantError = (text: string) => {
    setMessages((current) => [
      ...current,
      {
        id: newId(),
        role: "assistant",
        text,
        status: "error",
        time: timeLabel(),
        cards: [{ type: "error", title: "Mất kết nối", message: text }],
        buttons: [{ label: "Thử lại", command: "__retry__" }]
      }
    ]);
  };

  const replaceMessage = (id: string, next: Omit<ChatMessage, "id" | "role">) => {
    setMessages((current) =>
      current.map((message) =>
        message.id === id
          ? {
              ...message,
              ...next,
              pending: next.pending ?? false,
              time: next.time || message.time || timeLabel()
            }
          : message
      )
    );
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

  const loadUploads = useCallback(async () => {
    if (!connection) return;
    setUploadsBusy(true);
    setUploadsMessage("");
    try {
      const response = await requestJson<{ ok: boolean; files: RemoteFile[]; message?: string }>(
        `${connection.baseUrl}/api/uploads`,
        { headers: { "X-AT-Remote-Key": connection.authKey } }
      );
      if (!response.ok || !response.data.ok) throw new Error(response.data.message || friendlyFetchError());
      setUploads(response.data.files || []);
      setUploadsMessage((response.data.files || []).length ? "" : "Chưa có tệp nào được gửi từ điện thoại.");
    } catch (error) {
      setUploadsMessage(friendlyConnectionError(error));
    } finally {
      setUploadsBusy(false);
    }
  }, [connection]);

  const deleteUpload = useCallback(async (file: RemoteFile) => {
    if (!connection) return;
    setUploadsBusy(true);
    try {
      const response = await requestJson<{ ok: boolean; message?: string }>(`${connection.baseUrl}/api/uploads/delete`, {
        method: "POST",
        headers: { "X-AT-Remote-Key": connection.authKey },
        data: { name: file.storageName || file.name }
      });
      if (!response.ok || !response.data.ok) throw new Error(response.data.message || "Chưa xóa được tệp.");
      setUploadsMessage("Đã xóa tệp.");
      await loadUploads();
    } catch (error) {
      setUploadsMessage(friendlyConnectionError(error));
    } finally {
      setUploadsBusy(false);
    }
  }, [connection, loadUploads]);

  const openUploadFolder = useCallback(async () => {
    if (!connection) return;
    setUploadsBusy(true);
    try {
      const response = await requestJson<{ ok: boolean; message?: string }>(
        `${connection.baseUrl}/api/uploads/open-folder`,
        { method: "POST", headers: { "X-AT-Remote-Key": connection.authKey } }
      );
      if (!response.ok || !response.data.ok) throw new Error(response.data.message || "Chưa mở được thư mục.");
      setUploadsMessage(response.data.message || "Đã mở thư mục trên máy tính.");
    } catch (error) {
      setUploadsMessage(friendlyConnectionError(error));
    } finally {
      setUploadsBusy(false);
    }
  }, [connection]);

  const loadPermissions = useCallback(async () => {
    if (!connection) return;
    setPermissionsBusy(true);
    try {
      const response = await requestJson<{ ok: boolean; groups: PermissionGroup[]; message?: string }>(
        `${connection.baseUrl}/api/permissions`,
        { headers: { "X-AT-Remote-Key": connection.authKey } }
      );
      if (!response.ok || !response.data.ok) throw new Error(response.data.message || friendlyFetchError());
      setPermissions(response.data.groups || []);
    } catch {
      setPermissions([]);
    } finally {
      setPermissionsBusy(false);
    }
  }, [connection]);

  useEffect(() => {
    if (view === "files") void loadUploads();
    if (view === "permissions") void loadPermissions();
  }, [loadPermissions, loadUploads, view]);

  const uploadFile = async (file: File, command: string) => {
    if (!connection) {
      setConnectionStep("connect");
      return;
    }
    stickToBottomRef.current = true;
    setView("chat");
    const pendingId = newId();
    setBusy(true);
    setDraft("");
    setLastCommand(command.trim());
    setMessages((current) => [
      ...current,
      {
        id: newId(),
        role: "user",
        text: command.trim() ? `${command.trim()}\nTệp: ${file.name}` : `Gửi tệp: ${file.name}`,
        time: timeLabel()
      },
      {
        id: pendingId,
        role: "assistant",
        text: "Đang gửi tệp...",
        pending: true,
        time: timeLabel()
      }
    ]);
    try {
      const dataBase64 = await fileToBase64(file);
      replaceMessage(pendingId, { text: "Đang xử lý tệp...", pending: true });
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
      replaceMessage(pendingId, {
        text: data.message,
        cards: data.cards,
        buttons: data.buttons,
        status: data.status
      });
      if (view === "files") void loadUploads();
      setConnectionText("Đã kết nối");
    } catch (error) {
      const text = friendlyConnectionError(error);
      replaceMessage(pendingId, {
        text,
        status: "error",
        cards: [{ type: "error", title: "Mất kết nối", message: text }],
        buttons: [{ label: "Thử lại", command: "__retry__" }]
      });
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
    stickToBottomRef.current = true;
    setView("chat");
    const pendingId = newId();
    setLastCommand(clean);
    setDraft("");
    setMessages((current) => [
      ...current,
      { id: newId(), role: "user", text: clean, time: timeLabel() },
      { id: pendingId, role: "assistant", text: "Đang xử lý...", pending: true, time: timeLabel() }
    ]);
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
      replaceMessage(pendingId, {
        text: data.message,
        cards: data.cards,
        buttons: data.buttons,
        status: data.status
      });
      setConnectionText("Đã kết nối");
    } catch (error) {
      const text = friendlyConnectionError(error);
      replaceMessage(pendingId, {
        text,
        status: "error",
        cards: [{ type: "error", title: "Mất kết nối", message: text }],
        buttons: [{ label: "Thử lại", command: "__retry__" }]
      });
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
      { label: "Trạng thái máy", icon: Cpu, command: "trạng thái máy" },
      { label: "Tệp đã gửi", icon: FolderOpen, view: "files" },
      { label: "Quyền điều khiển", icon: Shield, view: "permissions" },
      { label: "Xóa lịch sử", icon: History, action: "clear-history" }
    ],
    []
  );

  const runQuickAction = (action: QuickAction) => {
    setShowQuickActions(false);
    if (action.view) {
      setView(action.view);
      return;
    }
    if (action.action === "clear-history" && connection) {
      clearChatHistory(connection.baseUrl);
      setMessages([]);
      setView("chat");
      return;
    }
    setView("chat");
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

  const viewTitle = view === "files" ? "Tệp đã gửi" : view === "permissions" ? "Quyền điều khiển" : "Kết quả";

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
          <p className="lead">AT Remote sẽ tự tìm máy tính đang bật ATAssistant trong cùng WiFi. Nếu chưa thấy, bạn vẫn có thể nhập địa chỉ dưới mã kết nối trên máy tính.</p>

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
              <button type="button" className="scan-button" onClick={scanForComputers} disabled={discovering}>
                {discovering ? <RefreshCw className="spin" size={18} /> : <Search size={18} />}
                {discovering ? "Đang tìm máy tính" : "Tìm máy tính trong WiFi"}
              </button>
              {discoveredComputers.length > 0 ? (
                <div className="computer-list">
                  {discoveredComputers.map((computer) => (
                    <button
                      type="button"
                      key={computer.baseUrl}
                      className={normalizeBaseUrl(baseUrl) === computer.baseUrl ? "selected" : ""}
                      onClick={() => {
                        setBaseUrl(computer.baseUrl);
                        if (computer.pairCode) setPairCode(computer.pairCode);
                        localStorage.setItem(LAST_ADDRESS_KEY, computer.baseUrl);
                      }}
                    >
                      <Laptop size={18} />
                      <span>
                        <strong>{computer.name}</strong>
                        <small>{computer.baseUrl}</small>
                      </span>
                      {normalizeBaseUrl(baseUrl) === computer.baseUrl ? <Check size={18} /> : null}
                    </button>
                  ))}
                </div>
              ) : null}
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
            <h1>{viewTitle}</h1>
          </div>
        </div>
        <button className={`connection-badge ${statusTone}`} onClick={checkHealth}>
          {connectionText === "Mất kết nối" ? <WifiOff size={16} /> : <Check size={16} />}
          {connectionText === "Mất kết nối" ? "Mất kết nối" : "Đã kết nối"}
        </button>
      </header>

      <section className={`conversation ${view !== "chat" ? "panel-view" : ""}`} ref={listRef} onScroll={handleConversationScroll}>
        {view === "files" ? (
          <FilesView
            files={uploads}
            busy={uploadsBusy}
            message={uploadsMessage}
            onRefresh={loadUploads}
            onOpenFolder={openUploadFolder}
            onOpenFile={openRemoteFile}
            onDownloadFile={downloadRemoteFile}
            onShareFile={shareRemoteFile}
            onDeleteFile={deleteUpload}
          />
        ) : view === "permissions" ? (
          <PermissionsView
            groups={permissions}
            busy={permissionsBusy}
            onRefresh={loadPermissions}
            onDisconnect={disconnect}
          />
        ) : messages.length === 0 ? (
          <div className="empty-state">
            <MonitorSmartphone size={42} />
            <h2>Nhập yêu cầu</h2>
            <p>ATAssistant sẽ xử lý trên máy tính và trả kết quả về đây.</p>
          </div>
        ) : (
          messages.map((message) => (
            <article key={message.id} className={`message ${message.role}`}>
              <div className={`message-bubble ${message.pending ? "pending" : ""}`}>
                <p className="message-text">{message.text}</p>
                <div className="message-meta">
                  {message.pending ? <RefreshCw className="spin" size={12} /> : null}
                  <span>{message.pending ? "Đang xử lý" : message.time}</span>
                </div>
              </div>
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

function FilesView({
  files,
  busy,
  message,
  onRefresh,
  onOpenFolder,
  onOpenFile,
  onDownloadFile,
  onShareFile,
  onDeleteFile
}: {
  files: RemoteFile[];
  busy: boolean;
  message: string;
  onRefresh: () => void;
  onOpenFolder: () => void;
  onOpenFile: (file: RemoteFile) => void;
  onDownloadFile: (file: RemoteFile) => void;
  onShareFile: (file: RemoteFile) => void;
  onDeleteFile: (file: RemoteFile) => void;
}) {
  return (
    <div className="library-panel">
      <div className="panel-toolbar">
        <button type="button" className="secondary-button" onClick={onRefresh} disabled={busy}>
          <RefreshCw className={busy ? "spin" : ""} size={16} />
          Làm mới
        </button>
        <button type="button" className="secondary-button" onClick={onOpenFolder} disabled={busy}>
          <FolderOpen size={16} />
          Mở thư mục
        </button>
      </div>
      {message ? <p className="panel-message">{message}</p> : null}
      {files.length === 0 ? (
        <div className="empty-state compact">
          <FileText size={36} />
          <h2>Chưa có tệp</h2>
          <p>Tệp gửi từ điện thoại lên máy tính sẽ nằm ở đây.</p>
        </div>
      ) : (
        <div className="file-list">
          {files.map((file) => (
            <article className="file-row" key={`${file.storageName || file.name}-${file.savedAt || file.id}`}>
              <div className="file-summary">
                <strong>{file.name}</strong>
                <span>{file.sizeLabel || `${file.size || 0} B`}</span>
              </div>
              <div className="file-actions four">
                <button type="button" className="secondary-button" onClick={() => onOpenFile(file)}>
                  <FileText size={16} />
                  Mở
                </button>
                <button type="button" className="secondary-button" onClick={() => onDownloadFile(file)}>
                  <Download size={16} />
                  Tải về
                </button>
                <button type="button" className="secondary-button" onClick={() => onShareFile(file)}>
                  <Share2 size={16} />
                  Chia sẻ
                </button>
                <button type="button" className="danger-soft-button" onClick={() => onDeleteFile(file)}>
                  <Trash2 size={16} />
                  Xóa
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function PermissionsView({
  groups,
  busy,
  onRefresh,
  onDisconnect
}: {
  groups: PermissionGroup[];
  busy: boolean;
  onRefresh: () => void;
  onDisconnect: () => void;
}) {
  return (
    <div className="permission-panel">
      <div className="panel-toolbar">
        <button type="button" className="secondary-button" onClick={onRefresh} disabled={busy}>
          <RefreshCw className={busy ? "spin" : ""} size={16} />
          Làm mới
        </button>
        <button type="button" className="secondary-button" onClick={onDisconnect}>
          <MonitorSmartphone size={16} />
          Kết nối máy khác
        </button>
      </div>
      <p className="panel-message">Quyền được bật hoặc tắt trong cửa sổ Kết nối điện thoại trên ATAssistant.</p>
      <div className="permission-list">
        {groups.length === 0 ? (
          <div className="empty-state compact">
            <Shield size={36} />
            <h2>Chưa đọc được quyền</h2>
            <p>Hãy thử làm mới khi điện thoại và máy tính cùng WiFi.</p>
          </div>
        ) : (
          groups.map((group) => (
            <article className={`permission-row ${group.enabled ? "enabled" : "disabled"}`} key={group.key}>
              <div>
                <h3>{group.label}</h3>
                <p>{group.description}</p>
              </div>
              <span>{group.enabled ? "Đang bật" : "Đang tắt"}</span>
            </article>
          ))
        )}
      </div>
    </div>
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
