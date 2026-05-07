import React from "react";
import { Plus, MessageSquare, Calendar, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const NAVS = [
	{
		icon: <Plus size={22} />,
		label: "Album",
		href: "/album",
	},
	{
		icon: <MessageSquare size={22} />,
		label: "Lời chúc",
		href: "/love-quotes",
	},
	{
		icon: <Calendar size={20} />,
		label: "Sự kiện",
		href: "/events",
	},
	{
		icon: <BookOpen size={22} />,
		label: "Nhật ký",
		href: "/diary",
	},
];

const NavHome: React.FC = () => {
	return (
		<nav className="flex flex-row gap-3 md:gap-6 justify-center items-center mt-10 select-none z-20 relative">
			{NAVS.map(({ icon, label, href }) => (
				<a
					key={href}
					href={href}
					className={cn(
						"group flex items-center gap-2 rounded-full bg-white bg-opacity-90 px-5 py-2.5 font-roboto font-bold shadow shadow-pastelHeart/40 border-2 border-pastelHeart hover:bg-pastelHeart hover:text-white hover:scale-105 transition-all duration-200 outline-none focus-visible:ring-2 ring-pink-400",
						"text-pink-800 text-base"
					)}
					style={{ minWidth: 108 }}>
					<span className="flex items-center">{icon}</span>
					<span className="ml-1">{label}</span>
				</a>
			))}
		</nav>
	);
};

export default NavHome;
