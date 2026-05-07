import React, { useEffect, useState } from "react";
import { HeartHandshake } from "lucide-react";

const FORTUNE_KEY = "love-fortune-today";

const FORTUNE_LIST: string[] = [
	"Hôm nay là ngày đặc biệt, hãy ôm người ấy thật chặt nhé 💑",
	"Một hành động nhỏ cũng sẽ khiến tình yêu thêm ngọt ngào 💌",
	"Chia sẻ một kỷ niệm vui cùng nhau để thấy hạnh phúc trọn vẹn hơn!",
	"Cùng nhau lên một kế hoạch nhỏ cho cuối tuần này đi 😉",
	"Hãy gửi một tin nhắn bất ngờ cho người ấy nhé 📱",
	"Lắng nghe nhau nhiều hơn sẽ giúp hai bạn gần nhau hơn!",
	"Trao nhau ánh mắt và nụ cười nhiều hơn hôm nay nhé 💫",
	"Một món quà nhỏ cũng là điều ý nghĩa với tình yêu 💖",
	"Hôm nay rất hợp để cùng nhau ăn gì đó thật ngon!",
	"Dành một lời khen cho người ấy, chắc chắn sẽ có niềm vui bất ngờ!",
	"Nhớ thật nhiều không bằng nhắn gửi một câu yêu thương 💬",
	"Tình yêu của hai bạn hôm nay sẽ gặp một niềm may mắn bất ngờ 😍",
	"Điều bạn mong chờ về người ấy sẽ sớm thành hiện thực!",
	"Giữ cho trái tim bình yên và cùng nhau vượt qua mọi thử thách 💪",
	"Hãy ghi lại cảm xúc hôm nay – bạn sẽ muốn xem lại trong tương lai đấy!",
];

function getTodayKey() {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
		2,
		"0"
	)}-${String(d.getDate()).padStart(2, "0")}`;
}

function getFortuneIndexByDate(key: string) {
	// Đổi string ngày sang số đơn giản để random (hash thô)
	let num = 0;
	for (let i = 0; i < key.length; i++) {
		num += key.charCodeAt(i) * (i + 1);
	}
	return num % FORTUNE_LIST.length;
}

const LoveFortuneOfDay: React.FC = () => {
	const [fortune, setFortune] = useState<string | null>(null);

	useEffect(() => {
		const todayKey = getTodayKey();
		let stored = localStorage.getItem(FORTUNE_KEY);
		let lastKey = "";
		let fortuneIdx = -1;
		if (stored) {
			try {
				const parsed = JSON.parse(stored);
				lastKey = parsed.date;
				fortuneIdx = parsed.idx;
			} catch {}
		}

		if (
			lastKey === todayKey &&
			fortuneIdx >= 0 &&
			fortuneIdx < FORTUNE_LIST.length
		) {
			setFortune(FORTUNE_LIST[fortuneIdx]);
		} else {
			// random theo ngày cố định (deterministic)
			const idx = getFortuneIndexByDate(todayKey);
			setFortune(FORTUNE_LIST[idx]);
			localStorage.setItem(
				FORTUNE_KEY,
				JSON.stringify({ date: todayKey, idx })
			);
		}
	}, []);

	return (
		<div className="w-full flex justify-center mt-4">
			<div className="bg-white/90 shadow-lg border-2 border-pink-100 rounded-2xl px-6 py-4 max-w-md w-full flex items-center gap-3 font-playfair text-pink-700 text-base select-none">
				<HeartHandshake
					size={28}
					className="flex-shrink-0 text-pink-500"
				/>
				<span className="flex-1">{fortune || "..."}</span>
			</div>
		</div>
	);
};

export default LoveFortuneOfDay;
