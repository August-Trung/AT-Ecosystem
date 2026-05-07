import React, { useMemo, useState } from "react";
import { BookOpen } from "lucide-react";
import { useI18n } from "../i18n";

const countSyllables = (word: string) => {
	const cleaned = word.toLowerCase().replace(/[^a-z]/g, "");
	if (!cleaned) return 0;
	const matches = cleaned.match(/[aeiouy]+/g);
	return matches ? matches.length : 1;
};

const ReadabilityTool = () => {
	const { t } = useI18n();
	const [input, setInput] = useState("");

	const stats = useMemo(() => {
		const text = input.trim();
		const words = text ? text.split(/\s+/).length : 0;
		const chars = input.length;
		const sentences = text ? (text.match(/[.!?]+/g) || []).length || 1 : 0;
		const syllables = text
			? text.split(/\s+/).reduce((acc, w) => acc + countSyllables(w), 0)
			: 0;
		const flesch = words
			? Math.round(206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words))
			: 0;
		const readingTime = words ? Math.ceil(words / 200) : 0;
		return { words, chars, sentences, syllables, flesch, readingTime };
	}, [input]);

	return (
		<div className="max-w-5xl mx-auto">
			<h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
				<BookOpen className="text-indigo-400" />{" "}
				{t("Readability Analyzer", "Phân tích độ dễ đọc")}
			</h2>

			<textarea
				value={input}
				onChange={(e) => setInput(e.target.value)}
				placeholder={t("Paste your text...", "Dán nội dung...")}
				className="w-full h-48 bg-dark-900 border border-dark-700 rounded-lg p-3 font-mono text-xs text-gray-200"
				spellCheck={false}
			/>

			<div className="grid md:grid-cols-3 gap-4 mt-4 text-sm">
				<div className="bg-dark-800 border border-dark-700 rounded-lg p-3">
					{t("Words", "Từ")}: {stats.words}
				</div>
				<div className="bg-dark-800 border border-dark-700 rounded-lg p-3">
					{t("Characters", "Ký tự")}: {stats.chars}
				</div>
				<div className="bg-dark-800 border border-dark-700 rounded-lg p-3">
					{t("Sentences", "Câu")}: {stats.sentences}
				</div>
				<div className="bg-dark-800 border border-dark-700 rounded-lg p-3">
					{t("Syllables", "Âm tiết")}: {stats.syllables}
				</div>
				<div className="bg-dark-800 border border-dark-700 rounded-lg p-3">
					{t("Flesch score", "Điểm Flesch")}: {stats.flesch}
				</div>
				<div className="bg-dark-800 border border-dark-700 rounded-lg p-3">
					{t("Reading time", "Thời gian đọc")}: {stats.readingTime}{" "}
					{t("min", "phút")}
				</div>
			</div>
		</div>
	);
};

export default ReadabilityTool;
