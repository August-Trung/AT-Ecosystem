import React from "react";
import ChineseChessPiece from "./ChineseChessPiece";
import { ChessPiece, Player, GameMode } from "../hooks/useChineseChessGame";

interface ChineseChessBoardProps {
	pieces: ChessPiece[];
	selectedPiece: ChessPiece | null;
	validMoves: [number, number][];
	onSelectPiece: (piece: ChessPiece) => void;
	onMovePiece: (row: number, col: number) => void;
	currentPlayer: Player;
	isAIThinking?: boolean;
	gameMode?: GameMode;
	lastAIMove?: { from: [number, number]; to: [number, number] };
}

const ROWS = 10;
const COLS = 9;

const ChineseChessBoard: React.FC<ChineseChessBoardProps> = ({
	pieces,
	selectedPiece,
	validMoves,
	onSelectPiece,
	onMovePiece,
	currentPlayer,
	isAIThinking = false,
	gameMode = "pvp",
	lastAIMove,
}) => {
	const isValidMove = (row: number, col: number): boolean =>
		validMoves.some(([r, c]) => r === row && c === col);

	const getPieceAt = (row: number, col: number): ChessPiece | null =>
		pieces.find(
			(piece) => piece.position[0] === row && piece.position[1] === col
		) || null;

	const handleSquareClick = (row: number, col: number) => {
		if (isAIThinking) return;
		if (gameMode === "pve" && currentPlayer === "black") return;

		const targetPiece = getPieceAt(row, col);
		if (targetPiece && targetPiece.player === currentPlayer) {
			onSelectPiece(targetPiece);
			return;
		}

		if (selectedPiece && isValidMove(row, col)) {
			onMovePiece(row, col);
		}
	};

	const hasPalaceDiagonals = (row: number, col: number): boolean => {
		const inTopPalace = row >= 0 && row <= 2 && col >= 3 && col <= 5;
		const inBottomPalace = row >= 7 && row <= 9 && col >= 3 && col <= 5;
		return inTopPalace || inBottomPalace;
	};

	return (
		<div className="mx-auto w-full max-w-[640px]">
			<div className="relative aspect-[9/10] w-full rounded-[32px] border-[12px] border-[#5b3a22] bg-gradient-to-b from-[#fbeed0] to-[#f4dba5] shadow-2xl shadow-orange-900/20 sm:border-[14px]">
				<div className="grid h-full w-full grid-cols-9 overflow-hidden rounded-[20px] border border-[#d1b071] bg-[#f8e6bd]">
					{Array.from({ length: ROWS }).map((_, rowIndex) => (
						<React.Fragment key={`row-${rowIndex}`}>
							{Array.from({ length: COLS }).map((_, colIndex) => {
								const piece = getPieceAt(rowIndex, colIndex);
								const isValid = isValidMove(rowIndex, colIndex);
								const isPalace =
									(rowIndex >= 0 &&
										rowIndex <= 2 &&
										colIndex >= 3 &&
										colIndex <= 5) ||
									(rowIndex >= 7 &&
										rowIndex <= 9 &&
										colIndex >= 3 &&
										colIndex <= 5);
								const isRiver =
									rowIndex >= 4 && rowIndex <= 5;
								const isAIMoveSquare =
									(lastAIMove?.from[0] === rowIndex &&
										lastAIMove?.from[1] === colIndex) ||
									(lastAIMove?.to[0] === rowIndex &&
										lastAIMove?.to[1] === colIndex);

								const showRiverLabelTop =
									isRiver && rowIndex === 4 && colIndex === 4;
								const showRiverLabelBottom =
									isRiver && rowIndex === 5 && colIndex === 4;

								const showMarkers =
									((rowIndex === 2 || rowIndex === 7) &&
										(colIndex === 1 ||
											colIndex === 7)) ||
									((rowIndex === 3 || rowIndex === 6) &&
										[0, 2, 4, 6, 8].includes(colIndex));

								return (
									<div
										key={`cell-${rowIndex}-${colIndex}`}
										className={`relative aspect-square flex items-center justify-center border border-[#d1b071] transition-colors duration-150 ${
											isPalace
												? "bg-amber-50/60"
												: isRiver
													? "bg-sky-50/50"
													: "bg-transparent"
										} ${
											isAIMoveSquare
												? "bg-rose-200/60"
												: ""
										} hover:bg-amber-50/70`}
										onClick={() =>
											handleSquareClick(rowIndex, colIndex)
										}>
										<div className="pointer-events-none absolute inset-0">
											{rowIndex < ROWS - 1 && (
												<div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[#a97d47]" />
											)}
											{colIndex < COLS - 1 && (
												<div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-[#a97d47]" />
											)}
										</div>

										{showMarkers && (
											<div className="pointer-events-none absolute h-4 w-4">
												{["top-left", "top-right", "bottom-left", "bottom-right"].map(
													(position) => (
														<div
															key={position}
															className={`absolute h-1.5 w-0.5 bg-[#9a6d3f] ${
																position.includes("top")
																	? "top-0"
																	: "bottom-0"
															} ${
																position.includes("left")
																	? "left-0"
																	: "right-0"
															}`}
														/>
													)
												)}
											</div>
										)}

										{hasPalaceDiagonals(
											rowIndex,
											colIndex
										) && (
											<div className="pointer-events-none absolute inset-0 text-[#a97d47]">
												<svg
													viewBox="0 0 100 100"
													className="h-full w-full">
													{rowIndex >= 0 &&
														rowIndex <= 2 &&
														colIndex >= 3 &&
														colIndex <= 5 && (
															<>
																{((rowIndex === 0 &&
																	colIndex ===
																		3) ||
																	(rowIndex ===
																		1 &&
																		colIndex ===
																			4) ||
																	(rowIndex ===
																		2 &&
																		colIndex ===
																			5)) && (
																	<line
																		x1="0"
																		y1="0"
																		x2="100"
																		y2="100"
																		stroke="currentColor"
																		strokeWidth="2"
																	/>
																)}
																{((rowIndex === 0 &&
																	colIndex ===
																		5) ||
																	(rowIndex ===
																		1 &&
																		colIndex ===
																			4) ||
																	(rowIndex ===
																		2 &&
																		colIndex ===
																			3)) && (
																	<line
																		x1="100"
																		y1="0"
																		x2="0"
																		y2="100"
																		stroke="currentColor"
																		strokeWidth="2"
																	/>
																)}
															</>
														)}

													{rowIndex >= 7 &&
														rowIndex <= 9 &&
														colIndex >= 3 &&
														colIndex <= 5 && (
															<>
																{((rowIndex === 7 &&
																	colIndex ===
																		3) ||
																	(rowIndex ===
																		8 &&
																		colIndex ===
																			4) ||
																	(rowIndex ===
																		9 &&
																		colIndex ===
																			5)) && (
																	<line
																		x1="0"
																		y1="0"
																		x2="100"
																		y2="100"
																		stroke="currentColor"
																		strokeWidth="2"
																	/>
																)}
																{((rowIndex === 7 &&
																	colIndex ===
																		5) ||
																	(rowIndex ===
																		8 &&
																		colIndex ===
																			4) ||
																	(rowIndex ===
																		9 &&
																		colIndex ===
																			3)) && (
																	<line
																		x1="100"
																		y1="0"
																		x2="0"
																		y2="100"
																		stroke="currentColor"
																		strokeWidth="2"
																	/>
																)}
															</>
														)}
												</svg>
											</div>
										)}

										{showRiverLabelTop && (
											<div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-extrabold text-[#7c4f23] sm:text-xl">
												楚 河
											</div>
										)}
										{showRiverLabelBottom && (
											<div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-extrabold text-[#7c4f23] sm:text-xl">
												漢 界
											</div>
										)}

										{piece && (
											<ChineseChessPiece
												piece={piece}
												selected={
													selectedPiece?.id ===
													piece.id
												}
												onClick={() =>
													handleSquareClick(
														rowIndex,
														colIndex
													)
												}
											/>
										)}

										{isValid && !piece && (
											<div className="h-3/5 w-3/5 rounded-full border-2 border-cyan-400/70 bg-cyan-200/40" />
										)}
									</div>
								);
							})}
						</React.Fragment>
					))}
				</div>
			</div>
		</div>
	);
};

export default ChineseChessBoard;
