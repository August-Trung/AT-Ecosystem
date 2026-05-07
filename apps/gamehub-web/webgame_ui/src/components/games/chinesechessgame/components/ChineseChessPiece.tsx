import React from "react";
import { ChessPiece } from "../hooks/useChineseChessGame";

interface ChineseChessPieceProps {
	piece: ChessPiece;
	selected: boolean;
	onClick: () => void;
}

// Ánh xạ từ loại quân cờ sang ký tự tiếng Trung/Việt
const pieceSymbols: Record<string, { red: string; black: string }> = {
	general: { red: "帥", black: "將" }, // Tướng
	advisor: { red: "仕", black: "士" }, // Sĩ
	elephant: { red: "相", black: "象" }, // Tượng
	horse: { red: "傌", black: "馬" }, // Mã
	chariot: { red: "俥", black: "車" }, // Xe
	cannon: { red: "炮", black: "砲" }, // Pháo
	soldier: { red: "兵", black: "卒" }, // Tốt
};

// Ánh xạ sang tên tiếng Việt để hiển thị tooltip
const pieceNamesVietnamese: Record<string, string> = {
	general: "Tướng",
	advisor: "Sĩ",
	elephant: "Tượng",
	horse: "Mã",
	chariot: "Xe",
	cannon: "Pháo",
	soldier: "Tốt",
};

const ChineseChessPiece: React.FC<ChineseChessPieceProps> = ({
	piece,
	selected,
	onClick,
}) => {
	const { type, player } = piece;

	return (
		<div
			className={`
        relative flex h-[82%] w-[82%] items-center justify-center rounded-full
        border-2 ${player === "red" ? "bg-red-50 text-red-600 border-red-200" : "bg-slate-100 text-slate-700 border-slate-300"}
        ${selected ? "ring-2 sm:ring-4 ring-indigo-400" : ""}
        shadow-md cursor-pointer transition-all duration-150 ease-in-out hover:scale-105
      `}
			onClick={onClick}
			title={`${player === "red" ? "Đỏ" : "Đen"} - ${pieceNamesVietnamese[type]}`}>
			<span className="text-lg font-bold sm:text-2xl">
				{pieceSymbols[type][player]}
			</span>
		</div>
	);
};

export default ChineseChessPiece;
