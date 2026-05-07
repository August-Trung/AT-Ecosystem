import React, { useState } from "react";
import { Braces, Check, Copy, Trash2, AlertTriangle } from "lucide-react";
import { useI18n } from "../i18n";

const trimTrailingComma = (value: string) => value.replace(/,+$/, "").trim();

const parseInlinePair = (line: string) => {
	const match = line.match(/^([^:]+?)\s*:\s*(.*)$/);
	if (!match) return null;
	return {
		key: trimTrailingComma(match[1]),
		value: trimTrailingComma(match[2]),
	};
};

const transformLines = (raw: string) => {
	const lines = raw
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0);

	const result: string[] = [];
	let i = 0;

	while (i < lines.length) {
		const line = lines[i];
		if (line === ":") {
			i += 1;
			continue;
		}

		const inline = parseInlinePair(line);
		if (inline) {
			if (inline.value) {
				result.push(`${inline.key}:${inline.value ? ` ${inline.value}` : ""}`.trimEnd());
				i += 1;
				continue;
			}

			const next = lines[i + 1] === ":" ? lines[i + 2] : lines[i + 1];
			if (next !== undefined) {
				result.push(`${inline.key}:${next ? ` ${trimTrailingComma(next)}` : ""}`.trimEnd());
				i += lines[i + 1] === ":" ? 3 : 2;
				continue;
			}
		}

		if (lines[i + 1] === ":" && lines[i + 2] !== undefined) {
			const combinedValue = trimTrailingComma(lines[i + 2]);
			result.push(
				`${trimTrailingComma(line)}:${combinedValue ? ` ${combinedValue}` : ""}`.trimEnd()
			);
			i += 3;
			continue;
		}

		if (lines[i + 1] !== undefined && lines[i + 1] !== ":") {
			const combinedValue = trimTrailingComma(lines[i + 1]);
			result.push(
				`${trimTrailingComma(line)}:${combinedValue ? ` ${combinedValue}` : ""}`.trimEnd()
			);
			i += 2;
			continue;
		}

		result.push(trimTrailingComma(line));
		i += 1;
	}

	return result.join("\n");
};

const parseValue = (value: string) => {
	const trimmed = value.trim();
	if (trimmed === "null") return null;
	if (trimmed === "true") return true;
	if (trimmed === "false") return false;
	if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
	if (
		(trimmed.startsWith('"') && trimmed.endsWith('"')) ||
		(trimmed.startsWith("'") && trimmed.endsWith("'"))
	) {
		return trimmed.slice(1, -1);
	}
	return trimmed;
};

const linesToObject = (raw: string) => {
	const lines = raw
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0);

	const result: Record<string, unknown> = {};
	let i = 0;

	while (i < lines.length) {
		const line = lines[i];
		if (line === ":") {
			i += 1;
			continue;
		}

		const inline = parseInlinePair(line);
		if (inline) {
			if (inline.value) {
				result[inline.key] = parseValue(inline.value);
				i += 1;
				continue;
			}

			const next = lines[i + 1] === ":" ? lines[i + 2] : lines[i + 1];
			if (next !== undefined) {
				result[inline.key] = parseValue(trimTrailingComma(next));
				i += lines[i + 1] === ":" ? 3 : 2;
				continue;
			}
		}

		if (lines[i + 1] === ":" && lines[i + 2] !== undefined) {
			result[trimTrailingComma(line)] = parseValue(
				trimTrailingComma(lines[i + 2])
			);
			i += 3;
			continue;
		}

		if (lines[i + 1] !== undefined && lines[i + 1] !== ":") {
			result[trimTrailingComma(line)] = parseValue(
				trimTrailingComma(lines[i + 1])
			);
			i += 2;
			continue;
		}

		i += 1;
	}

	return result;
};

