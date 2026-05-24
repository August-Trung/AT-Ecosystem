import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor, CapacitorHttp, registerPlugin } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { LocalNotifications } from "@capacitor/local-notifications";
import type { LocalNotificationSchema } from "@capacitor/local-notifications";
import { Share } from "@capacitor/share";
import {
  BatteryCharging,
  Banknote,
  Bell,
  Check,
  ChevronRight,
  Clipboard,
  Cpu,
  Download,
  Droplets,
  FileText,
  FolderOpen,
  Hash,
  History,
  Home,
  Keyboard,
  KeyRound,
  Laptop,
  Mail,
  Maximize2,
  Menu,
  MessageCircle,
  Minimize2,
  MonitorSmartphone,
  MousePointer2,
  MousePointerClick,
  Paperclip,
  Plus,
  QrCode,
  ReceiptText,
  RefreshCw,
  Repeat2,
  RotateCcw,
  Save,
  Search,
  Send,
  Share2,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Trash2,
  WifiOff,
  X,
  Zap,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import { FormEvent, PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type ConnectionStep = "checking" | "connect" | "pending" | "connected";
type MessageRole = "user" | "assistant";
type AppView = "home" | "chat" | "files" | "permissions" | "commands" | "expenses" | "control";
type BillKind = "rent" | "electricity" | "water" | "other";
type BillMode = "fixed" | "metered";

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

type LivingExpenseHistory = {
  month: string;
  paidAt: string;
  amount: number;
  unitPrice: number;
  previousReading: number;
  currentReading: number;
  usage: number;
  note?: string;
};

type LivingExpense = {
  id: string;
  kind: BillKind;
  label: string;
  mode: BillMode;
  dueDay: number;
  reminderEnabled: boolean;
  remindBeforeDays: number;
  overdueReminder: boolean;
  amount: number;
  unitPrice: number;
  previousReading: number;
  currentReading: number;
  manualTotal: number;
  paidMonth?: string;
  note?: string;
  history: LivingExpenseHistory[];
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

type RemoteScreenFrame = {
  image: string;
  width: number;
  height: number;
  previewWidth?: number;
  previewHeight?: number;
  capturedAt?: string;
};

type RemoteScreenResponse = {
  ok?: boolean;
  status?: string;
  message?: string;
  screen?: RemoteScreenFrame;
};

type RemoteInputResponse = {
  ok?: boolean;
  status?: string;
  message?: string;
};

type RemoteStreamProfile = "smooth" | "balanced" | "sharp";

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
const LIVING_EXPENSES_KEY = "atRemoteLivingExpensesV1";
const LIVING_EXPENSES_DUE_NOTICE_KEY = "atRemoteExpenseDueNotice:";
const EXPENSE_NOTIFICATION_ID_BASE = 730000;
const MAX_STORED_MESSAGES = 120;
const MAX_STORED_COMMANDS = 36;
const MAX_COMMAND_SUGGESTIONS = 6;
const BRAND_INTRO_HOLD_MS = 920;
const BRAND_INTRO_FADE_MS = 260;
const REMOTE_STREAM_PROFILES: Record<RemoteStreamProfile, { label: string; fps: number; maxWidth: number; quality: number }> = {
  smooth: { label: "Mượt", fps: 6, maxWidth: 960, quality: 52 },
  balanced: { label: "Cân bằng", fps: 5, maxWidth: 1280, quality: 62 },
  sharp: { label: "Nét", fps: 3, maxWidth: 1600, quality: 74 }
};

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

const DEFAULT_LIVING_EXPENSES: LivingExpense[] = [
  {
    id: "rent",
    kind: "rent",
    label: "Tiền trọ",
    mode: "fixed",
    dueDay: 5,
    reminderEnabled: true,
    remindBeforeDays: 1,
    overdueReminder: true,
    amount: 0,
    unitPrice: 0,
    previousReading: 0,
    currentReading: 0,
    manualTotal: 0,
    history: []
  },
  {
    id: "electricity",
    kind: "electricity",
    label: "Tiền điện",
    mode: "metered",
    dueDay: 5,
    reminderEnabled: true,
    remindBeforeDays: 1,
    overdueReminder: true,
    amount: 0,
    unitPrice: 0,
    previousReading: 0,
    currentReading: 0,
    manualTotal: 0,
    history: []
  },
  {
    id: "water",
    kind: "water",
    label: "Tiền nước",
    mode: "metered",
    dueDay: 5,
    reminderEnabled: true,
    remindBeforeDays: 1,
    overdueReminder: true,
    amount: 0,
    unitPrice: 0,
    previousReading: 0,
    currentReading: 0,
    manualTotal: 0,
    history: []
  }
];

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

const cleanNumber = (value: unknown) => {
  const next = Number(String(value ?? "").replace(/,/g, "."));
  return Number.isFinite(next) && next > 0 ? next : 0;
};

const clampDueDay = (value: unknown) => Math.min(31, Math.max(1, Math.round(cleanNumber(value) || 1)));

const clampReminderDays = (value: unknown) => Math.min(14, Math.max(0, Math.round(cleanNumber(value))));

const currentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const currentMonthLabel = () => new Date().toLocaleDateString("vi-VN", { month: "long", year: "numeric" });

const shortDateLabel = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
};

const monthLabel = (month: string) => {
  const [year, rawMonth] = String(month || "").split("-").map((item) => Number(item));
  if (!year || !rawMonth) return month || "";
  return new Date(year, rawMonth - 1, 1).toLocaleDateString("vi-VN", { month: "long", year: "numeric" });
};

const numberLabel = (value: number) =>
  new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 2
  }).format(Math.max(0, Number(value || 0)));

const moneyLabel = (value: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
  }).format(Math.max(0, Math.round(value || 0)));

const billKind = (value: unknown): BillKind =>
  value === "rent" || value === "electricity" || value === "water" || value === "other" ? value : "other";

const billMode = (value: unknown): BillMode => (value === "metered" ? "metered" : "fixed");

const normalizeExpenseHistory = (items: unknown): LivingExpenseHistory[] => {
  if (!Array.isArray(items)) return [];
  return items
    .flatMap((item) => {
      const value = item as Partial<LivingExpenseHistory>;
      const month = String(value.month || "").trim();
      if (!/^\d{4}-\d{2}$/.test(month)) return [];
      return [{
        month,
        paidAt: String(value.paidAt || ""),
        amount: cleanNumber(value.amount),
        unitPrice: cleanNumber(value.unitPrice),
        previousReading: cleanNumber(value.previousReading),
        currentReading: cleanNumber(value.currentReading),
        usage: cleanNumber(value.usage),
        note: String(value.note || "").trim()
      }];
    })
    .sort((left, right) => right.month.localeCompare(left.month))
    .slice(0, 24);
};

const normalizeLivingExpense = (item: Partial<LivingExpense>, fallback?: LivingExpense): LivingExpense => ({
  id: String(item.id || fallback?.id || "").trim(),
  kind: billKind(item.kind || fallback?.kind),
  label: String(item.label || fallback?.label || "Khoản khác").trim(),
  mode: billMode(item.mode || fallback?.mode),
  dueDay: clampDueDay(item.dueDay ?? fallback?.dueDay ?? 5),
  reminderEnabled: typeof item.reminderEnabled === "boolean" ? item.reminderEnabled : fallback?.reminderEnabled ?? true,
  remindBeforeDays: clampReminderDays(item.remindBeforeDays ?? fallback?.remindBeforeDays ?? 1),
  overdueReminder: typeof item.overdueReminder === "boolean" ? item.overdueReminder : fallback?.overdueReminder ?? true,
  amount: cleanNumber(item.amount ?? fallback?.amount),
  unitPrice: cleanNumber(item.unitPrice ?? fallback?.unitPrice),
  previousReading: cleanNumber(item.previousReading ?? fallback?.previousReading),
  currentReading: cleanNumber(item.currentReading ?? fallback?.currentReading),
  manualTotal: cleanNumber(item.manualTotal ?? fallback?.manualTotal),
  paidMonth: typeof item.paidMonth === "string" ? item.paidMonth : fallback?.paidMonth,
  note: String(item.note || fallback?.note || "").trim(),
  history: normalizeExpenseHistory(item.history || fallback?.history)
});

