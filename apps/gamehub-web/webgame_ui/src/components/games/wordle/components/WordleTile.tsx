// src/components/games/wordle/components/WordleTile.tsx
interface WordleTileProps {
	letter: string;
	row: number;
	col: number;
	currentRow: number;
	targetWord: string;
	shakingRow: boolean;
	lastAddedLetter: { row: number; col: number };
}

export default function WordleTile({
	letter,
	row,
	col,
	currentRow,
	targetWord,
	shakingRow,
	lastAddedLetter,
}: WordleTileProps) {
	const getLetterColor = (): string => {
		if (row > currentRow || (row === currentRow && !letter)) {
			return "bg-slate-100 text-slate-400 border border-slate-200";
		}
		if (row < currentRow) {
			if (letter === targetWord[col]) {
				return "bg-emerald-500 text-white border border-emerald-500";
			} else if (targetWord.includes(letter)) {
				return "bg-amber-400 text-white border border-amber-400";
			} else {
				return "bg-slate-500 text-white border border-slate-500";
			}
		}
		return "bg-white border-2 border-slate-200 text-slate-900";
	};

	const getLetterAnimation = (): string => {
		if (shakingRow && row === currentRow) {
			return "wobble";
		}
		if (lastAddedLetter.row === row && lastAddedLetter.col === col) {
			return "pop-in";
		}
		return "";
	};

	return (
		<div
			className={`mx-1 flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-bold transition-colors duration-500 sm:h-14 sm:w-14 sm:text-2xl ${getLetterColor()} ${getLetterAnimation()}`}
			style={{
				transitionDelay: row < currentRow ? `${col * 150}ms` : "0ms",
			}}>
			{letter}
		</div>
	);
}
