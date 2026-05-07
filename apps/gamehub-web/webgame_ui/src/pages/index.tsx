import { useEffect, useMemo, useState } from "react";

import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import WordleGame from "@/components/games/wordle/WordleGame";
import Game2048 from "@/components/games/2048/Game2048";
import SudokuGame from "@/components/games/sudoku/SudokuGame";
import CaroGame from "@/components/games/caro/CaroGame";
import BattleshipGame from "@/components/games/battleship/BattleshipGame";
import TetrisGame from "@/components/games/tetris/TetrisGame";
import ChessGame from "@/components/games/chess/ChessGame";
import HangmanGame from "@/components/games/hangman/HangmanGame";
import LudoGame from "@/components/games/ludo/LudoGame";
import ChineseChessGame from "@/components/games/chinesechessgame/ChineseChessGame";
import MandarinSquareCapturingGame from "@/components/games/mandarinsquarecapturing/MandarinSquareCapturingGame";
import BlockBlastGame from "@/components/games/blockblast/BlockBlastGame";
import MinesweeperGame from "@/components/games/minesweeper/MinesweeperGame";
import ConnectFourGame from "@/components/games/connectfour/ConnectFourGame";
import ReversiGame from "@/components/games/reversi/ReversiGame";
import CheckersGame from "@/components/games/checkers/CheckersGame";
import MemoryMatchGame from "@/components/games/memorymatch/MemoryMatchGame";
import RealtimeRoomPanel from "@/components/multiplayer/RealtimeRoomPanel";
import { GAME_LEADERBOARDS, LeaderboardValueType } from "@/config/leaderboard";
import { useLanguage, type Language } from "@/contexts/LanguageContext";
import { GameItem } from "@/types/game";
import { Localized } from "@/types/i18n";

type GameDefinition = {
  id: string;
  component: JSX.Element;
  icon: string;
  status?: "Hot" | "New" | "Classic";
  accentClass: string;
  name: Localized;
  tagline: Localized;
  category: Localized;
  categoryKey: string;
  difficulty: Localized;
  players: Localized;
  roomMode?: "1v1";
};

