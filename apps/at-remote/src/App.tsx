import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor, CapacitorHttp, registerPlugin } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
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
  Repeat2,
  RotateCcw,
  Save,
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
type AppView = "chat" | "files" | "permissions" | "commands";

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

type SharedPayload = {
  ok?: boolean;
  type?: "text" | "file";
  text?: string;
  subject?: string;
  name?: string;
  mime?: string;
  size?: number;
  dataBase64?: string;
  message?: string;
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

type CommandUsage = {
  command: string;
  count: number;
  lastUsed: number;
};

type MacroAction = {
  label: string;
  command: string;
};

type ToastState = {
  text: string;
  tone: "success" | "warning" | "error";
};

type SystemStatusItem = {
  label: string;
  value: string;
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
  tailscaleUrls?: string[];
  tailscalePairingUrls?: string[];
  networkAddresses?: Array<{ address?: string; kind?: string; label?: string; adapter?: string }>;
  staticAppReady?: boolean;
};

type DiscoveredComputer = {
  baseUrl: string;
  name: string;
  pairCode: string;
  status: string;
  kind?: string;
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
const BRAND_LOGO_SRC = "/brand-logo.png";
const BRAND_SPLASH_SRC = "/splash-mobile.webp";
const CHAT_HISTORY_PREFIX = "atRemoteChatHistory:";
const COMMAND_USAGE_PREFIX = "atRemoteCommandUsage:";
const MACRO_STORAGE_KEY = "atRemoteMacros";
const PINNED_COMMANDS_KEY = "atRemotePinnedCommands";
const MAX_STORED_MESSAGES = 120;
const MAX_STORED_COMMANDS = 36;
const MAX_COMMAND_SUGGESTIONS = 6;
const BRAND_INTRO_HOLD_MS = 920;
const BRAND_INTRO_FADE_MS = 260;

const ShareReceiver = registerPlugin<{
  getSharedPayload: () => Promise<SharedPayload>;
  clearSharedPayload: () => Promise<{ ok: boolean }>;
}>("ShareReceiver");

const BASE_COMMAND_SUGGESTIONS = [
  "help",
  "trạng thái máy",
  "máy đang chạy gì",
  "cửa sổ đang mở",
  "mở chrome",
  "mở youtube nhạc chill",
  "tìm youtube nhạc học bài",
  "chuyển bài youtube",
  "tạm dừng youtube",
  "tăng âm lượng youtube",
  "giảm âm lượng youtube",
  "chụp màn hình",
  "click giữa màn hình",
  "click góc dưới phải",
  "nhập text Xin chào",
  "gửi text Xin chào",
  "chọn ô comment TikTok",
  "nhắn Chào mọi người",
  "giữ phím L",
  "giữ space 3 giây",
  "thả L",
  "thả hết phím",
  "ctrl a",
  "enter",
  "esc",
  "tải lại trang",
  "mở tab mới",
  "đóng tab hiện tại",
  "tab kế tiếp",
  "quay lại trang",
  "mở temp mail",
  "tạo temp mail mới",
  "tạo qr https://example.com trong mmo",
  "tạo mật khẩu trong mmo",
  "hash sha256 nội dung trong mmo",
  "đóng app nặng",
  "đóng web giải trí",
  "đóng tất cả trừ chrome và vscode",
  "tắt máy sau 30 phút",
  "khóa máy",
  "sleep máy",
  "bật chế độ ngủ quên sau 45 phút từ 23 đến 6",
  "trạng thái chế độ ngủ quên",
  "tắt chế độ ngủ quên"
];

const COMMON_COMMAND_FIXES = [
  "thả hết phím",
  "tắt máy sau 30 phút",
  "trạng thái máy",
  "chụp màn hình",
  "giữ phím L",
  "giữ space 3 giây",
  "đóng app nặng",
  "đóng tất cả trừ chrome và vscode"
];

const CONTEXT_COMMAND_SUGGESTIONS: Array<{ match: string[]; commands: string[] }> = [
  { match: ["giu", "giu phim"], commands: ["giữ phím L", "giữ space 3 giây", "giữ ctrl shift"] },
  { match: ["tha", "tha phim"], commands: ["thả L", "thả hết phím", "thả ctrl shift"] },
  { match: ["tat", "tat may"], commands: ["tắt máy sau 30 phút", "tắt máy lúc 23h30", "tắt chế độ ngủ quên"] },
  { match: ["chup", "chup man"], commands: ["chụp màn hình"] },
  { match: ["trang thai", "may"], commands: ["trạng thái máy", "máy đang chạy gì"] },
  { match: ["youtube", "nhac"], commands: ["mở youtube nhạc chill", "chuyển bài youtube", "tạm dừng youtube"] },
  { match: ["dong"], commands: ["đóng app nặng", "đóng web giải trí", "đóng tất cả trừ chrome và vscode"] }
];

const DEFAULT_MACRO_ACTIONS: MacroAction[] = [
  { label: "Đi ngủ", command: "đi ngủ" },
  { label: "Về nhà", command: "về nhà" },
  { label: "Dọn máy", command: "dọn máy" },
  { label: "Tập trung", command: "tập trung" }
];

const DEFAULT_PINNED_COMMANDS = ["trạng thái máy", "chụp màn hình", "chuyển bài youtube", "thả hết phím"];

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

const commandDeepLink = (command: string) =>
  `atremote://command?text=${encodeURIComponent(command.trim())}`;

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

const parseCommandUrl = (rawUrl: string) => {
  try {
    const url = new URL(rawUrl);
    if (url.protocol === "atremote:" && url.hostname === "command") {
      return (url.searchParams.get("text") || url.searchParams.get("command") || "").trim();
    }
    return (url.searchParams.get("command") || "").trim();
  } catch {
    return "";
  }
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

const isTailscaleIpv4 = (host: string) => {
  const value = normalizePrivateIpv4(host);
  if (!value) return false;
  const [, second] = value.split(".").map((item) => Number(item));
  return value.startsWith("100.") && second >= 64 && second <= 127;
};

const isTailscaleBaseUrl = (value: string) => {
  try {
    return isTailscaleIpv4(new URL(value).hostname);
  } catch {
    return false;
  }
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
  "Không kết nối được với máy tính. Hãy mở ATAssistant và dùng cùng WiFi hoặc bật Tailscale trên cả điện thoại và máy tính.";

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

const foldCommand = (value: string) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");

const usageKey = (baseUrl: string) => `${COMMAND_USAGE_PREFIX}${normalizeBaseUrl(baseUrl)}`;

const readCommandUsage = (baseUrl: string): CommandUsage[] => {
  try {
    const raw = localStorage.getItem(usageKey(baseUrl));
    const parsed = raw ? (JSON.parse(raw) as CommandUsage[]) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item.command === "string" && item.command.trim())
      .map((item) => ({
        command: item.command.trim(),
        count: Number.isFinite(Number(item.count)) ? Number(item.count) : 1,
        lastUsed: Number.isFinite(Number(item.lastUsed)) ? Number(item.lastUsed) : 0
      }))
      .sort((left, right) => right.count - left.count || right.lastUsed - left.lastUsed)
      .slice(0, MAX_STORED_COMMANDS);
  } catch {
    return [];
  }
};

const saveCommandUsage = (baseUrl: string, usage: CommandUsage[]) => {
  localStorage.setItem(usageKey(baseUrl), JSON.stringify(usage.slice(0, MAX_STORED_COMMANDS)));
};

const rememberCommandUsage = (baseUrl: string, command: string) => {
  const clean = command.trim();
  if (!clean || clean === "__retry__") return readCommandUsage(baseUrl);
  const folded = foldCommand(clean);
  const usage = readCommandUsage(baseUrl);
  const index = usage.findIndex((item) => foldCommand(item.command) === folded);
  if (index >= 0) {
    usage[index] = {
      ...usage[index],
      command: clean,
      count: usage[index].count + 1,
      lastUsed: Date.now()
    };
  } else {
    usage.push({ command: clean, count: 1, lastUsed: Date.now() });
  }
  usage.sort((left, right) => right.count - left.count || right.lastUsed - left.lastUsed);
  const next = usage.slice(0, MAX_STORED_COMMANDS);
  saveCommandUsage(baseUrl, next);
  return next;
};

const normalizeMacros = (items: MacroAction[]) =>
  items
    .map((item, index) => ({
      label: String(item.label || DEFAULT_MACRO_ACTIONS[index]?.label || `Macro ${index + 1}`).trim(),
      command: String(item.command || DEFAULT_MACRO_ACTIONS[index]?.command || "").trim()
    }))
    .filter((item) => item.label && item.command)
    .slice(0, 8);

const readMacros = (): MacroAction[] => {
  try {
    const raw = localStorage.getItem(MACRO_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as MacroAction[]) : [];
    return normalizeMacros(Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_MACRO_ACTIONS);
  } catch {
    return DEFAULT_MACRO_ACTIONS;
  }
};

const saveMacros = (items: MacroAction[]) => {
  const clean = normalizeMacros(items);
  localStorage.setItem(MACRO_STORAGE_KEY, JSON.stringify(clean));
  return clean;
};

const readPinnedCommands = (): string[] => {
  try {
    const raw = localStorage.getItem(PINNED_COMMANDS_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return (Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_PINNED_COMMANDS)
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .slice(0, 12);
  } catch {
    return DEFAULT_PINNED_COMMANDS;
  }
};

const savePinnedCommands = (items: string[]) => {
  const seen = new Set<string>();
  const clean = items
    .map((item) => String(item || "").trim())
    .filter((item) => {
      const folded = foldCommand(item);
      if (!folded || seen.has(folded)) return false;
      seen.add(folded);
      return true;
    })
    .slice(0, 12);
  localStorage.setItem(PINNED_COMMANDS_KEY, JSON.stringify(clean));
  return clean;
};

const isRiskyCommand = (command: string) => {
  const folded = foldCommand(command);
  return /(^|\s)(tat may|shutdown|khoi dong lai|restart|sleep|hibernate|xoa|delete|dong tat ca|dong app nang|don may)(\s|$)/i.test(
    folded
  );
};

const extractSystemStatusItems = (cards?: MobileCard[]) => {
  const status = (cards || []).find((card) => card.type === "system_status");
  return (status?.items || []).map((item) => ({ label: item.label, value: item.value }));
};

const buildCommandSuggestions = (
  draft: string,
  usage: CommandUsage[],
  quickActions: QuickAction[],
  macros: MacroAction[],
  pinnedCommands: string[]
) => {
  const query = draft.trim();
  if (!query) return [];
  const foldedQuery = foldCommand(query);
  const seen = new Set<string>();
  const contextCandidates = CONTEXT_COMMAND_SUGGESTIONS.filter((group) =>
    group.match.some((match) => match.startsWith(foldedQuery) || foldedQuery.startsWith(match))
  ).flatMap((group) => group.commands);
  const candidates = [
    ...contextCandidates,
    ...COMMON_COMMAND_FIXES,
    ...usage.map((item) => item.command),
    ...quickActions.map((action) => action.command || ""),
    ...macros.map((action) => action.command),
    ...pinnedCommands,
    ...BASE_COMMAND_SUGGESTIONS
  ].filter((item): item is string => Boolean(item && item.trim()));

  return candidates
    .map((command, index) => {
      const clean = command.trim();
      const folded = foldCommand(clean);
      const sameVisibleText = clean.toLocaleLowerCase("vi-VN") === query.toLocaleLowerCase("vi-VN");
      if (!folded || (folded === foldedQuery && sameVisibleText) || seen.has(folded)) return null;
      seen.add(folded);
      const usageItem = usage.find((item) => foldCommand(item.command) === folded);
      const contextIndex = contextCandidates.findIndex((item) => foldCommand(item) === folded);
      const fixIndex = COMMON_COMMAND_FIXES.findIndex((item) => foldCommand(item) === folded);
      const starts = folded.startsWith(foldedQuery);
      const contains = folded.includes(foldedQuery);
      const correctionMatch = folded === foldedQuery && !sameVisibleText;
      if (!starts && !contains && !correctionMatch) return null;
      return {
        command: clean,
        score:
          (correctionMatch ? -80 : contextIndex >= 0 ? -50 + contextIndex : fixIndex >= 0 ? -30 + fixIndex : starts ? 0 : 20) -
          (usageItem?.count || 0) +
          index / 1000
      };
    })
    .filter((item): item is { command: string; score: number } => Boolean(item))
    .sort((left, right) => left.score - right.score)
    .slice(0, MAX_COMMAND_SUGGESTIONS)
    .map((item) => item.command);
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

const blobToBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      resolve(value.includes(",") ? value.split(",", 2)[1] : value);
    };
    reader.onerror = () => reject(reader.error || new Error("Không đọc được tệp."));
    reader.readAsDataURL(blob);
  });

const safeShareFileName = (name: string) =>
  (String(name || "at-remote-file").replace(/[\\/:*?"<>|\x00-\x1f]+/g, "_").trim() || "at-remote-file").slice(0, 120);

const previewText = (value: string, limit = 180) => {
  const clean = String(value || "").replace(/\s+/g, " ").trim();
  return clean.length > limit ? `${clean.slice(0, limit - 3)}...` : clean;
};

const isImageFile = (file: RemoteFile) =>
  String(file.mime || "").toLowerCase().startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name || "");

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
  const [commandUsage, setCommandUsage] = useState<CommandUsage[]>([]);
  const [macros, setMacros] = useState<MacroAction[]>(readMacros());
  const [pinnedCommands, setPinnedCommands] = useState<string[]>(readPinnedCommands());
  const [lastStatusItems, setLastStatusItems] = useState<SystemStatusItem[]>([]);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [pendingLaunchCommand, setPendingLaunchCommand] = useState(parseCommandUrl(window.location.href));
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [imageViewer, setImageViewer] = useState<ImageViewerState | null>(null);
  const [view, setView] = useState<AppView>("chat");
  const [discovering, setDiscovering] = useState(false);
  const [showBrandIntro, setShowBrandIntro] = useState(true);
  const [brandIntroLeaving, setBrandIntroLeaving] = useState(false);
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
  const handledLaunchUrlsRef = useRef(new Set<string>());
  const sharedPayloadBusyRef = useRef(false);

  const setConnectionStep = useCallback((next: ConnectionStep) => {
    stepRef.current = next;
    setStep(next);
  }, []);

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  useEffect(() => {
    const leavingId = window.setTimeout(() => setBrandIntroLeaving(true), BRAND_INTRO_HOLD_MS);
    const doneId = window.setTimeout(() => setShowBrandIntro(false), BRAND_INTRO_HOLD_MS + BRAND_INTRO_FADE_MS);
    return () => {
      window.clearTimeout(leavingId);
      window.clearTimeout(doneId);
    };
  }, []);

  const activeBaseUrl = connection?.baseUrl || baseUrl;
  const statusTone =
    connectionText === "Mất kết nối" ? "lost" : connectionText === "Đã kết nối" ? "ready" : "neutral";

  const showToast = useCallback((text: string, tone: ToastState["tone"] = "success") => {
    setToast({ text, tone });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(id);
  }, [toast]);

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

  const applyCommandLaunch = useCallback((url: string) => {
    const command = parseCommandUrl(url);
    if (!command) return false;
    setPendingLaunchCommand(command);
    setDraft(command);
    setShowQuickActions(false);
    setView("chat");
    return true;
  }, []);

  const handleLaunchUrl = useCallback((url: string) => {
    if (!url || handledLaunchUrlsRef.current.has(url)) return;
    handledLaunchUrlsRef.current.add(url);
    if (applyCommandLaunch(url)) return;
    applyPairLaunch(url);
  }, [applyCommandLaunch, applyPairLaunch]);

  useEffect(() => {
    handleLaunchUrl(window.location.href);
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
      if (result?.url) handleLaunchUrl(result.url);
    });
    void CapacitorApp.addListener("appUrlOpen", (event) => {
      handleLaunchUrl(event.url);
    }).then((handle) => {
      removeListener = () => {
        void handle.remove();
      };
    });
    return () => removeListener?.();
  }, [handleLaunchUrl]);

  const enterConnected = useCallback((saved: SavedConnection) => {
    saveConnection(saved);
    setConnection(saved);
    setPairRequestId("");
    setConnectionStep("connected");
    setConnectionText("Đã kết nối");
    setView("chat");
    setCommandUsage(readCommandUsage(saved.baseUrl));
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

  useEffect(() => {
    setCommandUsage(connection?.baseUrl ? readCommandUsage(connection.baseUrl) : []);
  }, [connection?.baseUrl]);

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
    setCommandUsage([]);
    setView("chat");
    setConnectionStep("connect");
    setConnectionText("Kết nối với máy tính");
  };

  const scanForComputers = useCallback(async () => {
    if (discovering) return;
    setDiscovering(true);
    setDiscoveredComputers([]);
    setConnectionText("Đang tìm máy tính");
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
            status: data.status || "ready",
            kind: isTailscaleBaseUrl(candidate) ? "tailscale" : "lan"
          });
        }
      } catch {
        // Không hiện lỗi từng địa chỉ; người dùng chỉ cần thấy máy nào tìm được.
      }
    };
    try {
      const savedBase = normalizeBaseUrl(baseUrl || localStorage.getItem(LAST_ADDRESS_KEY) || "");
      if (savedBase) {
        await probe(savedBase);
      }
      if (found.length === 0 && isTailscaleBaseUrl(savedBase)) {
        setConnectionText("Không tìm thấy máy tính qua Tailscale");
        return;
      }
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
        if (Capacitor.isNativePlatform()) {
          const safeName = safeShareFileName(file.name);
          const cachePath = `${Date.now()}-${safeName}`;
          await Filesystem.writeFile({
            path: cachePath,
            data: await blobToBase64(blob),
            directory: Directory.Cache
          });
          const uri = await Filesystem.getUri({ path: cachePath, directory: Directory.Cache });
          await Share.share({
            title: file.name,
            text: file.name,
            files: [uri.uri],
            dialogTitle: "Chia sẻ"
          });
          return;
        }
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
    async (file: RemoteFile) => {
      if (isImageFile(file)) {
        try {
          const blob = await fetchRemoteFile(file);
          setImageViewer({
            src: URL.createObjectURL(blob),
            title: file.name || "Ảnh kết quả",
            file
          });
          return;
        } catch {
          setImageViewer({
            src: remoteFileUrl(file),
            title: file.name || "Ảnh kết quả",
            file
          });
          return;
        }
      }
      const url = remoteFileUrl(file);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    },
    [fetchRemoteFile, remoteFileUrl]
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
      const statusItems = extractSystemStatusItems(data.cards);
      if (statusItems.length) setLastStatusItems(statusItems);
      if (command.trim() && data.status !== "error") {
        setCommandUsage(rememberCommandUsage(connection.baseUrl, command.trim()));
      }
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

  const uploadSharedFilePayload = useCallback(async (payload: SharedPayload) => {
    if (!connection || !payload.dataBase64) return false;
    stickToBottomRef.current = true;
    setView("chat");
    const pendingId = newId();
    const name = payload.name || "android-share";
    setBusy(true);
    setMessages((current) => [
      ...current,
      { id: newId(), role: "user", text: `Gửi từ Android Share\nTệp: ${name}`, time: timeLabel() },
      { id: pendingId, role: "assistant", text: "Đang gửi sang máy tính...", pending: true, time: timeLabel() }
    ]);
    try {
      const response = await requestJson<CommandResult>(`${connection.baseUrl}/api/upload`, {
        method: "POST",
        headers: { "X-AT-Remote-Key": connection.authKey },
        data: {
          name,
          mime: payload.mime || "application/octet-stream",
          size: payload.size || 0,
          command: "",
          dataBase64: payload.dataBase64
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
      const statusItems = extractSystemStatusItems(data.cards);
      if (statusItems.length) setLastStatusItems(statusItems);
      setConnectionText("Đã kết nối");
      showToast(`Đã gửi tệp: ${name}`, "success");
      if (view === "files") void loadUploads();
      return true;
    } catch (error) {
      const text = friendlyConnectionError(error);
      replaceMessage(pendingId, {
        text,
        status: "error",
        cards: [{ type: "error", title: "Mất kết nối", message: text }],
        buttons: [{ label: "Thử lại", command: "__retry__" }]
      });
      setConnectionText("Mất kết nối");
      showToast(text, "error");
      return false;
    } finally {
      setBusy(false);
    }
  }, [connection, loadUploads, showToast, view]);

  const shareTextToDesktop = useCallback(async (payload: SharedPayload) => {
    if (!connection || !payload.text?.trim()) return false;
    const textToShare = payload.text.trim();
    stickToBottomRef.current = true;
    setView("chat");
    const pendingId = newId();
    setBusy(true);
    setMessages((current) => [
      ...current,
      { id: newId(), role: "user", text: `Gửi sang máy\n${previewText(textToShare)}`, time: timeLabel() },
      { id: pendingId, role: "assistant", text: "Đang gửi sang máy tính...", pending: true, time: timeLabel() }
    ]);
    try {
      const response = await requestJson<CommandResult>(`${connection.baseUrl}/api/share`, {
        method: "POST",
        headers: { "X-AT-Remote-Key": connection.authKey },
        data: {
          type: "text",
          text: textToShare,
          subject: payload.subject || ""
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
      setConnectionText("Đã kết nối");
      showToast("Đã gửi nội dung sang máy.", "success");
      return true;
    } catch (error) {
      const text = friendlyConnectionError(error);
      replaceMessage(pendingId, {
        text,
        status: "error",
        cards: [{ type: "error", title: "Mất kết nối", message: text }],
        buttons: [{ label: "Thử lại", command: "__retry__" }]
      });
      setConnectionText("Mất kết nối");
      showToast(text, "error");
      return false;
    } finally {
      setBusy(false);
    }
  }, [connection, showToast]);

  const consumeSharedPayload = useCallback(async () => {
    if (!Capacitor.isNativePlatform() || !connection || step !== "connected" || busy || sharedPayloadBusyRef.current) return;
    sharedPayloadBusyRef.current = true;
    try {
      const payload = await ShareReceiver.getSharedPayload();
      if (!payload?.ok || !payload.type) return;
      const handled =
        payload.type === "file"
          ? await uploadSharedFilePayload(payload)
          : await shareTextToDesktop(payload);
      if (handled) {
        await ShareReceiver.clearSharedPayload();
      }
    } catch {
      // The plugin is Android-only. Ignore on web and older native builds.
    } finally {
      sharedPayloadBusyRef.current = false;
    }
  }, [busy, connection, shareTextToDesktop, step, uploadSharedFilePayload]);

  useEffect(() => {
    void consumeSharedPayload();
  }, [consumeSharedPayload]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let removeListener: (() => void) | undefined;
    void CapacitorApp.addListener("appStateChange", (state) => {
      if (state.isActive) void consumeSharedPayload();
    }).then((handle) => {
      removeListener = () => {
        void handle.remove();
      };
    });
    return () => removeListener?.();
  }, [consumeSharedPayload]);

  const sendCommand = async (command: string, options: { source?: "manual" | "macro" | "widget" | "repeat" | "quick" } = {}) => {
    const clean = command.trim();
    if (!clean) return;
    if (clean === "__retry__") {
      if (lastCommand) void sendCommand(lastCommand);
      return;
    }
    if (!connection) {
      setConnectionStep("connect");
      showToast("Cần kết nối với máy tính trước.", "warning");
      return;
    }
    if (options.source === "widget") showToast(`Đã nhận từ widget: ${clean}`, "success");
    if (options.source === "repeat") showToast(`Lặp lại: ${clean}`, "success");
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
      const statusItems = extractSystemStatusItems(data.cards);
      if (statusItems.length) setLastStatusItems(statusItems);
      if (data.status !== "error") {
        setCommandUsage(rememberCommandUsage(connection.baseUrl, clean));
      }
      if (data.requiresConfirmation) {
        showToast("Cần xác nhận trong app.", "warning");
      } else if (data.status === "error") {
        showToast(data.message || "Không xử lý được yêu cầu.", "error");
      } else if (options.source) {
        showToast(`Đã gửi: ${clean}`, "success");
      }
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
      showToast(text, "error");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!pendingLaunchCommand) return;
    setDraft(pendingLaunchCommand);
    if (!connection || step !== "connected" || busy) return;
    const command = pendingLaunchCommand;
    setPendingLaunchCommand("");
    void sendCommand(command, { source: "widget" });
  }, [busy, connection, pendingLaunchCommand, step]);

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
      { label: "Trợ giúp", icon: Search, command: "help" },
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
      void sendCommand(action.command, { source: "quick" });
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

  const frequentCommands = useMemo(() => commandUsage.slice(0, 6).map((item) => item.command), [commandUsage]);
  const commandSuggestions = useMemo(
    () => buildCommandSuggestions(draft, commandUsage, quickActions, macros, pinnedCommands),
    [commandUsage, draft, macros, pinnedCommands, quickActions]
  );

  const applyCommandSuggestion = (command: string) => {
    setDraft(command);
    setShowQuickActions(false);
    window.setTimeout(() => inputRef.current?.focus(), 30);
  };

  const viewTitle =
    view === "files"
      ? "Tệp đã gửi"
      : view === "permissions"
        ? "Quyền điều khiển"
        : view === "commands"
          ? "Lệnh của tôi"
          : "Kết quả";

  const brandIntro = showBrandIntro ? <BrandIntro leaving={brandIntroLeaving} /> : null;
  const discoveryOverlay = discovering && step !== "connected" ? <DiscoveryOverlay /> : null;

  if (step !== "connected") {
    return (
      <>
      <main className="connect-page">
        <section className="connect-card">
          <div className="connect-top">
            <div className="brand-lockup">
              <div className="brand-mark">
                <img src={BRAND_LOGO_SRC} alt="" aria-hidden="true" />
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
          <p className="lead">AT Remote sẽ tự tìm máy tính trong cùng WiFi. Nếu dùng từ xa, bật Tailscale trên điện thoại và nhập địa chỉ Tailscale đang hiện trên ATAssistant.</p>

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
                {discovering ? "Đang tìm máy tính" : "Tìm máy tính"}
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
                        <small>{computer.kind === "tailscale" ? "Tailscale · " : ""}{computer.baseUrl}</small>
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
                  placeholder="http://192.168.1.11:8765 hoặc http://100.x.x.x:8765"
                />
                <span className="field-hint">Dùng địa chỉ WiFi/LAN khi ở gần máy tính, hoặc địa chỉ Tailscale khi dùng từ xa.</span>
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
            <div><span>2</span><p>Dùng cùng WiFi hoặc bật Tailscale trên cả điện thoại và máy tính.</p></div>
            <div><span>3</span><p>Nếu báo mất kết nối, kiểm tra lại địa chỉ đang nhập.</p></div>
          </div>
        </section>
        {discoveryOverlay}
      </main>
      {brandIntro}
      </>
    );
  }

  return (
    <>
    <main className="app-shell">
      <header className="top-bar">
        <div className="top-brand">
          <div className="brand-mark small">
            <img src={BRAND_LOGO_SRC} alt="" aria-hidden="true" />
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
        ) : view === "commands" ? (
          <CommandsView
            macros={macros}
            pinnedCommands={pinnedCommands}
            commandUsage={commandUsage}
            lastCommand={lastCommand}
            onBack={() => setView("chat")}
            onSaveMacros={(items) => {
              setMacros(saveMacros(items));
              showToast("Đã lưu macro.", "success");
            }}
            onSavePinned={(items) => {
              setPinnedCommands(savePinnedCommands(items));
              showToast("Đã lưu lệnh ghim.", "success");
            }}
            onRun={(command, source = "quick") => void sendCommand(command, { source })}
          />
        ) : messages.length === 0 ? (
          <>
            <DashboardMini
              items={lastStatusItems}
              lastCommand={lastCommand}
              onRefresh={() => void sendCommand("trạng thái máy", { source: "quick" })}
              onRepeat={lastCommand ? () => void sendCommand(lastCommand, { source: "repeat" }) : undefined}
              onRun={(command) => void sendCommand(command, { source: "quick" })}
            />
            <div className="empty-state">
              <MonitorSmartphone size={42} />
              <h2>Nhập yêu cầu</h2>
              <p>ATAssistant sẽ xử lý trên máy tính và trả kết quả về đây.</p>
            </div>
          </>
        ) : (
          <>
            <DashboardMini
              items={lastStatusItems}
              lastCommand={lastCommand}
              onRefresh={() => void sendCommand("trạng thái máy", { source: "quick" })}
              onRepeat={lastCommand ? () => void sendCommand(lastCommand, { source: "repeat" }) : undefined}
              onRun={(command) => void sendCommand(command, { source: "quick" })}
            />
            {messages.map((message) => {
              const hasCards = Boolean(message.cards?.length);
              const showBubble = message.role === "user" || message.pending || !hasCards;
              return (
                <article key={message.id} className={`message ${message.role}`}>
                  {showBubble ? (
                    <div className={`message-bubble ${message.pending ? "pending" : ""}`}>
                      <p className="message-text">{message.text}</p>
                      <div className="message-meta">
                        {message.pending ? <RefreshCw className="spin" size={12} /> : null}
                        <span>{message.pending ? "Đang xử lý" : message.time}</span>
                      </div>
                    </div>
                  ) : null}
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
                            else if (button.command) void sendCommand(button.command, { source: "quick" });
                          }}
                        >
                          {button.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </>
        )}
      </section>

      {showQuickActions ? (
        <section className="quick-actions-panel" aria-label="Nút nhanh">
          <div className="macro-actions" aria-label="Macro một chạm">
            <span>Macro</span>
            <div>
              {macros.map((macro) => (
                <button
                  key={`${macro.label}-${macro.command}`}
                  type="button"
                  className={isRiskyCommand(macro.command) ? "risky" : ""}
                  onClick={() => void sendCommand(macro.command, { source: "macro" })}
                  disabled={busy}
                >
                  {macro.label}
                </button>
              ))}
            </div>
          </div>
          {frequentCommands.length > 0 ? (
            <div className="frequent-commands" aria-label="Lệnh thường dùng">
              <span>Thường dùng</span>
              <div>
                {frequentCommands.map((command) => (
                  <button key={command} type="button" onClick={() => void sendCommand(command, { source: "quick" })} disabled={busy}>
                    {command}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="quick-actions">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button key={action.label} onClick={() => runQuickAction(action)} disabled={busy}>
                  <Icon size={18} />
                  <span>{action.label}</span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {commandSuggestions.length > 0 ? (
        <section className="command-suggestions" aria-label="Gợi ý hoàn thiện câu lệnh">
          {commandSuggestions.map((command) => (
            <button key={command} type="button" onClick={() => applyCommandSuggestion(command)}>
              <ChevronRight size={15} />
              <span>{command}</span>
            </button>
          ))}
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
          onChange={(event) => {
            setDraft(event.target.value);
            if (event.target.value.trim()) setShowQuickActions(false);
          }}
          placeholder="Nhập yêu cầu"
          rows={1}
        />
        <button className="send-button" disabled={busy || !draft.trim()}>
          {busy ? <RefreshCw className="spin" size={18} /> : <Send size={18} />}
          <span>Gửi</span>
        </button>
      </form>

      {toast ? <div className={`toast ${toast.tone}`} role="status">{toast.text}</div> : null}

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
    {brandIntro}
    </>
  );
}

function BrandIntro({ leaving }: { leaving: boolean }) {
  return (
    <div className={`brand-intro ${leaving ? "leaving" : ""}`} aria-hidden="true">
      <img src={BRAND_SPLASH_SRC} alt="" />
    </div>
  );
}

function DiscoveryOverlay() {
  return (
    <div className="discovery-overlay" aria-live="polite" aria-label="Đang tìm máy tính">
      <div className="discovery-overlay__image" />
      <div className="discovery-overlay__shade" />
      <div className="discovery-overlay__label">Đang tìm máy tính</div>
    </div>
  );
}

function DashboardMini({
  items,
  lastCommand,
  onRefresh,
  onRepeat,
  onRun
}: {
  items: SystemStatusItem[];
  lastCommand: string;
  onRefresh: () => void;
  onRepeat?: () => void;
  onRun: (command: string) => void;
}) {
  const visibleItems = items.length
    ? items.slice(0, 4)
    : [
        { label: "CPU", value: "--" },
        { label: "RAM", value: "--" },
        { label: "Pin", value: "--" },
        { label: "Đang dùng", value: "--" }
      ];
  return (
    <section className="dashboard-mini" aria-label="Trạng thái nhanh">
      <div className="dashboard-top">
        <div>
          <span>Dashboard</span>
          <strong>{lastCommand ? `Lệnh gần nhất: ${lastCommand}` : "Sẵn sàng nhận lệnh"}</strong>
        </div>
        <button type="button" className="icon-button" onClick={onRefresh} aria-label="Cập nhật trạng thái">
          <RefreshCw size={17} />
        </button>
      </div>
      <div className="dashboard-metrics">
        {visibleItems.map((item) => (
          <div className="dashboard-metric" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
      <div className="dashboard-actions">
        {onRepeat ? (
          <button type="button" onClick={onRepeat}>
            <Repeat2 size={15} />
            Lặp lại
          </button>
        ) : null}
        <button type="button" onClick={() => onRun("chụp màn hình")}>Chụp màn hình</button>
        <button type="button" onClick={() => onRun("thả hết phím")}>Thả hết phím</button>
      </div>
    </section>
  );
}

function CommandsView({
  macros,
  pinnedCommands,
  commandUsage,
  lastCommand,
  onBack,
  onSaveMacros,
  onSavePinned,
  onRun
}: {
  macros: MacroAction[];
  pinnedCommands: string[];
  commandUsage: CommandUsage[];
  lastCommand: string;
  onBack: () => void;
  onSaveMacros: (items: MacroAction[]) => void;
  onSavePinned: (items: string[]) => void;
  onRun: (command: string, source?: "macro" | "quick" | "repeat") => void;
}) {
  const [macroDrafts, setMacroDrafts] = useState<MacroAction[]>(macros);
  const [pinnedDraft, setPinnedDraft] = useState("");
  const [idleMinutes, setIdleMinutes] = useState("45");
  const [idleStart, setIdleStart] = useState("23");
  const [idleEnd, setIdleEnd] = useState("6");

  useEffect(() => setMacroDrafts(macros), [macros]);

  const updateMacro = (index: number, patch: Partial<MacroAction>) => {
    setMacroDrafts((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  };
  const addPinned = () => {
    if (!pinnedDraft.trim()) return;
    onSavePinned([pinnedDraft, ...pinnedCommands]);
    setPinnedDraft("");
  };
  const idleCommand = `bật chế độ ngủ quên sau ${idleMinutes || "45"} phút từ ${idleStart || "23"} đến ${idleEnd || "6"}`;
  const widgetCommands = ["tắt máy sau 30 phút", "chụp màn hình", "trạng thái máy"];

  return (
    <div className="commands-panel">
      <div className="panel-toolbar">
        <button type="button" className="secondary-button" onClick={onBack}>
          <ChevronRight size={16} />
          Quay lại
        </button>
        <button type="button" className="secondary-button" onClick={() => onRun("help", "quick")}>
          <Search size={16} />
          Help
        </button>
      </div>

      <section className="command-section">
        <div className="section-heading">
          <h2>Macro</h2>
          <button type="button" className="secondary-button compact-button" onClick={() => onSaveMacros(macroDrafts)}>
            <Save size={15} />
            Lưu
          </button>
        </div>
        <div className="macro-editor">
          {macroDrafts.map((macro, index) => (
            <div className="macro-editor-row" key={`${index}-${macro.label}`}>
              <input value={macro.label} onChange={(event) => updateMacro(index, { label: event.target.value })} />
              <input value={macro.command} onChange={(event) => updateMacro(index, { command: event.target.value })} />
              <button type="button" onClick={() => onRun(macro.command, "macro")} className={isRiskyCommand(macro.command) ? "danger-soft-button" : "secondary-button"}>
                Gửi
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="command-section">
        <div className="section-heading">
          <h2>Lệnh ghim</h2>
        </div>
        <div className="pinned-list">
          {pinnedCommands.map((command) => (
            <button key={command} type="button" onClick={() => onRun(command, "quick")}>{command}</button>
          ))}
        </div>
        <div className="inline-editor">
          <input value={pinnedDraft} onChange={(event) => setPinnedDraft(event.target.value)} placeholder="Ghim lệnh mới" />
          <button type="button" className="secondary-button" onClick={addPinned}>Ghim</button>
          <button type="button" className="danger-soft-button" onClick={() => onSavePinned(DEFAULT_PINNED_COMMANDS)}>Đặt lại</button>
        </div>
      </section>

      <section className="command-section">
        <div className="section-heading">
          <h2>Lệnh gần đây</h2>
          {lastCommand ? (
            <button type="button" className="secondary-button compact-button" onClick={() => onRun(lastCommand, "repeat")}>
              <Repeat2 size={15} />
              Lặp lại
            </button>
          ) : null}
        </div>
        <div className="recent-command-list">
          {commandUsage.slice(0, 10).map((item) => (
            <button key={item.command} type="button" onClick={() => onRun(item.command, "quick")}>
              <span>{item.command}</span>
              <small>{item.count} lần</small>
            </button>
          ))}
        </div>
      </section>

      <section className="command-section">
        <div className="section-heading">
          <h2>Ngủ quên</h2>
        </div>
        <div className="lazy-guard-grid">
          <label>
            Sau
            <input value={idleMinutes} onChange={(event) => setIdleMinutes(event.target.value.replace(/\D/g, "").slice(0, 3))} inputMode="numeric" />
          </label>
          <label>
            Từ
            <input value={idleStart} onChange={(event) => setIdleStart(event.target.value.replace(/\D/g, "").slice(0, 2))} inputMode="numeric" />
          </label>
          <label>
            Đến
            <input value={idleEnd} onChange={(event) => setIdleEnd(event.target.value.replace(/\D/g, "").slice(0, 2))} inputMode="numeric" />
          </label>
        </div>
        <div className="dashboard-actions">
          <button type="button" onClick={() => onRun(idleCommand, "quick")}>Bật</button>
          <button type="button" onClick={() => onRun("trạng thái chế độ ngủ quên", "quick")}>Trạng thái</button>
          <button type="button" onClick={() => onRun("tắt chế độ ngủ quên", "quick")}>Tắt</button>
        </div>
      </section>

      <section className="command-section">
        <div className="section-heading">
          <h2>Widget Android</h2>
        </div>
        <div className="widget-command-list">
          {widgetCommands.map((command) => (
            <div key={command}>
              <span>{command}</span>
              <code>{commandDeepLink(command)}</code>
            </div>
          ))}
        </div>
      </section>
    </div>
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
            <p>Hãy thử làm mới khi dùng cùng WiFi hoặc đã bật Tailscale trên cả hai thiết bị.</p>
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
    const openViewer = () => onOpenImage({ src: imageSrc, title: card.title || "Ảnh kết quả", caption: card.caption, file });
    return (
      <div className="result-card image-card">
        <h3>{card.title || "Ảnh kết quả"}</h3>
        <button
          type="button"
          className="image-preview-button"
          onClick={openViewer}
        >
          <img src={imageSrc} alt={card.image.alt || "Kết quả"} />
        </button>
        {card.caption ? <p>{card.caption}</p> : null}
        {file ? <FileActions file={file} onOpen={openViewer} onDownload={onDownloadFile} onShare={onShareFile} /> : null}
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
