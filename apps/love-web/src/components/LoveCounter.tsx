import React, { useEffect, useState } from "react";

// Trả về số ngày yêu nhau dựa trên ngày bắt đầu
export function getLoveDays(startDate: string): number {
	const start = new Date(startDate);
	const today = new Date();
	// Set về 00:00 để chính xác
	start.setHours(0, 0, 0, 0);
	today.setHours(0, 0, 0, 0);
	const diff = today.getTime() - start.getTime();
	return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1; // tính luôn ngày bắt đầu
}

const LoveCounter: React.FC<{
	startDate: string;
}> = ({ startDate }) => {
	const [loveDays, setLoveDays] = useState(() => getLoveDays(startDate));

	useEffect(() => {
		// Tự động cập nhật nửa đêm (change ngày)
		const timeout = setTimeout(
			() => setLoveDays(getLoveDays(startDate)),
			1000 * 60 * 60 * 1
		);
		return () => clearTimeout(timeout);
	}, [startDate, loveDays]);

	return (
		<div className="flex flex-col items-center justify-center select-none relative z-10 py-2">
			<div
				className="rounded-full bg-pastelHeart bg-opacity-75 border-4 border-pink-300 mx-auto flex flex-col items-center justify-center animate-floatupanddown"
				style={{
					width: 184,
					height: 184,
					boxShadow: "0px 0px 64px #F8B3CC90",
					position: "relative",
					fontFamily: "'Playfair Display', serif",
				}}>
				<div className="flex items-center justify-center gap-2 pt-6">
					<span className="text-[2.7rem] md:text-[3rem] font-[700] text-white drop-shadow-[0_2px_5px_rgba(255,120,160,0.5)] select-none">
						{loveDays}
					</span>
					<span className="text-pink-700 font-bold text-lg">
						ngày
					</span>
				</div>
				<span className="absolute bottom-4 left-1/2 -translate-x-1/2 w-full text-center block text-white text-opacity-80 font-playfair text-sm tracking-wide">
					💖
				</span>
			</div>
			<div className="mt-6 font-playfair text-xl text-pink-900 w-full text-center">
				Hôm nay là ngày thứ <b>{loveDays}</b> bên nhau
			</div>
		</div>
	);
};

export default LoveCounter;
