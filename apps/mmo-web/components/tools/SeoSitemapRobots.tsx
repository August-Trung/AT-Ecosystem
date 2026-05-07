import React, { useState } from "react";
import { FileText, Copy, Check } from "lucide-react";
import { useI18n } from "../i18n";

const SeoSitemapRobots = () => {
	const { t } = useI18n();
	const [baseUrl, setBaseUrl] = useState("https://example.com");
	const [paths, setPaths] = useState("/\n/about\n/blog\n/contact");
	const [copied, setCopied] = useState("");

	const urlList = paths
		.split(/\r?\n/)
		.map((p) => p.trim())
		.filter(Boolean)
		.map((p) => (p.startsWith("http") ? p : `${baseUrl.replace(/\/$/, "")}${p}`));

	const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlList
		.map((url) => `  <url>\n    <loc>${url}</loc>\n  </url>`)
		.join("\n")}\n</urlset>`;

	const robots = `User-agent: *\nAllow: /\nSitemap: ${baseUrl.replace(/\/$/, "")}/sitemap.xml`;

	const copy = (value: string, key: string) => {
		navigator.clipboard.writeText(value);
		setCopied(key);
		setTimeout(() => setCopied(""), 2000);
	};

	return (
		<div className="max-w-5xl mx-auto">
			<h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
				<FileText className="text-blue-400" />{" "}
				{t("Sitemap & Robots", "Sitemap & Robots")}
			</h2>

			<div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
				<label className="text-sm font-bold text-gray-400">
					{t("Base URL", "URL gốc")}
				</label>
				<input
					value={baseUrl}
					onChange={(e) => setBaseUrl(e.target.value)}
					className="w-full mt-2 bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-gray-200"
				/>
				<label className="text-sm font-bold text-gray-400 mt-4 block">
					{t("Paths (one per line)", "Danh sách path (mỗi dòng 1)")}
				</label>
				<textarea
					value={paths}
					onChange={(e) => setPaths(e.target.value)}
					className="w-full h-32 mt-2 bg-dark-900 border border-dark-700 rounded-lg p-3 font-mono text-xs text-gray-200"
					spellCheck={false}
				/>
			</div>

			<div className="grid md:grid-cols-2 gap-6 mt-6">
				<div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
					<div className="flex items-center justify-between mb-2">
						<h3 className="text-sm font-bold text-gray-400">sitemap.xml</h3>
						<button
							onClick={() => copy(sitemap, "sitemap")}
							className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
						>
							{copied === "sitemap" ? <Check size={12} /> : <Copy size={12} />}{" "}
							{t("Copy", "Sao chép")}
						</button>
					</div>
					<textarea
						readOnly
						value={sitemap}
						className="w-full h-48 bg-dark-900 border border-dark-700 rounded-lg p-3 font-mono text-xs text-blue-300"
					/>
				</div>
				<div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
					<div className="flex items-center justify-between mb-2">
						<h3 className="text-sm font-bold text-gray-400">robots.txt</h3>
						<button
							onClick={() => copy(robots, "robots")}
							className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
						>
							{copied === "robots" ? <Check size={12} /> : <Copy size={12} />}{" "}
							{t("Copy", "Sao chép")}
						</button>
					</div>
					<textarea
						readOnly
						value={robots}
						className="w-full h-48 bg-dark-900 border border-dark-700 rounded-lg p-3 font-mono text-xs text-blue-300"
					/>
				</div>
			</div>
		</div>
	);
};

export default SeoSitemapRobots;
