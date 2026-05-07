import React from "react";
import { Settings, Languages, Moon, Sun, Minimize2 } from "lucide-react";
import { useI18n } from "../i18n";
import { useSettings } from "../settings";

const SettingsPage = () => {
	const { lang, setLang, t } = useI18n();
	const { theme, setTheme, compact, setCompact } = useSettings();

	return (
		<div className="max-w-3xl mx-auto">
			<h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
				<Settings className="text-neon-cyan" /> {t("Settings", "Cài đặt")}
			</h2>

			<div className="space-y-6">
				<div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
					<h3 className="text-sm font-bold text-gray-400 flex items-center gap-2">
						<Languages size={16} /> {t("Language", "Ngôn ngữ")}
					</h3>
					<div className="mt-3 flex gap-2">
						<button
							onClick={() => setLang("en")}
							className={`px-4 py-2 rounded-lg text-sm font-bold ${
								lang === "en"
									? "bg-neon-cyan text-black"
									: "bg-dark-900 border border-dark-700 text-gray-300"
							}`}
						>
							English
						</button>
						<button
							onClick={() => setLang("vi")}
							className={`px-4 py-2 rounded-lg text-sm font-bold ${
								lang === "vi"
									? "bg-neon-cyan text-black"
									: "bg-dark-900 border border-dark-700 text-gray-300"
							}`}
						>
							Tiếng Việt
						</button>
					</div>
				</div>

				<div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
					<h3 className="text-sm font-bold text-gray-400 flex items-center gap-2">
						{theme === "light" ? <Sun size={16} /> : <Moon size={16} />}{" "}
						{t("Theme", "Giao diện")}
					</h3>
					<div className="mt-3 flex gap-2">
						<button
							onClick={() => setTheme("dark")}
							className={`px-4 py-2 rounded-lg text-sm font-bold ${
								theme === "dark"
									? "bg-neon-cyan text-black"
									: "bg-dark-900 border border-dark-700 text-gray-300"
							}`}
						>
							{t("Dark", "Tối")}
						</button>
						<button
							onClick={() => setTheme("light")}
							className={`px-4 py-2 rounded-lg text-sm font-bold ${
								theme === "light"
									? "bg-neon-cyan text-black"
									: "bg-dark-900 border border-dark-700 text-gray-300"
							}`}
						>
							{t("Light", "Sáng")}
						</button>
					</div>
					<p className="text-xs text-gray-500 mt-2">
						{t(
							"Light mode changes the background for easier reading.",
							"Chế độ sáng đổi nền để dễ đọc hơn."
						)}
					</p>
				</div>

				<div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
					<h3 className="text-sm font-bold text-gray-400 flex items-center gap-2">
						<Minimize2 size={16} /> {t("Compact Mode", "Chế độ gọn")}
					</h3>
					<label className="mt-3 flex items-center gap-2 text-sm text-gray-300">
						<input
							type="checkbox"
							checked={compact}
							onChange={(e) => setCompact(e.target.checked)}
						/>
						{t("Reduce padding and spacing", "Giảm padding và khoảng cách")}
					</label>
				</div>
			</div>
		</div>
	);
};

export default SettingsPage;
