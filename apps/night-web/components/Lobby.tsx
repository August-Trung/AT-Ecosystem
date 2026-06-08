import React, { useState, useEffect, useCallback } from "react";
import {
	Gender,
	Mood,
	Avatar,
	MOOD_DATA,
	AVATAR_ICONS,
	ALIASES,
	COMFORT_QUOTES,
	LOBBY_EMOJIS,
} from "../types";
import { sound } from "../services/soundService";
import { lobbyPresence } from "../services/lobbyPresenceService";
import PixelButton from "./PixelButton";
import LobbyCanvas from "./LobbyCanvas";
import BartenderChat from "./BartenderChat";
import MailboxPanel from "./MailboxPanel";

interface LobbyProps {
	onStart: (
		mine: Gender,
		pref: Gender,
		myMood: Mood,
		prefMood: Mood,
		avatar: Avatar,
		myAlias: string,
	) => void;
	onStartPrivateRoom: (
		mine: Gender,
		pref: Gender,
		myMood: Mood,
		prefMood: Mood,
		avatar: Avatar,
		myAlias: string,
	) => void;
	isSpecialUnlocked: boolean;
	onUnlockSpecial: () => void;
	memories: import("../types").Memory[];
	onSubmitMemory: (text: string, alias: string) => void;
}

const STORAGE_KEYS = {
	MY_GENDER: "m_gender",
	PREF_GENDER: "p_gender",
	MY_MOOD: "m_mood",
	MY_AVATAR: "m_avatar",
};

const SECRET_CODE = "21122025";

