import React from "react";

interface PixelButtonProps {
	onClick?: () => void;
	children: React.ReactNode;
	variant?: "primary" | "secondary" | "danger";
	className?: string;
	disabled?: boolean;
	type?: "button" | "submit" | "reset";
}

const PixelButton: React.FC<PixelButtonProps> = ({
	onClick,
	children,
	variant = "primary",
	className = "",
	disabled = false,
	type = "button",
}) => {
	// Tăng size chữ một chút cho VT323
	const baseStyles =
		"px-6 py-2 transition-all active:translate-y-1 text-lg md:text-xl uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed";

	const variants = {
		primary:
			"bg-indigo-600 text-white hover:bg-indigo-500 pixel-border-primary",
		secondary: "bg-slate-700 text-white hover:bg-slate-600 pixel-border",
		danger: "bg-rose-600 text-white hover:bg-rose-500 border-4 border-rose-800",
	};

	return (
		<button
			type={type}
			onClick={onClick}
			disabled={disabled}
			className={`${baseStyles} ${variants[variant]} ${className}`}>
			{children}
		</button>
	);
};

export default PixelButton;
