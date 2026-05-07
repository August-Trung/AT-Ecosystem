import React, { useEffect, useRef } from "react";

// SVGs for photo and video icons
const albumIconSVG = (size: number) => `
  <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#F87171" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="4" fill="#fff2f4"/>
    <path d="M2 8h20"  />
    <circle cx="8" cy="12" r="2.5" fill="#fd7aaa"/>
    <path d="M20 19l-4.43-5.88a2 2 0 0 0-3.13 0L6 19" />
  </svg>
`;
const photoIconSVG = (size: number) => `
  <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#d946ef" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="4" fill="#fde2f3"/>
    <circle cx="8" cy="8" r="2.2" fill="#fbbfdf"/>
    <path d="M21 15l-5.27-7.05a1.6 1.6 0 0 0-2.56 0L3 21" />
  </svg>
`;
const videoIconSVG = (size: number) => `
  <svg width="${size}" height="${size}" viewBox="0 0 22 22" fill="none" stroke="#10b981" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2.7" y="4.4" width="12" height="13" rx="3" fill="#ddfaea"/>
    <path d="m15 8.5 4-2.7v9.9l-4-2.7" />
    <polygon points="8.8,10.8 11.4,12.3 8.8,13.8" fill="#6ee7b7"/>
  </svg>
`;

const ICONS = [albumIconSVG, photoIconSVG, videoIconSVG];

const AlbumParticles: React.FC = () => {
	const ref = useRef<HTMLDivElement>(null);
	const req = useRef<number>();

	useEffect(() => {
		const root = ref.current;
		if (!root) return;

		let width = window.innerWidth,
			height = window.innerHeight;

		const iconCount = Math.floor(width / 90);
		let items = Array.from({ length: iconCount }, () => ({
			x: Math.random() * width,
			y: Math.random() * height,
			size: 36 + Math.random() * 16,
			speed: 1 + Math.random() * 0.8,
			sway: Math.random() * 2 * Math.PI,
			swaySpeed: 0.008 + Math.random() * 0.012,
			alpha: 0.5 + Math.random() * 0.3,
			iconIdx: Math.floor(Math.random() * ICONS.length),
		}));

		const render = () => {
			while (root.firstChild) root.removeChild(root.firstChild);
			items.forEach((i) => {
				const d = document.createElement("div");
				d.style.position = "absolute";
				d.style.left = `${
					i.x + Math.sin(Date.now() / 900 + i.sway) * 13
				}px`;
				d.style.top = `${i.y}px`;
				d.style.opacity = `${i.alpha}`;
				d.style.pointerEvents = "none";
				d.style.zIndex = "1";
				d.style.transition = "none";
				d.style.width = `${i.size}px`;
				d.style.height = `${i.size}px`;
				d.innerHTML = ICONS[i.iconIdx](i.size);
				root.appendChild(d);

				i.y += i.speed;
				i.sway += i.swaySpeed;
				if (i.y > height + 40) {
					i.y = -40;
					i.x = Math.random() * width;
					i.iconIdx = Math.floor(Math.random() * ICONS.length);
				}
			});

			req.current = requestAnimationFrame(render);
		};

		render();
		function handleResize() {
			width = window.innerWidth;
			height = window.innerHeight;
			const iconCount = Math.floor(width / 90);
			items = Array.from({ length: iconCount }, () => ({
				x: Math.random() * width,
				y: Math.random() * height,
				size: 36 + Math.random() * 16,
				speed: 1 + Math.random() * 0.8,
				sway: Math.random() * 2 * Math.PI,
				swaySpeed: 0.008 + Math.random() * 0.012,
				alpha: 0.5 + Math.random() * 0.3,
				iconIdx: Math.floor(Math.random() * ICONS.length),
			}));
		}
		window.addEventListener("resize", handleResize);

		return () => {
			cancelAnimationFrame(req.current!);
			window.removeEventListener("resize", handleResize);
		};
	}, []);

	return (
		<div
			ref={ref}
			className="fixed inset-0 z-0 pointer-events-none select-none"
			style={{ width: "100vw", height: "100vh" }}
			aria-hidden="true"
		/>
	);
};

export default AlbumParticles;
