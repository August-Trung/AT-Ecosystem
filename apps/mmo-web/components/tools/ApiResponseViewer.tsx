import React, { useState } from "react";
import { Braces, Copy, Check, AlertTriangle, Sparkles } from "lucide-react";
import { useI18n } from "../i18n";

const ApiResponseViewer = () => {
	const { t } = useI18n();
	const [input, setInput] = useState("");
	const [output, setOutput] = useState("");
	const [error, setError] = useState("");
	const [collapsed, setCollapsed] = useState(false);
	const [copied, setCopied] = useState(false);

	const format = (isCollapsed = false) => {
		setError("");
		if (!input.trim()) {
			setOutput("");
			return;
		}
		try {
			const parsed = JSON.parse(input);
			const formatted = JSON.stringify(parsed, null, isCollapsed ? 0 : 2);
			setOutput(formatted);
		} catch (e: any) {
			setError(e.message || "Invalid JSON");
			setOutput("");
		}
	};

	const copy = () => {
		navigator.clipboard.writeText(output);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<div className="max-w-5xl mx-auto">
			<h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
				<Braces className="text-cyan-400" />{" "}
				{t("API Response Viewer", "Trình xem API response")}
			</h2>

			<div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
				<textarea
					value={input}
					onChange={(e) => setInput(e.target.value)}
					placeholder={t("Paste API JSON response...", "Dán response JSON từ API...")}
					className="w-full h-40 bg-dark-900 border border-dark-700 rounded-lg p-3 font-mono text-xs text-gray-200"
					spellCheck={false}
				/>
				<div className="mt-3 flex flex-wrap gap-2 items-center">
					<button
						onClick={() => {
							setCollapsed(false);
							format(false);
						}}
						className="px-4 py-2 bg-cyan-500 text-black font-bold rounded-lg hover:bg-cyan-400 flex items-center gap-2"
					>
						<Sparkles size={16} /> {t("Beautify", "Làm đẹp")}
					</button>
					<button
						onClick={() => {
							setCollapsed(true);
							format(true);
						}}
						className="px-4 py-2 bg-dark-900 border border-dark-700 rounded-lg text-sm text-gray-300 hover:text-white"
					>
						{t("Collapse", "Rút gọn")}
					</button>
					<button
						onClick={copy}
						disabled={!output}
						className="px-4 py-2 bg-dark-900 border border-dark-700 rounded-lg text-sm text-gray-300 hover:text-white disabled:opacity-50 flex items-center gap-2"
					>
						{copied ? <Check size={14} /> : <Copy size={14} />}{" "}
						{copied ? t("Copied", "Đã sao chép") : t("Copy", "Sao chép")}
					</button>
				</div>
				{error && (
					<div className="mt-3 text-xs text-red-400 flex items-center gap-2">
						<AlertTriangle size={14} /> {error}
					</div>
				)}
			</div>

			<div className="mt-6 bg-dark-900 border border-dark-700 rounded-xl p-4">
				<label className="text-sm font-bold text-gray-400">
					{t("Formatted Output", "Kết quả")}
				</label>
				<textarea
					readOnly
					value={output}
					placeholder={t("Result...", "Kết quả...")}
					className="w-full h-56 mt-2 bg-dark-800 border border-dark-700 rounded-lg p-3 font-mono text-xs text-cyan-300"
					spellCheck={false}
				/>
				<div className="text-xs text-gray-500 mt-2">
					{collapsed
						? t("Collapsed view", "Đang ở chế độ rút gọn")
						: t("Pretty view", "Đang ở chế độ làm đẹp")}
				</div>
			</div>
		</div>
	);
};

export default ApiResponseViewer;
