import React, { useState } from "react";
import { Fingerprint, CheckCircle2, XCircle } from "lucide-react";
import { useI18n } from "../i18n";

const uuidRegex =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const UuidTool = () => {
	const { t } = useI18n();
	const [input, setInput] = useState("");

	const isValid = uuidRegex.test(input.trim());
	const version = isValid ? input.trim()[14] : "";
	const variant = isValid ? input.trim()[19] : "";

	return (
		<div className="max-w-4xl mx-auto">
			<h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
				<Fingerprint className="text-cyan-400" />{" "}
				{t("UUID Validator", "Kiểm tra UUID")}
			</h2>

			<div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
				<input
					value={input}
					onChange={(e) => setInput(e.target.value)}
					placeholder={t("Paste UUID here...", "Dán UUID vào đây...")}
					className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-gray-200 font-mono"
				/>

				<div className="mt-4 flex items-center gap-2 text-sm">
					{isValid ? (
						<>
							<CheckCircle2 className="text-green-400" size={18} />
							<span className="text-green-400">{t("Valid UUID", "UUID hợp lệ")}</span>
						</>
					) : (
						<>
							<XCircle className="text-red-400" size={18} />
							<span className="text-red-400">{t("Invalid UUID", "UUID không hợp lệ")}</span>
						</>
					)}
				</div>

				{isValid && (
					<div className="mt-4 grid md:grid-cols-2 gap-4 text-sm">
						<div className="bg-dark-900 border border-dark-700 rounded-lg p-3">
							<div className="text-gray-500">{t("Version", "Phiên bản")}</div>
							<div className="text-cyan-300 font-mono">v{version}</div>
						</div>
						<div className="bg-dark-900 border border-dark-700 rounded-lg p-3">
							<div className="text-gray-500">{t("Variant", "Biến thể")}</div>
							<div className="text-cyan-300 font-mono">{variant}</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
};

export default UuidTool;
