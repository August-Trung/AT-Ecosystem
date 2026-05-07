import { useMemo, useState } from "react";

type Cell = {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  adjacent: number;
};

type GameStatus = "playing" | "won" | "lost";

const BOARD_SIZE = 10;
const MINE_COUNT = 14;
const DIRECTIONS = [-1, 0, 1];

const createBoard = (): Cell[][] => {
  const board: Cell[][] = Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => ({
      mine: false,
      revealed: false,
      flagged: false,
      adjacent: 0,
    })),
  );

  let placed = 0;
  while (placed < MINE_COUNT) {
    const row = Math.floor(Math.random() * BOARD_SIZE);
    const col = Math.floor(Math.random() * BOARD_SIZE);

    if (!board[row][col].mine) {
      board[row][col].mine = true;
      placed += 1;
    }
  }

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (board[row][col].mine) continue;

      let count = 0;
      DIRECTIONS.forEach((dr) => {
        DIRECTIONS.forEach((dc) => {
          if (dr === 0 && dc === 0) return;
          const nextRow = row + dr;
          const nextCol = col + dc;

          if (
            nextRow >= 0 &&
            nextRow < BOARD_SIZE &&
            nextCol >= 0 &&
            nextCol < BOARD_SIZE &&
            board[nextRow][nextCol].mine
          ) {
            count += 1;
          }
        });
      });
      board[row][col].adjacent = count;
    }
  }

  return board;
};

const revealFrom = (
  sourceBoard: Cell[][],
  startRow: number,
  startCol: number,
): { nextBoard: Cell[][]; hitMine: boolean } => {
  const nextBoard = sourceBoard.map((row) => row.map((cell) => ({ ...cell })));
  const startCell = nextBoard[startRow][startCol];

  if (startCell.flagged || startCell.revealed) {
    return { nextBoard, hitMine: false };
  }

  if (startCell.mine) {
    nextBoard.forEach((row) =>
      row.forEach((cell) => {
        if (cell.mine) cell.revealed = true;
      }),
    );
    return { nextBoard, hitMine: true };
  }

  const stack = [[startRow, startCol]];
  const visited = new Set<string>();

  while (stack.length > 0) {
    const [row, col] = stack.pop() ?? [0, 0];
    const key = `${row}:${col}`;
    if (visited.has(key)) continue;
    visited.add(key);

    const cell = nextBoard[row]?.[col];
    if (!cell || cell.flagged || cell.revealed || cell.mine) continue;

    cell.revealed = true;

    if (cell.adjacent === 0) {
      DIRECTIONS.forEach((dr) => {
        DIRECTIONS.forEach((dc) => {
          if (dr === 0 && dc === 0) return;
          const nextRow = row + dr;
          const nextCol = col + dc;
          if (
            nextRow >= 0 &&
            nextRow < BOARD_SIZE &&
            nextCol >= 0 &&
            nextCol < BOARD_SIZE
          ) {
            stack.push([nextRow, nextCol]);
          }
        });
      });
    }
  }

  return { nextBoard, hitMine: false };
};

const hasWon = (board: Cell[][]): boolean =>
  board.every((row) => row.every((cell) => cell.mine || cell.revealed));

export default function MinesweeperGame(): JSX.Element {
  const [board, setBoard] = useState<Cell[][]>(() => createBoard());
  const [status, setStatus] = useState<GameStatus>("playing");

  const flaggedCount = useMemo(
    () => board.flat().filter((cell) => cell.flagged).length,
    [board],
  );

  const resetGame = () => {
    setBoard(createBoard());
    setStatus("playing");
  };

  const revealCell = (row: number, col: number) => {
    if (status !== "playing") return;

    setBoard((currentBoard) => {
      const { nextBoard, hitMine } = revealFrom(currentBoard, row, col);

      if (hitMine) {
        setStatus("lost");
      } else if (hasWon(nextBoard)) {
        setStatus("won");
      }

      return nextBoard;
    });
  };

  const toggleFlag = (row: number, col: number) => {
    if (status !== "playing") return;

    setBoard((currentBoard) =>
      currentBoard.map((boardRow, rowIndex) =>
        boardRow.map((cell, colIndex) => {
          if (rowIndex !== row || colIndex !== col || cell.revealed) {
            return cell;
          }
          return { ...cell, flagged: !cell.flagged };
        }),
      ),
    );
  };

  const statusText =
    status === "won"
      ? "Thắng ván này"
      : status === "lost"
        ? "Trúng mìn"
        : "Đang chơi";

  return (
    <div className="mx-auto max-w-4xl bg-gradient-to-br from-slate-50 to-teal-50/50 p-4 md:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase text-teal-700">Dò mìn</p>
          <h2 className="text-2xl font-bold text-slate-800">Minesweeper</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Mở các ô an toàn, bấm chuột phải để đánh dấu mìn.
          </p>
        </div>
        <button
          onClick={resetGame}
          className="rounded-md bg-teal-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-teal-700"
        >
          Chơi lại
        </button>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-white bg-white/80 p-3 shadow-sm">
          <p className="text-xs font-semibold text-zinc-500">Trạng thái</p>
          <p className="mt-1 text-lg font-bold text-slate-800">{statusText}</p>
        </div>
        <div className="rounded-lg border border-white bg-white/80 p-3 shadow-sm">
          <p className="text-xs font-semibold text-zinc-500">Min</p>
          <p className="mt-1 text-lg font-bold text-slate-800">{MINE_COUNT}</p>
        </div>
        <div className="rounded-lg border border-white bg-white/80 p-3 shadow-sm">
          <p className="text-xs font-semibold text-zinc-500">Cờ đã đặt</p>
          <p className="mt-1 text-lg font-bold text-slate-800">
            {flaggedCount}
          </p>
        </div>
      </div>

      <div className="mx-auto grid max-w-[560px] grid-cols-10 gap-1 rounded-xl border border-teal-100 bg-white p-2 shadow-sm">
        {board.map((row, rowIndex) =>
          row.map((cell, colIndex) => {
            const content = cell.revealed
              ? cell.mine
                ? "M"
                : cell.adjacent || ""
              : cell.flagged
                ? "F"
                : "";

            return (
              <button
                key={`${rowIndex}-${colIndex}`}
                onClick={() => revealCell(rowIndex, colIndex)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  toggleFlag(rowIndex, colIndex);
                }}
                className={`aspect-square rounded-md text-sm font-black transition ${
                  cell.revealed
                    ? cell.mine
                      ? "bg-rose-100 text-rose-700"
                      : "bg-slate-100 text-slate-700"
                    : cell.flagged
                      ? "bg-amber-100 text-amber-700"
                      : "bg-teal-600 text-white hover:bg-teal-500"
                }`}
                aria-label={`Cell ${rowIndex + 1}-${colIndex + 1}`}
              >
                {content}
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}
