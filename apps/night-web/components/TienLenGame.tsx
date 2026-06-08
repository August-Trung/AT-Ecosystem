import React, { useState, useMemo, useRef, useEffect } from "react";
import { Card, QUICK_GAME_EMOJIS } from "../types";
import { p2p } from "../services/p2pService";
import { sound } from "../services/soundService";
import {
	isStrongMove,
	isValidMove,
} from "../services/tienLenRules";
import PixelButton from "./PixelButton";

const SUITS = ["♠", "♣", "♦", "♥"];
const RANKS = [
	"3",
	"4",
	"5",
	"6",
	"7",
	"8",
	"9",
	"10",
	"J",
	"Q",
	"K",
	"A",
	"2",
];

interface TienLenGameProps {
	hand: Card[];
	opponentCardCount: number;
	lastPlayedCards: Card[];
	isMyTurn: boolean;
	requiredOpeningCardId: number | null;
	onExit: () => void;
	onPlay: (cards: Card[]) => void;
	onPass: () => void;
	incomingEmoji: string | null;
	status: "playing" | "ended" | "idle" | "invited" | "quit";
	myCoins: number;
}

const TienLenGame: React.FC<TienLenGameProps> = ({
	hand,
	opponentCardCount,
	lastPlayedCards,
	isMyTurn,
	requiredOpeningCardId,
	onExit,
	onPlay,
	onPass,
	incomingEmoji,
	status,
	myCoins,
}) => {
	const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
	const [localEmoji, setLocalEmoji] = useState<string | null>(null);
	const [showEmojiPicker, setShowEmojiPicker] = useState(false);
	const [sortMode, setSortMode] = useState<"rank" | "suit">("rank");
	const [isFlashing, setIsFlashing] = useState(false);
	const pickerRef = useRef<HTMLDivElement>(null);

	const sortedHand = useMemo(() => {
		return [...hand].sort((a, b) => {
			if (sortMode === "rank") return a.id - b.id;
			if (a.suit !== b.suit) return a.suit - b.suit;
			return a.rank - b.rank;
		});
	}, [hand, sortMode]);

	useEffect(() => {
		if (lastPlayedCards.length > 0 && isStrongMove(lastPlayedCards)) {
			setIsFlashing(true);
			setTimeout(() => setIsFlashing(false), 500);
		}
	}, [lastPlayedCards]);

	const canPlay = useMemo(() => {
		const selectedCards = sortedHand.filter((c) => selectedIds.has(c.id));
		return (
			isMyTurn &&
			isValidMove(selectedCards, lastPlayedCards, requiredOpeningCardId)
		);
	}, [
		selectedIds,
		isMyTurn,
		lastPlayedCards,
		requiredOpeningCardId,
		sortedHand,
	]);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				pickerRef.current &&
				!pickerRef.current.contains(event.target as Node)
			) {
				setShowEmojiPicker(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () =>
			document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const triggerEmoji = (emoji: string) => {
		sound.playClick();
		p2p.sendGameEmoji(emoji);
		setLocalEmoji(emoji);
		setShowEmojiPicker(false);
		setTimeout(() => setLocalEmoji(null), 2000);
	};

	const toggleSelect = (id: number) => {
		sound.playClick();
		const next = new Set(selectedIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		setSelectedIds(next);
	};

	const handlePlay = () => {
		if (!canPlay) return;
		const cardsToPlay = sortedHand.filter((c) => selectedIds.has(c.id));
		onPlay(cardsToPlay);
		setSelectedIds(new Set());
		sound.playMessage();
	};

	const handlePass = () => {
		if (!isMyTurn || lastPlayedCards.length === 0) return;
		onPass();
		setSelectedIds(new Set());
		sound.playClick();
	};

	const renderCard = (
		card: Card,
		isSelected?: boolean,
		onClick?: () => void,
	) => {
		const isRed = card.suit >= 2;
		const rankLabel = RANKS[card.rank];
		const suitIcon = SUITS[card.suit];

		// Theme cho J, Q, K
		const getRoyalDetails = () => {
			if (rankLabel === "J")
				return {
					icon: "🗡️",
					borderColor: "border-blue-400",
					labelColor: "text-blue-600",
				};
			if (rankLabel === "Q")
				return {
					icon: "🥀",
					borderColor: "border-fuchsia-400",
					labelColor: "text-fuchsia-600",
				};
			if (rankLabel === "K")
				return {
					icon: "🐲",
					borderColor: "border-amber-500",
					labelColor: "text-amber-700",
				};
			return null;
		};

		const royal = getRoyalDetails();
		const colorClass = isRed ? "text-red-600" : "text-black";

		return (
			<div
				key={card.id}
				onClick={onClick}
				className={`w-[70px] h-[105px] md:w-[85px] md:h-[125px] flex-shrink-0 pixel-border bg-slate-50 flex flex-col justify-between p-1.5 cursor-pointer transition-all transform select-none relative
          ${isSelected ? "border-indigo-600 -translate-y-6 md:-translate-y-8 ring-4 ring-indigo-500/30 z-20 shadow-2xl scale-105" : "hover:-translate-y-2 z-10"}
          ${royal ? royal.borderColor : isSelected ? "border-indigo-600" : "border-slate-300"}
        `}>
				{/* Góc trên bên trái: Rank + Suit nhỏ */}
				<div
					className={`flex flex-col items-center leading-none absolute top-1 left-1`}>
					<span
						className={`text-xl md:text-2xl font-black ${royal ? royal.labelColor : colorClass}`}>
						{rankLabel}
					</span>
					<span
						className={`text-sm md:text-base font-bold ${colorClass}`}>
						{suitIcon}
					</span>
				</div>

				{/* Nội dung chính ở giữa */}
				<div className="flex-1 flex items-center justify-center mt-4">
					{royal ? (
						<div className="relative flex items-center justify-center w-full h-full">
							{/* Suit ở giữa mờ hơn một chút nhưng vẫn rõ */}
							<div
								className={`text-4xl md:text-5xl opacity-40 ${colorClass}`}>
								{suitIcon}
							</div>
							{/* Icon hoàng gia nhỏ gọn đặt đè lên */}
							<div className="absolute text-2xl md:text-3xl filter drop-shadow-md">
								{royal.icon}
							</div>
						</div>
					) : (
						<div className={`text-4xl md:text-5xl ${colorClass}`}>
							{suitIcon}
						</div>
					)}
				</div>

				{/* Góc dưới bên phải: Rank + Suit nhỏ (Lật ngược) */}
				<div
					className={`flex flex-col items-center leading-none absolute bottom-1 right-1 rotate-180`}>
					<span
						className={`text-xl md:text-2xl font-black ${royal ? royal.labelColor : colorClass}`}>
						{rankLabel}
					</span>
					<span
						className={`text-sm md:text-base font-bold ${colorClass}`}>
						{suitIcon}
					</span>
				</div>
			</div>
		);
	};

	if (status === "quit") {
		return (
			<div className="absolute inset-0 z-[150] bg-black/95 flex flex-col items-center justify-center p-8 animate-in zoom-in duration-300">
				<div className="text-8xl mb-4">💨</div>
				<h2 className="text-2xl uppercase tracking-[0.2em] font-bold mb-2 text-slate-400 text-center">
					ĐỐI THỦ ĐÃ THOÁT KHỎI BÀN
				</h2>
				<PixelButton onClick={onExit} variant="primary">
					QUAY LẠI CHAT
				</PixelButton>
			</div>
		);
	}

	if (status === "ended") {
		const iWon = hand.length === 0;
		return (
			<div className="absolute inset-0 z-[150] bg-black/95 flex flex-col items-center justify-center p-8 animate-in zoom-in duration-300">
				<div className="text-8xl mb-4">{iWon ? "🏆" : "😢"}</div>
				<h2
					className={`text-4xl uppercase tracking-[0.3em] font-bold mb-2 ${iWon ? "text-yellow-400" : "text-rose-600"}`}>
					{iWon ? "THẮNG CUỘC!" : "THẤT BẠI!"}
				</h2>
				<div className="mb-4 text-indigo-400 uppercase tracking-widest text-lg">
					VÀNG CỦA BẠN:{" "}
					<span className="text-white font-bold">{myCoins} 💰</span>
				</div>
				<PixelButton onClick={onExit} variant="primary">
					QUAY LẠI CHAT
				</PixelButton>
			</div>
		);
	}

	return (
		<div
			className={`absolute inset-0 z-[100] bg-[#050510] flex flex-col p-2 md:p-3 animate-in fade-in duration-500 overflow-hidden ${isFlashing ? "animate-pulse bg-indigo-900/40 transition-colors" : ""}`}>
			<style>{`
        @keyframes float-up { 0% { opacity: 0; transform: translateY(20px) scale(0.5); } 20% { opacity: 1; transform: translateY(0) scale(1.2); } 80% { opacity: 1; transform: translateY(-40px) scale(1); } 100% { opacity: 0; transform: translateY(-80px) scale(0.8); } }
        .emoji-float { animation: float-up 2s forwards ease-out; position: absolute; font-size: 3rem; pointer-events: none; z-index: 150; }
        .card-container-scroll { display: flex; gap: 0.5rem sm:gap-0.75rem; padding: 2.25rem 1rem 1rem 1rem; sm:padding: 3rem 1.5rem 1.5rem 1.5rem; overflow-x: auto; width: 100%; scrollbar-width: thin; scrollbar-color: #4f46e5 #020617; -webkit-overflow-scrolling: touch; }
        .card-container-scroll::-webkit-scrollbar { height: 6px; display: block; }
        .card-container-scroll::-webkit-scrollbar-track { background: #020617; border-radius: 10px; margin: 0 10px; }
        .card-container-scroll::-webkit-scrollbar-thumb { background: #4f46e5; border-radius: 10px; border: 1px solid #020617; }
        .card-container-scroll::-webkit-scrollbar-thumb:hover { background: #6366f1; }
      `}</style>

			{localEmoji && (
				<div className="emoji-float bottom-48 left-1/2 -translate-x-1/2">
					{localEmoji}
				</div>
			)}
			{incomingEmoji && (
				<div className="emoji-float top-48 left-1/2 -translate-x-1/2">
					{incomingEmoji}
				</div>
			)}

			<div className="flex justify-between items-center mb-1.5 bg-slate-900/60 p-2 rounded-lg border border-indigo-900/40 shadow-lg">
				<div className="flex items-center gap-2">
					<span className="text-indigo-400 uppercase tracking-widest text-[9px] font-bold">
						ĐỐI THỦ:
					</span>
					<div className="flex items-center">
						{[...Array(Math.min(10, opponentCardCount))].map(
							(_, i) => (
								<div
									key={i}
									className="w-4 h-7 bg-indigo-950 border border-indigo-400 rounded-sm -ml-2.5 first:ml-0 shadow-md"
								/>
							),
						)}
					</div>
					<span className="text-white font-black ml-1 text-[10px] px-1.5 py-0.5 bg-indigo-900 rounded">
						{opponentCardCount} LÁ
					</span>
				</div>
				<div className="flex gap-2 items-center">
					<div className="text-yellow-500 font-bold text-[11px] uppercase tracking-widest bg-black/40 px-3 py-1.5 pixel-border border-yellow-700">
						💰 {myCoins}
					</div>
					<PixelButton
						variant="secondary"
						className="py-1 px-3 text-[10px] h-fit"
						onClick={onExit}>
						THOÁT
					</PixelButton>
				</div>
			</div>

			<div className="flex-1 flex flex-col items-center justify-center border-4 border-dashed border-indigo-600/10 rounded-2xl relative bg-[#0a0a20]/80 shadow-inner mb-3 overflow-hidden">
				{lastPlayedCards.length > 0 ? (
					<div className="flex gap-4 flex-wrap justify-center p-4 transform scale-95 md:scale-100">
						{lastPlayedCards.map((c) => renderCard(c))}
					</div>
				) : (
					<div className="flex flex-col items-center gap-2 opacity-20">
						<div className="text-5xl">🃏</div>
						<div className="text-slate-500 italic uppercase tracking-[0.4em] text-sm animate-pulse font-bold">
							BÀN TRỐNG
						</div>
					</div>
				)}
			</div>

			<div className="mt-auto flex flex-col items-center w-full bg-slate-900/20 rounded-t-3xl border-t-2 border-indigo-900/40">
				<div className="w-full px-6 flex justify-between items-center bg-indigo-950/60 py-1.5 border-b border-indigo-900/20">
					<button
						onClick={() => {
							setSortMode(sortMode === "rank" ? "suit" : "rank");
							sound.playClick();
						}}
						className="text-[11px] text-indigo-300 uppercase font-black hover:text-white transition-colors tracking-widest">
						XẾP BÀI: {sortMode === "rank" ? "ĐIỂM" : "CHẤT"} ⇅
					</button>
					<span className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-bold">
						BÀI CỦA BẠN
					</span>
				</div>
				<div className="card-container-scroll">
					{sortedHand.map((card) =>
						renderCard(card, selectedIds.has(card.id), () =>
							toggleSelect(card.id),
						),
					)}
				</div>

				<div className="w-full flex flex-col sm:flex-row justify-between items-center bg-slate-950 p-2 sm:p-3 pixel-border border-indigo-900/40 shadow-2xl relative gap-2">
					<div className="flex flex-col text-center sm:text-left">
						<span
							className={`text-xs sm:text-lg uppercase font-black tracking-[0.2em] ${isMyTurn ? "text-green-400 animate-pulse" : "text-slate-700"}`}>
							{isMyTurn ? "LƯỢT CỦA BẠN" : "ĐỢI ĐỐI THỦ..."}
						</span>
					</div>
					<div className="flex gap-2 sm:gap-3 items-center justify-center w-full sm:w-auto">
						<div className="relative" ref={pickerRef}>
							<button
								onClick={() => {
									sound.playClick();
									setShowEmojiPicker(!showEmojiPicker);
								}}
								className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center text-lg sm:text-2xl bg-slate-900/80 pixel-border border-indigo-900 hover:bg-slate-800 transition-all rounded-lg shadow-xl">
								{showEmojiPicker ? "❌" : "💬"}
							</button>
							{showEmojiPicker && (
								<div className="absolute bottom-full mb-3 right-0 sm:left-1/2 sm:-translate-x-1/2 flex gap-2 bg-slate-900 pixel-border border-indigo-600 p-2 shadow-[0_0_30px_rgba(0,0,0,0.9)] animate-in slide-in-from-bottom-2 duration-200 z-[250] rounded-lg">
									{QUICK_GAME_EMOJIS.map((emoji) => (
										<button
											key={emoji}
											onClick={() => triggerEmoji(emoji)}
											className="text-lg hover:scale-125 transition-transform active:scale-90 p-1">
											{emoji}
										</button>
									))}
								</div>
							)}
						</div>
						<PixelButton
							variant="secondary"
							className="py-1 px-3 sm:py-2 sm:px-5 text-xs sm:text-sm"
							disabled={!isMyTurn || lastPlayedCards.length === 0}
							onClick={handlePass}>
							BỎ LƯỢT
						</PixelButton>
						<PixelButton
							variant="primary"
							className="py-1 px-5 sm:py-2 sm:px-10 text-xs sm:text-sm font-black shadow-[0_0_15px_rgba(79,70,229,0.4)]"
							disabled={!canPlay}
							onClick={handlePlay}>
							ĐÁNH BÀI
						</PixelButton>
					</div>
				</div>
			</div>
		</div>
	);
};

export default TienLenGame;
