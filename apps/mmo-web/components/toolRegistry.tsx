import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";
import {
	Binary,
	BookOpen,
	Braces,
	CalendarClock,
	Camera,
	Clock,
	Coins,
	Code,
	CreditCard,
	Database,
	DollarSign,
	ExternalLink,
	FileJson,
	FileText,
	Filter,
	Fingerprint,
	Globe,
	GraduationCap,
	GitCompare,
	Hash,
	Image as ImageIcon,
	KeyRound,
	Link as LinkIcon,
	Mail,
	Megaphone,
	Palette,
	PenLine,
	QrCode,
	Calculator,
	Scan,
	Scale,
	Search,
	Shield,
	ShieldCheck,
	Sparkles,
	Smartphone,
	Table,
	TrendingUp,
	Type,
	Upload,
	User,
	Users,
} from "lucide-react";
import ApiResponseViewer from "./tools/ApiResponseViewer";
import CanonicalBuilder from "./tools/CanonicalBuilder";
import ContentWriterTool from "./tools/ContentWriterTool";
import CreditCardGen from "./tools/CreditCardGen";
import CronParser from "./tools/CronParser";
import CryptoConverter from "./tools/CryptoConverter";
import DataOfficeTool from "./tools/DataOfficeTool";
import DesignCreativeTool from "./tools/DesignCreativeTool";
import DiffChecker from "./tools/DiffChecker";
import DomainWhois from "./tools/DomainWhois";
import EducationTool from "./tools/EducationTool";
import EnvManager from "./tools/EnvManager";
import FakeIdentity from "./tools/FakeIdentity";
import FancyText from "./tools/FancyText";
import FileUpload from "./tools/FileUpload";
import FinanceTool from "./tools/FinanceTool";
import GlobalTime from "./tools/GlobalTime";
import HashTool from "./tools/HashTool";
import HrRecruitTool from "./tools/HrRecruitTool";
import HttpClient from "./tools/HttpClient";
import IdGenerator from "./tools/IdGenerator";
import ImageTools from "./tools/ImageTools";
import JsonDiffTool from "./tools/JsonDiffTool";
import JsonFormatter from "./tools/JsonFormatter";
import JsonSchemaValidator from "./tools/JsonSchemaValidator";
import JwtTool from "./tools/JwtTool";
import KeyValueLineFormatter from "./tools/KeyValueLineFormatter";
import KeywordExtractorTool from "./tools/KeywordExtractorTool";
import LegalDocsTool from "./tools/LegalDocsTool";
import ListExtractor from "./tools/ListExtractor";
import LoremFaker from "./tools/LoremFaker";
import MarketingSeoTool from "./tools/MarketingSeoTool";
import MarkdownPreviewTool from "./tools/MarkdownPreviewTool";
import Notepad from "./tools/Notepad";
import OutlineHeadlineTool from "./tools/OutlineHeadlineTool";
import PasswordGenerator from "./tools/PasswordGenerator";
import PhotographyTool from "./tools/PhotographyTool";
import QRGenerator from "./tools/QRGenerator";
import QRScanner from "./tools/QRScanner";
import ReadabilityTool from "./tools/ReadabilityTool";
import RedirectTester from "./tools/RedirectTester";
import RegexTester from "./tools/RegexTester";
import SalesTool from "./tools/SalesTool";
import SeoMetaPreview from "./tools/SeoMetaPreview";
import SeoOgChecker from "./tools/SeoOgChecker";
import SeoSitemapRobots from "./tools/SeoSitemapRobots";
import SimilarityChecker from "./tools/SimilarityChecker";
import SqlFormatter from "./tools/SqlFormatter";
import TempMailClient from "./tools/TempMailClient";
import TextTools from "./tools/TextTools";
import TimestampTool from "./tools/TimestampTool";
import TwoFAGenerator from "./tools/TwoFAGenerator";
import UrlShortener from "./tools/UrlShortener";
import UserAgentGen from "./tools/UserAgentGen";
import UuidTool from "./tools/UuidTool";
import VietQRGenerator from "./tools/VietQRGenerator";
import WhoisLookup from "./tools/WhoisLookup";
import YamlJsonTool from "./tools/YamlJsonTool";

export type Lang = "en" | "vi";
export type LangText = { en: string; vi: string };

export type ToolGroupKey =
	| "utilities"
	| "network"
	| "dev"
	| "seo"
	| "content"
	| "industry"
	| "security"
	| "qr";

export type ToolGuideDefinition = {
	title: LangText;
	purpose: LangText;
	steps: LangText[];
	tips?: LangText[];
};

export type ToolDefinition = {
	id: string;
	path: string;
	group: ToolGroupKey;
	name: LangText;
	desc: LangText;
	icon: LucideIcon;
	color: string;
	component: ComponentType;
	guide: ToolGuideDefinition;
};

export type ToolGroupDefinition = {
	key: ToolGroupKey;
	title: LangText;
};

export type ToolNavItem = {
	path: string;
	name: string;
	desc: string;
	icon: LucideIcon;
	color: string;
};

export type ToolGroup = {
	key: ToolGroupKey;
	title: string;
	items: ToolNavItem[];
};

const textFor = (text: LangText, lang: Lang) =>
	lang === "vi" ? text.vi : text.en;

export const toolGroupDefinitions: ToolGroupDefinition[] = [
	{ key: "utilities", title: { en: "Utilities", vi: "Tiện ích" } },
	{ key: "network", title: { en: "Network", vi: "Mạng" } },
	{ key: "dev", title: { en: "Dev Tools", vi: "Công cụ dev" } },
	{ key: "seo", title: { en: "SEO / Web", vi: "SEO / Web" } },
	{ key: "content", title: { en: "Content", vi: "Nội dung" } },
	{
		key: "industry",
		title: { en: "Industry Tools", vi: "Công cụ ngành" },
	},
	{ key: "security", title: { en: "Security", vi: "Bảo mật" } },
	{ key: "qr", title: { en: "QR & Links", vi: "QR & Link" } },
];

