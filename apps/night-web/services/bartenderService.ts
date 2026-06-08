import { BartenderMessage } from "../types";

// Static fallback responses — no API key needed
const GREETINGS = [
	"Chào bạn, đêm nay muốn uống gì?",
	"Welcome! Quán vắng quá, ngồi xuống đi.",
	"Lại thức khuya hả? Để tôi pha cho ly gì đó nhé.",
	"Khách quen hay khách mới đây? Ngồi thoải mái nhé.",
	"Một đêm nữa lại đến... có gì muốn tâm sự không?",
];

const DRINK_RESPONSES = [
	"Một ly Midnight Melancholy cho bạn — vị đắng nhẹ, hậu ngọt như ký ức.",
	"Tôi pha cho bạn ly Neon Dreams — xanh lấp lánh, uống vào mơ đẹp.",
	"Đây, một ly Pixel Sunset — cam hồng, ấm như hoàng hôn cuối ngày.",
	"Ly Starlight Espresso đặc biệt — caffeine đủ để thức đến sáng.",
	"Cocktail \"404 Not Found\" — vị gì cũng không biết, nhưng ngon lắm.",
	"Ly Retro Fizz — sủi bọt như tiếng modem dial-up ngày xưa.",
];

const COMFORT_RESPONSES = [
	"Đêm nào cũng vậy, có lúc vui có lúc buồn. Nhưng bạn đến đây là tốt rồi.",
	"Tôi chỉ là bartender, nhưng tôi biết lắng nghe.",
	"Đôi khi chỉ cần ngồi yên, ngắm thành phố về đêm là đủ.",
	"Mọi thứ rồi sẽ ổn thôi. Tin tôi đi, tôi đã thấy nhiều đêm rồi.",
	"Bạn biết không, những người hay thức khuya thường là những người sâu sắc nhất.",
	"Cứ để nỗi buồn tan vào ly đi. Đêm mai lại là một đêm mới.",
];

const STORY_RESPONSES = [
	"Hôm qua có một người lạ ngồi đúng chỗ bạn, viết một bức thư rồi ra đi mà không uống gì.",
	"Bạn có biết tại sao quán này chỉ mở ban đêm không? Vì ban ngày... thế giới thuộc về ánh sáng.",
	"Có một lần, hai người lạ gặp nhau ở quán này, trò chuyện đến 4h sáng, rồi không bao giờ gặp lại.",
	"Truyền thuyết kể rằng nếu bạn nhìn ra cửa sổ đúng lúc sao băng, điều ước sẽ thành sự thật.",
	"Đã từng có một con mèo pixel sống ở quán này. Nó biến mất vào đêm trăng tròn cuối cùng.",
];

const GENERIC_RESPONSES = [
	"Hmm, thú vị đấy. Kể thêm đi.",
	"Tôi hiểu. Uống thêm chút nữa nhé.",
	"*lau ly* ...tiếp tục đi, tôi đang nghe.",
	"Đêm còn dài mà, không vội.",
	"Ha, chuyện hay đấy. Lâu rồi không ai kể cho tôi nghe chuyện.",
	"*gật đầu* Cuộc sống mà, đôi khi vậy thôi.",
	"Bạn nhắc tôi nhớ đến một vị khách cũ...",
	"Để tôi pha thêm ly nữa trong lúc nghe bạn kể.",
	"Wow. Tôi sẽ nhớ câu chuyện này.",
	"Đêm nay trời đẹp quá, uống thêm ly nữa không?",
];

// Simple keyword matching for response category
function categorizeMessage(text: string): "drink" | "comfort" | "story" | "generic" {
	const lower = text.toLowerCase();

	const drinkWords = ["uống", "pha", "ly", "cocktail", "nước", "bia", "rượu", "drink", "cafe", "cà phê", "trà", "menu"];
	const comfortWords = ["buồn", "mệt", "chán", "cô đơn", "khóc", "stress", "lo", "sợ", "đau", "nhớ", "tâm sự", "chia sẻ", "vất vả", "sad"];
	const storyWords = ["kể", "chuyện", "truyện", "story", "bí mật", "truyền thuyết", "ngày xưa", "hôm qua", "ai", "bao giờ"];

	if (drinkWords.some((w) => lower.includes(w))) return "drink";
	if (comfortWords.some((w) => lower.includes(w))) return "comfort";
	if (storyWords.some((w) => lower.includes(w))) return "story";
	return "generic";
}

function pickRandom<T>(arr: T[]): T {
	return arr[Math.floor(Math.random() * arr.length)];
}

let lastResponseTime = 0;
const MIN_RESPONSE_INTERVAL = 1500; // 1.5s between responses

export async function chatWithBartender(
	userMessage: string,
	_history: BartenderMessage[],
): Promise<string> {
	// Rate limit
	const now = Date.now();
	if (now - lastResponseTime < MIN_RESPONSE_INTERVAL) {
		await new Promise((r) => setTimeout(r, MIN_RESPONSE_INTERVAL - (now - lastResponseTime)));
	}
	lastResponseTime = Date.now();

	// Simulate AI thinking delay (400-1200ms)
	await new Promise((r) => setTimeout(r, 400 + Math.random() * 800));

	const category = categorizeMessage(userMessage);
	switch (category) {
		case "drink":
			return pickRandom(DRINK_RESPONSES);
		case "comfort":
			return pickRandom(COMFORT_RESPONSES);
		case "story":
			return pickRandom(STORY_RESPONSES);
		default:
			return pickRandom(GENERIC_RESPONSES);
	}
}

export function getGreeting(): string {
	return pickRandom(GREETINGS);
}
