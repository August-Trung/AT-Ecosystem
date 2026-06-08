import React, { useState, useEffect, useCallback } from "react";
import { Avatar, AVATAR_ICONS, Mood, MOOD_DATA, JournalEntry, Letter } from "../types";
import { journalService, userId } from "../services/journalService";
import { sound } from "../services/soundService";

interface MailboxPanelProps {
	isOpen: boolean;
	myAlias: string;
	myAvatar: Avatar;
	onClose: () => void;
}

const STAMPS = [
	{ icon: "✉️", label: "Cổ Điển" },
	{ icon: "🌙", label: "Ánh Trăng" },
	{ icon: "🌸", label: "Hoa Đào" },
	{ icon: "🐳", label: "Đại Dương" },
];

const MailboxPanel: React.FC<MailboxPanelProps> = ({
	isOpen,
	myAlias,
	myAvatar,
	onClose,
}) => {
	const [activeTab, setActiveTab] = useState<"journal" | "mailbox">("journal");
	
	// Journal state
	const [entries, setEntries] = useState<JournalEntry[]>([]);
	const [selectedMoodFilter, setSelectedMoodFilter] = useState<string>("all");
	const [likedEntries, setLikedEntries] = useState<Record<string, boolean>>({});
	const [isWritingJournal, setIsWritingJournal] = useState(false);
	const [journalContent, setJournalContent] = useState("");
	const [journalMood, setJournalMood] = useState<Mood>("chill");
	
	// Mailbox state
	const [mailboxMode, setMailboxMode] = useState<"send" | "receive" | "inbox">("send");
	const [letterContent, setLetterContent] = useState("");
	const [selectedStamp, setSelectedStamp] = useState("✉️");
	const [randomLetter, setRandomLetter] = useState<Letter | null>(null);
	const [isReplyingTo, setIsReplyingTo] = useState<Letter | null>(null);
	const [replyContent, setReplyContent] = useState("");
	const [myInbox, setMyInbox] = useState<Letter[]>([]);
	const [replyToInboxItem, setReplyToInboxItem] = useState<Letter | null>(null);
	const [inboxReplyContent, setInboxReplyContent] = useState("");
	
	const [isLoading, setIsLoading] = useState(false);
	const [successMsg, setSuccessMsg] = useState("");

	// Load journals
	const loadJournals = useCallback(async () => {
		setIsLoading(true);
		try {
			const data = await journalService.getEntries();
			setEntries(data);
		} catch (e) {
			console.error(e);
		} finally {
			setIsLoading(false);
		}
	}, []);

	// Load inbox
	const loadInbox = useCallback(async () => {
		try {
			const data = await journalService.getMyLetters();
			setMyInbox(data);
		} catch (e) {
			console.error(e);
		}
	}, []);

	useEffect(() => {
		if (isOpen) {
			loadJournals();
			loadInbox();
			
			// Reset states
			setIsWritingJournal(false);
			setJournalContent("");
			setLetterContent("");
			setRandomLetter(null);
			setIsReplyingTo(null);
			setReplyContent("");
			setReplyToInboxItem(null);
			setInboxReplyContent("");
			setSuccessMsg("");
		}
	}, [isOpen, loadJournals, loadInbox]);

	if (!isOpen) return null;

	// Handle Submit Journal
	const handleSubmitJournal = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!journalContent.trim() || journalContent.length > 500) return;
		
		setIsLoading(true);
		try {
			const res = await journalService.createEntry(
				journalContent.trim(),
				myAlias || "Người Lạ",
				myAvatar,
				journalMood
			);
			if (res) {
				sound.playMessage();
				setJournalContent("");
				setIsWritingJournal(false);
				setSuccessMsg("Đã gửi tâm sự của bạn lên bảng tin!");
				setTimeout(() => setSuccessMsg(""), 3000);
				loadJournals();
			}
		} catch (err) {
			console.error(err);
		} finally {
			setIsLoading(false);
		}
	};

	// Handle Like Journal
	const handleLikeEntry = async (id: string) => {
		if (likedEntries[id]) return; // Already liked
		sound.playClick();
		
		// Optimistic UI update
		setLikedEntries((prev) => ({ ...prev, [id]: true }));
		setEntries((prev) =>
			prev.map((e) => (e.id === id ? { ...e, likes: e.likes + 1 } : e))
		);

		try {
			await journalService.likeEntry(id);
		} catch (err) {
			console.error(err);
		}
	};

	// Handle Send Letter to Wind
	const handleSendLetter = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!letterContent.trim() || letterContent.length > 500) return;
		
		setIsLoading(true);
		try {
			// Attach stamp indicator to the text if desired, or just send content
			const stampedContent = `${selectedStamp} [Chủ đề: ${selectedStamp}] \n\n${letterContent.trim()}`;
			const success = await journalService.sendLetter(
				stampedContent,
				myAlias || "Người Lạ",
				myAvatar,
				null // recipientId = null means to the wind
			);
			if (success) {
				sound.playMessage();
				setLetterContent("");
				setSuccessMsg("Bức thư của bạn đã được thả vào hư vô...");
				setTimeout(() => setSuccessMsg(""), 4000);
			}
		} catch (err) {
			console.error(err);
		} finally {
			setIsLoading(false);
		}
	};

	// Handle Fish Random Letter
	const handleFishLetter = async () => {
		sound.playClick();
		setIsLoading(true);
		setRandomLetter(null);
		setIsReplyingTo(null);
		setReplyContent("");
		try {
			const letter = await journalService.getRandomLetter();
			setRandomLetter(letter);
		} catch (err) {
			console.error(err);
		} finally {
			setIsLoading(false);
		}
	};

	// Handle Submit Reply to Random Letter
	const handleSubmitReply = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!replyContent.trim() || !randomLetter) return;
		
		setIsLoading(true);
		try {
			const success = await journalService.sendLetter(
				replyContent.trim(),
				myAlias || "Người Lạ",
				myAvatar,
				randomLetter.senderId, // Send to the sender of the random letter
				randomLetter.id // Reply to this letter ID
			);
			if (success) {
				sound.playMessage();
				setReplyContent("");
				setIsReplyingTo(null);
				setRandomLetter(null);
				setSuccessMsg("Đã gửi phản hồi ẩn danh tới người lạ!");
				setTimeout(() => setSuccessMsg(""), 3000);
			}
		} catch (err) {
			console.error(err);
		} finally {
			setIsLoading(false);
		}
	};

	// Handle Submit Reply to Inbox Item
	const handleSubmitInboxReply = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!inboxReplyContent.trim() || !replyToInboxItem) return;
		
		setIsLoading(true);
		try {
			const success = await journalService.sendLetter(
				inboxReplyContent.trim(),
				myAlias || "Người Lạ",
				myAvatar,
				replyToInboxItem.senderId, // Reply back
				replyToInboxItem.id
			);
			if (success) {
				sound.playMessage();
				setInboxReplyContent("");
				setReplyToInboxItem(null);
				setSuccessMsg("Đã gửi phản hồi thành công!");
				setTimeout(() => setSuccessMsg(""), 3000);
				loadInbox();
			}
		} catch (err) {
			console.error(err);
		} finally {
			setIsLoading(false);
		}
	};

	const filteredEntries = entries.filter((e) => {
		if (selectedMoodFilter === "all") return true;
		return e.mood === selectedMoodFilter;
	});

	return (
		<div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[500] backdrop-filter blur-[2px] transition-all">
			<div className="w-full max-w-2xl h-[90vh] md:h-[80vh] bg-slate-950 border-4 border-indigo-900 pixel-border shadow-2xl flex flex-col relative text-white">
				
				{/* Header */}
				<div className="bg-indigo-950 p-3 border-b-4 border-indigo-900 flex justify-between items-center flex-shrink-0">
					<h2 className="text-xl md:text-2xl font-bold tracking-widest uppercase flex items-center gap-2 text-indigo-300">
						📬 Hòm Thư Đêm Khuya
					</h2>
					<button
						onClick={() => {
							sound.playClick();
							onClose();
						}}
						className="px-2.5 py-0.5 bg-rose-950 border-2 border-rose-700 text-rose-300 font-bold hover:bg-rose-900 transition-colors pixel-border"
					>
						✕ ĐÓNG
					</button>
				</div>

				{/* Tabs Navigation */}
				<div className="flex bg-slate-900 border-b-2 border-slate-800 flex-shrink-0">
					<button
						onClick={() => {
							sound.playClick();
							setActiveTab("journal");
						}}
						className={`flex-1 py-3 text-center text-sm font-bold tracking-wider uppercase border-r border-slate-800 transition-all ${activeTab === "journal" ? "bg-indigo-900/40 text-indigo-400 border-b-4 border-b-indigo-500" : "text-slate-400 hover:bg-slate-800"}`}
					>
						🌙 Nhật Ký Đêm Khuya
					</button>
					<button
						onClick={() => {
							sound.playClick();
							setActiveTab("mailbox");
						}}
						className={`flex-1 py-3 text-center text-sm font-bold tracking-wider uppercase transition-all ${activeTab === "mailbox" ? "bg-indigo-900/40 text-indigo-400 border-b-4 border-b-indigo-500" : "text-slate-400 hover:bg-slate-800"}`}
					>
						✉️ Hòm Thư Vô Danh
					</button>
				</div>

				{/* Success Alert Floating Banner */}
				{successMsg && (
					<div className="absolute top-16 left-1/2 transform -translate-x-1/2 bg-green-950 border-2 border-green-700 text-green-300 px-4 py-2 text-xs font-bold uppercase tracking-wider pixel-border text-center z-[510] animate-bounce">
						{successMsg}
					</div>
				)}

				{/* Content Area */}
				<div className="flex-1 overflow-y-auto p-4 md:p-6 min-h-0 relative scrollbar-thin">
					{isLoading && (
						<div className="absolute inset-0 bg-slate-950/70 flex items-center justify-center z-50">
							<div className="text-indigo-400 text-lg animate-pulse uppercase tracking-widest">
								Đang kết nối tần số...
							</div>
						</div>
					)}

					{/* TAB 1: JOURNAL */}
					{activeTab === "journal" && (
						<div className="h-full flex flex-col">
							
							{/* Filter Bar */}
							<div className="flex flex-wrap items-center gap-1.5 mb-4 bg-slate-900/50 p-2 border border-slate-800">
								<span className="text-[10px] text-slate-500 uppercase tracking-wider mr-2">Bộ lọc:</span>
								<button
									onClick={() => { sound.playClick(); setSelectedMoodFilter("all"); }}
									className={`px-2.5 py-0.5 text-xs pixel-border ${selectedMoodFilter === "all" ? "bg-indigo-700 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}
								>
									TẤT CẢ
								</button>
								{Object.entries(MOOD_DATA).map(([key, data]) => (
									<button
										key={key}
										onClick={() => { sound.playClick(); setSelectedMoodFilter(key); }}
										className={`px-2.5 py-0.5 text-xs pixel-border flex items-center gap-1 ${selectedMoodFilter === key ? "bg-indigo-700 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}
									>
										<span>{data.icon}</span>
										<span className="uppercase text-[10px]">{data.label}</span>
									</button>
								))}
								
								<button
									onClick={() => { sound.playClick(); setIsWritingJournal(true); }}
									className="ml-auto bg-indigo-600 text-white px-3 py-1 text-xs font-bold uppercase hover:bg-indigo-500 pixel-border"
								>
									✍️ VIẾT TÂM SỰ
								</button>
							</div>

							{/* Compose form Overlay */}
							{isWritingJournal && (
								<div className="bg-slate-900 border-2 border-indigo-900 p-4 mb-4 pixel-border">
									<h3 className="text-sm font-bold uppercase tracking-widest text-indigo-400 mb-2 flex items-center justify-between">
										<span>✍️ Viết tâm sự của bạn (Ẩn danh)</span>
										<button
											onClick={() => { sound.playClick(); setIsWritingJournal(false); }}
											className="text-rose-400 text-xs hover:underline uppercase"
										>
											[ Đóng ]
										</button>
									</h3>
									<form onSubmit={handleSubmitJournal} className="space-y-3">
										<textarea
											rows={4}
											maxLength={500}
											value={journalContent}
											onChange={(e) => setJournalContent(e.target.value)}
											placeholder="Đêm nay bạn thế nào? Hãy viết một vài dòng tâm sự..."
											className="w-full bg-slate-950 border-2 border-slate-800 p-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-600 focus:ring-0 resize-none font-mono"
											required
										/>
										<div className="flex justify-between items-center">
											<div className="flex items-center gap-2">
												<span className="text-[10px] text-slate-500 uppercase">Tâm trạng:</span>
												<div className="flex gap-1">
													{Object.entries(MOOD_DATA).map(([key, data]) => (
														<button
															type="button"
															key={key}
															onClick={() => { sound.playClick(); setJournalMood(key as Mood); }}
															className={`p-1.5 text-xs pixel-border ${journalMood === key ? "bg-indigo-600" : "bg-slate-800 border-slate-700"}`}
															title={data.label}
														>
															{data.icon}
														</button>
													))}
												</div>
											</div>
											<div className="flex items-center gap-4">
												<span className="text-[10px] text-slate-500 font-mono">
													{journalContent.length}/500
												</span>
												<button
													type="submit"
													className="bg-indigo-600 text-white px-4 py-1.5 text-xs font-bold uppercase hover:bg-indigo-500 pixel-border"
												>
													GỬI TÂM SỰ
												</button>
											</div>
										</div>
									</form>
								</div>
							)}

							{/* Entries List */}
							<div className="flex-1 space-y-4 pr-1">
								{filteredEntries.length === 0 ? (
									<div className="text-center py-12 text-slate-600 uppercase tracking-widest text-sm">
										Không tìm thấy tâm sự nào ở tần số này...
									</div>
								) : (
									filteredEntries.map((item) => (
										<div
											key={item.id}
											className="bg-slate-900/40 border-2 border-slate-900 p-4 hover:border-indigo-950 transition-all relative group"
										>
											<div className="flex justify-between items-center mb-2">
												<div className="flex items-center gap-1.5">
													<span className="text-base" title={item.avatar}>
														{AVATAR_ICONS[item.avatar] || "🧑"}
													</span>
													<span className="text-indigo-400 font-black uppercase text-xs">
														{item.alias}
													</span>
													<span className="text-[10px] bg-slate-800 text-indigo-300 px-1 py-0.5 rounded-sm">
														{MOOD_DATA[item.mood as Mood]?.icon || "☕"} {item.mood.toUpperCase()}
													</span>
												</div>
												<span className="text-[10px] text-slate-600 font-mono">
													{new Date(item.timestamp).toLocaleTimeString("vi-VN", {
														hour: "2-digit",
														minute: "2-digit",
													})}
												</span>
											</div>
											<p className="text-sm text-slate-300 italic whitespace-pre-wrap font-sans leading-relaxed border-l-2 border-indigo-900 pl-3 py-1">
												"{item.content}"
											</p>
											
											{/* Like button */}
											<div className="mt-3 flex justify-end">
												<button
													onClick={() => handleLikeEntry(item.id)}
													className={`px-3 py-1 text-[10px] font-bold uppercase pixel-border flex items-center gap-1 transition-all ${likedEntries[item.id] ? "bg-rose-900 text-rose-300 border-rose-700 cursor-default" : "bg-slate-950 text-slate-400 hover:text-rose-400 hover:border-rose-900"}`}
												>
													<span>❤️</span>
													<span>{item.likes} LƯỢT THÍCH</span>
												</button>
											</div>
										</div>
									))
								)}
							</div>
						</div>
					)}

					{/* TAB 2: MAILBOX */}
					{activeTab === "mailbox" && (
						<div className="h-full flex flex-col">
							
							{/* Mailbox Subtabs */}
							<div className="grid grid-cols-3 gap-2 mb-6 bg-slate-900/30 p-1.5 border border-slate-800">
								<button
									onClick={() => { sound.playClick(); setMailboxMode("send"); }}
									className={`py-1.5 text-xs font-bold uppercase tracking-wider pixel-border ${mailboxMode === "send" ? "bg-teal-900 text-teal-300 border-teal-700" : "bg-slate-800 text-slate-400"}`}
								>
									✉️ Thả Thư
								</button>
								<button
									onClick={() => { sound.playClick(); setMailboxMode("receive"); }}
									className={`py-1.5 text-xs font-bold uppercase tracking-wider pixel-border ${mailboxMode === "receive" ? "bg-teal-900 text-teal-300 border-teal-700" : "bg-slate-800 text-slate-400"}`}
								>
									🎣 Vớt Thư
								</button>
								<button
									onClick={() => { sound.playClick(); setMailboxMode("inbox"); }}
									className={`py-1.5 text-xs font-bold uppercase tracking-wider pixel-border relative ${mailboxMode === "inbox" ? "bg-teal-900 text-teal-300 border-teal-700" : "bg-slate-800 text-slate-400"}`}
								>
									📬 Hộp Thư Đến
									{myInbox.length > 0 && (
										<span className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white font-bold w-4 h-4 text-[9px] flex items-center justify-center rounded-full border border-black animate-pulse">
											{myInbox.length}
										</span>
									)}
								</button>
							</div>

							{/* SUBTAB 1: SEND LETTER */}
							{mailboxMode === "send" && (
								<div className="bg-slate-900/40 p-4 border-2 border-slate-900 max-w-lg mx-auto w-full">
									<h3 className="text-base font-bold uppercase tracking-widest text-teal-400 mb-1">
										📬 Thả thư vào hư vô
									</h3>
									<p className="text-[10px] text-slate-500 uppercase tracking-wider mb-4">
										Viết một lá thư gửi tới vũ trụ. Một người lạ bất kỳ sẽ có cơ hội vớt được lá thư này và phản hồi bạn.
									</p>
									<form onSubmit={handleSendLetter} className="space-y-4">
										{/* Stamp selection */}
										<div className="flex items-center gap-2">
											<span className="text-xs text-slate-400 uppercase">Chọn Tem Thư:</span>
											<div className="flex gap-1.5">
												{STAMPS.map((stamp) => (
													<button
														type="button"
														key={stamp.icon}
														onClick={() => { sound.playClick(); setSelectedStamp(stamp.icon); }}
														className={`w-9 h-9 text-lg flex items-center justify-center pixel-border ${selectedStamp === stamp.icon ? "bg-teal-700 border-teal-500 scale-105" : "bg-slate-800 border-slate-700"}`}
														title={stamp.label}
													>
														{stamp.icon}
													</button>
												))}
											</div>
										</div>

										<textarea
											rows={5}
											maxLength={500}
											value={letterContent}
											onChange={(e) => setLetterContent(e.target.value)}
											placeholder="Gửi một lời chúc, một câu chuyện ngắn, hay chỉ đơn giản là tiếng thở dài... Người lạ sẽ đọc được nó."
											className="w-full bg-slate-950 border-2 border-slate-800 p-3 text-sm text-slate-200 focus:outline-none focus:border-teal-700 resize-none font-mono leading-relaxed"
											required
										/>
										<div className="flex justify-between items-center">
											<span className="text-[10px] text-slate-500 font-mono">
												{letterContent.length}/500
											</span>
											<button
												type="submit"
												className="bg-teal-700 text-white px-5 py-2 text-xs font-bold uppercase hover:bg-teal-600 pixel-border"
											>
												📬 THẢ THƯ ĐI
											</button>
										</div>
									</form>
								</div>
							)}

							{/* SUBTAB 2: RECEIVE (FISH) LETTER */}
							{mailboxMode === "receive" && (
								<div className="flex flex-col items-center justify-center py-4 max-w-lg mx-auto w-full">
									
									{!randomLetter ? (
										<div className="text-center py-8 space-y-6">
											<div className="text-6xl animate-bounce">🎣</div>
											<h4 className="text-sm font-bold uppercase tracking-widest text-slate-400">
												Thả mồi để vớt thư của người lạ
											</h4>
											<p className="text-[10px] text-slate-600 uppercase tracking-widest max-w-xs mx-auto leading-relaxed">
												Hệ thống sẽ lọc ngẫu nhiên các lá thư không có người nhận cụ thể được thả trên mạng ẩn danh.
											</p>
											<button
												onClick={handleFishLetter}
												className="bg-teal-700 text-white px-6 py-3 text-sm font-bold uppercase hover:bg-teal-600 pixel-border tracking-wider"
											>
												🎣 VỚT MỘT LÁ THƯ
											</button>
										</div>
									) : (
										<div className="w-full space-y-4">
											{/* Letter Envelope */}
											<div className="bg-slate-900 border-4 border-teal-950 p-5 pixel-border relative shadow-2xl bg-envelope-pattern">
												
												{/* Stamp display */}
												<div className="absolute top-4 right-4 w-12 h-14 border-2 border-dashed border-teal-700/50 flex flex-col items-center justify-center bg-slate-950/80">
													<span className="text-xl">🌙</span>
													<span className="text-[7px] text-teal-600 font-mono uppercase mt-0.5">NIGHT</span>
												</div>

												<div className="flex items-center gap-2 mb-4">
													<span className="text-lg">✉️</span>
													<div className="text-left">
														<span className="text-xs text-slate-500 block uppercase">Người gửi ẩn danh:</span>
														<span className="text-teal-400 font-bold uppercase text-xs">
															{randomLetter.senderAlias}
														</span>
													</div>
												</div>

												<p className="text-sm text-slate-200 font-mono whitespace-pre-wrap leading-relaxed border-t border-slate-800 pt-4 pb-2 text-left italic">
													"{randomLetter.content}"
												</p>

												<div className="text-right border-t border-slate-800/40 pt-2">
													<span className="text-[9px] text-slate-600 font-mono">
														Thả lúc: {new Date(randomLetter.timestamp).toLocaleString("vi-VN", {
															hour: "2-digit",
															minute: "2-digit",
															day: "2-digit",
															month: "2-digit"
														})}
													</span>
												</div>
											</div>

											{/* Reply controls */}
											{!isReplyingTo ? (
												<div className="flex gap-3 justify-center">
													<button
														onClick={() => { sound.playClick(); setRandomLetter(null); }}
														className="bg-slate-800 text-slate-400 px-4 py-1.5 text-xs font-bold uppercase hover:text-white pixel-border"
													>
														BỎ QUA
													</button>
													<button
														onClick={() => { sound.playClick(); setIsReplyingTo(randomLetter); }}
														className="bg-teal-700 text-white px-5 py-1.5 text-xs font-bold uppercase hover:bg-teal-600 pixel-border"
													>
														✍️ VIẾT THƯ TRẢ LỜI
													</button>
												</div>
											) : (
												<div className="bg-slate-900 border border-teal-800 p-4 pixel-border">
													<h4 className="text-xs font-bold uppercase tracking-widest text-teal-400 mb-2">
														✍️ Phản hồi gửi tới {randomLetter.senderAlias}
													</h4>
													<form onSubmit={handleSubmitReply} className="space-y-3">
														<textarea
															rows={4}
															maxLength={500}
															value={replyContent}
															onChange={(e) => setReplyContent(e.target.value)}
															placeholder="Lời phản hồi của bạn sẽ xuất hiện trực tiếp trong hòm thư của họ..."
															className="w-full bg-slate-950 border border-slate-800 p-2 text-xs text-slate-200 focus:outline-none focus:border-teal-600 resize-none font-mono"
															required
														/>
														<div className="flex justify-between items-center">
															<button
																type="button"
																onClick={() => { sound.playClick(); setIsReplyingTo(null); }}
																className="text-slate-500 hover:text-slate-300 text-[10px] uppercase font-bold"
															>
																[ HỦY ]
															</button>
															<div className="flex items-center gap-3">
																<span className="text-[10px] text-slate-500 font-mono">
																	{replyContent.length}/500
																</span>
																<button
																	type="submit"
																	className="bg-teal-600 text-white px-4 py-1 text-xs font-bold uppercase hover:bg-teal-500 pixel-border"
																>
																	GỬI THƯ ĐI
																</button>
															</div>
														</div>
													</form>
												</div>
											)}
										</div>
									)}
								</div>
							)}

							{/* SUBTAB 3: MY INBOX */}
							{mailboxMode === "inbox" && (
								<div className="h-full flex flex-col">
									<p className="text-[10px] text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2">
										📬 Hộp thư đến cá nhân của bạn. Địa chỉ ID: <span className="font-mono text-indigo-400 select-all">{userId.substring(0, 8)}...</span>
									</p>

									<div className="flex-1 space-y-4 pr-1">
										{myInbox.length === 0 ? (
											<div className="text-center py-12 text-slate-600 uppercase tracking-widest text-sm">
												Chưa có lá thư nào gửi tới hòm thư của bạn...
											</div>
										) : (
											myInbox.map((letter) => (
												<div
													key={letter.id}
													className="bg-slate-900 border-2 border-teal-950/40 p-4 hover:border-teal-900 transition-all text-left relative"
												>
													<div className="flex justify-between items-center mb-2">
														<div className="flex items-center gap-1.5">
															<span className="text-sm">✉️</span>
															<span className="text-teal-400 font-bold uppercase text-xs">
																Người lạ: {letter.senderAlias}
															</span>
															{letter.replyToId && (
																<span className="text-[9px] bg-slate-800 text-slate-400 px-1 py-0.5 font-bold uppercase">
																	[ Phản Hồi ]
																</span>
															)}
														</div>
														<span className="text-[9px] text-slate-600 font-mono">
															{new Date(letter.timestamp).toLocaleString("vi-VN", {
																hour: "2-digit",
																minute: "2-digit",
																day: "2-digit",
																month: "2-digit"
															})}
														</span>
													</div>
													
													<p className="text-sm text-slate-300 font-mono italic whitespace-pre-wrap pl-3 border-l border-teal-800 py-1 bg-slate-950/30 p-2">
														"{letter.content}"
													</p>

													{/* Reply to this inbox letter */}
													{replyToInboxItem?.id === letter.id ? (
														<form onSubmit={handleSubmitInboxReply} className="mt-3 bg-slate-950 p-3 border border-teal-800 space-y-2">
															<textarea
																rows={3}
																maxLength={500}
																value={inboxReplyContent}
																onChange={(e) => setInboxReplyContent(e.target.value)}
																placeholder="Viết câu trả lời..."
																className="w-full bg-slate-900 border border-slate-800 p-2 text-xs text-slate-200 focus:outline-none focus:border-teal-600 resize-none font-mono"
																required
															/>
															<div className="flex justify-between items-center">
																<button
																	type="button"
																	onClick={() => { sound.playClick(); setReplyToInboxItem(null); }}
																	className="text-slate-500 hover:text-slate-300 text-[9px] uppercase font-bold"
																>
																	[ HỦY ]
																</button>
																<div className="flex items-center gap-2">
																	<span className="text-[9px] text-slate-600 font-mono">
																		{inboxReplyContent.length}/500
																	</span>
																	<button
																		type="submit"
																		className="bg-teal-600 text-white px-3 py-0.5 text-[10px] font-bold uppercase hover:bg-teal-500 pixel-border"
																	>
																		GỬI TRẢ LỜI
																	</button>
																</div>
															</div>
														</form>
													) : (
														<div className="mt-3 flex justify-end">
															<button
																onClick={() => {
																	sound.playClick();
																	setReplyToInboxItem(letter);
																	setInboxReplyContent("");
																}}
																className="bg-slate-950 text-[10px] text-teal-400 font-bold uppercase px-3 py-1 hover:text-teal-300 pixel-border"
															>
																✍️ PHẢN HỒI
															</button>
														</div>
													)}
												</div>
											))
										)}
									</div>
								</div>
							)}

						</div>
					)}
				</div>
			</div>
		</div>
	);
};

export default MailboxPanel;
