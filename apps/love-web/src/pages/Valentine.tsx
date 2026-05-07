import React from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

// Hiệu ứng trái tim bay có sẵn ở trang chủ, ta tái sử dụng
import HeartParticles from "../components/HeartParticles";

const Valentine: React.FC = () => {
	return (
		<div className="min-h-screen flex flex-col items-center bg-gradient-to-br from-pastelPink via-white to-pink-100 pb-10 relative overflow-hidden">
			<HeartParticles />
			<header className="max-w-xl w-full mx-auto flex flex-col items-center pt-14 z-10">
				<h1 className="font-playfair text-4xl text-pink-700 font-bold mb-2 flex items-center gap-2">
					<Heart className="text-pastelHeart" size={38} />
					Valentine ngọt ngào
				</h1>
				<p className="text-lg text-pink-700 opacity-80 text-center mb-2">
					Ngày dành riêng cho hai ta! <br />
					<span className="block text-pink-500 text-base font-roboto mt-1">
						14/02 hàng năm
					</span>
				</p>
				<img
					src="https://cdn.pixabay.com/photo/2016/11/29/10/07/heart-1868562_1280.png"
					alt="Valentine"
					className="w-40 h-40 object-contain block my-5 drop-shadow-lg animate-float"
					draggable={false}
				/>
				<div className="bg-white bg-opacity-90 rounded-2xl px-6 py-4 shadow-md border-2 border-pastelHeart font-playfair text-pink-900 text-lg mb-4 max-w-md">
					Một ngày thật đặc biệt để ta trao gửi yêu thương và lưu giữ
					những khoảnh khắc ngọt ngào.
					<br />
					Hãy tạo bất ngờ cho người ấy bằng những lời chúc, món quà
					nhỏ hoặc đơn giản là cùng nhau tận hưởng một bản nhạc lãng
					mạn!
				</div>
				<div className="text-pink-500 text-base mt-1 mb-5 font-semibold">
					💖 Chúc hai bạn luôn yêu nhau ngọt ngào như ngày Valentine!
				</div>
				<Link to="/events">
					<Button
						variant="outline"
						className="border-pastelHeart text-pink-700 hover:bg-pastelHeart/40 mt-2">
						← Quay lại các sự kiện
					</Button>
				</Link>
			</header>
			<footer className="absolute bottom-2 text-xs w-full text-center text-pink-600 opacity-60 font-roboto">
				© {new Date().getFullYear()} Đếm Ngày Yêu 💗 — Valentine đặc
				biệt
			</footer>
			{/* (Giả lập) Nhạc nền: Nếu thực sự muốn bật nhạc, có thể tích hợp audio sau */}
		</div>
	);
};

export default Valentine;
