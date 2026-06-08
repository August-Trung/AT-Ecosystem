export type Gender = "male" | "female" | "other";
export type Mood = "chill" | "gaming" | "sad" | "deep";
export type Avatar =
	| "cat"
	| "robot"
	| "ghost"
	| "alien"
	| "human"
	| "pig"
	| "cow";

export const MOOD_DATA: Record<Mood, { label: string; icon: string }> = {
	chill: { label: "CHILL", icon: "☕" },
	gaming: { label: "GAMING", icon: "🎮" },
	sad: { label: "SAD", icon: "🌙" },
	deep: { label: "DEEP", icon: "💬" },
};

export const AVATAR_ICONS: Record<Avatar, string> = {
	cat: "🐱",
	robot: "🤖",
	ghost: "👻",
	alien: "👽",
	human: "🧑",
	pig: "🐷",
	cow: "🐮",
};

export const ALIASES = [
	"Midnight Rider",
	"Neon Dreamer",
	"Star Gazer",
	"Moon Walker",
	"Silent Echo",
	"Dark Knight",
	"City Ghost",
	"Blue Jazz",
	"Retro Soul",
	"Rain Dancer",
	"Velvet Owl",
	"Pixel Heart",
];

export const COMFORT_QUOTES = [
	"Hôm nay bạn đã vất vả rồi, nghỉ ngơi thôi.",
	"Đêm nay, hãy để nỗi buồn tan vào bóng tối.",
	"Ngày mai sẽ là một khởi đầu mới, đừng lo lắng quá.",
	"Bạn không đơn độc, luôn có ai đó ở đây lắng nghe.",
	"Chỉ cần bạn vẫn còn cố gắng, mọi thứ sẽ ổn thôi.",
	"Hãy hít một hơi thật sâu, đêm nay là của riêng bạn.",
	"Đừng quá khắt khe với bản thân, bạn đã làm rất tốt rồi.",
	"Mọi chuyện rồi sẽ ổn, như cách bình minh luôn đến sau đêm dài.",
	"Mệt rồi thì cứ dựa vào đây một chút nhé.",
	"Thế giới ngoài kia ồn ào quá, ở đây bình yên thôi.",
	"Bạn đã làm rất tốt công việc của mình ngày hôm nay.",
	"Một chút trà, một chút nhạc, và một người lạ đang lắng nghe bạn.",
	"Đừng để những lo âu của ngày hôm nay cướp đi giấc ngủ của bạn.",
	"Cảm ơn vì đã kiên cường đến tận bây giờ.",
];

export const REACTION_EMOJIS = ["❤️", "😂", "😮", "😢", "👍", "🔥"];
export const QUICK_GAME_EMOJIS = ["🐷", "💥", "🤡", "😎", "🙏", "😤"];

export const JUKEBOX_SONGS = [
	{ id: 0, name: "Midnight Jazz", icon: "🎷", color: "text-indigo-400" },
	{ id: 1, name: "Neon City Lights", icon: "🌆", color: "text-rose-400" },
	{ id: 2, name: "Pixel Rain Drops", icon: "💧", color: "text-cyan-400" },
	{ id: 3, name: "Vintage Dreams", icon: "📼", color: "text-amber-400" },
];

export const DESTINY_FORTUNES = [
	"Một khởi đầu mới đang chờ đợi bạn vào ngày mai.",
	"Hãy tin vào trực giác của mình, nó đang chỉ đúng hướng.",
	"Sự kiên nhẫn của bạn sẽ sớm được đền đáp xứng đáng.",
	"Đừng sợ bóng tối, vì đó là lúc các vì sao sáng nhất.",
	"Một cuộc gặp gỡ bất ngờ sẽ làm thay đổi suy nghĩ của bạn.",
	"Hãy dành thời gian để yêu thương bản thân mình hơn.",
	"Mọi khó khăn hiện tại chỉ là bước đệm cho thành công.",
	"Vận may đang mỉm cười với bạn, hãy nắm bắt lấy nó.",
];

export interface Message {
	id: string;
	sender: "me" | "stranger" | "system" | "bartender";
	senderAlias?: string;
	senderAvatar?: Avatar;
	text?: string;
	image?: string;
	timestamp: number;
	reactions?: Record<string, number>;
}

export enum AppState {
	CLOSED = "CLOSED",
	LOBBY = "LOBBY",
	MATCHING = "MATCHING",
	CHATTING = "CHATTING",
	CLOSING = "CLOSING",
}

export interface Card {
	id: number;
	rank: number;
	suit: number;
}

export interface GameState {
	hand: Card[];
	opponentCardIds: number[];
	opponentCardCount: number;
	lastPlayedCards: Card[];
	isMyTurn: boolean;
	requiredOpeningCardId: number | null;
	status: "idle" | "pendingInvite" | "invited" | "playing" | "ended" | "quit";
	winner?: "me" | "stranger";
	myCoins: number;
}

export interface Memory {
	id: string;
	text: string;
	alias: string;
	timestamp: number;
}

export interface PeerMessage {
	type:
		| "chat"
		| "typing"
		| "image"
		| "handshake"
		| "vibe_sync"
		| "reaction"
		| "game_invite"
		| "game_decline"
		| "game_start"
		| "game_move"
		| "game_pass"
		| "game_quit"
		| "game_emoji"
		| "game_ttt_invite"
		| "game_ttt_decline"
		| "game_ttt_start"
		| "game_ttt_move"
		| "game_ttt_quit"
		| "game_ttt_emoji"
		| "sketch_data"
		| "sketch_close"
		| "jukebox_sync"
		| "dice_roll";
	id?: string;
	content?: string;
	isTyping?: boolean;
	avatar?: Avatar;
	alias?: string;
	vibe?: "lofi" | "rain" | "waves" | "jazz" | "campfire" | "cafe" | "off";
	messageId?: string;
	emoji?: string;
	action?: "add" | "remove";
	cards?: number[];
	dealerCards?: number[];
	count?: number;
	firstTurn?: boolean;
	openingCardId?: number;
	sketch?: string;
	trackIndex?: number;
	diceValue?: number;
	cellIndex?: number;
	symbol?: "X" | "O";
}

// === LOBBY 2D TYPES ===
export interface LobbyPeer {
	id: string;
	x: number;
	y: number;
	avatar: Avatar;
	alias: string;
	emoji?: string;
	emojiExpiry?: number;
	lastSeen: number;
	direction: "left" | "right";
}

export interface BartenderMessage {
	id: string;
	sender: "user" | "bartender";
	text: string;
	timestamp: number;
}

// Room constants (logical coordinates for Canvas)
export const ROOM_WIDTH = 1200;
export const ROOM_HEIGHT = 500;
export const GROUND_Y = 390;
export const BARTENDER_X = 980;
export const BARTENDER_ZONE = 130;
export const MAX_LOBBY_PEERS = 20;
export const LOBBY_EMOJIS = ["👋", "😊", "🔥", "💤", "🎵", "❤️", "😂", "🤔"];
