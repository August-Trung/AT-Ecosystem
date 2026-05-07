import { useMemo, useState } from "react";

type Piece = "B" | "W";
type Cell = Piece | null;
type Position = { row: number; col: number };

const SIZE = 8;
const DIRECTIONS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

const createBoard = (): Cell[][] => {
  const board: Cell[][] = Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE }, () => null),
  );

  board[3][3] = "W";
  board[3][4] = "B";
  board[4][3] = "B";
  board[4][4] = "W";

  return board;
};

const opponentOf = (piece: Piece): Piece => (piece === "B" ? "W" : "B");

const inBounds = (row: number, col: number): boolean =>
  row >= 0 && row < SIZE && col >= 0 && col < SIZE;

const getFlips = (
  board: Cell[][],
  row: number,
  col: number,
  piece: Piece,
): Position[] => {
  if (board[row][col]) return [];

  const opponent = opponentOf(piece);
  const flips: Position[] = [];

  DIRECTIONS.forEach(([dr, dc]) => {
    const line: Position[] = [];
    let nextRow = row + dr;
    let nextCol = col + dc;

    while (inBounds(nextRow, nextCol) && board[nextRow][nextCol] === opponent) {
      line.push({ row: nextRow, col: nextCol });
      nextRow += dr;
      nextCol += dc;
    }

    if (
      line.length > 0 &&
      inBounds(nextRow, nextCol) &&
      board[nextRow][nextCol] === piece
    ) {
      flips.push(...line);
    }
  });

  return flips;
};

const getLegalMoves = (board: Cell[][], piece: Piece): Position[] => {
  const moves: Position[] = [];

  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (getFlips(board, row, col, piece).length > 0) {
        moves.push({ row, col });
      }
    }
  }

  return moves;
};

const getPieceLabel = (piece: Piece): string =>
  piece === "B" ? "Đen" : "Trắng";

export default function ReversiGame(): JSX.Element {
  const [board, setBoard] = useState<Cell[][]>(() => createBoard());
  const [turn, setTurn] = useState<Piece>("B");
  const [finished, setFinished] = useState(false);
  const [passMessage, setPassMessage] = useState("");

  const legalMoves = useMemo(() => getLegalMoves(board, turn), [board, turn]);

  const scores = useMemo(() => {
    const cells = board.flat();
    return {
      black: cells.filter((cell) => cell === "B").length,
      white: cells.filter((cell) => cell === "W").length,
    };
  }, [board]);

  const resetGame = () => {
    setBoard(createBoard());
    setTurn("B");
    setFinished(false);
    setPassMessage("");
  };

  const isLegalMove = (row: number, col: number): boolean =>
    legalMoves.some((move) => move.row === row && move.col === col);

  const placePiece = (row: number, col: number) => {
    if (finished || !isLegalMove(row, col)) return;

    const flips = getFlips(board, row, col, turn);
    const nextBoard = board.map((boardRow) => [...boardRow]);
    nextBoard[row][col] = turn;
    flips.forEach((position) => {
      nextBoard[position.row][position.col] = turn;
    });

    const opponent = opponentOf(turn);
    const opponentMoves = getLegalMoves(nextBoard, opponent);
    const currentMoves = getLegalMoves(nextBoard, turn);

    setBoard(nextBoard);

    if (opponentMoves.length > 0) {
      setTurn(opponent);
      setPassMessage("");
    } else if (currentMoves.length > 0) {
      setTurn(turn);
      setPassMessage(`${getPieceLabel(opponent)} không có nước đi`);
    } else {
      setFinished(true);
      setPassMessage("Hết nước đi");
    }
  };

  const winnerText = useMemo(() => {
    if (!finished) return "";
    if (scores.black === scores.white) return "Hòa";
    return scores.black > scores.white ? "Đen thắng" : "Trắng thắng";
  }, [finished, scores.black, scores.white]);

  return (
    <div className="mx-auto max-w-5xl bg-gradient-to-br from-emerald-50 to-slate-50 p-4 md:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase text-teal-700">Reversi</p>
          <h2 className="text-2xl font-bold text-slate-800">Othello</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Kẹp quân đối thủ giữa hai đầu để lật màu và chiếm bàn cờ.
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
              {finished ? winnerText : `Lượt ${getPieceLabel(turn)}`}
            </p>
            {passMessage && (
              <p className="mt-2 text-sm font-semibold text-amber-700">
                {passMessage}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-white bg-white/85 p-3 shadow-sm">
              <span className="mb-2 block h-8 w-8 rounded-full bg-slate-900" />
              <p className="text-sm font-bold text-slate-800">
                Đen: {scores.black}
              </p>
            </div>
            <div className="rounded-lg border border-white bg-white/85 p-3 shadow-sm">
              <span className="mb-2 block h-8 w-8 rounded-full border border-zinc-300 bg-white" />
              <p className="text-sm font-bold text-slate-800">
                Trắng: {scores.white}
              </p>
            </div>
          </div>
        </aside>

        <div className="mx-auto grid w-full max-w-[620px] grid-cols-8 gap-1 rounded-xl bg-emerald-800 p-2 shadow-sm">
          {board.map((row, rowIndex) =>
            row.map((cell, colIndex) => {
              const legal = isLegalMove(rowIndex, colIndex);

              return (
                <button
                  key={`${rowIndex}-${colIndex}`}
                  onClick={() => placePiece(rowIndex, colIndex)}
                  className="relative aspect-square rounded-md bg-emerald-600 shadow-inner transition hover:bg-emerald-500"
                  aria-label={`Square ${rowIndex + 1}-${colIndex + 1}`}
                >
                  {cell && (
                    <span
                      className={`absolute inset-[14%] rounded-full shadow ${
                        cell === "B"
                          ? "bg-slate-900"
                          : "border border-zinc-300 bg-white"
                      }`}
                    />
                  )}
                  {!cell && legal && !finished && (
                    <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-200" />
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
