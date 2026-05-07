// components/ChessBoard.tsx
import React from "react";
import ChessPiece from "./ChessPiece";
import { Position, Board } from "../hooks/useChessGame";

interface ChessBoardProps {
	board: Board;
	validMoves: Position[];
	selectedPiece: Position | null;
	onCellClick: (position: Position) => void;
	currentPlayer: "white" | "black";
	isCheck: boolean;
	isCheckmate: boolean;
}

const ChessBoard: React.FC<ChessBoardProps> = ({
	board,
	validMoves,
	selectedPiece,
	onCellClick,
	currentPlayer,
	isCheck,
	isCheckmate,
}) => {
	// Helpers to get cell colors and classnames
	const getCellColor = (row: number, col: number): string => {
		return (row + col) % 2 === 0 ? "light" : "dark";
	};

	const getCellClassName = (row: number, col: number): string => {
		const isSelected =
			selectedPiece?.row === row && selectedPiece?.col === col;
		const isValidMove = validMoves.some(
			(move) => move.row === row && move.col === col
		);

		return `cell ${getCellColor(row, col)} ${isSelected ? "selected" : ""} ${
			isValidMove ? "valid-move" : ""
		}`;
	};

	// Get column label (a-h)
	const getColLabel = (col: number): string => {
		return String.fromCharCode(97 + col);
	};

	// Get row label (1-8)
	const getRowLabel = (row: number): string => {
		return String(8 - row);
	};

	const getKingClassName = (row: number, col: number): string => {
		const piece = board[row][col];
		if (piece && piece.type === "king") {
			if (piece.color === currentPlayer && isCheck) {
				return "king-in-check";
			}
			if (piece.color === currentPlayer && isCheckmate) {
				return "king-in-checkmate";
			}
		}
		return "";
	};

	return (
		<div className="chess-board">
			<div className="board-surface">
				<div className="board-grid">
					{board.map((row, rowIndex) =>
						row.map((piece, colIndex) => (
							<div
								key={`${rowIndex}-${colIndex}`}
								className={`${getCellClassName(rowIndex, colIndex)} ${piece?.type === "king" ? getKingClassName(rowIndex, colIndex) : ""}`}
								onClick={() =>
									onCellClick({ row: rowIndex, col: colIndex })
								}>
								{piece && <ChessPiece piece={piece} />}
							</div>
						))
					)}
				</div>
				<div className="board-row-labels">
					{board.map((_, rowIndex) => (
						<span key={`row-${rowIndex}`}>
							{getRowLabel(rowIndex)}
						</span>
					))}
				</div>
				<div className="board-col-labels">
					{Array.from({ length: 8 }).map((_, colIndex) => (
						<span key={`col-${colIndex}`}>
							{getColLabel(colIndex)}
						</span>
					))}
				</div>
			</div>
		</div>
	);
};

export default ChessBoard;
