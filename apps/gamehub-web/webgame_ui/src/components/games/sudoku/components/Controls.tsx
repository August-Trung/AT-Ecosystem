import React, { useState } from "react";
import ResetConfirmationDialog from "./ResetConfirmationDialog";

interface ControlsProps {
	difficulty: string;
	setDifficulty: (difficulty: string) => void;
	onNewGame: () => void;
	onSolve: () => void;
	onClear: () => void;
	onCheck: () => void;
	onHint: () => void;
	isSolving: boolean;
	isGameCompleted: boolean;
	hintsRemaining: number;
	gameProgress: number;
	hasUserInput: boolean;
}

const Controls: React.FC<ControlsProps> = ({
	difficulty,
	setDifficulty,
	onNewGame,
	onSolve,
	onClear,
	onCheck,
	onHint,
	isSolving,
	isGameCompleted,
	hintsRemaining,
	gameProgress,
	hasUserInput,
}) => {
	const [showResetConfirmation, setShowResetConfirmation] = useState(false);

	const handleResetClick = () => {
		if (hasUserInput) {
			setShowResetConfirmation(true);
		} else {
			onClear();
		}
	};

	const handleConfirmReset = () => {
		setShowResetConfirmation(false);
		onClear();
	};

	return (
		<div className="w-full space-y-6">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-end">
				<div className="flex-1">
					<label
						htmlFor="sudoku-difficulty"
						className="text-xs font-semibold uppercase tracking-wide text-slate-500">
						Độ khó
					</label>
					<select
						id="sudoku-difficulty"
						title="Difficulty"
						className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-inner focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
						value={difficulty}
						onChange={(e) => setDifficulty(e.target.value)}>
						<option value="easy">Easy</option>
						<option value="medium">Medium</option>
						<option value="hard">Hard</option>
						<option value="expert">Expert</option>
					</select>
				</div>
				<button
					className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600 sm:w-auto"
					onClick={onNewGame}>
					Ván mới
				</button>
			</div>

			<div>
				<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
					Bàn phím nhanh
				</p>
				<div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-9">
					{[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
						<button
							key={num}
							className="rounded-xl border border-slate-200 bg-slate-50 py-2 text-lg font-semibold text-slate-800 transition hover:bg-indigo-50"
							onClick={() =>
								document.dispatchEvent(
									new KeyboardEvent("keydown", {
										key: num.toString(),
									})
								)
							}>
							{num}
						</button>
					))}
				</div>
			</div>

			<div className="grid gap-3 sm:grid-cols-2">
				<button
					className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
					onClick={() =>
						document.dispatchEvent(
							new KeyboardEvent("keydown", { key: "Backspace" })
						)
					}>
					Xóa ô đang chọn
				</button>
				<button
					className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
					onClick={() =>
						document.dispatchEvent(
							new KeyboardEvent("keydown", { key: "n" })
						)
					}>
					Chế độ ghi chú
				</button>
			</div>

			<div className="grid gap-3 sm:grid-cols-2">
				<button
					className={`rounded-xl px-3 py-3 text-sm font-semibold text-white transition ${
						hintsRemaining > 0
							? "bg-sky-500 hover:bg-sky-600"
							: "cursor-not-allowed bg-slate-300"
					}`}
					onClick={onHint}
					disabled={isGameCompleted || hintsRemaining <= 0}>
					Gợi ý ({hintsRemaining})
				</button>
				<button
					className="rounded-xl bg-amber-500 px-3 py-3 text-sm font-semibold text-white transition hover:bg-amber-600"
					onClick={onCheck}>
					Kiểm tra
				</button>
			</div>

			<div className="grid gap-3 sm:grid-cols-2">
				<button
					className={`rounded-xl px-3 py-3 text-sm font-semibold text-white transition ${
						hasUserInput
							? "bg-rose-500 hover:bg-rose-600"
							: "bg-slate-300"
					}`}
					onClick={handleResetClick}
					disabled={!hasUserInput && isGameCompleted}>
					{hasUserInput ? "Đặt lại bàn chơi" : "Xóa toàn bộ"}
				</button>
				<button
					className="rounded-xl bg-violet-500 px-3 py-3 text-sm font-semibold text-white transition hover:bg-violet-600 disabled:bg-violet-300"
					onClick={onSolve}
					disabled={isSolving}>
					{isSolving ? "Đang giải..." : "Giải ngay"}
				</button>
			</div>

			<ResetConfirmationDialog
				isOpen={showResetConfirmation}
				onConfirm={handleConfirmReset}
				onCancel={() => setShowResetConfirmation(false)}
				progress={gameProgress}
			/>
		</div>
	);
};

export default Controls;
