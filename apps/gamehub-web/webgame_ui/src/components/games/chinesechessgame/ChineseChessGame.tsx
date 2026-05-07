import React, { useMemo, useState } from "react";
import ChineseChessBoard from "./components/ChineseChessBoard";
import {
	useChineseChessGame,
	GameMode,
	AILevel,
	PieceType,
} from "./hooks/useChineseChessGame";
import {
	showSuccessToast,
	showWarningToast,
} from "@/components/ToastComponents";

const PIECE_LABELS: Record<PieceType, string> = {
	general: "Tướng",
	advisor: "Sĩ",
	elephant: "Tượng",
	horse: "Mã",
	chariot: "Xe",
	cannon: "Pháo",
	soldier: "Tốt",
};

const coordLabel = ([row, col]: [number, number]) =>
	`R${10 - row}-C${col + 1}`;

const ChineseChessGame: React.FC = () => {
	const [gameMode, setGameMode] = useState<GameMode>("pvp");
	const [aiLevel, setAILevel] = useState<AILevel>("medium");

	const {
		pieces,
		currentPlayer,
		selectedPiece,
		gameOver,
		winner,
		inCheck,
		moveHistory,
		isAIThinking,
		lastAIMove,
		selectPiece,
		movePiece,
		getValidMoves,
		resetGame,
		changeGameMode,
		changeAILevel,
	} = useChineseChessGame(gameMode, aiLevel);

	const validMoves = useMemo(() => {
		if (!selectedPiece) return [];
		return getValidMoves(selectedPiece);
	}, [selectedPiece, getValidMoves]);

	const recentMoves = useMemo(
		() => [...moveHistory].slice(-6).reverse(),
		[moveHistory]
	);

	const lastMoveWasCheck =
		moveHistory.length > 0 && moveHistory[moveHistory.length - 1].wasCheck;

	const stats = [
		{ label: "Tổng nước đi", value: moveHistory.length },
		{
			label: "Trạng thái",
			value: gameOver ? "Đã kết thúc" : inCheck ? "Đang bị chiếu" : "Đang chơi",
		},
		{
			label: "Lượt hiện tại",
			value:
				currentPlayer === "red"
					? "Đỏ"
					: gameMode === "pve"
						? "Đen (Máy)"
						: "Đen",
		},
		{
			label: "Chế độ",
			value: gameMode === "pvp" ? "Người - Người" : "Người - Máy",
		},
		{
			label: "Độ khó",
			value:
				aiLevel === "easy"
					? "Dễ"
					: aiLevel === "medium"
						? "Trung bình"
						: "Khó",
		},
	];

	const handleGameModeChange = (mode: GameMode) => {
		setGameMode(mode);
		changeGameMode(mode);
		resetGame();

		if (mode === "pve") {
			showWarningToast(
				"Chế độ Người - Máy đang trong quá trình phát triển. Một số tính năng có thể chưa hoạt động hoàn toàn."
			);
		} else {
			showSuccessToast("Đổi chế độ chơi sang Người - Người");
		}
	};

	const handleAILevelChange = (level: AILevel) => {
		setAILevel(level);
		changeAILevel(level);
		const label =
			level === "easy" ? "Dễ" : level === "medium" ? "Trung bình" : "Khó";
		showSuccessToast(`Đổi độ khó sang ${label}`);
	};

	return (
		<section className="w-full -mx-4 bg-gradient-to-b from-slate-50 via-white to-slate-100 px-4 py-6 sm:mx-0 sm:px-6">
			<div className="mx-auto flex w-full max-w-6xl flex-col gap-6 text-slate-900">
				<div className="rounded-3xl border border-slate-200 bg-white/95 px-4 py-5 text-left shadow-sm sm:px-8 sm:text-center">
					<p className="text-xs font-semibold uppercase tracking-[0.35em] text-rose-500">
						Classic Tactics
					</p>
					<h1 className="mt-2 text-3xl font-bold sm:text-4xl">
						Cờ Tướng
					</h1>
					<p className="mt-3 text-sm text-slate-500 sm:text-base">
						Tận dụng toàn bộ màn hình của bạn với bàn cờ rõ ràng,
						nút điều khiển tiện tay và lịch sử nước đi gọn gàng cho
						cả mobile lẫn desktop.
					</p>
				</div>

				<div className="grid gap-6 lg:grid-cols-[minmax(0,2.3fr)_minmax(0,1fr)]">
					<div className="space-y-6">
						<div className="rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-sm sm:p-6">
							<div className="flex flex-wrap items-center justify-between gap-4">
								<div>
									<p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
										Lượt hiện tại
									</p>
									<div className="mt-1 text-2xl font-semibold">
										<span
											className={
												currentPlayer === "red"
													? "text-rose-600"
													: "text-slate-800"
											}>
											{currentPlayer === "red"
												? "Đỏ"
												: gameMode === "pve"
													? "Đen (Máy)"
													: "Đen"}
										</span>
									</div>
								</div>

								<div className="flex flex-wrap items-center gap-2">
									{inCheck && !gameOver && (
										<span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-600">
											Đang bị chiếu
										</span>
									)}
									{isAIThinking && (
										<span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-600">
											AI đang suy nghĩ...
										</span>
									)}
									{gameOver && (
										<span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-600">
											Ván đã kết thúc
										</span>
									)}
								</div>
							</div>

							{gameOver && (
								<div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
									Game kết thúc!{" "}
									{winner && (
										<strong>
											{winner === "red" ? "Đỏ" : "Đen"}
											{gameMode === "pve" &&
												winner === "black" &&
												" (Máy)"}
										</strong>
									)}{" "}
									{lastMoveWasCheck
										? "chiến thắng bằng chiếu hết."
										: "giành chiến thắng."}
								</div>
							)}

								<div className="mt-6">
									<ChineseChessBoard
										pieces={pieces}
										selectedPiece={selectedPiece}
										validMoves={validMoves}
									onSelectPiece={selectPiece}
									onMovePiece={movePiece}
									currentPlayer={currentPlayer}
									isAIThinking={isAIThinking}
									gameMode={gameMode}
									lastAIMove={lastAIMove ?? undefined}
								/>
							</div>
						</div>

						<div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
							<div className="flex flex-wrap items-baseline justify-between gap-2">
								<p className="text-base font-semibold text-slate-800">
									Lịch sử nước đi
								</p>
								<span className="text-xs uppercase tracking-wide text-slate-400">
									Cập nhật realtime
								</span>
							</div>
							{recentMoves.length === 0 ? (
								<p className="mt-4 text-sm text-slate-500">
									Chưa có nước đi nào. Chọn một quân để bắt
									đầu chiến thuật của bạn.
								</p>
							) : (
								<ul className="mt-4 divide-y divide-slate-100 text-sm">
									{recentMoves.map((move, index) => (
										<li
											key={`${move.piece.id}-${index}`}
											className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
											<div>
												<p className="font-semibold text-slate-800">
													#{" "}
													{moveHistory.length -
														index}
													{" • "}
													{PIECE_LABELS[
														move.piece.type
													]}
													{" - "}
													{move.piece.player ===
													"red"
														? "Đỏ"
														: "Đen"}
												</p>
												<p className="text-xs text-slate-500">
													{coordLabel(move.from)} →{" "}
													{coordLabel(move.to)}
													{move.capturedPiece
														? ` • bắt ${PIECE_LABELS[move.capturedPiece.type]}`
														: ""}
												</p>
											</div>
											{move.wasCheck && (
												<span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-600">
													Chiếu
												</span>
											)}
										</li>
									))}
								</ul>
							)}
						</div>
					</div>

					<aside className="space-y-6">
						<div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
							<p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
								Chế độ chơi
							</p>
							<div className="mt-4 flex flex-wrap gap-3">
								{["pvp", "pve"].map((mode) => (
									<button
										key={mode}
										onClick={() =>
											handleGameModeChange(
												mode as GameMode
											)
										}
										className={`flex-1 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
											gameMode === mode
												? "border-rose-500 bg-rose-50 text-rose-600"
												: "border-slate-200 text-slate-600 hover:bg-slate-50"
										}`}>
										{mode === "pvp"
											? "Người - Người"
											: "Người - Máy"}
									</button>
								))}
							</div>
							{gameMode === "pve" && (
								<div className="mt-4 space-y-2">
									<p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
										Độ khó AI
									</p>
									<div className="flex flex-wrap gap-2">
										{(["easy", "medium", "hard"] as AILevel[]).map(
											(level) => (
												<button
													key={level}
													onClick={() =>
														handleAILevelChange(
															level
														)
													}
													className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition ${
														aiLevel === level
															? "bg-indigo-600 text-white"
															: "bg-slate-100 text-slate-600 hover:bg-slate-200"
													}`}>
													{level === "easy"
														? "Dễ"
														: level === "medium"
															? "Trung bình"
															: "Khó"}
												</button>
											)
										)}
									</div>
								</div>
							)}
						</div>

						<div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
							<p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
								Hành động nhanh
							</p>
							<button
								onClick={() => {
									resetGame();
									showSuccessToast("Đã bắt đầu game mới!");
								}}
								disabled={isAIThinking}
								className={`mt-4 w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white transition ${
									isAIThinking
										? "cursor-not-allowed bg-slate-400"
										: "bg-rose-500 hover:bg-rose-600"
								}`}>
								Bắt đầu ván mới
							</button>
							<p className="mt-2 text-xs text-slate-500">
								Nút sẽ bị khoá khi AI đang suy nghĩ để tránh
								lỗi trạng thái.
							</p>
						</div>

						<div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
							<p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
								Thông tin ván
							</p>
							<div className="mt-4 space-y-4 text-sm">
								{stats.map((stat) => (
									<div
										key={stat.label}
										className="flex items-center justify-between border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
										<span className="text-slate-500">
											{stat.label}
										</span>
										<span className="font-semibold text-slate-900">
											{stat.value}
										</span>
									</div>
								))}
							</div>
						</div>
					</aside>
				</div>
			</div>
		</section>
	);
};

export default ChineseChessGame;
