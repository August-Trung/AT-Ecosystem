import React, { useEffect, useState } from "react";
import HeartParticles from "../components/HeartParticles";
import AvatarLover from "../components/AvatarLover";
import LoveCounter from "../components/LoveCounter";
import HeartBeat from "../components/HeartBeat";
import LoveQuoteManager from "../components/LoveQuoteManager";
import NavHome from "../components/NavHome";
import LoveMilestones from "../components/LoveMilestones";
import LoveCountdowns from "../components/LoveCountdowns";
import LoveFortuneOfDay from "../components/LoveFortuneOfDay";
import { Input } from "@/components/ui/input";

// Dummy dữ liệu avatar (sau này cho phép edit)
const LOVERS = [
	{
		name: "Nguyễn Minh Trung",
		avatarUrl:
			"https://scontent.fsgn5-5.fna.fbcdn.net/v/t39.30808-6/480799652_934245812234167_1755004652504146654_n.jpg?_nc_cat=100&ccb=1-7&_nc_sid=a5f93a&_nc_ohc=V6TegkfoQk0Q7kNvwHH3JaD&_nc_oc=AdlBBHXnYwHkRNz70aiWXNnaCL42Er5y5ToAdL2xMmKAWEJ6sGZT8s9S_qfmEIuP0M4&_nc_zt=23&_nc_ht=scontent.fsgn5-5.fna&_nc_gid=8tmZ3zdI4wBwqZ1x1r4Mdw&oh=00_AfXsUTKZeiMbEdI5PHs16Ij_6oUIsKCeD-rtF9Oz_hSFOw&oe=68B3DC98",
		birthdate: "01-08-2003",
		side: "left",
	},
	{
		name: "Trần Thị Ngọc Linh",
		avatarUrl:
			"https://scontent.fsgn5-15.fna.fbcdn.net/v/t39.30808-6/492402189_701227015749007_8613735578946723435_n.jpg?_nc_cat=111&ccb=1-7&_nc_sid=6ee11a&_nc_ohc=cw95MTOhXYcQ7kNvwEJLJkn&_nc_oc=AdmUxBljeaMM4kDxM8uCzeoOBtU4cB22kDFwx40gfsWV0cLpBXYUC4BRjRx2eUygyNc&_nc_zt=23&_nc_ht=scontent.fsgn5-15.fna&_nc_gid=I6MQZ4IJOVy80-NTME7poQ&oh=00_AfVQ9GGGQsziJai82IvBzPzsESqCCHDKtRQ6xCUqelQRjQ&oe=68B3C369",
		birthdate: "27-08-2009",
		side: "right",
	},
] as const;

const LOCALSTORAGE_KEY = "love-start-date";
const DEFAULT_LOVE_START_DATE = "2024-02-28";

const Index = () => {
	// Lưu trữ ngày bắt đầu yêu (ưu tiên localStorage)
	const [loveStart, setLoveStart] = useState<string>(() => {
		if (typeof window !== "undefined") {
			return (
				localStorage.getItem(LOCALSTORAGE_KEY) ||
				DEFAULT_LOVE_START_DATE
			);
		}
		return DEFAULT_LOVE_START_DATE;
	});
	const [picked, setPicked] = useState(false);

	useEffect(() => {
		if (typeof window !== "undefined") {
			localStorage.setItem(LOCALSTORAGE_KEY, loveStart);
		}
	}, [loveStart]);

	// Xử lý chọn ngày yêu đầu tiên
	const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setLoveStart(e.target.value);
		setPicked(true);
	};

	return (
		<div className="relative flex flex-col min-h-screen justify-center items-center bg-pastel-pink overflow-x-hidden overflow-y-auto">
			{/* Hiệu ứng trái tim bay */}
			<HeartParticles />

			{/* Avatars 2 bên */}
			<div
				className="flex flex-row justify-between items-center w-full max-w-5xl px-4 mt-16 md:mt-20 mb-4 relative z-10"
				style={{ minHeight: 180 }}>
				<div className="flex-1 flex justify-end items-center">
					<AvatarLover {...LOVERS[0]} />
				</div>

				{/* Tim đập ở giữa */}
				<div className="w-16 flex-shrink-0 flex justify-center items-center">
					<HeartBeat />
				</div>

				<div className="flex-1 flex justify-start items-center">
					<AvatarLover {...LOVERS[1]} />
				</div>
			</div>

			{/* Form nhập ngày bắt đầu yêu */}
			<div className="z-20 mt-2 mb-1 flex flex-col items-center">
				<label className="font-roboto text-sm text-pink-700 mb-1">
					Ngày bắt đầu yêu
				</label>
				<Input
					type="date"
					className="w-auto bg-white px-3 py-2 border-pastel-heart rounded-lg text-pink-700 shadow-pastel"
					value={loveStart}
					onChange={handleDateChange}
					max={new Date().toISOString().slice(0, 10)}
				/>
				{picked && (
					<span className="text-xs text-pastel-heart mt-1 floating-heart">
						Đã thay đổi ngày yêu! 💗
					</span>
				)}
			</div>

			{/* Love Counter & Text */}
			<LoveCounter startDate={loveStart} />

			{/* Milestones đã đạt */}
			<LoveMilestones startDate={loveStart} />

			{/* Countdown đến các sự kiện */}
			<LoveCountdowns startDate={loveStart} />

			{/* Bói tình yêu/ngẫu nhiên mỗi ngày */}
			<LoveFortuneOfDay />

			{/* Love Quotes */}
			<LoveQuoteManager />

			{/* Navigation */}
			<NavHome />

			<footer className="absolute bottom-2 left-0 w-full text-center text-xs text-pink-600 opacity-60 font-roboto">
				© {new Date().getFullYear()} Đếm Ngày Yêu 💗 — Build with
				Lovable
			</footer>
		</div>
	);
};

export default Index;
