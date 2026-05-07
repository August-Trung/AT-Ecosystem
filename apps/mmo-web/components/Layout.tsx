import React, { useState, useEffect, createContext, useContext } from "react";
import ToolGuide from "./ToolGuide";
import { I18nProvider, useI18n } from "./i18n";
import { SettingsProvider, useSettings } from "./settings";
import { getToolGroups } from "./toolRegistry";
import {
	LayoutGrid,
	FileText,
	Coins,
	Menu,
	X,
	Heart,
	Copy,
	Check,
	Sliders,
	Star,
	Clock,
} from "lucide-react";

// --- CUSTOM ROUTER IMPLEMENTATION ---
// Replacing missing/incompatible react-router-dom modules
const RouterContext = createContext<{
	path: string;
	navigate: (p: string) => void;
}>({
	path: "/",
	navigate: () => {},
});

export const HashRouter = ({ children }: { children: React.ReactNode }) => {
	const [path, setPath] = useState(window.location.hash.substring(1) || "/");

	useEffect(() => {
		const handler = () => {
			setPath(window.location.hash.substring(1) || "/");
		};
		window.addEventListener("hashchange", handler);
		return () => window.removeEventListener("hashchange", handler);
	}, []);

	const navigate = (to: string) => {
		window.location.hash = to;
	};

	return (
		<RouterContext.Provider value={{ path, navigate }}>
			{children}
		</RouterContext.Provider>
	);
};

export const useLocation = () => {
	const { path } = useContext(RouterContext);
	return { pathname: path };
};

export const useNavigate = () => {
	const { navigate } = useContext(RouterContext);
	return navigate;
};

export const Routes = ({ children }: { children: React.ReactNode }) => {
	const { path } = useContext(RouterContext);
	let found: React.ReactNode = null;
	React.Children.forEach(children, (child) => {
		if (found) return;
		if (React.isValidElement(child)) {
			const { path: routePath, element } = child.props as any;
			if (routePath === path) {
				found = element;
			}
		}
	});
	return <>{found}</>;
};

export const Route = ({
	path,
	element,
}: {
	path: string;
	element: React.ReactNode;
}) => null;

export const RouterLink = ({ to, children, className, ...props }: any) => (
	<a href={`#${to}`} className={className} {...props}>
		{children}
	</a>
);
export const NavLink = ({ to, children, className, onClick }: any) => (
	<a href={`#${to}`} className={className} onClick={onClick}>
		{children}
	</a>
);
// --- END CUSTOM ROUTER ---

// --- Donate Modal Component ---
const DonateModal = ({
	isOpen,
	onClose,
}: {
	isOpen: boolean;
	onClose: () => void;
}) => {
	const [copied, setCopied] = useState(false);
	const { t } = useI18n();

	if (!isOpen) return null;

	// EDIT HERE: Change these values to your actual info
	const BANK_INFO = {
		bankBin: "970422", // MBBank
		accountNo: "0000865706803", // Example placeholder
		accountName: "NGUYEN MINH TRUNG",
	};

	const vietQrSrc = `https://img.vietqr.io/image/${BANK_INFO.bankBin}-${
		BANK_INFO.accountNo
	}-compact2.png?amount=0&addInfo=Donate%20AT%20Tools&accountName=${encodeURIComponent(
		BANK_INFO.accountName
	)}`;

	const copy = () => {
		navigator.clipboard.writeText(BANK_INFO.accountNo);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
			{/* Backdrop with Blur */}
			<div
				className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity"
				onClick={onClose}
			/>

			{/* Modal Content */}
			<div className="relative bg-dark-900 rounded-2xl border border-dark-700 w-full max-w-2xl overflow-hidden shadow-2xl shadow-neon-purple/20 animate-in fade-in zoom-in-95 duration-200">
				{/* Header */}
				<div className="p-6 border-b border-dark-700 flex justify-between items-center bg-dark-800/50">
					<h2 className="text-2xl font-bold text-white flex items-center gap-2">
						{t("Support", "Ủng hộ")}{" "}
						<span className="text-neon-purple">AT Tools</span>{" "}
						<Heart
							className="text-neon-pink fill-neon-pink animate-pulse"
							size={20}
						/>
					</h2>
					<button
						onClick={onClose}
						className="p-2 bg-dark-800 text-gray-400 hover:text-white hover:bg-red-500/20 rounded-full transition-all border border-dark-700 hover:border-red-500/50">
						<X size={20} />
					</button>
				</div>

				{/* Body */}
				<div className="p-8">
					<div className="flex flex-col md:flex-row gap-8 items-center justify-center">
						{/* QR Column */}
						<div className="bg-white p-4 rounded-xl shadow-lg transform hover:scale-105 transition-transform duration-300">
							<img
								src={vietQrSrc}
								alt="VietQR"
								className="w-48 h-48 md:w-56 md:h-56 object-contain"
							/>
						</div>

						{/* Info Column */}
						<div className="space-y-4 w-full md:w-auto flex-1">
							<div className="flex items-center gap-3 mb-2 text-neon-green">
								<Coins size={24} />
								<h3 className="text-lg font-bold">
									{t("Banking Transfer", "Chuyển khoản")}
								</h3>
							</div>

							<div className="bg-dark-800 p-3 rounded-xl border border-dark-700">
								<p className="text-xs text-gray-500 uppercase mb-1">
									{t("Bank Name", "Ngân hàng")}
								</p>
								<p className="font-bold text-white">
									MBBank (Quân Đội)
								</p>
							</div>

							<div
								className="bg-dark-800 p-3 rounded-xl border border-dark-700 group relative cursor-pointer hover:border-neon-green transition-colors"
								onClick={copy}>
								<p className="text-xs text-gray-500 uppercase mb-1">
									{t("Account Number", "Số tài khoản")}
								</p>
								<div className="flex items-center justify-between">
									<p className="font-mono text-xl text-neon-green font-bold tracking-wider">
										{BANK_INFO.accountNo}
									</p>
									<button className="text-gray-500 group-hover:text-white transition-colors">
										{copied ? (
											<Check
												size={18}
												className="text-green-500"
											/>
										) : (
											<Copy size={18} />
										)}
									</button>
								</div>
							</div>

							<div className="bg-dark-800 p-3 rounded-xl border border-dark-700">
								<p className="text-xs text-gray-500 uppercase mb-1">
									{t("Account Name", "Chủ tài khoản")}
								</p>
								<p className="font-bold text-white">
									{BANK_INFO.accountName}
								</p>
							</div>
						</div>
					</div>

					<div className="mt-8 text-center">
						<p className="text-sm text-gray-500">
							{t("Thank you for keeping the tools alive! ☕", "Cảm ơn bạn đã giúp duy trì công cụ! ☕")}
						</p>
					</div>
				</div>
			</div>
		</div>
	);
};

