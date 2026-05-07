import React from "react";
import { Calendar, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import StarParticles from "../components/StarParticles";

const LunarFestival: React.FC = () => {
	return (
		<div className="min-h-screen flex flex-col items-center bg-gradient-to-br from-pastelPink via-pink-100 to-white pb-10 relative overflow-hidden">
			<StarParticles />
			<header className="max-w-xl w-full mx-auto flex flex-col items-center pt-14 z-10">
				<h1 className="font-playfair text-4xl text-pink-700 font-bold mb-2 flex items-center gap-2">
					<Star className="text-pink-400" size={38} />
					Tết - Trung thu & các lễ truyền thống
				</h1>
				<p className="text-lg text-pink-700 opacity-80 text-center mb-2">
					Vui Tết, phá cỗ trăng rằm, cùng nhau trải nghiệm nét đẹp
					truyền thống!
					<br />
					<span className="block text-pink-500 text-base font-roboto mt-1">
						Theo lịch Việt Nam
					</span>
				</p>
				<img
					src="https://cdn.pixabay.com/photo/2017/11/10/05/05/moon-2933511_1280.png"
					alt="Lunar Festival"
					className="w-40 h-40 object-contain block my-5 drop-shadow-lg"
					draggable={false}
				/>
				<div className="bg-white bg-opacity-90 rounded-2xl px-6 py-4 shadow-md border-2 border-pastelHeart font-playfair text-pink-900 text-lg mb-4 max-w-md">
					Mỗi dịp lễ truyền thống là thời điểm tuyệt vời để quây quần
					bên nhau, thưởng thức bánh trái, ngắm trăng và lưu giữ
					khoảnh khắc hạnh phúc cùng gia đình và người thương.
				</div>
				<div className="text-pink-500 text-base mt-1 mb-5 font-semibold flex justify-center items-center gap-1">
					<Calendar className="inline" size={20} />
					Chúc bạn và gia đình hạnh phúc viên mãn!
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
				© {new Date().getFullYear()} Đếm Ngày Yêu 💗 — Tết & lễ đặc biệt
			</footer>
		</div>
	);
};

export default LunarFestival;
