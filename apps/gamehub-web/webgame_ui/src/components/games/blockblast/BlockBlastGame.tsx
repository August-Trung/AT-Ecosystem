import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import "./styles/BlockBlastGame.css";

const BOARD_SIZE = 10;
const TIMED_DURATION = 120;

type CellValue = string | null;

type ShapeDefinition = {
	id: string;
	color: string;
	blocks: Array<[number, number]>;
};

type Piece = ShapeDefinition & {
	uid: string;
	width: number;
	height: number;
	used: boolean;
};

type DragState = {
	pieceId: string;
	pointerId: number;
	clientX: number;
	clientY: number;
	boardRow: number | null;
	boardCol: number | null;
};

type PointerListenersState = {
	target: HTMLButtonElement;
	pointerId: number;
	move: (event: PointerEvent) => void;
	up: (event: PointerEvent) => void;
};

type GameMode = "classic" | "timed" | "daily";

const MODE_LABELS: Record<GameMode, string> = {
	classic: "Classic",
	timed: "Timed",
	daily: "Daily",
};

const MODE_OPTIONS: Array<{ id: GameMode; label: string; hint: string }> = [
	{ id: "classic", label: "Classic", hint: "Chơi thư thái, combo vô hạn" },
	{ id: "timed", label: "Timed", hint: "120 giây đếm ngược đầy áp lực" },
	{ id: "daily", label: "Daily", hint: "Seed cố định để chia sẻ bảng" },
];

const formatTime = (value: number) => {
	const minutes = Math.floor(value / 60)
		.toString()
		.padStart(2, "0");
	const seconds = Math.floor(value % 60)
		.toString()
		.padStart(2, "0");
	return `${minutes}:${seconds}`;
};

const getTodaySeed = () => {
	const now = new Date();
	const year = now.getFullYear();
	const month = `${now.getMonth() + 1}`.padStart(2, "0");
	const day = `${now.getDate()}`.padStart(2, "0");
	return `${year}-${month}-${day}`;
};

const stringToSeed = (input: string) => {
	let hash = 0;
	for (let index = 0; index < input.length; index += 1) {
		hash = Math.imul(31, hash) + input.charCodeAt(index);
		hash |= 0;
	}
	return hash || 1;
};

