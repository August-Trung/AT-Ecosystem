import React from "react";
import Cell from "./Cell";

interface BoardProps {
	board: Array<
		Array<{
			value: number | null;
			isFixed: boolean;
			isValid: boolean;
			notes: number[];
		}>
	>;
	selectedCell: { row: number; col: number } | null;
	setSelectedCell: (cell: { row: number; col: number } | null) => void;
	handleCellValueChange: (
		row: number,
		col: number,
		value: number | null
	) => void;
}

const Board: React.FC<BoardProps> = ({
	board,
	selectedCell,
	setSelectedCell,
	handleCellValueChange,
}) => {
	return (
		<div className="relative w-full">
			<div className="aspect-square w-full overflow-hidden rounded-3xl border-2 border-slate-900 bg-white shadow-lg shadow-slate-200">
				<div className="grid h-full w-full grid-cols-9 grid-rows-9 gap-0">
					{board.map((row, rowIndex) =>
						row.map((cell, colIndex) => {
							let borderClasses = "border border-slate-200";

							if (rowIndex % 3 === 0)
								borderClasses +=
									" border-t-2 border-t-slate-900";
							if (colIndex % 3 === 0)
								borderClasses +=
									" border-l-2 border-l-slate-900";
							if (rowIndex === 8)
								borderClasses +=
									" border-b-2 border-b-slate-900";
							if (colIndex === 8)
								borderClasses +=
									" border-r-2 border-r-slate-900";

							const isSelected =
								selectedCell?.row === rowIndex &&
								selectedCell?.col === colIndex;

							const isInSameRow =
								selectedCell?.row === rowIndex;
							const isInSameCol =
								selectedCell?.col === colIndex;
							const isInSameBox =
								Math.floor(rowIndex / 3) ===
									Math.floor(
										(selectedCell?.row ?? -1) / 3
									) &&
								Math.floor(colIndex / 3) ===
									Math.floor(
										(selectedCell?.col ?? -1) / 3
									);

							const hasSameValue =
								cell.value !== null &&
								selectedCell &&
								board[selectedCell.row][selectedCell.col]
									.value === cell.value &&
								board[selectedCell.row][selectedCell.col]
									.value !== null;

							return (
								<Cell
									key={`${rowIndex}-${colIndex}`}
									value={cell.value}
									isFixed={cell.isFixed}
									isValid={cell.isValid}
									notes={cell.notes}
									isSelected={isSelected}
									isRelated={
										isInSameRow || isInSameCol || isInSameBox
									}
									hasSameValue={hasSameValue ?? false}
									borderClasses={borderClasses}
									onClick={() =>
										setSelectedCell({
											row: rowIndex,
											col: colIndex,
										})
									}
									onChange={(value) =>
										handleCellValueChange(
											rowIndex,
											colIndex,
											value
										)
									}
								/>
							);
						})
					)}
				</div>
			</div>
		</div>
	);
};

export default Board;
