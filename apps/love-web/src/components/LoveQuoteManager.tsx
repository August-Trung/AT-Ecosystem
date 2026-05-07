import React, { useEffect, useState } from "react";
import { Heart, Star } from "lucide-react";
import { Button } from "./ui/button";

const LS_KEY_QUOTES = "love-custom-quotes";
const LS_KEY_PIN = "love-pinned-quote";

type QuoteEntry = {
	id: string;
	text: string;
	createdAt: number;
};

const SAMPLE_QUOTES: string[] = [
	"Yêu em từ cái nhìn đầu tiên 💞",
	"Gặp anh là định mệnh, bên anh là lựa chọn 🎀",
	"Tình yêu là khi chỉ cần thấy nhau là đủ ấm áp rồi.",
	"Có em/bên anh, mỗi ngày đều là ngày Valentine 💗",
	"Cảm ơn vì đã đến bên nhau, mình mãi là của nhau nhé!",
	"Chỉ cần ta bên nhau, mọi khó khăn đều hóa nhẹ nhàng 😘",
];

// Các ngày lễ đặc biệt để hiện popup (yyyy-mm-dd, hoặc mm-dd cho lặp hàng năm)
const SPECIAL_DATES: { [k: string]: string } = {
	"02-14": "Happy Valentine! 💌 Anh/chị yêu em nhiều thật nhiều!",
	"03-08": "Chúc mừng ngày Quốc tế Phụ nữ 8/3 🌷",
	"03-14": "White Day - Ngày đáp trả yêu thương 🤍",
	"12-24": "Giáng sinh vui vẻ, yêu thương an lành 🎄",
};

