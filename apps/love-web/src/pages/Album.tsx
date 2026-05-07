import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import AlbumParticles from "../components/AlbumParticles";
import { Image, Video, Camera, Play, Layers, Star } from "lucide-react";
import { toast } from "sonner";

// Giả lập dữ liệu album với nhóm: du lich, sinh nhật, kỷ niệm...
const FAKE_ALBUMS = [
	{
		group: "Du lịch",
		label: "Chuyến đi Đà Lạt 🥰",
		date: "2023-03-14",
		items: [
			{
				type: "image",
				url: "https://images.unsplash.com/photo-1649972904349-6e44c42644a7?auto=format&fit=crop&w=400&q=80",
				caption: "View núi tuyệt đẹp",
				emotion: "🥰",
			},
		],
	},
	{
		group: "Sinh nhật",
		label: "Bữa tiệc đáng nhớ 🎂",
		date: "2024-02-12",
		items: [
			{
				type: "image",
				url: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=400&q=80",
				caption: "Thổi nến cùng nhau",
				emotion: "🎂",
			},
			{
				type: "video",
				thumbnail:
					"https://images.unsplash.com/photo-1527576539890-dfa815648363?auto=format&fit=crop&w=400&q=80",
				url: "",
				caption: "Video khoảnh khắc vui 🎥",
				emotion: "😆",
			},
		],
	},
	{
		group: "Kỷ niệm",
		label: "3 năm yêu nhau 💖",
		date: "2024-06-01",
		items: [
			{
				type: "image",
				url: "https://images.unsplash.com/photo-1721322800607-8c38375eef04?auto=format&fit=crop&w=400&q=80",
				caption: "Ăn kem trong công viên",
				emotion: "🍦",
			},
		],
	},
];

// Masonry css đơn giản với tailwind
const masonryCls =
	"gap-5 columns-1 sm:columns-2 md:columns-3 [column-fill:_balance]";
const cellCls =
	"mb-5 break-inside-avoid rounded-xl shadow-md bg-white relative overflow-hidden animate-fade-in";

function handleRequireSupabase(feature: string) {
	toast.warning(
		`Chức năng "${feature}" cần kết nối Supabase hoặc backend, bạn hãy bấm nút Supabase (màu xanh) phía trên góc phải và làm theo hướng dẫn của Lovable.`,
		{ duration: 5200 }
	);
}

const Album: React.FC = () => {
	const [isAnimating, setIsAnimating] = useState(true);

	React.useEffect(() => {
		setIsAnimating(true);
		const t = setTimeout(() => setIsAnimating(false), 700);
		return () => clearTimeout(t);
	}, []);

	return (
		<div className="min-h-screen flex flex-col items-center bg-gradient-to-br from-white via-pink-50 to-pink-200 pb-14 relative overflow-x-hidden">
			<AlbumParticles />
			<header className="w-full flex flex-col items-center pt-14 z-10 max-w-2xl mx-auto">
				<h1 className="font-playfair text-4xl text-pink-700 font-bold mb-2 flex items-center gap-2">
					<Image className="text-pink-400" size={36} />
					Ảnh &amp; Video Kỷ Niệm
				</h1>
				<p className="text-lg text-pink-600 opacity-80 text-center mb-4">
					Bộ sưu tập những khoảnh khắc đáng nhớ trong tình yêu của hai
					bạn!
					<br />
					<span className="block text-pink-500 text-base font-roboto mt-1">
						Lưu giữ hình ảnh và video chung, với cảm xúc ❤️
					</span>
				</p>
				<div className="flex flex-wrap gap-3 mt-4 mb-3">
					<Button
						variant="outline"
						onClick={() =>
							handleRequireSupabase("Upload ảnh/video")
						}>
						<Camera className="mr-1" /> Upload ảnh/video
					</Button>
					<Button
						variant="outline"
						onClick={() =>
							handleRequireSupabase("Tạo album kỷ niệm")
						}>
						<Layers className="mr-1" /> Tạo album kỷ niệm
					</Button>
					<Button
						variant="outline"
						onClick={() =>
							handleRequireSupabase("Love Story slideshow")
						}>
						<Play className="mr-1" /> Trình chiếu Love Story
					</Button>
					<Button
						variant="outline"
						onClick={() =>
							handleRequireSupabase("Chọn background trang chính")
						}>
						<Star className="mr-1" /> Đặt làm background
					</Button>
				</div>
			</header>
			<main className="w-full max-w-5xl px-2 mx-auto z-10">
				{FAKE_ALBUMS.map((album, idx) => (
					<section
						key={album.group + idx}
						className="mb-10 animate-fade-in">
						<div className="mb-3 flex items-center gap-2">
							<span className="font-semibold font-playfair text-xl text-pink-700">
								{album.group}
							</span>
							<span className="bg-pink-100 text-pink-500 text-xs rounded px-2 py-1 font-roboto">
								{album.label}
							</span>
							<span className="text-gray-400 text-xs ml-2">
								{album.date}
							</span>
						</div>
						<div className={masonryCls}>
							{album.items.map((item, subidx) => (
								<div
									key={subidx}
									className={`${cellCls} ${isAnimating ? "animate-fade-in scale-[0.97]" : "hover:scale-105 transition-transform duration-200"}`}>
									{item.type === "image" ? (
										<img
											src={item.url}
											alt={item.caption}
											className="w-full h-auto object-cover aspect-[4/5] transition-transform"
											loading="lazy"
											draggable={false}
										/>
									) : (
										<div className="relative w-full aspect-[4/5] flex items-center justify-center bg-gray-100">
											<Video
												size={40}
												className="absolute left-1 top-1 text-pink-400 opacity-70 z-10"
											/>
											<img
												src={item.thumbnail}
												alt={item.caption}
												className="w-full h-full object-cover opacity-60"
												draggable={false}
											/>
											<span className="absolute left-2 bottom-2 bg-white/70 rounded px-2 py-1 text-xs text-pink-700 shadow">
												Video
											</span>
										</div>
									)}
									{/* Hover caption cảm xúc */}
									<div className="absolute inset-0 flex flex-col items-center justify-end opacity-0 group-hover:opacity-100 hover:opacity-100 bg-gradient-to-t from-black/60 to-transparent p-3 transition-opacity duration-200 cursor-pointer">
										<span className="text-white text-base font-bold drop-shadow-md">
											{item.caption}{" "}
											<span className="text-xl">
												{item.emotion}
											</span>
										</span>
									</div>
								</div>
							))}
						</div>
					</section>
				))}
			</main>
			<div className="text-center mt-6">
				<Link to="/events">
					<Button
						variant="outline"
						className="border-pastelHeart text-pink-700 hover:bg-pastelHeart/40">
						← Quay lại các sự kiện
					</Button>
				</Link>
			</div>
			<footer className="absolute bottom-2 text-xs w-full text-center text-pink-600 opacity-60 font-roboto">
				© {new Date().getFullYear()} Đếm Ngày Yêu 💗 — Album kỷ niệm
			</footer>
		</div>
	);
};

export default Album;
