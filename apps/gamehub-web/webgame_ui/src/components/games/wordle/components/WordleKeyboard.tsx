// src/components/games/wordle/components/WordleKeyboard.tsx
interface WordleKeyboardProps {
	keyboardStatus: Record<
		string,
		"correct" | "present" | "absent" | undefined
	>;
	onKeyPress: (key: string) => void;
}

export default function WordleKeyboard({
	keyboardStatus,
	onKeyPress,
}: WordleKeyboardProps) {
	const keyboard: string[][] = [
		["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
		["A", "S", "D", "F", "G", "H", "J", "K", "L"],
		["Enter", "Z", "X", "C", "V", "B", "N", "M", "Backspace"],
	];

	const getKeyColor = (key: string): string => {
		if (key === "Enter" || key === "Backspace")
			return "bg-indigo-100 text-indigo-700 border border-indigo-200";
		const status = keyboardStatus[key];
		if (status === "correct")
			return "bg-emerald-500 text-white border border-emerald-500";
		if (status === "present")
			return "bg-amber-400 text-white border border-amber-400";
		if (status === "absent")
			return "bg-slate-500 text-white border border-slate-500";
		return "bg-slate-100 text-slate-700 border border-slate-200";
	};

	return (
		<div className="keyboard flex flex-col gap-2 sm:gap-3">
			{keyboard.map((row, rowIndex) => (
				<div
					key={`kbrow-${rowIndex}`}
					className="flex flex-wrap justify-center gap-2">
					{row.map((key) => (
						<button
							key={`key-${key}`}
							className={`min-w-[44px] rounded-xl px-2 py-3 text-sm font-semibold uppercase transition hover:-translate-y-0.5 active:scale-95 sm:min-w-[52px] sm:text-base ${getKeyColor(key)}`}
							onClick={(e) => {
								e.stopPropagation();
								if (key === "Backspace") {
									onKeyPress("Backspace");
								} else {
									onKeyPress(key);
								}
							}}>
							{key === "Backspace" ? "⌫" : key}
						</button>
					))}
				</div>
			))}
		</div>
	);
}
