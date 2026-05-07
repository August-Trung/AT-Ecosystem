import React from "react";

interface WordDisplayProps {
	word: string;
	guessedLetters: string[];
}

const WordDisplay: React.FC<WordDisplayProps> = ({ word, guessedLetters }) => {
	return (
		<div className="flex flex-wrap justify-center gap-2 text-white sm:gap-3">
			{word.split("").map((letter, index) => (
				<div
					key={`${letter}-${index}`}
					className="flex min-w-[2.25rem] items-center justify-center rounded-xl border border-white/20 bg-white/5 px-3 py-4 text-center sm:min-w-[2.75rem]"
					aria-label="hidden letter slot">
					<span className="text-xl font-semibold tracking-[0.3em] sm:text-2xl">
						{guessedLetters.includes(letter) ? letter : ""}
					</span>
				</div>
			))}
		</div>
	);
};

export default WordDisplay;
