import React from "react";
import { useI18n } from "./i18n";
import { getToolGuide } from "./toolRegistry";

type Guide = {
	title: string;
	purpose: string;
	steps: string[];
	tips?: string[];
};

type PageGuideMap = Record<string, { en: Guide; vi: Guide }>;

const pageGuides: PageGuideMap = {
	"/favorites": {
		en: {
			title: "Favorites",
			purpose: "Quickly access your pinned tools.",
			steps: [
				"Pin tools from the dashboard.",
				"Open Favorites to view only pinned tools.",
				"Unpin to remove from the list.",
			],
		},
		vi: {
			title: "Yêu thích",
			purpose: "Truy c?p nhanh các tool ð? ghim.",
			steps: [
				"Ghim tool t? dashboard.",
				"M? Yêu thích ð? xem tool ð? ghim.",
				"B? ghim ð? xóa kh?i danh sách.",
			],
		},
	},
	"/browse": {
		en: {
			title: "Browse",
			purpose: "Explore all tools by group and search.",
			steps: [
				"Use search to filter tools quickly.",
				"Collapse or expand groups as needed.",
				"Pin frequently used tools.",
			],
		},
		vi: {
			title: "Duy?t",
			purpose: "Duy?t toàn b? tool theo nhóm và t?m ki?m.",
			steps: [
				"Dùng ô t?m ki?m ð? l?c nhanh.",
				"Thu g?n ho?c m? r?ng nhóm.",
				"Ghim tool hay dùng.",
			],
		},
	},
	"/recent": {
		en: {
			title: "Recently Used",
			purpose: "See tools you used most recently.",
			steps: [
				"Open a tool from the list.",
				"Use Favorites for long-term pinning.",
				"Search to filter recent items.",
			],
		},
		vi: {
			title: "Dùng g?n ðây",
			purpose: "Xem các tool v?a s? d?ng.",
			steps: [
				"M? tool t? danh sách.",
				"Dùng Yêu thích ð? ghim lâu dài.",
				"T?m ki?m ð? l?c nhanh.",
			],
		},
	},
	"/settings": {
		en: {
			title: "Settings",
			purpose: "Customize language, theme, and spacing.",
			steps: [
				"Switch language between English and Vietnamese.",
				"Toggle light/dark theme.",
				"Enable compact mode for tighter spacing.",
			],
		},
		vi: {
			title: "Cài ð?t",
			purpose: "Tùy ch?nh ngôn ng?, giao di?n, và kho?ng cách.",
			steps: [
				"Chuy?n ngôn ng? Anh/Vi?t.",
				"B?t t?t giao di?n sáng/t?i.",
				"B?t ch? ð? g?n ð? thu h?p kho?ng cách.",
			],
		},
	},
};

const ToolGuide = ({ path }: { path: string }) => {
	const { lang } = useI18n();
	const normalizedPath = path === "/" ? "/browse" : path;
	const toolGuide = getToolGuide(normalizedPath, lang);
	const pageGuide = pageGuides[normalizedPath]?.[lang] ?? null;
	const guide = toolGuide ?? pageGuide;
	if (!guide) return null;

	return (
		<div className="mb-4">
			<details className="bg-dark-800 border border-dark-700 rounded-xl p-3">
				<summary className="cursor-pointer text-sm font-bold text-gray-300">
					{lang === "vi" ? "Hý?ng d?n: " : "How to use: "}
					{guide.title}
				</summary>
				<div className="mt-3 grid md:grid-cols-2 gap-4 text-sm text-gray-400">
					<div>
						<p className="text-xs uppercase tracking-wider text-gray-500 mb-2">
							{lang === "vi" ? "M?c ðích" : "Purpose"}
						</p>
						<p className="text-sm text-gray-300">{guide.purpose}</p>
						<p className="text-xs uppercase tracking-wider text-gray-500 mt-4 mb-2">
							{lang === "vi" ? "Cách dùng" : "Steps"}
						</p>
						<ol className="list-decimal ml-4 space-y-1">
							{guide.steps.map((step) => (
								<li key={step}>{step}</li>
							))}
						</ol>
					</div>
					{guide.tips && (
						<div>
							<p className="text-xs uppercase tracking-wider text-gray-500 mb-2">
								{lang === "vi" ? "M?o" : "Tips"}
							</p>
							<ul className="list-disc ml-4 space-y-1">
								{guide.tips.map((tip) => (
									<li key={tip}>{tip}</li>
								))}
							</ul>
						</div>
					)}
				</div>
			</details>
		</div>
	);
};

export default ToolGuide;