const normalizeLivingExpenses = (items: Partial<LivingExpense>[]) => {
  const source = Array.isArray(items) ? items : [];
  const sourceById = new Map(source.map((item) => [String(item.id || "").trim(), item]));
  const defaultIds = new Set(DEFAULT_LIVING_EXPENSES.map((item) => item.id));
  const defaults = DEFAULT_LIVING_EXPENSES.map((fallback) => normalizeLivingExpense(sourceById.get(fallback.id) || fallback, fallback));
  const custom = source
    .filter((item) => {
      const id = String(item.id || "").trim();
      return id && !defaultIds.has(id);
    })
    .map((item) => normalizeLivingExpense(item))
    .filter((item) => item.id && item.label)
    .slice(0, 9);
  return [...defaults, ...custom];
};

const readLivingExpenses = (): LivingExpense[] => {
  try {
    const raw = localStorage.getItem(LIVING_EXPENSES_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<LivingExpense>[]) : [];
    return normalizeLivingExpenses(parsed.length ? parsed : DEFAULT_LIVING_EXPENSES);
  } catch {
    return normalizeLivingExpenses(DEFAULT_LIVING_EXPENSES);
  }
};

const saveLivingExpenses = (items: Partial<LivingExpense>[]) => {
  const clean = normalizeLivingExpenses(items);
  localStorage.setItem(LIVING_EXPENSES_KEY, JSON.stringify(clean));
  return clean;
};

const parseLivingExpenseBackup = (content: string) => {
  const parsed = JSON.parse(content) as { expenses?: Partial<LivingExpense>[] } | Partial<LivingExpense>[];
  const items = Array.isArray(parsed) ? parsed : parsed.expenses;
  if (!Array.isArray(items) || !items.length) throw new Error("Invalid living expense backup");
  return normalizeLivingExpenses(items);
};

const expenseUsage = (expense: LivingExpense) =>
  Math.max(0, cleanNumber(expense.currentReading) - cleanNumber(expense.previousReading));

const expenseTotal = (expense: LivingExpense) =>
  expense.mode === "metered" ? expenseUsage(expense) * cleanNumber(expense.unitPrice) : cleanNumber(expense.amount);

const isExpensePaid = (expense: LivingExpense) => expense.paidMonth === currentMonthKey();

const currentExpenseRecord = (expense: LivingExpense) => expense.history.find((item) => item.month === currentMonthKey());

const expenseMonthTotal = (expense: LivingExpense) => {
  const record = currentExpenseRecord(expense);
  return record && isExpensePaid(expense) ? record.amount : expenseTotal(expense);
};

const canCloseExpense = (expense: LivingExpense) => {
  if (isExpensePaid(expense)) return true;
  if (expense.mode === "metered") return cleanNumber(expense.currentReading) > cleanNumber(expense.previousReading) && cleanNumber(expense.unitPrice) > 0;
  return cleanNumber(expense.amount) > 0;
};

const closeExpenseForCurrentMonth = (expense: LivingExpense): LivingExpense => {
  const month = currentMonthKey();
  const usage = expense.mode === "metered" ? expenseUsage(expense) : 0;
  const currentReading = expense.mode === "metered" ? cleanNumber(expense.currentReading) : 0;
  const record: LivingExpenseHistory = {
    month,
    paidAt: new Date().toISOString(),
    amount: expenseTotal(expense),
    unitPrice: cleanNumber(expense.unitPrice),
    previousReading: expense.mode === "metered" ? cleanNumber(expense.previousReading) : 0,
    currentReading,
    usage,
    note: expense.note
  };
  const history = [record, ...expense.history.filter((item) => item.month !== month)].slice(0, 24);
  return {
    ...expense,
    paidMonth: month,
    previousReading: expense.mode === "metered" ? currentReading : expense.previousReading,
    currentReading: 0,
    manualTotal: 0,
    note: "",
    history
  };
};

const reopenExpenseForCurrentMonth = (expense: LivingExpense): LivingExpense => {
  const currentRecord = expense.history.find((item) => item.month === currentMonthKey());
  return {
    ...expense,
    paidMonth: "",
    previousReading: currentRecord && expense.mode === "metered" ? currentRecord.previousReading : expense.previousReading,
    currentReading: currentRecord && expense.mode === "metered" ? currentRecord.currentReading : expense.currentReading,
    history: expense.history.filter((item) => item.month !== currentMonthKey())
  };
};

type ExpenseNotificationSlot = "before" | "due" | "overdue";

const EXPENSE_NOTIFICATION_SLOT_OFFSETS: Record<ExpenseNotificationSlot, number> = {
  before: 1,
  due: 2,
  overdue: 3
};

const DAY_MS = 24 * 60 * 60 * 1000;

const expenseNotificationId = (expense: LivingExpense, slot: ExpenseNotificationSlot) =>
  EXPENSE_NOTIFICATION_ID_BASE +
  Array.from(expense.id).reduce((sum, char) => sum + char.charCodeAt(0), 0) * 10 +
  EXPENSE_NOTIFICATION_SLOT_OFFSETS[slot];

const expenseNotificationDescriptors = (expenses: LivingExpense[]) =>
  expenses.flatMap((expense) =>
    (Object.keys(EXPENSE_NOTIFICATION_SLOT_OFFSETS) as ExpenseNotificationSlot[]).map((slot) => ({
      id: expenseNotificationId(expense, slot)
    }))
  );

const expenseDueDate = (expense: LivingExpense, monthOffset = 0, hour = 9) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + monthOffset;
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(clampDueDay(expense.dueDay), lastDayOfMonth), hour, 0, 0, 0);
};

const nextOverdueReminderDate = () => {
  const now = new Date();
  const reminder = new Date(now);
  reminder.setHours(9, 0, 0, 0);
  if (reminder.getTime() <= now.getTime()) reminder.setDate(reminder.getDate() + 1);
  return reminder;
};

const previousExpenseRecord = (expense: LivingExpense) =>
  expense.history.find((record) => record.month !== currentMonthKey());

const expenseTotalDelta = (expense: LivingExpense) => {
  const record = previousExpenseRecord(expense);
  return record ? expenseMonthTotal(expense) - record.amount : 0;
};

const averageExpenseAmount = (expense: LivingExpense) => {
  const records = expense.history.slice(0, 6);
  if (!records.length) return 0;
  return records.reduce((sum, record) => sum + cleanNumber(record.amount), 0) / records.length;
};

const summarizeLivingExpenses = (expenses: LivingExpense[]) =>
  expenses.reduce(
    (summary, expense) => {
      const monthTotal = expenseMonthTotal(expense);
      summary.total += monthTotal;
      if (isExpensePaid(expense)) summary.paid += monthTotal;
      else summary.unpaid += monthTotal;
      return summary;
    },
    { total: 0, paid: 0, unpaid: 0 }
  );

const daysUntilDue = (dueDay: number) => {
  const now = new Date();
  const due = expenseDueDate({ dueDay } as LivingExpense, 0, 23);
  due.setMinutes(59, 59, 999);
  return Math.ceil((due.getTime() - now.getTime()) / 86400000);
};

const expenseStatusText = (expense: LivingExpense) => {
  if (isExpensePaid(expense)) return "Đã đóng";
  const dueOffset = daysUntilDue(expense.dueDay);
  if (dueOffset < 0) return `Trễ ${Math.abs(dueOffset)} ngày`;
  if (dueOffset === 0) return "Hôm nay";
  return `Còn ${dueOffset} ngày`;
};

