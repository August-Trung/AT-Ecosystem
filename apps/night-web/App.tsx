import React, { useState, useEffect, useCallback, useMemo } from "react";
import { AppState, Gender, Mood, Avatar, Memory } from "./types";
import { p2p } from "./services/p2pService";
import { sound } from "./services/soundService";
import { lobbyPresence } from "./services/lobbyPresenceService";
import Lobby from "./components/Lobby";
import ChatRoom from "./components/ChatRoom";
import CanvasBackground from "./components/CanvasBackground";
import PixelJukebox from "./components/PixelJukebox";

const App: React.FC = () => {
	const [appState, setAppState] = useState<AppState>(AppState.CLOSED);
	const [onlineCount, setOnlineCount] = useState(0);
	const [isTimeChecked, setIsTimeChecked] = useState(false);
	const [vibeMode, setVibeMode] = useState<"off" | "rain" | "lofi" | "waves" | "jazz">("off");
	const [matchingParams, setMatchingParams] = useState<any>(null);
	const [strangerAvatar, setStrangerAvatar] = useState<Avatar>("human");
	const [strangerAlias, setStrangerAlias] = useState("Người Lạ");
	const [countdown, setCountdown] = useState("");
	const [farewellMsg, setFarewellMsg] = useState("");
	const [isSpecialUnlocked, setIsSpecialUnlocked] = useState(false);
	const [memories, setMemories] = useState<Memory[]>([]);
	const [timeOffset, setTimeOffset] = useState(0);
	const [inviteLink, setInviteLink] = useState("");
	const [isDirectWaiting, setIsDirectWaiting] = useState(false);
	const [isCopied, setIsCopied] = useState(false);
	const [showJukebox, setShowJukebox] = useState(false);

	const fallbackCopy = (text: string) => {
		const textArea = document.createElement("textarea");
		textArea.value = text;
		
		// Tránh cuộn trang xuống dưới
		textArea.style.top = "0";
		textArea.style.left = "0";
		textArea.style.position = "fixed";
		textArea.style.width = "2em";
		textArea.style.height = "2em";
		textArea.style.padding = "0";
		textArea.style.border = "none";
		textArea.style.outline = "none";
		textArea.style.boxShadow = "none";
		textArea.style.background = "transparent";
		
		document.body.appendChild(textArea);
		textArea.focus();
		textArea.select();
		
		// Cho thiết bị di động
		textArea.setSelectionRange(0, 99999);
		
		try {
			const successful = document.execCommand("copy");
			if (successful) {
				setIsCopied(true);
				setTimeout(() => setIsCopied(false), 2000);
			} else {
				prompt("Vui lòng sao chép liên kết dưới đây:", text);
			}
		} catch (err) {
			prompt("Vui lòng sao chép liên kết dưới đây:", text);
		}
		document.body.removeChild(textArea);
	};

	const copyInviteLink = () => {
		sound.playClick();
		if (navigator.clipboard && navigator.clipboard.writeText) {
			navigator.clipboard.writeText(inviteLink)
				.then(() => {
					setIsCopied(true);
					setTimeout(() => setIsCopied(false), 2000);
				})
				.catch(() => fallbackCopy(inviteLink));
		} else {
			fallbackCopy(inviteLink);
		}
	};

	const checkOpeningHours = useCallback(async () => {
		const now = new Date(Date.now() + timeOffset);
		const hour = now.getHours();
		const minute = now.getMinutes();

		const params = new URLSearchParams(window.location.search);
		const room = params.get("room");
		const isAdmin = params.get("admin") === "true" || params.get("bypass") === "true";
		const isOpen = hour >= 22 || hour < 4 || !!room || isAdmin;

		if (isOpen) {
			if (hour === 3 && minute === 59 && appState !== AppState.CLOSING) {
				setAppState(AppState.CLOSING);
				const { generateFarewell } = await import(
					"./services/geminiService"
				);
				const msg = await generateFarewell();
				setFarewellMsg(msg);
			} else if (appState === AppState.CLOSED) {
				setAppState(AppState.LOBBY);
			}
		} else {
			if (appState !== AppState.CLOSED) {
				localStorage.clear();
				setAppState(AppState.CLOSED);
			}
			const target = new Date(now.getTime());
			target.setHours(22, 0, 0, 0);
			if (target.getTime() < now.getTime()) {
				// Nếu đã qua 22h nhưng vì lý do nào đó vẫn CLOSED (ví dụ: ngày khác), cộng 1 ngày
				target.setDate(target.getDate() + 1);
			}
			const diff = target.getTime() - now.getTime();

			const h = Math.floor(diff / (1000 * 60 * 60));
			const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
			const s = Math.floor((diff % (1000 * 60)) / 1000);
			setCountdown(
				`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`,
			);
		}
		setIsTimeChecked(true);
	}, [appState, timeOffset]);

	useEffect(() => {
		// Fetch true time on mount to prevent clock manipulation
		const fetchTrueTime = async () => {
			try {
				// Thử timeapi.io trước vì dịch vụ này hoạt động ổn định và ít bị chặn tại VN
				const res = await fetch("https://timeapi.io/api/time/current/zone?timeZone=Asia/Ho_Chi_Minh");
				if (res.ok) {
					const data = await res.json();
					const trueTime = new Date(data.dateTime).getTime();
					const localTime = Date.now();
					setTimeOffset(trueTime - localTime);
					return;
				}
			} catch (e) {
				// Bỏ qua lỗi và chuyển sang fallback tiếp theo
			}

			try {
				// Dự phòng sang worldtimeapi.org
				const res = await fetch("https://worldtimeapi.org/api/timezone/Asia/Ho_Chi_Minh");
				if (res.ok) {
					const data = await res.json();
					const trueTime = new Date(data.datetime).getTime();
					const localTime = Date.now();
					setTimeOffset(trueTime - localTime);
					return;
				}
			} catch (e) {
				console.warn("Could not sync with time APIs, using local clock.");
			}
		};
		fetchTrueTime();

		p2p.onMemoriesUpdate = (updated) => {
			setMemories(updated);
		};
		setMemories(p2p.memories);
	}, []);

	useEffect(() => {
		checkOpeningHours();
		const timer = setInterval(checkOpeningHours, 1000);
		p2p.onConnected = (avatar, alias) => {
			setStrangerAvatar(avatar);
			setStrangerAlias(alias || "Người Lạ");
			setAppState(AppState.CHATTING);
		};
		p2p.onOnlineCountUpdate = (count) => setOnlineCount(count);
		return () => clearInterval(timer);
	}, [checkOpeningHours]);

	// Lobby presence lifecycle
	useEffect(() => {
		if (appState === AppState.LOBBY) {
			const savedAvatar = (localStorage.getItem("m_avatar") as Avatar) || "human";
			const savedAlias = localStorage.getItem("m_alias") || "Người Lạ";
			lobbyPresence.join(savedAvatar, savedAlias);
		} else {
			lobbyPresence.leave();
		}
	}, [appState]);

	useEffect(() => {
		if (appState === AppState.MATCHING) {
			p2p.onDisconnected = () => {
				setAppState(AppState.LOBBY);
				alert("Không thể kết nối đến đối phương. Vui lòng kiểm tra lại liên kết hoặc kết nối mạng.");
			};
		}
	}, [appState]);

	const toggleVibeCycle = () => {
		sound.playClick();
		const next =
			vibeMode === "off"
				? "rain"
				: vibeMode === "rain"
					? "lofi"
					: vibeMode === "lofi"
						? "waves"
						: vibeMode === "waves"
							? "jazz"
							: vibeMode === "jazz"
								? "campfire"
								: vibeMode === "campfire"
									? "cafe"
									: "off";
		setVibeMode(next);
		sound.toggleAtmosphere(next);
	};

	if (!isTimeChecked) return null;

	return (
		<div
			className={`h-screen w-screen flex flex-col items-center relative bg-[#020205] ${appState === AppState.LOBBY ? "p-0 overflow-hidden" : "p-4"} ${appState === AppState.CHATTING ? "justify-center overflow-hidden" : appState === AppState.LOBBY ? "" : "justify-start overflow-y-auto pt-6 md:pt-12 scrollbar-thin"} ${appState === AppState.CLOSING ? "transition-opacity duration-[60000ms] opacity-0" : ""}`}>
			{/* Dynamic Background Elements — hidden during LOBBY (canvas has its own bg) */}
			{appState !== AppState.LOBBY && (
				<div className="absolute inset-0 pointer-events-none bg-night-city opacity-80">
					<div className="absolute top-[12%] left-[18%] moon scale-75 md:scale-90 opacity-20"></div>
					<CanvasBackground vibeMode={vibeMode} />
					<div className="absolute bottom-0 left-0 w-full h-64 bg-gradient-to-t from-[#020205] to-transparent z-10 opacity-80"></div>
				</div>
			)}

			{appState !== AppState.CHATTING && (
				<div className={`fixed ${appState === AppState.LOBBY ? "top-2 right-2" : "top-4 left-4"} flex flex-col md:flex-row gap-2 md:gap-4 z-[400]`}>
					<div className="bg-slate-900/80 px-3 py-1 pixel-border text-sm flex items-center gap-2">
						<div className="w-2 h-2 bg-green-500 animate-pulse"></div>
						ONLINE:{" "}
						<span className="text-green-400">{onlineCount}</span>
					</div>
					<button
						onClick={toggleVibeCycle}
						className={`px-3 py-1 pixel-border text-sm transition-all ${vibeMode !== "off" ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400"}`}>
						{vibeMode === "lofi"
							? "📻 LO-FI"
							: vibeMode === "rain"
								? "🌧️ RAIN"
								: vibeMode === "waves"
									? "🌊 WAVES"
									: vibeMode === "jazz"
										? "🎹 JAZZ"
										: vibeMode === "campfire"
											? "🔥 CAMPFIRE"
											: vibeMode === "cafe"
												? "☕ CAFE"
												: "🔇 OFF"}
					</button>
					<button
						type="button"
						onClick={() => {
							sound.playClick();
							setShowJukebox(true);
						}}
						className="px-3 py-1 pixel-border text-sm bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-all">
						📻 JUKEBOX
					</button>
				</div>
			)}

			{appState === AppState.LOBBY && (
				<Lobby
					onStart={(mine, pref, m, pm, av, al) => {
						sound.playClick();
						setIsDirectWaiting(false);
						setInviteLink("");
						setMatchingParams({ mine, pref, m, pm, av, al });
						setAppState(AppState.MATCHING);
						const params = new URLSearchParams(window.location.search);
						const room = params.get("room");
						if (room) {
							p2p.startDirectConnect(room, av, al);
						} else {
							p2p.startMatching(mine, pref, m, pm, av, al);
						}
					}}
					onStartPrivateRoom={(mine, pref, m, pm, av, al) => {
						sound.playClick();
						setMatchingParams({ mine, pref, m, pm, av, al });
						const peerId = p2p.getPeerIdAndListen(av, al);
						const link = `${window.location.origin}${window.location.pathname}?room=${peerId}&alias=${encodeURIComponent(al)}&avatar=${av}`;
						setInviteLink(link);
						setIsDirectWaiting(true);
						setAppState(AppState.MATCHING);
					}}
					isSpecialUnlocked={isSpecialUnlocked}
					onUnlockSpecial={() => setIsSpecialUnlocked(true)}
					memories={memories}
					onSubmitMemory={(text, alias) => p2p.submitMemory(text, alias)}
				/>
			)}

			{appState === AppState.CHATTING && (
				<ChatRoom
					myAvatar={matchingParams?.av || "human"}
					strangerAvatar={strangerAvatar}
					strangerInitialAlias={strangerAlias}
					myAlias={matchingParams?.al || "Neon Rider"}
					myMood={matchingParams?.m || "chill"}
					vibeMode={vibeMode}
					toggleVibeCycle={toggleVibeCycle}
					onOpenJukebox={() => setShowJukebox(true)}
					onExit={() => {
						p2p.disconnect();
						setAppState(AppState.LOBBY);
					}}
					onNext={() => {
						p2p.disconnect();
						setAppState(AppState.MATCHING);
						p2p.startMatching(
							matchingParams.mine,
							matchingParams.pref,
							matchingParams.m,
							matchingParams.pm,
							matchingParams.av,
							matchingParams.al,
						);
					}}
				/>
			)}

			{appState === AppState.MATCHING && (
				<div className="flex flex-col items-center z-20 max-w-md w-full bg-slate-900/95 p-6 pixel-border text-center shadow-2xl">
					<div className="w-16 h-16 bg-indigo-500 mb-6 pixel-border-primary animate-bounce mx-auto"></div>
					<p className="text-xl text-indigo-400 mb-4 animate-pulse uppercase tracking-widest">
						{isDirectWaiting 
							? "Đang đợi bạn kết nối..." 
							: (() => {
								const params = new URLSearchParams(window.location.search);
								const room = params.get("room");
								const targetAlias = params.get("alias") ? decodeURIComponent(params.get("alias")!) : "Người Lạ";
								return room ? `Đang kết nối tới ${targetAlias}...` : "Đang quét tần số...";
							  })()}
					</p>
					
					{isDirectWaiting && inviteLink && (
						<div className="w-full flex flex-col gap-3 mb-6 bg-slate-950 p-4 border-2 border-slate-800">
							<p className="text-[10px] text-slate-400 uppercase tracking-widest">
								Gửi liên kết bên dưới cho bạn bè:
							</p>
							<input
								type="text"
								readOnly
								value={inviteLink}
								onClick={(e) => (e.target as HTMLInputElement).select()}
								className="w-full bg-slate-900 border-2 border-slate-800 p-2 text-center text-indigo-300 text-xs font-mono select-all focus:outline-none"
							/>
							<button
								type="button"
								onClick={copyInviteLink}
								className="bg-indigo-900 text-white py-2 px-4 text-xs font-bold uppercase pixel-border w-full hover:bg-indigo-800 transition-colors"
							>
								{isCopied ? "✓ ĐÃ SAO CHÉP!" : "📋 SAO CHÉP LIÊN KẾT"}
							</button>
						</div>
					)}

					<button
						onClick={() => {
							p2p.stopMatching();
							p2p.disconnect();
							setIsDirectWaiting(false);
							setInviteLink("");
							setAppState(AppState.LOBBY);
						}}
						className="text-base text-rose-500 hover:underline uppercase">
						{isDirectWaiting 
							? "[ HỦY PHÒNG RIÊNG ]" 
							: (() => {
								const params = new URLSearchParams(window.location.search);
								return params.get("room") ? "[ HỦY KẾT NỐI ]" : "[ HỦY TÌM KIẾM ]";
							  })()}
					</button>
				</div>
			)}

			{appState === AppState.CLOSING && (
				<div className="flex flex-col items-center max-w-lg w-full z-[500] text-center p-8 animate-in fade-in duration-[5000ms]">
					<div className="text-6xl mb-6">🥂</div>
					<h2 className="text-4xl text-indigo-400 font-bold mb-4 uppercase tracking-[0.3em]">
						Lễ bế mạc
					</h2>
					<p className="text-xl text-white italic mb-12 leading-relaxed font-serif">
						"{farewellMsg}"
					</p>
					<div className="text-xs text-slate-600 uppercase tracking-widest">
						Website sẽ đóng sau ít phút...
					</div>
				</div>
			)}

			{appState === AppState.CLOSED && (
				<div className="flex flex-col items-center max-w-lg w-full z-20 mt-[8vh] md:mt-[12vh]">
					<div className="relative mb-8 flex flex-col items-center">
						<div className="neon-sign bg-[#050510] px-12 py-6 pixel-border border-indigo-900 relative z-20">
							<h1 className="text-7xl md:text-9xl tracking-tighter uppercase font-bold flicker-text" style={{ textShadow: '0 0 15px rgba(79, 70, 229, 0.8)' }}>
								CLOSED
							</h1>
						</div>
					</div>

					<div className="bg-black/80 p-8 pixel-border w-full text-center shadow-2xl">
						<p className="text-indigo-500 mb-4 text-sm uppercase tracking-[0.6em] font-bold">
							AVAILABLE FROM 10:00 PM TO 4:00 AM
						</p>
						<div className="text-4xl md:text-5xl text-slate-100 font-mono tracking-[0.2em] bg-indigo-950/30 px-6 py-4 pixel-border border-slate-700 shadow-inner">
							{countdown}
						</div>
					</div>

					{/* Bức Tường Kỷ Niệm (Memories Wall) trong CLOSED View */}
					{memories.length > 0 && (
						<div className="bg-black/90 p-5 pixel-border w-full mt-6 text-center shadow-2xl max-h-[220px]">
							<p className="text-indigo-400 mb-3 text-xs uppercase tracking-[0.3em] font-black border-b border-indigo-950 pb-2">
								✦ Bức Tường Kỷ Niệm Đêm Qua ✦
							</p>
							<div className="space-y-3 text-left max-h-[130px] overflow-y-auto pr-2 scrollbar-thin">
								{memories.map((m) => (
									<div key={m.id} className="text-sm border-b border-indigo-950/20 pb-1.5 last:border-b-0">
										<span className="text-indigo-400 font-bold uppercase">{m.alias}: </span>
										<span className="text-slate-300 italic">"{m.text}"</span>
										<span className="text-[9px] text-slate-600 block text-right mt-0.5">
											{new Date(m.timestamp).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
										</span>
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			)}
			<div className={`fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[9999] transition-all duration-300 ${showJukebox ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>
				<PixelJukebox
					vibeMode={vibeMode}
					onMuteProcedural={(mute) => {
						if (mute) sound.toggleAtmosphere("off");
						else sound.toggleAtmosphere(vibeMode);
					}}
					onClose={() => {
						setShowJukebox(false);
						sound.playClick();
					}}
				/>
			</div>
		</div>
	);
};

export default App;
