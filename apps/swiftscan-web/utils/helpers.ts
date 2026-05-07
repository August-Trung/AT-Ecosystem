import { jsPDF } from "jspdf";
import { ImageFilter, ScannedImage } from "../types";

// Kiểm tra độ nét của ảnh bằng cách tính toán phương sai của Laplacian (đơn giản hóa)
export const checkImageClarity = (video: HTMLVideoElement): number => {
	const canvas = document.createElement("canvas");
	const size = 128; // Sample size nhỏ để đạt hiệu suất cao
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext("2d", { willReadFrequently: true });
	if (!ctx) return 0;

	// Vẽ trung tâm của video vào canvas
	const sx = (video.videoWidth - video.videoHeight) / 2;
	ctx.drawImage(
		video,
		sx,
		0,
		video.videoHeight,
		video.videoHeight,
		0,
		0,
		size,
		size,
	);

	const imageData = ctx.getImageData(0, 0, size, size);
	const data = imageData.data;

	// Chuyển sang thang xám và tính toán độ tương phản cục bộ
	let totalInertia = 0;
	let lastPixel = (data[0] + data[1] + data[2]) / 3;

	for (let i = 4; i < data.length; i += 4) {
		const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
		const diff = Math.abs(avg - lastPixel);
		totalInertia += diff;
		lastPixel = avg;
	}

	// Trả về điểm số dựa trên sự thay đổi cường độ pixel (độ chi tiết)
	return Math.min(100, (totalInertia / (size * size)) * 5);
};

export const applyFilterAndTransform = (
	imageUrl: string,
	filter: ImageFilter,
	rotation: number,
	signature?: string,
): Promise<string> => {
	return new Promise((resolve) => {
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.onload = () => {
			const canvas = document.createElement("canvas");
			const ctx = canvas.getContext("2d");
			if (!ctx) return resolve(imageUrl);

			const isVertical = rotation === 90 || rotation === 270;
			canvas.width = isVertical ? img.height : img.width;
			canvas.height = isVertical ? img.width : img.height;

			ctx.translate(canvas.width / 2, canvas.height / 2);
			ctx.rotate((rotation * Math.PI) / 180);

			if (filter === "bw") {
				ctx.filter = "contrast(200%) grayscale(100%) brightness(120%)";
			} else if (filter === "magic") {
				ctx.filter = "contrast(150%) saturate(150%) brightness(110%)";
			} else if (filter === "grayscale") {
				ctx.filter = "grayscale(100%)";
			}

			ctx.drawImage(img, -img.width / 2, -img.height / 2);

			ctx.filter = "none";
			ctx.setTransform(1, 0, 0, 1, 0, 0);

			if (signature) {
				const sigImg = new Image();
				sigImg.onload = () => {
					const sigW = canvas.width * 0.3;
					const sigH = (sigImg.height / sigImg.width) * sigW;
					ctx.drawImage(
						sigImg,
						canvas.width - sigW - 20,
						canvas.height - sigH - 20,
						sigW,
						sigH,
					);
					resolve(canvas.toDataURL("image/jpeg", 0.85));
				};
				sigImg.src = signature;
			} else {
				resolve(canvas.toDataURL("image/jpeg", 0.85));
			}
		};
		img.src = imageUrl;
	});
};

export const generatePDF = async (
	images: ScannedImage[],
	filename: string = "Scan",
	quality: number = 0.8,
) => {
	const pdf = new jsPDF("p", "mm", "a4");
	const pageWidth = pdf.internal.pageSize.getWidth();
	const pageHeight = pdf.internal.pageSize.getHeight();

	for (let i = 0; i < images.length; i++) {
		if (i > 0) pdf.addPage();

		const transformedUrl = await applyFilterAndTransform(
			images[i].url,
			images[i].filter,
			images[i].rotation,
			images[i].signature,
		);

		const img = await loadImage(transformedUrl);
		const imgRatio = img.width / img.height;
		const pageRatio = pageWidth / pageHeight;

		let finalWidth, finalHeight;
		if (imgRatio > pageRatio) {
			finalWidth = pageWidth - 20;
			finalHeight = finalWidth / imgRatio;
		} else {
			finalHeight = pageHeight - 20;
			finalWidth = finalHeight * imgRatio;
		}

		const x = (pageWidth - finalWidth) / 2;
		const y = (pageHeight - finalHeight) / 2;

		pdf.addImage(
			transformedUrl,
			"JPEG",
			x,
			y,
			finalWidth,
			finalHeight,
			undefined,
			quality > 0.8 ? "SLOW" : "FAST",
		);
	}

	return pdf;
};

export const mergeIDCard = async (
	frontUrl: string,
	backUrl: string,
): Promise<string> => {
	const canvas = document.createElement("canvas");
	const ctx = canvas.getContext("2d");
	if (!ctx) return frontUrl;

	const imgF = await loadImage(frontUrl);
	const imgB = await loadImage(backUrl);

	canvas.width = 1200;
	canvas.height = 1600;

	ctx.fillStyle = "white";
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	const w = canvas.width * 0.8;
	const h = (imgF.height / imgF.width) * w;
	ctx.drawImage(imgF, (canvas.width - w) / 2, 100, w, h);
	ctx.drawImage(imgB, (canvas.width - w) / 2, 200 + h, w, h);

	return canvas.toDataURL("image/jpeg", 0.9);
};

const loadImage = (url: string): Promise<HTMLImageElement> => {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = reject;
		img.src = url;
	});
};

export const fileToDataURL = (file: File): Promise<string> => {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
};
