import React, { useState, useEffect, useCallback, useMemo } from "react";
import { AppState, Gender, Mood, Avatar } from "./types";
import { p2p } from "./services/p2pService";
import { sound } from "./services/soundService";
import Lobby from "./components/Lobby";
import ChatRoom from "./components/ChatRoom";



// Component tạo hiệu ứng mưa rơi ngẫu nhiên chân thực
const RainOverlay: React.FC = () => {
	const drops = useMemo(() => {
		return Array.from({ length: 80 }).map((_, i) => ({
			id: i,
			left: `${Math.random() * 100}%`,
			duration: `${0.4 + Math.random() * 0.4}s`,
			delay: `${Math.random() * 2}s`,
			opacity: 0.1 + Math.random() * 0.3,
			height: `${20 + Math.random() * 30}px`,
			width: Math.random() > 0.5 ? "1px" : "2px",
		}));
	}, []);

	return (
		<div className="absolute inset-0 pointer-events-none overflow-hidden z-[50]">
			{drops.map((drop) => (
				<div
					key={drop.id}
					className="absolute bg-indigo-400/60"
					style={{
						left: drop.left,
						height: drop.height,
						width: drop.width,
						opacity: drop.opacity,
						top: "-100px",
						animation: `rain-fall-drop ${drop.duration} linear infinite`,
						animationDelay: drop.delay,
					}}
				/>
			))}
			<style>{`
        @keyframes rain-fall-drop {
          0% { transform: translateY(0); }
          100% { transform: translateY(120vh); }
        }
      `}</style>
		</div>
	);
};

const App: React.FC = () => {
	const [appState, setAppState] = useState<AppState>(AppState.CLOSED);
	const [onlineCount, setOnlineCount] = useState(0);
	const [isTimeChecked, setIsTimeChecked] = useState(false);
	const [vibeMode, setVibeMode] = useState<"off" | "rain" | "lofi">("off");
	const [matchingParams, setMatchingParams] = useState<any>(null);
	const [strangerAvatar, setStrangerAvatar] = useState<Avatar>("human");
	const [strangerAlias, setStrangerAlias] = useState("Người Lạ");
	const [countdown, setCountdown] = useState("");
	const [farewellMsg, setFarewellMsg] = useState("");
	const [isSpecialUnlocked, setIsSpecialUnlocked] = useState(false);

	const checkOpeningHours = useCallback(async () => {
		const now = new Date();
		const hour = now.getHours();
		const minute = now.getMinutes();

		const isOpen = hour >= 22 || hour < 4;
		// const isOpen = true; // Bỏ giới hạn giờ mở cửa cho mục đích thử nghiệm

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
			const target = new Date();
			target.setHours(22, 0, 0, 0);
			const diff = target.getTime() - now.getTime();

			const h = Math.floor(diff / (1000 * 60 * 60));
			const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
			const s = Math.floor((diff % (1000 * 60)) / 1000);
			setCountdown(
				`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`,
			);
		}
		setIsTimeChecked(true);
	}, [appState]);

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

	const toggleVibeCycle = () => {
		sound.playClick();
		const next =
			vibeMode === "off" ? "rain" : vibeMode === "rain" ? "lofi" : "off";
		setVibeMode(next);
		sound.toggleAtmosphere(next);
	};

	if (!isTimeChecked) return null;

	return (
		<div
			className={`min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden bg-[#020205] ${appState === AppState.CLOSING ? "transition-opacity duration-[60000ms] opacity-0" : ""}`}>
			{/* Dynamic Background Elements */}
				<div className="absolute inset-0 pointer-events-none bg-night-city opacity-80">
					<div className="absolute top-[12%] left-[18%] moon scale-75 md:scale-90 opacity-20"></div>
					<div className="night-dust"></div>
					<div className="city-fog"></div>

					<div
						className="city-window left-[33%] bottom-[37%]"
						style={{ animationDelay: "1s" }}></div>
					<div
						className="city-window left-[47%] bottom-[34%]"
						style={{ animationDelay: "3s" }}></div>
					<div
						className="city-window left-[64%] bottom-[39%]"
						style={{ animationDelay: "5s" }}></div>
					<div
						className="city-window left-[83%] bottom-[35%]"
						style={{ animationDelay: "2s" }}></div>

				{/* NEW REALISTIC RAIN OVERLAY */}
				{vibeMode === "rain" && <RainOverlay />}

				<div className="absolute bottom-0 left-0 w-full h-64 bg-gradient-to-t from-[#020205] to-transparent z-10 opacity-80"></div>
			</div>

			<div className="fixed top-4 left-4 flex flex-col md:flex-row gap-4 z-[400]">
				<div className="bg-slate-900/80 px-4 py-1 pixel-border text-sm flex items-center gap-2">
					<div className="w-2 h-2 bg-green-500 animate-pulse"></div>
					ONLINE:{" "}
					<span className="text-green-400">{onlineCount}</span>
				</div>
				<button
					onClick={toggleVibeCycle}
					className={`px-4 py-1 pixel-border text-sm transition-all ${vibeMode !== "off" ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400"}`}>
					{vibeMode === "lofi"
						? "📻 LO-FI"
						: vibeMode === "rain"
							? "🌧️ RAIN"
							: "🔇 OFF"}
				</button>
			</div>

			{appState === AppState.LOBBY && (
				<Lobby
					onStart={(mine, pref, m, pm, av, al) => {
						sound.playClick();
						setMatchingParams({ mine, pref, m, pm, av, al });
						setAppState(AppState.MATCHING);
						p2p.startMatching(mine, pref, m, pm, av, al);
					}}
					isSpecialUnlocked={isSpecialUnlocked}
					onUnlockSpecial={() => setIsSpecialUnlocked(true)}
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
				<div className="flex flex-col items-center z-20">
					<div className="w-16 h-16 bg-indigo-500 mb-6 pixel-border-primary animate-bounce"></div>
					<p className="text-xl text-indigo-400 mb-6 animate-pulse uppercase tracking-widest">
						Đang quét tần số...
					</p>
					<button
						onClick={() => {
							p2p.stopMatching();
							setAppState(AppState.LOBBY);
						}}
						className="text-base text-rose-500 hover:underline uppercase">
						[ HỦY ]
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
				<div className="flex flex-col items-center max-w-lg w-full z-20 mt-[15vh]">
					<div className="relative mb-12 flex flex-col items-center">
						<div className="neon-sign bg-[#050510] px-12 py-6 pixel-border border-indigo-900 relative z-20">
							<h1 className="text-7xl md:text-9xl tracking-tighter uppercase font-bold flicker-text" style={{ textShadow: '0 0 15px rgba(79, 70, 229, 0.8)' }}>
								CLOSED
							</h1>
						</div>
					</div>

					<div className="bg-black/80 p-10 pixel-border w-full text-center shadow-2xl">
						<p className="text-indigo-500 mb-6 text-sm uppercase tracking-[0.6em] font-bold">
							AVAILABLE FROM 10:00 PM TO 4:00 AM
						</p>
						<div className="text-5xl text-slate-100 font-mono tracking-[0.2em] bg-indigo-950/30 px-8 py-5 pixel-border border-slate-700 shadow-inner">
							{countdown}
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default App;
