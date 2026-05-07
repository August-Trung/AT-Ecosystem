import React, { useEffect, useState } from "react";
import { Heart } from "lucide-react";

const SAMPLE_QUOTES = [
	"Yêu em từ cái nhìn đầu tiên 💞",
	"Gặp anh là định mệnh, bên anh là lựa chọn 🎀",
	"Tình yêu là khi chỉ cần thấy nhau là đủ ấm áp rồi.",
	"Dù thế giới có đổi thay, anh vẫn chỉ yêu mình em thôi 🥰",
	"Có em/bên anh, mỗi ngày đều là ngày Valentine 💗",
	"Cảm ơn vì đã đến bên nhau, mình mãi là của nhau nhé!",
	"Tình yêu bắt đầu từ nụ cười, lớn lên bằng nụ hôn và kết thúc bằng nước mắt 💘",
	"Gửi ngàn lời thương đến người thương 💕",
	"Ngày nào bên em/anh cũng là ngày hạnh phúc nhất",
	"Chỉ cần ta bên nhau, mọi khó khăn đều hóa nhẹ nhàng 😘",
];

const getRandomQuote = () => {
	return SAMPLE_QUOTES[Math.floor(Math.random() * SAMPLE_QUOTES.length)];
};

const LoveQuote: React.FC = () => {
	const [quote, setQuote] = useState(getRandomQuote);

	// Mỗi lần reload tự thay đổi
	useEffect(() => {
		setQuote(getRandomQuote());
	}, []);

	return (
		<div
			className="mt-4 bg-white bg-opacity-85 px-6 py-3 rounded-xl shadow-md inline-flex items-center gap-3 font-playfair text-pink-800 text-lg border-2 border-pastelHeart mx-auto select-none"
			style={{ maxWidth: 420 }}>
			<Heart size={24} className="text-pastelHeart flex-shrink-0" />
			<span>{quote}</span>
		</div>
	);
};

export default LoveQuote;
