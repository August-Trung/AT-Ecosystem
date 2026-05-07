import React, { useMemo, useState } from "react";
import { FileText, Copy, Check } from "lucide-react";
import { useI18n } from "../i18n";

const parseEnv = (input: string) =>
	input
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line && !line.startsWith("#"));

const EnvManager = () => {
	const { t } = useI18n();
	const [input, setInput] = useState("");
	const [mask, setMask] = useState(true);
	const [copied, setCopied] = useState(false);

	const output = useMemo(() => {
		const lines = parseEnv(input);
		const map = new Map<string, string>();
		lines.forEach((line) => {
			const idx = line.indexOf("=");
			if (idx === -1) return;
			const key = line.slice(0, idx).trim();
			const value = line.slice(idx + 1).trim();
			map.set(key, value);
		});
		const sorted = Array.from(map.entries()).sort((a, b) =>
			a[0].localeCompare(b[0])
		);
		return sorted
			.map(([key, value]) => {
				if (!mask) return `${key}=${value}`;
				const masked =
					value.length <= 4 ? "****" : `${value.slice(0, 2)}****${value.slice(-2)}`;
				return `${key}=${masked}`;
			})
			.join("\n");
	}, [input, mask]);

	const copy = () => {
		navigator.clipboard.writeText(output);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<div className="max-w-5xl mx-auto">
			<h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
				<FileText className="text-emerald-400" />{" "}
				{t("ENV Manager", "Quản lý ENV")}
			</h2>

			<div className="grid md:grid-cols-2 gap-6">
				<div>
					<label className="text-sm font-bold text-gray-400">
						{t(".env Input", "Dữ liệu .env")}
					</label>
					<textarea
						value={input}
						onChange={(e) => setInput(e.target.value)}
						placeholder={t("Paste .env content...", "Dán nội dung .env...")}
						className="w-full h-56 mt-2 bg-dark-900 border border-dark-700 rounded-lg p-3 font-mono text-xs text-gray-200"
						spellCheck={false}
					/>
				</div>
				<div>
					<div className="flex items-center justify-between">
						<label className="text-sm font-bold text-gray-400">
							{t("Sorted Output", "Kết quả đã sắp xếp")}
						</label>
						<button
							onClick={copy}
							disabled={!output}
							className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 disabled:opacity-50"
						>
							{copied ? <Check size={12} /> : <Copy size={12} />}{" "}
							{t("Copy", "Sao chép")}
						</button>
					</div>
					<textarea
						readOnly
						value={output}
						className="w-full h-56 mt-2 bg-dark-900 border border-dark-700 rounded-lg p-3 font-mono text-xs text-emerald-300"
						spellCheck={false}
					/>
					<label className="mt-3 text-xs text-gray-400 flex items-center gap-2">
						<input
							type="checkbox"
							checked={mask}
							onChange={(e) => setMask(e.target.checked)}
						/>
						{t("Mask values", "Ẩn giá trị")}
					</label>
				</div>
			</div>
		</div>
	);
};

export default EnvManager;
