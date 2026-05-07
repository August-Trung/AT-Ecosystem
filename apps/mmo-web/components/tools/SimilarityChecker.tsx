import React, { useMemo, useState } from "react";
import { GitCompare } from "lucide-react";
import { useI18n } from "../i18n";

const grams = (text: string, size: number) => {
	const cleaned = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
	const tokens = cleaned.split(/\s+/).filter(Boolean);
	const joined = tokens.join(" ");
	const out = new Set<string>();
	for (let i = 0; i <= joined.length - size; i += 1) {
		out.add(joined.slice(i, i + size));
	}
	return out;
};

const jaccard = (a: Set<string>, b: Set<string>) => {
	if (a.size === 0 && b.size === 0) return 1;
	let inter = 0;
	a.forEach((v) => {
		if (b.has(v)) inter += 1;
	});
	const union = a.size + b.size - inter;
	return union === 0 ? 0 : inter / union;
};

const SimilarityChecker = () => {
	const { t } = useI18n();
	const [left, setLeft] = useState("");
	const [right, setRight] = useState("");

	const score = useMemo(() => {
		const a = grams(left, 3);
		const b = grams(right, 3);
		return Math.round(jaccard(a, b) * 100);
	}, [left, right]);

	return (
		<div className="max-w-5xl mx-auto">
			<h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
				<GitCompare className="text-orange-400" />{" "}
				{t("Similarity Checker", "Kiểm tra tương đồng")}
			</h2>

			<div className="grid md:grid-cols-2 gap-6">
				<textarea
					value={left}
					onChange={(e) => setLeft(e.target.value)}
					placeholder={t("Text A", "Văn bản A")}
					className="w-full h-48 bg-dark-900 border border-dark-700 rounded-lg p-3 font-mono text-xs text-gray-200"
					spellCheck={false}
				/>
				<textarea
					value={right}
					onChange={(e) => setRight(e.target.value)}
					placeholder={t("Text B", "Văn bản B")}
					className="w-full h-48 bg-dark-900 border border-dark-700 rounded-lg p-3 font-mono text-xs text-gray-200"
					spellCheck={false}
				/>
			</div>

			<div className="mt-6 bg-dark-800 border border-dark-700 rounded-xl p-4 text-sm">
				<div className="text-gray-400">
					{t("Jaccard similarity (3-grams)", "Tương đồng Jaccard (3-grams)")}:{" "}
					<span className="text-orange-300 font-mono">{score}%</span>
				</div>
				<div className="text-xs text-gray-500 mt-2">
					{t(
						"Offline heuristic only, not a plagiarism detector.",
						"Chỉ là ước lượng offline, không phải kiểm tra đạo văn."
					)}
				</div>
			</div>
		</div>
	);
};

export default SimilarityChecker;
