import React, { useMemo, useState } from "react";
import { PenTool, Copy, Check } from "lucide-react";
import { useI18n } from "../i18n";

const headlineTemplates = (topic: string, keywords: string[]) => [
	`The Ultimate Guide to ${topic}`,
	`${topic}: ${keywords[0] ? `How to ${keywords[0]}` : "Tips & Tricks"}`,
	`Top 10 ${topic} Mistakes and How to Avoid Them`,
	`${topic} Checklist: ${keywords[0] || "Start Here"}`,
	`Beginner to Pro: ${topic} in 7 Steps`,
];

const outlineTemplates = (topic: string, keywords: string[]) => [
	`1. What is ${topic}?\n2. Why it matters\n3. Key concepts: ${keywords.join(", ") || "basics"}\n4. Step-by-step process\n5. Common mistakes\n6. Tools and resources\n7. Summary`,
	`1. Introduction\n2. Problem statement\n3. Solution overview\n4. Implementation\n5. Examples\n6. FAQs\n7. Conclusion`,
];

const OutlineHeadlineTool = () => {
	const { t } = useI18n();
	const [topic, setTopic] = useState("Content Marketing");
	const [keywords, setKeywords] = useState("SEO, copywriting, audience");
	const [copied, setCopied] = useState("");

	const keywordList = useMemo(
		() =>
			keywords
				.split(",")
				.map((k) => k.trim())
				.filter(Boolean),
		[keywords]
	);

	const headlines = headlineTemplates(topic, keywordList);
	const outlines = outlineTemplates(topic, keywordList);

	const copy = (value: string, key: string) => {
		navigator.clipboard.writeText(value);
		setCopied(key);
		setTimeout(() => setCopied(""), 2000);
	};

	return (
		<div className="max-w-5xl mx-auto">
			<h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
				<PenTool className="text-pink-400" />{" "}
				{t("Outline & Headlines", "Dàn ý & Tiêu đề")}
			</h2>

			<div className="bg-dark-800 border border-dark-700 rounded-xl p-4 space-y-3">
				<input
					value={topic}
					onChange={(e) => setTopic(e.target.value)}
					placeholder={t("Topic", "Chủ đề")}
					className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-gray-200"
				/>
				<input
					value={keywords}
					onChange={(e) => setKeywords(e.target.value)}
					placeholder={t("Keywords (comma separated)", "Từ khóa (phân tách bằng dấu phẩy)")}
					className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-gray-200"
				/>
			</div>

			<div className="grid md:grid-cols-2 gap-6 mt-6">
				<div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
					<div className="flex items-center justify-between mb-2">
						<h3 className="text-sm font-bold text-gray-400">
							{t("Headlines", "Tiêu đề")}
						</h3>
						<button
							onClick={() => copy(headlines.join("\n"), "headline")}
							className="text-xs text-pink-400 hover:text-pink-300 flex items-center gap-1"
						>
							{copied === "headline" ? <Check size={12} /> : <Copy size={12} />}{" "}
							{t("Copy", "Sao chép")}
						</button>
					</div>
					<ul className="text-sm text-gray-300 space-y-2">
						{headlines.map((h) => (
							<li key={h}>• {h}</li>
						))}
					</ul>
				</div>
				<div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
					<div className="flex items-center justify-between mb-2">
						<h3 className="text-sm font-bold text-gray-400">
							{t("Outlines", "Dàn ý")}
						</h3>
						<button
							onClick={() => copy(outlines.join("\n\n"), "outline")}
							className="text-xs text-pink-400 hover:text-pink-300 flex items-center gap-1"
						>
							{copied === "outline" ? <Check size={12} /> : <Copy size={12} />}{" "}
							{t("Copy", "Sao chép")}
						</button>
					</div>
					{outlines.map((o, idx) => (
						<pre
							key={`outline-${idx}`}
							className="bg-dark-900 border border-dark-700 rounded-lg p-3 text-xs text-pink-300 mb-3 whitespace-pre-wrap"
						>
							{o}
						</pre>
					))}
				</div>
			</div>
		</div>
	);
};

export default OutlineHeadlineTool;
