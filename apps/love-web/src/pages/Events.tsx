import React from "react";
import { Link } from "react-router-dom";
import { Heart, Cake, Gift, Snowflake, Star, Image } from "lucide-react";
import { Button } from "@/components/ui/button";

const Events: React.FC = () => {
	return (
		<div className="min-h-screen bg-gradient-to-br from-white via-pink-50 to-pink-200 pb-10">
			<header className="max-w-xl w-full mx-auto flex flex-col items-center pt-14 z-10">
				<h1 className="font-playfair text-4xl text-pink-700 font-bold mb-2 flex items-center gap-2">
					<Star className="text-pink-400" size={32} />
					Các sự kiện đặc biệt trong tình yêu
				</h1>
				<p className="text-lg text-pink-600 opacity-80 text-center mb-4">
					Danh sách các dịp đáng nhớ cho đôi bạn, đừng bỏ lỡ nhé!
				</p>
			</header>
			<main className="max-w-2xl mx-auto w-full flex flex-col gap-6 px-4 mt-4 z-10">
				<Link to="/album" className="block">
					<div className="flex items-center gap-3 p-4 rounded-xl bg-white/90 border-2 border-pastelHeart shadow hover:scale-105 hover:bg-pastelHeart/30 transition-all duration-200 mb-2">
						<Image size={28} className="text-pink-400" />
						<span className="text-lg font-semibold text-pink-900">
							Album - Ảnh &amp; Video Kỷ Niệm
						</span>
					</div>
				</Link>
				<Link to="/events/valentine" className="block">
					<div className="flex items-center gap-3 p-4 rounded-xl bg-white/90 border-2 border-pastelHeart shadow hover:scale-105 hover:bg-pastelHeart/30 transition-all duration-200">
						<Heart size={28} className="text-red-400" />
						<span className="text-lg font-semibold text-pink-900">
							Valentine - Ngày lễ tình yêu
						</span>
					</div>
				</Link>
				<Link to="/events/anniversary" className="block">
					<div className="flex items-center gap-3 p-4 rounded-xl bg-white/90 border-2 border-pastelHeart shadow hover:scale-105 hover:bg-pastelHeart/30 transition-all duration-200">
						<Gift size={28} className="text-pink-500" />
						<span className="text-lg font-semibold text-pink-900">
							Kỷ niệm - Ngày yêu nhau
						</span>
					</div>
				</Link>
				<Link to="/events/birthday" className="block">
					<div className="flex items-center gap-3 p-4 rounded-xl bg-white/90 border-2 border-pastelHeart shadow hover:scale-105 hover:bg-pastelHeart/30 transition-all duration-200">
						<Cake size={28} className="text-pink-400" />
						<span className="text-lg font-semibold text-pink-900">
							Sinh nhật
						</span>
					</div>
				</Link>
				<Link to="/events/christmas" className="block">
					<div className="flex items-center gap-3 p-4 rounded-xl bg-white/90 border-2 border-pastelHeart shadow hover:scale-105 hover:bg-pastelHeart/30 transition-all duration-200">
						<Snowflake size={28} className="text-blue-300" />
						<span className="text-lg font-semibold text-pink-900">
							Noel - Giáng sinh
						</span>
					</div>
				</Link>
				<Link to="/events/lunar-festival" className="block">
					<div className="flex items-center gap-3 p-4 rounded-xl bg-white/90 border-2 border-pastelHeart shadow hover:scale-105 hover:bg-pastelHeart/30 transition-all duration-200">
						<Star size={28} className="text-yellow-400" />
						<span className="text-lg font-semibold text-pink-900">
							Tết - Trung thu
						</span>
					</div>
				</Link>
			</main>
			<div className="text-center mt-7">
				<Link to="/">
					<Button
						variant="outline"
						className="border-pastelHeart text-pink-700 hover:bg-pastelHeart/40">
						← Về trang chính
					</Button>
				</Link>
			</div>
			<footer className="absolute bottom-2 text-xs w-full text-center text-pink-600 opacity-60 font-roboto">
				© {new Date().getFullYear()} Đếm Ngày Yêu 💗
			</footer>
		</div>
	);
};

export default Events;
