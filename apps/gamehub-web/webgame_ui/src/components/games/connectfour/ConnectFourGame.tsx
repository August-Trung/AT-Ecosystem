import { useMemo, useState } from "react";

type Player = "R" | "Y";
type Slot = Player | null;

const ROWS = 6;
const COLS = 7;

const createBoard = (): Slot[][] =>
  Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => null));

const getPlayerLabel = (player: Player): string =>
  player === "R" ? "Đỏ" : "Vàng";

const hasFour = (
  board: Slot[][],
  row: number,
  col: number,
  player: Player,
): boolean => {
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];

  return directions.some(([dr, dc]) => {
    let count = 1;

    [1, -1].forEach((sign) => {
      let nextRow = row + dr * sign;
      let nextCol = col + dc * sign;

      while (
        nextRow >= 0 &&
        nextRow < ROWS &&
        nextCol >= 0 &&
        nextCol < COLS &&
        board[nextRow][nextCol] === player
      ) {
        count += 1;
        nextRow += dr * sign;
        nextCol += dc * sign;
      }
    });

    return count >= 4;
  });
};

export default function ConnectFourGame(): JSX.Element {
  const [board, setBoard] = useState<Slot[][]>(() => createBoard());
  const [currentPlayer, setCurrentPlayer] = useState<Player>("R");
  const [winner, setWinner] = useState<Player | "draw" | null>(null);

  const columnStatus = useMemo(
    () =>
      Array.from({ length: COLS }, (_, col) =>
        board.findIndex((row) => row[col] === null),
      ),
    [board],
  );

  const resetGame = () => {
    setBoard(createBoard());
    setCurrentPlayer("R");
    setWinner(null);
  };

  const dropPiece = (col: number) => {
    if (winner || columnStatus[col] === -1) return;

    const nextBoard = board.map((row) => [...row]);
    let targetRow = -1;

    for (let row = ROWS - 1; row >= 0; row -= 1) {
      if (nextBoard[row][col] === null) {
        targetRow = row;
        break;
      }
    }

    if (targetRow === -1) return;

    nextBoard[targetRow][col] = currentPlayer;
    setBoard(nextBoard);

    if (hasFour(nextBoard, targetRow, col, currentPlayer)) {
      setWinner(currentPlayer);
      return;
    }

    if (nextBoard.every((row) => row.every(Boolean))) {
      setWinner("draw");
      return;
    }

    setCurrentPlayer((player) => (player === "R" ? "Y" : "R"));
  };

  const statusText =
    winner === "draw"
      ? "Hoa"
      : winner
        ? `${getPlayerLabel(winner)} thang`
        : `Luot ${getPlayerLabel(currentPlayer)}`;

  return (
    <div className="mx-auto max-w-5xl bg-gradient-to-br from-sky-50 to-amber-50/60 p-4 md:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase text-teal-700">
            Connect Four
          </p>
          <h2 className="text-2xl font-bold text-slate-800">Cờ thả 4</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Thả quân vào cột, nối 4 quân liên tiếp để thắng.
          </p>
        </div>
        <button
          onClick={resetGame}
          className="rounded-md bg-teal-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-teal-700"
        >
          Chơi lại
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="space-y-3">
          <div className="rounded-lg border border-white bg-white/80 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase text-zinc-500">
              Trạng thái
            </p>
            <p className="mt-1 text-xl font-bold text-slate-800">
              {statusText}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-white bg-white/80 p-3 shadow-sm">
              <span className="mb-2 block h-8 w-8 rounded-full bg-rose-500" />
              <p className="text-sm font-bold text-slate-800">Đỏ</p>
            </div>
            <div className="rounded-lg border border-white bg-white/80 p-3 shadow-sm">
              <span className="mb-2 block h-8 w-8 rounded-full bg-amber-400" />
              <p className="text-sm font-bold text-slate-800">Vàng</p>
            </div>
          </div>
        </aside>

        <div className="rounded-2xl border border-sky-100 bg-white p-3 shadow-sm">
          <div className="mb-2 grid grid-cols-7 gap-2">
            {Array.from({ length: COLS }, (_, col) => (
              <button
                key={col}
                onClick={() => dropPiece(col)}
                disabled={Boolean(winner) || columnStatus[col] === -1}
                className="rounded-md bg-teal-600 px-2 py-2 text-xs font-bold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500"
              >
                Cột {col + 1}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2 rounded-xl bg-sky-700 p-3">
            {board.map((row, rowIndex) =>
              row.map((slot, colIndex) => (
                <button
                  key={`${rowIndex}-${colIndex}`}
                  onClick={() => dropPiece(colIndex)}
                  className="aspect-square rounded-full bg-white/95 p-1 shadow-inner"
                  aria-label={`Column ${colIndex + 1}`}
                >
                  <span
                    className={`block h-full w-full rounded-full transition ${
                      slot === "R"
                        ? "bg-rose-500"
                        : slot === "Y"
                          ? "bg-amber-400"
                          : "bg-slate-100"
                    }`}
                  />
                </button>
              )),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
