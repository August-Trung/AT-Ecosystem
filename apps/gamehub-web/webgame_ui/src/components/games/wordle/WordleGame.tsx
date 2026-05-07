// src/components/games/wordle/WordleGame.tsx
import { useEffect, useMemo } from "react";
import { useWordleGame } from "./hooks/useWordleGame";
import WordleBoard from "./components/WordleBoard";
import WordleKeyboard from "./components/WordleKeyboard";

export default function WordleGame(): JSX.Element {
	const { gameState, setGameState, handleKeyPress, resetGame } =
		useWordleGame();

	// Handle physical keyboard input
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			const isFromVirtualKeyboard =
				document.activeElement?.id === "virtual-keyboard-input";

			if (gameState.processingInput || isFromVirtualKeyboard) return;

			setGameState((prev) => ({ ...prev, processingInput: true }));

			handleKeyPress(event.key);

			setTimeout(() => {
				setGameState((prev) => ({ ...prev, processingInput: false }));
			}, 50);
		};

		window.addEventListener("keydown", handleKeyDown as any);
		return () => {
			window.removeEventListener("keydown", handleKeyDown as any);
		};
	}, [gameState, handleKeyPress, setGameState]);

	// Support touch devices by focusing hidden input
	useEffect(() => {
		const focusInput = (e: TouchEvent) => {
			if ((e.target as Element).closest(".keyboard")) {
				return;
			}

			const inputElement = document.getElementById(
				"virtual-keyboard-input"
			);
			if (inputElement) {
				inputElement.focus();
			}
		};

		document.addEventListener("touchstart", focusInput);

		return () => {
			document.removeEventListener("touchstart", focusInput);
		};
	}, []);

	const attemptUsed = useMemo(() => {
		const filledCurrentRow =
			gameState.guesses[gameState.currentRow]?.some((letter) => letter);
		return gameState.currentRow + (filledCurrentRow ? 1 : 0);
	}, [gameState.guesses, gameState.currentRow]);

	const attemptLeft = Math.max(0, 6 - attemptUsed);
	const progress = Math.min((attemptUsed / 6) * 100, 100);

	return (
		<div className="w-full px-2 py-4 sm:px-0">
			<div className="mx-auto flex w-full max-w-5xl flex-col gap-6 text-slate-900">
				<div className="rounded-2xl border border-slate-200 bg-white/95 px-4 py-5 text-center shadow-sm sm:px-6">
					<p className="text-xs font-semibold uppercase tracking-[0.35em] text-indigo-500">
						Guessing Arena
					</p>
					<h1 className="mt-2 text-3xl font-bold sm:text-4xl">
						Wordle
					</h1>
					<p className="mt-3 text-sm text-slate-500 sm:text-base">
						Săn tìm từ khóa bí ẩn với trải nghiệm tối ưu cho cả
						mobile lẫn laptop.
					</p>
				</div>

				<input
					title="Virtual Keyboard Input"
					id="virtual-keyboard-input"
					type="text"
					className="absolute h-0 w-0 opacity-0"
					autoCapitalize="none"
					autoComplete="off"
					autoCorrect="off"
					autoFocus
					onBlur={(e) => e.target.focus()}
					onChange={(e) => {
						const value = e.target.value;
						if (value.length > 0) {
							const lastChar = value[value.length - 1];
							handleKeyPress(lastChar);
							e.target.value = "";
						}
					}}
					onKeyDown={(e) => {
						if (e.key === "Backspace" || e.key === "Enter") {
							e.preventDefault();
							handleKeyPress(e.key);
						}
					}}
				/>

				<div className="grid gap-6 lg:grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)]">
					<div className="space-y-6">
						{gameState.message && (
							<div
								className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-sm sm:text-base ${
									gameState.gameOver
										? "border-emerald-200 bg-emerald-50 text-emerald-700"
										: "border-sky-200 bg-sky-50 text-sky-700"
								}`}>
								<span>{gameState.message}</span>
								{gameState.gameOver && (
									<button
										className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
										onClick={resetGame}>
										Chơi lại
									</button>
								)}
							</div>
						)}

						<div className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur sm:p-6">
							<WordleBoard gameState={gameState} />
						</div>

						<div className="rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur">
							<WordleKeyboard
								keyboardStatus={gameState.keyboardStatus}
								onKeyPress={handleKeyPress}
							/>
						</div>

						<div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 p-4 text-sm text-slate-600 sm:text-base">
							<p className="font-semibold text-slate-800">
								Mẹo nhanh
							</p>
							<ul className="mt-3 space-y-2 text-slate-500">
								<li>
									• Thử bắt đầu bằng từ chứa nhiều nguyên âm
									(``A, E, O``) để sớm thu hẹp phạm vi.
								</li>
								<li>
									• Gạch bỏ những chữ cái đã thử bằng bàn phím
									dưới cùng để tránh lặp lại.
								</li>
								<li>
									• Ô xanh: đúng vị trí; ô vàng: đúng chữ sai
									vị trí; ô xám: không có trong đáp án.
								</li>
							</ul>
						</div>
					</div>

					<aside className="space-y-6">
						<div className="rounded-3xl border border-slate-200 bg-slate-900 p-6 text-white shadow-lg shadow-slate-200/60">
							<p className="text-xs uppercase tracking-[0.3em] text-slate-300">
								Tiến độ
							</p>
							<div className="mt-4 flex items-center justify-between">
								<p className="text-4xl font-semibold">
									{attemptUsed}
								</p>
								<div className="text-right text-sm text-slate-300">
									<p>Lượt đã dùng</p>
									<p>{attemptLeft} lượt còn lại</p>
								</div>
							</div>
							<div className="mt-4 h-2 w-full rounded-full bg-slate-700">
								<div
									className="h-full rounded-full bg-emerald-400 transition-all"
									style={{ width: `${progress}%` }}
								/>
							</div>
						</div>

						<div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
							<p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
								Thông tin ván chơi
							</p>
							<div className="mt-4 space-y-4 text-sm text-slate-600">
								<div className="flex items-center justify-between">
									<span>Trạng thái</span>
									<span
										className={`rounded-full px-3 py-1 text-xs font-semibold ${
											gameState.gameOver
												? "bg-emerald-100 text-emerald-700"
												: "bg-slate-100 text-slate-600"
										}`}>
										{gameState.gameOver
											? "Đã kết thúc"
											: "Đang diễn ra"}
									</span>
								</div>
								<div className="flex items-center justify-between border-t border-slate-100 pt-4">
									<span>Từ mục tiêu</span>
									<span className="font-semibold text-slate-900">
										{gameState.gameOver
											? gameState.targetWord
											: "?????"}
									</span>
								</div>
								<div className="flex items-center justify-between border-t border-slate-100 pt-4">
									<span>Độ dài</span>
									<span className="font-semibold text-slate-900">
										5 chữ cái
									</span>
								</div>
							</div>
							{gameState.gameOver && (
								<button
									className="mt-6 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
									onClick={resetGame}>
									Chơi ván mới
								</button>
							)}
						</div>
					</aside>
				</div>
			</div>

			<style>{`
				@keyframes flipIn {
					0% {
						transform: rotateX(0);
						background-color: #fff;
					}
					50% {
						transform: rotateX(90deg);
					}
					100% {
						transform: rotateX(0);
					}
				}

				@keyframes wobble {
					0% {
						transform: translateX(0);
					}
					15% {
						transform: translateX(-5px);
					}
					30% {
						transform: translateX(5px);
					}
					45% {
						transform: translateX(-5px);
					}
					60% {
						transform: translateX(5px);
					}
					75% {
						transform: translateX(-5px);
					}
					90% {
						transform: translateX(5px);
					}
					100% {
						transform: translateX(0);
					}
				}

				@keyframes popIn {
					0% {
						transform: scale(0.8);
						opacity: 0.5;
					}
					50% {
						transform: scale(1.1);
					}
					100% {
						transform: scale(1);
						opacity: 1;
					}
				}

				.wobble {
					animation: wobble 0.5s ease-in-out;
				}

				.pop-in {
					animation: popIn 0.3s ease-in-out forwards;
				}

				.reveal-row > div {
					animation: flipIn 0.5s ease-in-out forwards;
					animation-delay: var(--reveal-delay-0);
				}

				.reveal-row > div:nth-child(2) {
					animation-delay: var(--reveal-delay-1);
				}

				.reveal-row > div:nth-child(3) {
					animation-delay: var(--reveal-delay-2);
				}

				.reveal-row > div:nth-child(4) {
					animation-delay: var(--reveal-delay-3);
				}

				.reveal-row > div:nth-child(5) {
					animation-delay: var(--reveal-delay-4);
				}
			`}</style>
		</div>
	);
}
