import React, { useEffect, useRef } from "react";

// 🎂 SVG mới - icon bánh sinh nhật vui nhộn, nổi bật phần kem và nến
const birthdayCakeSVG = (size: number) => `
  <svg width="${size}" height="${size}" viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g filter="url(#cake-drop-shadow)">
      <rect x="8" y="24" width="26" height="11" rx="4" fill="#FFD2EA" stroke="#E065A3" stroke-width="2"/>
      <ellipse cx="21" cy="24" rx="13" ry="6" fill="#fff6f7" stroke="#FC9CC8" stroke-width="1.5"/>
      <rect x="18.8" y="13" width="4.4" height="8" rx="2.2" fill="#FED766"/>
      <rect x="19.8" y="8.5" width="2.4" height="5" rx="1.2" fill="#FFB800"/>
    </g>
    <circle cx="21" cy="7.5" r="1.1" fill="#FF49A3"/>
    <defs>
      <filter id="cake-drop-shadow" x="0" y="0" width="42" height="42" filterUnits="userSpaceOnUse">
        <feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="#fde2eb"/>
      </filter>
    </defs>
  </svg>
`;

const CakeParticles: React.FC = () => {
	const canvasRef = useRef<HTMLDivElement>(null);
	const requestRef = useRef<number>();

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		let width = window.innerWidth,
			height = window.innerHeight;

		let cakeCount = Math.floor(width / 80);
		let cakes = Array.from({ length: cakeCount }, () => ({
			x: Math.random() * width,
			y: Math.random() * height,
			size: 36 + Math.random() * 18,
			speed: 0.8 + Math.random(),
			sway: Math.random() * 2 * Math.PI,
			swaySpeed: 0.007 + Math.random() * 0.016,
			alpha: 0.55 + Math.random() * 0.33,
		}));

		let cakeNodes: HTMLElement[] = [];

		const render = () => {
			while (canvas.firstChild) canvas.removeChild(canvas.firstChild);

			cakes.forEach((c, idx) => {
				const cakeDiv = document.createElement("div");
				cakeDiv.style.position = "absolute";
				cakeDiv.style.left = `${
					c.x + Math.sin(Date.now() / 700 + c.sway) * 13
				}px`;
				cakeDiv.style.top = `${c.y}px`;
				cakeDiv.style.opacity = `${c.alpha}`;
				cakeDiv.style.pointerEvents = "none";
				cakeDiv.style.zIndex = "1";
				cakeDiv.style.transition = "none";
				cakeDiv.style.width = `${c.size}px`;
				cakeDiv.style.height = `${c.size}px`;
				// Thay đổi SVG thành icon dễ thương hơn
				cakeDiv.innerHTML = birthdayCakeSVG(c.size);
				canvas.appendChild(cakeDiv);
				cakeNodes[idx] = cakeDiv;

				c.y += c.speed;
				c.sway += c.swaySpeed;
				if (c.y > height + 50) {
					c.y = -50;
					c.x = Math.random() * width;
				}
			});

			requestRef.current = requestAnimationFrame(render);
		};

		render();
		function handleResize() {
			width = window.innerWidth;
			height = window.innerHeight;
			cakeCount = Math.floor(width / 80);
			cakes = Array.from({ length: cakeCount }, () => ({
				x: Math.random() * width,
				y: Math.random() * height,
				size: 36 + Math.random() * 18,
				speed: 0.8 + Math.random(),
				sway: Math.random() * 2 * Math.PI,
				swaySpeed: 0.007 + Math.random() * 0.016,
				alpha: 0.55 + Math.random() * 0.33,
			}));
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

export default CakeParticles;