const expenseStatusTone = (expense: LivingExpense) => {
  if (isExpensePaid(expense)) return "paid";
  const dueOffset = daysUntilDue(expense.dueDay);
  if (dueOffset < 0) return "late";
  return dueOffset <= 3 ? "warning" : "neutral";
};

const expenseTrendText = (delta: number) => {
  if (!delta) return "Bằng tháng trước";
  return `${delta > 0 ? "Tăng" : "Giảm"} ${moneyLabel(Math.abs(delta))}`;
};

const buildExpenseNotifications = (expense: LivingExpense) => {
  if (!expense.reminderEnabled) return [];
  const now = new Date();
  const paid = isExpensePaid(expense);
  const due = expenseDueDate(expense, paid ? 1 : 0);
  const baseBody =
    expense.mode === "metered"
      ? `Nhập chỉ số mới. Số cũ: ${numberLabel(expense.previousReading)}.`
      : `Số tiền: ${moneyLabel(expense.amount)}.`;
  const notifications: LocalNotificationSchema[] = [];
  const remindBeforeDays = clampReminderDays(expense.remindBeforeDays);
  if (remindBeforeDays > 0) {
    const before = new Date(due.getTime() - remindBeforeDays * DAY_MS);
    if (before.getTime() > now.getTime()) {
      notifications.push({
        id: expenseNotificationId(expense, "before"),
        title: `Sắp đến hạn ${expense.label}`,
        body: `Còn ${remindBeforeDays} ngày. ${baseBody}`,
        schedule: { at: before, allowWhileIdle: true },
        extra: { module: "expenses", expenseId: expense.id, slot: "before" }
      });
    }
  }
  if (due.getTime() > now.getTime()) {
    notifications.push({
      id: expenseNotificationId(expense, "due"),
      title: `Đến hạn ${expense.label}`,
      body: baseBody,
      schedule: { at: due, allowWhileIdle: true },
      extra: { module: "expenses", expenseId: expense.id, slot: "due" }
    });
  }
  if (!paid && due.getTime() <= now.getTime() && expense.overdueReminder) {
    notifications.push({
      id: expenseNotificationId(expense, "overdue"),
      title: `Quá hạn ${expense.label}`,
      body: baseBody,
      schedule: { at: nextOverdueReminderDate(), repeats: true, every: "day" as const, allowWhileIdle: true },
      extra: { module: "expenses", expenseId: expense.id, slot: "overdue" }
    });
  }
  return notifications;
};

