// import { GoogleGenAI } from "@google/genai";

// const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateIcebreaker = async (mood: string): Promise<string> => {
	// try {
	// 	const response = await ai.models.generateContent({
	// 		model: "gemini-3-flash-preview",
	// 		contents: `Bạn là một chủ quán bar lofi tên là "Midnight Lounge". Hãy viết một câu chào mừng ngắn gọn (dưới 20 từ), ấm áp, sâu sắc để bắt đầu cuộc trò chuyện cho một người đang cảm thấy ${mood}. Trả lời bằng tiếng Việt.`,
	// 	});
	// 	return (
	// 		response.text?.trim() || "Chào mừng bạn đến với Midnight Lounge."
	// 	);
	// } catch (error) {
	// 	return "Chào mừng bạn đến với Midnight Lounge.";
	// }
	return "Chào mừng bạn đến với Midnight Lounge.";
};

/**
 * Gợi ý chủ đề khi cuộc trò chuyện bị gián đoạn quá lâu
 */
export const generateSilenceBreaker = async (): Promise<string> => {
	// try {
	// 	const response = await ai.models.generateContent({
	// 		model: "gemini-3-flash-preview",
	// 		contents: `Hai người lạ đang trò chuyện ở quán bar Midnight Lounge nhưng đang bị im lặng. Hãy đưa ra một câu hỏi "Deep Talk" hoặc một chủ đề thú vị, ngắn gọn, bí ẩn để họ tiếp tục làm quen. Tiếng Việt, phong cách lofi, dưới 25 từ.`,
	// 	});
	// 	return (
	// 		response.text?.trim() ||
	// 		"Có điều gì về đêm nay làm bạn suy nghĩ không?"
	// 	);
	// } catch (error) {
	// 	return "Hãy chia sẻ một điều bí mật mà bạn chưa bao giờ nói với ai...";
	// }
	return "Hãy chia sẻ một điều bí mật mà bạn chưa bao giờ nói với ai...";
};

/**
 * Lời chúc cuối ngày lúc 4h sáng
 */
export const generateFarewell = async (): Promise<string> => {
	// try {
	// 	const response = await ai.models.generateContent({
	// 		model: "gemini-3-flash-preview",
	// 		contents: `Quán bar Midnight Lounge chuẩn bị đóng cửa (4h sáng). Hãy viết một lời chào tạm biệt đầy cảm xúc, ấm áp, chúc mọi người ngủ ngon và hẹn gặp lại vào đêm mai lúc 22h. Tiếng Việt, dưới 30 từ.`,
	// 	});
	// 	return (
	// 		response.text?.trim() ||
	// 		"Trời đã sắp sáng, chúc bạn có những giấc mơ đẹp. Hẹn gặp lại bạn vào 22h đêm mai."
	// 	);
	// } catch (error) {
	// 	return "Đêm đã muộn, quán bar xin tạm biệt. Chúc bạn ngủ ngon.";
	// }
	return "Đêm đã muộn, quán bar xin tạm biệt. Chúc bạn ngủ ngon.";
};
