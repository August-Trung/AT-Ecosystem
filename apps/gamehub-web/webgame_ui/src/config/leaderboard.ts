import { Localized } from "@/types/i18n";

export type LeaderboardValueType =
	| "points"
	| "streak"
	| "time"
	| "percent"
	| "combo"
	| "rating"
	| "count";

export interface LeaderboardEntry {
	id: string;
	player: string;
	handle: string;
	region: string;
	value: number;
	delta: number;
}

export interface GameLeaderboard {
	gameId: string;
	name: Localized;
	description: Localized;
	metricLabel: Localized;
	unit: Localized;
	valueType: LeaderboardValueType;
	entries: LeaderboardEntry[];
}

export interface GlobalLeaderboardEntry {
	id: string;
	player: string;
	handle: string;
	region: string;
	totalPoints: number;
	winRate: number;
	change: number;
	topGames: string[];
}

export const GAME_LEADERBOARDS: GameLeaderboard[] = [
	{
		gameId: "wordle",
		name: { vi: "Wordle", en: "Wordle" },
		description: {
			vi: "Chuỗi đoán chuẩn không cần chỉnh trong 24h gần nhất.",
			en: "Cleanest guess streaks in the past 24h.",
		},
		metricLabel: { vi: "Chuỗi thắng", en: "Win streak" },
		unit: { vi: "chuỗi", en: "streak" },
		valueType: "streak",
		entries: [
			{
				id: "wordle-1",
				player: "Akira Nguyễn",
				handle: "@akira.exe",
				region: "Hà Nội, VN",
				value: 42,
				delta: 2,
			},
			{
				id: "wordle-2",
				player: "Linh Đào",
				handle: "@linhdao",
				region: "TP.HCM, VN",
				value: 39,
				delta: 0,
			},
			{
				id: "wordle-3",
				player: "Evelyn Park",
				handle: "@evepark",
				region: "Seoul, KR",
				value: 35,
				delta: -1,
			},
		],
	},
	{
		gameId: "2048",
		name: { vi: "2048", en: "2048" },
		description: {
			vi: "Điểm maraton cao nhất với 4x combo tiết kiệm bước.",
			en: "Marathon scores fueled by low-move combos.",
		},
		metricLabel: { vi: "Điểm cao", en: "High score" },
		unit: { vi: "điểm", en: "pts" },
		valueType: "points",
		entries: [
			{
				id: "2048-1",
				player: "Mai Lâm",
				handle: "@mailam",
				region: "Huế, VN",
				value: 128420,
				delta: 1,
			},
			{
				id: "2048-2",
				player: "Noah Trần",
				handle: "@noahtr",
				region: "Toronto, CA",
				value: 121050,
				delta: 0,
			},
			{
				id: "2048-3",
				player: "Sora Ito",
				handle: "@soraito",
				region: "Osaka, JP",
				value: 110320,
				delta: -2,
			},
		],
	},
	{
		gameId: "sudoku",
		name: { vi: "Sudoku", en: "Sudoku" },
		description: {
			vi: "Bảng 9x9 được giải sạch trong thời gian ngắn nhất.",
			en: "Fastest flawless 9x9 clears.",
		},
		metricLabel: { vi: "Thời gian nhanh nhất", en: "Fastest clear" },
		unit: { vi: "thời gian", en: "time" },
		valueType: "time",
		entries: [
			{
				id: "sudoku-1",
				player: "Iris Đỗ",
				handle: "@irisdo",
				region: "Singapore",
				value: 308,
				delta: 3,
			},
			{
				id: "sudoku-2",
				player: "Linh Đào",
				handle: "@linhdao",
				region: "TP.HCM, VN",
				value: 322,
				delta: 0,
			},
			{
				id: "sudoku-3",
				player: "Daniel Phạm",
				handle: "@danpham",
				region: "Seattle, US",
				value: 335,
				delta: -1,
			},
		],
	},
	{
		gameId: "caro",
		name: { vi: "Caro", en: "Caro" },
		description: {
			vi: "Điểm ELO phòng đấu xếp hạng chiều nay.",
			en: "Ranked lobby ELO from this evening.",
		},
		metricLabel: { vi: "Điểm ELO", en: "ELO rating" },
		unit: { vi: "điểm", en: "pts" },
		valueType: "rating",
		entries: [
			{
				id: "caro-1",
				player: "Lucas Phạm",
				handle: "@lucas.gg",
				region: "Đà Nẵng, VN",
				value: 2310,
				delta: 1,
			},
			{
				id: "caro-2",
				player: "Harper Võ",
				handle: "@harper",
				region: "Sydney, AU",
				value: 2260,
				delta: 0,
			},
			{
				id: "caro-3",
				player: "Kenji Lee",
				handle: "@kenjilee",
				region: "San Jose, US",
				value: 2215,
				delta: -1,
			},
		],
	},
	{
		gameId: "battleship",
		name: { vi: "Battleship", en: "Battleship" },
		description: {
			vi: "Độ chính xác radar trong 10 trận gần nhất.",
			en: "Radar accuracy across the last 10 duels.",
		},
		metricLabel: { vi: "Tỉ lệ trúng", en: "Hit accuracy" },
		unit: { vi: "% chính xác", en: "% accuracy" },
		valueType: "percent",
		entries: [
			{
				id: "battleship-1",
				player: "Noah Trần",
				handle: "@noahtr",
				region: "Toronto, CA",
				value: 95.4,
				delta: 0,
			},
			{
				id: "battleship-2",
				player: "Evelyn Park",
				handle: "@evepark",
				region: "Seoul, KR",
				value: 92.1,
				delta: 1,
			},
			{
				id: "battleship-3",
				player: "Mai Lâm",
				handle: "@mailam",
				region: "Huế, VN",
				value: 90.3,
				delta: -1,
			},
		],
	},
	{
		gameId: "tetrisGame",
		name: { vi: "Tetris", en: "Tetris" },
		description: {
			vi: "Điểm maraton neon không bỏ lỡ single clear nào.",
			en: "Neon marathon scores with zero single clears.",
		},
		metricLabel: { vi: "Điểm maraton", en: "Marathon score" },
		unit: { vi: "điểm", en: "pts" },
		valueType: "points",
		entries: [
			{
				id: "tetris-1",
				player: "Evelyn Park",
				handle: "@evepark",
				region: "Seoul, KR",
				value: 987450,
				delta: 0,
			},
			{
				id: "tetris-2",
				player: "Akira Nguyễn",
				handle: "@akira.exe",
				region: "Hà Nội, VN",
				value: 954200,
				delta: 1,
			},
			{
				id: "tetris-3",
				player: "Sora Ito",
				handle: "@soraito",
				region: "Osaka, JP",
				value: 932100,
				delta: -1,
			},
		],
	},
	{
		gameId: "blockblast",
		name: { vi: "Block Blast", en: "Block Blast" },
		description: {
			vi: "Chuỗi combo 10x10 dài nhất với ít reroll.",
			en: "Longest 10x10 combo chains without rerolls.",
		},
		metricLabel: { vi: "Combo cao nhất", en: "Highest combo" },
		unit: { vi: "combo", en: "combo" },
		valueType: "combo",
		entries: [
			{
				id: "blockblast-1",
				player: "Harper Võ",
				handle: "@harper",
				region: "Sydney, AU",
				value: 28,
				delta: 2,
			},
			{
				id: "blockblast-2",
				player: "Iris Đỗ",
				handle: "@irisdo",
				region: "Singapore",
				value: 26,
				delta: 0,
			},
			{
				id: "blockblast-3",
				player: "Daniel Phạm",
				handle: "@danpham",
				region: "Seattle, US",
				value: 24,
				delta: -1,
			},
		],
	},
	{
		gameId: "chessGame",
		name: { vi: "Chess", en: "Chess" },
		description: {
			vi: "Chỉ số blitz 3 phút trên bàn đấu điện ảnh.",
			en: "3-min blitz ratings inside the cinematic board.",
		},
		metricLabel: { vi: "Điểm Blitz", en: "Blitz rating" },
		unit: { vi: "điểm", en: "pts" },
		valueType: "rating",
		entries: [
			{
				id: "chess-1",
				player: "Lucas Phạm",
				handle: "@lucas.gg",
				region: "Đà Nẵng, VN",
				value: 2140,
				delta: 0,
			},
			{
				id: "chess-2",
				player: "Kenji Lee",
				handle: "@kenjilee",
				region: "San Jose, US",
				value: 2095,
				delta: 1,
			},
			{
				id: "chess-3",
				player: "Harper Võ",
				handle: "@harper",
				region: "Sydney, AU",
				value: 2060,
				delta: -1,
			},
		],
	},
	{
		gameId: "hangmanGame",
		name: { vi: "Hangman", en: "Hangman" },
		description: {
			vi: "Chuỗi perfect không sai chữ nào.",
			en: "Perfect clears with zero misses.",
		},
		metricLabel: { vi: "Chuỗi perfect", en: "Perfect streak" },
		unit: { vi: "chuỗi", en: "streak" },
		valueType: "streak",
		entries: [
			{
				id: "hangman-1",
				player: "Mai Lâm",
				handle: "@mailam",
				region: "Huế, VN",
				value: 27,
				delta: 2,
			},
			{
				id: "hangman-2",
				player: "Iris Đỗ",
				handle: "@irisdo",
				region: "Singapore",
				value: 24,
				delta: 0,
			},
			{
				id: "hangman-3",
				player: "Noah Trần",
				handle: "@noahtr",
				region: "Toronto, CA",
				value: 21,
				delta: -1,
			},
		],
	},
	{
		gameId: "ludo",
		name: { vi: "Ludo", en: "Ludo" },
		description: {
			vi: "Số vương miện mùa party-night tuần này.",
			en: "Season crowns earned in this week's party runs.",
		},
		metricLabel: { vi: "Vương miện mùa", en: "Season crowns" },
		unit: { vi: "cúp", en: "crowns" },
		valueType: "count",
		entries: [
			{
				id: "ludo-1",
				player: "Harper Võ",
				handle: "@harper",
				region: "Sydney, AU",
				value: 18,
				delta: 1,
			},
			{
				id: "ludo-2",
				player: "Akira Nguyễn",
				handle: "@akira.exe",
				region: "Hà Nội, VN",
				value: 16,
				delta: 0,
			},
			{
				id: "ludo-3",
				player: "Linh Đào",
				handle: "@linhdao",
				region: "TP.HCM, VN",
				value: 14,
				delta: -1,
			},
		],
	},
	{
		gameId: "chinesechessgame",
		name: { vi: "Cờ tướng", en: "Chinese Chess" },
		description: {
			vi: "Điểm chiến thuật giải đấu sáng nay.",
			en: "Strategy scores from this morning's bracket.",
		},
		metricLabel: { vi: "Điểm cờ tướng", en: "Tournament rating" },
		unit: { vi: "điểm", en: "pts" },
		valueType: "rating",
		entries: [
			{
				id: "xiangqi-1",
				player: "Trung Kiên",
				handle: "@kienplays",
				region: "Hải Phòng, VN",
				value: 2380,
				delta: 2,
			},
			{
				id: "xiangqi-2",
				player: "Lucas Phạm",
				handle: "@lucas.gg",
				region: "Đà Nẵng, VN",
				value: 2325,
				delta: 0,
			},
			{
				id: "xiangqi-3",
				player: "Evelyn Park",
				handle: "@evepark",
				region: "Seoul, KR",
				value: 2290,
				delta: -1,
			},
		],
	},
	{
		gameId: "mandarinsquarecapturing",
		name: { vi: "Ô ăn quan", en: "Mandarin Square" },
		description: {
			vi: "Điểm thu hoạch hạt quan trong 5 hiệp.",
			en: "Harvest scores across five rounds.",
		},
		metricLabel: { vi: "Điểm thu hoạch", en: "Harvest score" },
		unit: { vi: "điểm", en: "pts" },
		valueType: "points",
		entries: [
			{
				id: "oanquan-1",
				player: "Harper Võ",
				handle: "@harper",
				region: "Sydney, AU",
				value: 169,
				delta: 1,
			},
			{
				id: "oanquan-2",
				player: "Mai Lâm",
				handle: "@mailam",
				region: "Huế, VN",
				value: 160,
				delta: 0,
			},
			{
				id: "oanquan-3",
				player: "Trung Kiên",
				handle: "@kienplays",
				region: "Hải Phòng, VN",
				value: 154,
				delta: -1,
			},
		],
	},
];

