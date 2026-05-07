import React, { useState, useEffect, useRef, useMemo } from "react";
import {
	Avatar,
	Message,
	AVATAR_ICONS,
	Mood,
	REACTION_EMOJIS,
	GameState,
	Card,
} from "../types";
import { p2p } from "../services/p2pService";
import { sound } from "../services/soundService";
import {
	CARDS_PER_PLAYER,
	createCard,
	createDeck,
	dealInitialHands,
	getOpeningCardId,
	shuffleDeck,
	validateInitialHands,
	validateOpponentMove,
} from "../services/tienLenRules";
import PixelButton from "./PixelButton";
import TienLenGame from "./TienLenGame";
import SketchCanvas from "./SketchCanvas";

interface ChatRoomProps {
	myAvatar: Avatar;
	strangerAvatar: Avatar;
	strangerInitialAlias: string;
	myAlias: string;
	myMood: Mood;
	onExit: () => void;
	onNext: () => void;
	vibeMode: string;
}

const ChatRoom: React.FC<ChatRoomProps> = ({
	myAvatar,
	strangerAvatar,
	strangerInitialAlias,
	myAlias,
	myMood,
	onExit,
	onNext,
	vibeMode,
}) => {
	const [messages, setMessages] = useState<Message[]>([]);
	const [inputValue, setInputValue] = useState("");
	const [isStrangerTyping, setIsStrangerTyping] = useState(false);
	const [strangerAlias, setStrangerAlias] = useState(
		strangerInitialAlias || "Người Lạ",
	);
	const [isSyncing, setIsSyncing] = useState(false);
	const [activeReactionId, setActiveReactionId] = useState<string | null>(
		null,
	);
	const [reactionPickerSide, setReactionPickerSide] = useState<
		"above" | "below"
	>("below");
	const [myReactions, setMyReactions] = useState<Record<string, Set<string>>>(
		{},
	);
	const [showAppMenu, setShowAppMenu] = useState(false);
	const [showSketch, setShowSketch] = useState(false);
	const [incomingSketch, setIncomingSketch] = useState<string | null>(null);
	const [reactionOverlay, setReactionOverlay] = useState<string | null>(null);

	const lastActivityRef = useRef<number>(Date.now());
	const messagesCountRef = useRef<number>(0);

	const isMyAvatarSpecial = myAvatar === "pig" || myAvatar === "cow";
	const isStrangerAvatarSpecial =
		strangerAvatar === "pig" || strangerAvatar === "cow";
	const isDoubleSpecial = isMyAvatarSpecial && isStrangerAvatarSpecial;

	const INITIAL_GAME_STATE: GameState = {
		hand: [],
		opponentCardIds: [],
		opponentCardCount: 0,
		lastPlayedCards: [],
		isMyTurn: false,
		requiredOpeningCardId: null,
		status: "idle",
		myCoins: 1000,
	};

	const [game, setGame] = useState<GameState>(INITIAL_GAME_STATE);
	const gameRef = useRef<GameState>(INITIAL_GAME_STATE);
	const [incomingGameEmoji, setIncomingGameEmoji] = useState<string | null>(
		null,
	);

	const messagesEndRef = useRef<HTMLDivElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const originalTitle = useRef(document.title);
	const notificationInterval = useRef<any>(null);

	const resetGameState = (prev: GameState): GameState => ({
		...INITIAL_GAME_STATE,
		myCoins: prev.myCoins,
	});

	const clearNotification = () => {
		if (notificationInterval.current) {
			clearInterval(notificationInterval.current);
			notificationInterval.current = null;
		}
		document.title = originalTitle.current;
	};

	useEffect(() => {
		messagesCountRef.current = messages.length;
	}, [messages.length]);

	useEffect(() => {
		gameRef.current = game;
	}, [game]);

	useEffect(() => {
		const handleVisibilityChange = () => {
			if (!document.hidden) clearNotification();
		};
		const handleFocus = () => clearNotification();
		window.addEventListener("visibilitychange", handleVisibilityChange);
		window.addEventListener("focus", handleFocus);

		p2p.onMessage = (data: any) => {
			lastActivityRef.current = Date.now();
			if (data.type === "handshake") {
				setStrangerAlias(data.alias || "Người Lạ");
			} else if (data.type === "chat") {
				handleIncomingNotification();
				setMessages((prev) => [
					...prev,
					{
						id: data.id || Date.now().toString(),
						sender: "stranger",
						senderAlias: data.alias || strangerAlias,
						text: data.content,
						timestamp: Date.now(),
					},
				]);
			} else if (data.type === "image") {
				handleIncomingNotification();
				setMessages((prev) => [
					...prev,
					{
						id: data.id || Date.now().toString(),
						sender: "stranger",
						senderAlias: data.alias || strangerAlias,
						image: data.content,
						timestamp: Date.now(),
					},
				]);
			} else if (data.type === "reaction") {
				if (data.emoji === "❤️") triggerReactionOverlay("❤️");
				setMessages((prev) =>
					prev.map((m) => {
						if (m.id === data.messageId) {
							const currentReactions = { ...(m.reactions || {}) };
							const delta = data.action === "remove" ? -1 : 1;
							currentReactions[data.emoji] = Math.max(
								0,
								(currentReactions[data.emoji] || 0) + delta,
							);
							if (currentReactions[data.emoji] === 0)
								delete currentReactions[data.emoji];
							return { ...m, reactions: currentReactions };
						}
						return m;
					}),
				);
			} else if (data.type === "typing") {
				setIsStrangerTyping(!!data.isTyping);
			} else if (data.type === "sketch_data") {
				setIncomingSketch(data.sketch);
				setShowSketch(true);
			} else if (data.type === "sketch_close") {
				setShowSketch(false);
				setIncomingSketch(null);
			} else if (data.type === "game_invite") {
				sound.playMessage();
				if (gameRef.current.status !== "idle") {
					p2p.sendGameDecline();
					return;
				}
				setGame((prev) => ({ ...prev, status: "invited" }));
			} else if (data.type === "game_decline") {
				setMessages((prev) => [
					...prev,
					{
						id: `sys-dec-${Date.now()}`,
						sender: "system",
						text: `ĐỐI THỦ ĐÃ TỪ CHỐI CHƠI BÀI.`,
						timestamp: Date.now(),
					},
				]);
				setGame(resetGameState);
			} else if (data.type === "game_start") {
				if (
					!validateInitialHands(
						data.cards,
						data.dealerCards,
						data.openingCardId,
					)
				)
					return;
				const handIds = data.cards as number[];
				const opponentCardIds = data.dealerCards as number[];
				const openingCardId = data.openingCardId as number;
				if (gameRef.current.status !== "pendingInvite") return;
				setGame((prev) => ({
					...prev,
					hand: handIds.map(createCard),
					opponentCardIds,
					opponentCardCount: CARDS_PER_PLAYER,
					lastPlayedCards: [],
					isMyTurn: handIds.includes(openingCardId),
					requiredOpeningCardId: openingCardId,
					status: "playing",
				}));
			} else if (data.type === "game_move") {
				setGame((prev) => {
					if (prev.status !== "playing" || prev.isMyTurn)
						return prev;
					const move = validateOpponentMove(
						data.cards,
						data.count,
						prev.opponentCardIds,
						prev.lastPlayedCards,
						prev.requiredOpeningCardId,
					);
					if (!move) return prev;
					sound.playMessage();
					const isWin = move.nextOpponentCount <= 0;
					return {
						...prev,
						lastPlayedCards: move.playedCards,
						opponentCardIds: move.nextOpponentCardIds,
						opponentCardCount: move.nextOpponentCount,
						isMyTurn: true,
						requiredOpeningCardId: null,
						status: isWin ? "ended" : "playing",
						myCoins: isWin ? prev.myCoins - 200 : prev.myCoins,
					};
				});
			} else if (data.type === "game_pass") {
				setGame((prev) => {
					if (
						prev.status !== "playing" ||
						prev.isMyTurn ||
						prev.lastPlayedCards.length === 0
					)
						return prev;
					sound.playMessage();
					return {
						...prev,
						isMyTurn: true,
						lastPlayedCards: [],
						requiredOpeningCardId: null,
					};
				});
			} else if (data.type === "game_quit") {
				setGame((prev) => ({ ...prev, status: "quit" }));
			} else if (data.type === "game_emoji") {
				setIncomingGameEmoji(data.emoji);
				setTimeout(() => setIncomingGameEmoji(null), 2000);
			}
		};

		p2p.onVibeSync = (v) => setIsSyncing(v === "lofi");
		p2p.onDisconnected = () => {
			setMessages((prev) => [
				...prev,
				{
					id: `sys-dc-${Date.now()}`,
					sender: "system",
					text: `--- ${strangerAlias.toUpperCase()} ĐÃ RỜI PHÒNG ---`,
					timestamp: Date.now(),
				},
			]);
			setGame(INITIAL_GAME_STATE);
			setShowSketch(false);
			setIncomingSketch(null);
		};

		p2p.sendVibeSync(vibeMode === "lofi" ? "lofi" : "off");

		const bartenderInterval = setInterval(async () => {
			const now = Date.now();
			if (
				now - lastActivityRef.current > 120000 &&
				messagesCountRef.current > 0
			) {
				lastActivityRef.current = now;
				const { generateSilenceBreaker } = await import(
					"../services/geminiService"
				);
				const hint = await generateSilenceBreaker();
				setMessages((prev) => [
					...prev,
					{
						id: `bartender-${Date.now()}`,
						sender: "bartender",
						text: `🍸 Bartender: ${hint}`,
						timestamp: Date.now(),
					},
				]);
			}
		}, 60000);

		return () => {
			p2p.onMessage = () => {};
			clearInterval(bartenderInterval);
			window.removeEventListener(
				"visibilitychange",
				handleVisibilityChange,
			);
			window.removeEventListener("focus", handleFocus);
			clearNotification();
		};
	}, [strangerAlias]);

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages, isStrangerTyping]);

	const triggerReactionOverlay = (emoji: string) => {
		setReactionOverlay(emoji);
		setTimeout(() => setReactionOverlay(null), 3000);
	};

	const handleIncomingNotification = () => {
		sound.playMessage();
		if (document.hidden) {
			if (notificationInterval.current)
				clearInterval(notificationInterval.current);
			let isAlt = false;
			notificationInterval.current = setInterval(() => {
				document.title = isAlt
					? "TIN NHẮN MỚI!"
					: "🔴 " + originalTitle.current;
				isAlt = !isAlt;
			}, 800);
		}
	};

	const handleSendMessage = (e?: React.FormEvent) => {
		e?.preventDefault();
		clearNotification();
		if (!inputValue.trim()) return;
		lastActivityRef.current = Date.now();
		const msgId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
		p2p.sendMessage(inputValue, msgId);
		setMessages((prev) => [
			...prev,
			{
				id: msgId,
				sender: "me",
				text: inputValue,
				timestamp: Date.now(),
			},
		]);
		setInputValue("");
		p2p.sendTyping(false);
	};

	const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = (ev) => {
			const img = new Image();
			img.onload = () => {
				const canvas = document.createElement("canvas");
				const MAX_WIDTH = 800;
				let width = img.width;
				let height = img.height;
				if (width > MAX_WIDTH) {
					height *= MAX_WIDTH / width;
					width = MAX_WIDTH;
				}
				canvas.width = width;
				canvas.height = height;
				const ctx = canvas.getContext("2d");
				ctx?.drawImage(img, 0, 0, width, height);
				const compressed = canvas.toDataURL("image/jpeg", 0.6);
				const msgId = `img-${Date.now()}`;
				p2p.sendImage(compressed, msgId);
				setMessages((prev) => [
					...prev,
					{
						id: msgId,
						sender: "me",
						image: compressed,
						timestamp: Date.now(),
					},
				]);
			};
			img.src = ev.target?.result as string;
		};
		reader.readAsDataURL(file);
	};

	const toggleReactionPicker = (e: React.MouseEvent, msgId: string) => {
		e.stopPropagation();
		clearNotification();
		if (activeReactionId === msgId) {
			setActiveReactionId(null);
			return;
		}
		const rect = e.currentTarget.getBoundingClientRect();
		const windowHeight = window.innerHeight;
		const spaceBelow = windowHeight - rect.bottom;
		setReactionPickerSide(spaceBelow < 120 ? "above" : "below");
		setActiveReactionId(msgId);
		setShowAppMenu(false);
	};

	const handleAddReaction = (messageId: string, emoji: string) => {
		sound.playClick();
		if (emoji === "❤️") triggerReactionOverlay("❤️");
		const currentMyReactions = myReactions[messageId] || new Set();
		const isRemoving = currentMyReactions.has(emoji);
		const newSet = new Set(currentMyReactions);
		if (isRemoving) newSet.delete(emoji);
		else newSet.add(emoji);
		setMyReactions({ ...myReactions, [messageId]: newSet });
		p2p.sendReaction(messageId, emoji, isRemoving ? "remove" : "add");
		setMessages((prev) =>
			prev.map((m) => {
				if (m.id === messageId) {
					const currentReactions = { ...(m.reactions || {}) };
					const delta = isRemoving ? -1 : 1;
					currentReactions[emoji] = Math.max(
						0,
						(currentReactions[emoji] || 0) + delta,
					);
					if (currentReactions[emoji] === 0)
						delete currentReactions[emoji];
					return { ...m, reactions: currentReactions };
				}
				return m;
			}),
		);
		setActiveReactionId(null);
	};

	const inviteToPlay = () => {
		if (game.status !== "idle") return;
		sound.playClick();
		setShowAppMenu(false);
		p2p.sendGameInvite();
		setGame((prev) => ({ ...prev, status: "pendingInvite" }));
		setMessages((prev) => [
			...prev,
			{
				id: `sys-inv-${Date.now()}`,
				sender: "system",
				text: `✦ ĐÃ GỬI LỜI MỜI CHƠI BÀI ĐẾN ${strangerAlias.toUpperCase()}...`,
				timestamp: Date.now(),
			},
		]);
	};

	const handleGameDecline = () => {
		p2p.sendGameDecline();
		setGame(resetGameState);
	};

	const handleGameAccept = () => {
		if (game.status !== "invited") return;
		const deck = shuffleDeck(createDeck());
		const { myCards, opponentCards } = dealInitialHands(deck);
		const openingCardId = getOpeningCardId(myCards, opponentCards);
		const iHaveOpening = myCards.includes(openingCardId);
		p2p.sendGameStart(
			myCards,
			opponentCards,
			!iHaveOpening,
			openingCardId,
		);
		setGame((prev) => ({
			...prev,
			hand: myCards.map(createCard),
			opponentCardIds: opponentCards,
			opponentCardCount: CARDS_PER_PLAYER,
			lastPlayedCards: [],
			isMyTurn: iHaveOpening,
			requiredOpeningCardId: openingCardId,
			status: "playing",
		}));
	};

	const onLocalPlay = (playedCards: Card[]) => {
		if (game.status !== "playing" || !game.isMyTurn) return;
		const playedIds = playedCards.map((c) => c.id);
		if (!playedIds.every((id) => game.hand.some((h) => h.id === id)))
			return;
		const newHand = game.hand.filter((h) => !playedIds.includes(h.id));
		const isWin = newHand.length === 0;
		p2p.sendGameMove(playedIds, newHand.length);
		setGame((prev) => ({
			...prev,
			hand: newHand,
			lastPlayedCards: playedCards,
			isMyTurn: false,
			requiredOpeningCardId: null,
			status: isWin ? "ended" : "playing",
			myCoins: isWin ? prev.myCoins + 200 : prev.myCoins,
		}));
	};

	const handleCloseSketch = () => {
		if (showSketch) {
			p2p.sendSketchClose();
		}
		setShowSketch(false);
		setIncomingSketch(null);
	};

	const handleGameQuit = () => {
		if (game.status === "playing") {
			p2p.sendGameQuit();
		}
		setGame((prev) => resetGameState(prev));
	};

	const handleGamePass = () => {
		if (
			game.status !== "playing" ||
			!game.isMyTurn ||
			game.lastPlayedCards.length === 0
		)
			return;
		p2p.sendGamePass();
		setGame((prev) => ({
			...prev,
			isMyTurn: false,
			lastPlayedCards: [],
			requiredOpeningCardId: null,
		}));
	};

	return (
		<div
			className={`w-full max-w-2xl h-[85vh] flex flex-col bg-slate-900 pixel-border relative overflow-hidden ${isSyncing && vibeMode === "lofi" ? "animate-pulse-slow" : ""}`}
			onClick={clearNotification}>
			{reactionOverlay && (
				<div className="absolute inset-0 z-[500] pointer-events-none overflow-hidden">
					{[...Array(15)].map((_, i) => (
						<div
							key={i}
							className="absolute text-5xl animate-float-up"
							style={{
								left: `${Math.random() * 100}%`,
								bottom: "-50px",
								animationDelay: `${Math.random() * 2}s`,
								opacity: 0,
							}}>
							{reactionOverlay}
						</div>
					))}
				</div>
			)}

			<style>{`
        @keyframes float-up { 0% { opacity: 1; transform: translateY(0) scale(1); } 100% { opacity: 0; transform: translateY(-100vh) scale(1.5); } }
        .animate-float-up { animation: float-up 3s ease-out forwards; }
        .msg-bartender { background: rgba(16, 185, 129, 0.1); border: 2px dashed rgba(16, 185, 129, 0.4); color: #10b981; font-style: italic; }
      `}</style>

			{/* HEADER */}
			<div
				className={`p-4 border-b-4 border-slate-800 flex justify-between items-center bg-slate-950 z-[300] ${isDoubleSpecial ? "shadow-[0_0_20px_rgba(234,179,8,0.4)]" : ""}`}>
				<div className="flex items-center gap-3">
					<div
						className={`text-3xl bg-slate-800 p-1 pixel-border ${isSyncing ? "animate-bounce" : ""} ${isStrangerAvatarSpecial ? "glow-gold" : ""}`}>
						{AVATAR_ICONS[strangerAvatar]}
					</div>
					<div className="flex flex-col">
						<span
							className={`text-lg leading-none uppercase ${isStrangerAvatarSpecial ? "special-sparkle" : "text-white"}`}>
							{strangerAlias}{" "}
							{isDoubleSpecial
								? "💞"
								: isStrangerAvatarSpecial
									? "⭐"
									: ""}
						</span>
						<span className="text-sm text-indigo-500 animate-pulse uppercase tracking-widest">
							{isDoubleSpecial
								? "✨ TRIPLE MATCH SYNC ✨"
								: "CONNECTED 1-1"}
						</span>
					</div>
				</div>
				<div className="flex gap-2">
					<PixelButton
						variant="secondary"
						className="py-1 px-3 text-base"
						onClick={onNext}>
						TIẾP
					</PixelButton>
					<PixelButton
						variant="danger"
						className="py-1 px-3 text-base"
						onClick={onExit}>
						THOÁT
					</PixelButton>
				</div>
			</div>

			{/* CHAT AREA */}
			<div className="flex-1 relative flex flex-col overflow-hidden bg-[#0a0a14]">
				<div
					className="flex-1 overflow-y-auto p-4 space-y-8 scroll-smooth z-[10]"
					onClick={() => {
						setActiveReactionId(null);
						setShowAppMenu(false);
						clearNotification();
					}}>
					{messages.map((msg) => {
						const isBartender = msg.sender === "bartender";
						const isSystem = msg.sender === "system";
						const isSenderSpecial =
							(msg.sender === "me" && isMyAvatarSpecial) ||
							(msg.sender === "stranger" &&
								isStrangerAvatarSpecial);

						return (
							<div
								key={msg.id}
								className={`flex flex-col relative ${isSystem || isBartender ? "items-center w-full my-4" : msg.sender === "me" ? "items-end" : "items-start"}`}>
								{isSystem || isBartender ? (
									<div
										className={`p-3 text-[11px] tracking-[0.1em] uppercase text-center max-w-[90%] ${isBartender ? "msg-bartender" : "text-slate-500 italic opacity-70"}`}>
										{msg.text}
									</div>
								) : (
									<>
										<div
											onClick={(e) =>
												toggleReactionPicker(e, msg.id)
											}
											className={`msg-bubble p-3 pixel-border max-w-[85%] cursor-pointer relative ${msg.sender === "me" ? "bg-indigo-950 border-indigo-800 hover:border-indigo-400" : "bg-slate-800 border-slate-700 hover:border-indigo-500"} ${isSenderSpecial ? "shadow-[0_0_15px_rgba(234,179,8,0.2)] !border-yellow-600/50" : ""}`}>
											{msg.text && (
												<div
													className={`break-words font-medium ${isSenderSpecial ? "special-sparkle" : ""}`}>
													{msg.text}
												</div>
											)}
											{msg.image && (
												<img
													src={msg.image}
													className="max-w-full h-auto border-2 border-white/20 mb-1"
													alt="p2p upload"
												/>
											)}

											{msg.reactions &&
												Object.keys(msg.reactions)
													.length > 0 && (
													<div className="reaction-container flex gap-1 mt-2">
														{Object.entries(
															msg.reactions,
														).map(
															([
																emoji,
																count,
															]) => (
																<div
																	key={emoji}
																	className={`reaction-item bg-black/40 px-2 rounded text-xs flex gap-1 ${myReactions[msg.id]?.has(emoji) ? "border border-indigo-500" : ""}`}>
																	{emoji}{" "}
																	<span>
																		{
																			count as number
																		}
																	</span>
																</div>
															),
														)}
													</div>
												)}

											{activeReactionId === msg.id && (
												<div
													className={`absolute flex gap-2 bg-slate-900 pixel-border p-2 z-[400] shadow-[0_4px_15px_rgba(0,0,0,0.5)] 
                          ${reactionPickerSide === "above" ? "bottom-[calc(100%+8px)]" : "top-[calc(100%+8px)]"} 
                          ${msg.sender === "me" ? "right-0" : "left-0"}`}>
													{REACTION_EMOJIS.map(
														(e) => (
															<button
																key={e}
																onClick={(
																	e2,
																) => {
																	e2.stopPropagation();
																	handleAddReaction(
																		msg.id,
																		e,
																	);
																}}
																className="text-xl hover:scale-125 transition-transform active:scale-90">
																{e}
															</button>
														),
													)}
												</div>
											)}
										</div>
										<span
											className={`text-[10px] uppercase mt-1 ${isSenderSpecial ? "special-sparkle" : msg.sender === "me" ? "text-indigo-500" : "text-slate-600"}`}>
											{msg.sender === "me"
												? myAlias
												: msg.senderAlias ||
													strangerAlias}{" "}
											{isDoubleSpecial
												? "💞"
												: isSenderSpecial
													? "⭐"
													: ""}
										</span>
									</>
								)}
							</div>
						);
					})}
					{isStrangerTyping && (
						<div
							className={`text-sm animate-pulse uppercase ${isStrangerAvatarSpecial ? "special-sparkle" : "text-slate-600"}`}>
							... {strangerAlias} Đang nhập
						</div>
					)}
					<div ref={messagesEndRef} />
				</div>

				{/* SKETCH LAYER */}
				{showSketch && (
					<div className="absolute right-4 top-4 z-[250] animate-in slide-in-from-right duration-300">
						<SketchCanvas
							onDraw={(b) => p2p.sendSketch(b)}
							incomingSketch={incomingSketch}
						/>
						<button
							onClick={handleCloseSketch}
							className="w-full bg-rose-900 text-[10px] py-1 text-white border-2 border-rose-700 mt-1">
							ĐÓNG BẢNG VẼ
						</button>
					</div>
				)}

				{/* GAME LAYER */}
				<div className="absolute inset-0 z-[200] pointer-events-none">
					{game.status === "invited" && (
						<div className="absolute inset-0 bg-black/80 flex items-center justify-center p-8 backdrop-blur-sm pointer-events-auto">
							<div className="bg-slate-900 pixel-border p-6 text-center space-y-4 shadow-[0_0_50px_rgba(0,0,0,1)]">
								<div className="text-4xl">🃏</div>
								<h2 className="text-xl uppercase tracking-widest text-white">
									Tiến Lên (200💰)
								</h2>
								<p className="text-slate-400 text-sm">
									"{strangerAlias}" thách đấu bạn.
								</p>
								<div className="flex gap-4 justify-center">
									<PixelButton
										variant="secondary"
										onClick={handleGameDecline}>
										TỪ CHỐI
									</PixelButton>
									<PixelButton
										variant="primary"
										onClick={handleGameAccept}>
										CHẤP NHẬN
									</PixelButton>
								</div>
							</div>
						</div>
					)}
					{game.status === "pendingInvite" && (
						<div className="absolute inset-0 bg-black/80 flex items-center justify-center p-8 backdrop-blur-sm pointer-events-auto">
							<div className="bg-slate-900 pixel-border p-6 text-center space-y-4 shadow-[0_0_50px_rgba(0,0,0,1)]">
								<div className="text-4xl">🃏</div>
								<h2 className="text-xl uppercase tracking-widest text-white">
									ĐANG CHỜ ĐỐI THỦ
								</h2>
								<PixelButton
									variant="secondary"
									onClick={handleGameDecline}>
									HỦY
								</PixelButton>
							</div>
						</div>
					)}
					{(game.status === "playing" ||
						game.status === "ended" ||
						game.status === "quit") && (
						<div className="absolute inset-0 pointer-events-auto">
							<TienLenGame
								hand={game.hand}
								opponentCardCount={game.opponentCardCount}
								lastPlayedCards={game.lastPlayedCards}
								isMyTurn={game.isMyTurn}
								requiredOpeningCardId={
									game.requiredOpeningCardId
								}
								onExit={handleGameQuit}
								onPlay={onLocalPlay}
								onPass={handleGamePass}
								incomingEmoji={incomingGameEmoji}
								status={game.status}
								myCoins={game.myCoins}
							/>
						</div>
					)}
				</div>
			</div>

			{/* INPUT AREA */}
			<form
				onSubmit={handleSendMessage}
				className="p-4 bg-slate-950 border-t-4 border-slate-800 flex items-center gap-2 z-[300] relative">
				<div className="relative">
					<button
						type="button"
						onClick={() => {
							setShowAppMenu(!showAppMenu);
							sound.playClick();
							clearNotification();
						}}
						className={`w-12 h-12 flex items-center justify-center text-2xl bg-slate-900 pixel-border border-slate-800 hover:bg-slate-800 transition-all ${showAppMenu ? "bg-indigo-900 border-indigo-500" : ""}`}>
						🗃️
					</button>
					{showAppMenu && (
						<div className="absolute bottom-14 left-0 bg-slate-900 pixel-border border-indigo-900 p-2 flex flex-col gap-2 min-w-[120px] shadow-2xl animate-in slide-in-from-bottom-2">
							<button
								type="button"
								onClick={inviteToPlay}
								className="text-[11px] bg-slate-950 py-2 hover:bg-indigo-900 transition-colors uppercase border border-slate-800">
								🃏 TIẾN LÊN
							</button>
							<button
								type="button"
								onClick={() => {
									setShowSketch(true);
									setShowAppMenu(false);
									sound.playClick();
								}}
								className="text-[11px] bg-slate-950 py-2 hover:bg-indigo-900 transition-colors uppercase border border-slate-800">
								🎨 VẼ TRANH
							</button>
							<button
								type="button"
								onClick={() => {
									fileInputRef.current?.click();
									setShowAppMenu(false);
									sound.playClick();
								}}
								className="text-[11px] bg-slate-950 py-2 hover:bg-indigo-900 transition-colors uppercase border border-slate-800">
								🖼️ GỬI ẢNH
							</button>
						</div>
					)}
				</div>
				<input
					type="file"
					ref={fileInputRef}
					className="hidden"
					accept="image/*"
					onChange={handleImageUpload}
				/>
				<input
					type="text"
					value={inputValue}
					onFocus={clearNotification}
					onChange={(e) => {
						setInputValue(e.target.value);
						p2p.sendTyping(true);
						lastActivityRef.current = Date.now();
					}}
					placeholder="TÂM SỰ ĐÊM MUỘN..."
					className={`flex-1 bg-slate-900 border-4 border-slate-800 p-2 px-4 text-lg focus:outline-none focus:border-indigo-500 text-white ${isMyAvatarSpecial ? "special-sparkle" : ""}`}
				/>
				<PixelButton type="submit">GỬI</PixelButton>
			</form>
		</div>
	);
};

export default ChatRoom;