const createSeededRandom = (seedString: string) => {
	let seed = stringToSeed(seedString);
	return () => {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

const SHAPE_LIBRARY: ShapeDefinition[] = [
	{ id: "mono", color: "#fde047", blocks: [[0, 0]] },
	{
		id: "duo",
		color: "#fcd34d",
		blocks: [
			[0, 0],
			[1, 0],
		],
	},
	{
		id: "trio-line",
		color: "#fb923c",
		blocks: [
			[0, 0],
			[1, 0],
			[2, 0],
		],
	},
	{
		id: "quad-line",
		color: "#f97316",
		blocks: [
			[0, 0],
			[1, 0],
			[2, 0],
			[3, 0],
		],
	},
	{
		id: "penta-line",
		color: "#f472b6",
		blocks: [
			[0, 0],
			[1, 0],
			[2, 0],
			[3, 0],
			[4, 0],
		],
	},
	{
		id: "pair-vertical",
		color: "#a855f7",
		blocks: [
			[0, 0],
			[0, 1],
		],
	},
	{
		id: "trio-vertical",
		color: "#93c5fd",
		blocks: [
			[0, 0],
			[0, 1],
			[0, 2],
		],
	},
	{
		id: "square-2",
		color: "#4ade80",
		blocks: [
			[0, 0],
			[1, 0],
			[0, 1],
			[1, 1],
		],
	},
	{
		id: "square-3",
		color: "#34d399",
		blocks: [
			[0, 0],
			[1, 0],
			[2, 0],
			[0, 1],
			[1, 1],
			[2, 1],
			[0, 2],
			[1, 2],
			[2, 2],
		],
	},
	{
		id: "L-mini",
		color: "#38bdf8",
		blocks: [
			[0, 0],
			[0, 1],
			[0, 2],
			[1, 2],
		],
	},
	{
		id: "L-wide",
		color: "#60a5fa",
		blocks: [
			[0, 0],
			[1, 0],
			[2, 0],
			[2, 1],
			[2, 2],
		],
	},
	{
		id: "T-shape",
		color: "#c084fc",
		blocks: [
			[0, 0],
			[1, 0],
			[2, 0],
			[1, 1],
			[1, 2],
		],
	},
	{
		id: "zigzag",
		color: "#facc15",
		blocks: [
			[0, 0],
			[1, 0],
			[1, 1],
			[2, 1],
		],
	},
	{
		id: "stair",
		color: "#f87171",
		blocks: [
			[0, 0],
			[0, 1],
			[1, 1],
			[1, 2],
		],
	},
	{
		id: "plus",
		color: "#22d3ee",
		blocks: [
			[1, 0],
			[0, 1],
			[1, 1],
			[2, 1],
			[1, 2],
		],
	},
];

const createEmptyBoard = (): CellValue[][] =>
	Array.from({ length: BOARD_SIZE }, () =>
		Array<CellValue>(BOARD_SIZE).fill(null),
	);

const randomId = () => Math.random().toString(36).slice(2, 9);

const createPiece = (shape: ShapeDefinition): Piece => {
	const blocks = shape.blocks.map(
		([x, y]) => [x, y] as [number, number],
	);
	const width = Math.max(...blocks.map(([x]) => x)) + 1;
	const height = Math.max(...blocks.map(([, y]) => y)) + 1;

	return {
		...shape,
		blocks,
		width,
		height,
		uid: `${shape.id}-${randomId()}`,
		used: false,
	};
};

const generatePieceSet = (rng: () => number): Piece[] =>
	Array.from({ length: 3 }, () => {
		const shape = SHAPE_LIBRARY[Math.floor(rng() * SHAPE_LIBRARY.length)];
		return createPiece(shape);
	});

const canPlacePiece = (
	board: CellValue[][],
	piece: Piece,
	startX: number,
	startY: number,
) =>
	piece.blocks.every(([offsetX, offsetY]) => {
		const boardX = startX + offsetX;
		const boardY = startY + offsetY;
		return (
			boardX >= 0 &&
			boardX < BOARD_SIZE &&
			boardY >= 0 &&
			boardY < BOARD_SIZE &&
			!board[boardY][boardX]
		);
	});

const placePiece = (
	board: CellValue[][],
	piece: Piece,
	startX: number,
	startY: number,
) => {
	const nextBoard = board.map((row) => [...row]);
	piece.blocks.forEach(([offsetX, offsetY]) => {
		const boardX = startX + offsetX;
		const boardY = startY + offsetY;
		nextBoard[boardY][boardX] = piece.color;
	});
	return nextBoard;
};

const clearCompletedLines = (board: CellValue[][]) => {
	const rowsCleared: number[] = [];
	const colsCleared: number[] = [];

	board.forEach((row, rowIndex) => {
		if (row.every((cell) => Boolean(cell))) {
			rowsCleared.push(rowIndex);
		}
	});

	for (let col = 0; col < BOARD_SIZE; col += 1) {
		let isComplete = true;
		for (let row = 0; row < BOARD_SIZE; row += 1) {
			if (!board[row][col]) {
				isComplete = false;
				break;
			}
		}
		if (isComplete) {
			colsCleared.push(col);
		}
	}

	if (rowsCleared.length === 0 && colsCleared.length === 0) {
		return {
			board,
			rowsCleared,
			colsCleared,
			clearedKeys: [] as string[],
		};
	}

	const keys = new Set<string>();

	rowsCleared.forEach((row) => {
		for (let col = 0; col < BOARD_SIZE; col += 1) {
			keys.add(`${row}-${col}`);
		}
	});

	colsCleared.forEach((col) => {
		for (let row = 0; row < BOARD_SIZE; row += 1) {
			keys.add(`${row}-${col}`);
		}
	});

	const clearedBoard = board.map((row, rowIndex) =>
		row.map((cell, colIndex) =>
			keys.has(`${rowIndex}-${colIndex}`) ? null : cell,
		),
	);

	return {
		board: clearedBoard,
		rowsCleared,
		colsCleared,
		clearedKeys: Array.from(keys),
	};
};

const hasPlacement = (board: CellValue[][], piece: Piece) => {
	for (let row = 0; row < BOARD_SIZE; row += 1) {
		for (let col = 0; col < BOARD_SIZE; col += 1) {
			if (canPlacePiece(board, piece, col, row)) {
				return true;
			}
		}
	}
	return false;
};

export default function BlockBlastGame() {
	const rngRef = useRef<() => number>(() => Math.random());
	const timerRef = useRef<number | null>(null);
	const [mode, setMode] = useState<GameMode>("classic");
	const [dailySeed, setDailySeed] = useState(() => getTodaySeed());
	const [timeRemaining, setTimeRemaining] = useState(TIMED_DURATION);
	const [timedActive, setTimedActive] = useState(false);
	const [board, setBoard] = useState<CellValue[][]>(() => createEmptyBoard());
	const [pieces, setPieces] = useState<Piece[]>(() =>
		generatePieceSet(rngRef.current),
	);
	const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
	const [score, setScore] = useState(0);
	const [bestScore, setBestScore] = useState(0);
	const [gameOver, setGameOver] = useState(false);
	const [clearedCells, setClearedCells] = useState<string[]>([]);
	const [isMobile, setIsMobile] = useState(false);
	const [dragState, setDragState] = useState<DragState | null>(null);
	const [comboMessage, setComboMessage] = useState<string | null>(null);
	const [endType, setEndType] = useState<"out-of-moves" | "timeout" | null>(null);
	const boardRef = useRef<HTMLDivElement | null>(null);
	const boardMetricsRef = useRef<{
		rect: DOMRectReadOnly;
		cellWidth: number;
		cellHeight: number;
	} | null>(null);
	const audioCtxRef = useRef<AudioContext | null>(null);
	const dragStateRef = useRef<DragState | null>(null);
	const comboTimeoutRef = useRef<number | null>(null);
	const pointerListenersRef = useRef<PointerListenersState | null>(null);

	const cleanupPointerListeners = useCallback(() => {
		const active = pointerListenersRef.current;
		if (!active) {
			return;
		}
		const { target, pointerId, move, up } = active;
		target.removeEventListener("pointermove", move);
		target.removeEventListener("pointerup", up);
		target.removeEventListener("pointercancel", up);
		try {
			target.releasePointerCapture?.(pointerId);
		} catch {
			// ignore if release fails
		}
		pointerListenersRef.current = null;
	}, []);

	useEffect(() => {
		dragStateRef.current = dragState;
	}, [dragState]);

	useEffect(() => {
		return () => {
			if (comboTimeoutRef.current) {
				window.clearTimeout(comboTimeoutRef.current);
			}
			cleanupPointerListeners();
			if (timerRef.current) {
				window.clearInterval(timerRef.current);
			}
		};
	}, [cleanupPointerListeners]);

	const initializeRandomForMode = useCallback(
		(targetMode: GameMode, seedOverride?: string) => {
			if (targetMode === "daily") {
				const finalSeed = seedOverride ?? dailySeed ?? getTodaySeed();
				rngRef.current = createSeededRandom(finalSeed);
				if (finalSeed !== dailySeed) {
					setDailySeed(finalSeed);
				}
			} else {
				rngRef.current = () => Math.random();
			}
		},
		[dailySeed],
	);

	const resetGameState = useCallback(
		(targetMode: GameMode, options?: { seed?: string }) => {
			initializeRandomForMode(targetMode, options?.seed);
			setBoard(createEmptyBoard());
			setPieces(generatePieceSet(rngRef.current));
			setScore(0);
			setSelectedPieceId(null);
			setClearedCells([]);
			setDragState(null);
			dragStateRef.current = null;
			cleanupPointerListeners();
			if (timerRef.current) {
				window.clearInterval(timerRef.current);
				timerRef.current = null;
			}
			setGameOver(false);
			setComboMessage(null);
			setTimeRemaining(TIMED_DURATION);
			setTimedActive(false);
			setEndType(null);
		},
		[
			cleanupPointerListeners,
			initializeRandomForMode,
		],
	);

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}
		const stored = window.localStorage.getItem("blockblast:best-score");
		if (stored) {
			setBestScore(Number(stored));
		}
	}, []);

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}
		window.localStorage.setItem("blockblast:best-score", String(bestScore));
	}, [bestScore]);

	useEffect(() => {
		if (score > bestScore) {
			setBestScore(score);
		}
	}, [score, bestScore]);

	useEffect(() => {
		if (!clearedCells.length) {
			return;
		}
		const timeout = setTimeout(() => setClearedCells([]), 450);
		return () => clearTimeout(timeout);
	}, [clearedCells]);

	useEffect(() => {
		if (endType === "timeout") {
			return;
		}
		const available = pieces.filter((piece) => !piece.used);
		if (available.length === 0) {
			if (endType === "out-of-moves") {
				setEndType(null);
			}
			if (gameOver) {
				setGameOver(false);
			}
			return;
		}
		const hasMoves = available.some((piece) => hasPlacement(board, piece));
		if (!hasMoves) {
			if (endType !== "out-of-moves") {
				setEndType("out-of-moves");
			}
			if (!gameOver) {
				setGameOver(true);
			}
			if (mode === "timed" && timedActive) {
				setTimedActive(false);
			}
		} else if (endType === "out-of-moves") {
			setEndType(null);
			if (gameOver) {
				setGameOver(false);
			}
		}
	}, [board, pieces, endType, gameOver, mode, timedActive]);

	useEffect(() => {
		const handleResize = () => {
			if (typeof window === "undefined") {
				return;
			}
			setIsMobile(window.innerWidth < 768);
		};

		handleResize();
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, []);

	useEffect(() => {
		if (mode !== "timed" || !timedActive || gameOver) {
			if (timerRef.current) {
				window.clearInterval(timerRef.current);
				timerRef.current = null;
			}
			return;
		}
		timerRef.current = window.setInterval(() => {
			setTimeRemaining((current) => {
				if (current <= 1) {
					if (timerRef.current) {
						window.clearInterval(timerRef.current);
						timerRef.current = null;
					}
					setTimedActive(false);
					setEndType("timeout");
					setGameOver(true);
					return 0;
				}
				return current - 1;
			});
		}, 1000);
		return () => {
			if (timerRef.current) {
				window.clearInterval(timerRef.current);
				timerRef.current = null;
			}
		};
	}, [mode, timedActive, gameOver]);

	const getPieceById = useCallback(
		(pieceId: string | null) => {
			if (!pieceId) {
				return null;
			}
			return (
				pieces.find((piece) => piece.uid === pieceId && !piece.used) ?? null
			);
		},
		[pieces],
	);

	const selectedPiece = useMemo(
		() => getPieceById(selectedPieceId),
		[selectedPieceId, getPieceById],
	);

	const draggingPiece = useMemo(
		() => getPieceById(dragState?.pieceId ?? null),
		[dragState?.pieceId, getPieceById],
	);

	const previewPiece = draggingPiece ?? selectedPiece;

	const computeBoardMetrics = useCallback(() => {
		const element = boardRef.current;
		if (!element) {
			return null;
		}
		const rect = element.getBoundingClientRect();
		const cellWidth = rect.width / BOARD_SIZE;
		const cellHeight = rect.height / BOARD_SIZE;
		boardMetricsRef.current = { rect, cellWidth, cellHeight };
		return boardMetricsRef.current;
	}, []);

	const getBoardCoordinates = useCallback(
		(clientX: number, clientY: number) => {
			const metrics = computeBoardMetrics();
			if (!metrics) {
				return { row: null, col: null };
			}
			const { rect, cellWidth, cellHeight } = metrics;
			if (
				clientX < rect.left ||
				clientX > rect.right ||
				clientY < rect.top ||
				clientY > rect.bottom
			) {
				return { row: null, col: null };
			}

			const col = Math.floor((clientX - rect.left) / cellWidth);
			const row = Math.floor((clientY - rect.top) / cellHeight);

			if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) {
				return { row: null, col: null };
			}

			return { row, col };
		},
		[computeBoardMetrics],
	);

	const getBoardCellPosition = useCallback(
		(row: number, col: number) => {
			const metrics = boardMetricsRef.current ?? computeBoardMetrics();
			if (!metrics) {
				return null;
			}
			const { rect, cellWidth, cellHeight } = metrics;
			return {
				x: rect.left + col * cellWidth + cellWidth / 2,
				y: rect.top + row * cellHeight + cellHeight / 2,
			};
		},
		[computeBoardMetrics],
	);

	const ghostCells = useMemo(() => {
		if (!dragState || !previewPiece) {
			return null;
		}
		const { boardRow, boardCol } = dragState;
		if (boardRow === null || boardCol === null) {
			return null;
		}

		if (!canPlacePiece(board, previewPiece, boardCol, boardRow)) {
			return null;
		}

		const cellKeys = new Set<string>();
		previewPiece.blocks.forEach(([offsetX, offsetY]) => {
			cellKeys.add(`${boardRow + offsetY}-${boardCol + offsetX}`);
		});
		return cellKeys;
	}, [board, dragState, previewPiece]);

	const ghostPosition = useMemo(() => {
		if (!dragState) {
			return null;
		}
		const { boardRow, boardCol } = dragState;
		if (boardRow !== null && boardCol !== null) {
			const cellPosition = getBoardCellPosition(boardRow, boardCol);
			if (cellPosition) {
				return cellPosition;
			}
		}
		return { x: dragState.clientX, y: dragState.clientY };
	}, [dragState, getBoardCellPosition]);

	const ghostCellSize = useMemo(() => {
		const metrics = boardMetricsRef.current;
		if (!metrics) {
			return 24;
		}
		return Math.max(
			20,
			Math.min(48, Math.min(metrics.cellWidth, metrics.cellHeight) - 6),
		);
	}, [dragState]);

	const clearingSet = useMemo(
		() => new Set(clearedCells),
		[clearedCells],
	);

	const availablePieces = useMemo(
		() => pieces.filter((piece) => !piece.used),
		[pieces],
	);

	const triggerHaptics = useCallback((clearsCount: number) => {
		if (
			clearsCount < 2 ||
			typeof navigator === "undefined" ||
			typeof navigator.vibrate !== "function"
		) {
			return;
		}
		const pattern = clearsCount >= 3 ? [25, 20, 35] : [25, 25];
		navigator.vibrate(pattern);
	}, []);

	const showCombo = useCallback((clearsCount: number) => {
		setComboMessage(`Combo x${clearsCount}`);
		if (comboTimeoutRef.current) {
			window.clearTimeout(comboTimeoutRef.current);
		}
		comboTimeoutRef.current = window.setTimeout(() => {
			setComboMessage(null);
		}, 1400);
	}, []);

	const triggerPlacementSound = useCallback(
		(clearsCount: number) => {
			if (typeof window === "undefined") {
				return;
			}
			const AudioContextClass =
				window.AudioContext ||
				(window as typeof window & {
					webkitAudioContext?: typeof AudioContext;
				}).webkitAudioContext;
			if (!AudioContextClass) {
				return;
			}
			if (!audioCtxRef.current) {
				audioCtxRef.current = new AudioContextClass();
			}
			const ctx = audioCtxRef.current;
			if (ctx.state === "suspended") {
				ctx.resume().catch(() => {});
			}
			const oscillator = ctx.createOscillator();
			const gain = ctx.createGain();
			const baseFrequency = clearsCount >= 1 ? 460 : 360;
			oscillator.type = "triangle";
			oscillator.frequency.setValueAtTime(
				baseFrequency + clearsCount * 30,
				ctx.currentTime,
			);
			gain.gain.setValueAtTime(0.2, ctx.currentTime);
			gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
			oscillator.connect(gain).connect(ctx.destination);
			oscillator.start();
			oscillator.stop(ctx.currentTime + 0.22);
		},
		[],
	);

	const updateDragPosition = useCallback(
		(clientX: number, clientY: number) => {
			setDragState((current) => {
				if (!current) {
					return current;
				}
				const { row, col } = getBoardCoordinates(clientX, clientY);
				const nextState: DragState = {
					...current,
					clientX,
					clientY,
					boardRow: row,
					boardCol: col,
				};
				dragStateRef.current = nextState;
				return nextState;
			});
		},
		[getBoardCoordinates],
	);

	const attemptPlacePiece = useCallback(
		(piece: Piece, rowIndex: number, colIndex: number) => {
			if (gameOver || piece.used) {
				return false;
			}

			if (!canPlacePiece(board, piece, colIndex, rowIndex)) {
				return false;
			}

			const boardWithPiece = placePiece(board, piece, colIndex, rowIndex);
			const { board: clearedBoard, rowsCleared, colsCleared, clearedKeys } =
				clearCompletedLines(boardWithPiece);

			let nextPieces = pieces.map((currentPiece) =>
				currentPiece.uid === piece.uid
					? { ...currentPiece, used: true }
					: currentPiece,
			);

			if (nextPieces.every((p) => p.used)) {
				nextPieces = generatePieceSet(rngRef.current);
			}

			const placementScore = piece.blocks.length * 10;
			const clearBonus =
				clearedKeys.length * 5 +
				(rowsCleared.length + colsCleared.length) * 30;
			const totalClears = rowsCleared.length + colsCleared.length;

			setBoard(clearedBoard);
			setPieces(nextPieces);
			setSelectedPieceId((current) => (current === piece.uid ? null : current));
			setScore((previous) => previous + placementScore + clearBonus);

			if (clearedKeys.length) {
				setClearedCells(clearedKeys);
			}

			triggerPlacementSound(totalClears);

			if (mode === "timed" && !timedActive) {
				setTimedActive(true);
			}

			if (totalClears >= 2) {
				triggerHaptics(totalClears);
				showCombo(totalClears);
			}

			return true;
		},
		[
			board,
			gameOver,
			mode,
			pieces,
			showCombo,
			timedActive,
			triggerHaptics,
			triggerPlacementSound,
		],
	);

	const handleCellClick = (rowIndex: number, colIndex: number) => {
		if (!selectedPiece) {
			return;
		}
		attemptPlacePiece(selectedPiece, rowIndex, colIndex);
	};

	const handleSelectPiece = (pieceId: string) => {
		setSelectedPieceId((current) => (current === pieceId ? null : pieceId));
	};

	const handlePiecePointerDown = (
		event: ReactPointerEvent<HTMLButtonElement>,
		piece: Piece,
	) => {
		if (piece.used || gameOver) {
			return;
		}
		if (event.pointerType === "mouse" && event.button !== 0) {
			return;
		}
		event.preventDefault();
		cleanupPointerListeners();
		if (dragStateRef.current) {
			dragStateRef.current = null;
			setDragState(null);
		}
		setSelectedPieceId(piece.uid);
		const pointerId = event.pointerId;
		const { row, col } = getBoardCoordinates(event.clientX, event.clientY);
		const initialState: DragState = {
			pieceId: piece.uid,
			pointerId,
			clientX: event.clientX,
			clientY: event.clientY,
			boardRow: row,
			boardCol: col,
		};
		setDragState(initialState);
		dragStateRef.current = initialState;
		const target = event.currentTarget;
		target.setPointerCapture?.(pointerId);

		const handleMove = (moveEvent: PointerEvent) => {
			if (moveEvent.pointerId !== pointerId) {
				return;
			}
			moveEvent.preventDefault();
			updateDragPosition(moveEvent.clientX, moveEvent.clientY);
		};

		const handleUp = (upEvent: PointerEvent) => {
			if (upEvent.pointerId !== pointerId) {
				return;
			}
			upEvent.preventDefault();
			const snapshot = dragStateRef.current;
			if (
				snapshot &&
				snapshot.boardRow !== null &&
				snapshot.boardCol !== null
			) {
				const activePiece = getPieceById(snapshot.pieceId);
				if (activePiece) {
					attemptPlacePiece(
						activePiece,
						snapshot.boardRow,
						snapshot.boardCol,
					);
				}
			}
			setDragState(null);
			dragStateRef.current = null;
			cleanupPointerListeners();
		};

		target.addEventListener("pointermove", handleMove, { passive: false });
		target.addEventListener("pointerup", handleUp, { passive: false });
		target.addEventListener("pointercancel", handleUp, { passive: false });
		pointerListenersRef.current = {
			target,
			pointerId,
			move: handleMove,
			up: handleUp,
		};
	};

	const handleResetGame = () => {
		resetGameState(mode);
	};

	const handleModeChange = (nextMode: GameMode) => {
		if (nextMode === mode) {
			return;
		}
		const seedForMode = nextMode === "daily" ? getTodaySeed() : undefined;
		resetGameState(nextMode, { seed: seedForMode });
		setMode(nextMode);
	};

	const infoList = [
		"Classic Mode: chơi thư thả, không giới hạn thời gian.",
		"Timed Mode: sau khi đặt khối đầu tiên, bạn có 120 giây để ghi càng nhiều điểm càng tốt.",
		`Daily Puzzle: seed ${dailySeed} giúp mọi người chơi chung một bảng – chia sẻ để đua điểm.`,
		"Chọn một trong ba khối và nhấn vào bảng 10x10 để đặt.",
		"Ghép kín hàng hoặc cột để làm sạch và nhận thêm combo.",
	];

	const isTimedMode = mode === "timed";
	const isDailyMode = mode === "daily";
	const modeLabel = MODE_LABELS[mode];
	const formattedTime = formatTime(timeRemaining);
	const timerCritical = isTimedMode && timeRemaining <= 10;
	const timerStatusLabel = timedActive
		? "Đồng hồ đang chạy"
		: "Đặt khối đầu tiên để bắt đầu";

	const piecesWrapperClass = isMobile
		? "block-blast-piece-scroll flex gap-3 overflow-x-auto"
		: "space-y-3";

	const piecesButtonBaseClass = isMobile
		? "min-w-[200px] flex-shrink-0"
		: "w-full";

	const modeSelectionCard = (
		<div className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 space-y-3">
			<div className="flex items-center justify-between">
				<p className="text-xs uppercase tracking-[0.3em] text-white/60">
					Chế độ chơi
				</p>
				<span className="text-xs text-white/50">
					{MODE_LABELS[mode]}
				</span>
			</div>
			<div className="flex flex-col gap-2">
				{MODE_OPTIONS.map((option) => {
					const active = option.id === mode;
					return (
						<button
							type="button"
							key={option.id}
							onClick={() => handleModeChange(option.id)}
							className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
								active
									? "border-cyan-300 bg-cyan-400/10 text-white"
									: "border-white/10 bg-white/5 text-white/70 hover:border-cyan-200/50"
							}`}>
							<p className="font-semibold">{option.label}</p>
							<p className="text-xs text-white/60">{option.hint}</p>
						</button>
					);
				})}
			</div>
			{isDailyMode && (
				<p className="text-xs text-white/60">
					Seed hôm nay: <span className="font-mono text-white">{dailySeed}</span>
				</p>
			)}
		</div>
	);

	const scoreCard = (
		<div className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 space-y-4">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<p className="text-xs uppercase tracking-[0.4em] text-white/50">
						Điểm
					</p>
					<p className="text-4xl font-bold text-cyan-300">
						{score.toLocaleString("vi-VN")}
					</p>
				</div>
				<div className="text-right">
					<p className="text-xs uppercase tracking-[0.4em] text-white/50">
						Kỷ lục
					</p>
					<p className="text-2xl font-semibold text-white">
						{bestScore.toLocaleString("vi-VN")}
					</p>
				</div>
			</div>

			<div className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 space-y-2 text-sm text-white/80">
				<div className="flex items-center justify-between font-semibold">
					<span>Chế độ</span>
					<span>{modeLabel}</span>
				</div>
				{isTimedMode && (
					<div className="flex items-center justify-between text-xs uppercase tracking-[0.25em]">
						<span className="text-white/60">Thời gian</span>
						<span
							className={`font-mono text-base ${
								timerCritical ? "text-rose-300" : "text-cyan-200"
							}`}>
							{formattedTime}
						</span>
					</div>
				)}
				{isTimedMode && (
					<p className="text-xs text-white/60">{timerStatusLabel}</p>
				)}
				{isDailyMode && (
					<div className="text-xs flex items-center justify-between gap-3">
						<span className="text-white/60">Seed hôm nay</span>
						<span className="font-mono text-white">{dailySeed}</span>
					</div>
				)}
			</div>

			<button
				type="button"
				onClick={handleResetGame}
				className="w-full rounded-2xl border border-white/20 bg-white/5 py-3 text-sm font-semibold uppercase tracking-wide hover:border-cyan-300 hover:bg-white/10 transition">
				Reset bàn chơi
			</button>
		</div>
	);

	const pieceTray = (
		<div
			className={`rounded-3xl border border-white/10 bg-slate-900/70 p-5 space-y-3 ${
				isMobile ? "block-blast-mobile-drawer" : ""
			}`}>
			<div className="flex items-center justify-between">
				<h4 className="text-sm uppercase tracking-[0.3em] text-white/60">
					Khối kế tiếp
				</h4>
				<span className="text-xs text-white/60">
					{availablePieces.length}/3 sẵn sàng
				</span>
			</div>
			<div className={piecesWrapperClass}>
				{pieces.map((piece) => {
					const isSelected = selectedPieceId === piece.uid && !piece.used;
					const isDisabled = piece.used || gameOver;
					return (
								<button
									key={piece.uid}
									type="button"
									disabled={isDisabled}
									onClick={() => handleSelectPiece(piece.uid)}
									onPointerDown={(event) => handlePiecePointerDown(event, piece)}
									className={`${piecesButtonBaseClass} rounded-2xl border px-4 py-3 transition flex items-center justify-between gap-3 ${
										piece.used
											? "border-white/5 text-white/40 cursor-not-allowed opacity-50"
											: isSelected
												? "border-cyan-300 bg-cyan-400/10 shadow-[0_0_20px_rgba(34,211,238,0.25)]"
										: "border-white/10 hover:border-cyan-200/60"
							}`}>
							<div className="text-left">
								<p className="text-xs uppercase tracking-[0.3em] text-white/50">
									Khối
								</p>
								<p className="text-sm font-semibold">
									{piece.blocks.length} ô
								</p>
							</div>
							<div
								className="block-blast-piece-grid flex-shrink-0"
								style={{
									gridTemplateColumns: `repeat(${piece.width}, minmax(16px, 1fr))`,
								}}>
								{Array.from({
									length: piece.width * piece.height,
								}).map((_, index) => {
									const cellX = index % piece.width;
									const cellY = Math.floor(index / piece.width);
									const filled = piece.blocks.some(
										([x, y]) => x === cellX && y === cellY,
									);
									return (
										<span
											// eslint-disable-next-line react/no-array-index-key
											key={`${piece.uid}-${index}`}
											className={`block-blast-piece-cell ${
												filled ? "filled" : ""
											}`}
											style={
												filled
													? {
															background: piece.color,
															boxShadow: `0 0 10px ${piece.color}55`,
													  }
													: undefined
											}
										/>
									);
								})}
							</div>
						</button>
					);
				})}
			</div>
		</div>
	);

	const quickTipsCard = (
		<div className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 space-y-3">
			<p className="text-xs uppercase tracking-[0.3em] text-white/60">
				Ghi chú nhanh
			</p>
			<ul className="space-y-2 text-sm text-white/70">
				{infoList.map((tip) => (
					<li key={tip} className="flex items-start gap-2">
						<span className="mt-1 h-2 w-2 rounded-full bg-cyan-300" />
						<span>{tip}</span>
					</li>
				))}
			</ul>
		</div>
	);

	return (
		<div className={`block-blast-wrapper text-white ${isMobile ? "pb-10" : ""}`}>
			<div className="block-blast-content flex flex-col gap-8 lg:flex-row lg:items-start">
				<section className="block-blast-primary w-full lg:flex-[1.1] space-y-5">
					<div className="space-y-2">
						<p className="text-xs uppercase tracking-[0.4em] text-cyan-300/80">
							Block Blast
						</p>
						<h3 className="text-3xl font-semibold">Neon Grid Arena</h3>
						<p className="text-sm text-white/70 max-w-2xl">
							Thả khối, xóa hàng và giữ bảng luôn rộng rãi. Phiên bản web responsive
							cho phép bạn chơi mượt mà trên mọi kích thước màn hình.
						</p>
					</div>

					<div className="block-blast-board-shell relative rounded-3xl border border-white/10 bg-slate-950/60 p-5 shadow-inner shadow-cyan-500/5">
						{comboMessage && (
							<div className="block-blast-combo">
								<span>{comboMessage}</span>
							</div>
						)}
						<div className="block-blast-board" ref={boardRef}>
							{board.map((row, rowIndex) =>
								row.map((cell, colIndex) => {
									const key = `${rowIndex}-${colIndex}`;
									const highlightFromGhost = ghostCells?.has(key) ?? false;
									let canDrop = highlightFromGhost;
									if (!highlightFromGhost && previewPiece && !cell && !dragState) {
										canDrop = canPlacePiece(
											board,
											previewPiece,
											colIndex,
											rowIndex,
										);
									}

									const cellClasses = [
										"block-blast-cell",
										cell ? "filled" : "",
										canDrop ? "valid" : "",
										clearingSet.has(key) ? "clearing" : "",
									]
										.filter(Boolean)
										.join(" ");

									const cellStyle = cell
										? {
												background: cell,
												boxShadow: `0 0 12px ${cell}66`,
										  }
										: undefined;

									return (
										<button
											type="button"
											key={key}
											className={cellClasses}
											style={cellStyle}
											onClick={() => handleCellClick(rowIndex, colIndex)}
											aria-label={`Ô (${rowIndex + 1}, ${colIndex + 1})`}
										/>
									);
								}),
							)}
						</div>

						{gameOver && (
							<div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-3xl border border-white/10 bg-slate-950/90 text-center p-6">
								<p className="text-sm uppercase tracking-[0.3em] text-rose-200">
									Game Over
								</p>
								<h4 className="mt-2 text-2xl font-semibold">
									{endType === "timeout" ? "Hết giờ!" : "Hết nước đi!"}
								</h4>
								<p className="text-white/70 text-sm mt-2">
									Bạn đã ghi được {score.toLocaleString("vi-VN")} điểm.
								</p>
								{endType === "timeout" && (
									<p className="text-xs text-white/60 mt-1">
										Đồng hồ Timed đã về 00:00.
									</p>
								)}
								<button
									type="button"
									onClick={handleResetGame}
									className="mt-4 rounded-full bg-cyan-400/90 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300 transition">
									Chơi lại
								</button>
							</div>
						)}
					</div>
					{isMobile && (
						<div className="space-y-5">
							{pieceTray}
							{modeSelectionCard}
							{scoreCard}
							{quickTipsCard}
						</div>
					)}
				</section>

				{!isMobile && (
					<aside className="block-blast-panel w-full space-y-5 lg:w-[360px]">
						{modeSelectionCard}
						{scoreCard}
						{pieceTray}
						{quickTipsCard}
					</aside>
				)}
			</div>

			{dragState && draggingPiece && ghostPosition && (
				<div
					className="block-blast-ghost"
					style={{ top: ghostPosition.y, left: ghostPosition.x }}>
					<div
						className="block-blast-piece-grid block-blast-ghost-grid"
						style={{
							gridTemplateColumns: `repeat(${draggingPiece.width}, ${ghostCellSize}px)`,
						}}>
						{Array.from({
							length: draggingPiece.width * draggingPiece.height,
						}).map((_, index) => {
							const cellX = index % draggingPiece.width;
							const cellY = Math.floor(index / draggingPiece.width);
							const filled = draggingPiece.blocks.some(
								([x, y]) => x === cellX && y === cellY,
							);
							return (
								<span
									// eslint-disable-next-line react/no-array-index-key
									key={`${draggingPiece.uid}-ghost-${index}`}
									className={`block-blast-piece-cell ${filled ? "filled" : ""}`}
									style={
										filled
											? {
													background: draggingPiece.color,
													boxShadow: `0 0 10px ${draggingPiece.color}66`,
													width: ghostCellSize,
													height: ghostCellSize,
											  }
											: {
													width: ghostCellSize,
													height: ghostCellSize,
											  }
									}
								/>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
}
