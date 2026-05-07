import React from "react";

interface CellProps {
	value: number | null;
	isFixed: boolean;
	isValid: boolean;
	notes: number[];
	isSelected: boolean;
	isRelated: boolean;
	hasSameValue: boolean;
	borderClasses: string;
	onClick: () => void;
	onChange: (value: number | null) => void;
}

const Cell: React.FC<CellProps> = ({
	value,
	isFixed,
	isValid,
	notes,
	isSelected,
	isRelated,
	hasSameValue,
	borderClasses,
	onClick,
}) => {
	// Determine background color based on cell state
	let bgColor = "bg-white";
	if (isSelected) {
		bgColor = "bg-indigo-100";
	} else if (hasSameValue && value !== null) {
		bgColor = "bg-indigo-50";
	} else if (isRelated) {
		bgColor = "bg-slate-50";
	}

	// Add invalid state styling
	if (!isValid && value !== null) {
		bgColor = "bg-rose-100";
	}

	// Determine text color and font weight
	const textColor = isFixed
		? "text-slate-900 font-semibold"
		: "text-indigo-600";

	return (
		<div
			className={`${borderClasses} ${bgColor} relative flex cursor-pointer items-center justify-center transition-colors duration-150 ease-out`}
			onClick={onClick}>
			{value ? (
				<span
					className={`text-xl sm:text-2xl ${textColor} ${!isValid ? "text-rose-500" : ""}`}>
					{value}
				</span>
			) : (
				<div className="grid h-full w-full grid-cols-3 grid-rows-3">
					{[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
						<div
							key={num}
							className="flex items-center justify-center">
							{notes.includes(num) && (
								<span className="text-[10px] text-slate-400 sm:text-xs">
									{num}
								</span>
							)}
						</div>
					))}
				</div>
			)}
		</div>
	);
};

export default Cell;
