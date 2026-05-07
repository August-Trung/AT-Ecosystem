import React from "react";

interface LetterKeyboardProps {
	guessedLetters: string[];
	onGuess: (letter: string) => void;
}

const LetterKeyboard: React.FC<LetterKeyboardProps> = ({
	guessedLetters,
	onGuess,
}) => {
	const keyboardRows = [
		["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
		["A", "S", "D", "F", "G", "H", "J", "K", "L"],
		["Z", "X", "C", "V", "B", "N", "M"],
	];

	return (
		<div className="flex flex-col items-center gap-3">
			{keyboardRows.map((row, rowIndex) => (
				<div
					key={`row-${rowIndex}`}
					className={`flex flex-wrap justify-center gap-2 ${
						rowIndex === 1
							? "sm:px-6"
							: rowIndex === 2
							? "sm:px-12"
							: ""
					}`}>
					{row.map((letter) => {
						const isGuessed = guessedLetters.includes(letter);

						return (
							<button
								key={letter}
								className={`min-w-[2.2rem] rounded-xl border px-0 py-3 text-sm font-semibold uppercase tracking-[0.2em] transition sm:min-w-[2.6rem] sm:text-base ${
									isGuessed
										? "cursor-not-allowed border-white/10 bg-white/5 text-slate-500"
										: "border-white/20 bg-gradient-to-br from-sky-500/90 to-indigo-500 text-white hover:from-sky-400 hover:to-indigo-400"
								}`}
								onClick={() => !isGuessed && onGuess(letter)}
								disabled={isGuessed}
								aria-label={`Letter ${letter}`}>
								{letter}
							</button>
						);
					})}
				</div>
			))}
		</div>
	);
};

export default LetterKeyboard;
