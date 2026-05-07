import React, { useState, useEffect } from "react";
import HangmanDisplay from "./components/HangmanDisplay";
import WordDisplay from "./components/WordDisplay";
import LetterKeyboard from "./components/LetterKeyboard";
import CategorySelector from "./components/CategorySelector";
import HintButton from "./components/HintButton";
import { useHangmanGame } from "./hooks/useHangmanGame";
import { WORD_CATEGORIES } from "./data/wordCategories";

const HangmanGame: React.FC = () => {
	const [selectedCategory, setSelectedCategory] = useState("Programming");
	const [hintsRemaining, setHintsRemaining] = useState(3);
	const [activeHint, setActiveHint] = useState<string | null>(null);

	const categoryWords = WORD_CATEGORIES[selectedCategory] || [];

	const {
		word,
		guessedLetters,
		wrongGuesses,
		gameStatus,
		guessLetter,
		resetGame,
	} = useHangmanGame(categoryWords);

	useEffect(() => {
		resetGame();
	}, [selectedCategory, resetGame]);

	useEffect(() => {
		if (gameStatus === "playing") {
			setActiveHint(null);
		}
	}, [gameStatus]);

	const handleCategoryChange = (category: string) => {
		setSelectedCategory(category);
	};

	const requestHint = () => {
		if (hintsRemaining > 0 && gameStatus === "playing") {
			const unguessedLetters = word
				.split("")
				.filter((letter) => !guessedLetters.includes(letter));

			if (unguessedLetters.length > 0) {
				const randomIndex = Math.floor(
					Math.random() * unguessedLetters.length
				);
				const hintLetter = unguessedLetters[randomIndex];

				setActiveHint(`Từ khóa có chứa chữ cái "${hintLetter}"`);
				setHintsRemaining((prev) => prev - 1);
			}
		}
	};

	const handleResetGame = () => {
		resetGame();
		setHintsRemaining(3);
		setActiveHint(null);
	};

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (gameStatus !== "playing") return;

			const key = event.key.toUpperCase();

			if (/^[A-Z]$/.test(key) && !guessedLetters.includes(key)) {
				guessLetter(key);
			}
		};

		window.addEventListener("keydown", handleKeyDown);

		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [gameStatus, guessedLetters, guessLetter]);

	const guessesLeft = 6 - wrongGuesses.length;

	return (
		<section className="min-h-screen w-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-10 text-slate-50">
			<div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
				<header className="space-y-3 text-center">
					<p className="text-xs uppercase tracking-[0.5em] text-slate-400">
						word challenge
					</p>
					<h1 className="text-3xl font-bold sm:text-4xl">
						Hangman Experience
					</h1>
					<p className="text-sm text-slate-400 sm:text-base">
						Đoán từ đúng trước khi hình nộm hoàn thiện – dùng bàn
						phím hoặc bấm nhanh trên giao diện mới này nhé!
					</p>
				</header>

				<div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
					<article className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-slate-900/40 backdrop-blur">
						<div className="flex flex-col gap-6">
							<CategorySelector
								categories={Object.keys(WORD_CATEGORIES)}
								selectedCategory={selectedCategory}
								onSelectCategory={handleCategoryChange}
								disabled={gameStatus !== "playing"}
							/>

							<div className="grid gap-3 rounded-2xl bg-black/10 p-4 text-sm text-slate-300 sm:grid-cols-2">
								<div className="rounded-2xl border border-white/5 bg-black/30 p-4">
									<p className="text-xs uppercase tracking-[0.3em] text-slate-400">
										Trạng thái
									</p>
									<p className="text-2xl font-semibold text-white">
										{gameStatus === "won"
											? "Đã thắng 🎉"
											: gameStatus === "lost"
											? "Thua rồi 😢"
											: "Đang chơi"}
									</p>
									<p className="text-xs text-slate-400">
										{wrongGuesses.length}/6 lần sai
									</p>
								</div>
								<div className="rounded-2xl border border-white/5 bg-black/30 p-4">
									<p className="text-xs uppercase tracking-[0.3em] text-slate-400">
										Lượt còn lại
									</p>
									<p
										className={`text-2xl font-semibold ${
											guessesLeft <= 2
												? "text-rose-300"
												: "text-emerald-300"
										}`}>
										{guessesLeft}
									</p>
									<p className="text-xs text-slate-400">
										Tối đa 6 lần đoán sai
									</p>
								</div>
							</div>

							<div className="rounded-3xl border border-white/5 bg-black/20 p-4 sm:p-6">
								<HangmanDisplay wrongGuesses={wrongGuesses} />
							</div>

							<div className="rounded-3xl border border-white/5 bg-black/20 px-4 py-5 sm:px-6">
								<WordDisplay
									word={word}
									guessedLetters={guessedLetters}
								/>
							</div>

							<p className="text-center text-xs uppercase tracking-[0.4em] text-slate-500">
								dùng bàn phím vật lý để đoán nhanh hơn
							</p>
						</div>
					</article>

					<aside className="flex flex-col gap-6">
						<section className="rounded-3xl border border-white/10 bg-white/5 p-6">
							<div className="flex flex-col gap-4">
								<div>
									<h2 className="text-lg font-semibold">
										Trợ giúp & tài nguyên
									</h2>
									<p className="text-sm text-slate-400">
										Sử dụng hint thông minh để bảo toàn lượt
										đoán.
									</p>
								</div>

								<div className="grid grid-cols-2 gap-3 text-center text-sm">
									<div className="rounded-2xl bg-black/20 p-4">
										<p className="text-xs uppercase tracking-wide text-slate-400">
											Số hint
										</p>
										<p className="text-3xl font-bold text-amber-300">
											{hintsRemaining}
										</p>
										<p className="text-xs text-slate-400">
											mỗi ván có 3 lần
										</p>
									</div>
									<div className="rounded-2xl bg-black/20 p-4">
										<p className="text-xs uppercase tracking-wide text-slate-400">
											Chữ sai
										</p>
										<p className="text-3xl font-bold text-rose-300">
											{wrongGuesses.length}
										</p>
										<p className="text-xs text-slate-400">
											{wrongGuesses.length
												? wrongGuesses.join(", ")
												: "Chưa có"}
										</p>
									</div>
								</div>

								<HintButton
									hintsRemaining={hintsRemaining}
									onRequestHint={requestHint}
									disabled={
										gameStatus !== "playing" ||
										hintsRemaining <= 0
									}
								/>

								{activeHint && (
									<div className="rounded-2xl border border-amber-200/40 bg-amber-100/10 p-4 text-amber-100">
										<p className="text-sm font-medium">
											💡 Gợi ý:
										</p>
										<p className="text-sm text-amber-200">
											{activeHint}
										</p>
									</div>
								)}
							</div>
						</section>

						<section className="rounded-3xl border border-white/10 bg-white/5 p-6">
							{gameStatus === "playing" ? (
								<div className="flex flex-col gap-6">
									<div>
										<p className="text-sm uppercase tracking-[0.3em] text-slate-400">
											Bàn phím ảo
										</p>
										<p className="text-lg font-semibold">
											Chạm để đoán chữ
										</p>
									</div>
									<LetterKeyboard
										guessedLetters={guessedLetters}
										onGuess={guessLetter}
									/>
								</div>
							) : (
								<div className="flex flex-col items-center gap-5 text-center">
									<p className="text-xl font-semibold">
										{gameStatus === "won"
											? "🎉 Bạn đã giải cứu hình nộm!"
											: "💀 Hết lượt rồi!"}
									</p>
									<p className="text-sm text-slate-400">
										Từ khóa đúng là:{" "}
										<span className="font-semibold text-white">
											{word}
										</span>
									</p>
									<button
										onClick={handleResetGame}
										className="w-full rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:opacity-90">
										Chơi lại
									</button>
								</div>
							)}
						</section>
					</aside>
				</div>
			</div>
		</section>
	);
};

export default HangmanGame;
