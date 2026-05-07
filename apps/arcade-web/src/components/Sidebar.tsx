import { useState } from "react";
import {
	Home,
	Gamepad2,
	Heart,
	Settings,
	Crown,
	X,
	QrCode,
	CheckCircle,
	Coffee,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

const Sidebar = () => {
	const navigate = useNavigate();
	const location = useLocation();

	// State for Modal and Premium Status
	const [showUpgradeModal, setShowUpgradeModal] = useState(false);
	const [showQR, setShowQR] = useState(false);

	// Initialize Premium state from LocalStorage
	const [isPremium, setIsPremium] = useState(() => {
		return localStorage.getItem("arcade_premium") === "true";
	});

	const isActive = (path: string) => location.pathname === path;

	const NavItem = ({ icon: Icon, label, path, active = false }: any) => (
		<button
			onClick={() => navigate(path)}
			className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 group ${
				active
					? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-900/20"
					: "text-slate-400 hover:bg-white/5 hover:text-white"
			}`}>
			<Icon
				size={20}
				className={
					active
						? "text-white"
						: "group-hover:text-purple-400 transition-colors"
				}
			/>
			<span className="font-medium text-sm">{label}</span>
			{active && (
				<div className="ml-auto w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_white]"></div>
			)}
		</button>
	);

	const handleUpgrade = () => {
		// Logic: Free upgrade active immediately and persist to LocalStorage
		localStorage.setItem("arcade_premium", "true");
		setIsPremium(true);
		setShowUpgradeModal(false);
		setShowQR(false);
	};

	return (
		<>
			{/* Sidebar Container */}
			<aside className="hidden md:flex flex-col w-64 h-screen fixed left-0 top-0 bg-[#0a0a0e]/95 backdrop-blur-xl border-r border-white/5 z-40 p-6">
				{/* Brand Header */}
				<div
					className="flex items-center gap-3 mb-10 px-2 cursor-pointer"
					onClick={() => navigate("/")}>
					<img
						src="/ver-bigger-logo.png"
						alt="Logo"
						className="w-10 h-10 rounded-lg"
					/>
					<div>
						<h1 className="text-xl font-bold tracking-tight text-white leading-none group-hover:text-purple-300 transition-colors">
							August<span className="text-purple-500">Trung</span>
						</h1>
						<span className="text-xs text-slate-500 uppercase tracking-widest">
							Arcade
						</span>
					</div>
				</div>

				{/* Navigation Links */}
				<nav className="flex-1 space-y-2">
					<div className="text-xs font-semibold text-slate-600 uppercase tracking-wider px-4 mb-2">
						Menu
					</div>
					<NavItem
						icon={Home}
						label="Discover"
						path="/"
						active={isActive("/")}
					/>
					<NavItem
						icon={Gamepad2}
						label="All Games"
						path="/library"
						active={isActive("/library")}
					/>
					<NavItem
						icon={Heart}
						label="Favorites"
						path="/favorites"
						active={isActive("/favorites")}
					/>

					<div className="mt-8 text-xs font-semibold text-slate-600 uppercase tracking-wider px-4 mb-2">
						System
					</div>
					<NavItem
						icon={Settings}
						label="Settings"
						path="/settings"
						active={isActive("/settings")}
					/>
				</nav>

				{/* Upgrade / Premium Status Card */}
				{isPremium ? (
					<div className="p-4 rounded-2xl bg-gradient-to-br from-yellow-500/10 to-amber-500/10 border border-yellow-500/30 mt-auto relative overflow-hidden animate-fade-in-up">
						<div className="flex items-center gap-3 mb-2">
							<div className="p-1.5 bg-yellow-500 rounded-full text-black">
								<Crown size={14} fill="black" />
							</div>
							<h4 className="font-bold text-yellow-500 text-sm">
								Premium Active
							</h4>
						</div>
						<p className="text-xs text-slate-400">
							Thanks for your support! Enjoy ad-free gaming.
						</p>
					</div>
				) : (
					<div className="p-4 rounded-2xl bg-gradient-to-br from-purple-900/40 to-indigo-900/40 border border-white/10 mt-auto relative overflow-hidden group">
						<div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-pink-600/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
						<h4 className="font-bold text-white mb-1 relative z-10 flex items-center gap-2">
							<Crown size={16} className="text-yellow-400" /> Go
							Premium
						</h4>
						<p className="text-xs text-purple-200 mb-3 relative z-10">
							Unlock exclusive features.
						</p>
						<button
							onClick={() => {
								setShowUpgradeModal(true);
							}}
							className="w-full py-2 bg-white text-black text-xs font-bold rounded-lg hover:bg-purple-50 hover:scale-[1.02] transition-all relative z-10 cursor-pointer">
							Upgrade Now
						</button>
					</div>
				)}
			</aside>

			{/* Upgrade Modal Overlay */}
			{showUpgradeModal && (
				<div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
					{/* Backdrop */}
					<div
						className="absolute inset-0 bg-black/80 backdrop-blur-md animate-fade-in-up"
						onClick={() => {
							setShowUpgradeModal(false);
							setShowQR(false);
						}}></div>

					{/* Modal Content */}
					<div className="bg-[#12121a] w-full max-w-md rounded-3xl border border-purple-500/30 shadow-[0_0_50px_rgba(168,85,247,0.3)] relative z-[101] overflow-hidden animate-fade-in-up flex flex-col">
						{/* Modal Header */}
						<div className="h-32 bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center relative overflow-hidden">
							<div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20"></div>
							<div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center shadow-xl border border-white/20">
								<Crown
									size={40}
									className="text-white drop-shadow-md"
									fill="white"
								/>
							</div>
							<button
								onClick={() => {
									setShowUpgradeModal(false);
									setShowQR(false);
								}}
								className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/40 rounded-full text-white transition-colors cursor-pointer">
								<X size={16} />
							</button>
						</div>

						<div className="p-6 text-center">
							{!showQR ? (
								/* Step 1: Selection */
								<div className="animate-fade-in-up">
									<h2 className="text-2xl font-black text-white mb-2">
										Unlock Premium
									</h2>
									<p className="text-slate-400 text-sm mb-6">
										Support the developer to keep the arcade
										running. <br />
										Premium removes ads & unlocks 4K mode.
									</p>

									<div className="space-y-3 mb-8 text-left">
										<div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
											<CheckCircle
												size={18}
												className="text-green-400"
											/>
											<span className="text-sm text-slate-200">
												No Interruptions
											</span>
										</div>
										<div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
											<Monitor
												size={18}
												className="text-purple-400"
											/>
											<span className="text-sm text-slate-200">
												High Quality Streaming
											</span>
										</div>
									</div>

									<div className="grid grid-cols-2 gap-4">
										<button
											onClick={() => setShowQR(true)}
											className="py-3 px-4 rounded-xl border border-purple-500/30 text-purple-300 font-bold text-sm hover:bg-purple-500/10 transition-colors flex items-center justify-center gap-2">
											<Coffee size={16} />
											Donate
										</button>
										<button
											onClick={handleUpgrade}
											className="py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-sm hover:opacity-90 transition-opacity shadow-lg shadow-purple-500/30">
											Continue
										</button>
									</div>
									<p className="mt-4 text-[10px] text-slate-500">
										*Donations are voluntary. Clicking
										'Continue' activates Premium
										immediately.
									</p>
								</div>
							) : (
								/* Step 2: Donate QR */
								<div className="flex flex-col items-center animate-fade-in-up">
									<h2 className="text-xl font-bold text-white mb-4">
										Scan to Donate
									</h2>
									<div className="p-4 bg-white rounded-2xl mb-6 shadow-xl relative">
										{/* Demo QR Code */}
										<img
											src="/qr.jpg"
											alt="Donate QR"
											className="w-40 h-40 object-contain"
										/>
										<div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
											<QrCode
												size={80}
												className="text-black"
											/>
										</div>
									</div>
									<p className="text-slate-400 text-xs mb-6 max-w-xs">
										Use your banking app or crypto wallet to
										scan. <br /> Your support keeps the
										servers alive!
									</p>
									<button
										onClick={handleUpgrade}
										className="w-full py-3 rounded-xl bg-green-500 hover:bg-green-600 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-green-500/20">
										<CheckCircle size={18} />
										I've Donated / Continue
									</button>
									<button
										onClick={() => setShowQR(false)}
										className="mt-3 text-slate-500 text-xs hover:text-white transition-colors">
										Back
									</button>
								</div>
							)}
						</div>
					</div>
				</div>
			)}
		</>
	);
};

// Helper Icon
const Monitor = ({ size, className }: any) => (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
		className={className}>
		<rect width="20" height="14" x="2" y="3" rx="2" />
		<line x1="8" x2="16" y1="21" y2="21" />
		<line x1="12" x2="12" y1="17" y2="21" />
	</svg>
);

export default Sidebar;
