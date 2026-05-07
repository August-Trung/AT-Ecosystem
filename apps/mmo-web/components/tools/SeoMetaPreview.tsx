import React, { useState } from "react";
import { Megaphone, Image as ImageIcon } from "lucide-react";
import { useI18n } from "../i18n";

const SeoMetaPreview = () => {
	const { t } = useI18n();
	const [title, setTitle] = useState("AT Tools - All-in-one Toolkit");
	const [description, setDescription] = useState(
		"Fast utilities for dev, SEO, content and more."
	);
	const [url, setUrl] = useState("https://example.com/page");
	const [site, setSite] = useState("AT Tools");
	const [image, setImage] = useState("https://example.com/preview.jpg");

	return (
		<div className="max-w-5xl mx-auto">
			<h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
				<Megaphone className="text-orange-400" />{" "}
				{t("SEO Meta Preview", "Xem trước SEO")}
			</h2>

			<div className="grid md:grid-cols-2 gap-6">
				<div className="bg-dark-800 border border-dark-700 rounded-xl p-4 space-y-3">
					<input
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						placeholder={t("Title", "Tiêu đề")}
						className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-gray-200"
					/>
					<textarea
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						placeholder={t("Description", "Mô tả")}
						className="w-full h-24 bg-dark-900 border border-dark-700 rounded-lg p-3 text-gray-200"
					/>
					<input
						value={url}
						onChange={(e) => setUrl(e.target.value)}
						placeholder={t("URL", "URL")}
						className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-gray-200"
					/>
					<input
						value={site}
						onChange={(e) => setSite(e.target.value)}
						placeholder={t("Site name", "Tên site")}
						className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-gray-200"
					/>
					<input
						value={image}
						onChange={(e) => setImage(e.target.value)}
						placeholder={t("Preview image URL", "URL ảnh preview")}
						className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-gray-200"
					/>
				</div>

				<div className="space-y-4">
					<div className="bg-dark-900 border border-dark-700 rounded-xl p-4">
						<div className="text-xs text-gray-500">{url}</div>
						<div className="text-lg font-bold text-orange-300 mt-1">
							{title}
						</div>
						<div className="text-sm text-gray-400 mt-2">{description}</div>
						<div className="text-xs text-gray-500 mt-3">{site}</div>
					</div>

					<div className="bg-dark-900 border border-dark-700 rounded-xl overflow-hidden">
						<div className="h-40 bg-dark-800 flex items-center justify-center text-gray-500">
							{image ? (
								<img src={image} alt="preview" className="h-full w-full object-cover" />
							) : (
								<ImageIcon />
							)}
						</div>
						<div className="p-4">
							<div className="text-xs text-gray-500">{url}</div>
							<div className="text-sm font-bold text-gray-200 mt-1">
								{title}
							</div>
							<div className="text-xs text-gray-400 mt-1">{description}</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default SeoMetaPreview;