const Lobby: React.FC<LobbyProps> = ({
	onStart,
	onStartPrivateRoom,
	isSpecialUnlocked,
	onUnlockSpecial,
	memories,
	onSubmitMemory,
}) => {
	const [myGender, setMyGender] = useState<Gender>(
		() =>
			(localStorage.getItem(STORAGE_KEYS.MY_GENDER) as Gender) || "other",
	);
	const [prefGender, setPrefGender] = useState<Gender>(
		() =>
			(localStorage.getItem(STORAGE_KEYS.PREF_GENDER) as Gender) ||
			"other",
	);
	const [myMood, setMyMood] = useState<Mood>(
		() => (localStorage.getItem(STORAGE_KEYS.MY_MOOD) as Mood) || "chill",
	);
	const [myAvatar, setMyAvatar] = useState<Avatar>(
		() =>
			(localStorage.getItem(STORAGE_KEYS.MY_AVATAR) as Avatar) || "human",
	);
	const [myAlias, setMyAlias] = useState("");
	const [memoryInput, setMemoryInput] = useState("");
	const [hasSubmittedMemory, setHasSubmittedMemory] = useState(false);
	const [configOpen, setConfigOpen] = useState(false);
	const [isNearBartender, setIsNearBartender] = useState(false);
	const [bartenderChatOpen, setBartenderChatOpen] = useState(false);
	const [isNearMailbox, setIsNearMailbox] = useState(false);
	const [mailboxOpen, setMailboxOpen] = useState(false);

	const generateInviteLink = () => {
		onStartPrivateRoom(myGender, prefGender, myMood, myMood, myAvatar, myAlias);
	};

	const getWeeklyEvent = () => {
		const day = new Date().getDay();
		if (day === 5) {
			return {
				title: "Friday Deep Talk 💬",
				desc: "Đêm nay hãy chia sẻ những tâm sự sâu sắc nhất cùng người lạ.",
				color: "text-indigo-400 border-indigo-700 bg-indigo-950/20"
			};
		}
		if (day === 0) {
			return {
				title: "Sunday Game Night 🎮",
				desc: "Đêm nay hãy cùng thách đấu Tiến Lên và Caro để nhân đôi xu thưởng!",
				color: "text-amber-400 border-amber-700 bg-amber-950/20"
			};
		}
		return null;
	};
	const weeklyEvent = getWeeklyEvent();

	const handleMemorySubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!memoryInput.trim() || hasSubmittedMemory) return;
		onSubmitMemory(memoryInput, myAlias || "Người Lạ");
		setMemoryInput("");
		setHasSubmittedMemory(true);
		sound.playClick();
	};

	useEffect(() => {
		if (!myAlias) {
			setMyAlias(ALIASES[Math.floor(Math.random() * ALIASES.length)]);
		}
		localStorage.setItem(STORAGE_KEYS.MY_GENDER, myGender);
		localStorage.setItem(STORAGE_KEYS.PREF_GENDER, prefGender);
		localStorage.setItem(STORAGE_KEYS.MY_MOOD, myMood);
		localStorage.setItem(STORAGE_KEYS.MY_AVATAR, myAvatar);
	}, [myGender, prefGender, myMood, myAvatar]);

	// Secret code detection
	useEffect(() => {
		if (myAlias.toLowerCase().includes(SECRET_CODE)) {
			if (!isSpecialUnlocked) {
				onUnlockSpecial();
				sound.playMessage();
			}
		}
	}, [myAlias, isSpecialUnlocked, onUnlockSpecial]);

	// Bartender proximity auto-open/close
	const handleNearBartenderChange = useCallback((isNear: boolean) => {
		setIsNearBartender(isNear);
		if (isNear && !bartenderChatOpen) {
			setBartenderChatOpen(true);
		}
	}, [bartenderChatOpen]);

	const handleBartenderClose = useCallback(() => {
		setBartenderChatOpen(false);
	}, []);

	// Mailbox proximity and click handlers
	const handleNearMailboxChange = useCallback((isNear: boolean) => {
		setIsNearMailbox(isNear);
	}, []);

	const handleMailboxClick = useCallback(() => {
		setMailboxOpen(true);
	}, []);

	const handleMailboxClose = useCallback(() => {
		setMailboxOpen(false);
	}, []);

	// Listen for keyboard shortcut (E) to open Mailbox when near
	useEffect(() => {
		const handleGlobalKeyDown = (e: KeyboardEvent) => {
			if ((e.key === "e" || e.key === "E") && isNearMailbox && !mailboxOpen && !bartenderChatOpen) {
				sound.playClick();
				setMailboxOpen(true);
			}
		};
		window.addEventListener("keydown", handleGlobalKeyDown);
		return () => window.removeEventListener("keydown", handleGlobalKeyDown);
	}, [isNearMailbox, mailboxOpen, bartenderChatOpen]);

	const handleEmojiSend = useCallback((emoji: string) => {
		sound.playClick();
		lobbyPresence.sendEmoji(emoji);
	}, []);

	const availableAvatars: Avatar[] = [
		"cat",
		"robot",
		"ghost",
		"alien",
		"human",
	];
	if (isSpecialUnlocked) {
		availableAvatars.push("pig", "cow");
	}

	const params = new URLSearchParams(window.location.search);
	const targetRoom = params.get("room");
	const targetAlias = params.get("alias") ? decodeURIComponent(params.get("alias")!) : "Người Lạ";

	return (
		<div className="w-full h-full flex flex-col z-20 relative">
			{/* Invite banner */}
			{targetRoom && (
				<div className="bg-indigo-950/40 p-3 border-4 border-indigo-900 text-center text-xs text-indigo-300 pixel-border font-bold uppercase tracking-wider">
					🔔 Bạn được mời vào phòng riêng của {targetAlias}
				</div>
			)}

			{/* Marquee Comfort Quotes */}
			<div className="bg-slate-950 border-4 border-slate-800 py-2 overflow-hidden relative w-full flex-shrink-0">
				<div className="flex w-max animate-marquee gap-24 text-indigo-400 text-base tracking-widest italic uppercase">
					{COMFORT_QUOTES.map((quote, i) => (
						<span key={i} className="flex-shrink-0">
							✦ {quote}
						</span>
					))}
					{COMFORT_QUOTES.map((quote, i) => (
						<span key={`dup-${i}`} className="flex-shrink-0">
							✦ {quote}
						</span>
					))}
				</div>
			</div>

			{/* Main lobby area — Canvas fills the space */}
			<div className="flex-1 relative lobby-canvas-container min-h-0">
				{/* 2D Canvas */}
				<LobbyCanvas
					myAvatar={myAvatar}
					myAlias={myAlias}
					isNearBartender={isNearBartender}
					onNearBartenderChange={handleNearBartenderChange}
					onNearMailboxChange={handleNearMailboxChange}
					onMailboxClick={handleMailboxClick}
				/>

				{/* Config panel toggle button */}
				<button
					type="button"
					onClick={() => {
						sound.playClick();
						setConfigOpen(!configOpen);
					}}
					className={`lobby-config-toggle ${configOpen ? "panel-open" : ""}`}
				>
					{configOpen ? "✕" : "⚙️"}
				</button>

				{/* Floating Config Panel */}
				<div className={`lobby-config-panel scrollbar-thin ${configOpen ? "" : "collapsed"}`}>
					<div className="p-4 space-y-4">
						{/* Alias badge */}
						<div
							className={`text-center bg-indigo-600 px-3 py-1 text-sm text-white pixel-border-primary uppercase font-bold ${isSpecialUnlocked ? "special-sparkle !bg-slate-900 !border-yellow-500" : ""}`}
						>
							{myAlias}
						</div>

						{/* Alias input */}
						<div>
							<p className="text-[10px] mb-1 text-slate-500 uppercase tracking-widest">
								ĐỔI BIỆT DANH
							</p>
							<input
								type="text"
								value={myAlias}
								onChange={(e) => setMyAlias(e.target.value)}
								className={`w-full bg-slate-950 border-2 border-slate-800 p-1.5 text-center text-white focus:outline-none focus:border-indigo-500 uppercase text-sm ${isSpecialUnlocked ? "special-sparkle" : ""}`}
								placeholder="NHẬP TÊN..."
							/>
							{!isSpecialUnlocked && (
								<p className="text-[9px] text-slate-600 mt-1 uppercase tracking-wide">
									💡 Mật mã: Ngày sinh Admin (DDMMYYYY)...
								</p>
							)}
						</div>

						{/* Avatar selection */}
						<div>
							<p className="text-[10px] mb-1 text-slate-500 uppercase tracking-widest">
								HÌNH ĐẠI DIỆN
							</p>
							<div className="flex justify-center gap-2 flex-wrap">
								{availableAvatars.map((av) => (
									<button
										key={av}
										onClick={() => {
											sound.playClick();
											setMyAvatar(av);
										}}
										className={`w-10 h-10 text-xl flex items-center justify-center pixel-border transition-all relative ${myAvatar === av ? "bg-indigo-600 scale-110" : "bg-slate-800 border-slate-700"} ${av === "pig" || av === "cow" ? "glow-gold shadow-[0_0_20px_rgba(234,179,8,0.5)]" : ""}`}
									>
										{AVATAR_ICONS[av]}
										{(av === "pig" || av === "cow") && (
											<span className="absolute -top-1 -right-1 text-[8px] animate-bounce">
												⭐
											</span>
										)}
									</button>
								))}
							</div>
						</div>

						{/* Gender selection - compact 2 column */}
						<div className="grid grid-cols-2 gap-3">
							<div>
								<p className="text-[10px] mb-1 text-slate-500 uppercase">
									GIỚI TÍNH
								</p>
								<div className="flex flex-col gap-1">
									{["male", "female", "other"].map((g) => (
										<button
											key={g}
											onClick={() => setMyGender(g as Gender)}
											className={`py-0.5 text-xs pixel-border ${myGender === g ? "bg-indigo-600" : "bg-slate-800 border-slate-700"}`}
										>
											{g === "male" ? "NAM" : g === "female" ? "NỮ" : "KHÁC"}
										</button>
									))}
								</div>
							</div>
							<div>
								<p className="text-[10px] mb-1 text-slate-500 uppercase">
									TÌM KIẾM
								</p>
								<div className="flex flex-col gap-1">
									{["male", "female", "other"].map((g) => (
										<button
											key={g}
											onClick={() => setPrefGender(g as Gender)}
											className={`py-0.5 text-xs pixel-border ${prefGender === g ? "bg-purple-600" : "bg-slate-800 border-slate-700"}`}
										>
											{g === "male" ? "NAM" : g === "female" ? "NỮ" : "BẤT KỲ"}
										</button>
									))}
								</div>
							</div>
						</div>

						{/* Mood */}
						<div>
							<p className="text-[10px] mb-1 text-slate-500 uppercase tracking-widest text-center">
								TÂM TRẠNG ĐÊM NAY
							</p>
							<div className="grid grid-cols-4 gap-1">
								{Object.keys(MOOD_DATA).map((m) => (
									<button
										key={m}
										onClick={() => setMyMood(m as Mood)}
										className={`py-1.5 flex flex-col items-center pixel-border ${myMood === m ? "bg-indigo-600" : "bg-slate-800 border-slate-700"}`}
									>
										<span className="text-lg">{MOOD_DATA[m as Mood].icon}</span>
										<span className="text-[9px] mt-0.5">{MOOD_DATA[m as Mood].label}</span>
									</button>
								))}
							</div>
						</div>

						{/* Match button */}
						<PixelButton
							className="w-full py-3 text-lg"
							onClick={() =>
								onStart(myGender, prefGender, myMood, myMood, myAvatar, myAlias)
							}
						>
							{targetRoom ? `KẾT NỐI VỚI ${targetAlias.toUpperCase()}` : "🔍 TÌM NGƯỜI TÂM SỰ"}
						</PixelButton>

						{/* Private room */}
						<button
							type="button"
							onClick={generateInviteLink}
							className="bg-indigo-950 hover:bg-indigo-900 text-indigo-300 py-2 px-3 text-[10px] pixel-border font-bold uppercase w-full tracking-widest transition-colors"
						>
							TẠO PHÒNG RIÊNG
						</button>

						{/* Weekly event */}
						{weeklyEvent && (
							<div className={`p-2 border-2 text-center text-[10px] ${weeklyEvent.color}`}>
								<span className="font-black uppercase tracking-wider block mb-0.5 text-xs">
									✨ {weeklyEvent.title} ✨
								</span>
								<span className="opacity-80 text-[10px] leading-tight">{weeklyEvent.desc}</span>
							</div>
						)}

						{/* Memories */}
						{memories.length > 0 && (
							<div className="border-t-2 border-slate-800 pt-3">
								<p className="text-indigo-400 mb-2 text-[10px] uppercase tracking-[0.2em] font-black text-center">
									✦ Kỷ Niệm ✦
								</p>
								<div className="space-y-1.5 text-left max-h-[100px] overflow-y-auto pr-1 scrollbar-thin">
									{memories.slice(0, 5).map((m) => (
										<div key={m.id} className="text-[10px] border-b border-indigo-950/20 pb-1 last:border-b-0">
											<span className="text-indigo-400 font-bold uppercase">{m.alias}: </span>
											<span className="text-slate-300 italic">"{m.text}"</span>
										</div>
									))}
								</div>
								{!hasSubmittedMemory && (
									<form onSubmit={handleMemorySubmit} className="mt-2 flex gap-1">
										<input
											type="text"
											value={memoryInput}
											onChange={(e) => setMemoryInput(e.target.value)}
											maxLength={50}
											placeholder="Lời nhắn đêm nay..."
											className="flex-1 bg-slate-950 border border-slate-800 p-1 px-2 text-[10px] focus:outline-none text-white uppercase"
										/>
										<button type="submit" className="bg-indigo-900 text-white px-3 py-1 text-[10px] pixel-border hover:bg-indigo-800 transition-colors">
											GỬI
										</button>
									</form>
								)}
							</div>
						)}

						<div className="text-center opacity-20 text-[9px] uppercase tracking-widest pt-2 border-t border-slate-800">
							22h đêm — 4h sáng
						</div>
					</div>
				</div>

				{/* Online user hint (bottom-left) */}
				<div className="absolute bottom-2 left-2 z-50 text-[10px] text-slate-500 uppercase tracking-wider pointer-events-none">
					⌨ WASD / Arrow Keys to move • Click to walk
				</div>
			</div>

			{/* Emoji reaction bar */}
			<div className="emoji-bar flex-shrink-0">
				{LOBBY_EMOJIS.map((emoji) => (
					<button
						key={emoji}
						type="button"
						onClick={() => handleEmojiSend(emoji)}
					>
						{emoji}
					</button>
				))}
			</div>

			{/* Bartender Chat Panel */}
			<BartenderChat
				isOpen={bartenderChatOpen}
				onClose={handleBartenderClose}
			/>

			{/* Mailbox Panel */}
			<MailboxPanel
				isOpen={mailboxOpen}
				myAlias={myAlias}
				myAvatar={myAvatar}
				onClose={handleMailboxClose}
			/>
		</div>
	);
};

export default Lobby;
