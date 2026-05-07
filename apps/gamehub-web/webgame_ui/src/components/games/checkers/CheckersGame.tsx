import { useMemo, useState } from "react";

type Color = "R" | "B";
type Piece = { color: Color; king: boolean };
type Cell = Piece | null;
type Position = { row: number; col: number };
type Move = Position & { capture?: Position };

const SIZE = 8;

const createBoard = (): Cell[][] =>
  Array.from({ length: SIZE }, (_, row) =>
    Array.from({ length: SIZE }, (_, col) => {
      const playable = (row + col) % 2 === 1;
      if (!playable) return null;
      if (row < 3) return { color: "B", king: false };
      if (row > 4) return { color: "R", king: false };
      return null;
    }),
  );

const inBounds = (row: number, col: number): boolean =>
  row >= 0 && row < SIZE && col >= 0 && col < SIZE;

const opposite = (color: Color): Color => (color === "R" ? "B" : "R");

const getDirections = (piece: Piece): number[] => {
  if (piece.king) return [-1, 1];
  return piece.color === "R" ? [-1] : [1];
};

const getMovesForPiece = (
  board: Cell[][],
  row: number,
  col: number,
  capturesOnly = false,
): Move[] => {
  const piece = board[row][col];
  if (!piece) return [];

  const moves: Move[] = [];

  getDirections(piece).forEach((dr) => {
    [-1, 1].forEach((dc) => {
      const stepRow = row + dr;
      const stepCol = col + dc;
      const jumpRow = row + dr * 2;
      const jumpCol = col + dc * 2;
      const stepCell = inBounds(stepRow, stepCol)
        ? board[stepRow][stepCol]
        : null;

      if (
        stepCell &&
        stepCell.color !== piece.color &&
        inBounds(jumpRow, jumpCol) &&
        !board[jumpRow][jumpCol]
      ) {
        moves.push({
          row: jumpRow,
          col: jumpCol,
          capture: { row: stepRow, col: stepCol },
        });
        return;
      }

      if (
        !capturesOnly &&
        inBounds(stepRow, stepCol) &&
        !board[stepRow][stepCol]
      ) {
        moves.push({ row: stepRow, col: stepCol });
      }
    });
  });

  return moves;
};

const hasCapture = (board: Cell[][], color: Color): boolean =>
  board.some((row, rowIndex) =>
    row.some(
      (cell, colIndex) =>
        cell?.color === color &&
        getMovesForPiece(board, rowIndex, colIndex, true).length > 0,
    ),
  );

const hasAnyMove = (board: Cell[][], color: Color): boolean =>
  board.some((row, rowIndex) =>
    row.some(
      (cell, colIndex) =>
        cell?.color === color &&
        getMovesForPiece(board, rowIndex, colIndex, hasCapture(board, color))
          .length > 0,
    ),
  );

const countPieces = (board: Cell[][], color: Color): number =>
  board.flat().filter((cell) => cell?.color === color).length;

const labelFor = (color: Color): string => (color === "R" ? "Đỏ" : "Đen");

