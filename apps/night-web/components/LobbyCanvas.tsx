import React, { useEffect, useRef, useCallback } from "react";
import {
	Avatar,
	AVATAR_ICONS,
	LobbyPeer,
	ROOM_WIDTH,
	ROOM_HEIGHT,
	GROUND_Y,
	BARTENDER_X,
	BARTENDER_ZONE,
} from "../types";
import { lobbyPresence } from "../services/lobbyPresenceService";

interface LobbyCanvasProps {
	myAvatar: Avatar;
	myAlias: string;
	isNearBartender: boolean;
	onNearBartenderChange: (isNear: boolean) => void;
}

// Avatar head colors
const AVATAR_COLORS: Record<Avatar, string> = {
	cat: "#f59e0b",
	robot: "#64748b",
	ghost: "#e2e8f0",
	alien: "#22c55e",
	human: "#fbbf24",
	pig: "#f9a8d4",
	cow: "#fef3c7",
};

const WALK_SPEED = 3;
const CHAR_WIDTH = 20;
const CHAR_HEIGHT = 30;
const HEAD_SIZE = 12;
const BODY_HEIGHT = 14;
const LEG_WIDTH = 4;
const LEG_HEIGHT = 8;
const EMOJI_DURATION = 3000;
const EMOJI_FADE_MS = 500;

