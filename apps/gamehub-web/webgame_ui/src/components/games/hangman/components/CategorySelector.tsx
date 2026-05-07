import React from "react";

interface CategorySelectorProps {
	categories: string[];
	selectedCategory: string;
	onSelectCategory: (category: string) => void;
	disabled?: boolean;
}

const CategorySelector: React.FC<CategorySelectorProps> = ({
	categories,
	selectedCategory,
	onSelectCategory,
	disabled = false,
}) => {
	return (
		<div className="flex w-full flex-col gap-3">
			<label
				htmlFor="category-select"
				className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-400">
				Chọn chủ đề
			</label>
			<div className="relative w-full">
				<select
					id="category-select"
					value={selectedCategory}
					onChange={(e) => onSelectCategory(e.target.value)}
					disabled={disabled}
					className={`block w-full appearance-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold text-white shadow-inner backdrop-blur transition focus:border-sky-400 focus:outline-none focus:ring-0 ${
						disabled
							? "cursor-not-allowed opacity-60"
							: "cursor-pointer hover:border-white/40"
					}`}>
					{categories.map((category) => (
						<option
							key={category}
							value={category}
							className="bg-slate-900 text-slate-100">
							{category}
						</option>
					))}
				</select>
				<div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-300">
					<svg
						className="h-4 w-4"
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 20 20"
						fill="currentColor">
						<path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 011.13.99l-.07.08-4.24 4.24a.75.75 0 01-.98.07l-.08-.07-4.24-4.24a.75.75 0 01.02-1.06z" />
					</svg>
				</div>
			</div>
			{disabled && (
				<p className="text-xs text-slate-500">
					Hoàn thành ván hiện tại để đổi chủ đề
				</p>
			)}
		</div>
	);
};

export default CategorySelector;
