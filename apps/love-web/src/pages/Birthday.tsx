import React from "react";
import { Cake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import CakeParticles from "../components/CakeParticles";

const Birthday: React.FC = () => {
	return (
		<div className="min-h-screen flex flex-col items-center bg-gradient-to-br from-pink-100 via-pastelPink to-pink-200 pb-10 relative overflow-hidden">
			<CakeParticles />
			<header className="max-w-xl w-full mx-auto flex flex-col items-center pt-14 z-10">
				<h1 className="font-playfair text-4xl text-pink-700 font-bold mb-2 flex items-center gap-2">
					<Cake className="text-pink-500" size={38} />
					Sinh nhật hạnh phúc
				</h1>
				<p className="text-lg text-pink-700 opacity-80 text-center mb-2">
					Ngày đặc biệt để gửi những lời chúc và món quà tuyệt vời
					nhất!
					<br />
					<span className="block text-pink-500 text-base font-roboto mt-1">
						Theo ngày sinh
					</span>
				</p>
				<img
					src="https://cdn.pixabay.com/photo/2017/05/14/21/13/birthday-2310466_1280.png"
					alt="Birthday"
					className="w-40 h-40 object-contain block my-5 drop-shadow-lg animate-float"
					draggable={false}
				/>
				<div className="bg-white bg-opacity-90 rounded-2xl px-6 py-4 shadow-md border-2 border-pastelHeart font-playfair text-pink-900 text-lg mb-4 max-w-md">
					Đây là dịp tuyệt vời để ghi dấu tuổi mới với thật nhiều yêu
					thương, nụ cười và bất ngờ từ người mình thương!
				</div>
				<div className="text-pink-500 text-base mt-1 mb-5 font-semibold">
					🎂 Chúc bạn một sinh nhật thật rực rỡ và hạnh phúc bên người
					quan trọng!
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
				© {new Date().getFullYear()} Đếm Ngày Yêu 💗 — Sinh nhật đặc
				biệt
			</footer>
		</div>
	);
};

export default Birthday;