// --- Layout Component ---

interface LayoutProps {
	children: React.ReactNode;
}

const LayoutInner: React.FC<LayoutProps> = ({ children }) => {
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
	const [isDonateOpen, setIsDonateOpen] = useState(false);
	const location = useLocation();
	const navigate = useNavigate();
	const { lang, toggleLang, t } = useI18n();
	const { theme, compact } = useSettings();

	const RECENTS_KEY = "at_tools_recent";
	const toolGroups = getToolGroups(t);

	// Global Hotkey: Alt + N to open Notepad
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.altKey && (e.key === "n" || e.key === "N")) {
				e.preventDefault();
				navigate("/notepad");
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [navigate]);

	useEffect(() => {
		const path = location.pathname;
		const excluded = ["/", "/browse", "/favorites", "/recent", "/settings"];
		if (!path || excluded.includes(path)) return;
		try {
			const stored = localStorage.getItem(RECENTS_KEY);
			const list = stored ? (JSON.parse(stored) as string[]) : [];
			const next = [path, ...list.filter((p) => p !== path)].slice(0, 12);
			localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
		} catch {
			// ignore
		}
	}, [location.pathname]);

	const navGroups = [
		{
			title: t("Main", "Chính"),
			items: [
				{ path: "/browse", name: t("Browse", "Duyệt"), icon: LayoutGrid },
				{ path: "/favorites", name: t("Favorites", "Yêu thích"), icon: Star },
				{ path: "/recent", name: t("Recently Used", "Dùng gần đây"), icon: Clock },
				{ path: "/settings", name: t("Settings", "Cài đặt"), icon: Sliders },
			],
		},
		...toolGroups,
	];

	return (
		<div
			className={`h-screen overflow-hidden bg-dark-900 text-gray-200 flex font-sans selection:bg-neon-purple selection:text-white ${
				theme === "light" ? "theme-light" : "dark"
			}`}
		>
			{/* Mobile Menu Buttons */}
			<div className="lg:hidden fixed top-4 right-4 z-50 flex gap-2">
				<button
					className="p-2 bg-dark-800 rounded-lg border border-gray-800 text-yellow-500 shadow-lg shadow-black/50"
					onClick={() => navigate("/notepad")}
					title={t("Quick Note", "Ghi chú nhanh")}>
					<FileText />
				</button>
				<button
					className="p-2 bg-dark-800 rounded-lg border border-gray-800 text-neon-cyan shadow-lg shadow-black/50"
					onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
					{isMobileMenuOpen ? <X /> : <Menu />}
				</button>
			</div>

			{/* Sidebar */}
			<aside
				className={`
        fixed lg:static inset-y-0 left-0 z-40 w-64 transform transition-transform duration-300 ease-in-out
        bg-dark-900 border-r border-dark-700 ${compact ? "p-2" : "p-3"} flex flex-col
        ${
			isMobileMenuOpen
				? "translate-x-0"
				: "-translate-x-full lg:translate-x-0"
		}
      `}>
				<div className="flex items-center gap-3 px-4 py-4 mb-4">
					<img
						src="/ver-bigger-logo.png"
						alt="Logo"
						className="w-10 h-10 rounded-lg"
					/>
					<div className="flex-1">
						<h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
							AT Tools
						</h1>
						<p className="text-xs text-neon-green font-mono">
							v1.0.0
						</p>
					</div>
					<button
						onClick={toggleLang}
						className="px-2 py-1 text-xs font-bold rounded-md border border-dark-700 bg-dark-800 text-gray-300 hover:text-white hover:bg-dark-700">
						{lang === "vi" ? "VI" : "EN"}
					</button>
					{/* Desktop Quick Note Button */}
					<button
						onClick={() => navigate("/notepad")}
						className="p-2 bg-dark-800 text-gray-400 hover:text-yellow-500 hover:bg-dark-700 rounded-lg transition-colors border border-transparent hover:border-dark-600"
						title={t("Quick Note (Alt + N)", "Ghi chú nhanh (Alt + N)")}>
						<FileText size={18} />
					</button>
				</div>

				<nav className="flex-1 space-y-1 overflow-y-auto pr-2 custom-scrollbar">
					{navGroups.map((group) => (
						<div key={group.title}>
							<h3 className="px-4 py-2 text-sm font-semibold text-gray-400">
								{group.title}
							</h3>
							{group.items.map((item) => {
								const isActive =
									location.pathname === item.path;
								const Icon = item.icon;
								return (
									<NavLink
										key={item.path}
										to={item.path}
										onClick={() =>
											setIsMobileMenuOpen(false)
										}
										className={`
				  flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 font-medium text-sm
				  ${
						isActive
							? "bg-dark-800 text-neon-cyan shadow-[0_0_15px_-5px_rgba(0,243,255,0.3)] border border-dark-700"
							: "text-gray-400 hover:text-white hover:bg-dark-800/50"
					}
				`}>
										<Icon
											size={18}
											className={
												isActive
													? "text-neon-cyan"
													: "text-gray-500"
											}
										/>
										{item.name}
									</NavLink>
								);
							})}
						</div>
					))}
				</nav>

				<div className="mt-auto pt-6 border-t border-dark-800">
					<div className="p-4 rounded-xl bg-gradient-to-br from-dark-800 to-dark-900 border border-dark-700 text-center">
						<h3 className="text-sm font-bold text-white mb-1">
							{t("Support AT ☕", "Ủng hộ AT ☕")}
						</h3>
						<p className="text-xs text-gray-400 mb-3">
							{t("Keep the tools free & alive!", "Giữ công cụ miễn phí và duy trì!")}
						</p>
						<button
							onClick={() => {
								setIsDonateOpen(true);
								setIsMobileMenuOpen(false);
							}}
							className="w-full py-2 bg-neon-purple/10 hover:bg-neon-purple/20 text-neon-purple border border-neon-purple/30 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2">
							<Heart size={14} className="fill-neon-purple" />{" "}
							{t("DONATE", "ỦNG HỘ")}
						</button>
					</div>
				</div>
			</aside>

			{/* Main Content */}
			<main
				className={`flex-1 h-screen overflow-y-auto ${
					theme === "light"
						? "bg-gray-100"
						: "bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-dark-800 via-dark-900 to-black"
				}`}>
				<div
					className={`max-w-7xl mx-auto ${
						compact ? "p-3 lg:p-4 pb-8" : "p-4 lg:p-6 pb-12"
					}`}>
					<ToolGuide path={location.pathname} />
					{children}
				</div>
			</main>

			{/* Overlay for mobile menu */}
			{isMobileMenuOpen && (
				<div
					className="fixed inset-0 bg-black/80 z-30 lg:hidden backdrop-blur-sm"
					onClick={() => setIsMobileMenuOpen(false)}
				/>
			)}

			{/* Donate Modal */}
			<DonateModal
				isOpen={isDonateOpen}
				onClose={() => setIsDonateOpen(false)}
			/>
		</div>
	);
};

const Layout: React.FC<LayoutProps> = ({ children }) => (
	<I18nProvider>
		<SettingsProvider>
			<LayoutInner>{children}</LayoutInner>
		</SettingsProvider>
	</I18nProvider>
);

export default Layout;
