import React from "react";

interface HangmanDisplayProps {
	wrongGuesses: string[];
}

const HangmanDisplay: React.FC<HangmanDisplayProps> = ({ wrongGuesses }) => {
	const maxWrongGuesses = 6;
	const wrongGuessCount = wrongGuesses.length;

	const strokeColor = "#e2e8f0"; // mềm hơn để nổi trên nền tối
	const woodGradientId = "woodGradient";

	// SVG parts to draw progressively as wrong guesses increase
	const parts = [
		<circle
			key="head"
			cx="205"
			cy="80"
			r="20"
			stroke={strokeColor}
			strokeWidth="4"
			fill="none"
		/>,
		<line
			key="body"
			x1="205"
			y1="100"
			x2="205"
			y2="150"
			stroke={strokeColor}
			strokeWidth="4"
		/>,
		<line
			key="leftArm"
			x1="205"
			y1="120"
			x2="175"
			y2="140"
			stroke={strokeColor}
			strokeWidth="4"
		/>,
		<line
			key="rightArm"
			x1="205"
			y1="120"
			x2="235"
			y2="140"
			stroke={strokeColor}
			strokeWidth="4"
		/>,
		<line
			key="leftLeg"
			x1="205"
			y1="150"
			x2="185"
			y2="190"
			stroke={strokeColor}
			strokeWidth="4"
		/>,
		<line
			key="rightLeg"
			x1="205"
			y1="150"
			x2="225"
			y2="190"
			stroke={strokeColor}
			strokeWidth="4"
		/>,
	];

	// Only show parts corresponding to wrong guesses
	const visibleParts = parts.slice(0, wrongGuessCount);

	return (
		<div className="flex w-full flex-col items-center gap-4 text-slate-100">
			<div className="relative w-full">
				<div className="mx-auto w-full max-w-sm sm:max-w-md">
					<svg
						viewBox="0 0 320 240"
						preserveAspectRatio="xMidYMid meet"
						className="h-auto w-full drop-shadow-[0_15px_35px_rgba(15,23,42,0.5)]">
						<defs>
							<linearGradient
								id={woodGradientId}
								x1="0%"
								y1="0%"
								x2="0%"
								y2="100%">
								<stop offset="0%" stopColor="#fbbf24" />
								<stop offset="60%" stopColor="#b45309" />
								<stop offset="100%" stopColor="#92400e" />
							</linearGradient>
							<linearGradient
								id="baseShadow"
								x1="0%"
								y1="0%"
								x2="100%"
								y2="0%">
								<stop offset="0%" stopColor="#0f172a" />
								<stop offset="100%" stopColor="#1e293b" />
							</linearGradient>
						</defs>

						{/* Sàn gỗ */}
						<rect
							x="30"
							y="205"
							width="120"
							height="15"
							rx="8"
							fill="url(#baseShadow)"
						/>

						{/* Cột gỗ và thanh ngang */}
						<rect
							x="55"
							y="30"
							width="20"
							height="180"
							rx="10"
							fill={`url(#${woodGradientId})`}
						/>
						<rect
							x="55"
							y="30"
							width="150"
							height="18"
							rx="9"
							fill={`url(#${woodGradientId})`}
						/>
						{/* Thanh chéo chống đỡ */}
						<line
							x1="65"
							y1="90"
							x2="120"
							y2="30"
							stroke={`url(#${woodGradientId})`}
							strokeWidth="12"
							strokeLinecap="round"
						/>

						{/* Sợi dây treo */}
						<line
							x1="205"
							y1="48"
							x2="205"
							y2="80"
							stroke="#fde68a"
							strokeWidth="4"
							strokeLinecap="round"
						/>

						{/* Hangman parts - rendered based on wrong guesses */}
						{visibleParts}
					</svg>
				</div>
			</div>

			{wrongGuesses.length > 0 && (
				<div className="w-full rounded-2xl bg-black/30 p-3 text-center text-xs text-slate-300 sm:text-sm">
					<span className="font-semibold text-white">
						Chữ đã thử:
					</span>{" "}
					{wrongGuesses.join(", ")}
				</div>
			)}

			<div className="text-xs uppercase tracking-[0.3em] text-slate-400">
				{wrongGuessCount}/{maxWrongGuesses} lần sai
			</div>
		</div>
	);
};

export default HangmanDisplay;
