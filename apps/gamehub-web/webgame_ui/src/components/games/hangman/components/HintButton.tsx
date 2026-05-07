import React from "react";

interface HintButtonProps {
	hintsRemaining: number;
	onRequestHint: () => void;
	disabled: boolean;
}

const HintButton: React.FC<HintButtonProps> = ({
	hintsRemaining,
	onRequestHint,
	disabled,
}) => {
	return (
		<button
			onClick={onRequestHint}
			disabled={disabled}
			className={`flex items-center justify-center gap-3 rounded-2xl px-5 py-3 text-sm font-semibold uppercase tracking-[0.2em] transition ${
				disabled
					? "cursor-not-allowed border border-white/10 bg-white/10 text-slate-500"
					: "border border-amber-200/30 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 text-amber-950 shadow-lg shadow-amber-500/30 hover:opacity-90"
			}`}
			title={
				disabled && hintsRemaining <= 0
					? "Hết lượt gợi ý"
					: "Dùng gợi ý"
			}>
			<span className="text-lg">💡</span>
			<span>
				{hintsRemaining > 0
					? `Hint (${hintsRemaining})`
					: "Hết hint"}
			</span>
		</button>
	);
};

export default HintButton;
