import React, { useState, useCallback, useEffect, useRef } from "react";
import Navbar from "./components/Navbar";
import VideoCard from "./components/VideoCard";
import DonateModal from "./components/DonateModal";
import HistorySection from "./components/HistorySection";
import { TikTokVideoData } from "./types";
import { fetchTikTokData } from "./services/tiktokService";

const translations = {
	en: {
		title: "TikTok Save",
		subtitle:
			"Premium no-watermark video downloader. Fast, free, and secure.",
		placeholder: "Paste TikTok link here...",
		btnDownload: "Download",
		btnPasteDown: "Paste & Download",
		loading: "Fetching...",
		error: "Check your link and try again.",
		saving: "Saving file to device...",
		historyTitle: "Download History",
		processing: "Processing...",
		btnNoWm: "Download HD (No Logo)",
		btnWm: "With Logo",
		btnAudio: "Audio Only",
		f1Title: "Turbo Speed",
		f1Desc: "Instantly fetch high-speed download links.",
		f2Title: "Original Quality",
		f2Desc: "Always download the highest resolution available.",
		f3Title: "Zero Ads",
		f3Desc: "Clean experience without intrusive advertising.",
		how1: "Copy link from TikTok app",
		how2: "Paste into the input box above",
		how3: "File saves automatically",
		navDonate: "Donate",
		footerCopy: "Premium Experience • All rights reserved.",
		donateHeader: "Buy me a coffee?",
		donateJoke:
			"Coffee keeps me coding, but your support keeps me sane. Help a dev survive another bug!",
		donateClose: "Maybe later",
		pasteSuccess: "Link pasted automatically!",
		clearHistory: "Clear All",
		viewNow: "View Details",
		downloadAgain: "Redownload",
		downloadAnother: "Download Another Video",
	},
	vi: {
		title: "Tải TikTok",
		subtitle:
			"Dịch vụ tải video không logo cao cấp. Nhanh, miễn phí và an toàn.",
		placeholder: "Dán link TikTok vào đây...",
		btnDownload: "Tải Ngay",
		btnPasteDown: "Dán & Tải Luôn",
		loading: "Đang lấy link...",
		error: "Kiểm tra link và thử lại.",
		saving: "Đang lưu file vào máy...",
		historyTitle: "Lịch sử tải xuống",
		processing: "Đang xử lý...",
		btnNoWm: "Tải HD không Logo",
		btnWm: "Bản có Logo",
		btnAudio: "Chỉ tải Audio",
		f1Title: "Tốc độ Turbo",
		f1Desc: "Lấy link tải tốc độ cao ngay lập tức.",
		f2Title: "Chất lượng Gốc",
		f2Desc: "Luôn tải về độ phân giải cao nhất.",
		f3Title: "Không quảng cáo",
		f3Desc: "Trải nghiệm sạch sẽ, không phiền nhiễu.",
		how1: "Sao chép link từ app TikTok",
		how2: "Dán vào ô nhập ở phía trên",
		how3: "File tự động lưu về máy",
		navDonate: "Ủng hộ",
		footerCopy: "Trải nghiệm Cao cấp • Bản quyền thuộc về AT-TokDown.",
		donateHeader: "Mời tôi ly cà phê?",
		donateJoke:
			"Code này chạy bằng cà phê đấy. Donate một chút để tôi có động lực fix bug tiếp nhé!",
		donateClose: "Để sau đi",
		pasteSuccess: "Đã tự động dán liên kết!",
		clearHistory: "Xóa tất cả",
		viewNow: "Xem lại",
		downloadAgain: "Tải lại",
		downloadAnother: "Tải video khác",
	},
};

