import React, { useMemo, useState } from "react";
import { CheckCircle2, XCircle, ShieldCheck } from "lucide-react";
import { useI18n } from "../i18n";

const REQUIRED = ["og:title", "og:description", "og:image", "og:url"];

const SeoOgChecker = () => {
	const { t } = useI18n();
	const [html, setHtml] = useState("");

	const tags = useMemo(() => {
		if (!html.trim()) return {};
		try {
			const parser = new DOMParser();
			const doc = parser.parseFromString(html, "text/html");
			const metas = Array.from(doc.querySelectorAll("meta"));
			const map: Record<string, string> = {};
			metas.forEach((meta) => {
				const property = meta.getAttribute("property") || meta.getAttribute("name");
				const content = meta.getAttribute("content") || "";
				if (property) map[property] = content;
			});
			return map;
		} catch {
			return {};
		}
	}, [html]);

	const missing = REQUIRED.filter((key) => !tags[key]);

	return (
		<div className="max-w-5xl mx-auto">
			<h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
				<ShieldCheck className="text-emerald-400" />{" "}
				{t("Open Graph Checker", "Kiểm tra Open Graph")}
			</h2>

			<textarea
				value={html}
				onChange={(e) => setHtml(e.target.value)}
				placeholder={t("Paste HTML with meta tags...", "Dán HTML có meta tags...")}
				className="w-full h-48 bg-dark-900 border border-dark-700 rounded-lg p-3 font-mono text-xs text-gray-200"
				spellCheck={false}
			/>

			<div className="mt-6 bg-dark-800 border border-dark-700 rounded-xl p-4">
				<h3 className="text-sm font-bold text-gray-400">
					{t("Required Tags", "Tag bắt buộc")}
				</h3>
				<div className="mt-2 grid md:grid-cols-2 gap-2 text-sm">
					{REQUIRED.map((key) => (
						<div
							key={key}
							className="bg-dark-900 border border-dark-700 rounded-lg p-3 flex items-center gap-2"
						>
							{tags[key] ? (
								<CheckCircle2 className="text-green-400" size={16} />
							) : (
								<XCircle className="text-red-400" size={16} />
							)}
							<div className="flex-1">
								<div className="text-gray-200">{key}</div>
								<div className="text-xs text-gray-500 truncate">
									{tags[key] || t("Missing", "Thiếu")}
								</div>
							</div>
						</div>
					))}
				</div>
				{missing.length === 0 ? (
					<p className="mt-3 text-xs text-green-400">
						{t("All required tags are present.", "Đã đủ tag bắt buộc.")}
					</p>
				) : (
					<p className="mt-3 text-xs text-red-400">
						{t("Missing", "Thiếu")}: {missing.join(", ")}
					</p>
				)}
			</div>
		</div>
	);
};

export default SeoOgChecker;
