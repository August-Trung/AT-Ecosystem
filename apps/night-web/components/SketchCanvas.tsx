import React, { useRef, useEffect, useState } from "react";
import { sound } from "../services/soundService";

interface SketchCanvasProps {
	onDraw: (base64: string) => void;
	incomingSketch: string | null;
	isMyTurn?: boolean;
}

const SketchCanvas: React.FC<SketchCanvasProps> = ({
	onDraw,
	incomingSketch,
	isMyTurn,
}) => {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [isDrawing, setIsDrawing] = useState(false);
	const [color, setColor] = useState("#6366f1");

	useEffect(() => {
		if (incomingSketch && canvasRef.current) {
			const img = new Image();
			img.onload = () => {
				const ctx = canvasRef.current?.getContext("2d");
				ctx?.clearRect(0, 0, 200, 200);
				ctx?.drawImage(img, 0, 0);
			};
			img.src = incomingSketch;
		}
	}, [incomingSketch]);

	const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
		setIsDrawing(true);
		draw(e);
	};

	const stopDrawing = () => {
		setIsDrawing(false);
		if (canvasRef.current) {
			onDraw(canvasRef.current.toDataURL("image/png", 0.1));
		}
	};

	const draw = (e: any) => {
		if (!isDrawing || !canvasRef.current) return;
		const canvas = canvasRef.current;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const rect = canvas.getBoundingClientRect();
		const x = (e.clientX || e.touches[0].clientX) - rect.left;
		const y = (e.clientY || e.touches[0].clientY) - rect.top;

		ctx.fillStyle = color;
		// Pixel effect: draw square
		const pSize = 8;
		const px = Math.floor(x / pSize) * pSize;
		const py = Math.floor(y / pSize) * pSize;
		ctx.fillRect(px, py, pSize, pSize);
	};

	const clear = () => {
		const ctx = canvasRef.current?.getContext("2d");
		ctx?.clearRect(0, 0, 200, 200);
		sound.playClick();
	};

	return (
		<div className="flex flex-col items-center gap-2 p-2 bg-slate-900 pixel-border border-indigo-900">
			<div className="text-[10px] uppercase text-indigo-400 tracking-tighter">
				Ephemeral Sketch (Vẽ tay 30s)
			</div>
			<canvas
				ref={canvasRef}
				width={200}
				height={200}
				onMouseDown={startDrawing}
				onMouseMove={draw}
				onMouseUp={stopDrawing}
				onTouchStart={startDrawing}
				onTouchMove={draw}
				onTouchEnd={stopDrawing}
				className="bg-slate-950 border-2 border-slate-800 cursor-crosshair touch-none"
				style={{ imageRendering: "pixelated" }}
			/>
			<div className="flex gap-2 w-full">
				<button
					onClick={clear}
					className="flex-1 bg-slate-800 text-[10px] py-1 pixel-border border-slate-700">
					XÓA
				</button>
				<div className="flex gap-1">
					{["#6366f1", "#ef4444", "#10b981", "#ffffff"].map((c) => (
						<button
							key={c}
							onClick={() => setColor(c)}
							className={`w-4 h-4 pixel-border ${color === c ? "ring-2 ring-white" : ""}`}
							style={{ backgroundColor: c }}
						/>
					))}
				</div>
			</div>
		</div>
	);
};

export default SketchCanvas;
