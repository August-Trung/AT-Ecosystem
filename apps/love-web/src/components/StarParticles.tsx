import React, { useEffect, useRef } from "react";

const StarParticles: React.FC = () => {
	const canvasRef = useRef<HTMLDivElement>(null);
	const requestRef = useRef<number>();

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		let width = window.innerWidth,
			height = window.innerHeight;
		let starCount = Math.floor(width / 37);
		let stars = Array.from({ length: starCount }, () => ({
			x: Math.random() * width,
			y: Math.random() * height,
			size: 19 + Math.random() * 17,
			speed: 0.53 + Math.random() * 0.82,
			sway: Math.random() * 2 * Math.PI,
			swaySpeed: 0.008 + Math.random() * 0.015,
			alpha: 0.35 + Math.random() * 0.45,
		}));

		const render = () => {
			while (canvas.firstChild) canvas.removeChild(canvas.firstChild);

			stars.forEach((h) => {
				const starDiv = document.createElement("div");
				starDiv.style.position = "absolute";
				starDiv.style.left = `${
					h.x + Math.sin(Date.now() / 1200 + h.sway) * 13
				}px`;
				starDiv.style.top = `${h.y}px`;
				starDiv.style.opacity = `${h.alpha}`;
				starDiv.style.pointerEvents = "none";
				starDiv.style.zIndex = "1";
				starDiv.style.width = `${h.size}px`;
				starDiv.style.height = `${h.size}px`;
				starDiv.innerHTML = `<svg width="${h.size}" height="${h.size}" fill="#ffe66c" stroke="#efc924" stroke-width="1" viewBox="0 0 24 24"
          style="filter: drop-shadow(0 1px 6px #ffe66c);">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>`;
				canvas.appendChild(starDiv);

				// Update position
				h.y += h.speed;
				h.sway += h.swaySpeed;
				if (h.y > height + 33) {
					h.y = -33;
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

export default StarParticles;
