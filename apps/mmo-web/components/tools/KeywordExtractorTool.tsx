import React, { useMemo, useState } from "react";
import { Filter, Copy, Check } from "lucide-react";
import { useI18n } from "../i18n";

const STOPWORDS = new Set([
	"the",
	"and",
	"for",
	"with",
	"that",
	"this",
	"from",
	"are",
	"was",
	"were",
	"you",
	"your",
	"have",
	"has",
	"had",
	"but",
	"not",
	"can",
	"will",
	"just",
	"into",
	"onto",
	"than",
	"then",
	"them",
	"they",
	"she",
	"his",
	"her",
	"our",
	"out",
	"all",
	"any",
]);

const KeywordExtractorTool = () => {
	const { t } = useI18n();
	const [input, setInput] = useState("");
	const [count, setCount] = useState(10);
	const [copied, setCopied] = useState(false);

	const keywords = useMemo(() => {
		const tokens = input
			.toLowerCase()
			.replace(/[^a-z0-9\s]/g, " ")
			.split(/\s+/)
			.filter((w) => w.length > 2 && !STOPWORDS.has(w));
		const freq = new Map<string, number>();
		tokens.forEach((w) => freq.set(w, (freq.get(w) || 0) + 1));
		return Array.from(freq.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, count);
	}, [input, count]);

	const copy = () => {
		navigator.clipboard.writeText(keywords.map(([k]) => k).join(", "));
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<div className="max-w-5xl mx-auto">
			<h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
				<Filter className="text-green-400" />{" "}
				{t("Keyword Extractor", "Tách từ khóa")}
			</h2>

			<textarea
				value={input}
				onChange={(e) => setInput(e.target.value)}
				placeholder={t("Paste text...", "Dán nội dung...")}
				className="w-full h-40 bg-dark-900 border border-dark-700 rounded-lg p-3 font-mono text-xs text-gray-200"
				spellCheck={false}
			/>

			<div className="mt-3 flex items-center gap-3 text-sm">
				<label className="text-gray-400">
					{t("Top", "Top")}{" "}
					<input
						type="number"
						min={3}
						max={50}
						value={count}
						onChange={(e) => setCount(Number(e.target.value))}
						className="w-16 ml-2 bg-dark-900 border border-dark-700 rounded px-2 py-1 text-gray-200"
					/>
				</label>
				<button
					onClick={copy}
					disabled={keywords.length === 0}
					className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1 disabled:opacity-50"
				>
					{copied ? <Check size={12} /> : <Copy size={12} />}{" "}
					{t("Copy", "Sao chép")}
				</button>
			</div>

			<div className="mt-4 bg-dark-800 border border-dark-700 rounded-xl p-4">
				{keywords.length === 0 ? (
					<p className="text-xs text-gray-500">
						{t("No keywords yet.", "Chưa có từ khóa.")}
					</p>
				) : (
					<div className="grid md:grid-cols-2 gap-2 text-sm">
						{keywords.map(([word, freq]) => (
							<div
								key={word}
								className="bg-dark-900 border border-dark-700 rounded-lg p-2 flex justify-between"
							>
								<span className="text-green-300">{word}</span>
								<span className="text-gray-500">{freq}</span>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
};

export default KeywordExtractorTool;
