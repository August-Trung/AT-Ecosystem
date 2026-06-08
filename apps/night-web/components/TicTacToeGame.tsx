import React, { useState, useEffect } from "react";
import { QUICK_GAME_EMOJIS } from "../types";
import { p2p } from "../services/p2pService";
import { sound } from "../services/soundService";
import PixelButton from "./PixelButton";

interface TicTacToeGameProps {
	symbol: "X" | "O";
	isMyTurn: boolean;
	board: ("X" | "O" | null)[];
	status: "invited" | "pendingInvite" | "playing" | "ended" | "quit";
	winner: "me" | "stranger" | "draw" | null;
	myCoins: number;
	incomingEmoji: string | null;
	onMove: (cellIndex: number) => void;
	onExit: () => void;
	onPass?: () => void;
	winningLine?: number[] | null;
}

const TicTacToeGame: React.FC<TicTacToeGameProps> = ({
	symbol,
	isMyTurn,
	board,
	status,
	winner,
	myCoins,
	incomingEmoji,
	onMove,
	onExit,
	winningLine,
}) => {
	const [localEmoji, setLocalEmoji] = useState<string | null>(null);
	const [showEmojiPicker, setShowEmojiPicker] = useState(false);

	const triggerEmoji = (emoji: string) => {
		sound.playClick();
		p2p.sendTttEmoji(emoji);
		setLocalEmoji(emoji);
		setShowEmojiPicker(false);
		setTimeout(() => setLocalEmoji(null), 2000);
	};

	const handleCellClick = (index: number) => {
		if (!isMyTurn || board[index] !== null || status !== "playing") return;
		sound.playClick();
		onMove(index);
	};

	if (status === "quit") {
		return (
			<div className="absolute inset-0 z-[150] bg-black/95 flex flex-col items-center justify-center p-8 animate-in zoom-in duration-300">
				<div className="text-8xl mb-4">💨</div>
				<h2 className="text-xl uppercase tracking-[0.2em] font-bold mb-2 text-slate-400 text-center">
					ĐỐI THỦ ĐÃ THOÁT KHỎI GAME
				</h2>
				<PixelButton onClick={onExit} variant="primary">
					QUAY LẠI CHAT
				</PixelButton>
			</div>
		);
	}

	if (status === "ended") {
		return (
			<div className="absolute inset-0 z-[150] bg-black/95 flex flex-col items-center justify-center p-8 animate-in zoom-in duration-300">
				<div className="text-8xl mb-4">
					{winner === "me" ? "🏆" : winner === "stranger" ? "😢" : "🤝"}
				</div>
				<h2
					className={`text-4xl uppercase tracking-[0.3em] font-bold mb-2 ${winner === "me" ? "text-yellow-400" : winner === "stranger" ? "text-rose-600" : "text-indigo-400"}`}>
					{winner === "me" ? "THẮNG CUỘC!" : winner === "stranger" ? "THẤT BẠI!" : "HÒA NHAU!"}
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
		<div className="absolute inset-0 z-[100] bg-[#050510] flex flex-col p-4 animate-in fade-in duration-500 overflow-hidden select-none">
			<style>{`
				@keyframes float-up-ttt { 0% { opacity: 0; transform: translateY(20px) scale(0.5); } 20% { opacity: 1; transform: translateY(0) scale(1.2); } 80% { opacity: 1; transform: translateY(-40px) scale(1); } 100% { opacity: 0; transform: translateY(-80px) scale(0.8); } }
				.emoji-float-ttt { animation: float-up-ttt 2s forwards ease-out; position: absolute; font-size: 3rem; pointer-events: none; z-index: 150; }
			`}</style>

			{localEmoji && (
				<div className="emoji-float-ttt bottom-32 left-1/2 -translate-x-1/2">
					{localEmoji}
				</div>
			)}
			{incomingEmoji && (
				<div className="emoji-float-ttt top-32 left-1/2 -translate-x-1/2">
					{incomingEmoji}
				</div>
			)}

			{/* Top Bar */}
			<div className="flex justify-between items-center mb-4 bg-slate-900/60 p-2 rounded-lg border border-indigo-900/40 shadow-lg">
				<span className="text-indigo-400 uppercase tracking-widest text-[11px] font-black">
					CARO 15x15 (50💰)
				</span>
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

			{/* Board area */}
			<div className="flex-1 flex flex-col items-center justify-center">
				<div 
					className="grid gap-[2px] w-full max-w-[340px] aspect-square bg-[#0a0a20]/80 p-2 pixel-border border-indigo-950/60 rounded-xl relative shadow-2xl overflow-hidden"
					style={{ gridTemplateColumns: "repeat(15, minmax(0, 1fr))" }}
				>
					{board.map((cell, index) => {
						const isWinningCell = winningLine && winningLine.includes(index);
						return (
							<button
								key={index}
								onClick={() => handleCellClick(index)}
								disabled={!isMyTurn || cell !== null}
								className={`aspect-square flex items-center justify-center text-[10px] font-black border border-slate-900/40 transition-all select-none
									${cell === null && isMyTurn ? "bg-slate-900/40 hover:bg-slate-850/60 cursor-pointer active:scale-95" : cell === null ? "bg-slate-950/10 cursor-not-allowed" : "bg-slate-900"}
									${isWinningCell ? "bg-yellow-500/40 border-yellow-400 animate-pulse text-yellow-300 ring-1 ring-yellow-400 text-[11px] font-black" : ""}
									${cell === "X" && !isWinningCell ? "text-indigo-400 font-black" : ""}
									${cell === "O" && !isWinningCell ? "text-rose-400 font-black" : ""}`}
							>
								{cell}
							</button>
						);
					})}
				</div>
			</div>

			{/* Bottom Action Bar */}
			<div className="w-full flex justify-between items-center bg-slate-950 p-3 pixel-border border-indigo-900/40 shadow-2xl rounded-xl mt-4">
				<div className="flex flex-col">
					<span
						className={`text-xs md:text-sm uppercase font-black tracking-[0.2em] ${isMyTurn ? "text-green-400 animate-pulse" : "text-slate-600"}`}
					>
						{isMyTurn ? `LƯỢT BẠN (${symbol})` : "ĐỢI ĐỐI THỦ..."}
					</span>
				</div>
				<div className="flex gap-2 items-center">
					<div className="relative">
						<button
							onClick={() => {
								sound.playClick();
								setShowEmojiPicker(!showEmojiPicker);
							}}
							className="w-10 h-10 flex items-center justify-center text-xl bg-slate-900/80 pixel-border border-indigo-900 hover:bg-slate-800 transition-all rounded-lg"
						>
							{showEmojiPicker ? "❌" : "💬"}
						</button>
						{showEmojiPicker && (
							<div className="absolute bottom-full mb-3 right-0 flex gap-2 bg-slate-900 pixel-border border-indigo-600 p-2 shadow-[0_0_20px_rgba(0,0,0,0.8)] z-[250] rounded-lg">
								{QUICK_GAME_EMOJIS.map((emoji) => (
									<button
										key={emoji}
										onClick={() => triggerEmoji(emoji)}
										className="text-xl hover:scale-125 transition-transform active:scale-90 p-1"
									>
										{emoji}
									</button>
								))}
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default TicTacToeGame;