const scheduleExpenseNotifications = async (expenses: LivingExpense[]) => {
  if (!Capacitor.isNativePlatform()) return false;
  const permission = await LocalNotifications.checkPermissions();
  if (permission.display !== "granted") return false;
  const notifications = expenses.flatMap((expense) => buildExpenseNotifications(expense));
  await LocalNotifications.cancel({ notifications: expenseNotificationDescriptors(expenses) });
  if (notifications.length) await LocalNotifications.schedule({ notifications });
  return true;
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

const shortTimeLabel = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
};

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
  const [livingExpenses, setLivingExpenses] = useState<LivingExpense[]>(readLivingExpenses());
  const [lastStatusItems, setLastStatusItems] = useState<SystemStatusItem[]>([]);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [pendingLaunchCommand, setPendingLaunchCommand] = useState(parseCommandUrl(window.location.href));
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [imageViewer, setImageViewer] = useState<ImageViewerState | null>(null);
  const [view, setView] = useState<AppView>("home");
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
  const expenseBackupInputRef = useRef<HTMLInputElement | null>(null);
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
    setView("home");
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
    setView("home");
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

  const refreshSystemStatus = useCallback(async () => {
    if (!connection || busy) return;
    setBusy(true);
    try {
      const response = await requestJson<CommandResult>(`${connection.baseUrl}/api/command`, {
        method: "POST",
        headers: {
          "X-AT-Remote-Key": connection.authKey
        },
        data: { command: "trạng thái máy" }
      });
      const data = response.data;
      if (!response.ok || data.status === "unauthorized") throw new Error(friendlyFetchError());
      const statusItems = extractSystemStatusItems(data.cards);
      if (statusItems.length) setLastStatusItems(statusItems);
      setLastCommand("trạng thái máy");
      setCommandUsage(rememberCommandUsage(connection.baseUrl, "trạng thái máy"));
      setConnectionText("Đã kết nối");
      showToast("Đã cập nhật trạng thái.", "success");
    } catch (error) {
      const text = friendlyConnectionError(error);
      setConnectionText("Mất kết nối");
      showToast(text, "error");
    } finally {
      setBusy(false);
    }
  }, [busy, connection, showToast]);

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
      { label: "Thu chi", icon: ReceiptText, view: "expenses" },
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

  const updateLivingExpense = (id: string, patch: Partial<LivingExpense>) => {
    setLivingExpenses((current) => saveLivingExpenses(current.map((item) => (item.id === id ? { ...item, ...patch } : item))));
  };

  const addLivingExpense = () => {
    setLivingExpenses((current) =>
      saveLivingExpenses([
        ...current,
        {
          id: newId(),
          kind: "other",
          label: "Khoản khác",
          mode: "fixed",
          dueDay: 5,
          reminderEnabled: true,
          remindBeforeDays: 1,
          overdueReminder: true,
          amount: 0,
          unitPrice: 0,
          previousReading: 0,
          currentReading: 0,
          manualTotal: 0,
          history: []
        }
      ])
    );
  };

  const deleteLivingExpense = (id: string) => {
    setLivingExpenses((current) => saveLivingExpenses(current.filter((item) => item.id !== id)));
  };

  const closeLivingExpense = (id: string) => {
    setLivingExpenses((current) =>
      saveLivingExpenses(current.map((item) => (item.id === id && canCloseExpense(item) ? closeExpenseForCurrentMonth(item) : item)))
    );
    showToast("Đã lưu lịch sử tháng này.", "success");
  };

  const reopenLivingExpense = (id: string) => {
    setLivingExpenses((current) =>
      saveLivingExpenses(current.map((item) => (item.id === id ? reopenExpenseForCurrentMonth(item) : item)))
    );
    showToast("Đã mở lại khoản tháng này.", "success");
  };

  const closeReadyLivingExpenses = () => {
    const readyExpenses = livingExpenses.filter((expense) => !isExpensePaid(expense) && canCloseExpense(expense));
    if (!readyExpenses.length) {
      showToast("Chưa có khoản nào đủ dữ liệu để đóng.", "warning");
      return;
    }
    setLivingExpenses(
      saveLivingExpenses(
        livingExpenses.map((item) =>
          readyExpenses.some((expense) => expense.id === item.id) ? closeExpenseForCurrentMonth(item) : item
        )
      )
    );
    showToast(`Đã lưu ${readyExpenses.length} khoản sẵn sàng.`, "success");
  };

  const exportLivingExpenses = useCallback(async () => {
    try {
      const fileName = `at-remote-thu-chi-${currentMonthKey()}-${Date.now()}.json`;
      const payload = JSON.stringify(
        {
          app: "AT Remote",
          module: "expenses",
          version: 1,
          exportedAt: new Date().toISOString(),
          expenses: normalizeLivingExpenses(livingExpenses)
        },
        null,
        2
      );
      if (Capacitor.isNativePlatform()) {
        await Filesystem.writeFile({
          path: fileName,
          data: payload,
          directory: Directory.Cache,
          encoding: Encoding.UTF8
        });
        const uri = await Filesystem.getUri({ path: fileName, directory: Directory.Cache });
        await Share.share({
          title: "AT Remote - Thu chi",
          text: "Sao lưu dữ liệu thu chi",
          url: uri.uri,
          dialogTitle: "Sao lưu thu chi"
        });
      } else {
        downloadBlob(new Blob([payload], { type: "application/json;charset=utf-8" }), fileName);
      }
      showToast("Đã tạo file sao lưu thu chi.", "success");
    } catch {
      showToast("Không sao lưu được thu chi.", "error");
    }
  }, [livingExpenses, showToast]);

  const importLivingExpensesFile = useCallback(
    async (file: File) => {
      try {
        const imported = parseLivingExpenseBackup(await file.text());
        setLivingExpenses(saveLivingExpenses(imported));
        showToast("Đã khôi phục dữ liệu thu chi.", "success");
      } catch {
        showToast("File sao lưu thu chi không hợp lệ.", "error");
      }
    },
    [showToast]
  );

  const enableExpenseNotifications = useCallback(async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const permission = await LocalNotifications.requestPermissions();
        if (permission.display !== "granted") {
          showToast("Chưa bật quyền thông báo.", "warning");
          return;
        }
        await scheduleExpenseNotifications(livingExpenses);
        showToast("Đã bật nhắc thu chi.", "success");
        return;
      }
      if ("Notification" in window) {
        const permission = await Notification.requestPermission();
        showToast(permission === "granted" ? "Đã bật nhắc khi app đang mở." : "Chưa bật quyền thông báo.", permission === "granted" ? "success" : "warning");
        return;
      }
      showToast("Thiết bị chưa hỗ trợ thông báo.", "warning");
    } catch {
      showToast("Không bật được thông báo.", "error");
    }
  }, [livingExpenses, showToast]);

  useEffect(() => {
    if (step !== "connected") return;
    const due = livingExpenses.filter((expense) => expense.reminderEnabled && !isExpensePaid(expense) && daysUntilDue(expense.dueDay) <= 0);
    if (!due.length) return;
    const today = new Date().toISOString().slice(0, 10);
    const key = `${LIVING_EXPENSES_DUE_NOTICE_KEY}${today}:${due.map((expense) => expense.id).join(",")}`;
    if (localStorage.getItem(key)) return;
    const body = `Đến hạn: ${due.map((expense) => expense.label).join(", ")}`;
    showToast(body, "warning");
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("AT Remote - Thu chi", { body });
    }
    localStorage.setItem(key, "1");
  }, [livingExpenses, showToast, step]);

  useEffect(() => {
    if (step !== "connected" || !Capacitor.isNativePlatform()) return;
    void scheduleExpenseNotifications(livingExpenses).catch(() => undefined);
  }, [livingExpenses, step]);

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
    view === "home"
      ? "Trang chủ"
      : view === "chat"
        ? "Chat"
        : view === "control"
          ? "Điều khiển"
          : view === "files"
            ? "Tệp đã gửi"
            : view === "permissions"
              ? "Quyền điều khiển"
              : view === "commands"
                ? "Lệnh của tôi"
                : view === "expenses"
                  ? "Thu chi"
                  : "Kết quả";

  const brandIntro = showBrandIntro ? <BrandIntro leaving={brandIntroLeaving} /> : null;
  const discoveryOverlay = discovering && step !== "connected" ? <DiscoveryOverlay /> : null;
  const showChatControls = view === "chat";

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
      <input
        ref={expenseBackupInputRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void importLivingExpensesFile(file);
        }}
      />

      <section className={`conversation ${view === "home" ? "home-view" : view !== "chat" ? "panel-view" : ""}`} ref={listRef} onScroll={handleConversationScroll}>
        {view === "home" ? (
          <HomeView
            connectionText={connectionText}
            expenses={livingExpenses}
            filesCount={uploads.length}
            lastCommand={lastCommand}
            messagesCount={messages.length}
            permissions={permissions}
            statusItems={lastStatusItems}
            onOpen={(next) => {
              setShowQuickActions(false);
              setView(next);
            }}
            onRefreshStatus={() => void refreshSystemStatus()}
          />
        ) : view === "control" && connection ? (
          <RemoteControlView
            baseUrl={connection.baseUrl}
            authKey={connection.authKey}
            onBack={() => setView("home")}
            onToast={showToast}
          />
        ) : view === "expenses" ? (
          <ExpensesView
            expenses={livingExpenses}
            onBack={() => setView("home")}
            onAdd={addLivingExpense}
            onCloseExpense={closeLivingExpense}
            onCloseReady={closeReadyLivingExpenses}
            onDelete={deleteLivingExpense}
            onEnableNotifications={enableExpenseNotifications}
            onExport={exportLivingExpenses}
            onImport={() => expenseBackupInputRef.current?.click()}
            onReopenExpense={reopenLivingExpense}
            onReset={() => {
              setLivingExpenses(saveLivingExpenses(DEFAULT_LIVING_EXPENSES));
              showToast("Đã đặt lại thu chi.", "success");
            }}
            onUpdate={updateLivingExpense}
          />
        ) : view === "files" ? (
          <FilesView
            files={uploads}
            busy={uploadsBusy}
            message={uploadsMessage}
            onBack={() => setView("home")}
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
            onBack={() => setView("home")}
            onRefresh={loadPermissions}
            onDisconnect={disconnect}
          />
        ) : view === "commands" ? (
          <CommandsView
            macros={macros}
            pinnedCommands={pinnedCommands}
            commandUsage={commandUsage}
            lastCommand={lastCommand}
            onBack={() => setView("home")}
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
            <div className="module-toolbar">
              <button type="button" className="secondary-button" onClick={() => setView("home")}>
                <ChevronRight size={16} />
                Trang chủ
              </button>
              <button type="button" className="secondary-button" onClick={() => setView("commands")}>
                <Repeat2 size={16} />
                Lệnh
              </button>
            </div>
            <div className="empty-state">
              <MonitorSmartphone size={42} />
              <h2>Nhập yêu cầu</h2>
              <p>ATAssistant sẽ xử lý trên máy tính và trả kết quả về đây.</p>
            </div>
          </>
        ) : (
          <>
            <div className="module-toolbar">
              <button type="button" className="secondary-button" onClick={() => setView("home")}>
                <ChevronRight size={16} />
                Trang chủ
              </button>
              <button type="button" className="secondary-button" onClick={() => setView("commands")}>
                <Repeat2 size={16} />
                Lệnh
              </button>
            </div>
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

      {showChatControls && showQuickActions ? (
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

      {showChatControls && commandSuggestions.length > 0 ? (
        <section className="command-suggestions" aria-label="Gợi ý hoàn thiện câu lệnh">
          {commandSuggestions.map((command) => (
            <button key={command} type="button" onClick={() => applyCommandSuggestion(command)}>
              <ChevronRight size={15} />
              <span>{command}</span>
            </button>
          ))}
        </section>
      ) : null}

      {showChatControls ? (
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
      ) : null}

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

function HomeView({
  connectionText,
  expenses,
  filesCount,
  lastCommand,
  messagesCount,
  permissions,
  statusItems,
  onOpen,
  onRefreshStatus
}: {
  connectionText: string;
  expenses: LivingExpense[];
  filesCount: number;
  lastCommand: string;
  messagesCount: number;
  permissions: PermissionGroup[];
  statusItems: SystemStatusItem[];
  onOpen: (view: Exclude<AppView, "home">) => void;
  onRefreshStatus: () => void;
}) {
  const expenseSummary = summarizeLivingExpenses(expenses);
  const permissionText = permissions.length
    ? `${permissions.filter((item) => item.enabled).length}/${permissions.length} bật`
    : "Chưa đọc";
  const visibleItems = statusItems.length
    ? statusItems.slice(0, 4)
    : [
        { label: "Kết nối", value: connectionText },
        { label: "Cần đóng", value: moneyLabel(expenseSummary.unpaid) },
        { label: "Chat", value: messagesCount ? `${messagesCount} tin` : "Mới" },
        { label: "Tệp", value: `${filesCount} tệp` }
      ];
  const modules: Array<{
    view: Exclude<AppView, "home">;
    label: string;
    metric: string;
    icon: typeof Mail;
    tone: string;
  }> = [
    { view: "control", label: "Điều khiển", metric: "Màn hình", icon: MonitorSmartphone, tone: "control" },
    { view: "chat", label: "Chat", metric: lastCommand ? "Có lịch sử" : "Mới", icon: MessageCircle, tone: "chat" },
    { view: "expenses", label: "Thu chi", metric: moneyLabel(expenseSummary.unpaid), icon: ReceiptText, tone: "expenses" },
    { view: "commands", label: "Lệnh", metric: "Macro", icon: Repeat2, tone: "commands" },
    { view: "files", label: "Tệp", metric: `${filesCount} tệp`, icon: FolderOpen, tone: "files" },
    { view: "permissions", label: "Quyền", metric: permissionText, icon: Shield, tone: "permissions" }
  ];

  return (
    <div className="home-dashboard">
      <section className="home-overview" aria-label="Tổng quan">
        <div className="home-overview-top">
          <div>
            <span>AT Remote</span>
            <strong>{connectionText}</strong>
          </div>
          <button type="button" className="icon-button" onClick={onRefreshStatus} aria-label="Cập nhật trạng thái">
            <RefreshCw size={17} />
          </button>
        </div>
        <div className="home-metrics">
          {visibleItems.map((item) => (
            <div className="home-metric" key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="module-grid" aria-label="Module">
        {modules.map((module) => {
          const Icon = module.icon;
          return (
            <button
              type="button"
              className={`module-tile ${module.tone}`}
              key={module.view}
              onClick={() => onOpen(module.view)}
            >
              <span className="module-icon">
                <Icon size={24} />
              </span>
              <strong>{module.label}</strong>
              <small>{module.metric}</small>
            </button>
          );
        })}
      </section>

      <div className="home-recent">
        <span>Gần nhất</span>
        <strong>{lastCommand || "Chưa có lệnh"}</strong>
      </div>
    </div>
  );
}

function RemoteControlView({
  baseUrl,
  authKey,
  onBack,
  onToast
}: {
  baseUrl: string;
  authKey: string;
  onBack: () => void;
  onToast: (text: string, tone?: ToastState["tone"]) => void;
}) {
  const [screen, setScreen] = useState<RemoteScreenFrame | null>(null);
  const [busy, setBusy] = useState(false);
  const [liveMode, setLiveMode] = useState(true);
  const [streamNonce, setStreamNonce] = useState(0);
  const [streamProfile, setStreamProfile] = useState<RemoteStreamProfile>("balanced");
  const [focusMode, setFocusMode] = useState(false);
  const [touchSensitivity, setTouchSensitivity] = useState(1.8);
  const [message, setMessage] = useState("Chưa có khung hình");
  const [textDraft, setTextDraft] = useState("");
  const [lastPoint, setLastPoint] = useState({ xRatio: 0.5, yRatio: 0.5 });
  const loadingRef = useRef(false);
  const screenPointerRef = useRef<{
    clientX: number;
    clientY: number;
    xRatio: number;
    yRatio: number;
  } | null>(null);
  const touchpadRef = useRef<{ clientX: number; clientY: number; moved: boolean; lastSentAt: number } | null>(null);
  const streamUrl = useMemo(() => {
    const profile = REMOTE_STREAM_PROFILES[streamProfile];
    const params = new URLSearchParams({
      key: authKey,
      fps: String(profile.fps),
      maxWidth: String(profile.maxWidth),
      quality: String(profile.quality),
      v: String(streamNonce)
    });
    return `${baseUrl}/api/remote/stream?${params.toString()}`;
  }, [authKey, baseUrl, streamNonce, streamProfile]);
  const screenImageSrc = liveMode ? streamUrl : screen?.image || "";
  const hasScreenImage = Boolean(screenImageSrc);

  const loadScreen = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setBusy(true);
    try {
      const response = await requestJson<RemoteScreenResponse>(`${baseUrl}/api/remote/screen`, {
        headers: { "X-AT-Remote-Key": authKey },
        connectTimeout: 4000,
        readTimeout: 12000
      });
      const data = response.data;
      if (!response.ok || !data.ok || !data.screen) throw new Error(data.message || friendlyFetchError());
      setScreen(data.screen);
      setMessage(data.message || "Đã cập nhật màn hình");
    } catch (error) {
      const text = friendlyConnectionError(error);
      setMessage(text);
      setLiveMode(false);
    } finally {
      loadingRef.current = false;
      setBusy(false);
    }
  }, [authKey, baseUrl]);

  const sendRemoteInput = useCallback(
    async (payload: Record<string, unknown>, refresh = true) => {
      try {
        const response = await requestJson<RemoteInputResponse>(`${baseUrl}/api/remote/input`, {
          method: "POST",
          headers: { "X-AT-Remote-Key": authKey },
          data: payload,
          connectTimeout: 3500,
          readTimeout: 8000
        });
        const data = response.data;
        if (!response.ok || data.status === "error" || data.status === "unauthorized") {
          throw new Error(data.message || friendlyFetchError());
        }
        setMessage(data.message || "Đã gửi thao tác");
        if (refresh && !liveMode) window.setTimeout(() => void loadScreen(), 180);
      } catch (error) {
        const text = friendlyConnectionError(error);
        setMessage(text);
        onToast(text, "error");
      }
    },
    [authKey, baseUrl, liveMode, loadScreen, onToast]
  );

  useEffect(() => {
    void loadScreen();
  }, [loadScreen]);

  const pointFromImageEvent = (event: PointerEvent<HTMLImageElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      xRatio: Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width))),
      yRatio: Math.max(0, Math.min(1, (event.clientY - rect.top) / Math.max(1, rect.height)))
    };
  };

  const toggleLive = () => {
    if (liveMode) {
      setLiveMode(false);
      void loadScreen();
      return;
    }
    setStreamNonce((value) => value + 1);
    setLiveMode(true);
    setMessage("Live stream đang chạy");
  };

  const refreshScreen = () => {
    if (liveMode) {
      setStreamNonce((value) => value + 1);
      setMessage("Đang nối lại live stream");
      return;
    }
    void loadScreen();
  };

  const handleScreenPointerDown = (event: PointerEvent<HTMLImageElement>) => {
    const point = pointFromImageEvent(event);
    screenPointerRef.current = {
      ...point,
      clientX: event.clientX,
      clientY: event.clientY
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleScreenPointerUp = (event: PointerEvent<HTMLImageElement>) => {
    const start = screenPointerRef.current;
    screenPointerRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const end = pointFromImageEvent(event);
    setLastPoint(end);
    if (!start) {
      void sendRemoteInput({ action: "tap", ...end });
      return;
    }
    const distance = Math.hypot(event.clientX - start.clientX, event.clientY - start.clientY);
    if (distance > 14) {
      void sendRemoteInput({ action: "drag", fromXRatio: start.xRatio, fromYRatio: start.yRatio, ...end });
      return;
    }
    void sendRemoteInput({ action: "tap", ...end });
  };

  const handleTouchpadDown = (event: PointerEvent<HTMLDivElement>) => {
    touchpadRef.current = { clientX: event.clientX, clientY: event.clientY, moved: false, lastSentAt: 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleTouchpadMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = touchpadRef.current;
    if (!current) return;
    const dx = event.clientX - current.clientX;
    const dy = event.clientY - current.clientY;
    if (Math.hypot(dx, dy) < 1.5) return;
    const now = Date.now();
    if (now - current.lastSentAt < 45) return;
    current.clientX = event.clientX;
    current.clientY = event.clientY;
    current.moved = true;
    current.lastSentAt = now;
    void sendRemoteInput({ action: "move", dx, dy, scale: touchSensitivity }, false);
  };

  const handleTouchpadUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = touchpadRef.current;
    touchpadRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!start) return;
    if (!start.moved) {
      void sendRemoteInput({ action: "tap", ...lastPoint });
    }
  };

  const sendAtLastPoint = (action: "right_tap" | "double_tap") => {
    void sendRemoteInput({ action, ...lastPoint });
  };

  const submitText = (event: FormEvent) => {
    event.preventDefault();
    const text = textDraft.trim();
    if (!text) return;
    setTextDraft("");
    void sendRemoteInput({ action: "text", text });
  };

  const shortcuts: Array<{ label: string; payload: Record<string, unknown> }> = [
    { label: "Esc", payload: { action: "key", key: "escape" } },
    { label: "Enter", payload: { action: "key", key: "enter" } },
    { label: "Tab", payload: { action: "key", key: "tab" } },
    { label: "Ctrl A", payload: { action: "hotkey", keys: ["ctrl", "a"] } },
    { label: "Copy", payload: { action: "key", key: "copy" } },
    { label: "Paste", payload: { action: "key", key: "paste" } },
    { label: "Backspace", payload: { action: "key", key: "backspace" } },
    { label: "Delete", payload: { action: "key", key: "delete" } }
  ];

  return (
    <div className={`remote-control-panel ${focusMode ? "focus-mode" : ""}`}>
      <div className="panel-toolbar">
        <button type="button" className="secondary-button" onClick={onBack}>
          <ChevronRight size={16} />
          Trang chủ
        </button>
        <button type="button" className={liveMode ? "danger-soft-button" : "secondary-button"} onClick={toggleLive}>
          <MonitorSmartphone size={16} />
          {liveMode ? "Dừng live" : "Live"}
        </button>
        <button type="button" className="secondary-button" onClick={refreshScreen} disabled={busy && !liveMode}>
          <RefreshCw className={busy ? "spin" : ""} size={16} />
          {liveMode ? "Nối lại" : "Làm mới"}
        </button>
        <button type="button" className="secondary-button" onClick={() => setFocusMode((value) => !value)}>
          {focusMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          {focusMode ? "Thu gọn" : "Màn lớn"}
        </button>
      </div>

      <section className="remote-control-settings">
        <div className="section-heading">
          <h2>Stream</h2>
          <SlidersHorizontal size={18} />
        </div>
        <div className="remote-profile-toggle" aria-label="Chất lượng stream">
          {(Object.keys(REMOTE_STREAM_PROFILES) as RemoteStreamProfile[]).map((profileKey) => (
            <button
              key={profileKey}
              type="button"
              className={streamProfile === profileKey ? "selected" : ""}
              onClick={() => {
                setStreamProfile(profileKey);
                setStreamNonce((value) => value + 1);
              }}
            >
              {REMOTE_STREAM_PROFILES[profileKey].label}
            </button>
          ))}
        </div>
        <label className="remote-sensitivity">
          <span>Độ nhạy</span>
          <input
            type="range"
            min="1"
            max="3"
            step="0.1"
            value={touchSensitivity}
            onChange={(event) => setTouchSensitivity(Number(event.target.value))}
          />
          <strong>{touchSensitivity.toFixed(1)}x</strong>
        </label>
      </section>

      <section className="remote-screen-card">
        <div className="remote-screen-head">
          <div>
            <span>Màn hình laptop</span>
            <strong>{screen ? `${screen.width} x ${screen.height}` : liveMode ? "Live stream" : "Chưa có khung hình"}</strong>
          </div>
          <small>{liveMode ? "MJPEG" : "Manual"}</small>
        </div>
        <div className={`remote-screen-stage ${hasScreenImage ? "" : "empty"}`}>
          {hasScreenImage ? (
            <img
              src={screenImageSrc}
              alt="Laptop screen"
              draggable={false}
              onLoad={() => {
                if (liveMode) setMessage("Live stream đang chạy");
              }}
              onError={() => {
                if (!liveMode) return;
                setMessage("Không mở được live stream. Đang chuyển sang làm mới thủ công.");
                setLiveMode(false);
                void loadScreen();
              }}
              onPointerDown={handleScreenPointerDown}
              onPointerUp={handleScreenPointerUp}
            />
          ) : (
            <div>
              <MonitorSmartphone size={42} />
              <strong>Chưa có khung hình</strong>
            </div>
          )}
        </div>
        <div className="remote-status-row">
          <span>{message}</span>
          <span>{liveMode ? "Live" : screen?.capturedAt ? shortTimeLabel(screen.capturedAt) : ""}</span>
        </div>
      </section>

      <section className="remote-input-grid">
        <div className="remote-touchpad" onPointerDown={handleTouchpadDown} onPointerMove={handleTouchpadMove} onPointerUp={handleTouchpadUp}>
          <MousePointer2 size={28} />
          <strong>Touchpad</strong>
        </div>
        <div className="remote-mouse-actions">
          <button type="button" className="secondary-button" onClick={() => sendAtLastPoint("double_tap")}>
            <MousePointerClick size={16} />
            Double
          </button>
          <button type="button" className="secondary-button" onClick={() => sendAtLastPoint("right_tap")}>
            <MousePointerClick size={16} />
            Chuột phải
          </button>
          <button type="button" className="secondary-button" onClick={() => void sendRemoteInput({ action: "scroll", deltaY: -360 }, false)}>
            <ChevronRight size={16} />
            Lên
          </button>
          <button type="button" className="secondary-button" onClick={() => void sendRemoteInput({ action: "scroll", deltaY: 360 }, false)}>
            <ChevronRight size={16} />
            Xuống
          </button>
        </div>
      </section>

      <section className="remote-keyboard-card">
        <div className="section-heading">
          <h2>Phím nhanh</h2>
          <Keyboard size={18} />
        </div>
        <div className="remote-shortcuts">
          {shortcuts.map((item) => (
            <button key={item.label} type="button" onClick={() => void sendRemoteInput(item.payload)}>
              {item.label}
            </button>
          ))}
        </div>
        <form className="remote-text-form" onSubmit={submitText}>
          <input value={textDraft} onChange={(event) => setTextDraft(event.target.value)} placeholder="Nhập text" />
          <button type="submit" className="primary-button" disabled={!textDraft.trim()}>
            <Clipboard size={16} />
            Dán
          </button>
        </form>
      </section>
    </div>
  );
}

function ExpensesView({
  expenses,
  onBack,
  onAdd,
  onCloseExpense,
  onCloseReady,
  onDelete,
  onEnableNotifications,
  onExport,
  onImport,
  onReopenExpense,
  onReset,
  onUpdate
}: {
  expenses: LivingExpense[];
  onBack: () => void;
  onAdd: () => void;
  onCloseExpense: (id: string) => void;
  onCloseReady: () => void;
  onDelete: (id: string) => void;
  onEnableNotifications: () => void;
  onExport: () => void;
  onImport: () => void;
  onReopenExpense: (id: string) => void;
  onReset: () => void;
  onUpdate: (id: string, patch: Partial<LivingExpense>) => void;
}) {
  const [selectedId, setSelectedId] = useState("");
  const totals = summarizeLivingExpenses(expenses);
  const unpaidExpenses = expenses.filter((expense) => !isExpensePaid(expense));
  const readyExpenses = unpaidExpenses.filter((expense) => canCloseExpense(expense));
  const dueExpenses = unpaidExpenses.filter((expense) => daysUntilDue(expense.dueDay) <= 0);
  const nextExpense = expenses
    .filter((expense) => !isExpensePaid(expense))
    .sort((left, right) => daysUntilDue(left.dueDay) - daysUntilDue(right.dueDay))[0];
  const taskExpenses = [
    ...dueExpenses,
    ...readyExpenses.filter((expense) => !dueExpenses.some((due) => due.id === expense.id)),
    ...unpaidExpenses
      .filter(
        (expense) =>
          !dueExpenses.some((due) => due.id === expense.id) && !readyExpenses.some((ready) => ready.id === expense.id)
      )
      .sort((left, right) => daysUntilDue(left.dueDay) - daysUntilDue(right.dueDay))
  ].slice(0, 3);
  const kindMeta = (expense: LivingExpense) => {
    if (expense.kind === "rent") return { icon: Home, label: "Trọ", className: "rent" };
    if (expense.kind === "electricity") return { icon: Zap, label: "Điện", className: "electricity" };
    if (expense.kind === "water") return { icon: Droplets, label: "Nước", className: "water" };
    return { icon: ReceiptText, label: "Khác", className: "other" };
  };
  const selectedExpense = expenses.find((expense) => expense.id === selectedId);

  if (selectedExpense) {
    return (
      <ExpenseDetailView
        expense={selectedExpense}
        kindMeta={kindMeta(selectedExpense)}
        onBack={() => setSelectedId("")}
        onCloseExpense={onCloseExpense}
        onDelete={onDelete}
        onReopenExpense={onReopenExpense}
        onUpdate={onUpdate}
      />
    );
  }

  return (
    <div className="expenses-panel">
      <div className="expenses-toolbar">
        <button type="button" className="secondary-button" onClick={onBack}>
          <ChevronRight size={16} />
          Trang chủ
        </button>
        <button type="button" className="secondary-button" onClick={onAdd}>
          <Plus size={16} />
          Thêm khoản
        </button>
        <button type="button" className="secondary-button" onClick={onCloseReady} disabled={!readyExpenses.length}>
          <Check size={16} />
          Đóng sẵn
        </button>
        <button type="button" className="secondary-button" onClick={onEnableNotifications}>
          <Bell size={16} />
          Bật nhắc
        </button>
        <button type="button" className="secondary-button" onClick={onExport}>
          <Download size={16} />
          Sao lưu
        </button>
        <button type="button" className="secondary-button" onClick={onImport}>
          <Save size={16} />
          Khôi phục
        </button>
        <button type="button" className="danger-soft-button" onClick={onReset}>
          <RotateCcw size={16} />
          Đặt lại
        </button>
      </div>

      <section className="living-summary" aria-label="Tổng thu chi">
        <div className="living-summary-title">
          <div>
            <span>{currentMonthLabel()}</span>
            <strong>{moneyLabel(totals.total)}</strong>
          </div>
          <Banknote size={28} />
        </div>
        <div className="bill-summary-grid">
          <div>
            <span>Cần đóng</span>
            <strong>{moneyLabel(totals.unpaid)}</strong>
          </div>
          <div>
            <span>Đã đóng</span>
            <strong>{moneyLabel(totals.paid)}</strong>
          </div>
          <div>
            <span>Hạn gần</span>
            <strong>{nextExpense ? `Ngày ${nextExpense.dueDay}` : "Đã xong"}</strong>
          </div>
        </div>
      </section>

      <section className="expense-assist-panel" aria-label="Việc cần làm">
        <div className="expense-assist-header">
          <div>
            <span>Việc cần làm</span>
            <strong>{dueExpenses.length ? `${dueExpenses.length} khoản tới hạn` : readyExpenses.length ? `${readyExpenses.length} khoản sẵn sàng` : "Đang ổn"}</strong>
          </div>
          <ReceiptText size={22} />
        </div>
        <div className="expense-assist-list">
          {taskExpenses.length ? (
            taskExpenses.map((expense) => (
              <button type="button" key={expense.id} onClick={() => setSelectedId(expense.id)}>
                <span>{expense.label}</span>
                <strong>
                  {canCloseExpense(expense)
                    ? "Đã đủ dữ liệu"
                    : expense.mode === "metered"
                      ? "Chờ số mới"
                      : "Chờ số tiền"}
                </strong>
                <small>{expenseStatusText(expense)}</small>
              </button>
            ))
          ) : (
            <div className="expense-assist-empty">
              <strong>Không còn khoản phải xử lý</strong>
              <span>Tháng này đã được lưu đủ.</span>
            </div>
          )}
        </div>
      </section>

      <div className="expense-list">
        {expenses.map((expense) => {
          const total = expenseMonthTotal(expense);
          const statusText = expenseStatusText(expense);
          const statusTone = expenseStatusTone(expense);
          const meta = kindMeta(expense);
          const Icon = meta.icon;
          const latestRecord = expense.history[0];
          const compareRecord = previousExpenseRecord(expense);
          const delta = compareRecord ? expenseTotalDelta(expense) : 0;

          return (
            <button type="button" className="expense-card-button" key={expense.id} onClick={() => setSelectedId(expense.id)}>
              <div className="expense-row-header">
                <div className={`expense-icon ${meta.className}`}>
                  <Icon size={18} />
                </div>
                <div className="expense-title">
                  <strong>{expense.label}</strong>
                  <span>{meta.label} · hạn ngày {expense.dueDay}</span>
                </div>
                <span className={`expense-status ${statusTone}`}>{statusText}</span>
              </div>
              <div className="expense-card-metrics">
                {expense.mode === "metered" ? (
                  <>
                    <div>
                      <span>Số cũ</span>
                      <strong>{numberLabel(expense.previousReading)}</strong>
                    </div>
                    <div>
                      <span>Số mới</span>
                      <strong>{expense.currentReading ? numberLabel(expense.currentReading) : "--"}</strong>
                    </div>
                    <div>
                      <span>Đơn giá</span>
                      <strong>{moneyLabel(expense.unitPrice)}</strong>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <span>Tiền tháng</span>
                      <strong>{moneyLabel(expense.amount)}</strong>
                    </div>
                    <div>
                      <span>Lịch sử</span>
                      <strong>{expense.history.length} tháng</strong>
                    </div>
                  </>
                )}
              </div>
              <div className="expense-total-row compact">
                <span>{compareRecord ? expenseTrendText(delta) : latestRecord ? `Gần nhất: ${monthLabel(latestRecord.month)}` : "Chưa có lịch sử"}</span>
                <strong>{moneyLabel(total)}</strong>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ExpenseDetailView({
  expense,
  kindMeta,
  onBack,
  onCloseExpense,
  onDelete,
  onReopenExpense,
  onUpdate
}: {
  expense: LivingExpense;
  kindMeta: { icon: typeof Mail; label: string; className: string };
  onBack: () => void;
  onCloseExpense: (id: string) => void;
  onDelete: (id: string) => void;
  onReopenExpense: (id: string) => void;
  onUpdate: (id: string, patch: Partial<LivingExpense>) => void;
}) {
  const total = expenseMonthTotal(expense);
  const usage = expenseUsage(expense);
  const paidRecord = currentExpenseRecord(expense);
  const paid = isExpensePaid(expense);
  const compareRecord = previousExpenseRecord(expense);
  const delta = compareRecord ? expenseTotalDelta(expense) : 0;
  const averageAmount = averageExpenseAmount(expense);
  const reminderText = expense.reminderEnabled
    ? `Nhắc trước ${expense.remindBeforeDays} ngày${expense.overdueReminder ? ", lặp quá hạn" : ""}`
    : "Đã tắt nhắc";
  const canDelete = !DEFAULT_LIVING_EXPENSES.some((item) => item.id === expense.id);
  const closeDisabled = !canCloseExpense(expense);
  const Icon = kindMeta.icon;
  const updateNumber = (
    key: "dueDay" | "remindBeforeDays" | "amount" | "unitPrice" | "previousReading" | "currentReading",
    value: string
  ) =>
    onUpdate(expense.id, {
      [key]: key === "dueDay" ? clampDueDay(value) : key === "remindBeforeDays" ? clampReminderDays(value) : cleanNumber(value)
    } as Partial<LivingExpense>);
  const applyLastRecord = () => {
    if (!compareRecord) return;
    onUpdate(
      expense.id,
      expense.mode === "metered"
        ? {
            unitPrice: compareRecord.unitPrice || expense.unitPrice,
            previousReading: compareRecord.currentReading || expense.previousReading
          }
        : {
            amount: compareRecord.amount || expense.amount
          }
    );
  };

  return (
    <div className="expense-detail">
      <div className="expenses-toolbar">
        <button type="button" className="secondary-button" onClick={onBack}>
          <ChevronRight size={16} />
          Thu chi
        </button>
        {paid ? (
          <button type="button" className="secondary-button" onClick={() => onReopenExpense(expense.id)}>
            <RotateCcw size={16} />
            Mở lại
          </button>
        ) : null}
        {canDelete ? (
          <button type="button" className="danger-soft-button" onClick={() => onDelete(expense.id)}>
            <Trash2 size={16} />
            Xóa
          </button>
        ) : null}
      </div>

      <section className="expense-focus">
        <div className="expense-row-header">
          <div className={`expense-icon ${kindMeta.className}`}>
            <Icon size={19} />
          </div>
          <div className="expense-title">
            <strong>{expense.label}</strong>
            <span>{kindMeta.label} · hạn ngày {expense.dueDay}</span>
          </div>
          <span className={`expense-status ${expenseStatusTone(expense)}`}>{expenseStatusText(expense)}</span>
        </div>
        <div className="expense-amount-block">
          <span>Tổng cần đóng</span>
          <strong>{moneyLabel(total)}</strong>
        </div>
        <div className="expense-insight-grid">
          <div>
            <span>So với tháng trước</span>
            <strong>{compareRecord ? expenseTrendText(delta) : "Chưa có"}</strong>
          </div>
          <div>
            <span>Trung bình 6 tháng</span>
            <strong>{averageAmount ? moneyLabel(averageAmount) : "Chưa có"}</strong>
          </div>
          <div>
            <span>Nhắc đóng tiền</span>
            <strong>{reminderText}</strong>
          </div>
        </div>
      </section>

      <section className="expense-row">
        <div className="expense-fields">
          <label className="expense-field wide">
            Tên
            <input value={expense.label} onChange={(event) => onUpdate(expense.id, { label: event.target.value })} />
          </label>
          <label className="expense-field">
            Hạn ngày
            <input
              type="number"
              min="1"
              max="31"
              inputMode="numeric"
              value={expense.dueDay}
              onChange={(event) => updateNumber("dueDay", event.target.value)}
            />
          </label>
          <label className="expense-field">
            Nhắc trước
            <input
              type="number"
              min="0"
              max="14"
              inputMode="numeric"
              value={expense.remindBeforeDays}
              onChange={(event) => updateNumber("remindBeforeDays", event.target.value)}
            />
          </label>
          <label className="expense-field">
            Loại
            <select value={expense.kind} onChange={(event) => onUpdate(expense.id, { kind: event.target.value as BillKind })}>
              <option value="rent">Trọ</option>
              <option value="electricity">Điện</option>
              <option value="water">Nước</option>
              <option value="other">Khác</option>
            </select>
          </label>
          <label className="expense-field">
            Cách tính
            <select value={expense.mode} onChange={(event) => onUpdate(expense.id, { mode: event.target.value as BillMode })}>
              <option value="fixed">Cố định</option>
              <option value="metered">Theo số</option>
            </select>
          </label>
          <label className="expense-toggle">
            <input
              type="checkbox"
              checked={expense.reminderEnabled}
              onChange={(event) => onUpdate(expense.id, { reminderEnabled: event.target.checked })}
            />
            <span>Nhắc trên điện thoại</span>
          </label>
          <label className="expense-toggle">
            <input
              type="checkbox"
              checked={expense.overdueReminder}
              onChange={(event) => onUpdate(expense.id, { overdueReminder: event.target.checked })}
            />
            <span>Nhắc lại quá hạn</span>
          </label>

          {expense.mode === "metered" ? (
            <>
              <div className="reading-lock">
                <span>Số cũ tháng trước</span>
                <strong>{numberLabel(expense.previousReading)}</strong>
              </div>
              {expense.history.length === 0 ? (
                <label className="expense-field">
                  Số cũ ban đầu
                  <input
                    type="number"
                    min="0"
                    inputMode="decimal"
                    value={expense.previousReading}
                    onChange={(event) => updateNumber("previousReading", event.target.value)}
                  />
                </label>
              ) : null}
              <label className="expense-field">
                Số mới
                <input
                  type="number"
                  min="0"
                  inputMode="decimal"
                  value={expense.currentReading || ""}
                  onChange={(event) => updateNumber("currentReading", event.target.value)}
                  placeholder="Nhập chỉ số mới"
                />
              </label>
              <label className="expense-field">
                Đơn giá / khối
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={expense.unitPrice || ""}
                  onChange={(event) => updateNumber("unitPrice", event.target.value)}
                />
              </label>
            </>
          ) : (
            <label className="expense-field">
              Tiền tháng
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={expense.amount || ""}
                onChange={(event) => updateNumber("amount", event.target.value)}
              />
            </label>
          )}
          <label className="expense-field wide">
            Ghi chú
            <input value={expense.note || ""} onChange={(event) => onUpdate(expense.id, { note: event.target.value })} />
          </label>
        </div>

        <div className="expense-total-row">
          <span>
            {expense.mode === "metered"
              ? paidRecord
                ? `${numberLabel(paidRecord.previousReading)} → ${numberLabel(paidRecord.currentReading)} · ${numberLabel(paidRecord.usage)} khối`
                : `${numberLabel(usage)} khối x ${moneyLabel(expense.unitPrice)}`
              : "Tổng tháng"}
          </span>
          <strong>{moneyLabel(total)}</strong>
        </div>

        <div className="expense-actions">
          {compareRecord ? (
            <button type="button" className="secondary-button" onClick={applyLastRecord}>
              <Repeat2 size={16} />
              Dùng tháng trước
            </button>
          ) : null}
          <button type="button" className={paid ? "secondary-button" : "primary-button"} onClick={() => onCloseExpense(expense.id)} disabled={closeDisabled || paid}>
            <Check size={16} />
            {paid ? "Đã lưu tháng này" : "Đã đóng tiền"}
          </button>
        </div>
      </section>

      <section className="expense-history">
        <div className="section-heading">
          <h2>Lịch sử theo tháng</h2>
        </div>
        {expense.history.length === 0 ? (
          <div className="empty-state compact">
            <ReceiptText size={34} />
            <h2>Chưa có lịch sử</h2>
            <p>Sau khi bấm Đã đóng tiền, tháng này sẽ được lưu ở đây.</p>
          </div>
        ) : (
          <div className="history-list">
            {expense.history.map((record, index) => {
              const beforeRecord = expense.history[index + 1];
              const recordDelta = beforeRecord ? record.amount - beforeRecord.amount : 0;
              const paidDate = shortDateLabel(record.paidAt);
              return (
                <article className="history-row" key={record.month}>
                  <div>
                    <strong>{monthLabel(record.month)}</strong>
                    <span>
                      {expense.mode === "metered"
                        ? `${numberLabel(record.previousReading)} → ${numberLabel(record.currentReading)} · ${numberLabel(record.usage)} khối`
                        : "Cố định"}
                      {paidDate ? ` · đóng ${paidDate}` : ""}
                    </span>
                    {record.note ? <span>{record.note}</span> : null}
                  </div>
                  <div className="history-amount">
                    <strong>{moneyLabel(record.amount)}</strong>
                    {beforeRecord ? <span>{expenseTrendText(recordDelta)}</span> : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
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
          Trang chủ
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
  onBack,
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
  onBack: () => void;
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
        <button type="button" className="secondary-button" onClick={onBack}>
          <ChevronRight size={16} />
          Trang chủ
        </button>
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
  onBack,
  onRefresh,
  onDisconnect
}: {
  groups: PermissionGroup[];
  busy: boolean;
  onBack: () => void;
  onRefresh: () => void;
  onDisconnect: () => void;
}) {
  return (
    <div className="permission-panel">
      <div className="panel-toolbar">
        <button type="button" className="secondary-button" onClick={onBack}>
          <ChevronRight size={16} />
          Trang chủ
        </button>
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
