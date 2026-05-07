import React, { useEffect, useRef } from "react";

const SnowParticles: React.FC = () => {
	const canvasRef = useRef<HTMLDivElement>(null);
	const requestRef = useRef<number>();

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		let width = window.innerWidth,
			height = window.innerHeight;
		let snowCount = Math.floor(width / 31);
		let flakes = Array.from({ length: snowCount }, () => ({
			x: Math.random() * width,
			y: Math.random() * height,
			size: 18 + Math.random() * 18,
			speed: 0.64 + Math.random() * 0.95,
			sway: Math.random() * 2 * Math.PI,
			swaySpeed: 0.008 + Math.random() * 0.022,
			alpha: 0.36 + Math.random() * 0.4,
		}));

		const render = () => {
			while (canvas.firstChild) canvas.removeChild(canvas.firstChild);

			flakes.forEach((h) => {
				const flakeDiv = document.createElement("div");
				flakeDiv.style.position = "absolute";
				flakeDiv.style.left = `${
					h.x + Math.sin(Date.now() / 1100 + h.sway) * 14
				}px`;
				flakeDiv.style.top = `${h.y}px`;
				flakeDiv.style.opacity = `${h.alpha}`;
				flakeDiv.style.pointerEvents = "none";
				flakeDiv.style.zIndex = "1";
				flakeDiv.style.width = `${h.size}px`;
				flakeDiv.style.height = `${h.size}px`;
				flakeDiv.innerHTML = `<svg width="${h.size}" height="${h.size}" fill="none" stroke="#93cdf7" stroke-width="1.5" viewBox="0 0 24 24"
          style="filter: drop-shadow(0 1px 6px #d7e7fb);">
        <path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07"/>
        </svg>`;
				canvas.appendChild(flakeDiv);

				// Update position
				h.y += h.speed;
				h.sway += h.swaySpeed;
				if (h.y > height + 38) {
					h.y = -38;
					h.x = Math.random() * width;
				}
			});

			requestRef.current = requestAnimationFrame(render);
		};
		render();

		function handleResize() {
			width = window.innerWidth;
			height = window.innerHeight;
		}
		window.addEventListener("resize", handleResize);

		return () => {
			cancelAnimationFrame(requestRef.current!);
			window.removeEventListener("resize", handleResize);
		};
	}, []);

	return (
		<div
			ref={canvasRef}
			className="fixed inset-0 z-0 pointer-events-none select-none"
			style={{ width: "100vw", height: "100vh" }}
			aria-hidden="true"
		/>
	);
};

export default SnowParticles;
