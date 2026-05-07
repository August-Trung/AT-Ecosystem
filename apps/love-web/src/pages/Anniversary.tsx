import React from "react";
import { CalendarCheck, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import GiftHeartParticles from "../components/GiftHeartParticles";

const Anniversary: React.FC = () => {
	return (
		<div className="min-h-screen flex flex-col items-center bg-gradient-to-br from-pastelPink via-white to-pink-100 pb-10 relative overflow-hidden">
			<GiftHeartParticles />
			<header className="max-w-xl w-full mx-auto flex flex-col items-center pt-14 z-10">
				<h1 className="font-playfair text-4xl text-pink-700 font-bold mb-2 flex items-center gap-2">
					<CalendarCheck className="text-pink-500" size={38} />
					Kỷ niệm yêu
				</h1>
				<p className="text-lg text-pink-700 opacity-80 text-center mb-2">
					Mỗi ngày bên nhau đều là kỷ niệm quý giá!
					<br />
					<span className="block text-pink-500 text-base font-roboto mt-1">
						Theo mốc tình yêu riêng
					</span>
				</p>
				<img
					src="https://cdn.pixabay.com/photo/2021/02/14/16/46/valentines-day-6014224_1280.png"
					alt="Anniversary"
					className="w-44 h-44 object-contain block my-5 drop-shadow-lg"
					draggable={false}
				/>
				<div className="bg-white bg-opacity-90 rounded-2xl px-6 py-4 shadow-md border-2 border-pastelHeart font-playfair text-pink-900 text-lg mb-4 max-w-md">
					Đừng quên lưu giữ từng dấu mốc và cùng nhau tạo thêm những
					kỷ niệm đẹp. Mỗi lần kỷ niệm là một dịp tuyệt vời để nhìn
					lại hành trình của hai ta.
				</div>
				<div className="text-pink-500 text-base mt-1 mb-5 font-semibold flex justify-center items-center gap-1">
					<Heart className="inline" size={20} /> Chúc hai bạn ngày
					càng gắn bó bền lâu!
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
				© {new Date().getFullYear()} Đếm Ngày Yêu 💗 — Kỷ niệm yêu
			</footer>
		</div>
	);
};

export default Anniversary;
