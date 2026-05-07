import React, { useEffect, useRef } from "react";

// Hiệu ứng trái tim bay bằng canvas, random nhiều trái tim bay chậm/chồng lên nhau (rất nhẹ)
const HeartParticles: React.FC = () => {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const requestRef = useRef<number>();

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		let width = window.innerWidth,
			height = window.innerHeight;
		canvas.width = width;
		canvas.height = height;

		const heartCount = Math.floor(width / 30); // responsive lên desktop/laptop sẽ nhiều tim hơn
		const hearts = Array.from({ length: heartCount }, () => ({
			x: Math.random() * width,
			y: Math.random() * height,
			size: 18 + Math.random() * 18,
			speed: 0.6 + Math.random() * 0.8,
			sway: Math.random() * 2 * Math.PI,
			swaySpeed: 0.01 + Math.random() * 0.02,
			alpha: 0.25 + Math.random() * 0.5,
		}));

		function drawHeart(
			cx: number,
			cy: number,
			size: number,
			color = "#FFB6C1",
			alpha = 0.8
		) {
			ctx!.save();
			ctx!.globalAlpha = alpha;
			ctx!.beginPath();
			for (let i = 0; i < Math.PI * 2; i += 0.01) {
				const x = size * 16 * Math.pow(Math.sin(i), 3);
				const y =
					-size *
					(13 * Math.cos(i) -
						5 * Math.cos(2 * i) -
						2 * Math.cos(3 * i) -
						Math.cos(4 * i));
				ctx!.lineTo(cx + x, cy + y);
			}
			ctx!.fillStyle = color;
			ctx!.fill();
			ctx!.restore();
		}

		function render() {
			ctx!.clearRect(0, 0, width, height);

			hearts.forEach((h) => {
				drawHeart(
					h.x + Math.sin(Date.now() / 1000 + h.sway) * 12,
					h.y,
					h.size * 0.03,
					"#FFB6C1",
					h.alpha
				);
				// Update position
				h.y += h.speed;
				h.sway += h.swaySpeed;
				// Loop lên đầu
				if (h.y > height + 40) {
					h.y = -40;
					h.x = Math.random() * width;
				}
			});

			requestRef.current = requestAnimationFrame(render);
		}
		render();

		function handleResize() {
			width = window.innerWidth;
			height = window.innerHeight;
			canvas!.width = width;
			canvas!.height = height;
		}
		window.addEventListener("resize", handleResize);
		return () => {
			cancelAnimationFrame(requestRef.current!);
			window.removeEventListener("resize", handleResize);
		};
	}, []);

	// Canvas toàn trang, pointer-events none
	return (
		<canvas
			ref={canvasRef}
			className="fixed inset-0 z-0 pointer-events-none select-none"
			style={{ width: "100vw", height: "100vh" }}
			aria-hidden="true"
		/>
	);
};

export default HeartParticles;
