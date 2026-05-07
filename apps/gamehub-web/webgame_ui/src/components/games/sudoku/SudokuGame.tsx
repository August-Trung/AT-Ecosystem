import Board from "./components/Board";
import Controls from "./components/Controls";
import { useSudokuGame } from "./hooks/useSudokuGame";

export default function Game() {
	const {
		board,
		selectedCell,
		setSelectedCell,
		difficulty,
		setDifficulty,
		isGameCompleted,
		isSolving,
		handleCellValueChange,
		handleNewGame,
		handleSolve,
		handleClear,
		handleCheckSolution,
		handleHint,
		mistakes,
		hintsRemaining,
		feedback,
		hasUserInput,
		gameProgress,
	} = useSudokuGame();

	return (
		<section className="min-h-screen w-full bg-gradient-to-b from-slate-50 via-slate-100 to-white px-4 py-10">
			<div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
				<header className="text-center">
					<p className="text-xs font-semibold uppercase tracking-[0.3em] text-indigo-500">
						Puzzle Mode
					</p>
					<h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
						Sudoku
					</h1>
					<p className="mt-3 text-sm text-slate-500 sm:text-base">
						Luyện tập tư duy logic của bạn trên mọi thiết bị với bố
						cục mới linh hoạt.
					</p>
				</header>

				<div className="flex flex-col gap-8 lg:flex-row">
					<div className="flex-1 space-y-6">
						<div className="rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur md:p-6">
							<div className="mx-auto w-full max-w-[min(90vw,520px)] lg:max-w-none">
								<Board
									board={board}
									selectedCell={selectedCell}
									setSelectedCell={setSelectedCell}
									handleCellValueChange={
										handleCellValueChange
									}
								/>
							</div>

							{feedback && (
								<div
									className={`mt-6 rounded-2xl border px-4 py-3 text-sm sm:text-base ${
										feedback.type === "success"
											? "border-emerald-200 bg-emerald-50 text-emerald-700"
											: feedback.type === "error"
												? "border-rose-200 bg-rose-50 text-rose-700"
												: "border-sky-200 bg-sky-50 text-sky-700"
									}`}>
									{feedback.message}
								</div>
							)}

							{isGameCompleted && (
								<div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-emerald-700">
									Xuất sắc! Bạn đã hoàn thành bàn Sudoku này.
								</div>
							)}
						</div>

						<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
							{[
								{
									label: "Lỗi",
									value: mistakes,
									accent: "text-rose-500",
									helper: "Theo dõi độ chính xác",
								},
								{
									label: "Gợi ý",
									value: hintsRemaining,
									accent: "text-sky-500",
									helper: "Tận dụng khi cần",
								},
								{
									label: "Tiến độ",
									value: `${gameProgress}%`,
									accent: "text-emerald-500",
									helper: "Dựa trên số ô đã điền",
								},
								{
									label: "Trạng thái",
									value: isGameCompleted
										? "Hoàn tất"
										: hasUserInput
											? "Đang chơi"
											: "Chưa bắt đầu",
									accent: "text-indigo-500",
									helper: isGameCompleted
										? "Thử độ khó cao hơn?"
										: "Giữ nhịp độ ổn định",
								},
							].map((stat) => (
								<div
									key={stat.label}
									className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
									<p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
										{stat.label}
									</p>
									<p
										className={`mt-1 text-2xl font-bold ${stat.accent}`}>
										{stat.value}
									</p>
									<p className="text-xs text-slate-500">
										{stat.helper}
									</p>
								</div>
							))}
						</div>
					</div>

					<div className="w-full lg:max-w-sm">
						<div className="rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur md:p-6">
							<Controls
								difficulty={difficulty}
								setDifficulty={setDifficulty}
								onNewGame={handleNewGame}
								onSolve={handleSolve}
								onClear={handleClear}
								onCheck={handleCheckSolution}
								onHint={handleHint}
								isSolving={isSolving}
								isGameCompleted={isGameCompleted}
								hintsRemaining={hintsRemaining}
								gameProgress={gameProgress}
								hasUserInput={hasUserInput}
							/>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