const KeyValueLineFormatter = () => {
	const { t } = useI18n();
	const [input, setInput] = useState("");
	const [output, setOutput] = useState("");
	const [copied, setCopied] = useState(false);
	const [error, setError] = useState("");
	const [jsonCompact, setJsonCompact] = useState(true);

	const transform = () => {
		setError("");
		setOutput(transformLines(input));
	};

	const formatJson = () => {
		if (!input.trim()) return;
		setError("");
		try {
			const obj = JSON.parse(input);
			setOutput(JSON.stringify(obj, null, jsonCompact ? 0 : 2));
			setJsonCompact(!jsonCompact);
		} catch (e: any) {
			setError(e?.message || "Invalid JSON");
		}
	};

	const linesToJson = () => {
		if (!input.trim()) return;
		setError("");
		try {
			const obj = linesToObject(input);
			setOutput(JSON.stringify(obj, null, 2));
		} catch (e: any) {
			setError(e?.message || "Invalid input");
		}
	};

	const copy = () => {
		navigator.clipboard.writeText(output);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<div className="max-w-5xl mx-auto h-[calc(100vh-140px)] flex flex-col">
			<div className="flex justify-between items-center mb-4">
				<h2 className="text-2xl font-bold flex items-center gap-2">
					<Braces className="text-emerald-400" />{" "}
					{t("Key : Value Line Formatter", "Chuẩn hóa dòng key : value")}
				</h2>

				<div className="flex gap-2">
					<button
						onClick={linesToJson}
						className="px-3 py-2 bg-dark-800 border border-dark-600 hover:border-cyan-400 rounded-lg text-sm font-bold text-gray-300 transition-colors"
					>
						{t("Lines → JSON", "Dòng → JSON")}
					</button>
					<button
						onClick={formatJson}
						className="px-3 py-2 bg-dark-800 border border-dark-600 hover:border-blue-400 rounded-lg text-sm font-bold text-gray-300 transition-colors"
					>
						{jsonCompact
							? t("JSON One Line", "JSON 1 dòng")
							: t("JSON Pretty", "JSON đẹp")}
					</button>
					<button
						onClick={transform}
						className="px-3 py-2 bg-dark-800 border border-dark-600 hover:border-emerald-400 rounded-lg text-sm font-bold text-gray-300 transition-colors"
					>
						{t("Transform", "Biến đổi")}
					</button>
					<button
						onClick={() => {
							setInput("");
							setOutput("");
						}}
						className="px-3 py-2 bg-dark-800 border border-dark-600 hover:border-red-400 rounded-lg text-sm font-bold text-gray-300 transition-colors"
					>
						<Trash2 size={14} className="inline-block mr-1" />
						{t("Clear", "Xóa")}
					</button>
				</div>
			</div>

			<div className="flex-1 grid md:grid-cols-2 gap-6 min-h-0">
				<div className="flex flex-col h-full">
					<label className="text-sm font-bold text-gray-500 mb-2">
						{t("Raw Input", "Dữ liệu vào")}
					</label>
					<textarea
						value={input}
						onChange={(e) => setInput(e.target.value)}
						placeholder={t(
							"Paste lines like key, ':', value on separate lines...",
							"Dán dữ liệu có dạng key, ':', value trên từng dòng..."
						)}
						className="flex-1 bg-dark-800 border border-dark-700 rounded-xl p-4 text-xs font-mono text-gray-300 focus:outline-none resize-none focus:border-emerald-400/60"
						spellCheck={false}
					/>
				</div>

				<div className="flex flex-col h-full">
					<div className="flex justify-between items-center mb-2">
						<label className="text-sm font-bold text-gray-500">
							{t("Formatted Output", "Kết quả")}
						</label>
						<button
							onClick={copy}
							disabled={!output}
							className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 disabled:opacity-50"
						>
							{copied ? <Check size={12} /> : <Copy size={12} />}
							{copied ? t("Copied", "Đã sao chép") : t("Copy", "Sao chép")}
						</button>
					</div>
					<textarea
						readOnly
						value={output}
						placeholder={t("Result...", "Kết quả...")}
						className="flex-1 bg-dark-900 border border-dark-700 rounded-xl p-4 text-xs font-mono text-emerald-300 focus:outline-none resize-none"
						spellCheck={false}
					/>
				</div>
			</div>
			{error && (
				<div className="mt-3 text-xs text-red-400 flex items-center gap-2">
					<AlertTriangle size={12} /> {error}
				</div>
			)}
		</div>
	);
};

export default KeyValueLineFormatter;