export default function CheckersGame(): JSX.Element {
  const [board, setBoard] = useState<Cell[][]>(() => createBoard());
  const [turn, setTurn] = useState<Color>("R");
  const [selected, setSelected] = useState<Position | null>(null);
  const [winner, setWinner] = useState<Color | null>(null);

  const captureRequired = useMemo(() => hasCapture(board, turn), [board, turn]);

  const selectedMoves = useMemo(() => {
    if (!selected) return [];
    return getMovesForPiece(board, selected.row, selected.col, captureRequired);
  }, [board, captureRequired, selected]);

  const scores = useMemo(
    () => ({
      red: countPieces(board, "R"),
      black: countPieces(board, "B"),
    }),
    [board],
  );

  const resetGame = () => {
    setBoard(createBoard());
    setTurn("R");
    setSelected(null);
    setWinner(null);
  };

  const findMove = (row: number, col: number): Move | undefined =>
    selectedMoves.find((move) => move.row === row && move.col === col);

  const selectOrMove = (row: number, col: number) => {
    if (winner) return;

    const piece = board[row][col];
    const move = findMove(row, col);

    if (selected && move) {
      const nextBoard = board.map((boardRow) =>
        boardRow.map((cell) => (cell ? { ...cell } : null)),
      );
      const movingPiece = nextBoard[selected.row][selected.col];

      if (!movingPiece) return;

      nextBoard[selected.row][selected.col] = null;
      nextBoard[row][col] = {
        ...movingPiece,
        king:
          movingPiece.king ||
          (movingPiece.color === "R" && row === 0) ||
          (movingPiece.color === "B" && row === SIZE - 1),
      };

      if (move.capture) {
        nextBoard[move.capture.row][move.capture.col] = null;
      }

      const nextTurn = opposite(turn);
      setBoard(nextBoard);
      setSelected(null);

      const opponentPieces = countPieces(nextBoard, nextTurn);
      if (opponentPieces === 0 || !hasAnyMove(nextBoard, nextTurn)) {
        setWinner(turn);
      } else {
        setTurn(nextTurn);
      }
      return;
    }

    if (piece?.color === turn) {
      setSelected({ row, col });
    } else {
      setSelected(null);
    }
  };

  const statusText = winner
    ? `${labelFor(winner)} thắng`
    : `Lượt ${labelFor(turn)}`;

  return (
    <div className="mx-auto max-w-5xl bg-gradient-to-br from-orange-50 to-slate-50 p-4 md:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase text-teal-700">Checkers</p>
          <h2 className="text-2xl font-bold text-slate-800">Cờ đam</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Đi chéo trên ô tối, ăn quân bằng cách nhảy qua đối thủ.
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
          <div className="rounded-lg border border-white bg-white/85 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase text-zinc-500">
              Trạng thái
            </p>
            <p className="mt-1 text-xl font-bold text-slate-800">
              {statusText}
            </p>
            {captureRequired && !winner && (
              <p className="mt-2 text-sm font-semibold text-amber-700">
                Bắt buộc ăn quân
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-white bg-white/85 p-3 shadow-sm">
              <span className="mb-2 block h-8 w-8 rounded-full bg-rose-500" />
              <p className="text-sm font-bold text-slate-800">
                Đỏ: {scores.red}
              </p>
            </div>
            <div className="rounded-lg border border-white bg-white/85 p-3 shadow-sm">
              <span className="mb-2 block h-8 w-8 rounded-full bg-slate-800" />
              <p className="text-sm font-bold text-slate-800">
                Đen: {scores.black}
              </p>
            </div>
          </div>
        </aside>

        <div className="mx-auto grid w-full max-w-[620px] grid-cols-8 overflow-hidden rounded-xl border border-orange-100 bg-white p-2 shadow-sm">
          {board.map((row, rowIndex) =>
            row.map((cell, colIndex) => {
              const playable = (rowIndex + colIndex) % 2 === 1;
              const isSelected =
                selected?.row === rowIndex && selected?.col === colIndex;
              const possibleMove = Boolean(findMove(rowIndex, colIndex));

              return (
                <button
                  key={`${rowIndex}-${colIndex}`}
                  onClick={() => selectOrMove(rowIndex, colIndex)}
                  className={`relative aspect-square ${
                    playable ? "bg-amber-800" : "bg-amber-100"
                  } ${isSelected ? "ring-4 ring-teal-300" : ""}`}
                  aria-label={`Square ${rowIndex + 1}-${colIndex + 1}`}
                >
                  {possibleMove && (
                    <span className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal-300" />
                  )}
                  {cell && (
                    <span
                      className={`absolute inset-[12%] flex items-center justify-center rounded-full text-xs font-black text-white shadow ${
                        cell.color === "R" ? "bg-rose-500" : "bg-slate-800"
                      }`}
                    >
                      {cell.king ? "K" : ""}
                    </span>
                  )}
                </button>
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
}
