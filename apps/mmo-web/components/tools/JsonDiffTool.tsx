import React, { useState } from "react";
import { GitCompare, AlertTriangle } from "lucide-react";
import { useI18n } from "../i18n";

type DiffItem = {
	path: string;
	type: "added" | "removed" | "changed";
	before?: any;
	after?: any;
};

const diffJson = (a: any, b: any, path = "$"): DiffItem[] => {
	const diffs: DiffItem[] = [];
	if (a === b) return diffs;

	const isObj = (v: any) => v && typeof v === "object" && !Array.isArray(v);
	const isArr = (v: any) => Array.isArray(v);

	if (isObj(a) && isObj(b)) {
		const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
		keys.forEach((key) => {
			const nextPath = `${path}.${key}`;
			if (!(key in a)) {
				diffs.push({ path: nextPath, type: "added", after: b[key] });
				return;
			}
			if (!(key in b)) {
				diffs.push({ path: nextPath, type: "removed", before: a[key] });
				return;
			}
			diffs.push(...diffJson(a[key], b[key], nextPath));
		});
		return diffs;
	}

	if (isArr(a) && isArr(b)) {
		const max = Math.max(a.length, b.length);
		for (let i = 0; i < max; i += 1) {
			const nextPath = `${path}[${i}]`;
			if (i >= a.length) {
				diffs.push({ path: nextPath, type: "added", after: b[i] });
				continue;
			}
			if (i >= b.length) {
				diffs.push({ path: nextPath, type: "removed", before: a[i] });
				continue;
			}
			diffs.push(...diffJson(a[i], b[i], nextPath));
		}
		return diffs;
	}

	diffs.push({ path, type: "changed", before: a, after: b });
	return diffs;
};

const JsonDiffTool = () => {
	const { t } = useI18n();
	const [left, setLeft] = useState("");
	const [right, setRight] = useState("");
	const [diffs, setDiffs] = useState<DiffItem[]>([]);
	const [error, setError] = useState("");

	const compare = () => {
		setError("");
		setDiffs([]);
		try {
			const a = JSON.parse(left);
			const b = JSON.parse(right);
			setDiffs(diffJson(a, b));
		} catch (e: any) {
			setError(e.message || "Invalid JSON");
		}
	};

	return (
		<div className="max-w-5xl mx-auto">
			<h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
				<GitCompare className="text-orange-400" />{" "}
				{t("JSON Diff", "So sánh JSON")}
			</h2>

			<div className="grid md:grid-cols-2 gap-6">
				<div>
					<label className="text-sm font-bold text-gray-400">
						{t("JSON A", "JSON A")}
					</label>
					<textarea
						value={left}
						onChange={(e) => setLeft(e.target.value)}
						placeholder={t("Paste JSON here...", "Dán JSON vào đây...")}
						className="w-full h-56 mt-2 bg-dark-900 border border-dark-700 rounded-lg p-3 font-mono text-xs text-gray-200"
						spellCheck={false}
					/>
				</div>
				<div>
					<label className="text-sm font-bold text-gray-400">
						{t("JSON B", "JSON B")}
					</label>
					<textarea
						value={right}
						onChange={(e) => setRight(e.target.value)}
						placeholder={t("Paste JSON here...", "Dán JSON vào đây...")}
						className="w-full h-56 mt-2 bg-dark-900 border border-dark-700 rounded-lg p-3 font-mono text-xs text-gray-200"
						spellCheck={false}
					/>
				</div>
			</div>

			<button
				onClick={compare}
				className="mt-4 px-6 py-2 bg-orange-500 text-black font-bold rounded-lg hover:bg-orange-400"
			>
				{t("Compare", "So sánh")}
			</button>

			{error && (
				<div className="mt-4 text-sm text-red-400 flex items-center gap-2">
					<AlertTriangle size={14} /> {error}
				</div>
			)}

			<div className="mt-6 bg-dark-800 border border-dark-700 rounded-xl p-4">
				<h3 className="text-sm font-bold text-gray-400">
					{t("Differences", "Khác biệt")} ({diffs.length})
				</h3>
				{diffs.length === 0 ? (
					<p className="text-xs text-gray-500 mt-2">
						{t("No differences found.", "Không có khác biệt.")}
					</p>
				) : (
					<div className="mt-3 space-y-2">
						{diffs.map((item) => (
							<div
								key={`${item.path}-${item.type}`}
								className="bg-dark-900 border border-dark-700 rounded-lg p-3 text-xs">
								<div className="text-gray-400">
									<span className="text-orange-300">{item.path}</span>{" "}
									- {item.type}
								</div>
								{item.before !== undefined && (
									<div className="mt-1 text-red-300">
										{t("Before", "Trước")}:{" "}
										<span className="font-mono">
											{JSON.stringify(item.before)}
										</span>
									</div>
								)}
								{item.after !== undefined && (
									<div className="mt-1 text-green-300">
										{t("After", "Sau")}:{" "}
										<span className="font-mono">
											{JSON.stringify(item.after)}
										</span>
									</div>
								)}
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
};

export default JsonDiffTool;