export const GLOBAL_LEADERBOARD: GlobalLeaderboardEntry[] = [
	{
		id: "global-1",
		player: "Akira Nguyễn",
		handle: "@akira.exe",
		region: "Hà Nội, VN",
		totalPoints: 4820,
		winRate: 74.5,
		change: 1,
		topGames: ["wordle", "sudoku", "ludo"],
	},
	{
		id: "global-2",
		player: "Evelyn Park",
		handle: "@evepark",
		region: "Seoul, KR",
		totalPoints: 4630,
		winRate: 71.2,
		change: 0,
		topGames: ["tetrisGame", "2048", "battleship"],
	},
	{
		id: "global-3",
		player: "Lucas Phạm",
		handle: "@lucas.gg",
		region: "Đà Nẵng, VN",
		totalPoints: 4520,
		winRate: 69.8,
		change: -1,
		topGames: ["caro", "chessGame", "chinesechessgame"],
	},
	{
		id: "global-4",
		player: "Harper Võ",
		handle: "@harper",
		region: "Sydney, AU",
		totalPoints: 4385,
		winRate: 68.0,
		change: 2,
		topGames: ["blockblast", "mandarinsquarecapturing", "hangmanGame"],
	},
	{
		id: "global-5",
		player: "Noah Trần",
		handle: "@noahtr",
		region: "Toronto, CA",
		totalPoints: 4210,
		winRate: 66.7,
		change: 0,
		topGames: ["battleship", "2048", "sudoku"],
	},
];
