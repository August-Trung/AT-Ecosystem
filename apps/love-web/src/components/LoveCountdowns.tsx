import React from "react";

type CountdownEvent = {
	name: string;
	date: string; // yyyy-mm-dd (local-safe)
	emoji: string;
};

// ===== Utils: KHÔNG dùng toISOString, KHÔNG parse "YYYY-MM-DD" trực tiếp =====
const parseYMD = (s: string): Date => {
	const [y, m, d] = s.split("-").map(Number);
	return new Date(y, (m as number) - 1, d);
};
const formatYMD = (d: Date): string => {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
};
const formatDDMMYYYY = (ymd: string): string => {
	const [y, m, d] = ymd.split("-");
	return `${d}-${m}-${y}`;
};

// Luôn lấy event tới (local time)
function nextEventDate(month: number, day: number): Date {
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	let d = new Date(now.getFullYear(), month - 1, day);
	if (d < today) d = new Date(now.getFullYear() + 1, month - 1, day);
	return d;
}

// Kỷ niệm tròn năm tính từ startDate (YYYY-MM-DD)
function nextAnniversary(startDate: string): Date {
	const d0 = parseYMD(startDate); // tránh UTC-parse
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	let next = new Date(today.getFullYear(), d0.getMonth(), d0.getDate());
	if (next < today)
		next = new Date(today.getFullYear() + 1, d0.getMonth(), d0.getDate());
	return next;
}

const UPCOMING_EVENTS = (startDate: string): CountdownEvent[] => [
	{
		name: "Kỷ niệm yêu (tròn năm)",
		date: formatYMD(nextAnniversary(startDate)),
		emoji: "💖",
	},
	{
		name: "Valentine",
		date: formatYMD(nextEventDate(2, 14)),
		emoji: "💌",
	},
	{
		name: "White Day",
		date: formatYMD(nextEventDate(3, 14)),
		emoji: "🤍",
	},
	{
		name: "Sinh nhật người ấy",
		// lấy đúng MM/DD hàng năm, không dùng chuỗi gốc + toISOString
		date: formatYMD(nextEventDate(8, 27)),
		emoji: "🎂",
	},
	{
		name: "Giáng sinh",
		date: formatYMD(nextEventDate(12, 24)),
		emoji: "🎄",
	},
];

function daysBetween(a: string, b: string) {
	// Dùng parseYMD để đảm bảo mốc 00:00 LOCAL
	const d1 = parseYMD(a);
	const d2 = parseYMD(b);
	const ms = d2.getTime() - d1.getTime();
	return Math.ceil(ms / (1000 * 3600 * 24));
}

const LoveCountdowns: React.FC<{ startDate: string }> = ({ startDate }) => {
	const nowStr = formatYMD(new Date()); // hôm nay theo local

	const events = React.useMemo(() => {
		const e = UPCOMING_EVENTS(startDate).sort(
			(a, b) => daysBetween(nowStr, a.date) - daysBetween(nowStr, b.date)
		);
		return e;
	}, [startDate, nowStr]);

	return (
		<div className="w-full max-w-2xl mx-auto px-4 mt-1 animate-fade-in">
			<div className="flex flex-wrap gap-2 justify-center">
				{events.map((ev) => {
					const days = daysBetween(nowStr, ev.date);
					return (
						<div
							key={ev.name}
							className="bg-pink-100 border border-pink-200 rounded-xl px-3 py-2 mb-2 flex flex-col items-center text-center shadow-sm">
							<span className="font-bold text-base text-pink-700">
								{ev.emoji} {ev.name}
							</span>
							<span className="text-xs text-pink-500">
								({formatDDMMYYYY(ev.date)})
							</span>
							{days > 0 ? (
								<span className="text-lg text-pink-700 font-semibold">
									{days} ngày nữa
								</span>
							) : (
								<span className="text-green-600 font-bold">
									Hôm nay! 🎉
								</span>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
};

export default LoveCountdowns;
