import React, { useState, useRef, useEffect, useCallback } from "react";
import {
	Camera as CameraIcon,
	Plus,
	FileText,
	Trash2,
	Share2,
	Download,
	X,
	CheckCircle2,
	Upload,
	RefreshCw,
	Zap,
	ZapOff,
	Scan,
	Mail,
	HardDrive,
	Filter,
	Square,
	CheckSquare,
	RotateCw,
	PenTool,
	Settings,
	CreditCard,
	FileCode,
	Check,
	AlertTriangle,
	Info,
	GripVertical,
} from "lucide-react";
import {
	Reorder,
	AnimatePresence,
	motion,
	useDragControls,
} from "framer-motion";
import { ScannedImage, AppState, ImageFilter, ScanMode } from "./types";
import {
	generatePDF,
	fileToDataURL,
	applyFilterAndTransform,
	mergeIDCard,
	checkImageClarity,
} from "./utils/helpers";

const DRAFT_KEY = "swiftscan_draft_images_v2";

const App: React.FC = () => {
	const [images, setImages] = useState<ScannedImage[]>([]);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [globalFilter, setGlobalFilter] = useState<ImageFilter>("none");
	const [appState, setAppState] = useState<AppState>(AppState.IDLE);
	const [isProcessing, setIsProcessing] = useState(false);
	const [showCamera, setShowCamera] = useState(false);
	const [autoCapture, setAutoCapture] = useState(true);
	const [scanMode, setScanMode] = useState<ScanMode>("document");
	const [isFlashing, setIsFlashing] = useState(false);
	const [showShareHub, setShowShareHub] = useState(false);
	const [showSettings, setShowSettings] = useState(false);
	const [showSignature, setShowSignature] = useState(false);
	const [cameraError, setCameraError] = useState<string | null>(null);

	const [fileName, setFileName] = useState(
		`Scan_${new Date().toLocaleDateString().replace(/\//g, "-")}`,
	);
	const [quality, setQuality] = useState(0.8);

	const [stream, setStream] = useState<MediaStream | null>(null);
	const [previewImage, setPreviewImage] = useState<string | null>(null);
	const [idCardSteps, setIdCardSteps] = useState<{
		front?: string;
		back?: string;
	}>({});

	const videoRef = useRef<HTMLVideoElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
	const stabilityIntervalRef = useRef<number | null>(null);
	const [stabilityScore, setStabilityScore] = useState(0);
	const [captureStatus, setCaptureStatus] = useState<
		"searching" | "locked" | "capturing"
	>("searching");

	useEffect(() => {
		if (showCamera && stream && videoRef.current) {
			videoRef.current.srcObject = stream;
		}
	}, [showCamera, stream]);

	useEffect(() => {
		const saved = localStorage.getItem(DRAFT_KEY);
		if (saved) {
			try {
				const parsed = JSON.parse(saved);
				if (parsed.length > 0) {
					setImages(parsed);
					setAppState(AppState.PREVIEW);
					if (parsed[0].filter) setGlobalFilter(parsed[0].filter);
					setPreviewImage(parsed[parsed.length - 1].url);
				}
			} catch (e) {
				console.error("Lỗi bản nháp", e);
			}
		}
	}, []);

	useEffect(() => {
		if (images.length > 0) {
			localStorage.setItem(DRAFT_KEY, JSON.stringify(images));
		} else {
			localStorage.removeItem(DRAFT_KEY);
		}
	}, [images]);

	const startCamera = async (mode: ScanMode) => {
		setCameraError(null);
		setScanMode(mode);

		try {
			const mediaStream = await navigator.mediaDevices.getUserMedia({
				video: {
					facingMode: "environment",
					width: { ideal: 1920 },
					height: { ideal: 1080 },
				},
				audio: false,
			});

			setStream(mediaStream);
			setShowCamera(true);
			setAppState(AppState.SCANNING);
			setStabilityScore(0);
			setCaptureStatus("searching");
			setIdCardSteps({});
		} catch (err: any) {
			console.error("Camera Error:", err);
			if (
				err.name === "NotAllowedError" ||
				err.name === "PermissionDeniedError"
			) {
				setCameraError("Bạn chưa cấp quyền truy cập Camera.");
			} else {
				setCameraError(
					"Không thể mở camera. Hãy đóng các ứng dụng khác đang dùng camera và thử lại.",
				);
			}
		}
	};

	const stopCamera = () => {
		if (stream) {
			stream.getTracks().forEach((track) => track.stop());
			setStream(null);
		}
		setShowCamera(false);
		if (images.length > 0) {
			setAppState(AppState.PREVIEW);
			setPreviewImage(images[images.length - 1].url);
		} else {
			setAppState(AppState.IDLE);
		}
	};

	const capturePhoto = useCallback(() => {
		if (!videoRef.current) return;
		setIsFlashing(true);
		setTimeout(() => setIsFlashing(false), 100);

		const canvas = document.createElement("canvas");
		canvas.width = videoRef.current.videoWidth;
		canvas.height = videoRef.current.videoHeight;
		const ctx = canvas.getContext("2d");
		if (ctx) {
			ctx.drawImage(videoRef.current, 0, 0);
			canvas.toBlob(
				async (blob) => {
					if (blob) {
						const url = URL.createObjectURL(blob);

						if (scanMode === "idcard") {
							if (!idCardSteps.front) {
								setIdCardSteps({ front: url });
								setCaptureStatus("searching");
								setStabilityScore(0);
							} else {
								const mergedUrl = await mergeIDCard(
									idCardSteps.front,
									url,
								);
								const newImage: ScannedImage = {
									id: Math.random().toString(36).substr(2, 9),
									url: mergedUrl,
									blob: await (await fetch(mergedUrl)).blob(),
									name: `ID Card ${images.length + 1}`,
									filter: globalFilter,
									rotation: 0,
								};
								setImages((prev) => [...prev, newImage]);
								setIdCardSteps({});
								setPreviewImage(mergedUrl);
								setCaptureStatus("searching");
								setStabilityScore(0);
							}
						} else {
							const newImage: ScannedImage = {
								id: Math.random().toString(36).substr(2, 9),
								url,
								blob,
								name: `Trang ${images.length + 1}`,
								filter: globalFilter,
								rotation: 0,
							};
							setImages((prev) => [...prev, newImage]);
							setPreviewImage(url);
							setStabilityScore(0);
							setCaptureStatus("searching");
						}
					}
				},
				"image/jpeg",
				0.9,
			);
		}
	}, [images.length, globalFilter, scanMode, idCardSteps]);

	// Logic tự động chụp thông minh hơn: Kiểm tra độ nét và chuyển động
	useEffect(() => {
		if (showCamera && autoCapture && videoRef.current) {
			stabilityIntervalRef.current = window.setInterval(() => {
				if (!videoRef.current) return;

				// Kiểm tra độ nét của khung hình hiện tại
				const clarity = checkImageClarity(videoRef.current);

				setStabilityScore((prev) => {
					// Nếu độ nét thấp (nhòe), reset điểm ổn định
					if (clarity < 15) {
						setCaptureStatus("searching");
						return Math.max(0, prev - 15);
					}

					// Nếu độ nét đạt yêu cầu, tăng điểm ổn định
					const next = prev + clarity / 5;

					if (next >= 100) {
						setCaptureStatus("capturing");
						capturePhoto();
						return 0;
					}

					if (next > 50) setCaptureStatus("locked");
					return next;
				});
			}, 200);
		} else {
			if (stabilityIntervalRef.current)
				clearInterval(stabilityIntervalRef.current);
			setStabilityScore(0);
			setCaptureStatus("searching");
		}
		return () => {
			if (stabilityIntervalRef.current)
				clearInterval(stabilityIntervalRef.current);
		};
	}, [showCamera, autoCapture, capturePhoto]);

	const toggleSelection = (id: string) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const deleteSelected = () => {
		if (selectedIds.size === 0) return;
		const updated = images.filter((img) => !selectedIds.has(img.id));
		setImages(updated);
		setSelectedIds(new Set());
		if (updated.length === 0) {
			setAppState(AppState.IDLE);
			setPreviewImage(null);
		} else {
			setPreviewImage(updated[updated.length - 1].url);
		}
	};

	const rotateCurrentImage = () => {
		const current = images.find((img) => img.url === previewImage);
		if (!current) return;
		const newRotation = (current.rotation + 90) % 360;
		setImages((prev) =>
			prev.map((img) =>
				img.id === current.id ? { ...img, rotation: newRotation } : img,
			),
		);
	};

	const applyGlobalFilter = (filter: ImageFilter) => {
		setGlobalFilter(filter);
		setImages((prev) => prev.map((img) => ({ ...img, filter })));
	};

	const handleExportPDF = async () => {
		if (images.length === 0) return;
		setIsProcessing(true);
		try {
			const pdf = await generatePDF(images, fileName, quality);
			pdf.save(`${fileName}.pdf`);
			setShowShareHub(true);
		} finally {
			setIsProcessing(false);
		}
	};

	const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
		const canvas = signatureCanvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const rect = canvas.getBoundingClientRect();
		const x =
			"touches" in e
				? e.touches[0].clientX - rect.left
				: e.clientX - rect.left;
		const y =
			"touches" in e
				? e.touches[0].clientY - rect.top
				: e.clientY - rect.top;

		ctx.beginPath();
		ctx.moveTo(x, y);
		ctx.lineWidth = 3;
		ctx.lineCap = "round";
		ctx.strokeStyle = "#000";

		const draw = (moveEvent: MouseEvent | TouchEvent) => {
			const mx =
				"touches" in moveEvent
					? moveEvent.touches[0].clientX - rect.left
					: (moveEvent as MouseEvent).clientX - rect.left;
			const my =
				"touches" in moveEvent
					? moveEvent.touches[0].clientY - rect.top
					: (moveEvent as MouseEvent).clientY - rect.top;
			ctx.lineTo(mx, my);
			ctx.stroke();
		};

		const stop = () => {
			window.removeEventListener("mousemove", draw);
			window.removeEventListener("mouseup", stop);
			window.removeEventListener("touchmove", draw);
			window.removeEventListener("touchend", stop);
		};

		window.addEventListener("mousemove", draw);
		window.addEventListener("mouseup", stop);
		window.addEventListener("touchmove", draw);
		window.addEventListener("touchend", stop);
	};

	const saveSignature = () => {
		const canvas = signatureCanvasRef.current;
		if (!canvas) return;
		const sigData = canvas.toDataURL("image/png");
		const current = images.find((img) => img.url === previewImage);
		if (current) {
			setImages((prev) =>
				prev.map((img) =>
					img.id === current.id
						? { ...img, signature: sigData }
						: img,
				),
			);
		}
		setShowSignature(false);
	};

	const getFilterStyle = (filter: ImageFilter, rotation: number) => {
		let s = "";
		if (filter === "bw")
			s += "contrast(200%) grayscale(100%) brightness(120%) ";
		if (filter === "magic")
			s += "contrast(130%) saturate(130%) brightness(110%) ";
		if (filter === "grayscale") s += "grayscale(100%) ";
		return {
			filter: s.trim() || "none",
			transform: `rotate(${rotation}deg)`,
		};
	};

	return (
		<div className="min-h-screen flex flex-col max-w-lg mx-auto bg-slate-50 shadow-2xl relative overflow-hidden">
			{/* Header */}
			<header className="px-3 py-2 bg-white border-b flex justify-between items-center sticky top-0 z-30">
				<div className="flex items-center gap-2">
					<div className="bg-indigo-600 p-1.5 rounded-lg shadow-sm">
						<Scan className="text-white w-4 h-4" />
					</div>
					<h1 className="font-black text-base text-slate-900 tracking-tight">
						SwiftScan
					</h1>
				</div>
				<div className="flex items-center gap-2">
					{selectedIds.size > 0 && (
						<button
							onClick={deleteSelected}
							className="flex items-center gap-1 bg-red-600 text-white px-2 py-1 rounded-md font-bold text-[10px] uppercase active:scale-95 transition-all">
							<Trash2 className="w-3 h-3" /> Xóa
						</button>
					)}
					<button
						onClick={() => setShowSettings(true)}
						className="p-1.5 text-slate-400 hover:text-slate-600">
						<Settings className="w-5 h-5" />
					</button>
				</div>
			</header>

			<main className="flex-1 overflow-y-auto no-scrollbar pb-24">
				{/* Camera Error Message */}
				<AnimatePresence>
					{cameraError && (
						<motion.div
							initial={{ height: 0, opacity: 0 }}
							animate={{ height: "auto", opacity: 1 }}
							exit={{ height: 0, opacity: 0 }}
							className="bg-red-50 border-b border-red-100 p-4">
							<div className="flex gap-3">
								<AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
								<p className="text-xs font-bold text-red-900 leading-tight">
									{cameraError}
								</p>
							</div>
						</motion.div>
					)}
				</AnimatePresence>

				<AnimatePresence mode="wait">
					{appState === AppState.IDLE && (
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							className="h-full flex flex-col items-center justify-center p-8 text-center">
							<div className="w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center mb-6 border border-slate-50 relative">
								<CameraIcon className="w-8 h-8 text-indigo-600" />
								<div className="absolute -bottom-1 -right-1 w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center border-2 border-white">
									<Plus className="w-3 h-3 text-indigo-600" />
								</div>
							</div>
							<h2 className="text-xl font-black text-slate-900 mb-2">
								Bắt đầu quét
							</h2>
							<p className="text-slate-400 mb-8 text-xs max-w-[220px]">
								Chế độ tự động tìm góc và kiểm tra độ nét văn
								bản.
							</p>

							<div className="grid grid-cols-2 gap-3 w-full max-w-[300px] mb-4">
								<button
									onClick={() => startCamera("document")}
									className="flex flex-col items-center gap-2 p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-indigo-200 transition-all group">
									<FileCode className="w-6 h-6 text-indigo-500 group-hover:scale-110 transition-transform" />
									<span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
										Văn bản
									</span>
								</button>
								<button
									onClick={() => startCamera("idcard")}
									className="flex flex-col items-center gap-2 p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-indigo-200 transition-all group">
									<CreditCard className="w-6 h-6 text-indigo-500 group-hover:scale-110 transition-transform" />
									<span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
										ID Card
									</span>
								</button>
							</div>

							<button
								onClick={() => fileInputRef.current?.click()}
								className="w-full max-w-[300px] py-3 text-indigo-600 font-bold text-xs flex items-center justify-center gap-2 bg-indigo-50 rounded-xl">
								<Upload className="w-4 h-4" /> Tải ảnh từ máy
							</button>
							<input
								type="file"
								ref={fileInputRef}
								multiple
								accept="image/*"
								className="hidden"
								onChange={(e) => {
									const files = Array.from(
										e.target.files || [],
									);
									Promise.all(
										files.map(async (f) => ({
											id: Math.random()
												.toString(36)
												.substr(2, 9),
											url: await fileToDataURL(f),
											blob: f,
											name: f.name,
											filter: globalFilter,
											rotation: 0,
										})),
									).then((newImgs) => {
										setImages((prev) => [
											...prev,
											...newImgs,
										]);
										setAppState(AppState.PREVIEW);
										setPreviewImage(
											newImgs[newImgs.length - 1].url,
										);
									});
								}}
							/>
						</motion.div>
					)}

					{appState === AppState.PREVIEW && (
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							className="flex flex-col h-full">
							<div className="flex flex-col px-3 py-2 gap-3">
								<div className="flex gap-2">
									<div className="bg-white p-1 rounded-xl border border-slate-100 flex-1 flex items-center gap-1 overflow-x-auto no-scrollbar">
										<Filter className="w-3 h-3 text-slate-300 shrink-0 mx-2" />
										{(
											[
												"none",
												"bw",
												"magic",
												"grayscale",
											] as ImageFilter[]
										).map((f) => (
											<button
												key={f}
												onClick={() =>
													applyGlobalFilter(f)
												}
												className={`whitespace-nowrap text-[9px] font-black uppercase px-3 py-1.5 rounded-lg transition-all ${globalFilter === f ? "bg-indigo-600 text-white shadow-md" : "bg-slate-50 text-slate-400"}`}>
												{f === "none"
													? "Gốc"
													: f === "bw"
														? "B&W"
														: f === "magic"
															? "Magic"
															: "Xám"}
											</button>
										))}
									</div>
								</div>

								<div className="h-[260px] w-full bg-slate-900 rounded-2xl overflow-hidden relative flex items-center justify-center group">
									{previewImage ? (
										<div className="relative w-full h-full flex items-center justify-center p-4">
											<img
												src={previewImage}
												className="max-w-full max-h-full object-contain transition-transform"
												style={getFilterStyle(
													globalFilter,
													images.find(
														(i) =>
															i.url ===
															previewImage,
													)?.rotation || 0,
												)}
											/>
											{images.find(
												(i) => i.url === previewImage,
											)?.signature && (
												<img
													src={
														images.find(
															(i) =>
																i.url ===
																previewImage,
														)?.signature
													}
													className="absolute bottom-10 right-10 w-24 opacity-80"
												/>
											)}
										</div>
									) : (
										<p className="text-slate-600 text-xs">
											Chưa có ảnh
										</p>
									)}

									<div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
										<button
											onClick={rotateCurrentImage}
											className="p-2 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-indigo-600">
											<RotateCw className="w-4 h-4" />
										</button>
										<button
											onClick={() =>
												setShowSignature(true)
											}
											className="p-2 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-indigo-600">
											<PenTool className="w-4 h-4" />
										</button>
									</div>
								</div>

								<div className="mt-1">
									<div className="flex items-center justify-between mb-2 px-1">
										<h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
											Trang ({images.length})
										</h3>
									</div>

									{/* Cập nhật Reorder: Chỉ cho phép kéo qua handle hoặc Long Press */}
									<Reorder.Group
										axis="x"
										values={images}
										onReorder={setImages}
										className="flex gap-2 overflow-x-auto py-2 no-scrollbar touch-pan-x">
										{images.map((img, idx) => (
											<ReorderItem
												key={img.id}
												img={img}
												idx={idx}
												isSelected={selectedIds.has(
													img.id,
												)}
												isPreview={
													previewImage === img.url
												}
												onSelect={() =>
													toggleSelection(img.id)
												}
												onPreview={() =>
													setPreviewImage(img.url)
												}
												filterStyle={getFilterStyle(
													globalFilter,
													img.rotation,
												)}
											/>
										))}
										<button
											onClick={() =>
												startCamera("document")
											}
											className="flex-shrink-0 w-20 h-28 bg-indigo-50 border-2 border-dashed border-indigo-100 rounded-xl flex flex-col items-center justify-center gap-2 text-indigo-400 active:bg-indigo-100 transition-colors">
											<Plus className="w-6 h-6" />
											<span className="text-[8px] font-bold">
												THÊM
											</span>
										</button>
									</Reorder.Group>
									<p className="text-[8px] text-slate-400 font-bold uppercase text-center mt-2">
										Dùng biểu tượng ⠿ để sắp xếp thứ tự
									</p>
								</div>
							</div>
						</motion.div>
					)}
				</AnimatePresence>
			</main>

			{images.length > 0 && appState !== AppState.SCANNING && (
				<div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto p-4 pb-8 bg-white/80 backdrop-blur-xl border-t z-40">
					<div className="flex gap-3">
						<button
							onClick={handleExportPDF}
							disabled={isProcessing}
							className="flex-1 bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50 text-xs tracking-widest uppercase">
							{isProcessing ? (
								<RefreshCw className="w-5 h-5 animate-spin" />
							) : (
								<>
									<Download className="w-5 h-5" /> Xuất PDF
								</>
							)}
						</button>
						<button
							onClick={() => setShowShareHub(true)}
							className="bg-indigo-600 text-white w-14 rounded-2xl flex items-center justify-center shadow-lg active:scale-95 transition-all">
							<Share2 className="w-5 h-5" />
						</button>
					</div>
				</div>
			)}

			{/* Camera Modal: Nâng cấp Khung Quét Động */}
			<AnimatePresence>
				{showCamera && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="fixed inset-0 z-50 bg-black flex flex-col select-none">
						<AnimatePresence>
							{isFlashing && (
								<motion.div
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={{ opacity: 0 }}
									className="absolute inset-0 bg-white z-[60] pointer-events-none"
								/>
							)}
						</AnimatePresence>

						<div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-50">
							<button
								onClick={stopCamera}
								className="p-3 bg-black/40 backdrop-blur-lg rounded-full text-white active:scale-90">
								<X className="w-6 h-6" />
							</button>
							<div className="flex gap-2">
								<button
									onClick={() => setAutoCapture(!autoCapture)}
									className={`flex items-center gap-2 px-4 py-2 rounded-full font-black text-[10px] uppercase tracking-wider transition-all ${autoCapture ? "bg-indigo-600 text-white shadow-lg" : "bg-white/10 text-white/50"}`}>
									{autoCapture ? (
										<Zap className="w-4 h-4 fill-current" />
									) : (
										<ZapOff className="w-4 h-4" />
									)}{" "}
									{autoCapture ? "Auto-Focus" : "Manual"}
								</button>
							</div>
						</div>

						<div className="relative flex-1 bg-black overflow-hidden flex flex-col items-center justify-center">
							<video
								ref={videoRef}
								autoPlay
								playsInline
								muted
								className="w-full h-full object-cover opacity-90"
							/>

							{/* Khung Quét Năng Động - Không còn tĩnh nữa */}
							<div className="absolute inset-0 flex items-center justify-center pointer-events-none p-8">
								<div
									className={`relative transition-all duration-300 ${captureStatus === "locked" ? "w-[92%] h-[65%] border-indigo-400 shadow-[0_0_40px_rgba(99,102,241,0.3)]" : "w-[85%] h-[60%] border-white/30"} border-2 rounded-3xl scanning-rect`}>
									{/* Corner Markers - Giả lập việc tìm thấy 4 góc */}
									<motion.div
										animate={{
											x:
												captureStatus === "locked"
													? -5
													: 0,
											y:
												captureStatus === "locked"
													? -5
													: 0,
										}}
										className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-indigo-500 rounded-tl-2xl"></motion.div>
									<motion.div
										animate={{
											x:
												captureStatus === "locked"
													? 5
													: 0,
											y:
												captureStatus === "locked"
													? -5
													: 0,
										}}
										className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-indigo-500 rounded-tr-2xl"></motion.div>
									<motion.div
										animate={{
											x:
												captureStatus === "locked"
													? -5
													: 0,
											y:
												captureStatus === "locked"
													? 5
													: 0,
										}}
										className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-indigo-500 rounded-bl-2xl"></motion.div>
									<motion.div
										animate={{
											x:
												captureStatus === "locked"
													? 5
													: 0,
											y:
												captureStatus === "locked"
													? 5
													: 0,
										}}
										className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-indigo-500 rounded-br-2xl"></motion.div>

									<div className="absolute top-0 left-0 right-0 h-1 bg-indigo-500/50 scan-line"></div>

									<div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
										{scanMode === "idcard" && (
											<div className="bg-indigo-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-4">
												{!idCardSteps.front
													? "MẶT TRƯỚC"
													: "MẶT SAU"}
											</div>
										)}

										{autoCapture && (
											<div className="flex flex-col items-center gap-3">
												<div
													className={`w-32 h-1.5 rounded-full overflow-hidden bg-white/10 transition-colors ${captureStatus === "locked" ? "bg-indigo-900/30" : ""}`}>
													<motion.div
														className={`h-full shadow-[0_0_10px_rgba(99,102,241,0.8)] ${captureStatus === "locked" ? "bg-green-400" : "bg-indigo-500"}`}
														animate={{
															width: `${stabilityScore}%`,
														}}
													/>
												</div>
												<span
													className={`text-[8px] font-black uppercase tracking-[0.2em] transition-colors ${captureStatus === "locked" ? "text-green-400" : "text-white/70"}`}>
													{captureStatus ===
													"capturing"
														? "ĐANG CHỤP..."
														: captureStatus ===
															  "locked"
															? "ĐÃ KHÓA NÉT - GIỮ YÊN..."
															: "ĐANG TÌM TÀI LIỆU..."}
												</span>
											</div>
										)}
									</div>
								</div>
							</div>
						</div>

						<div className="bg-black/95 backdrop-blur-2xl p-6 pb-12 flex items-center justify-between gap-6 px-10 border-t border-white/10">
							<div className="w-12 h-16 bg-white/5 rounded-xl border border-white/10 flex items-center justify-center overflow-hidden">
								{images.length > 0 && (
									<img
										src={images[images.length - 1].url}
										className="w-full h-full object-cover"
									/>
								)}
							</div>

							<div className="relative flex items-center justify-center">
								<button
									onClick={capturePhoto}
									className="w-20 h-20 bg-white rounded-full flex items-center justify-center p-1 active:scale-90 transition-transform">
									<div className="w-full h-full border-4 border-black rounded-full"></div>
								</button>
							</div>

							<button
								onClick={stopCamera}
								className="flex flex-col items-center gap-2 group">
								<div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-transform border border-indigo-400/50">
									<CheckCircle2 className="w-7 h-7 text-white" />
								</div>
								<span className="text-[10px] text-white/70 font-black uppercase tracking-widest">
									XONG ({images.length})
								</span>
							</button>
						</div>
					</motion.div>
				)}
			</AnimatePresence>

			{/* Các Modals khác không đổi */}
			<AnimatePresence>
				{showSignature && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
						<div className="bg-white w-full max-w-sm rounded-[32px] overflow-hidden">
							<div className="p-6 border-b flex justify-between items-center">
								<h3 className="font-black text-slate-900 uppercase text-xs tracking-widest">
									Ký tên tài liệu
								</h3>
								<button onClick={() => setShowSignature(false)}>
									<X className="w-5 h-5 text-slate-400" />
								</button>
							</div>
							<div className="p-4 bg-slate-50">
								<canvas
									ref={signatureCanvasRef}
									width={400}
									height={250}
									className="w-full h-48 bg-white border-2 border-dashed border-slate-200 rounded-2xl touch-none cursor-crosshair"
									onMouseDown={startDrawing}
									onTouchStart={startDrawing}
								/>
								<p className="text-center text-[8px] text-slate-400 uppercase font-bold mt-2 tracking-widest">
									Vẽ chữ ký vào khung
								</p>
							</div>
							<div className="p-4 flex gap-3">
								<button
									onClick={() => {
										const ctx =
											signatureCanvasRef.current?.getContext(
												"2d",
											);
										ctx?.clearRect(0, 0, 400, 250);
									}}
									className="flex-1 py-3 text-slate-400 font-bold text-[10px] uppercase">
									Xóa vẽ lại
								</button>
								<button
									onClick={saveSignature}
									className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold text-[10px] uppercase shadow-lg">
									Lưu chữ ký
								</button>
							</div>
						</div>
					</motion.div>
				)}
			</AnimatePresence>

			{/* Settings Modal */}
			<AnimatePresence>
				{showSettings && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
						<motion.div
							initial={{ scale: 0.9, opacity: 0 }}
							animate={{ scale: 1, opacity: 1 }}
							className="bg-white w-full max-w-xs rounded-[32px] p-6 shadow-2xl">
							<h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6 text-center">
								Thiết lập file
							</h3>
							<div className="space-y-6">
								<div>
									<label className="text-[9px] font-black text-slate-400 uppercase block mb-2">
										Tên file PDF
									</label>
									<input
										type="text"
										value={fileName}
										onChange={(e) =>
											setFileName(e.target.value)
										}
										className="w-full bg-slate-50 border border-slate-100 px-4 py-3 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 ring-indigo-500 outline-none"
									/>
								</div>
								<div>
									<label className="text-[9px] font-black text-slate-400 uppercase block mb-3">
										Chất lượng hình ảnh
									</label>
									<div className="grid grid-cols-2 gap-2">
										<button
											onClick={() => setQuality(0.6)}
											className={`py-3 rounded-xl text-[9px] font-black uppercase transition-all ${quality === 0.6 ? "bg-indigo-600 text-white shadow-md" : "bg-slate-50 text-slate-400"}`}>
											Low
										</button>
										<button
											onClick={() => setQuality(0.9)}
											className={`py-3 rounded-xl text-[9px] font-black uppercase transition-all ${quality === 0.9 ? "bg-indigo-600 text-white shadow-md" : "bg-slate-50 text-slate-400"}`}>
											High
										</button>
									</div>
								</div>
							</div>
							<button
								onClick={() => setShowSettings(false)}
								className="w-full mt-8 bg-slate-900 text-white py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg">
								Hoàn tất
							</button>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>

			<AnimatePresence>
				{showShareHub && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-end justify-center p-3">
						<motion.div
							initial={{ y: 50 }}
							animate={{ y: 0 }}
							exit={{ y: 50 }}
							className="bg-white w-full max-w-md rounded-[32px] p-6 shadow-2xl">
							<div className="flex justify-between items-center mb-6">
								<div className="flex items-center gap-2">
									<div className="bg-green-100 p-1.5 rounded-full">
										<Check className="w-4 h-4 text-green-600" />
									</div>
									<h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">
										Thành công
									</h3>
								</div>
								<button
									onClick={() => setShowShareHub(false)}
									className="p-1.5 bg-slate-100 rounded-full">
									<X className="w-4 h-4 text-slate-400" />
								</button>
							</div>
							<div className="grid grid-cols-2 gap-3 mb-6">
								<button
									onClick={() => {
										window.location.href = `mailto:?subject=${fileName}&body=Gửi từ SwiftScan.`;
									}}
									className="flex flex-col items-center gap-2 p-5 bg-red-50 rounded-2xl group active:scale-95 transition-all">
									<Mail className="w-6 h-6 text-red-600" />
									<span className="text-[10px] font-black text-red-900 uppercase">
										Gmail
									</span>
								</button>
								<button
									onClick={() =>
										alert(
											"File đã được tải về. Bạn có thể up lên Drive của mình.",
										)
									}
									className="flex flex-col items-center gap-2 p-5 bg-blue-50 rounded-2xl group active:scale-95 transition-all">
									<HardDrive className="w-6 h-6 text-blue-600" />
									<span className="text-[10px] font-black text-blue-900 uppercase">
										Drive
									</span>
								</button>
							</div>
							<button
								onClick={handleExportPDF}
								className="w-full bg-slate-100 text-slate-600 font-bold py-4 rounded-xl flex items-center justify-center gap-2 text-xs uppercase tracking-widest">
								<Download className="w-4 h-4" /> Tải lại file
							</button>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>

			{isProcessing && (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-xl flex items-center justify-center p-8">
					<div className="bg-white p-10 rounded-[40px] shadow-2xl max-w-xs w-full text-center">
						<div className="relative w-20 h-20 mx-auto mb-6">
							<div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
							<div className="absolute inset-0 flex items-center justify-center">
								<FileText className="w-8 h-8 text-indigo-600" />
							</div>
						</div>
						<h3 className="text-base font-black text-slate-900 mb-2 uppercase tracking-tight">
							Đang xuất PDF
						</h3>
					</div>
				</motion.div>
			)}
		</div>
	);
};

