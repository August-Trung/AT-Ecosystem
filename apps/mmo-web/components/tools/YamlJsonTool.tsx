import React, { useState } from "react";
import { Braces, ArrowRightLeft, AlertTriangle } from "lucide-react";
import { useI18n } from "../i18n";

const toYaml = (obj: any, indent = 0): string => {
	const pad = "  ".repeat(indent);
	if (Array.isArray(obj)) {
		return obj
			.map((item) => `${pad}- ${toYaml(item, indent + 1).trimStart()}`)
			.join("\n");
	}
	if (obj && typeof obj === "object") {
		return Object.keys(obj)
			.map((key) => {
				const value = obj[key];
				if (value && typeof value === "object") {
					return `${pad}${key}:\n${toYaml(value, indent + 1)}`;
				}
				return `${pad}${key}: ${String(value)}`;
			})
			.join("\n");
	}
	return `${pad}${String(obj)}`;
};

const parseYamlBasic = (input: string) => {
	const lines = input
		.split(/\r?\n/)
		.filter((line) => line.trim() && !line.trim().startsWith("#"));
	const root: any = {};
	const stack: { indent: number; obj: any }[] = [{ indent: -1, obj: root }];

	lines.forEach((raw) => {
		const indent = raw.match(/^ */)?.[0].length || 0;
		const line = raw.trim();
		while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
			stack.pop();
		}
		const current = stack[stack.length - 1].obj;

		if (line.startsWith("- ")) {
			const value = line.slice(2).trim();
			if (!Array.isArray(current)) {
				throw new Error("YAML list requires an array context");
			}
			current.push(value);
			return;
		}

		const idx = line.indexOf(":");
		if (idx === -1) return;
		const key = line.slice(0, idx).trim();
		const value = line.slice(idx + 1).trim();
		if (value === "") {
			current[key] = {};
			stack.push({ indent, obj: current[key] });
		} else {
			current[key] = value;
		}
	});

	return root;
};

const YamlJsonTool = () => {
	const { t } = useI18n();
	const [mode, setMode] = useState<"yaml-json" | "json-yaml">("yaml-json");
	const [input, setInput] = useState("");
	const [output, setOutput] = useState("");
	const [error, setError] = useState("");

	const convert = () => {
		setError("");
		try {
			if (mode === "yaml-json") {
				const obj = parseYamlBasic(input);
				setOutput(JSON.stringify(obj, null, 2));
			} else {
				const obj = JSON.parse(input);
				setOutput(toYaml(obj));
			}
		} catch (e: any) {
			setError(e.message || "Invalid input");
			setOutput("");
		}
	};

	return (
		<div className="max-w-5xl mx-auto">
			<h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
				<Braces className="text-teal-400" /> {t("YAML ⇄ JSON", "YAML ⇄ JSON")}
			</h2>

			<div className="flex bg-dark-900 p-1 rounded-lg w-fit mb-4">
				<button
					onClick={() => setMode("yaml-json")}
					className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${
						mode === "yaml-json"
							? "bg-teal-500 text-black"
							: "text-gray-500 hover:text-gray-300"
					}`}
				>
					YAML → JSON
				</button>
				<button
					onClick={() => setMode("json-yaml")}
					className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${
						mode === "json-yaml"
							? "bg-teal-500 text-black"
							: "text-gray-500 hover:text-gray-300"
					}`}
				>
					JSON → YAML
				</button>
			</div>

			<div className="grid md:grid-cols-2 gap-6">
				<div>
					<label className="text-sm font-bold text-gray-400">
						{t("Input", "Dữ liệu vào")}
					</label>
					<textarea
						value={input}
						onChange={(e) => setInput(e.target.value)}
						placeholder={t("Paste YAML or JSON here...", "Dán YAML hoặc JSON vào đây...")}
						className="w-full h-56 mt-2 bg-dark-900 border border-dark-700 rounded-lg p-3 font-mono text-xs text-gray-200"
						spellCheck={false}
					/>
				</div>
				<div>
					<label className="text-sm font-bold text-gray-400">
						{t("Output", "Kết quả")}
					</label>
					<textarea
						readOnly
						value={output}
						className="w-full h-56 mt-2 bg-dark-900 border border-dark-700 rounded-lg p-3 font-mono text-xs text-teal-300"
						spellCheck={false}
					/>
				</div>
			</div>

			<button
				onClick={convert}
				className="mt-4 px-6 py-2 bg-teal-500 text-black font-bold rounded-lg hover:bg-teal-400 flex items-center gap-2"
			>
				<ArrowRightLeft size={16} /> {t("Convert", "Chuyển đổi")}
			</button>

			{error && (
				<div className="mt-3 text-sm text-red-400 flex items-center gap-2">
					<AlertTriangle size={14} /> {error}
				</div>
			)}
			<div className="text-xs text-gray-500 mt-2">
				{t(
					"Note: Basic YAML supported (simple key/value and lists).",
					"Lưu ý: Chỉ hỗ trợ YAML cơ bản (key/value, danh sách)."
				)}
			</div>
		</div>
	);
};

export default YamlJsonTool;
