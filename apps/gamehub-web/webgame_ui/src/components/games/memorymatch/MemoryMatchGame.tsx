import { useMemo, useState } from "react";

type Card = {
  id: string;
  symbol: string;
  open: boolean;
  matched: boolean;
};

const SYMBOLS = ["A", "B", "C", "D", "E", "F", "G", "H"];

const shuffle = <T,>(items: T[]): T[] => {
  const nextItems = [...items];

  for (let index = nextItems.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [nextItems[index], nextItems[swapIndex]] = [
      nextItems[swapIndex],
      nextItems[index],
    ];
  }

  return nextItems;
};

const createCards = (): Card[] =>
  shuffle(
    SYMBOLS.flatMap((symbol) => [
      { id: `${symbol}-1`, symbol, open: false, matched: false },
      { id: `${symbol}-2`, symbol, open: false, matched: false },
    ]),
  );

export default function MemoryMatchGame(): JSX.Element {
  const [cards, setCards] = useState<Card[]>(() => createCards());
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [locked, setLocked] = useState(false);

  const matchedPairs = useMemo(
    () => cards.filter((card) => card.matched).length / 2,
    [cards],
  );
  const finished = matchedPairs === SYMBOLS.length;

  const resetGame = () => {
    setCards(createCards());
    setOpenIds([]);
    setMoves(0);
    setLocked(false);
  };

  const flipCard = (cardId: string) => {
    if (locked || finished) return;

    const card = cards.find((item) => item.id === cardId);
    if (!card || card.open || card.matched) return;

    if (openIds.length === 0) {
      setCards((currentCards) =>
        currentCards.map((item) =>
          item.id === cardId ? { ...item, open: true } : item,
        ),
      );
      setOpenIds([cardId]);
      return;
    }

    const firstId = openIds[0];
    const firstCard = cards.find((item) => item.id === firstId);
    if (!firstCard) return;

    setMoves((currentMoves) => currentMoves + 1);

    if (firstCard.symbol === card.symbol) {
      setCards((currentCards) =>
        currentCards.map((item) =>
          item.id === firstId || item.id === cardId
            ? { ...item, open: true, matched: true }
            : item,
        ),
      );
      setOpenIds([]);
      return;
    }

    setLocked(true);
    setCards((currentCards) =>
      currentCards.map((item) =>
        item.id === cardId ? { ...item, open: true } : item,
      ),
    );

    window.setTimeout(() => {
      setCards((currentCards) =>
        currentCards.map((item) =>
          item.id === firstId || item.id === cardId
            ? { ...item, open: false }
            : item,
        ),
      );
      setOpenIds([]);
      setLocked(false);
    }, 700);
  };

  return (
    <div className="mx-auto max-w-4xl bg-gradient-to-br from-fuchsia-50 to-teal-50/70 p-4 md:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase text-teal-700">
            Memory Match
          </p>
          <h2 className="text-2xl font-bold text-slate-800">Lật hình</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Ghi nhớ vị trí và tìm đủ cặp giống nhau.
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
        <div className="rounded-lg border border-white bg-white/85 p-3 shadow-sm">
          <p className="text-xs font-semibold text-zinc-500">Cặp đã tìm</p>
          <p className="mt-1 text-lg font-bold text-slate-800">
            {matchedPairs}/{SYMBOLS.length}
          </p>
        </div>
        <div className="rounded-lg border border-white bg-white/85 p-3 shadow-sm">
          <p className="text-xs font-semibold text-zinc-500">Lượt mở</p>
          <p className="mt-1 text-lg font-bold text-slate-800">{moves}</p>
        </div>
        <div className="rounded-lg border border-white bg-white/85 p-3 shadow-sm">
          <p className="text-xs font-semibold text-zinc-500">Trạng thái</p>
          <p className="mt-1 text-lg font-bold text-slate-800">
            {finished ? "Hoàn thành" : "Đang chơi"}
          </p>
        </div>
      </div>

      <div className="mx-auto grid max-w-[620px] grid-cols-4 gap-3">
        {cards.map((card) => {
          const visible = card.open || card.matched;

          return (
            <button
              key={card.id}
              onClick={() => flipCard(card.id)}
              className={`aspect-square rounded-xl border text-2xl font-black shadow-sm transition ${
                visible
                  ? "border-teal-200 bg-white text-teal-700"
                  : "border-teal-200 bg-teal-600 text-teal-600 hover:bg-teal-500"
              }`}
              aria-label="Memory card"
            >
              {visible ? card.symbol : "?"}
            </button>
          );
        })}
      </div>
    </div>
  );
}