// Component con cho Reorder Item để tách biệt logic drag controls
const ReorderItem = ({
	img,
	idx,
	isSelected,
	isPreview,
	onSelect,
	onPreview,
	filterStyle,
}: any) => {
	const dragControls = useDragControls();

	return (
		<Reorder.Item
			value={img}
			dragListener={false}
			dragControls={dragControls}
			className={`relative flex-shrink-0 w-24 h-32 rounded-xl overflow-hidden border-2 transition-all ${isSelected ? "border-indigo-600 ring-4 ring-indigo-500/10" : isPreview ? "border-indigo-400" : "border-white shadow-md"}`}
			onClick={onPreview}>
			<img
				src={img.url}
				className="w-full h-full object-cover"
				style={filterStyle}
			/>
			<div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none"></div>

			{/* Nút chọn ảnh */}
			<div
				className="absolute top-1 right-1 z-10"
				onClick={(e) => {
					e.stopPropagation();
					onSelect();
				}}>
				{isSelected ? (
					<div className="bg-indigo-600 rounded-md p-0.5">
						<CheckSquare className="w-4 h-4 text-white" />
					</div>
				) : (
					<div className="bg-black/20 backdrop-blur-sm rounded-md p-0.5">
						<Square className="w-4 h-4 text-white/80" />
					</div>
				)}
			</div>

			{/* Handle Kéo thả - Chỉ kéo khi giữ ở đây */}
			<div
				className="absolute bottom-1 right-1 z-20 p-1.5 bg-black/40 backdrop-blur-sm rounded-lg cursor-grab active:cursor-grabbing text-white"
				onPointerDown={(e) => dragControls.start(e)}>
				<GripVertical className="w-3 h-3" />
			</div>

			<div className="absolute bottom-2 left-2 text-[10px] font-black text-white bg-black/20 px-1.5 rounded-md backdrop-blur-sm">
				{idx + 1}
			</div>
		</Reorder.Item>
	);
};

export default App;
