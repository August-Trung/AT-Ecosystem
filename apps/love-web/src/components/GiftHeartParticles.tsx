import React, { useEffect, useRef } from "react";

const COLORS = ["#fe7ea6", "#fdddf3", "#fee29b", "#9ad8f8", "#ffb6c1"];

const GiftHeartParticles: React.FC = () => {
	const canvasRef = useRef<HTMLDivElement>(null);
	const requestRef = useRef<number>();

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		let width = window.innerWidth,
			height = window.innerHeight;

		const count = Math.floor(width / 46);
		let items = Array.from({ length: count }, () => ({
			type: Math.random() < 0.52 ? "heart" : "gift",
			x: Math.random() * width,
			y: Math.random() * height,
			size: 22 + Math.random() * 19,
			speed: 0.62 + Math.random() * 1.1,
			sway: Math.random() * 2 * Math.PI,
			swaySpeed: 0.01 + Math.random() * 0.021,
			color: COLORS[Math.floor(Math.random() * COLORS.length)],
			alpha: 0.34 + Math.random() * 0.48,
		}));

		const render = () => {
			while (canvas.firstChild) canvas.removeChild(canvas.firstChild);

			items.forEach((h) => {
				const itemDiv = document.createElement("div");
				itemDiv.style.position = "absolute";
				itemDiv.style.left = `${
					h.x + Math.sin(Date.now() / 1200 + h.sway) * 12
				}px`;
				itemDiv.style.top = `${h.y}px`;
				itemDiv.style.opacity = `${h.alpha}`;
				itemDiv.style.pointerEvents = "none";
				itemDiv.style.zIndex = "1";
				itemDiv.style.width = `${h.size}px`;
				itemDiv.style.height = `${h.size}px`;
				if (h.type === "heart") {
					itemDiv.innerHTML = `<svg width="${h.size}" height="${h.size}" fill="${h.color}" viewBox="0 0 24 24" style="filter: drop-shadow(0 1px 5px #fde2eb);">
            <path d="M12 21C12 21 4 13.678 4 8.57143C4 5.01683 7.13401 2 10.8571 2C12.2222 2 13.5556 2.59921 14.5714 3.66883C15.5873 2.59921 16.9206 2 18.2857 2C22.0088 2 25.1429 5.01683 25.1429 8.57143C25.1429 13.678 17.1429 21 17.1429 21H12Z"/>
          </svg>`;
				} else {
					itemDiv.innerHTML = `<svg width="${h.size}" height="${h.size}" fill="none" stroke="${h.color}" stroke-width="1.8" viewBox="0 0 24 24" style="filter: drop-shadow(0 1px 6px #fecde1);">
            <rect width="18" height="13" x="3" y="8" rx="2"/>
            <path d="M12 8V21"/>
            <path d="M7 8V5a3 3 0 1 1 6 0v3"/>
            <path d="M17 8V5a3 3 0 1 0-6 0v3"/>
          </svg>`;
				}
				canvas.appendChild(itemDiv);

				// Update position
				h.y += h.speed;
				h.sway += h.swaySpeed;
				if (h.y > height + 44) {
					h.y = -44;
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

export default GiftHeartParticles;
