import React, { useState, useEffect, useRef, useMemo } from "react";
import {
	Avatar,
	Message,
	AVATAR_ICONS,
	Mood,
	MOOD_DATA,
	REACTION_EMOJIS,
	GameState,
	Card,
	Memory,
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
import TicTacToeGame from "./TicTacToeGame";


interface ChatRoomProps {
	myAvatar: Avatar;
	strangerAvatar: Avatar;
	strangerInitialAlias: string;
	myAlias: string;
	myMood: Mood;
	onExit: () => void;
	onNext: () => void;
	vibeMode: string;
	toggleVibeCycle?: () => void;
	onOpenJukebox: () => void;
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
	toggleVibeCycle,
	onOpenJukebox,
}) => {
	const [messages, setMessages] = useState<Message[]>(() => [
		{
			id: `sys-welcome-${Date.now()}`,
			sender: "system",
			text: `--- ĐÊM KHUYA GẶP GỠ ---`,
			timestamp: Date.now(),
		},
		{
			id: `sys-tip-${Date.now()}`,
			sender: "system",
			text: `💡 MẸO: NHẤN NÚT [➕] GÓC TRÁI BÊN DƯỚI ĐỂ CHƠI XO, TIẾN LÊN, VẼ TRANH, GIEO XÚC XẮC, HOẶC BẬT JUKEBOX NGHE NHẠC ĐỒNG BỘ YOUTUBE CÙNG BẠN CHAT!`,
			timestamp: Date.now(),
		},
	]);
	const [inputValue, setInputValue] = useState("");
	const [isStrangerTyping, setIsStrangerTyping] = useState(false);
	const [strangerAlias, setStrangerAlias] = useState(
		strangerInitialAlias || "Người Lạ",
	);
	const [isSyncing, setIsSyncing] = useState(false);
	const [activeReactionId, setActiveReactionId] = useState<string | null>(
		null,
	);
	const [tttGame, setTttGame] = useState<{
		board: ("X" | "O" | null)[];
		symbol: "X" | "O";
		isMyTurn: boolean;
		status: "idle" | "pendingInvite" | "invited" | "playing" | "ended" | "quit";
		winner: "me" | "stranger" | "draw" | null;
	}>({
		board: Array(9).fill(null),
		symbol: "X",
		isMyTurn: false,
		status: "idle",
		winner: null,
	});
	const [incomingTttEmoji, setIncomingTttEmoji] = useState<string | null>(null);
	const [sendingMessageIds, setSendingMessageIds] = useState<Set<string>>(new Set());
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
	const tttGameRef = useRef(tttGame);
	useEffect(() => {
		tttGameRef.current = tttGame;
	}, [tttGame]);

	const checkTttWinner = (b: ("X" | "O" | null)[]) => {
		const lines = [
			[0, 1, 2], [3, 4, 5], [6, 7, 8],
			[0, 3, 6], [1, 4, 7], [2, 5, 8],
			[0, 4, 8], [2, 4, 6]
		];
		for (let i = 0; i < lines.length; i++) {
			const [x, y, z] = lines[i];
			if (b[x] && b[x] === b[y] && b[x] === b[z]) return b[x];
		}
		return null;
	};

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
			if (data.type === "ping") {
				return;
			}
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
			} else if (data.type === "game_ttt_invite") {
				sound.playMessage();
				if (tttGameRef.current.status !== "idle") {
					p2p.sendTttDecline();
					return;
				}
				setTttGame((prev) => ({ ...prev, status: "invited" }));
			} else if (data.type === "game_ttt_decline") {
				setMessages((prev) => [
					...prev,
					{
						id: `sys-ttt-dec-${Date.now()}`,
						sender: "system",
						text: `ĐỐI THỦ ĐÃ TỪ CHỐI CHƠI CARO.`,
						timestamp: Date.now(),
					},
				]);
				setTttGame((prev) => ({
					...prev,
					status: "idle",
					board: Array(9).fill(null),
					winner: null,
				}));
			} else if (data.type === "game_ttt_start") {
				setTttGame((prev) => ({
					...prev,
					status: "playing",
					symbol: data.firstTurn ? "O" : "X",
					isMyTurn: !!data.firstTurn,
					board: Array(9).fill(null),
					winner: null,
				}));
			} else if (data.type === "game_ttt_move") {
				sound.playMessage();
				setTttGame((prev) => {
					const newBoard = [...prev.board];
					newBoard[data.cellIndex] = data.symbol;
					const win = checkTttWinner(newBoard);
					const isWin = win === prev.symbol;
					const isDraw = !win && newBoard.every(c => c !== null);
					let winner: "me" | "stranger" | "draw" | null = null;
					let newStatus = prev.status;
					if (win) {
						winner = "stranger";
						newStatus = "ended";
						setGame(g => ({ ...g, myCoins: g.myCoins - 50 }));
					} else if (isDraw) {
						winner = "draw";
						newStatus = "ended";
					}
					return {
						...prev,
						board: newBoard,
						isMyTurn: true,
						status: newStatus,
						winner,
					};
				});
			} else if (data.type === "game_ttt_quit") {
				setTttGame((prev) => ({ ...prev, status: "quit" }));
			} else if (data.type === "game_ttt_emoji") {
				setIncomingTttEmoji(data.emoji);
				setTimeout(() => setIncomingTttEmoji(null), 2000);
			} else if (data.type === "dice_roll") {
				sound.playMessage();
				setMessages((prev) => [
					...prev,
					{
						id: `dice-${Date.now()}`,
						sender: "system",
						text: `🎲 ${strangerAlias.toUpperCase()} ĐÃ ĐỔ XÚC XẮC RA: ${data.diceValue}`,
						timestamp: Date.now(),
					},
				]);
			}
		};



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
			setTttGame({
				board: Array(9).fill(null),
				symbol: "X",
				isMyTurn: false,
				status: "idle",
				winner: null,
			});
			setShowSketch(false);
			setIncomingSketch(null);
		};

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

		// Ping heartbeat to check for dead connections
		const pingInterval = setInterval(() => {
			if (p2p.isConnected()) {
				p2p.sendPing();
			}
		}, 4000);

		// Timeout monitor - disconnects if no message/ping within 15 seconds
		const timeoutCheckInterval = setInterval(() => {
			if (p2p.isConnected() && Date.now() - lastActivityRef.current > 15000) {
				setMessages((prev) => [
					...prev,
					{
						id: `sys-timeout-${Date.now()}`,
						sender: "system",
						text: `--- MẤT KẾT NỐI VỚI ĐỐI THỦ (HẾT GIỜ CHỜ 15S) ---`,
						timestamp: Date.now(),
					},
				]);
				p2p.disconnect();
			}
		}, 5000);

		return () => {
			p2p.onMessage = () => {};
			p2p.onDisconnected = () => {};
			clearInterval(bartenderInterval);
			clearInterval(pingInterval);
			clearInterval(timeoutCheckInterval);
			window.removeEventListener(
				"visibilitychange",
				handleVisibilityChange,
			);
			window.removeEventListener("focus", handleFocus);
			clearNotification();
		};
	}, [strangerAlias]);

	useEffect(() => {
		setIsSyncing(vibeMode !== "off");
	}, [vibeMode]);

	const exportMidnightCard = () => {
		const canvas = document.createElement("canvas");
		canvas.width = 400;
		canvas.height = 300;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		// Background
		ctx.fillStyle = "#0c0a1c";
		ctx.fillRect(0, 0, 400, 300);

		// Border
		ctx.strokeStyle = "#4f46e5";
		ctx.lineWidth = 6;
		ctx.strokeRect(8, 8, 384, 284);
		
		ctx.strokeStyle = "#ffd700";
		ctx.lineWidth = 2;
		ctx.strokeRect(14, 14, 372, 272);

		// Title
		ctx.fillStyle = "#ffd700";
		ctx.font = "bold 24px VT323, monospace, Courier";
		ctx.textAlign = "center";
		ctx.fillText("✨ MIDNIGHT LOUNGE ✨", 200, 45);

		// Line
		ctx.strokeStyle = "rgba(79, 70, 229, 0.4)";
		ctx.beginPath();
		ctx.moveTo(30, 60);
		ctx.lineTo(370, 60);
		ctx.stroke();

		// Info
		ctx.fillStyle = "#ffffff";
		ctx.font = "20px VT323, monospace, Courier";
		ctx.textAlign = "left";
		ctx.fillText(`BIỆT DANH: ${myAlias.toUpperCase()}`, 40, 95);
		ctx.fillText(`HÌNH ĐẠI DIỆN: ${myAvatar.toUpperCase()}`, 40, 125);
		ctx.fillText(`TÂM TRẠNG: ${myMood.toUpperCase()}`, 40, 155);
		ctx.fillText(`TIN NHẮN TRUYỀN: ${messages.filter(m => m.sender === 'me').length} BẢN TIN`, 40, 185);

		// Line
		ctx.strokeStyle = "rgba(79, 70, 229, 0.4)";
		ctx.beginPath();
		ctx.moveTo(30, 205);
		ctx.lineTo(370, 205);
		ctx.stroke();

		// Quote
		ctx.fillStyle = "#818cf8";
		ctx.font = "italic 16px VT323, monospace, Courier";
		ctx.textAlign = "center";
		const quote = "Thế giới ngoài kia ồn ào quá, ở đây bình yên thôi.";
		ctx.fillText(`"${quote}"`, 200, 235);
		
		ctx.fillStyle = "#475569";
		ctx.font = "12px VT323, monospace, Courier";
		ctx.fillText("MIDNIGHT PIXEL CHAT © 2026", 200, 265);

		// Trigger download
		const dataUrl = canvas.toDataURL("image/png");
		const link = document.createElement("a");
		link.download = `midnight-card-${myAlias.toLowerCase().replace(/\s+/g, '-')}.png`;
		link.href = dataUrl;
		link.click();
		sound.playClick();
	};

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
		
		setSendingMessageIds((prev) => {
			const next = new Set(prev);
			next.add(msgId);
			return next;
		});

		setMessages((prev) => [
			...prev,
			{
				id: msgId,
				sender: "me",
				text: inputValue,
				timestamp: Date.now(),
			},
		]);

		const textToSend = inputValue;
		setInputValue("");
		p2p.sendTyping(false);

		setTimeout(() => {
			p2p.sendMessage(textToSend, msgId);
			setSendingMessageIds((prev) => {
				const next = new Set(prev);
				next.delete(msgId);
				return next;
			});
		}, 400);
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
				
				setSendingMessageIds((prev) => {
					const next = new Set(prev);
					next.add(msgId);
					return next;
				});

				setMessages((prev) => [
					...prev,
					{
						id: msgId,
						sender: "me",
						image: compressed,
						timestamp: Date.now(),
					},
				]);

				setTimeout(() => {
					p2p.sendImage(compressed, msgId);
					setSendingMessageIds((prev) => {
						const next = new Set(prev);
						next.delete(msgId);
						return next;
					});
				}, 600);
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

	const inviteToPlayTtt = () => {
		if (tttGame.status !== "idle") return;
		sound.playClick();
		setShowAppMenu(false);
		p2p.sendTttInvite();
		setTttGame((prev) => ({ ...prev, status: "pendingInvite" }));
		setMessages((prev) => [
			...prev,
			{
				id: `sys-ttt-inv-${Date.now()}`,
				sender: "system",
				text: `✦ ĐÃ GỬI LỜI MỜI CHƠI CARO XO ĐẾN ${strangerAlias.toUpperCase()}...`,
				timestamp: Date.now(),
			},
		]);
	};

	const handleRollDice = () => {
		sound.playClick();
		const val = Math.floor(Math.random() * 6) + 1;
		p2p.sendDiceRoll(val);
		setMessages((prev) => [
			...prev,
			{
				id: `dice-me-${Date.now()}`,
				sender: "system",
				text: `🎲 BẠN ĐÃ ĐỔ XÚC XẮC RA: ${val}`,
				timestamp: Date.now(),
			},
		]);
		setShowAppMenu(false);
	};

	const handleTttAccept = () => {
		if (tttGame.status !== "invited") return;
		const myFirst = Math.random() > 0.5;
		p2p.sendTttStart(!myFirst);
		setTttGame((prev) => ({
			...prev,
			board: Array(9).fill(null),
			symbol: myFirst ? "X" : "O",
			isMyTurn: myFirst,
			status: "playing",
			winner: null,
		}));
	};

	const handleTttDecline = () => {
		p2p.sendTttDecline();
		setTttGame((prev) => ({
			...prev,
			status: "idle",
			board: Array(9).fill(null),
			winner: null,
		}));
	};

	const onTttLocalMove = (cellIndex: number) => {
		if (tttGame.status !== "playing" || !tttGame.isMyTurn) return;
		p2p.sendTttMove(cellIndex, tttGame.symbol);
		setTttGame((prev) => {
			const newBoard = [...prev.board];
			newBoard[cellIndex] = prev.symbol;
			const win = checkTttWinner(newBoard);
			const isWin = win === prev.symbol;
			const isDraw = !win && newBoard.every(c => c !== null);
			let winner: "me" | "stranger" | "draw" | null = null;
			let newStatus = prev.status;
			if (isWin) {
				winner = "me";
				newStatus = "ended";
				setGame((g) => ({ ...g, myCoins: g.myCoins + 50 }));
			} else if (isDraw) {
				winner = "draw";
				newStatus = "ended";
			}
			return {
				...prev,
				board: newBoard,
				isMyTurn: false,
				status: newStatus,
				winner,
			};
		});
	};

	const handleTttQuit = () => {
		if (tttGame.status === "playing") {
			p2p.sendTttQuit();
		}
		setTttGame((prev) => ({
			...prev,
			status: "idle",
			board: Array(9).fill(null),
			winner: null,
		}));
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
			className={`w-full max-w-2xl h-[100dvh] md:h-[85dvh] flex flex-col bg-slate-900 pixel-border relative overflow-hidden ${isSyncing && (vibeMode === "lofi" || vibeMode === "jazz") ? "animate-pulse-slow" : ""}`}
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
					<div>
						<div className="flex items-center gap-2">
							<span className="font-bold text-white uppercase tracking-wider">
								{strangerAlias}
							</span>
							<span className={`text-[10px] px-2 py-0.5 pixel-border ${MOOD_DATA[myMood].color}`}>
								{MOOD_DATA[myMood].label}
							</span>
						</div>
						<p className="text-[10px] text-green-400 animate-pulse uppercase tracking-widest mt-1">
							• ĐANG KẾT NỐI
						</p>
					</div>
				</div>

				<div className="flex gap-2">
					{toggleVibeCycle && (
						<button
							onClick={toggleVibeCycle}
							className={`px-3 py-1 border-2 text-[10px] md:text-xs font-bold pixel-border transition-all ${vibeMode !== "off" ? "bg-indigo-900 border-indigo-700 text-white" : "bg-slate-800 border-slate-700 text-slate-400"}`}>
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
					)}
					<button
						onClick={exportMidnightCard}
						className="bg-indigo-900 border-2 border-indigo-700 hover:bg-indigo-800 text-[10px] md:text-xs px-2 py-1 uppercase text-white font-bold pixel-border"
						title="Lưu thẻ kỷ niệm đêm nay">
						📸 THẺ ĐÊM
					</button>
					<PixelButton
						variant="secondary"
						className="py-1 px-2 md:px-3 text-sm md:text-base"
						onClick={onNext}>
						TIẾP
					</PixelButton>
					<PixelButton
						variant="danger"
						className="py-1 px-2 md:px-3 text-sm md:text-base"
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
											{msg.sender === "me" && (
												<span className="text-[9px] lowercase font-normal ml-2 opacity-60">
													{sendingMessageIds.has(msg.id) ? "• đang gửi..." : "• đã gửi"}
												</span>
											)}
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
					<div className="absolute inset-x-0 bottom-0 md:inset-auto md:right-4 md:top-4 z-[350] bg-slate-900 p-4 border-t-4 border-indigo-900 md:pixel-border animate-in slide-in-from-bottom md:slide-in-from-right duration-300 flex flex-col items-center">
						<SketchCanvas
							onDraw={(b) => p2p.sendSketch(b)}
							incomingSketch={incomingSketch}
						/>
						<button
							onClick={handleCloseSketch}
							className="w-full bg-rose-900 text-xs py-2 text-white border-4 border-rose-700 mt-2 hover:bg-rose-800 font-bold uppercase">
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

					{/* TicTacToe game views */}
					{tttGame.status === "invited" && (
						<div className="absolute inset-0 bg-black/80 flex items-center justify-center p-8 backdrop-blur-sm pointer-events-auto">
							<div className="bg-slate-900 pixel-border p-6 text-center space-y-4 shadow-[0_0_50px_rgba(0,0,0,1)]">
								<div className="text-4xl">❌</div>
								<h2 className="text-xl uppercase tracking-widest text-white">
									CARO XO (50💰)
								</h2>
								<p className="text-slate-400 text-sm">
									"{strangerAlias}" thách đấu bạn chơi Caro.
								</p>
								<div className="flex gap-4 justify-center">
									<PixelButton
										variant="secondary"
										onClick={handleTttDecline}>
										TỪ CHỐI
									</PixelButton>
									<PixelButton
										variant="primary"
										onClick={handleTttAccept}>
										CHẤP NHẬN
									</PixelButton>
								</div>
							</div>
						</div>
					)}
					{tttGame.status === "pendingInvite" && (
						<div className="absolute inset-0 bg-black/80 flex items-center justify-center p-8 backdrop-blur-sm pointer-events-auto">
							<div className="bg-slate-900 pixel-border p-6 text-center space-y-4 shadow-[0_0_50px_rgba(0,0,0,1)]">
								<div className="text-4xl">❌</div>
								<h2 className="text-xl uppercase tracking-widest text-white">
									ĐANG CHỜ ĐỐI THỦ
								</h2>
								<PixelButton
									variant="secondary"
									onClick={handleTttDecline}>
									HỦY
								</PixelButton>
							</div>
						</div>
					)}
					{(tttGame.status === "playing" ||
						tttGame.status === "ended" ||
						tttGame.status === "quit") && (
						<div className="absolute inset-0 pointer-events-auto">
							<TicTacToeGame
								symbol={tttGame.symbol}
								isMyTurn={tttGame.isMyTurn}
								board={tttGame.board}
								status={tttGame.status}
								winner={tttGame.winner}
								myCoins={game.myCoins}
								incomingEmoji={incomingTttEmoji}
								onMove={onTttLocalMove}
								onExit={handleTttQuit}
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
						➕
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
								onClick={inviteToPlayTtt}
								className="text-[11px] bg-slate-950 py-2 hover:bg-indigo-900 transition-colors uppercase border border-slate-800">
								❌ CARO XO
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
							<button
								type="button"
								onClick={handleRollDice}
								className="text-[11px] bg-slate-950 py-2 hover:bg-indigo-900 transition-colors uppercase border border-slate-800">
								🎲 ĐỔ XÚC XẮC
							</button>
							<button
								type="button"
								onClick={() => {
									onOpenJukebox();
									setShowAppMenu(false);
									sound.playClick();
								}}
								className="text-[11px] bg-slate-950 py-2 hover:bg-indigo-900 transition-colors uppercase border border-slate-800">
								📻 JUKEBOX
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
