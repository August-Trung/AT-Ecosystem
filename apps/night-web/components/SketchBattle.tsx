import React, { useRef, useEffect, useState } from "react";
import { sound } from "../services/soundService";
import PixelButton from "./PixelButton";

interface SketchBattleProps {
	prompt: string;
	incomingSketch: string | null;
	onDraw: (base64: string) => void;
	onExit: () => void;
	opponentVote: "like" | "love" | null;
	onVote: (vote: "like" | "love") => void;
	myCoins: number;
}

const SketchBattle: React.FC<SketchBattleProps> = ({
	prompt,
	incomingSketch,
	onDraw,
	onExit,
	opponentVote,
	onVote,
	myCoins,
}) => {
	const myCanvasRef = useRef<HTMLCanvasElement>(null);
	const oppCanvasRef = useRef<HTMLCanvasElement>(null);

	const [isDrawing, setIsDrawing] = useState(false);
	const [brushColor, setBrushColor] = useState("#6366f1"); // Indigo
	const [timeLeft, setTimeLeft] = useState(45);
	const [phase, setPhase] = useState<"drawing" | "voting" | "result">("drawing");
	const [myVote, setMyVote] = useState<"like" | "love" | null>(null);

	// Opponent canvas rendering from incoming P2P sketch base64
	useEffect(() => {
		if (incomingSketch && oppCanvasRef.current) {
			const img = new Image();
			img.onload = () => {
				const ctx = oppCanvasRef.current?.getContext("2d");
				if (ctx) {
					ctx.clearRect(0, 0, 200, 200);
					ctx.drawImage(img, 0, 0, 200, 200);
				}
			};
			img.src = incomingSketch;
		}
	}, [incomingSketch]);

	// Countdown Timer
	useEffect(() => {
		if (phase !== "drawing") return;
		if (timeLeft <= 0) {
			sound.playWin(); // play some alert sound
			setPhase("voting");
			return;
		}
		const timer = setTimeout(() => {
			setTimeLeft(timeLeft - 1);
		}, 1000);
		return () => clearTimeout(timer);
	}, [timeLeft, phase]);

	// Listen for both votes to advance to results phase
	useEffect(() => {
		if (phase === "voting" && myVote && opponentVote) {
			setPhase("result");
		}
	}, [myVote, opponentVote, phase]);

	const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
		if (phase !== "drawing") return;
		setIsDrawing(true);
		draw(e);
	};

	const stopDrawing = () => {
		if (phase !== "drawing") return;
		setIsDrawing(false);
		if (myCanvasRef.current) {
			onDraw(myCanvasRef.current.toDataURL("image/png", 0.1));
		}
	};

	const draw = (e: any) => {
		if (!isDrawing || !myCanvasRef.current || phase !== "drawing") return;
		const canvas = myCanvasRef.current;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const rect = canvas.getBoundingClientRect();
		const clientX = e.clientX || (e.touches && e.touches[0].clientX);
		const clientY = e.clientY || (e.touches && e.touches[0].clientY);

		const x = clientX - rect.left;
		const y = clientY - rect.top;

		ctx.fillStyle = brushColor;
		// Retro Pixel brush effect
		const pSize = 6;
		const px = Math.floor(x / pSize) * pSize;
		const py = Math.floor(y / pSize) * pSize;
		ctx.fillRect(px, py, pSize, pSize);
	};

	const clearCanvas = () => {
		if (phase !== "drawing") return;
		sound.playClick();
		const ctx = myCanvasRef.current?.getContext("2d");
		ctx?.clearRect(0, 0, 200, 200);
		if (myCanvasRef.current) {
			onDraw(myCanvasRef.current.toDataURL("image/png", 0.1));
		}
	};

	const handleCastVote = (vote: "like" | "love") => {
		sound.playClick();
		setMyVote(vote);
		onVote(vote);
		if (opponentVote) {
			setPhase("result");
		}
	};

	return (
		<div className="absolute inset-0 z-[200] bg-[#050512] flex flex-col p-4 animate-in fade-in duration-300 select-none overflow-y-auto">
			{/* Header */}
			<div className="flex justify-between items-center mb-3 bg-slate-900/60 p-2 rounded-lg border border-indigo-900/40">
				<span className="text-indigo-400 uppercase tracking-widest text-[11px] font-black">
					🎨 SKETCH BATTLE
				</span>
				<div className="flex gap-2 items-center">
					<div className="text-yellow-500 font-bold text-[11px] uppercase tracking-widest bg-black/40 px-3 py-1.5 pixel-border border-yellow-700">
						💰 {myCoins}
					</div>
					<PixelButton
						variant="secondary"
						className="py-1 px-3 text-[10px] h-fit"
						onClick={onExit}
					>
						THOÁT
					</PixelButton>
				</div>
			</div>

			{/* Center Prompt & Timer */}
			<div className="text-center mb-3 bg-slate-950 p-2 border-2 border-indigo-950/80 rounded-lg">
				<div className="text-[10px] text-slate-500 uppercase tracking-widest">ĐỀ TÀI THI ĐẤU</div>
				<div className="text-sm font-bold text-indigo-300 mt-1 uppercase tracking-wide">{prompt}</div>
				
				{phase === "drawing" && (
					<div className={`text-xl font-bold mt-2 font-mono ${timeLeft <= 10 ? "text-rose-500 animate-pulse" : "text-emerald-400"}`}>
						⏱️ HẾT GIỜ SAU: {timeLeft}s
					</div>
				)}
				{phase === "voting" && (
					<div className="text-xs font-bold mt-1 text-yellow-400 uppercase tracking-widest animate-pulse">
						⌛ ĐANG BÌNH CHỌN CHO NHAU...
					</div>
				)}
				{phase === "result" && (
					<div className="text-xs font-bold mt-1 text-green-400 uppercase tracking-widest">
						🏆 KẾT QUẢ ĐÃ SẴN SÀNG!
					</div>
				)}
			</div>

			{/* Battleground Canvases */}
			<div className="flex-1 flex flex-col md:flex-row gap-4 items-center justify-center py-2">
				{/* My Canvas */}
				<div className="flex flex-col items-center gap-1">
					<span className="text-[10px] text-indigo-400 uppercase tracking-widest font-bold">
						BẠN ĐANG VẼ
					</span>
					<div className="relative border-4 border-slate-800 bg-slate-950/80 p-0.5 rounded-lg shadow-2xl">
						<canvas
							ref={myCanvasRef}
							width={200}
							height={200}
							onMouseDown={startDrawing}
							onMouseMove={draw}
							onMouseUp={stopDrawing}
							onTouchStart={startDrawing}
							onTouchMove={draw}
							onTouchEnd={stopDrawing}
							className={`bg-slate-950 cursor-crosshair touch-none ${phase !== "drawing" ? "pointer-events-none opacity-90" : ""}`}
							style={{ imageRendering: "pixelated", width: "200px", height: "200px" }}
						/>
						{phase !== "drawing" && (
							<div className="absolute inset-0 bg-black/40 flex items-center justify-center font-bold text-rose-500 uppercase text-xs tracking-wider">
								🔒 LOCKED
							</div>
						)}
					</div>
					{phase === "drawing" && (
						<div className="flex gap-2 w-full mt-1.5 items-center justify-between">
							<button
								onClick={clearCanvas}
								className="bg-slate-900 hover:bg-slate-800 border-2 border-slate-750 text-[10px] text-slate-300 font-bold px-2 py-1 pixel-border"
							>
								XÓA
							</button>
							<div className="flex gap-1.5">
								{["#6366f1", "#ef4444", "#10b981", "#fbbf24", "#ffffff"].map((c) => (
									<button
										key={c}
										onClick={() => setBrushColor(c)}
										className={`w-4 h-4 pixel-border border-slate-750 ${brushColor === c ? "ring-2 ring-white scale-110" : ""}`}
										style={{ backgroundColor: c }}
									/>
								))}
							</div>
						</div>
					)}
				</div>

				{/* Vs Divider */}
				<div className="text-slate-700 font-bold text-xs uppercase tracking-widest py-1 md:py-0">VS</div>

				{/* Opponent Canvas */}
				<div className="flex flex-col items-center gap-1">
					<span className="text-[10px] text-rose-400 uppercase tracking-widest font-bold">
						ĐỐI THỦ VẼ
					</span>
					<div className="relative border-4 border-slate-800 bg-slate-950/80 p-0.5 rounded-lg shadow-2xl">
						<canvas
							ref={oppCanvasRef}
							width={200}
							height={200}
							className="bg-slate-950 pointer-events-none"
							style={{ imageRendering: "pixelated", width: "200px", height: "200px" }}
						/>
						{!incomingSketch && (
							<div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center text-slate-600 text-[10px] font-mono uppercase tracking-wider text-center p-2">
								<span className="text-xl mb-1 animate-pulse">✏️</span>
								<span>Đang đợi đối thủ vẽ...</span>
							</div>
						)}
					</div>
					<div className="h-8"></div> {/* Spacer to match height of Brush control row */}
				</div>
			</div>

			{/* Phase-specific overlay/actions at bottom */}
			<div className="mt-4 bg-slate-950 p-3 pixel-border border-indigo-900/40 rounded-xl">
				{phase === "drawing" && (
					<div className="text-center text-[10px] text-slate-500 uppercase tracking-widest animate-pulse">
						Hãy vẽ bức tranh của bạn nhanh nhất có thể!
					</div>
				)}

				{phase === "voting" && (
					<div className="flex flex-col items-center gap-2">
						<span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
							BẠN ĐÁNH GIÁ TRANH ĐỐI THỦ THẾ NÀO?
						</span>
						{myVote ? (
							<span className="text-xs text-green-400 uppercase tracking-widest font-bold animate-pulse">
								ĐÃ GỬI BÌNH CHỌN: {myVote === "love" ? "💖 ĐẸP QUÁ!" : "👍 OKAY!"} (ĐỢI ĐỐI THỦ VOTE...)
							</span>
						) : (
							<div className="flex gap-4 w-full">
								<button
									onClick={() => handleCastVote("like")}
									className="flex-1 bg-indigo-950 border-2 border-indigo-800 text-indigo-300 font-bold py-2 text-xs pixel-border uppercase"
								>
									👍 OKAY (+50💰)
								</button>
								<button
									onClick={() => handleCastVote("love")}
									className="flex-1 bg-yellow-950 border-2 border-yellow-800 text-yellow-300 font-bold py-2 text-xs pixel-border uppercase"
								>
									💖 ĐẸP QUÁ! (+100💰)
								</button>
							</div>
						)}
					</div>
				)}

				{phase === "result" && (
					<div className="flex flex-col items-center gap-3 text-center">
						<h3 className="text-sm font-bold text-yellow-400 uppercase tracking-widest">
							🎉 THI ĐẤU HOÀN THÀNH! 🎉
						</h3>
						<div className="text-xs text-indigo-200 font-sans space-y-1">
							<p>Bạn đánh giá tranh đối thủ: <span className="font-bold text-white">{myVote === "love" ? "💖 Đẹp Quá!" : "👍 Okay"}</span></p>
							<p>Đối thủ đánh giá tranh bạn: <span className="font-bold text-white">{opponentVote === "love" ? "💖 Đẹp Quá! (+100 xu)" : "👍 Okay (+50 xu)"}</span></p>
						</div>
						<div className="text-indigo-400 uppercase tracking-widest font-bold text-sm bg-indigo-950/40 px-4 py-2 pixel-border border-indigo-900 mt-1">
							BẠN NHẬN ĐƯỢC: {opponentVote === "love" ? "+100 xu 💰" : "+50 xu 💰"}
						</div>
						<PixelButton
							variant="primary"
							onClick={onExit}
							className="mt-2 w-full max-w-[200px]"
						>
							QUAY LẠI CHAT
						</PixelButton>
					</div>
				)}
			</div>
		</div>
	);
};

export default SketchBattle;