export const toolDefinitions: ToolDefinition[] = [
	{
		id: "fake-identity",
		path: "/fake-identity",
		group: "utilities",
		name: { en: "Fake Identity", vi: "Thông tin ảo" },
		desc: {
			en: "US Profile: Name, SSN, Address",
			vi: "Hồ sơ Mỹ: tên, SSN, địa chỉ",
		},
		icon: User,
		color: "text-neon-cyan",
		component: FakeIdentity,
		guide: {
			title: { en: "Fake Identity", vi: "Fake Identity" },
			purpose: {
				en: "Generate sample identity data for testing.",
				vi: "Tạo dữ liệu định danh mẫu để test.",
			},
			steps: [
				{ en: "Generate a sample identity.", vi: "Tạo thông tin mẫu." },
				{
					en: "Review name, address, and other fields.",
					vi: "Xem tên, địa chỉ, thông tin.",
				},
				{
					en: "Copy what you need.",
					vi: "Sao chép phần cần dùng.",
				},
			],
		},
	},
	{
		id: "cc-gen",
		path: "/cc-gen",
		group: "utilities",
		name: { en: "CC Generator", vi: "Tạo số thẻ" },
		desc: {
			en: "Valid Luhn Visa/Mastercard/Amex",
			vi: "Số thẻ hợp lệ theo Luhn",
		},
		icon: CreditCard,
		color: "text-pink-400",
		component: CreditCardGen,
		guide: {
			title: { en: "Credit Card Generator", vi: "Tạo Số Thẻ" },
			purpose: {
				en: "Generate test card numbers that pass Luhn (for testing only).",
				vi: "Tạo số thẻ test theo Luhn (chỉ dùng test).",
			},
			steps: [
				{
					en: "Select card type and options.",
					vi: "Chọn loại thẻ và tùy chọn.",
				},
				{
					en: "Generate test numbers.",
					vi: "Tạo số thẻ test.",
				},
				{
					en: "Copy for testing only.",
					vi: "Chỉ dùng cho test.",
				},
			],
		},
	},
	{
		id: "global-time",
		path: "/global-time",
		group: "utilities",
		name: { en: "Global Time", vi: "Giờ thế giới" },
		desc: {
			en: "Airdrop/Minting Clock Converter",
			vi: "Chuyển đổi thời gian mint/airdrop",
		},
		icon: Clock,
		color: "text-yellow-400",
		component: GlobalTime,
		guide: {
			title: { en: "Global Time", vi: "Giờ Thế Giới" },
			purpose: {
				en: "Convert between time zones for scheduling.",
				vi: "Chuyển đổi múi giờ để lên lịch.",
			},
			steps: [
				{
					en: "Pick a timezone or city.",
					vi: "Chọn múi giờ thành phố.",
				},
				{
					en: "Convert between zones.",
					vi: "Chuyển đổi giữa các múi giờ.",
				},
				{
					en: "Use the converted time for scheduling.",
					vi: "Dùng cho lịch trình.",
				},
			],
		},
	},
	{
		id: "ua-gen",
		path: "/ua-gen",
		group: "utilities",
		name: { en: "User Agent Gen", vi: "Tạo User Agent" },
		desc: {
			en: "Fake device strings for automation",
			vi: "Chuỗi thiết bị giả cho automation",
		},
		icon: Smartphone,
		color: "text-purple-400",
		component: UserAgentGen,
		guide: {
			title: { en: "User Agent Generator", vi: "Tạo User Agent" },
			purpose: {
				en: "Create realistic user-agent strings for testing.",
				vi: "Tạo chuỗi user-agent để test/automation.",
			},
			steps: [
				{
					en: "Choose device/OS/browser filters.",
					vi: "Chọn loại thiết bị/OS/trình duyệt.",
				},
				{
					en: "Generate a user-agent string.",
					vi: "Tạo chuỗi user-agent.",
				},
				{
					en: "Copy and use in your tool/script.",
					vi: "Sao chép để sử dụng.",
				},
			],
		},
	},
	{
		id: "diff",
		path: "/diff",
		group: "utilities",
		name: { en: "Diff Checker", vi: "So sánh text" },
		desc: { en: "Compare text differences", vi: "So sánh khác biệt văn bản" },
		icon: GitCompare,
		color: "text-orange-400",
		component: DiffChecker,
		guide: {
			title: { en: "Diff Checker", vi: "So Sánh Text" },
			purpose: {
				en: "Compare two texts to see differences.",
				vi: "So sánh hai đoạn text để thấy khác biệt.",
			},
			steps: [
				{
					en: "Paste original and modified text.",
					vi: "Dán 2 đoạn text.",
				},
				{ en: "Click Compare.", vi: "Nhấn Compare." },
				{
					en: "Switch between split and unified view.",
					vi: "Chọn chế độ split/unified.",
				},
			],
		},
	},
	{
		id: "json-format",
		path: "/json-format",
		group: "utilities",
		name: { en: "JSON/XML Format", vi: "Định dạng JSON/XML" },
		desc: {
			en: "Beautify, Minify & Validate Data",
			vi: "Làm đẹp, rút gọn, kiểm tra dữ liệu",
		},
		icon: FileJson,
		color: "text-green-400",
		component: JsonFormatter,
		guide: {
			title: { en: "JSON / XML Formatter", vi: "Định Dạng JSON/XML" },
			purpose: {
				en: "Beautify or minify JSON/XML for readability.",
				vi: "Làm đẹp hoặc rút gọn JSON/XML.",
			},
			steps: [
				{ en: "Paste JSON or XML input.", vi: "Dán JSON hoặc XML." },
				{
					en: "Click Beautify/Minify or Parse JSON String.",
					vi: "Chọn Beautify/Minify hoặc Parse JSON String.",
				},
				{ en: "Copy formatted output.", vi: "Sao chép kết quả." },
			],
		},
	},
	{
		id: "kv-line-format",
		path: "/kv-line-format",
		group: "utilities",
		name: { en: "Key : Value Line Formatter", vi: "Chuẩn hóa dòng key : value" },
		desc: {
			en: "Fix line breaks between key, colon, and value",
			vi: "Ghép dòng key, dấu hai chấm và value",
		},
		icon: Braces,
		color: "text-emerald-400",
		component: KeyValueLineFormatter,
		guide: {
			title: { en: "Key : Value Line Formatter", vi: "Chuẩn hóa dòng key : value" },
			purpose: {
				en: "Convert DevTools-like line breaks into single key : value lines.",
				vi: "Chuyển dữ liệu bị xuống dòng thành dạng key : value.",
			},
			steps: [
				{
					en: "Paste the raw text where key, ':', value are on separate lines.",
					vi: "Dán dữ liệu có dạng key, ':', value trên từng dòng.",
				},
				{ en: "Click Transform.", vi: "Nhấn Biến đổi." },
				{ en: "Copy the formatted output.", vi: "Sao chép kết quả." },
			],
		},
	},
	{
		id: "extractor",
		path: "/extractor",
		group: "utilities",
		name: { en: "List Extractor", vi: "Tách danh sách" },
		desc: {
			en: "Extract Email/IP/Proxy from text",
			vi: "Tách email/IP/proxy từ text",
		},
		icon: Filter,
		color: "text-orange-400",
		component: ListExtractor,
		guide: {
			title: { en: "List Extractor", vi: "Tách Danh Sách" },
			purpose: {
				en: "Extract emails, IPs, or proxies from raw text.",
				vi: "Tách email, IP, proxy từ text.",
			},
			steps: [
				{
					en: "Paste raw text with mixed data.",
					vi: "Dán đoạn text tổng hợp.",
				},
				{
					en: "Choose the target type (email, IP, etc.).",
					vi: "Chọn loại cần tách (email, IP...).",
				},
				{ en: "Extract and copy the list.", vi: "Sao chép danh sách." },
			],
		},
	},
	{
		id: "text-tools",
		path: "/text-tools",
		group: "utilities",
		name: { en: "Text Obfuscator", vi: "Công cụ văn bản" },
		desc: {
			en: "Base64, URL, Hex Encoder/Decoder",
			vi: "Encode/Decode Base64, URL, Hex",
		},
		icon: Binary,
		color: "text-green-500",
		component: TextTools,
		guide: {
			title: { en: "Text Tools", vi: "Công Cụ Văn Bản" },
			purpose: {
				en: "Encode/decode text for debugging and data handling.",
				vi: "Encode/decode văn bản để debug dữ liệu.",
			},
			steps: [
				{
					en: "Select Base64/URL/Hex and Encode/Decode.",
					vi: "Chọn Base64/URL/Hex và Encode/Decode.",
				},
				{ en: "Paste input text.", vi: "Dán nội dung cần xử lý." },
				{ en: "Run convert and copy output.", vi: "Chạy và sao chép kết quả." },
			],
		},
	},
	{
		id: "fancy-text",
		path: "/fancy-text",
		group: "utilities",
		name: { en: "Fancy Text", vi: "Fancy Text" },
		desc: {
			en: "Glitch, Bold, Script Text Gen",
			vi: "Tạo text glitch, đậm, script",
		},
		icon: Sparkles,
		color: "text-pink-500",
		component: FancyText,
		guide: {
			title: { en: "Fancy Text", vi: "Fancy Text" },
			purpose: {
				en: "Create stylized text for social or design use.",
				vi: "Tạo chữ cách điệu cho nội dung.",
			},
			steps: [
				{ en: "Type your text input.", vi: "Nhập text." },
				{ en: "Pick a style.", vi: "Chọn style." },
				{ en: "Copy the stylized result.", vi: "Sao chép kết quả." },
			],
		},
	},
	{
		id: "image-tools",
		path: "/image-tools",
		group: "utilities",
		name: { en: "Image Tools", vi: "Công cụ ảnh" },
		desc: {
			en: "Compress, Resize & Convert Images",
			vi: "Nén, đổi kích thước, chuyển đổi ảnh",
		},
		icon: ImageIcon,
		color: "text-pink-300",
		component: ImageTools,
		guide: {
			title: { en: "Image Tools", vi: "Công Cụ Ảnh" },
			purpose: {
				en: "Resize, compress, or convert image formats.",
				vi: "Resize, nén và đổi định dạng ảnh.",
			},
			steps: [
				{ en: "Upload an image file.", vi: "Upload ảnh." },
				{
					en: "Adjust format, quality, and width.",
					vi: "Chỉnh format, quality, width.",
				},
				{ en: "Convert and download the result.", vi: "Chuyển đổi và tải về." },
			],
		},
	},
	{
		id: "crypto",
		path: "/crypto",
		group: "utilities",
		name: { en: "Crypto Convert", vi: "Chuyển đổi Crypto" },
		desc: {
			en: "ETH ↔ Gwei ↔ Wei Calculator",
			vi: "Chuyển đổi ETH ↔ Gwei ↔ Wei",
		},
		icon: Calculator,
		color: "text-cyan-400",
		component: CryptoConverter,
		guide: {
			title: { en: "Crypto Converter", vi: "Chuyển Đổi Crypto" },
			purpose: {
				en: "Convert between ETH, Gwei, and Wei units.",
				vi: "Chuyển đổi giữa ETH, Gwei, Wei.",
			},
			steps: [
				{ en: "Enter a value in ETH/Gwei/Wei.", vi: "Nhập giá trị ETH/Gwei/Wei." },
				{ en: "Convert to other units.", vi: "Chuyển đổi qua đơn vị khác." },
				{ en: "Copy the result if needed.", vi: "Sao chép kết quả." },
			],
		},
	},
	{
		id: "notepad",
		path: "/notepad",
		group: "utilities",
		name: { en: "Notepad", vi: "Ghi chú" },
		desc: {
			en: "Markdown editor & Distraction-free mode",
			vi: "Trình soạn thảo Markdown",
		},
		icon: FileText,
		color: "text-yellow-500",
		component: Notepad,
		guide: {
			title: { en: "Notepad", vi: "Ghi Chú" },
			purpose: {
				en: "Quickly write and format notes (Markdown).",
				vi: "Ghi chú nhanh, hỗ trợ Markdown.",
			},
			steps: [
				{
					en: "Write notes in the editor (Markdown supported).",
					vi: "Nhập nội dung (hỗ trợ Markdown).",
				},
				{ en: "Use preview or focus mode if available.", vi: "Xem preview nếu cần." },
				{ en: "Copy or keep notes for later use.", vi: "Sao chép hoặc lưu tạm thời." },
			],
		},
	},
	{
		id: "temp-mail",
		path: "/temp-mail",
		group: "utilities",
		name: { en: "Temp Mail", vi: "Email tạm" },
		desc: { en: "Disposable email addresses", vi: "Email dùng một lần" },
		icon: Mail,
		color: "text-orange-500",
		component: TempMailClient,
		guide: {
			title: { en: "Temporary Email", vi: "Email Tạm" },
			purpose: {
				en: "Create disposable inboxes for quick signups and testing.",
				vi: "Tạo hộp thư tạm cho đăng ký/test nhanh.",
			},
			steps: [
				{
					en: "Generate a new address or reuse current one.",
					vi: "Tạo địa chỉ mới hoặc dùng lại địa chỉ cũ.",
				},
				{
					en: "Copy the address and receive mail.",
					vi: "Sao chép địa chỉ để nhận mail.",
				},
				{ en: "Click an email to read details.", vi: "Mở email để xem chi tiết." },
			],
		},
	},
	{
		id: "upload",
		path: "/upload",
		group: "utilities",
		name: { en: "File Share", vi: "Chia sẻ file" },
		desc: { en: "Temporary secure file upload", vi: "Upload file tạm thời" },
		icon: Upload,
		color: "text-indigo-500",
		component: FileUpload,
		guide: {
			title: { en: "File Upload", vi: "Chia Sẻ File" },
			purpose: {
				en: "Share files quickly using public file hosts.",
				vi: "Chia sẻ file nhanh qua dịch vụ công khai.",
			},
			steps: [
				{ en: "Choose a provider.", vi: "Chọn nhà cung cấp." },
				{ en: "Select a file to upload.", vi: "Chọn file cần upload." },
				{ en: "Copy or open the share link.", vi: "Sao chép hoặc mở link." },
			],
			tips: [
				{
					en: "Public services may limit size or rate.",
					vi: "Dịch vụ công khai có thể giới hạn dung lượng/lượt.",
				},
			],
		},
	},
	{
		id: "whois",
		path: "/whois",
		group: "network",
		name: { en: "WHOIS / IP", vi: "WHOIS / IP" },
		desc: { en: "IP Location, ISP & ASN Info", vi: "Vị trí IP, ISP và ASN" },
		icon: Globe,
		color: "text-cyan-500",
		component: WhoisLookup,
		guide: {
			title: { en: "WHOIS / IP Lookup", vi: "WHOIS / IP" },
			purpose: {
				en: "Check domain/IP ownership, location, and network info.",
				vi: "Tra cứu thông tin domain/IP, ISP và vị trí.",
			},
			steps: [
				{ en: "Enter a domain or IP address.", vi: "Nhập domain hoặc IP." },
				{ en: "Run the lookup.", vi: "Chạy tra cứu." },
				{ en: "Review registrar, ASN, and location info.", vi: "Xem registrar, ASN, vị trí." },
			],
		},
	},
	{
		id: "domain",
		path: "/domain",
		group: "network",
		name: { en: "Domain Whois", vi: "Domain Whois" },
		desc: {
			en: "Registrar, Age & Name Servers",
			vi: "Registrar, tuổi miền, name servers",
		},
		icon: Search,
		color: "text-pink-400",
		component: DomainWhois,
		guide: {
			title: { en: "Domain WHOIS", vi: "Domain WHOIS" },
			purpose: {
				en: "Get detailed WHOIS info for a domain.",
				vi: "Xem thông tin WHOIS chi tiết của tên miền.",
			},
			steps: [
				{ en: "Enter a domain name.", vi: "Nhập tên miền." },
				{ en: "Run the lookup.", vi: "Chạy tra cứu." },
				{ en: "Check registrar, age, and name servers.", vi: "Xem registrar, tuổi miền, name server." },
			],
		},
	},
	{
		id: "id-gen",
		path: "/id-gen",
		group: "dev",
		name: { en: "ID Generator", vi: "Tạo ID" },
		desc: { en: "UUIDv4, ULID, Nanoid", vi: "UUIDv4, ULID, Nanoid" },
		icon: Fingerprint,
		color: "text-cyan-400",
		component: IdGenerator,
		guide: {
			title: { en: "ID Generator", vi: "Tạo ID" },
			purpose: {
				en: "Generate UUID, ULID, or Nanoid identifiers.",
				vi: "Tạo UUID/ULID/Nanoid cho định danh.",
			},
			steps: [
				{ en: "Choose UUID/ULID/Nanoid.", vi: "Chọn UUID/ULID/Nanoid." },
				{ en: "Set count (and size for Nanoid).", vi: "Nhập số lượng (và size với Nanoid)." },
				{ en: "Generate and copy IDs.", vi: "Tạo và sao chép." },
			],
		},
	},
	{
		id: "timestamp",
		path: "/timestamp",
		group: "dev",
		name: { en: "Timestamp", vi: "Timestamp" },
		desc: { en: "Unix, ISO & Local time", vi: "Unix, ISO và giờ local" },
		icon: Clock,
		color: "text-yellow-400",
		component: TimestampTool,
		guide: {
			title: { en: "Timestamp Converter", vi: "Chuyển Đổi Timestamp" },
			purpose: {
				en: "Convert between Unix, ISO, and local time.",
				vi: "Chuyển đổi Unix, ISO và giờ địa phương.",
			},
			steps: [
				{
					en: "Enter a date/time or unix timestamp.",
					vi: "Nhập date/time hoặc unix timestamp.",
				},
				{
					en: "Convert between ISO, local, seconds, and ms.",
					vi: "Chuyển đổi ISO, local, seconds, ms.",
				},
				{ en: "Copy the result block.", vi: "Sao chép kết quả." },
			],
		},
	},
	{
		id: "regex",
		path: "/regex",
		group: "dev",
		name: { en: "Regex Tester", vi: "Regex Tester" },
		desc: { en: "Match, groups & flags", vi: "Match, group và flags" },
		icon: Code,
		color: "text-purple-400",
		component: RegexTester,
		guide: {
			title: { en: "Regex Tester", vi: "Regex Tester" },
			purpose: {
				en: "Test regex patterns against text.",
				vi: "Test regex với dữ liệu thực.",
			},
			steps: [
				{ en: "Enter pattern and flags.", vi: "Nhập pattern và flags." },
				{ en: "Paste test text.", vi: "Dán text cần test." },
				{ en: "Review matches and copy if needed.", vi: "Xem match và group." },
			],
		},
	},
	{
		id: "hash",
		path: "/hash",
		group: "dev",
		name: { en: "Hash Utils", vi: "Hash Utils" },
		desc: { en: "MD5 & SHA hashes", vi: "MD5 và SHA" },
		icon: Hash,
		color: "text-green-400",
		component: HashTool,
		guide: {
			title: { en: "Hash Utilities", vi: "Hash Utilities" },
			purpose: {
				en: "Generate hashes for text (MD5/SHA).",
				vi: "Tạo hash cho text (MD5/SHA).",
			},
			steps: [
				{ en: "Select a hash algorithm.", vi: "Chọn thuật toán hash." },
				{ en: "Paste input text.", vi: "Dán text đầu vào." },
				{ en: "Compute and copy hex/base64.", vi: "Tính và sao chép hex/base64." },
			],
		},
	},
	{
		id: "jwt",
		path: "/jwt",
		group: "dev",
		name: { en: "JWT Tool", vi: "JWT Tool" },
		desc: { en: "Decode, encode, verify HS256", vi: "Decode, encode, verify HS256" },
		icon: KeyRound,
		color: "text-red-400",
		component: JwtTool,
		guide: {
			title: { en: "JWT Tool", vi: "JWT Tool" },
			purpose: {
				en: "Decode, encode, and verify JWTs (HS256).",
				vi: "Decode/encode/verify JWT (HS256).",
			},
			steps: [
				{
					en: "Paste a token to decode, or edit header/payload.",
					vi: "Dán token để decode hoặc sửa header/payload.",
				},
				{
					en: "Provide secret for HS256 if verifying/encoding.",
					vi: "Nhập secret nếu verify/encode HS256.",
				},
				{ en: "Encode or verify and copy the token.", vi: "Encode/verify và sao chép token." },
			],
		},
	},
	{
		id: "json-schema",
		path: "/json-schema",
		group: "dev",
		name: { en: "JSON Schema", vi: "JSON Schema" },
		desc: { en: "Validate JSON with schema", vi: "Validate JSON theo schema" },
		icon: ShieldCheck,
		color: "text-emerald-400",
		component: JsonSchemaValidator,
		guide: {
			title: { en: "JSON Schema Validator", vi: "Kiểm Tra JSON Schema" },
			purpose: {
				en: "Validate JSON data against a schema.",
				vi: "Kiểm tra JSON theo schema.",
			},
			steps: [
				{ en: "Paste schema and data JSON.", vi: "Dán schema và data JSON." },
				{ en: "Click Validate.", vi: "Nhấn Validate." },
				{ en: "Review errors or success status.", vi: "Xem lỗi hoặc hợp lệ." },
			],
		},
	},
	{
		id: "sql-format",
		path: "/sql-format",
		group: "dev",
		name: { en: "SQL Formatter", vi: "Định dạng SQL" },
		desc: { en: "Clean & readable SQL", vi: "SQL dễ đọc" },
		icon: Database,
		color: "text-blue-400",
		component: SqlFormatter,
		guide: {
			title: { en: "SQL Formatter", vi: "Định Dạng SQL" },
			purpose: {
				en: "Format SQL for readability.",
				vi: "Làm đẹp câu lệnh SQL.",
			},
			steps: [
				{ en: "Paste SQL statement.", vi: "Dán câu lệnh SQL." },
				{ en: "Click Format.", vi: "Nhấn Format." },
				{ en: "Copy formatted SQL.", vi: "Sao chép SQL đã định dạng." },
			],
		},
	},
	{
		id: "http-client",
		path: "/http-client",
		group: "dev",
		name: { en: "HTTP Client", vi: "HTTP Client" },
		desc: {
			en: "Send requests & build curl",
			vi: "Gửi request và tạo curl",
		},
		icon: Globe,
		color: "text-cyan-300",
		component: HttpClient,
		guide: {
			title: { en: "HTTP Client", vi: "HTTP Client" },
			purpose: {
				en: "Send HTTP requests and generate curl.",
				vi: "Gửi request HTTP và tạo curl.",
			},
			steps: [
				{
					en: "Set method, URL, headers, and body.",
					vi: "Chọn method, URL, headers, body.",
				},
				{
					en: "Send request and review response.",
					vi: "Gửi request và xem response.",
				},
				{ en: "Copy curl if needed.", vi: "Sao chép curl nếu cần." },
			],
			tips: [
				{
					en: "Some endpoints may block CORS in browser.",
					vi: "Một số API bị chặn CORS trên trình duyệt.",
				},
			],
		},
	},
	{
		id: "cron",
		path: "/cron",
		group: "dev",
		name: { en: "Cron Parser", vi: "Cron Parser" },
		desc: { en: "Next 5 runs from cron", vi: "5 lần chạy tiếp theo" },
		icon: CalendarClock,
		color: "text-orange-400",
		component: CronParser,
		guide: {
			title: { en: "Cron Parser", vi: "Cron Parser" },
			purpose: {
				en: "See upcoming run times from a cron expression.",
				vi: "Xem lịch chạy tiếp theo từ cron.",
			},
			steps: [
				{ en: "Enter a 5-field cron expression.", vi: "Nhập cron 5 trường." },
				{ en: "Pick base time.", vi: "Chọn thời gian gốc." },
				{ en: "Generate the next 5 runs.", vi: "Xem 5 lần chạy tiếp theo." },
			],
		},
	},
	{
		id: "lorem",
		path: "/lorem",
		group: "dev",
		name: { en: "Lorem/Faker", vi: "Lorem/Faker" },
		desc: { en: "Lorem ipsum & fake data", vi: "Lorem ipsum và dữ liệu mẫu" },
		icon: Type,
		color: "text-pink-400",
		component: LoremFaker,
		guide: {
			title: { en: "Lorem & Fake Data", vi: "Lorem & Fake Data" },
			purpose: {
				en: "Generate placeholder text and fake records.",
				vi: "Tạo lorem và dữ liệu mẫu.",
			},
			steps: [
				{ en: "Set paragraph or user count.", vi: "Chọn số đoạn hoặc số user." },
				{ en: "Generate lorem or fake users.", vi: "Tạo lorem hoặc fake users." },
				{ en: "Copy the output.", vi: "Sao chép kết quả." },
			],
		},
	},
	{
		id: "api-viewer",
		path: "/api-viewer",
		group: "dev",
		name: { en: "API Viewer", vi: "Xem API" },
		desc: { en: "Pretty JSON responses", vi: "Làm đẹp JSON response" },
		icon: Braces,
		color: "text-cyan-300",
		component: ApiResponseViewer,
		guide: {
			title: { en: "API Response Viewer", vi: "Xem API Response" },
			purpose: {
				en: "Beautify and inspect JSON responses.",
				vi: "Làm đẹp và kiểm tra JSON response.",
			},
			steps: [
				{ en: "Paste a JSON response.", vi: "Dán response JSON." },
				{ en: "Beautify or collapse the output.", vi: "Làm đẹp hoặc rút gọn." },
				{ en: "Copy formatted JSON.", vi: "Sao chép JSON đã format." },
			],
		},
	},
	{
		id: "json-diff",
		path: "/json-diff",
		group: "dev",
		name: { en: "JSON Diff", vi: "So sánh JSON" },
		desc: { en: "Structural JSON differences", vi: "Khác biệt JSON theo cấu trúc" },
		icon: GitCompare,
		color: "text-orange-400",
		component: JsonDiffTool,
		guide: {
			title: { en: "JSON Diff", vi: "So Sánh JSON" },
			purpose: {
				en: "Compare two JSON objects structurally.",
				vi: "So sánh hai JSON theo cấu trúc.",
			},
			steps: [
				{ en: "Paste JSON A and JSON B.", vi: "Dán JSON A và JSON B." },
				{ en: "Click Compare.", vi: "Nhấn So sánh." },
				{ en: "Review added/removed/changed paths.", vi: "Xem các path khác biệt." },
			],
		},
	},
	{
		id: "env-manager",
		path: "/env-manager",
		group: "dev",
		name: { en: "ENV Manager", vi: "Quản lý ENV" },
		desc: { en: "Sort and mask .env", vi: "Sắp xếp và ẩn .env" },
		icon: FileText,
		color: "text-emerald-400",
		component: EnvManager,
		guide: {
			title: { en: "ENV Manager", vi: "Quản Lý ENV" },
			purpose: {
				en: "Sort and mask .env files safely.",
				vi: "Sắp xếp và ẩn .env an toàn.",
			},
			steps: [
				{ en: "Paste .env content.", vi: "Dán nội dung .env." },
				{ en: "Enable/disable masking.", vi: "Bật/tắt ẩn giá trị." },
				{ en: "Copy sorted output.", vi: "Sao chép kết quả." },
			],
		},
	},
	{
		id: "uuid-check",
		path: "/uuid-check",
		group: "dev",
		name: { en: "UUID Validator", vi: "Kiểm tra UUID" },
		desc: { en: "Validate and parse UUIDs", vi: "Kiểm tra và đọc UUID" },
		icon: Fingerprint,
		color: "text-cyan-400",
		component: UuidTool,
		guide: {
			title: { en: "UUID Validator", vi: "Kiểm Tra UUID" },
			purpose: {
				en: "Validate UUIDs and read basic info.",
				vi: "Kiểm tra UUID và xem thông tin cơ bản.",
			},
			steps: [
				{ en: "Paste a UUID.", vi: "Dán UUID." },
				{ en: "Check validity and version.", vi: "Xem hợp lệ và phiên bản." },
				{ en: "Use the result for debugging.", vi: "Dùng cho debug." },
			],
		},
	},
	{
		id: "yaml-json",
		path: "/yaml-json",
		group: "dev",
		name: { en: "YAML ↔ JSON", vi: "YAML ↔ JSON" },
		desc: { en: "Convert YAML and JSON", vi: "Chuyển đổi YAML và JSON" },
		icon: FileJson,
		color: "text-green-400",
		component: YamlJsonTool,
		guide: {
			title: { en: "YAML ↔ JSON", vi: "YAML ↔ JSON" },
			purpose: {
				en: "Convert between YAML and JSON (basic YAML).",
				vi: "Chuyển đổi YAML và JSON (YAML cơ bản).",
			},
			steps: [
				{ en: "Choose conversion direction.", vi: "Chọn chiều chuyển đổi." },
				{ en: "Paste input data.", vi: "Dán dữ liệu vào." },
				{ en: "Copy the converted output.", vi: "Sao chép kết quả." },
			],
		},
	},
	{
		id: "seo-meta",
		path: "/seo-meta",
		group: "seo",
		name: { en: "Meta Preview", vi: "Xem trước Meta" },
		desc: { en: "Google/OG preview", vi: "Xem trước Google/OG" },
		icon: Megaphone,
		color: "text-orange-400",
		component: SeoMetaPreview,
		guide: {
			title: { en: "SEO Meta Preview", vi: "Xem Trước SEO" },
			purpose: {
				en: "Preview how pages appear in search and social.",
				vi: "Xem trước hiển thị trên search/social.",
			},
			steps: [
				{
					en: "Fill title, description, URL and image.",
					vi: "Nhập title, description, URL, image.",
				},
				{ en: "Review the preview cards.", vi: "Xem preview các thẻ." },
				{ en: "Adjust for better CTR.", vi: "Điều chỉnh để tăng CTR." },
			],
		},
	},
	{
		id: "seo-sitemap",
		path: "/seo-sitemap",
		group: "seo",
		name: { en: "Sitemap & Robots", vi: "Sitemap & Robots" },
		desc: { en: "Generate sitemap.xml", vi: "Tạo sitemap.xml" },
		icon: FileText,
		color: "text-blue-400",
		component: SeoSitemapRobots,
		guide: {
			title: { en: "Sitemap & Robots", vi: "Sitemap & Robots" },
			purpose: {
				en: "Generate sitemap.xml and robots.txt.",
				vi: "Tạo sitemap.xml và robots.txt.",
			},
			steps: [
				{
					en: "Enter base URL and paths.",
					vi: "Nhập URL gốc và danh sách path.",
				},
				{ en: "Copy sitemap and robots content.", vi: "Sao chép sitemap và robots." },
				{ en: "Upload to your website.", vi: "Đưa lên website." },
			],
		},
	},
	{
		id: "seo-og",
		path: "/seo-og",
		group: "seo",
		name: { en: "OG Checker", vi: "Kiểm tra OG" },
		desc: { en: "Check Open Graph tags", vi: "Kiểm tra tag Open Graph" },
		icon: ShieldCheck,
		color: "text-emerald-400",
		component: SeoOgChecker,
		guide: {
			title: { en: "Open Graph Checker", vi: "Kiểm Tra Open Graph" },
			purpose: {
				en: "Check required Open Graph meta tags.",
				vi: "Kiểm tra các tag Open Graph bắt buộc.",
			},
			steps: [
				{ en: "Paste HTML content.", vi: "Dán HTML." },
				{ en: "Review missing tags.", vi: "Xem tag thiếu." },
				{ en: "Fix and re-check.", vi: "Sửa và kiểm tra lại." },
			],
		},
	},
	{
		id: "redirect-test",
		path: "/redirect-test",
		group: "seo",
		name: { en: "Redirect Tester", vi: "Kiểm tra chuyển hướng" },
		desc: { en: "Status and location", vi: "Trạng thái và location" },
		icon: ExternalLink,
		color: "text-blue-300",
		component: RedirectTester,
		guide: {
			title: { en: "Redirect Tester", vi: "Kiểm Tra Chuyển Hướng" },
			purpose: {
				en: "Inspect redirect status and Location header.",
				vi: "Xem status và Location header.",
			},
			steps: [
				{ en: "Enter a URL.", vi: "Nhập URL." },
				{ en: "Run the test.", vi: "Chạy kiểm tra." },
				{ en: "Check status and location.", vi: "Xem status và location." },
			],
		},
	},
	{
		id: "canonical",
		path: "/canonical",
		group: "seo",
		name: { en: "Canonical Builder", vi: "Tạo Canonical" },
		desc: {
			en: "Canonical & hreflang tags",
			vi: "Tag canonical & hreflang",
		},
		icon: LinkIcon,
		color: "text-purple-400",
		component: CanonicalBuilder,
		guide: {
			title: { en: "Canonical & Hreflang", vi: "Canonical & Hreflang" },
			purpose: {
				en: "Generate canonical and hreflang link tags.",
				vi: "Tạo tag canonical và hreflang.",
			},
			steps: [
				{ en: "Enter canonical URL.", vi: "Nhập canonical URL." },
				{ en: "Add hreflang lines.", vi: "Thêm danh sách hreflang." },
				{ en: "Copy tags into HTML.", vi: "Sao chép tag vào HTML." },
			],
		},
	},
	{
		id: "readability",
		path: "/readability",
		group: "content",
		name: { en: "Readability", vi: "Độ dễ đọc" },
		desc: { en: "Counts and readability", vi: "Đếm và độ dễ đọc" },
		icon: BookOpen,
		color: "text-indigo-400",
		component: ReadabilityTool,
		guide: {
			title: { en: "Readability Analyzer", vi: "Độ Dễ Đọc" },
			purpose: {
				en: "Measure readability and reading time.",
				vi: "Đo độ dễ đọc và thời gian đọc.",
			},
			steps: [
				{ en: "Paste your content.", vi: "Dán nội dung." },
				{ en: "Review readability metrics.", vi: "Xem các chỉ số." },
				{ en: "Adjust for clarity.", vi: "Điều chỉnh cho dễ đọc." },
			],
		},
	},
	{
		id: "outline",
		path: "/outline",
		group: "content",
		name: { en: "Outline & Headlines", vi: "Dàn ý & Tiêu đề" },
		desc: { en: "Templates for content", vi: "Mẫu tiêu đề và dàn ý" },
		icon: PenLine,
		color: "text-pink-400",
		component: OutlineHeadlineTool,
		guide: {
			title: { en: "Outline & Headlines", vi: "Dàn Ý & Tiêu Đề" },
			purpose: {
				en: "Generate content outlines and headline ideas.",
				vi: "Tạo dàn ý và gợi ý tiêu đề.",
			},
			steps: [
				{ en: "Enter topic and keywords.", vi: "Nhập chủ đề và từ khóa." },
				{ en: "Review suggested headlines.", vi: "Xem danh sách tiêu đề." },
				{ en: "Copy outline templates.", vi: "Sao chép dàn ý mẫu." },
			],
		},
	},
	{
		id: "markdown",
		path: "/markdown",
		group: "content",
		name: { en: "Markdown Preview", vi: "Xem Markdown" },
		desc: { en: "Preview rendered markdown", vi: "Xem trước Markdown" },
		icon: FileText,
		color: "text-yellow-400",
		component: MarkdownPreviewTool,
		guide: {
			title: { en: "Markdown Preview", vi: "Xem Markdown" },
			purpose: {
				en: "Preview Markdown as HTML.",
				vi: "Xem trước Markdown thành HTML.",
			},
			steps: [
				{ en: "Paste Markdown content.", vi: "Dán nội dung Markdown." },
				{ en: "Preview the rendered result.", vi: "Xem kết quả render." },
				{ en: "Copy or refine.", vi: "Sao chép hoặc chỉnh sửa." },
			],
		},
	},
	{
		id: "keywords",
		path: "/keywords",
		group: "content",
		name: { en: "Keyword Extractor", vi: "Tách từ khóa" },
		desc: { en: "Extract top keywords", vi: "Tách từ khóa nổi bật" },
		icon: Filter,
		color: "text-green-400",
		component: KeywordExtractorTool,
		guide: {
			title: { en: "Keyword Extractor", vi: "Tách Từ Khóa" },
			purpose: {
				en: "Extract top keywords from text.",
				vi: "Tách các từ khóa nổi bật.",
			},
			steps: [
				{ en: "Paste text content.", vi: "Dán nội dung." },
				{ en: "Set top keyword count.", vi: "Chọn số lượng từ khóa." },
				{ en: "Copy the keyword list.", vi: "Sao chép danh sách." },
			],
		},
	},
	{
		id: "similarity",
		path: "/similarity",
		group: "content",
		name: { en: "Similarity Checker", vi: "Độ tương đồng" },
		desc: { en: "Text similarity score", vi: "Điểm tương đồng text" },
		icon: GitCompare,
		color: "text-orange-400",
		component: SimilarityChecker,
		guide: {
			title: { en: "Similarity Checker", vi: "Độ Tương Đồng" },
			purpose: {
				en: "Estimate text similarity with n-grams.",
				vi: "Ước lượng độ tương đồng văn bản.",
			},
			steps: [
				{ en: "Paste two texts.", vi: "Dán 2 đoạn văn." },
				{ en: "Review similarity score.", vi: "Xem điểm tương đồng." },
				{ en: "Use for quick checks.", vi: "Dùng để kiểm tra nhanh." },
			],
		},
	},
	{
		id: "design",
		path: "/design",
		group: "industry",
		name: { en: "Design & Creative", vi: "Thiết kế & Sáng tạo" },
		desc: { en: "Resize, watermark, compress", vi: "Resize, watermark, nén" },
		icon: Palette,
		color: "text-pink-400",
		component: DesignCreativeTool,
		guide: {
			title: { en: "Design & Creative", vi: "Design & Creative" },
			purpose: {
				en: "Quickly export images with watermark and resize.",
				vi: "Xuất ảnh nhanh với watermark và resize.",
			},
			steps: [
				{ en: "Upload an image.", vi: "Upload ảnh." },
				{
					en: "Adjust format, size, watermark, and quality.",
					vi: "Chỉnh format, size, watermark, quality.",
				},
				{ en: "Export and download the result.", vi: "Export và tải về." },
			],
		},
	},
	{
		id: "marketing",
		path: "/marketing",
		group: "industry",
		name: { en: "Marketing & SEO", vi: "Marketing & SEO" },
		desc: { en: "UTM, meta preview, slugify", vi: "UTM, meta preview, slugify" },
		icon: Megaphone,
		color: "text-orange-400",
		component: MarketingSeoTool,
		guide: {
			title: { en: "Marketing & SEO", vi: "Marketing & SEO" },
			purpose: {
				en: "Build UTM links and preview meta snippets.",
				vi: "Tạo UTM và xem trước meta.",
			},
			steps: [
				{
					en: "Fill UTM parameters to build a tracking URL.",
					vi: "Nhập UTM để tạo URL tracking.",
				},
				{ en: "Use slugify for clean URLs.", vi: "Dùng slugify cho URL gọn." },
				{ en: "Preview meta title/description.", vi: "Xem preview tiêu đề/mô tả." },
			],
		},
	},
	{
		id: "data-office",
		path: "/data-office",
		group: "industry",
		name: { en: "Data & Office", vi: "Dữ liệu & Office" },
		desc: { en: "CSV/TSV to JSON + dedupe", vi: "CSV/TSV sang JSON + dedupe" },
		icon: Table,
		color: "text-cyan-400",
		component: DataOfficeTool,
		guide: {
			title: { en: "Data & Office", vi: "Data & Office" },
			purpose: {
				en: "Convert CSV/TSV to JSON and clean lists.",
				vi: "Chuyển CSV/TSV sang JSON và làm sạch list.",
			},
			steps: [
				{ en: "Paste CSV/TSV data and set delimiter.", vi: "Dán CSV/TSV và chọn delimiter." },
				{ en: "Convert to JSON and copy.", vi: "Chuyển sang JSON và sao chép." },
				{ en: "Use Dedupe to remove duplicate lines.", vi: "Dedupe để xóa dòng trùng." },
			],
		},
	},
	{
		id: "content",
		path: "/content",
		group: "industry",
		name: { en: "Content & Writing", vi: "Nội dung & Viết" },
		desc: { en: "Counts, readability, outline", vi: "Đếm, readability, outline" },
		icon: PenLine,
		color: "text-purple-400",
		component: ContentWriterTool,
		guide: {
			title: { en: "Content & Writing", vi: "Content & Writing" },
			purpose: {
				en: "Analyze text and generate outlines.",
				vi: "Phân tích nội dung và tạo dàn ý.",
			},
			steps: [
				{ en: "Paste content to analyze.", vi: "Dán nội dung cần phân tích." },
				{ en: "Check word count and readability.", vi: "Xem word count và readability." },
				{ en: "Generate and copy outline.", vi: "Tạo và sao chép outline." },
			],
		},
	},
	{
		id: "photo",
		path: "/photo",
		group: "industry",
		name: { en: "Photography", vi: "Photography" },
		desc: { en: "Metadata strip & rename", vi: "Xóa metadata & đổi tên" },
		icon: Camera,
		color: "text-amber-400",
		component: PhotographyTool,
		guide: {
			title: { en: "Photography", vi: "Photography" },
			purpose: {
				en: "Strip metadata and prepare batch rename lists.",
				vi: "Xóa metadata ảnh và tạo list đổi tên.",
			},
			steps: [
				{ en: "Upload images to view info.", vi: "Upload ảnh để xem thông tin." },
				{ en: "Strip metadata by re-encoding.", vi: "Strip metadata bằng re-encode." },
				{ en: "Generate batch rename list.", vi: "Tạo danh sách đổi tên batch." },
			],
		},
	},
	{
		id: "finance",
		path: "/finance",
		group: "industry",
		name: { en: "Finance", vi: "Tài chính" },
		desc: { en: "VAT, discount, loan", vi: "VAT, giảm giá, vay" },
		icon: DollarSign,
		color: "text-emerald-400",
		component: FinanceTool,
		guide: {
			title: { en: "Finance", vi: "Finance" },
			purpose: {
				en: "Calculate VAT/discounts or loan payments.",
				vi: "Tính VAT/giảm giá hoặc khoản vay.",
			},
			steps: [
				{ en: "Choose VAT or Loan mode.", vi: "Chọn VAT hoặc Loan." },
				{ en: "Enter numbers.", vi: "Nhập số liệu." },
				{ en: "Read calculated totals.", vi: "Xem kết quả tính toán." },
			],
		},
	},
	{
		id: "education",
		path: "/education",
		group: "industry",
		name: { en: "Education", vi: "Giáo dục" },
		desc: { en: "Flashcards from notes", vi: "Flashcards từ ghi chú" },
		icon: GraduationCap,
		color: "text-indigo-400",
		component: EducationTool,
		guide: {
			title: { en: "Education", vi: "Education" },
			purpose: {
				en: "Turn notes into flashcards for study.",
				vi: "Chuyển ghi chú thành flashcards.",
			},
			steps: [
				{ en: "Paste notes or term:definition lines.", vi: "Dán ghi chú hoặc term:definition." },
				{ en: "Generate flashcards.", vi: "Tạo flashcards." },
				{ en: "Copy cards for study.", vi: "Sao chép để học." },
			],
		},
	},
	{
		id: "hr",
		path: "/hr",
		group: "industry",
		name: { en: "HR & Recruitment", vi: "Nhân sự & Tuyển dụng" },
		desc: { en: "JD format & CV clean", vi: "Format JD & làm sạch CV" },
		icon: Users,
		color: "text-blue-400",
		component: HrRecruitTool,
		guide: {
			title: { en: "HR & Recruitment", vi: "HR & Recruitment" },
			purpose: {
				en: "Format job descriptions and clean CV text.",
				vi: "Format JD và làm sạch CV.",
			},
			steps: [
				{ en: "Format JD into clean sections.", vi: "Format JD thành các mục rõ ràng." },
				{ en: "Clean CV text for readability.", vi: "Làm sạch CV để dễ đọc." },
				{ en: "Copy the cleaned output.", vi: "Sao chép kết quả." },
			],
		},
	},
	{
		id: "legal",
		path: "/legal",
		group: "industry",
		name: { en: "Legal & Docs", vi: "Pháp lý & Tài liệu" },
		desc: { en: "Redaction & NDA template", vi: "Redaction & mẫu NDA" },
		icon: Scale,
		color: "text-zinc-300",
		component: LegalDocsTool,
		guide: {
			title: { en: "Legal & Docs", vi: "Legal & Docs" },
			purpose: {
				en: "Redact sensitive info and use document templates.",
				vi: "Ẩn thông tin nhạy cảm và dùng mẫu tài liệu.",
			},
			steps: [
				{ en: "Paste text to redact sensitive data.", vi: "Dán text cần redaction." },
				{ en: "Provide keywords to mask.", vi: "Nhập keyword để mask." },
				{ en: "Use the NDA template if needed.", vi: "Dùng template NDA nếu cần." },
			],
		},
	},
	{
		id: "sales",
		path: "/sales",
		group: "industry",
		name: { en: "Sales", vi: "Bán hàng" },
		desc: { en: "Lead cleaner & scoring", vi: "Làm sạch lead & chấm điểm" },
		icon: TrendingUp,
		color: "text-green-400",
		component: SalesTool,
		guide: {
			title: { en: "Sales", vi: "Sales" },
			purpose: {
				en: "Clean lead lists and compute simple scores.",
				vi: "Làm sạch lead và chấm điểm cơ bản.",
			},
			steps: [
				{ en: "Paste lead list (CSV-like).", vi: "Dán danh sách lead (dạng CSV)." },
				{ en: "Clean and score leads.", vi: "Làm sạch và chấm điểm." },
				{ en: "Copy the output CSV.", vi: "Sao chép CSV đầu ra." },
			],
		},
	},
	{
		id: "password",
		path: "/password",
		group: "security",
		name: { en: "Password Gen", vi: "Tạo mật khẩu" },
		desc: {
			en: "Generate strong, secure passwords",
			vi: "Tạo mật khẩu mạnh",
		},
		icon: KeyRound,
		color: "text-green-400",
		component: PasswordGenerator,
		guide: {
			title: { en: "Password Generator", vi: "Tạo Mật Khẩu" },
			purpose: {
				en: "Create strong passwords for accounts or app testing.",
				vi: "Tạo mật khẩu mạnh cho tài khoản hoặc test.",
			},
			steps: [
				{
					en: "Set length and options (uppercase, numbers, symbols).",
					vi: "Chọn độ dài và tùy chọn (chữ hoa, số, ký tự đặc biệt).",
				},
				{ en: "Click Generate to create a new password.", vi: "Nhấn Generate để tạo mật khẩu." },
				{ en: "Copy the result to use it elsewhere.", vi: "Sao chép để sử dụng." },
			],
		},
	},
	{
		id: "2fa",
		path: "/2fa",
		group: "security",
		name: { en: "2FA Generator", vi: "Tạo mã 2FA" },
		desc: { en: "TOTP Code generator", vi: "Tạo mã TOTP" },
		icon: Shield,
		color: "text-red-500",
		component: TwoFAGenerator,
		guide: {
			title: { en: "2FA Generator", vi: "Tạo Mã 2FA" },
			purpose: {
				en: "Generate TOTP codes from a secret key.",
				vi: "Tạo mã TOTP từ secret key.",
			},
			steps: [
				{ en: "Paste your TOTP secret.", vi: "Dán secret TOTP." },
				{ en: "Choose options if available.", vi: "Chọn tùy chọn nếu có." },
				{ en: "Use the generated 6-digit code.", vi: "Sử dụng mã 6 số." },
			],
		},
	},
	{
		id: "qr-gen",
		path: "/qr-gen",
		group: "qr",
		name: { en: "QR Generator", vi: "Tạo QR" },
		desc: { en: "Create custom QR / Wifi codes", vi: "Tạo QR và Wi-Fi" },
		icon: QrCode,
		color: "text-pink-500",
		component: QRGenerator,
		guide: {
			title: { en: "QR Generator", vi: "Tạo QR" },
			purpose: {
				en: "Generate QR codes for text, URLs, or Wi-Fi sharing.",
				vi: "Tạo mã QR cho text, URL hoặc Wi-Fi.",
			},
			steps: [
				{ en: "Choose Text/URL or Wi-Fi mode.", vi: "Chọn chế độ Text/URL hoặc Wi-Fi." },
				{ en: "Fill the required fields and pick a color.", vi: "Nhập thông tin và chọn màu." },
				{ en: "Download the generated QR image.", vi: "Tải về ảnh QR." },
			],
		},
	},
	{
		id: "qr-scan",
		path: "/qr-scan",
		group: "qr",
		name: { en: "QR Scanner", vi: "Quét QR" },
		desc: { en: "Scan codes from camera or file", vi: "Quét QR từ ảnh" },
		icon: Scan,
		color: "text-purple-500",
		component: QRScanner,
		guide: {
			title: { en: "QR Scanner", vi: "Quét QR" },
			purpose: {
				en: "Decode QR codes from images to extract content.",
				vi: "Giải mã QR từ ảnh để lấy nội dung.",
			},
			steps: [
				{ en: "Upload a QR image (png/jpg).", vi: "Tải ảnh QR (png/jpg)." },
				{ en: "Wait for the scan result.", vi: "Đợi kết quả quét." },
				{ en: "Copy or open the scanned content.", vi: "Sao chép hoặc mở nội dung." },
			],
		},
	},
	{
		id: "vietqr",
		path: "/vietqr",
		group: "qr",
		name: { en: "VietQR Gen", vi: "Tạo VietQR" },
		desc: {
			en: "Vietnam Banking QR Standard",
			vi: "Chuẩn QR ngân hàng VN",
		},
		icon: Coins,
		color: "text-green-500",
		component: VietQRGenerator,
		guide: {
			title: { en: "VietQR Generator", vi: "Tạo VietQR" },
			purpose: {
				en: "Create VietQR payment codes for Vietnamese banking.",
				vi: "Tạo mã VietQR thanh toán ngân hàng VN.",
			},
			steps: [
				{ en: "Select bank and enter account info.", vi: "Chọn ngân hàng và nhập thông tin tài khoản." },
				{ en: "Add amount and note if needed.", vi: "Nhập số tiền và ghi chú (nếu cần)." },
				{ en: "Download the VietQR image.", vi: "Tải về ảnh VietQR." },
			],
		},
	},
	{
		id: "shorten",
		path: "/shorten",
		group: "qr",
		name: { en: "Link Shortener", vi: "Rút gọn link" },
		desc: { en: "Make long URLs short & sweet", vi: "Rút gọn URL dài" },
		icon: LinkIcon,
		color: "text-blue-500",
		component: UrlShortener,
		guide: {
			title: { en: "URL Shortener", vi: "Rút Gọn Link" },
			purpose: {
				en: "Create short links for sharing or campaigns.",
				vi: "Tạo link ngắn để chia sẻ hoặc chạy chiến dịch.",
			},
			steps: [
				{
					en: "Choose a provider (is.gd, v.gd, TinyURL).",
					vi: "Chọn nhà cung cấp (is.gd, v.gd, TinyURL).",
				},
				{ en: "Paste the long URL and click Shorten.", vi: "Dán link dài và nhấn Shorten." },
				{ en: "Copy the short link or open it.", vi: "Sao chép hoặc mở link rút gọn." },
			],
		},
	},
];

const toolByPath = new Map(toolDefinitions.map((tool) => [tool.path, tool]));

export const getToolGuide = (path: string, lang: Lang) => {
	const tool = toolByPath.get(path);
	if (!tool) return null;
	return {
		title: textFor(tool.guide.title, lang),
		purpose: textFor(tool.guide.purpose, lang),
		steps: tool.guide.steps.map((step) => textFor(step, lang)),
		tips: tool.guide.tips?.map((tip) => textFor(tip, lang)),
	};
};

export const getToolGroups = (
	t: (en: string, vi: string) => string
): ToolGroup[] => {
	return toolGroupDefinitions.map((group) => ({
		key: group.key,
		title: t(group.title.en, group.title.vi),
		items: toolDefinitions
			.filter((tool) => tool.group === group.key)
			.map((tool) => ({
				path: tool.path,
				name: t(tool.name.en, tool.name.vi),
				desc: t(tool.desc.en, tool.desc.vi),
				icon: tool.icon,
				color: tool.color,
			})),
	}));
};