const App: React.FC = () => {
	const [lang, setLang] = useState<"en" | "vi">("vi");
	const [url, setUrl] = useState("");
	const [loading, setLoading] = useState(false);
	const [downloading, setDownloading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [videoData, setVideoData] = useState<TikTokVideoData | null>(null);
	const [history, setHistory] = useState<TikTokVideoData[]>([]);
	const [isDonateOpen, setIsDonateOpen] = useState(false);
	const [showPasteToast, setShowPasteToast] = useState(false);

	const inputRef = useRef<HTMLInputElement>(null);
	const t = translations[lang];

	useEffect(() => {
		const savedHistory = localStorage.getItem("tok_history_v5");
		if (savedHistory) {
			try {
				setHistory(JSON.parse(savedHistory));
			} catch (e) {}
		}
	}, []);

	const resetApp = () => {
		setUrl("");
		setVideoData(null);
		setError(null);
		if (inputRef.current) inputRef.current.focus();
	};

	const forceDownload = async (downloadUrl: string, filename: string) => {
		setDownloading(true);
		try {
			const response = await fetch(downloadUrl);
			const blob = await response.blob();
			const blobUrl = window.URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.style.display = "none";
			a.href = blobUrl;
			a.download = filename;
			document.body.appendChild(a);
			a.click();
			window.URL.revokeObjectURL(blobUrl);
			document.body.removeChild(a);
		} catch (err) {
			const a = document.createElement("a");
			a.href = downloadUrl;
			a.download = filename;
			a.target = "_blank";
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
		} finally {
			setDownloading(false);
		}
	};

	const startFetch = async (targetUrl: string) => {
		if (!targetUrl) return;
		setLoading(true);
		setError(null);
		setVideoData(null);

		try {
			const response = await fetchTikTokData(targetUrl);
			setVideoData(response.data);

			const updatedHistory = [
				response.data,
				...history.filter((item) => item.id !== response.data.id),
			].slice(0, 12);
			setHistory(updatedHistory);
			localStorage.setItem(
				"tok_history_v5",
				JSON.stringify(updatedHistory)
			);

			await forceDownload(
				response.data.play,
				`tokdown-${response.data.id}.mp4`
			);
		} catch (err: any) {
			setError(t.error);
		} finally {
			setLoading(false);
		}
	};

	const handleFetch = (e: React.FormEvent) => {
		e.preventDefault();
		startFetch(url);
	};

	const handlePasteAndDownload = async () => {
		try {
			const text = await navigator.clipboard.readText();
			if (text) {
				setUrl(text);
				setShowPasteToast(true);
				setTimeout(() => setShowPasteToast(false), 2000);
				startFetch(text);
			}
		} catch (err) {
			if (inputRef.current) inputRef.current.focus();
		}
	};

	const useHistoryItem = (item: TikTokVideoData) => {
		setVideoData(item);
		window.scrollTo({ top: 0, behavior: "smooth" });
		forceDownload(item.play, `tokdown-${item.id}.mp4`);
	};

	const clearHistory = () => {
		if (
			window.confirm(
				lang === "vi"
					? "Bạn có chắc muốn xóa hết lịch sử?"
					: "Are you sure you want to clear history?"
			)
		) {
			setHistory([]);
			localStorage.removeItem("tok_history_v5");
		}
	};

	return (
		<div className="min-h-screen bg-[#020617] text-white selection:bg-pink-500/30 pb-20">
			<Navbar
				lang={lang}
				setLang={setLang}
				onDonateClick={() => setIsDonateOpen(true)}
				onHomeClick={resetApp}
				t={t}
			/>

			<main className="relative z-10 pt-16 px-4 max-w-4xl mx-auto">
				<section className="text-center mb-6">
					<h1 className="text-3xl md:text-5xl font-black mb-1.5 tracking-tighter">
						{t.title} <span className="text-pink-500">PRO</span>
					</h1>
					<p className="text-slate-500 text-xs md:text-sm font-medium">
						{t.subtitle}
					</p>
				</section>

				<section className="mb-8 relative">
					<form
						onSubmit={handleFetch}
						className="relative group max-w-2xl mx-auto">
						<div className="absolute -inset-0.5 bg-gradient-to-r from-pink-500 to-violet-600 rounded-xl blur opacity-20 group-focus-within:opacity-40 transition duration-500"></div>
						<div className="relative flex gap-2 p-1 bg-slate-900 border border-white/10 rounded-xl overflow-hidden">
							<div className="flex-1 relative flex items-center">
								<input
									ref={inputRef}
									type="text"
									value={url}
									onChange={(e) => setUrl(e.target.value)}
									placeholder={t.placeholder}
									className="w-full bg-transparent px-4 py-2 text-sm text-white focus:outline-none placeholder:text-slate-600 pr-10"
									disabled={loading}
								/>
								{url && !loading && (
									<button
										type="button"
										onClick={() => setUrl("")}
										className="absolute right-2 text-slate-500 hover:text-white p-1 transition-colors">
										<svg
											className="w-4 h-4"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24">
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth="3"
												d="M6 18L18 6M6 6l12 12"
											/>
										</svg>
									</button>
								)}
							</div>
							<button
								type="button"
								onClick={
									url
										? () => startFetch(url)
										: handlePasteAndDownload
								}
								disabled={loading}
								className={`px-6 py-2 min-w-[140px] ${
									url
										? "bg-white text-black"
										: "bg-pink-600 text-white"
								} text-[11px] font-black uppercase tracking-widest rounded-lg hover:opacity-90 transition-all disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2`}>
								{loading ? (
									<div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
								) : !url ? (
									<svg
										className="w-3.5 h-3.5"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24">
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth="3"
											d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
										/>
									</svg>
								) : null}
								{loading
									? t.loading
									: url
									? t.btnDownload
									: t.btnPasteDown}
							</button>
						</div>
					</form>

					<div
						className={`absolute top-full left-1/2 -translate-x-1/2 mt-4 transition-all duration-300 ${
							showPasteToast
								? "opacity-100 translate-y-0"
								: "opacity-0 -translate-y-2 pointer-events-none"
						}`}>
						<div className="bg-pink-600 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-lg flex items-center gap-2">
							<svg
								className="w-3 h-3"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24">
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth="3"
									d="M5 13l4 4L19 7"
								/>
							</svg>
							{t.pasteSuccess}
						</div>
					</div>

					<div className="h-10 flex items-center justify-center mt-2">
						{downloading && (
							<div className="flex items-center gap-2 px-3 py-1 bg-pink-500/10 rounded-full border border-pink-500/20 animate-in fade-in zoom-in-95 duration-300">
								<div className="w-2 h-2 bg-pink-500 rounded-full animate-ping"></div>
								<span className="text-[10px] font-black uppercase tracking-[0.2em] text-pink-500">
									{t.saving}
								</span>
							</div>
						)}
					</div>

					{error && (
						<div className="mt-1 p-2 bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold rounded-lg text-center uppercase tracking-wider">
							{error}
						</div>
					)}
				</section>

				{videoData && (
					<div className="mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
						<VideoCard data={videoData} t={t} />
						<div className="mt-6 flex justify-center">
							<button
								onClick={resetApp}
								className="flex items-center gap-2 px-6 py-2 bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-white text-[10px] font-black uppercase tracking-widest rounded-xl border border-white/5 transition-all active:scale-95">
								<svg
									className="w-3.5 h-3.5"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24">
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth="3"
										d="M12 4v16m8-8H4"
									/>
								</svg>
								{t.downloadAnother}
							</button>
						</div>
					</div>
				)}

				<HistorySection
					history={history}
					onView={useHistoryItem}
					onDownload={forceDownload}
					onClear={clearHistory}
					t={t}
				/>

				{!videoData && !loading && (
					<section className="grid grid-cols-1 md:grid-cols-3 gap-3 my-12">
						{[
							{
								title: t.f1Title,
								desc: t.f1Desc,
								color: "text-pink-500",
							},
							{
								title: t.f2Title,
								desc: t.f2Desc,
								color: "text-cyan-400",
							},
							{
								title: t.f3Title,
								desc: t.f3Desc,
								color: "text-violet-400",
							},
						].map((f, i) => (
							<div
								key={i}
								className="p-3.5 rounded-xl bg-white/5 border border-white/5">
								<h4
									className={`text-[11px] font-black uppercase mb-1 tracking-wider ${f.color}`}>
									{f.title}
								</h4>
								<p className="text-slate-500 text-[10px] leading-tight font-medium">
									{f.desc}
								</p>
							</div>
						))}
					</section>
				)}
			</main>

			<footer className="mt-12 py-8 border-t border-white/5 bg-black/20 text-center">
				<p className="text-slate-600 text-[9px] uppercase font-black tracking-[0.3em]">
					TokDown PRO • {t.footerCopy}
				</p>
			</footer>

			<DonateModal
				isOpen={isDonateOpen}
				onClose={() => setIsDonateOpen(false)}
				t={t}
			/>
		</div>
	);
};

export default App;