const LobbyCanvas: React.FC<LobbyCanvasProps> = ({
	myAvatar,
	myAlias,
	isNearBartender,
	onNearBartenderChange,
}) => {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const animationFrameRef = useRef<number | null>(null);
	const cachedBgRef = useRef<OffscreenCanvas | null>(null);

	// Animation state refs (avoid re-renders)
	const frameRef = useRef(0);
	const myXRef = useRef(200);
	const myDirectionRef = useRef<"left" | "right">("right");
	const keysRef = useRef({ left: false, right: false });
	const targetXRef = useRef<number | null>(null);
	const walkFrameRef = useRef(0);
	const isMovingRef = useRef(false);
	const peersRef = useRef<LobbyPeer[]>([]);
	const nearBartenderRef = useRef(false);
	const scaleInfoRef = useRef({ scale: 1, offsetX: 0, offsetY: 0 });

	// ─────────────────────────────────────────────
	// Draw static room background to OffscreenCanvas
	// ─────────────────────────────────────────────
	const buildRoomBackground = useCallback((): OffscreenCanvas => {
		const offscreen = new OffscreenCanvas(ROOM_WIDTH, ROOM_HEIGHT);
		const ctx = offscreen.getContext("2d")!;
		ctx.imageSmoothingEnabled = false;

		// === WALL BACKGROUND ===
		ctx.fillStyle = "#0f0a1a";
		ctx.fillRect(0, 0, ROOM_WIDTH, ROOM_HEIGHT);

		// === CEILING with brick pattern ===
		ctx.fillStyle = "#0a0812";
		ctx.fillRect(0, 0, ROOM_WIDTH, 60);
		ctx.fillStyle = "rgba(20, 15, 30, 0.6)";
		for (let row = 0; row < 4; row++) {
			for (let col = 0; col < 40; col++) {
				const bx = col * 32 + (row % 2 === 0 ? 0 : 16);
				const by = row * 15;
				ctx.strokeStyle = "rgba(40, 30, 50, 0.5)";
				ctx.lineWidth = 1;
				ctx.strokeRect(bx, by, 30, 14);
			}
		}

		// === FLOOR ===
		ctx.fillStyle = "#1a1520";
		ctx.fillRect(0, GROUND_Y, ROOM_WIDTH, ROOM_HEIGHT - GROUND_Y);
		// Alternating tile pattern
		for (let tx = 0; tx < ROOM_WIDTH; tx += 40) {
			if ((tx / 40) % 2 === 0) {
				ctx.fillStyle = "#241e2e";
				ctx.fillRect(tx, GROUND_Y, 40, ROOM_HEIGHT - GROUND_Y);
			}
		}
		// Floor edge highlight
		ctx.fillStyle = "#2a2235";
		ctx.fillRect(0, GROUND_Y, ROOM_WIDTH, 3);

		// === DOOR (left side) ===
		// Door frame
		ctx.fillStyle = "#5c3d24";
		ctx.fillRect(30, GROUND_Y - 100, 60, 103);
		// Door body
		ctx.fillStyle = "#1a0f0a";
		ctx.fillRect(34, GROUND_Y - 96, 52, 96);
		// Door handle
		ctx.fillStyle = "#fbbf24";
		ctx.fillRect(74, GROUND_Y - 52, 4, 8);
		// Door panels
		ctx.strokeStyle = "#2d1a10";
		ctx.lineWidth = 1;
		ctx.strokeRect(40, GROUND_Y - 90, 40, 35);
		ctx.strokeRect(40, GROUND_Y - 48, 40, 35);
		// EXIT text above door
		ctx.font = "11px VT323, monospace";
		ctx.fillStyle = "#ef4444";
		ctx.shadowColor = "#ef4444";
		ctx.shadowBlur = 6;
		ctx.textAlign = "center";
		ctx.fillText("EXIT", 60, GROUND_Y - 108);
		ctx.shadowBlur = 0;

		// === WINDOW (left area) ===
		// Window frame
		ctx.fillStyle = "#0a0a2e";
		ctx.fillRect(140, 70, 80, 100);
		// Window glass
		ctx.fillStyle = "#1a1a4a";
		ctx.fillRect(146, 76, 68, 88);
		// Moon / warm light spots
		ctx.fillStyle = "rgba(217, 223, 74, 0.15)";
		ctx.fillRect(160, 86, 18, 18);
		ctx.fillStyle = "rgba(217, 223, 74, 0.08)";
		ctx.fillRect(155, 110, 30, 20);
		// Window cross bar
		ctx.fillStyle = "#0a0a2e";
		ctx.fillRect(146, 118, 68, 3);
		ctx.fillRect(178, 76, 3, 88);
		// Stars outside window
		ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
		ctx.fillRect(195, 85, 2, 2);
		ctx.fillRect(205, 95, 1, 1);
		ctx.fillRect(155, 92, 1, 1);

		// === NEON SIGN "LOUNGE" ===
		ctx.font = "bold 28px VT323, monospace";
		ctx.textAlign = "center";
		ctx.shadowColor = "#818cf8";
		ctx.shadowBlur = 20;
		ctx.fillStyle = "#818cf8";
		ctx.fillText("LOUNGE", 500, 100);
		ctx.shadowBlur = 12;
		ctx.fillText("LOUNGE", 500, 100);
		ctx.shadowBlur = 0;
		// Neon border
		ctx.strokeStyle = "rgba(129, 140, 248, 0.3)";
		ctx.lineWidth = 1;
		ctx.strokeRect(430, 72, 140, 38);

		// === JUKEBOX (left area) ===
		// Body
		ctx.fillStyle = "#2d1f5e";
		ctx.fillRect(110, GROUND_Y - 80, 40, 80);
		// Top arch (simplified)
		ctx.fillStyle = "#3d2b7e";
		ctx.fillRect(112, GROUND_Y - 88, 36, 10);
		// Screen
		ctx.fillStyle = "#4f46e5";
		ctx.fillRect(117, GROUND_Y - 70, 26, 20);
		// Screen glow
		ctx.shadowColor = "#818cf8";
		ctx.shadowBlur = 8;
		ctx.fillStyle = "#818cf8";
		ctx.fillRect(120, GROUND_Y - 66, 20, 12);
		ctx.shadowBlur = 0;
		// Speaker grille
		ctx.fillStyle = "#1a1040";
		for (let sy = 0; sy < 5; sy++) {
			ctx.fillRect(120, GROUND_Y - 42 + sy * 6, 20, 3);
		}
		// Jukebox label
		ctx.font = "7px VT323, monospace";
		ctx.fillStyle = "#fbbf24";
		ctx.textAlign = "center";
		ctx.fillText("♪ MUSIC ♪", 130, GROUND_Y - 73);
		// Music notes floating above
		ctx.font = "10px serif";
		ctx.fillStyle = "rgba(129, 140, 248, 0.5)";
		ctx.fillText("♫", 120, GROUND_Y - 95);
		ctx.fillText("♪", 140, GROUND_Y - 100);

		// === STOOLS ===
		const drawStool = (sx: number) => {
			// Seat
			ctx.fillStyle = "#3d2817";
			ctx.fillRect(sx - 8, GROUND_Y - 26, 16, 4);
			// Leg
			ctx.fillStyle = "#5c3d24";
			ctx.fillRect(sx - 2, GROUND_Y - 22, 4, 22);
			// Footrest
			ctx.fillStyle = "#3d2817";
			ctx.fillRect(sx - 6, GROUND_Y - 8, 12, 3);
		};
		drawStool(340);
		drawStool(420);
		drawStool(700);
		drawStool(780);

		// === BAR BACK WALL / SHELVES ===
		ctx.fillStyle = "#1a1028";
		ctx.fillRect(830, 80, 320, 200);
		// Shelf planks
		ctx.fillStyle = "#2d1f3e";
		ctx.fillRect(840, 130, 300, 4);
		ctx.fillRect(840, 190, 300, 4);
		ctx.fillRect(840, 250, 300, 4);

		// Bottles on shelves
		const bottleColors = ["#ef4444", "#22d3ee", "#a78bfa", "#f59e0b", "#ec4899", "#34d399"];
		const drawBottle = (bx: number, by: number, color: string, height: number) => {
			// Bottle body
			ctx.fillStyle = color;
			ctx.fillRect(bx, by - height, 6, height);
			// Neck
			ctx.fillStyle = color;
			ctx.fillRect(bx + 1, by - height - 6, 4, 6);
			// Cap
			ctx.fillStyle = "#fef3c7";
			ctx.fillRect(bx + 1, by - height - 8, 4, 2);
			// Label
			ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
			ctx.fillRect(bx, by - height + 4, 6, 6);
		};
		// Top shelf bottles
		drawBottle(855, 130, bottleColors[0], 28);
		drawBottle(870, 130, bottleColors[1], 24);
		drawBottle(888, 130, bottleColors[2], 30);
		drawBottle(905, 130, bottleColors[3], 26);
		drawBottle(925, 130, bottleColors[4], 22);
		drawBottle(945, 130, bottleColors[5], 28);
		drawBottle(965, 130, bottleColors[0], 25);
		drawBottle(985, 130, bottleColors[1], 30);
		drawBottle(1010, 130, bottleColors[2], 24);
		drawBottle(1030, 130, bottleColors[3], 28);
		drawBottle(1055, 130, bottleColors[4], 26);
		drawBottle(1080, 130, bottleColors[5], 22);
		// Middle shelf bottles
		drawBottle(860, 190, bottleColors[3], 22);
		drawBottle(880, 190, bottleColors[0], 26);
		drawBottle(900, 190, bottleColors[5], 20);
		drawBottle(920, 190, bottleColors[2], 28);
		drawBottle(950, 190, bottleColors[1], 24);
		drawBottle(975, 190, bottleColors[4], 22);
		drawBottle(1000, 190, bottleColors[3], 26);
		drawBottle(1025, 190, bottleColors[0], 20);
		drawBottle(1060, 190, bottleColors[5], 24);
		drawBottle(1090, 190, bottleColors[2], 28);
		// Bottom shelf — glasses
		for (let gx = 850; gx < 1130; gx += 18) {
			ctx.fillStyle = "rgba(200, 220, 255, 0.12)";
			ctx.fillRect(gx, 240, 8, 12);
			ctx.fillRect(gx + 1, 236, 6, 4);
		}

		// === BAR COUNTER ===
		// Counter back face
		ctx.fillStyle = "#2d1a10";
		ctx.fillRect(620, 260, 540, 130);
		// Counter front face (drawn later in render for depth, but static part here)
		ctx.fillStyle = "#3d2817";
		ctx.fillRect(620, 310, 540, 80);
		// Counter top edge highlight
		ctx.fillStyle = "#5c3d24";
		ctx.fillRect(618, 308, 544, 4);
		// Counter wood grain details
		ctx.strokeStyle = "rgba(92, 61, 36, 0.3)";
		ctx.lineWidth = 1;
		for (let gy = 320; gy < 390; gy += 12) {
			ctx.beginPath();
			ctx.moveTo(622, gy);
			ctx.lineTo(1158, gy);
			ctx.stroke();
		}

		// === SMALL TABLE (left side) ===
		ctx.fillStyle = "#3d2817";
		ctx.fillRect(280, GROUND_Y - 40, 50, 4);
		ctx.fillRect(302, GROUND_Y - 36, 4, 36);
		// Candle on table
		ctx.fillStyle = "#fef3c7";
		ctx.fillRect(300, GROUND_Y - 52, 5, 12);
		ctx.fillStyle = "#f59e0b";
		ctx.fillRect(301, GROUND_Y - 55, 3, 4);

		// === PICTURE FRAMES on wall ===
		// Frame 1
		ctx.strokeStyle = "#5c3d24";
		ctx.lineWidth = 2;
		ctx.strokeRect(300, 100, 50, 40);
		ctx.fillStyle = "#1a1028";
		ctx.fillRect(302, 102, 46, 36);
		ctx.fillStyle = "rgba(129, 140, 248, 0.15)";
		ctx.fillRect(310, 110, 30, 20);
		// Frame 2
		ctx.strokeStyle = "#5c3d24";
		ctx.strokeRect(380, 90, 40, 50);
		ctx.fillStyle = "#1a1028";
		ctx.fillRect(382, 92, 36, 46);
		ctx.fillStyle = "rgba(239, 68, 68, 0.12)";
		ctx.fillRect(388, 100, 24, 30);

		// === HANGING LIGHTS ===
		const drawHangingLight = (lx: number) => {
			ctx.strokeStyle = "#2d2040";
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(lx, 0);
			ctx.lineTo(lx, 50);
			ctx.stroke();
			// Bulb
			ctx.fillStyle = "#fbbf24";
			ctx.fillRect(lx - 4, 48, 8, 6);
			ctx.fillStyle = "#f59e0b";
			ctx.fillRect(lx - 3, 54, 6, 4);
			// Shade
			ctx.fillStyle = "#1a1028";
			ctx.fillRect(lx - 8, 44, 16, 5);
		};
		drawHangingLight(250);
		drawHangingLight(500);
		drawHangingLight(750);
		drawHangingLight(1000);

		// === FLOOR BASEBOARD ===
		ctx.fillStyle = "#2d1a10";
		ctx.fillRect(0, GROUND_Y - 3, ROOM_WIDTH, 3);

		// === WALL WAINSCOTING ===
		ctx.fillStyle = "rgba(26, 16, 40, 0.5)";
		ctx.fillRect(0, GROUND_Y - 50, 100, 50);
		ctx.fillRect(0, GROUND_Y - 50, ROOM_WIDTH, 2);

		return offscreen;
	}, []);

	// ─────────────────────────────────────────────
	// Draw a character sprite
	// ─────────────────────────────────────────────
	const drawCharacter = useCallback(
		(
			ctx: CanvasRenderingContext2D,
			x: number,
			y: number,
			avatar: Avatar,
			alias: string,
			direction: "left" | "right",
			frame: number,
			isWalking: boolean,
			isBartender: boolean,
			emoji?: string,
			emojiExpiry?: number,
		) => {
			const headColor = AVATAR_COLORS[avatar] || "#fbbf24";
			const charW = isBartender ? 24 : CHAR_WIDTH;
			const charH = isBartender ? 36 : CHAR_HEIGHT;
			const headSz = isBartender ? 14 : HEAD_SIZE;
			const bodySz = isBartender ? 16 : BODY_HEIGHT;
			const legW = LEG_WIDTH;
			const legH = isBartender ? 10 : LEG_HEIGHT;

			const centerX = x;
			const feetY = y;

			// Walking leg animation
			const walkCycle = Math.floor(frame / 8) % 2;
			const leftLegOffset = isWalking ? (walkCycle === 0 ? -2 : 2) : 0;
			const rightLegOffset = isWalking ? (walkCycle === 0 ? 2 : -2) : 0;

			// Body position
			const bodyX = centerX - charW / 2 + (charW - headSz) / 2;
			const bodyTop = feetY - legH - bodySz;

			// Legs
			const legBaseY = feetY - legH;
			if (isBartender) {
				// Bartender legs hidden behind counter, just draw upper body
			} else {
				ctx.fillStyle = "#1e1b4b";
				// Left leg
				ctx.fillRect(
					bodyX + 1 + leftLegOffset,
					legBaseY,
					legW,
					legH,
				);
				// Right leg
				ctx.fillRect(
					bodyX + headSz - legW - 1 + rightLegOffset,
					legBaseY,
					legW,
					legH,
				);
				// Shoes
				ctx.fillStyle = "#1a1028";
				ctx.fillRect(bodyX + 1 + leftLegOffset, feetY - 3, legW + 1, 3);
				ctx.fillRect(bodyX + headSz - legW - 1 + rightLegOffset, feetY - 3, legW + 1, 3);
			}

			// Body
			if (isBartender) {
				// White shirt
				ctx.fillStyle = "#e2e8f0";
				ctx.fillRect(bodyX, bodyTop, headSz, bodySz);
				// Vest
				ctx.fillStyle = "#1e1b4b";
				ctx.fillRect(bodyX, bodyTop, 3, bodySz);
				ctx.fillRect(bodyX + headSz - 3, bodyTop, 3, bodySz);
				// Bow tie
				ctx.fillStyle = "#ef4444";
				ctx.fillRect(bodyX + headSz / 2 - 3, bodyTop - 1, 6, 4);
				ctx.fillStyle = "#dc2626";
				ctx.fillRect(bodyX + headSz / 2 - 1, bodyTop, 2, 2);
			} else {
				ctx.fillStyle = "#3730a3";
				ctx.fillRect(bodyX, bodyTop, headSz, bodySz);
				// Belt detail
				ctx.fillStyle = "#1e1b4b";
				ctx.fillRect(bodyX, bodyTop + bodySz - 2, headSz, 2);
			}

			// Head colored block
			const headTop = bodyTop - headSz;
			ctx.fillStyle = headColor;
			ctx.fillRect(bodyX, headTop, headSz, headSz);

			// Eyes (direction indicates which side)
			ctx.fillStyle = "#0f172a";
			if (direction === "right") {
				ctx.fillRect(bodyX + headSz - 5, headTop + 4, 2, 2);
				ctx.fillRect(bodyX + headSz - 9, headTop + 4, 2, 2);
			} else {
				ctx.fillRect(bodyX + 3, headTop + 4, 2, 2);
				ctx.fillRect(bodyX + 7, headTop + 4, 2, 2);
			}

			// Emoji avatar head (drawn above the pixel head)
			const emojiIcon = AVATAR_ICONS[avatar];
			ctx.font = isBartender ? "20px serif" : "18px serif";
			ctx.textAlign = "center";
			ctx.fillText(emojiIcon, centerX, headTop - 2);

			// Name tag below feet
			ctx.font = "11px VT323, monospace";
			ctx.textAlign = "center";
			if (isBartender) {
				ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
				ctx.fillText(alias, centerX + 1, feetY + 13);
				ctx.fillStyle = "#fbbf24";
			} else {
				ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
				ctx.fillText(alias, centerX + 1, feetY + 13);
				ctx.fillStyle = "#e2e8f0";
			}
			ctx.fillText(alias, centerX, feetY + 12);

			// Emoji bubble
			if (emoji && emojiExpiry && Date.now() < emojiExpiry) {
				const timeLeft = emojiExpiry - Date.now();
				let bubbleAlpha = 1;
				if (timeLeft < EMOJI_FADE_MS) {
					bubbleAlpha = timeLeft / EMOJI_FADE_MS;
				}

				ctx.save();
				ctx.globalAlpha = bubbleAlpha;

				// Speech bubble
				const bubbleX = centerX - 14;
				const bubbleY = headTop - 38;
				ctx.fillStyle = "rgba(30, 27, 75, 0.85)";
				ctx.beginPath();
				ctx.roundRect(bubbleX, bubbleY, 28, 24, 4);
				ctx.fill();
				ctx.strokeStyle = "rgba(129, 140, 248, 0.5)";
				ctx.lineWidth = 1;
				ctx.beginPath();
				ctx.roundRect(bubbleX, bubbleY, 28, 24, 4);
				ctx.stroke();

				// Bubble tail
				ctx.fillStyle = "rgba(30, 27, 75, 0.85)";
				ctx.beginPath();
				ctx.moveTo(centerX - 3, bubbleY + 24);
				ctx.lineTo(centerX, bubbleY + 30);
				ctx.lineTo(centerX + 3, bubbleY + 24);
				ctx.fill();

				// Emoji text
				ctx.font = "16px serif";
				ctx.textAlign = "center";
				ctx.fillStyle = "#ffffff";
				ctx.fillText(emoji, centerX, bubbleY + 18);

				ctx.restore();
			}
		},
		[],
	);

	// ─────────────────────────────────────────────
	// Main Effect: setup canvas, listeners, loop
	// ─────────────────────────────────────────────
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		// Build cached room background
		cachedBgRef.current = buildRoomBackground();

		// ── Resize handler ──
		const handleResize = () => {
			const parent = canvas.parentElement;
			if (!parent) return;
			const containerW = parent.clientWidth;
			const containerH = parent.clientHeight;
			canvas.width = containerW;
			canvas.height = containerH;
			const scale = Math.min(containerW / ROOM_WIDTH, containerH / ROOM_HEIGHT);
			const offsetX = (containerW - ROOM_WIDTH * scale) / 2;
			const offsetY = (containerH - ROOM_HEIGHT * scale) / 2;
			scaleInfoRef.current = { scale, offsetX, offsetY };
		};
		handleResize();
		window.addEventListener("resize", handleResize);

		// ── Keyboard handlers ──
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
				keysRef.current.left = true;
				targetXRef.current = null; // Cancel click-to-move
			}
			if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
				keysRef.current.right = true;
				targetXRef.current = null;
			}
		};
		const handleKeyUp = (e: KeyboardEvent) => {
			if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
				keysRef.current.left = false;
			}
			if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
				keysRef.current.right = false;
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		window.addEventListener("keyup", handleKeyUp);

		// ── Click-to-move handler ──
		const handleCanvasClick = (e: MouseEvent) => {
			const rect = canvas.getBoundingClientRect();
			const { scale, offsetX, offsetY } = scaleInfoRef.current;
			// Convert screen coords to logical coords
			const logicalX = (e.clientX - rect.left - offsetX) / scale;
			const logicalY = (e.clientY - rect.top - offsetY) / scale;

			// Only move if click is within the room bounds
			if (logicalX >= 0 && logicalX <= ROOM_WIDTH && logicalY >= 0 && logicalY <= ROOM_HEIGHT) {
				targetXRef.current = Math.max(40, Math.min(ROOM_WIDTH - 40, logicalX));
			}
		};
		canvas.addEventListener("click", handleCanvasClick);

		// ── Peer updates ──
		lobbyPresence.onPeersUpdate = (peers: LobbyPeer[]) => {
			peersRef.current = peers;
		};

		// ── Animation loop ──
		let lastRender = 0;
		const fpsInterval = 1000 / 24; // 24 FPS cap

		const render = (timestamp: number) => {
			if (document.hidden) {
				animationFrameRef.current = requestAnimationFrame(render);
				return;
			}

			animationFrameRef.current = requestAnimationFrame(render);

			const elapsed = timestamp - lastRender;
			if (elapsed < fpsInterval) return;
			lastRender = timestamp - (elapsed % fpsInterval);

			frameRef.current++;
			const frame = frameRef.current;
			const w = canvas.width;
			const h = canvas.height;
			const { scale, offsetX, offsetY } = scaleInfoRef.current;

			// ── Update movement ──
			let moved = false;
			const prevX = myXRef.current;

			// Keyboard movement
			if (keysRef.current.left) {
				myXRef.current -= WALK_SPEED;
				myDirectionRef.current = "left";
				moved = true;
			}
			if (keysRef.current.right) {
				myXRef.current += WALK_SPEED;
				myDirectionRef.current = "right";
				moved = true;
			}

			// Click-to-move
			if (!moved && targetXRef.current !== null) {
				const diff = targetXRef.current - myXRef.current;
				if (Math.abs(diff) > WALK_SPEED) {
					myXRef.current += diff > 0 ? WALK_SPEED : -WALK_SPEED;
					myDirectionRef.current = diff > 0 ? "right" : "left";
					moved = true;
				} else {
					myXRef.current = targetXRef.current;
					targetXRef.current = null;
					if (Math.abs(diff) > 0.5) moved = true;
				}
			}

			// Clamp position
			myXRef.current = Math.max(40, Math.min(ROOM_WIDTH - 40, myXRef.current));
			isMovingRef.current = moved;

			if (moved) {
				walkFrameRef.current++;
				lobbyPresence.updatePosition(
					Math.round(myXRef.current),
					GROUND_Y,
					myDirectionRef.current,
				);
			}

			// ── Bartender proximity check ──
			const distToBartender = Math.abs(myXRef.current - BARTENDER_X);
			const nowNear = distToBartender < BARTENDER_ZONE;
			if (nowNear !== nearBartenderRef.current) {
				nearBartenderRef.current = nowNear;
				onNearBartenderChange(nowNear);
			}

			// ── Clear canvas ──
			ctx.clearRect(0, 0, w, h);

			// ── Apply room transform ──
			ctx.save();
			ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
			ctx.imageSmoothingEnabled = false;

			// 1. Draw cached room background
			if (cachedBgRef.current) {
				ctx.drawImage(cachedBgRef.current, 0, 0);
			}

			// 2. Ceiling light glow pools on floor
			const drawGlowPool = (gx: number) => {
				const grad = ctx.createRadialGradient(gx, GROUND_Y + 10, 0, gx, GROUND_Y + 10, 120);
				grad.addColorStop(0, "rgba(217, 223, 74, 0.06)");
				grad.addColorStop(0.5, "rgba(217, 223, 74, 0.03)");
				grad.addColorStop(1, "rgba(217, 223, 74, 0)");
				ctx.fillStyle = grad;
				ctx.fillRect(gx - 120, GROUND_Y, 240, 60);
			};
			drawGlowPool(250);
			drawGlowPool(500);
			drawGlowPool(750);
			drawGlowPool(1000);

			// Ambient wall glow from neon sign
			const neonGlow = ctx.createRadialGradient(500, 90, 0, 500, 90, 200);
			neonGlow.addColorStop(0, "rgba(129, 140, 248, 0.06)");
			neonGlow.addColorStop(1, "rgba(129, 140, 248, 0)");
			ctx.fillStyle = neonGlow;
			ctx.fillRect(300, 0, 400, 280);

			// Jukebox screen glow
			const jukeGlow = ctx.createRadialGradient(130, GROUND_Y - 60, 0, 130, GROUND_Y - 60, 60);
			jukeGlow.addColorStop(0, "rgba(79, 70, 229, 0.08)");
			jukeGlow.addColorStop(1, "rgba(79, 70, 229, 0)");
			ctx.fillStyle = jukeGlow;
			ctx.fillRect(70, GROUND_Y - 120, 120, 120);

			// 3. Collect all characters and sort by X
			const bartenderBobY = Math.sin(frame / 30) * 2;
			const characters: Array<{
				x: number;
				y: number;
				avatar: Avatar;
				alias: string;
				direction: "left" | "right";
				frame: number;
				isWalking: boolean;
				isBartender: boolean;
				emoji?: string;
				emojiExpiry?: number;
			}> = [];

			// Bartender NPC
			characters.push({
				x: BARTENDER_X,
				y: 330 + bartenderBobY,
				avatar: "robot",
				alias: "Bartender",
				direction: "left",
				frame: frame,
				isWalking: false,
				isBartender: true,
			});

			// My character
			characters.push({
				x: myXRef.current,
				y: GROUND_Y,
				avatar: myAvatar,
				alias: myAlias,
				direction: myDirectionRef.current,
				frame: isMovingRef.current ? walkFrameRef.current : 0,
				isWalking: isMovingRef.current,
				isBartender: false,
			});

			// Peers
			peersRef.current.forEach((peer) => {
				characters.push({
					x: peer.x,
					y: GROUND_Y,
					avatar: peer.avatar,
					alias: peer.alias,
					direction: peer.direction,
					frame: frame,
					isWalking: false,
					isBartender: false,
					emoji: peer.emoji,
					emojiExpiry: peer.emojiExpiry,
				});
			});

			// Sort by X for depth ordering
			characters.sort((a, b) => a.x - b.x);

			// Draw characters
			characters.forEach((ch) => {
				drawCharacter(
					ctx,
					ch.x,
					ch.y,
					ch.avatar,
					ch.alias,
					ch.direction,
					ch.frame,
					ch.isWalking,
					ch.isBartender,
					ch.emoji,
					ch.emojiExpiry,
				);
			});

			// 4. Bar counter front face overlay (for depth — characters behind counter)
			ctx.fillStyle = "#3d2817";
			ctx.fillRect(620, 340, 540, 50);
			ctx.fillStyle = "#5c3d24";
			ctx.fillRect(618, 338, 544, 4);
			// Counter edge shadow
			ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
			ctx.fillRect(620, 388, 540, 2);

			// Counter top items
			// Glass
			ctx.fillStyle = "rgba(200, 220, 255, 0.15)";
			ctx.fillRect(700, 328, 8, 12);
			ctx.fillStyle = "rgba(200, 220, 255, 0.1)";
			ctx.fillRect(701, 324, 6, 4);
			// Napkin stack
			ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
			ctx.fillRect(750, 330, 14, 8);
			// Another glass
			ctx.fillStyle = "rgba(200, 220, 255, 0.12)";
			ctx.fillRect(850, 326, 8, 14);
			ctx.fillRect(851, 322, 6, 4);

			// 5. Interaction prompt (if near bartender)
			if (nearBartenderRef.current) {
				const promptBob = Math.sin(frame / 12) * 3;
				const promptY = 270 + promptBob;
				const promptText = "💬 Nói chuyện với Bartender";

				ctx.font = "13px VT323, monospace";
				const textWidth = ctx.measureText(promptText).width;
				const promptX = BARTENDER_X - textWidth / 2 - 10;

				// Prompt background
				ctx.fillStyle = "rgba(79, 70, 229, 0.8)";
				ctx.beginPath();
				ctx.roundRect(promptX, promptY - 4, textWidth + 20, 22, 4);
				ctx.fill();

				// Prompt border
				ctx.strokeStyle = "#818cf8";
				ctx.lineWidth = 1;
				ctx.beginPath();
				ctx.roundRect(promptX, promptY - 4, textWidth + 20, 22, 4);
				ctx.stroke();

				// Prompt text
				ctx.fillStyle = "#e2e8f0";
				ctx.textAlign = "center";
				ctx.fillText(promptText, BARTENDER_X, promptY + 12);
			}

			// 6. Vignette around edges
			// Top vignette
			const vigTop = ctx.createLinearGradient(0, 0, 0, 80);
			vigTop.addColorStop(0, "rgba(0, 0, 0, 0.5)");
			vigTop.addColorStop(1, "rgba(0, 0, 0, 0)");
			ctx.fillStyle = vigTop;
			ctx.fillRect(0, 0, ROOM_WIDTH, 80);

			// Bottom vignette
			const vigBottom = ctx.createLinearGradient(0, ROOM_HEIGHT - 40, 0, ROOM_HEIGHT);
			vigBottom.addColorStop(0, "rgba(0, 0, 0, 0)");
			vigBottom.addColorStop(1, "rgba(0, 0, 0, 0.4)");
			ctx.fillStyle = vigBottom;
			ctx.fillRect(0, ROOM_HEIGHT - 40, ROOM_WIDTH, 40);

			// Left vignette
			const vigLeft = ctx.createLinearGradient(0, 0, 60, 0);
			vigLeft.addColorStop(0, "rgba(0, 0, 0, 0.4)");
			vigLeft.addColorStop(1, "rgba(0, 0, 0, 0)");
			ctx.fillStyle = vigLeft;
			ctx.fillRect(0, 0, 60, ROOM_HEIGHT);

			// Right vignette
			const vigRight = ctx.createLinearGradient(ROOM_WIDTH - 60, 0, ROOM_WIDTH, 0);
			vigRight.addColorStop(0, "rgba(0, 0, 0, 0)");
			vigRight.addColorStop(1, "rgba(0, 0, 0, 0.4)");
			ctx.fillStyle = vigRight;
			ctx.fillRect(ROOM_WIDTH - 60, 0, 60, ROOM_HEIGHT);

			// Neon sign flicker effect
			if (frame % 120 > 115) {
				ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
				ctx.fillRect(430, 72, 140, 38);
			}

			ctx.restore();
		};

		animationFrameRef.current = requestAnimationFrame(render);

		// ── Page Visibility API ──
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

		// ── Cleanup ──
		return () => {
			window.removeEventListener("resize", handleResize);
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("keyup", handleKeyUp);
			canvas.removeEventListener("click", handleCanvasClick);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
			if (animationFrameRef.current) {
				cancelAnimationFrame(animationFrameRef.current);
			}
			lobbyPresence.onPeersUpdate = () => {};
		};
	}, [myAvatar, myAlias, buildRoomBackground, drawCharacter, onNearBartenderChange]);

	return (
		<canvas
			ref={canvasRef}
			className="absolute inset-0 w-full h-full cursor-pointer"
			style={{ imageRendering: "pixelated" }}
		/>
	);
};

export default LobbyCanvas;