function getTodayKey() {
	const d = new Date();
	return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(
		d.getDate()
	).padStart(2, "0")}`;
}

const getSpecialQuoteToday = () => {
	const today = getTodayKey();
	return SPECIAL_DATES[today] || null;
};

const getQuotesFromLS = (): QuoteEntry[] => {
	const raw = localStorage.getItem(LS_KEY_QUOTES);
	if (!raw) return [];
	try {
		return JSON.parse(raw);
	} catch {
		return [];
	}
};
const saveQuotesToLS = (entries: QuoteEntry[]) => {
	localStorage.setItem(LS_KEY_QUOTES, JSON.stringify(entries));
};

const getPinnedId = (): string | null => localStorage.getItem(LS_KEY_PIN);
const setPinnedId = (id: string) => localStorage.setItem(LS_KEY_PIN, id);
const clearPinnedId = () => localStorage.removeItem(LS_KEY_PIN);

function randomFrom(arr: QuoteEntry[]) {
	if (!arr.length) return null;
	return arr[Math.floor(Math.random() * arr.length)];
}

const LoveQuoteManager: React.FC = () => {
	const [quotes, setQuotes] = useState<QuoteEntry[]>([]);
	const [input, setInput] = useState("");
	const [showPopup, setShowPopup] = useState(false);

	// Pinned quote
	const [pinnedId, setPinnedIdState] = useState<string | null>(getPinnedId());

	// Load from localStorage
	useEffect(() => {
		setQuotes(getQuotesFromLS());
		setPinnedIdState(getPinnedId());
	}, []);

	// Hiện popup nếu là ngày lễ
	useEffect(() => {
		if (getSpecialQuoteToday()) setShowPopup(true);
	}, []);

	// List all quotes: pinned (nếu có), rồi tới cá nhân, rồi sample
	const userQuotes = quotes;
	const allQuotes: QuoteEntry[] = [
		...(pinnedId ? [...userQuotes.filter((q) => q.id === pinnedId)] : []),
		...userQuotes.filter((q) => q.id !== pinnedId),
		...SAMPLE_QUOTES.map((text, i) => ({
			id: "sample-" + i,
			text,
			createdAt: 0,
		})),
	];

	// Quote hiện tại ngẫu nhiên (ưu tiên ghim nếu có)
	const [currentQuote, setCurrentQuote] = useState<QuoteEntry | null>(null);
	useEffect(() => {
		if (pinnedId) {
			const pin = allQuotes.find((q) => q.id === pinnedId) ?? null;
			setCurrentQuote(pin);
		} else {
			setCurrentQuote(randomFrom(allQuotes));
		}
		// eslint-disable-next-line
	}, [quotes, pinnedId]);

	// Thêm quote cá nhân
	const handleAddQuote = (e: React.FormEvent) => {
		e.preventDefault();
		const val = input.trim();
		if (!val) return;
		const entry: QuoteEntry = {
			id: "user-" + Date.now(),
			text: val,
			createdAt: Date.now(),
		};
		const newQuotes = [entry, ...quotes];
		setQuotes(newQuotes);
		saveQuotesToLS(newQuotes);
		setInput("");
	};

	// Ghim quote của mình
	const handlePin = (id: string) => {
		setPinnedIdState(id);
		setPinnedId(id);
	};

	const handleUnpin = () => {
		setPinnedIdState(null);
		clearPinnedId();
	};

	// Xóa quote cá nhân
	const handleDelete = (id: string) => {
		const newQuotes = quotes.filter((q) => q.id !== id);
		setQuotes(newQuotes);
		saveQuotesToLS(newQuotes);
		if (pinnedId === id) {
			clearPinnedId();
			setPinnedIdState(null);
		}
	};

	// Popup ngày lễ
	const specialQuoteToday = getSpecialQuoteToday();

	return (
		<div className="w-full flex flex-col items-center">
			{/* Quote Hiện tại */}
			<div
				className="mt-4 bg-white bg-opacity-90 px-6 py-3 rounded-xl shadow-md inline-flex items-center gap-3 font-playfair text-pink-800 text-lg border-2 border-pastelHeart mx-auto select-none"
				style={{ maxWidth: 440, minHeight: 60 }}>
				<Heart size={24} className="text-pastelHeart flex-shrink-0" />
				<span className="truncate">{currentQuote?.text}</span>
				{pinnedId && (
					<Button
						size="icon"
						variant="ghost"
						onClick={handleUnpin}
						title="Bỏ ghim">
						<Star
							className="text-yellow-500 fill-yellow-300"
							size={20}
						/>
					</Button>
				)}
			</div>

			{/* Form thêm lời chúc */}
			<form
				className="flex gap-2 w-full max-w-xs mt-4"
				onSubmit={handleAddQuote}>
				<input
					className="border border-pink-200 rounded-lg py-1 px-3 flex-1 text-pink-700 bg-white shadow-sm"
					placeholder="Thêm lời chúc/ngẫu hứng..."
					maxLength={150}
					value={input}
					onChange={(e) => setInput(e.target.value)}
				/>
				<Button type="submit" variant="secondary">
					Thêm
				</Button>
			</form>

			{/* Danh sách quote cá nhân */}
			{quotes.length > 0 && (
				<div className="mt-2 w-full max-w-xs">
					<div className="font-bold text-xs text-pink-500 mb-1">
						Lời chúc cá nhân
					</div>
					{quotes.map((q) => (
						<div
							key={q.id}
							className={`flex items-center mb-1 bg-pink-50 border border-pink-100 rounded px-2 py-1`}>
							<span className="flex-1 text-wrap text-sm">
								{q.text}
							</span>
							{pinnedId !== q.id ? (
								<Button
									size="icon"
									variant="ghost"
									onClick={() => handlePin(q.id)}
									title="Ghim">
									<Star size={16} />
								</Button>
							) : (
								<span className="ml-1 text-xs text-yellow-600">
									(Đã ghim)
								</span>
							)}
							<Button
								size="icon"
								variant="ghost"
								className="!text-red-400"
								onClick={() => handleDelete(q.id)}
								title="Xoá"
								type="button">
								×
							</Button>
						</div>
					))}
				</div>
			)}

			{/* Popup ngày lễ */}
			{specialQuoteToday && showPopup && (
				<div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
					<div className="bg-white rounded-2xl px-8 py-6 shadow-2xl flex flex-col items-center border-2 border-pink-200 animate-fade-in text-center">
						<div className="text-3xl mb-2">🎉</div>
						<div className="text-lg text-pink-800 font-medium mb-3">
							{specialQuoteToday}
						</div>
						<Button onClick={() => setShowPopup(false)}>
							Đóng lời chúc
						</Button>
					</div>
				</div>
			)}
		</div>
	);
};

export default LoveQuoteManager;