const GAME_LIBRARY: GameDefinition[] = [
  {
    id: "wordle",
    component: <WordleGame />,
    icon: "W",
    status: "Hot",
    accentClass: "bg-emerald-50 text-emerald-700",
    name: { vi: "Wordle", en: "Wordle" },
    tagline: {
      vi: "Đoán từ 5 chữ trong 6 lượt.",
      en: "Guess the five-letter word in six tries.",
    },
    category: { vi: "Giải đố", en: "Puzzle" },
    categoryKey: "puzzle",
    difficulty: { vi: "Tập trung", en: "Focused" },
    players: { vi: "1 người", en: "Solo" },
  },
  {
    id: "2048",
    component: <Game2048 />,
    icon: "2",
    status: "Classic",
    accentClass: "bg-amber-50 text-amber-700",
    name: { vi: "2048", en: "2048" },
    tagline: {
      vi: "Ghép ô số, giữ bàn chơi càng lâu càng tốt.",
      en: "Merge number tiles and keep the board alive.",
    },
    category: { vi: "Arcade", en: "Arcade" },
    categoryKey: "arcade",
    difficulty: { vi: "Thử thách", en: "Challenging" },
    players: { vi: "1 người", en: "Solo" },
  },
  {
    id: "sudoku",
    component: <SudokuGame />,
    icon: "9",
    status: "New",
    accentClass: "bg-sky-50 text-sky-700",
    name: { vi: "Sudoku", en: "Sudoku" },
    tagline: {
      vi: "Điền bảng 9x9 với chế độ chơi gọn, dễ nhìn.",
      en: "Fill the 9x9 grid with a clean, readable board.",
    },
    category: { vi: "Giải đố", en: "Puzzle" },
    categoryKey: "puzzle",
    difficulty: { vi: "Thư giãn", en: "Calm" },
    players: { vi: "1 người", en: "Solo" },
  },
  {
    id: "caro",
    component: <CaroGame />,
    icon: "X",
    accentClass: "bg-indigo-50 text-indigo-700",
    name: { vi: "Caro", en: "Caro" },
    tagline: {
      vi: "Nối 5 quân liên tiếp trên bàn cờ quen thuộc.",
      en: "Connect five on a familiar board.",
    },
    category: { vi: "Bàn cờ", en: "Board" },
    categoryKey: "board",
    difficulty: { vi: "Đối kháng", en: "Competitive" },
    players: { vi: "2 người", en: "2 Players" },
    roomMode: "1v1",
  },
  {
    id: "battleship",
    component: <BattleshipGame />,
    icon: "B",
    accentClass: "bg-cyan-50 text-cyan-700",
    name: { vi: "Battleship", en: "Battleship" },
    tagline: {
      vi: "Đặt tàu, đoán tọa độ và đánh chìm hạm đội đối thủ.",
      en: "Place ships, call shots, and sink the opposing fleet.",
    },
    category: { vi: "Chiến thuật", en: "Strategy" },
    categoryKey: "strategy",
    difficulty: { vi: "Chiến thuật", en: "Tactical" },
    players: { vi: "2 người", en: "2 Players" },
    roomMode: "1v1",
  },
  {
    id: "tetrisGame",
    component: <TetrisGame />,
    icon: "T",
    accentClass: "bg-rose-50 text-rose-700",
    name: { vi: "Tetris", en: "Tetris" },
    tagline: {
      vi: "Xếp khối rơi và dọn hàng trước khi màn hình đầy.",
      en: "Stack falling blocks and clear rows before the board fills.",
    },
    category: { vi: "Arcade", en: "Arcade" },
    categoryKey: "arcade",
    difficulty: { vi: "Tốc độ", en: "Fast" },
    players: { vi: "1 người", en: "Solo" },
  },
  {
    id: "blockblast",
    component: <BlockBlastGame />,
    icon: "B",
    status: "New",
    accentClass: "bg-violet-50 text-violet-700",
    name: { vi: "Block Blast", en: "Block Blast" },
    tagline: {
      vi: "Lấp bảng 10x10 và tạo combo điểm cao.",
      en: "Fill the 10x10 board and chain high-score combos.",
    },
    category: { vi: "Giải đố", en: "Puzzle" },
    categoryKey: "puzzle",
    difficulty: { vi: "Combo", en: "Combo" },
    players: { vi: "1 người", en: "Solo" },
  },
  {
    id: "chessGame",
    component: <ChessGame />,
    icon: "♟",
    status: "Classic",
    accentClass: "bg-zinc-100 text-zinc-800",
    name: { vi: "Chess", en: "Chess" },
    tagline: {
      vi: "Cờ vua 2 người với bàn chơi rõ ràng.",
      en: "Two-player chess with a clear board.",
    },
    category: { vi: "Chiến thuật", en: "Strategy" },
    categoryKey: "strategy",
    difficulty: { vi: "Cao thủ", en: "Advanced" },
    players: { vi: "2 người", en: "2 Players" },
    roomMode: "1v1",
  },
  {
    id: "hangmanGame",
    component: <HangmanGame />,
    icon: "H",
    accentClass: "bg-lime-50 text-lime-700",
    name: { vi: "Hangman", en: "Hangman" },
    tagline: {
      vi: "Đoán chữ theo chủ đề, có gợi ý khi cần.",
      en: "Guess themed words with hints when you need them.",
    },
    category: { vi: "Giải đố", en: "Puzzle" },
    categoryKey: "puzzle",
    difficulty: { vi: "Nhẹ nhàng", en: "Casual" },
    players: { vi: "1 người", en: "Solo" },
  },
  {
    id: "ludo",
    component: <LudoGame />,
    icon: "L",
    accentClass: "bg-orange-50 text-orange-700",
    name: { vi: "Ludo", en: "Ludo" },
    tagline: {
      vi: "Đưa quân về đích trong ván chơi nhiều người.",
      en: "Race pieces home in a multiplayer board game.",
    },
    category: { vi: "Gia đình", en: "Family" },
    categoryKey: "party",
    difficulty: { vi: "Dễ chơi", en: "Easy" },
    players: { vi: "4 người", en: "4 Players" },
  },
  {
    id: "chinesechessgame",
    component: <ChineseChessGame />,
    icon: "象",
    accentClass: "bg-red-50 text-red-700",
    name: { vi: "Cờ tướng", en: "Chinese Chess" },
    tagline: {
      vi: "Cờ tướng 2 người với luật đi quân quen thuộc.",
      en: "Two-player Xiangqi with familiar piece rules.",
    },
    category: { vi: "Chiến thuật", en: "Strategy" },
    categoryKey: "strategy",
    difficulty: { vi: "Nâng cao", en: "Advanced" },
    players: { vi: "2 người", en: "2 Players" },
    roomMode: "1v1",
  },
  {
    id: "mandarinsquarecapturing",
    component: <MandarinSquareCapturingGame />,
    icon: "Ô",
    accentClass: "bg-yellow-50 text-yellow-800",
    name: { vi: "Ô ăn quan", en: "Mandarin Square" },
    tagline: {
      vi: "Game dân gian Việt Nam với lối chơi tính toán.",
      en: "A Vietnamese folk strategy game about counting moves.",
    },
    category: { vi: "Chiến thuật", en: "Strategy" },
    categoryKey: "strategy",
    difficulty: { vi: "Tính toán", en: "Tactical" },
    players: { vi: "2 người", en: "2 Players" },
  },
  {
    id: "minesweeper",
    component: <MinesweeperGame />,
    icon: "M",
    status: "New",
    accentClass: "bg-stone-100 text-stone-700",
    name: { vi: "Dò mìn", en: "Minesweeper" },
    tagline: {
      vi: "Mở ô an toàn, đánh dấu mìn và dọn sạch bàn chơi.",
      en: "Reveal safe cells, flag mines, and clear the board.",
    },
    category: { vi: "Giải đố", en: "Puzzle" },
    categoryKey: "puzzle",
    difficulty: { vi: "Suy luận", en: "Deduction" },
    players: { vi: "1 người", en: "Solo" },
  },
  {
    id: "connectfour",
    component: <ConnectFourGame />,
    icon: "4",
    status: "New",
    accentClass: "bg-blue-50 text-blue-700",
    name: { vi: "Cờ thả", en: "Connect Four" },
    tagline: {
      vi: "Thả quân vào cột và nối 4 quân liên tiếp trước đối thủ.",
      en: "Drop discs into columns and connect four before your rival.",
    },
    category: { vi: "Bàn cờ", en: "Board" },
    categoryKey: "board",
    difficulty: { vi: "Đối kháng", en: "Competitive" },
    players: { vi: "2 người", en: "2 Players" },
    roomMode: "1v1",
  },
  {
    id: "reversi",
    component: <ReversiGame />,
    icon: "R",
    status: "New",
    accentClass: "bg-emerald-50 text-emerald-700",
    name: { vi: "Reversi", en: "Reversi" },
    tagline: {
      vi: "Kẹp quân để lật màu và kiểm soát bàn cờ 8x8.",
      en: "Trap pieces, flip colors, and control the 8x8 board.",
    },
    category: { vi: "Chiến thuật", en: "Strategy" },
    categoryKey: "strategy",
    difficulty: { vi: "Tính toán", en: "Tactical" },
    players: { vi: "2 người", en: "2 Players" },
    roomMode: "1v1",
  },
  {
    id: "checkers",
    component: <CheckersGame />,
    icon: "C",
    status: "New",
    accentClass: "bg-orange-50 text-orange-700",
    name: { vi: "Cờ đam", en: "Checkers" },
    tagline: {
      vi: "Đi chéo, nhảy ăn quân và phong vua ở cuối bàn.",
      en: "Move diagonally, capture pieces, and crown kings.",
    },
    category: { vi: "Bàn cờ", en: "Board" },
    categoryKey: "board",
    difficulty: { vi: "Đối kháng", en: "Competitive" },
    players: { vi: "2 người", en: "2 Players" },
    roomMode: "1v1",
  },
  {
    id: "memorymatch",
    component: <MemoryMatchGame />,
    icon: "M",
    status: "New",
    accentClass: "bg-fuchsia-50 text-fuchsia-700",
    name: { vi: "Lật hình", en: "Memory Match" },
    tagline: {
      vi: "Ghi nhớ vị trí và tìm đủ các cặp giống nhau.",
      en: "Remember positions and match every pair.",
    },
    category: { vi: "Gia đình", en: "Family" },
    categoryKey: "party",
    difficulty: { vi: "Dễ chơi", en: "Easy" },
    players: { vi: "1 người", en: "Solo" },
  },
];

