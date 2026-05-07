import React from "react";
import { getLoveDays } from "./LoveCounter";

const ROUND_MILESTONES = [
	{ day: 50 },
	{ day: 100 },
	{ day: 200 },
	{ day: 300 },
	{ day: 365 },
	{ day: 500 },
	{ day: 730 },
	{ day: 1000 },
	{ day: 2000 },
];

const SPECIAL_MILESTONES = [
	{ day: 214, label: "Valentine đôi" }, // 14/2 + 200 ngày
	{ day: 520, label: "Anh yêu em ❤️ (520)" }, // "wǔ èr líng" ≈ "wǒ ài nǐ" trong tiếng Trung
	{ day: 521, label: "Em yêu anh 💕 (521)" }, // biến thể
	{ day: 666, label: "Mãi mãi suôn sẻ" },
	{ day: 777, label: "May mắn bên nhau" },
	{ day: 888, label: "Phát tài, phát lộc cùng nhau" },
	{ day: 999, label: "Vĩnh cửu 💍" },
	{ day: 1314, label: "Một đời một kiếp" }, // yīshēng yīshì
	{ day: 3344, label: "Sống bên nhau mãi mãi" },
];

type Props = {
	startDate: string;
};

const formatDate = (d: Date) =>
	d.toLocaleDateString("vi-VN", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});

const LoveMilestones: React.FC<Props> = ({ startDate }) => {
	const loveDays = getLoveDays(startDate);

	const dateFromMilestone = (milestone: number) => {
		const d = new Date(startDate);
		d.setDate(d.getDate() + milestone - 1);
		return d;
	};

	const renderGroup = (
		title: string,
		milestones: { day: number; label?: string }[]
	) => {
		return (
			<div className="w-full max-w-2xl mx-auto px-4 mt-6 animate-fade-in">
				<h2 className="text-lg font-bold text-pink-600 mb-3 text-center">
					{title}
				</h2>
				<div className="flex flex-wrap gap-2 justify-center">
					{milestones.map(({ day, label }) => {
						const isDone = loveDays >= day;
						return (
							<div
								key={day}
								className={`rounded-xl px-3 py-2 mb-2 flex flex-col items-center text-center shadow-sm hover:scale-105 transition-transform ${
									isDone
										? "bg-pink-50 border border-pink-200"
										: "bg-gray-50 border border-gray-200"
								}`}>
								<span className="font-bold text-xl text-pink-700">
									{day} ngày
								</span>
								{label && (
									<span className="text-xs text-pink-500 italic">
										{label}
									</span>
								)}
								<span className="text-xs text-pink-400">
									{formatDate(dateFromMilestone(day))}
								</span>
								<span className="text-base">
									{isDone ? "🎉 Đã đạt được" : "⏳ Sắp tới"}
								</span>
							</div>
						);
					})}
				</div>
			</div>
		);
	};

	return (
		<>
			{renderGroup("🎯 Mốc tròn", ROUND_MILESTONES)}
			{renderGroup("✨ Mốc số đẹp / ý nghĩa", SPECIAL_MILESTONES)}
		</>
	);
};

export default LoveMilestones;
