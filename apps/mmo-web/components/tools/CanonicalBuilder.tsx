import React, { useState } from "react";
import { Link2, Copy, Check } from "lucide-react";
import { useI18n } from "../i18n";

const CanonicalBuilder = () => {
	const { t } = useI18n();
	const [canonical, setCanonical] = useState("https://example.com/page");
	const [hreflang, setHreflang] = useState("en|https://example.com/en\nvi|https://example.com/vi");
	const [copied, setCopied] = useState(false);

	const lines = hreflang
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter(Boolean);

	const tags = [
		`<link rel="canonical" href="${canonical}" />`,
		...lines.map((line) => {
			const [lang, url] = line.split("|").map((v) => v.trim());
			return lang && url ? `<link rel="alternate" hreflang="${lang}" href="${url}" />` : "";
		}),
	]
		.filter(Boolean)
		.join("\n");

	const copy = () => {
		navigator.clipboard.writeText(tags);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<div className="max-w-4xl mx-auto">
			<h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
				<Link2 className="text-purple-400" />{" "}
				{t("Canonical & Hreflang", "Canonical & Hreflang")}
			</h2>

			<div className="bg-dark-800 border border-dark-700 rounded-xl p-4 space-y-4">
				<div>
					<label className="text-sm font-bold text-gray-400">
						{t("Canonical URL", "Canonical URL")}
					</label>
					<input
						value={canonical}
						onChange={(e) => setCanonical(e.target.value)}
						className="w-full mt-2 bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-gray-200"
					/>
				</div>
				<div>
					<label className="text-sm font-bold text-gray-400">
						{t("Hreflang list (lang|url)", "Danh sách hreflang (lang|url)")}
					</label>
					<textarea
						value={hreflang}
						onChange={(e) => setHreflang(e.target.value)}
						className="w-full h-28 mt-2 bg-dark-900 border border-dark-700 rounded-lg p-3 font-mono text-xs text-gray-200"
						spellCheck={false}
					/>
				</div>
				<button
					onClick={copy}
					className="px-4 py-2 bg-purple-500 text-black font-bold rounded-lg hover:bg-purple-400 flex items-center gap-2"
				>
					{copied ? <Check size={14} /> : <Copy size={14} />}{" "}
					{copied ? t("Copied", "Đã sao chép") : t("Copy tags", "Sao chép tags")}
				</button>
			</div>

			<div className="mt-6 bg-dark-900 border border-dark-700 rounded-xl p-4">
				<label className="text-sm font-bold text-gray-400">
					{t("Output tags", "Kết quả")}
				</label>
				<textarea
					readOnly
					value={tags}
					className="w-full h-40 mt-2 bg-dark-800 border border-dark-700 rounded-lg p-3 font-mono text-xs text-purple-300"
				/>
			</div>
		</div>
	);
};

export default CanonicalBuilder;
