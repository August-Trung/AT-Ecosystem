import React, { useState } from "react";
import { Calendar, Heart } from "lucide-react";

type Lover = {
	avatarUrl: string;
	name: string;
	birthdate: string; // YYYY-MM-DD
	side: "left" | "right";
};

const parseBirthdate = (birthdate: string): Date => {
	// Expecting format DD-MM-YYYY
	const [day, month, year] = birthdate.split("-").map(Number);
	return new Date(year, month - 1, day);
};

const getAge = (birthdate: string): number => {
	const dob = parseBirthdate(birthdate);
	const now = new Date();
	let age = now.getFullYear() - dob.getFullYear();
	if (
		now.getMonth() < dob.getMonth() ||
		(now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())
	) {
		age--;
	}
	return age;
};

const AvatarLover: React.FC<Lover> = ({ avatarUrl, name, birthdate, side }) => {
	const [hovered, setHovered] = useState(false);
	const age = getAge(birthdate);

	return (
		<div
			className={`relative flex flex-col items-center group transition-transform duration-300 ${
				side === "left" ? "justify-end" : "justify-start"
			}`}
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
			style={{ minWidth: 140 }}>
			<div
				className={`w-32 h-32 rounded-full shadow-xl border-4 border-pastelHeart border-opacity-70 flex items-center justify-center overflow-hidden bg-white bg-opacity-40 group-hover:scale-105 transition-transform duration-300`}
				style={{
					boxShadow: "0 6px 34px 0 #ffb6c166",
					transition: "box-shadow 0.3s, transform 0.3s",
				}}>
				<img
					src={avatarUrl}
					alt={name}
					className="w-full h-full object-cover object-center group-hover:scale-110 transition-transform duration-500"
					draggable={false}
				/>
				{/* Heart overlay khi hover */}
				<span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-60 transition-opacity">
					<Heart
						size={54}
						color="#FF8FB2"
						fill="#FFB6C1"
						className="animate-heartBeat"
					/>
				</span>
			</div>
			{/* Info popup */}
			<div
				className={`absolute w-44 left-1/2 -translate-x-1/2 mt-4 bg-white bg-opacity-95 rounded-xl shadow-md px-4 py-2 z-10 transition-all duration-300 ${
					hovered
						? "opacity-100 translate-y-0 pointer-events-auto"
						: "opacity-0 -translate-y-2 pointer-events-none"
				}`}
				style={{
					bottom: -70,
					fontFamily: "'Playfair Display', serif",
					color: "#D81B60",
				}}>
				<div className="font-bold text-md flex items-center gap-2">
					<Heart size={16} className="text-pastelHeart" />
					{name}
				</div>
				<div className="flex items-center text-xs mt-0.5 text-gray-700">
					<Calendar size={14} className="mr-1 text-pink-500" />
					{birthdate} &nbsp; • &nbsp; {age} tuổi
				</div>
			</div>
		</div>
	);
};

export default AvatarLover;
