import React, { useEffect, useRef } from "react";

interface CanvasBackgroundProps {
	vibeMode: "off" | "rain" | "lofi" | "waves" | "jazz";
}

interface Star {
	x: number;
	y: number;
	size: number;
	opacity: number;
	twinkleSpeed: number;
	color: string;
}

interface RainDrop {
	x: number;
	y: number;
	speed: number;
	length: number;
	opacity: number;
	width: number;
}

interface FogLine {
	y: number;
	x: number;
	speed: number;
	length: number;
	opacity: number;
	height: number;
}

const CanvasBackground: React.FC<CanvasBackgroundProps> = ({ vibeMode }) => {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const animationFrameRef = useRef<number | null>(null);

	// Tọa độ tĩnh của các ô cửa sổ (phần trăm theo chiều rộng và cao)
	// Trùng khớp với vị trí trong thiết kế gốc của thành phố
	const windows = useRef([
		{ leftPct: 0.33, bottomPct: 0.37, opacity: 0.45, targetOpacity: 0.45, delay: 0 },
		{ leftPct: 0.47, bottomPct: 0.34, opacity: 0.45, targetOpacity: 0.45, delay: 30 },
		{ leftPct: 0.64, bottomPct: 0.39, opacity: 0.45, targetOpacity: 0.45, delay: 60 },
		{ leftPct: 0.83, bottomPct: 0.35, opacity: 0.45, targetOpacity: 0.45, delay: 10 },
	]);

	const stars = useRef<Star[]>([]);
	const rainDrops = useRef<RainDrop[]>([]);
	const fogLines = useRef<FogLine[]>([]);
	const shootingStar = useRef({ x: 0, y: 0, speedX: 0, speedY: 0, length: 0, opacity: 0, active: false, width: 2 });

	// Khởi tạo các phần tử hoạt họa
	const initElements = (width: number, height: number) => {
		// Khởi tạo sao (night-dust)
		const starCount = Math.floor((width * height) / 15000); // Tỷ lệ theo diện tích
		const newStars: Star[] = [];
		const colors = ["rgba(255, 255, 255, ", "rgba(129, 140, 248, ", "rgba(165, 180, 252, "];
		for (let i = 0; i < starCount; i++) {
			newStars.push({
				x: Math.random() * width,
				y: Math.random() * (height * 0.7), // Tập trung ở phần trên bầu trời
				size: Math.random() > 0.85 ? 2 : 1, // Hầu hết là 1px
				opacity: Math.random() * 0.6 + 0.1,
				twinkleSpeed: 0.005 + Math.random() * 0.015,
				color: colors[Math.floor(Math.random() * colors.length)],
			});
		}
		stars.current = newStars;

		// Khởi tạo sương mù (city-fog)
		const newFogLines: FogLine[] = [];
		const baseFogY = height * 0.65; // Ở vị trí đường chân trời thành phố
		for (let i = 0; i < 4; i++) {
			newFogLines.push({
				y: baseFogY + i * 20 + Math.random() * 10,
				x: Math.random() * width,
				speed: 0.15 + Math.random() * 0.2,
				length: width * 0.35 + Math.random() * (width * 0.2),
				opacity: 0.05 + Math.random() * 0.08,
				height: 2 + Math.random() * 2,
			});
		}
		fogLines.current = newFogLines;

		// Khởi tạo mưa
		const newRainDrops: RainDrop[] = [];
		for (let i = 0; i < 100; i++) {
			newRainDrops.push({
				x: Math.random() * width,
				y: Math.random() * height - height, // Xuất phát từ trên cao ngoài màn hình
				speed: 10 + Math.random() * 8,
				length: 15 + Math.random() * 20,
				opacity: 0.08 + Math.random() * 0.18,
				width: Math.random() > 0.5 ? 1 : 2,
			});
		}
		rainDrops.current = newRainDrops;
	};

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const handleResize = () => {
			const rect = canvas.parentElement?.getBoundingClientRect() || { width: window.innerWidth, height: window.innerHeight };
			canvas.width = rect.width;
			canvas.height = rect.height;
			initElements(canvas.width, canvas.height);
		};

		handleResize();
		window.addEventListener("resize", handleResize);

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		// Khóa khử răng cưa để tạo nét pixel sắc cạnh
		ctx.imageSmoothingEnabled = false;

		let lastRender = 0;
		const fpsInterval = 1000 / 24; // Giới hạn ở 24 FPS (tiết kiệm GPU tối đa và retro vibe)

		const render = (timestamp: number) => {
			if (document.hidden) {
				animationFrameRef.current = requestAnimationFrame(render);
				return;
			}

			animationFrameRef.current = requestAnimationFrame(render);

			const elapsed = timestamp - lastRender;
			if (elapsed < fpsInterval) return;

			lastRender = timestamp - (elapsed % fpsInterval);

			const w = canvas.width;
			const h = canvas.height;

			// Xóa canvas
			ctx.clearRect(0, 0, w, h);

			// 1. Vẽ sao (night-dust)
			stars.current.forEach((star) => {
				// Cập nhật độ sáng nhấp nháy
				star.opacity += star.twinkleSpeed;
				if (star.opacity > 0.85 || star.opacity < 0.1) {
					star.twinkleSpeed = -star.twinkleSpeed;
				}
				// Gió đẩy nhẹ
				star.x += 0.02;
				if (star.x > w) star.x = 0;

				ctx.fillStyle = `${star.color}${star.opacity.toFixed(2)})`;
				ctx.fillRect(Math.floor(star.x), Math.floor(star.y), star.size, star.size);
			});

			// 1.5. Vẽ sao băng (shooting-star)
			if (!shootingStar.current.active && Math.random() > 0.995) {
				shootingStar.current = {
					x: Math.random() * w * 0.7,
					y: Math.random() * h * 0.3,
					speedX: 5 + Math.random() * 5,
					speedY: 3 + Math.random() * 3,
					length: 15 + Math.random() * 25,
					opacity: 1,
					active: true,
					width: Math.random() > 0.7 ? 2 : 1,
				};
			}

			if (shootingStar.current.active) {
				const ss = shootingStar.current;
				ss.x += ss.speedX;
				ss.y += ss.speedY;
				ss.opacity -= 0.035;

				if (ss.opacity <= 0 || ss.x > w || ss.y > h) {
					ss.active = false;
				} else {
					ctx.strokeStyle = `rgba(255, 255, 255, ${ss.opacity.toFixed(2)})`;
					ctx.lineWidth = ss.width;
					ctx.beginPath();
					ctx.moveTo(ss.x, ss.y);
					ctx.lineTo(ss.x - ss.speedX * 2, ss.y - ss.speedY * 2);
					ctx.stroke();
				}
			}

			// 2. Vẽ cửa sổ nhấp nháy ngẫu nhiên (city-windows)
			windows.current.forEach((win) => {
				// Thi thoảng thay đổi mục tiêu độ sáng
				if (Math.random() > 0.98) {
					win.targetOpacity = 0.15 + Math.random() * 0.75;
				}

				// Lướt mềm tiến tới độ sáng mục tiêu
				win.opacity += (win.targetOpacity - win.opacity) * 0.08;

				const winX = w * win.leftPct;
				// Tính bottom theo chiều cao canvas
				const winY = h - (h * win.bottomPct);

				// Màu cửa sổ vàng ấm pixel
				ctx.fillStyle = `rgba(217, 223, 74, ${win.opacity.toFixed(2)})`;
				ctx.fillRect(Math.floor(winX), Math.floor(winY), 10, 18);
			});

			// 3. Vẽ sương mù (city-fog)
			fogLines.current.forEach((fog) => {
				fog.x += fog.speed;
				if (fog.x > w) {
					fog.x = -fog.length;
				}

				// Vẽ gradient mờ ngang của sương mù
				const grad = ctx.createLinearGradient(Math.floor(fog.x), 0, Math.floor(fog.x + fog.length), 0);
				grad.addColorStop(0, "rgba(99, 102, 241, 0)");
				grad.addColorStop(0.5, `rgba(148, 163, 184, ${fog.opacity.toFixed(2)})`);
				grad.addColorStop(1, "rgba(99, 102, 241, 0)");

				ctx.fillStyle = grad;
				ctx.fillRect(Math.floor(fog.x), Math.floor(fog.y), Math.floor(fog.length), Math.floor(fog.height));
			});

			// 4. Vẽ mưa nếu bật chế độ rain
			if (vibeMode === "rain") {
				ctx.fillStyle = "rgba(129, 140, 248, 0.3)";
				rainDrops.current.forEach((drop) => {
					// Rơi xuống
					drop.y += drop.speed;
					// Gió thổi nhẹ chéo
					drop.x += 0.5;

					// Nếu ra ngoài màn hình thì reset lên đỉnh
					if (drop.y > h) {
						drop.y = -drop.length;
						drop.x = Math.random() * w;
					}

					// Vẽ hạt mưa dạng nét đứng sắc cạnh
					ctx.fillStyle = `rgba(129, 140, 248, ${drop.opacity.toFixed(2)})`;
					ctx.fillRect(Math.floor(drop.x), Math.floor(drop.y), drop.width, Math.floor(drop.length));
				});
			}
		};

		animationFrameRef.current = requestAnimationFrame(render);

		// Page Visibility API
		const handleVisibilityChange = () => {
			if (document.hidden) {
				if (animationFrameRef.current) {
					cancelAnimationFrame(animationFrameRef.current);
					animationFrameRef.current = null;
				}
			} else {
				if (!animationFrameRef.current) {
					lastRender = performance.now();
					animationFrameRef.current = requestAnimationFrame(render);
				}
			}
		};

		document.addEventListener("visibilitychange", handleVisibilityChange);

		return () => {
			window.removeEventListener("resize", handleResize);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
			if (animationFrameRef.current) {
				cancelAnimationFrame(animationFrameRef.current);
			}
		};
	}, [vibeMode]);

	return (
		<canvas
			ref={canvasRef}
			className="absolute inset-0 pointer-events-none z-[15] overflow-hidden"
			style={{ mixBlendMode: "screen" }}
		/>
	);
};

export default CanvasBackground;
