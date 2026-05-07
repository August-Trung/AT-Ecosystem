import React, { useState } from "react";
import { ExternalLink, AlertTriangle } from "lucide-react";
import { useI18n } from "../i18n";

const RedirectTester = () => {
	const { t } = useI18n();
	const [url, setUrl] = useState("");
	const [status, setStatus] = useState("");
	const [location, setLocation] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	const test = async () => {
		if (!url) return;
		setLoading(true);
		setError("");
		setStatus("");
		setLocation("");
		try {
			const res = await fetch(url, { redirect: "manual" });
			setStatus(`${res.status} ${res.statusText}`);
			setLocation(res.headers.get("Location") || "");
		} catch (e: any) {
			setError(e.message || "Request failed");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="max-w-4xl mx-auto">
			<h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
				<ExternalLink className="text-blue-400" />{" "}
				{t("Redirect Tester", "Kiểm tra chuyển hướng")}
			</h2>

			<div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
				<input
					value={url}
					onChange={(e) => setUrl(e.target.value)}
					placeholder={t("Enter URL...", "Nhập URL...")}
					className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-gray-200"
				/>
				<button
					onClick={test}
					disabled={loading}
					className="mt-3 px-4 py-2 bg-blue-500 text-black font-bold rounded-lg hover:bg-blue-400"
				>
					{loading ? t("Testing...", "Đang kiểm tra...") : t("Test", "Kiểm tra")}
				</button>
				{error && (
					<div className="mt-3 text-sm text-red-400 flex items-center gap-2">
						<AlertTriangle size={14} /> {error}
					</div>
				)}
			</div>

			<div className="mt-6 bg-dark-800 border border-dark-700 rounded-xl p-4 text-sm">
				<div className="text-gray-400">
					{t("Status", "Trạng thái")}:{" "}
					<span className="text-gray-200">{status || "-"}</span>
				</div>
				<div className="text-gray-400 mt-2">
					{t("Location", "Location")}:{" "}
					<span className="text-gray-200 break-all">{location || "-"}</span>
				</div>
				<div className="text-xs text-gray-500 mt-3">
					{t(
						"CORS rules may block some URLs in browser.",
						"CORS có thể chặn một số URL trên trình duyệt."
					)}
				</div>
			</div>
		</div>
	);
};

export default RedirectTester;
