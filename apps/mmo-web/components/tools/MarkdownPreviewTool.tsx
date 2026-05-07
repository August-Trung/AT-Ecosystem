import React, { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { useI18n } from "../i18n";

const MarkdownPreviewTool = () => {
	const { t } = useI18n();
	const [input, setInput] = useState("# Hello\n\nWrite **Markdown** here.");
	const [html, setHtml] = useState("");

	useEffect(() => {
		const marked = (window as any).marked;
		if (marked && typeof marked.parse === "function") {
			setHtml(marked.parse(input));
		} else {
			setHtml(input);
		}
	}, [input]);

	return (
		<div className="max-w-5xl mx-auto">
			<h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
				<FileText className="text-yellow-400" />{" "}
				{t("Markdown Preview", "Xem trước Markdown")}
			</h2>

			<div className="grid md:grid-cols-2 gap-6">
				<div>
					<label className="text-sm font-bold text-gray-400">
						{t("Markdown Input", "Nội dung Markdown")}
					</label>
					<textarea
						value={input}
						onChange={(e) => setInput(e.target.value)}
						className="w-full h-72 mt-2 bg-dark-900 border border-dark-700 rounded-lg p-3 font-mono text-xs text-gray-200"
						spellCheck={false}
					/>
				</div>
				<div>
					<label className="text-sm font-bold text-gray-400">
						{t("Preview", "Xem trước")}
					</label>
					<div className="mt-2 h-72 overflow-auto bg-dark-900 border border-dark-700 rounded-lg p-4 markdown-preview">
						<div dangerouslySetInnerHTML={{ __html: html }} />
					</div>
					<div className="text-xs text-gray-500 mt-2">
						{t(
							"Uses marked.js from index.html.",
							"Sử dụng marked.js từ index.html."
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default MarkdownPreviewTool;