const PREVIEW_TILES = [
  { label: "2", className: "col-span-2 bg-amber-100 text-amber-700" },
  { label: "W", className: "bg-emerald-100 text-emerald-700" },
  { label: "9", className: "bg-sky-100 text-sky-700" },
  { label: "X", className: "col-span-2 bg-indigo-100 text-indigo-700" },
  { label: "T", className: "bg-rose-100 text-rose-700" },
  { label: "B", className: "col-span-2 bg-cyan-100 text-cyan-700" },
  { label: "L", className: "bg-orange-100 text-orange-700" },
  { label: "Ô", className: "col-span-2 bg-yellow-100 text-yellow-800" },
] as const;

const HOME_COPY = {
  vi: {
    hero: {
      eyebrow: "GameHub",
      title: "Mini game trên trình duyệt",
      description:
        "Mở nhanh các trò quen thuộc như 2048, Wordle, Sudoku, Caro, Cờ tướng và Tetris. Không cần tải app, chọn game là chơi.",
      previewLabel: "Sảnh chơi nhanh",
      previewMeta: "17 game sẵn sàng",
      stats: [
        { key: "games", label: "Trò chơi", value: "" },
        { key: "install", label: "Không cần tải", value: "Web" },
        { key: "players", label: "Chế độ", value: "Solo / 1v1 / 4P" },
      ],
      ctas: {
        primary: "Chơi ngẫu nhiên",
        secondary: "Xem thư viện game",
      },
    },
    playing: {
      label: "Đang chơi",
      random: "Đổi game",
      back: "Về sảnh game",
    },
    quick: {
      eyebrow: "Bắt đầu nhanh",
      heading: "Nên thử trước",
      description:
        "Các game được ghim để người mới hiểu ngay web này dùng để chơi gì.",
    },
    library: {
      eyebrow: "Thư viện game",
      heading: "Chọn game để chơi",
      description: "Tìm theo tên, thể loại hoặc số người chơi.",
      searchPlaceholder: "Tìm 2048, Sudoku, Caro...",
      searchLabel: "Tìm game",
      allLabel: "Tất cả",
      buttonLabel: "Chơi",
      emptyTitle: "Không tìm thấy game phù hợp",
      emptyDescription: "Thử đổi từ khóa hoặc chọn lại tất cả thể loại.",
    },
    leaderboard: {
      eyebrow: "Bảng xếp hạng",
      title: "Top tuần này",
      description:
        "Phần xếp hạng được đặt sau thư viện để không che mất mục tiêu chính: chọn game và chơi.",
      metricLabel: "Chỉ số",
    },
  },
  en: {
    hero: {
      eyebrow: "GameHub",
      title: "Browser mini games",
      description:
        "Launch familiar games like 2048, Wordle, Sudoku, Caro, Chinese Chess, and Tetris. No install required, just pick a game and play.",
      previewLabel: "Quick lobby",
      previewMeta: "17 ready games",
      stats: [
        { key: "games", label: "Games", value: "" },
        { key: "install", label: "No install", value: "Web" },
        { key: "players", label: "Modes", value: "Solo / 1v1 / 4P" },
      ],
      ctas: {
        primary: "Play random",
        secondary: "Browse games",
      },
    },
    playing: {
      label: "Now playing",
      random: "Switch game",
      back: "Back to game lobby",
    },
    quick: {
      eyebrow: "Quick start",
      heading: "Try these first",
      description: "Pinned games make it obvious what this site is for.",
    },
    library: {
      eyebrow: "Game library",
      heading: "Choose a game to play",
      description: "Search by title, genre, or player mode.",
      searchPlaceholder: "Search 2048, Sudoku, Caro...",
      searchLabel: "Search games",
      allLabel: "All",
      buttonLabel: "Play",
      emptyTitle: "No games found",
      emptyDescription: "Try another keyword or switch back to all genres.",
    },
    leaderboard: {
      eyebrow: "Leaderboard",
      title: "This week's top scores",
      description:
        "Rankings now sit after the game library so they support the site instead of taking focus from play.",
      metricLabel: "Metric",
    },
  },
} as const;

