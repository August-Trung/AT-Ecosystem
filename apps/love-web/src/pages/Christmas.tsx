import React from "react";
import { TreePine, Snowflake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import SnowParticles from "../components/SnowParticles";

const Christmas: React.FC = () => {
	return (
		<div className="min-h-screen flex flex-col items-center bg-gradient-to-br from-white via-pastelPink to-pink-200 pb-10 relative overflow-hidden">
			<SnowParticles />
			<header className="max-w-xl w-full mx-auto flex flex-col items-center pt-14 z-10">
				<h1 className="font-playfair text-4xl text-pink-700 font-bold mb-2 flex items-center gap-2">
					<TreePine className="text-pink-800" size={38} /> Noel ấm áp
				</h1>
				<p className="text-lg text-pink-700 opacity-80 text-center mb-2">
					Mùa Giáng Sinh lung linh — tuyết rơi, cây thông và những
					điều kỳ diệu!
					<br />
					<span className="block text-pink-500 text-base font-roboto mt-1">
						24-25/12 hàng năm
					</span>
				</p>
				<img
					src="https://cdn.pixabay.com/photo/2016/11/19/14/00/blank-1833503_1280.png"
					alt="Christmas"
					className="w-38 h-38 object-contain block my-5 drop-shadow-lg"
					draggable={false}
				/>
				<div className="bg-white bg-opacity-90 rounded-2xl px-6 py-4 shadow-md border-2 border-pastelHeart font-playfair text-pink-900 text-lg mb-4 max-w-md">
					Mùa Noel là dịp để trao gửi yêu thương và tận hưởng không
					khí sum vầy bên nhau, cùng nhau ngắm tuyết rơi và chia sẻ
					những khoảnh khắc ngọt ngào!
				</div>
				<div className="text-pink-500 text-base mt-1 mb-5 font-semibold flex justify-center items-center gap-1">
					<Snowflake className="inline" size={20} />
					Chúc hai bạn Giáng Sinh an lành & hạnh phúc!
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
				© {new Date().getFullYear()} Đếm Ngày Yêu 💗 — Noel đặc biệt
			</footer>
		</div>
	);
};

export default Christmas;