const DEFAULT_LEADERBOARD_ID = GAME_LEADERBOARDS[0]?.gameId ?? "wordle";

const LOCALE_MAP: Record<Language, string> = {
  vi: "vi-VN",
  en: "en-US",
};

const formatTimeValue = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const remaining = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${remaining}`;
};

const formatLeaderboardValue = (
  value: number,
  type: LeaderboardValueType,
  language: Language,
): string => {
  const locale = LOCALE_MAP[language];

  switch (type) {
    case "time":
      return formatTimeValue(value);
    case "percent":
      return `${value.toFixed(1)}%`;
    case "streak":
    case "combo":
      return `${value.toLocaleString(locale)}x`;
    default:
      return value.toLocaleString(locale);
  }
};

const getStatusLabel = (
  status: GameDefinition["status"],
  language: Language,
): string | null => {
  if (!status) return null;

  const labels = {
    vi: {
      Hot: "Đang hot",
      New: "Mới",
      Classic: "Kinh điển",
    },
    en: {
      Hot: "Popular",
      New: "New",
      Classic: "Classic",
    },
  } as const;

  return labels[language][status];
};

export default function GameHub(): JSX.Element {
  const { language } = useLanguage();
  const copy = HOME_COPY[language];

  const [currentGame, setCurrentGame] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [activeLeaderboardGame, setActiveLeaderboardGame] = useState(
    DEFAULT_LEADERBOARD_ID,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const requestedGame = new URLSearchParams(window.location.search).get(
      "game",
    );
    if (
      requestedGame &&
      GAME_LIBRARY.some((game) => game.id === requestedGame)
    ) {
      setCurrentGame(requestedGame);
    }
  }, []);

  const games: (GameItem & {
    accentClass: string;
    categoryKey: string;
    status?: GameDefinition["status"];
    roomMode?: GameDefinition["roomMode"];
  })[] = useMemo(() => {
    return GAME_LIBRARY.map((game) => ({
      ...game,
      name: game.name[language],
      tagline: game.tagline[language],
      category: game.category[language],
      difficulty: game.difficulty[language],
      players: game.players[language],
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [language]);

  const heroStats = useMemo(() => {
    return copy.hero.stats.map((stat) =>
      stat.key === "games" ? { ...stat, value: games.length.toString() } : stat,
    );
  }, [copy.hero.stats, games.length]);

  const categoryFilters = useMemo(() => {
    const keys = Array.from(
      new Set(GAME_LIBRARY.map((game) => game.categoryKey)),
    );

    return [
      { key: "all", label: copy.library.allLabel },
      ...keys.map((key) => {
        const sample = GAME_LIBRARY.find((game) => game.categoryKey === key);
        return {
          key,
          label: sample ? sample.category[language] : key,
        };
      }),
    ];
  }, [copy.library.allLabel, language]);

  const filteredGames = useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase();

    return games.filter((game) => {
      const matchesCategory =
        selectedCategory === "all" || game.categoryKey === selectedCategory;
      const searchableText = [
        game.name,
        game.tagline,
        game.category,
        game.difficulty,
        game.players,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesSearch =
        normalizedTerm.length === 0 || searchableText.includes(normalizedTerm);

      return matchesCategory && matchesSearch;
    });
  }, [games, searchTerm, selectedCategory]);

  const quickGames = useMemo(() => {
    const pinnedIds = ["2048", "wordle", "sudoku", "caro"];
    const byId = new Map(games.map((game) => [game.id, game]));
    return pinnedIds
      .map((id) => byId.get(id))
      .filter((game): game is (typeof games)[number] => Boolean(game));
  }, [games]);

  const currentGameItem = currentGame
    ? games.find((game) => game.id === currentGame)
    : null;

  const leaderboardTabs = useMemo(
    () =>
      GAME_LEADERBOARDS.map((board) => ({
        id: board.gameId,
        label: board.name[language],
      })),
    [language],
  );

  const activeLeaderboard = useMemo(() => {
    if (GAME_LEADERBOARDS.length === 0) return null;

    return (
      GAME_LEADERBOARDS.find(
        (board) => board.gameId === activeLeaderboardGame,
      ) ?? GAME_LEADERBOARDS[0]
    );
  }, [activeLeaderboardGame]);

  const handleBackToMenu = () => {
    setCurrentGame(null);
  };

  const handleRandomGame = () => {
    const randomGame =
      games[Math.floor(Math.random() * Math.max(games.length, 1))];

    if (randomGame) {
      setCurrentGame(randomGame.id);
    }
  };

  const handlePlayGame = (gameId: string) => {
    setCurrentGame(gameId);
  };

  return (
    <div className="gamehub-shell flex min-h-screen flex-col overflow-x-hidden text-slate-800">
      <Header currentGame={currentGame} onBackToMenu={handleBackToMenu} />

      <main className="w-full flex-grow overflow-x-hidden">
        {currentGame ? (
          <section className="mx-auto w-full max-w-[1680px] px-4 py-6 md:px-8">
            <div className="mb-4 flex flex-col gap-3 border-b border-zinc-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-teal-700">
                  {copy.playing.label}
                </p>
                <h1 className="text-2xl font-bold text-slate-800 md:text-3xl">
                  {currentGameItem?.name}
                </h1>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleRandomGame}
                  className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-700"
                >
                  {copy.playing.random}
                </button>
                <button
                  onClick={handleBackToMenu}
                  className="rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700"
                >
                  {copy.playing.back}
                </button>
              </div>
            </div>
            {currentGameItem?.roomMode === "1v1" && (
              <RealtimeRoomPanel
                key={currentGameItem.id}
                gameId={currentGameItem.id}
                gameName={currentGameItem.name}
                language={language}
              />
            )}
            <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
              {currentGameItem?.component}
            </div>
          </section>
        ) : (
          <div className="mx-auto w-full max-w-[1680px] px-4 py-8 md:px-8 2xl:px-10">
            <section className="grid min-w-0 grid-cols-1 gap-8 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
              <div className="gamehub-home-panel min-w-0 space-y-6">
                <div className="space-y-4">
                  <p className="text-sm font-bold uppercase text-teal-700">
                    {copy.hero.eyebrow}
                  </p>
                  <h1 className="max-w-full break-words text-2xl font-bold leading-tight text-slate-800 md:text-3xl">
                    {copy.hero.title}
                  </h1>
                  <p className="text-base leading-7 text-zinc-600">
                    {copy.hero.description}
                  </p>
                </div>

                <div className="gamehub-visual-panel">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-teal-800">
                      {copy.hero.previewLabel}
                    </p>
                    <span className="rounded-md bg-white/70 px-2 py-1 text-xs font-semibold text-slate-600">
                      {copy.hero.previewMeta}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-6 gap-2">
                    {PREVIEW_TILES.map((tile, index) => (
                      <div
                        key={`${tile.label}-${index}`}
                        className={`${tile.className} flex h-10 items-center justify-center rounded-md text-sm font-bold shadow-sm`}
                      >
                        {tile.label}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleRandomGame}
                    className="rounded-md bg-teal-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-700"
                  >
                    {copy.hero.ctas.primary}
                  </button>
                  <a
                    href="#game-library"
                    className="rounded-md border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-700"
                  >
                    {copy.hero.ctas.secondary}
                  </a>
                </div>

                <dl className="grid grid-cols-1 gap-3 border-y border-teal-100 py-4 sm:grid-cols-3">
                  {heroStats.map((stat) => (
                    <div
                      key={stat.key}
                      className="min-w-0 rounded-lg border border-white/70 bg-white/65 p-3 shadow-sm"
                    >
                      <dt className="text-xs font-medium text-zinc-500">
                        {stat.label}
                      </dt>
                      <dd className="mt-1 break-words text-lg font-bold text-slate-800">
                        {stat.value}
                      </dd>
                    </div>
                  ))}
                </dl>

                <div className="space-y-3">
                  <p className="text-sm font-bold text-slate-800">
                    {copy.quick.heading}
                  </p>
                  <p className="text-sm leading-6 text-zinc-600">
                    {copy.quick.description}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {quickGames.map((game) => (
                      <button
                        key={game.id}
                        onClick={() => handlePlayGame(game.id)}
                        className="rounded-lg border border-teal-100 bg-gradient-to-br from-white to-teal-50/60 p-3 text-left shadow-sm transition hover:border-teal-400 hover:shadow-md"
                      >
                        <span
                          className={`mb-2 flex h-9 w-9 items-center justify-center rounded-md text-base font-bold ${game.accentClass}`}
                        >
                          {game.icon}
                        </span>
                        <span className="block text-sm font-semibold text-slate-800">
                          {game.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div
                id="game-library"
                className="gamehub-home-panel min-w-0 space-y-5"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-sm font-bold uppercase text-teal-700">
                      {copy.library.eyebrow}
                    </p>
                    <h2 className="mt-1 text-2xl font-bold text-slate-800">
                      {copy.library.heading}
                    </h2>
                    <p className="mt-2 text-sm text-zinc-600">
                      {copy.library.description}
                    </p>
                  </div>
                  <div className="w-full md:max-w-sm">
                    <label htmlFor="game-search" className="sr-only">
                      {copy.library.searchLabel}
                    </label>
                    <input
                      id="game-search"
                      type="search"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder={copy.library.searchPlaceholder}
                      className="w-full rounded-md border border-zinc-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-zinc-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {categoryFilters.map((category) => (
                    <button
                      key={category.key}
                      onClick={() => setSelectedCategory(category.key)}
                      aria-pressed={selectedCategory === category.key}
                      className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
                        selectedCategory === category.key
                          ? "border-teal-600 bg-teal-50 text-teal-800"
                          : "border-zinc-300 bg-white text-zinc-700 hover:border-teal-400 hover:text-teal-700"
                      }`}
                    >
                      {category.label}
                    </button>
                  ))}
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredGames.map((game) => {
                    const statusLabel = getStatusLabel(game.status, language);

                    return (
                      <button
                        key={game.id}
                        onClick={() => handlePlayGame(game.id)}
                        className="group relative flex min-h-[214px] flex-col overflow-hidden rounded-lg border border-zinc-200 bg-gradient-to-br from-white via-white to-slate-50 p-4 text-left shadow-[0_16px_40px_rgba(15,23,42,0.07)] transition hover:-translate-y-0.5 hover:border-teal-400 hover:shadow-[0_20px_52px_rgba(15,118,110,0.14)]"
                      >
                        <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-teal-400 via-sky-300 to-amber-300" />
                        <div className="flex items-start gap-3">
                          <div
                            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-md text-lg font-bold ${game.accentClass}`}
                          >
                            {game.icon}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="break-words text-lg font-bold text-slate-800">
                                {game.name}
                              </h3>
                              {statusLabel && (
                                <span className="shrink-0 rounded-md bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-600">
                                  {statusLabel}
                                </span>
                              )}
                            </div>
                            <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-600">
                              {game.tagline}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-zinc-600">
                          <span className="rounded-md bg-zinc-100 px-2 py-1">
                            {game.category}
                          </span>
                          <span className="rounded-md bg-zinc-100 px-2 py-1">
                            {game.difficulty}
                          </span>
                          <span className="rounded-md bg-zinc-100 px-2 py-1">
                            {game.players}
                          </span>
                        </div>

                        <span className="mt-auto inline-flex pt-5 text-sm font-bold text-teal-700 group-hover:text-teal-900">
                          {copy.library.buttonLabel}
                        </span>
                      </button>
                    );
                  })}

                  {filteredGames.length === 0 && (
                    <div className="col-span-full rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center">
                      <p className="text-base font-bold text-slate-800">
                        {copy.library.emptyTitle}
                      </p>
                      <p className="mt-2 text-sm text-zinc-600">
                        {copy.library.emptyDescription}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {activeLeaderboard && (
              <section
                id="leaderboard"
                className="mt-12 border-t border-zinc-200 pt-8"
              >
                <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
                  <div className="space-y-3">
                    <p className="text-sm font-bold uppercase text-teal-700">
                      {copy.leaderboard.eyebrow}
                    </p>
                    <h2 className="text-2xl font-bold text-slate-800">
                      {copy.leaderboard.title}
                    </h2>
                    <p className="text-sm leading-6 text-zinc-600">
                      {copy.leaderboard.description}
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {leaderboardTabs.slice(0, 8).map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveLeaderboardGame(tab.id)}
                          className={`rounded-md border px-3 py-2 text-xs font-semibold transition ${
                            activeLeaderboardGame === tab.id
                              ? "border-teal-600 bg-teal-50 text-teal-800"
                              : "border-zinc-300 bg-white text-zinc-600 hover:border-teal-400 hover:text-teal-700"
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      {activeLeaderboard.entries
                        .slice(0, 3)
                        .map((entry, index) => (
                          <article
                            key={entry.id}
                            className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-zinc-500">
                                  #{index + 1}
                                </p>
                                <h3 className="mt-1 text-base font-bold text-slate-800">
                                  {entry.player}
                                </h3>
                                <p className="text-sm text-zinc-500">
                                  {entry.region}
                                </p>
                              </div>
                              <p className="text-lg font-bold text-teal-700">
                                {formatLeaderboardValue(
                                  entry.value,
                                  activeLeaderboard.valueType,
                                  language,
                                )}
                              </p>
                            </div>
                            <p className="mt-4 text-xs font-semibold text-zinc-500">
                              {copy.leaderboard.metricLabel}:{" "}
                              {activeLeaderboard.metricLabel[language]}
                            </p>
                          </article>
                        ))}
                    </div>
                  </div>
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
