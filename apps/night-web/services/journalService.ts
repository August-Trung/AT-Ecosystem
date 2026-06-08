import { Avatar, JournalEntry, Letter } from "../types";

// Helper to generate a simple UUID
function generateUUID(): string {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
		return crypto.randomUUID();
	}
	return "user-" + Math.random().toString(36).substring(2, 15) + "-" + Date.now().toString(36);
}

// Initialize persistent user ID
export const userId: string = (() => {
	let id = localStorage.getItem("m_user_uuid");
	if (!id) {
		id = generateUUID();
		localStorage.setItem("m_user_uuid", id);
	}
	return id;
})();

// Seed data for LocalStorage fallback
const SEED_JOURNALS: JournalEntry[] = [
	{
		id: "seed-j-1",
		content: "Góc nhỏ lofi này yên tĩnh thật. Ước gì cuộc sống ban ngày cũng nhẹ nhàng thế này...",
		alias: "Neon Rider",
		avatar: "cat",
		mood: "chill",
		likes: 14,
		timestamp: Date.now() - 3600000 * 3, // 3 hours ago
	},
	{
		id: "seed-j-2",
		content: "Hôm nay làm việc mệt mỏi quá, nhưng nghe bản nhạc jazz ở jukebox bỗng thấy lòng dịu lại.",
		alias: "Midnight Rider",
		avatar: "human",
		mood: "chill",
		likes: 8,
		timestamp: Date.now() - 3600000 * 2, // 2 hours ago
	},
	{
		id: "seed-j-3",
		content: "Có ai ở đây cũng đang thức vì lo lắng cho tương lai không? Cố lên nhé, mọi chuyện rồi sẽ ổn.",
		alias: "Star Gazer",
		avatar: "ghost",
		mood: "deep",
		likes: 25,
		timestamp: Date.now() - 3600000 * 1.5,
	},
	{
		id: "seed-j-4",
		content: "Game Caro 15x15 chơi cuốn thực sự, vừa được cộng 50 xu vui ghê haha.",
		alias: "Pixel Heart",
		avatar: "robot",
		mood: "gaming",
		likes: 5,
		timestamp: Date.now() - 1800000, // 30 mins ago
	},
	{
		id: "seed-j-5",
		content: "Nỗi buồn đêm muộn... Mong ngày mai sẽ là một ngày đầy nắng ấm áp hơn.",
		alias: "Velvet Owl",
		avatar: "alien",
		mood: "sad",
		likes: 18,
		timestamp: Date.now() - 900000, // 15 mins ago
	},
];

const SEED_LETTERS: Letter[] = [
	{
		id: "seed-l-1",
		content: "Gửi người lạ vô danh, nếu bạn đang đọc được bức thư này, chúc bạn có một giấc ngủ thật ngon và những giấc mơ đẹp nhé. Cảm ơn bạn vì đã ghé qua quán bar đêm nay.",
		senderId: "seed-user-1",
		recipientId: null,
		replyToId: null,
		timestamp: Date.now() - 3600000 * 4,
		senderAlias: "Velvet Owl",
		senderAvatar: "ghost",
	},
	{
		id: "seed-l-2",
		content: "Đêm nay thành phố mưa to quá. Ngồi trong phòng nghe tiếng mưa rơi tự dưng thấy nhớ nhà da diết... Có ai muốn cùng chia sẻ cảm giác này không?",
		senderId: "seed-user-2",
		recipientId: null,
		replyToId: null,
		timestamp: Date.now() - 3600000 * 2.5,
		senderAlias: "Rain Dancer",
		senderAvatar: "cat",
	},
];

// Read environment variables
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || "";
const supabaseKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || "";
const gistToken = (import.meta as any).env?.VITE_GIST_TOKEN || "";
const gistId = (import.meta as any).env?.VITE_GIST_ID || "";

const isSupabaseEnabled = !!(supabaseUrl && supabaseKey);
const isGistEnabled = !!(gistToken && gistId);

// Custom REST headers for Supabase
const getSupabaseHeaders = () => ({
	apikey: supabaseKey,
	Authorization: `Bearer ${supabaseKey}`,
	"Content-Type": "application/json",
});

// Helper for Gist API calls
async function fetchGistData(): Promise<{ journals: JournalEntry[]; letters: Letter[] }> {
	try {
		const res = await fetch(`https://api.github.com/gists/${gistId}`, {
			headers: {
				Authorization: `token ${gistToken}`,
				Accept: "application/vnd.github.v3+json",
			},
		});
		if (!res.ok) throw new Error("Failed to fetch gist");
		const data = await res.json();
		const journalsContent = data.files["night_journals.json"]?.content;
		const lettersContent = data.files["anonymous_letters.json"]?.content;

		return {
			journals: journalsContent ? JSON.parse(journalsContent) : [],
			letters: lettersContent ? JSON.parse(lettersContent) : [],
		};
	} catch (e) {
		console.error("Gist fetch error, fallback to empty object:", e);
		return { journals: [], letters: [] };
	}
}

async function saveGistData(journals: JournalEntry[], letters: Letter[]): Promise<boolean> {
	try {
		const res = await fetch(`https://api.github.com/gists/${gistId}`, {
			method: "PATCH",
			headers: {
				Authorization: `token ${gistToken}`,
				Accept: "application/vnd.github.v3+json",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				files: {
					"night_journals.json": { content: JSON.stringify(journals, null, 2) },
					"anonymous_letters.json": { content: JSON.stringify(letters, null, 2) },
				},
			}),
		});
		return res.ok;
	} catch (e) {
		console.error("Gist save error:", e);
		return false;
	}
}

// LocalStorage helpers
function getLocalJournals(): JournalEntry[] {
	const data = localStorage.getItem("night_journals_local");
	if (!data) {
		localStorage.setItem("night_journals_local", JSON.stringify(SEED_JOURNALS));
		return SEED_JOURNALS;
	}
	return JSON.parse(data);
}

function saveLocalJournals(journals: JournalEntry[]): void {
	localStorage.setItem("night_journals_local", JSON.stringify(journals));
}

function getLocalLetters(): Letter[] {
	const data = localStorage.getItem("anonymous_letters_local");
	if (!data) {
		localStorage.setItem("anonymous_letters_local", JSON.stringify(SEED_LETTERS));
		return SEED_LETTERS;
	}
	return JSON.parse(data);
}

function saveLocalLetters(letters: Letter[]): void {
	localStorage.setItem("anonymous_letters_local", JSON.stringify(letters));
}

// Main Journal Service export
export const journalService = {
	/**
	 * Fetch all journal entries, sorted by timestamp descending
	 */
	async getEntries(): Promise<JournalEntry[]> {
		if (isSupabaseEnabled) {
			try {
				const res = await fetch(
					`${supabaseUrl}/rest/v1/night_journals?select=*&order=created_at.desc`,
					{ headers: getSupabaseHeaders() }
				);
				if (!res.ok) throw new Error("Supabase fetch failed");
				const data = await res.json();
				return data.map((item: any) => ({
					id: item.id,
					content: item.content,
					alias: item.alias,
					avatar: item.avatar as Avatar,
					mood: item.mood,
					likes: item.likes,
					timestamp: new Date(item.created_at).getTime(),
				}));
			} catch (e) {
				console.warn("Supabase fetch journal failed, using local fallback", e);
				return getLocalJournals();
			}
		} else if (isGistEnabled) {
			const data = await fetchGistData();
			return data.journals.sort((a, b) => b.timestamp - a.timestamp);
		} else {
			// LocalStorage Mode
			return getLocalJournals().sort((a, b) => b.timestamp - a.timestamp);
		}
	},

	/**
	 * Write a new journal entry
	 */
	async createEntry(content: string, alias: string, avatar: Avatar, mood: string): Promise<JournalEntry | null> {
		const newEntry: JournalEntry = {
			id: generateUUID(),
			content,
			alias: alias || "Người Lạ",
			avatar,
			mood,
			likes: 0,
			timestamp: Date.now(),
		};

		if (isSupabaseEnabled) {
			try {
				const res = await fetch(`${supabaseUrl}/rest/v1/night_journals`, {
					method: "POST",
					headers: {
						...getSupabaseHeaders(),
						Prefer: "return=representation",
					},
					body: JSON.stringify({
						content,
						alias: newEntry.alias,
						avatar,
						mood,
						likes: 0,
					}),
				});
				if (!res.ok) throw new Error("Supabase insert failed");
				const inserted = await res.json();
				if (inserted && inserted[0]) {
					const item = inserted[0];
					return {
						id: item.id,
						content: item.content,
						alias: item.alias,
						avatar: item.avatar as Avatar,
						mood: item.mood,
						likes: item.likes,
						timestamp: new Date(item.created_at).getTime(),
					};
				}
				return newEntry;
			} catch (e) {
				console.warn("Supabase insert journal failed, saving locally", e);
				const local = getLocalJournals();
				local.unshift(newEntry);
				saveLocalJournals(local);
				return newEntry;
			}
		} else if (isGistEnabled) {
			const data = await fetchGistData();
			data.journals.unshift(newEntry);
			const success = await saveGistData(data.journals, data.letters);
			return success ? newEntry : null;
		} else {
			const local = getLocalJournals();
			local.unshift(newEntry);
			saveLocalJournals(local);
			return newEntry;
		}
	},

	/**
	 * Like a journal entry
	 */
	async likeEntry(id: string): Promise<boolean> {
		if (isSupabaseEnabled) {
			try {
				// Fetch current likes count
				const fetchRes = await fetch(`${supabaseUrl}/rest/v1/night_journals?id=eq.${id}&select=likes`, {
					headers: getSupabaseHeaders(),
				});
				if (!fetchRes.ok) throw new Error("Failed to fetch likes");
				const fetchVal = await fetchRes.json();
				const currentLikes = fetchVal[0]?.likes || 0;

				// Update likes count + 1
				const res = await fetch(`${supabaseUrl}/rest/v1/night_journals?id=eq.${id}`, {
					method: "PATCH",
					headers: getSupabaseHeaders(),
					body: JSON.stringify({ likes: currentLikes + 1 }),
				});
				return res.ok;
			} catch (e) {
				console.warn("Supabase like failed, running local fallback", e);
				const local = getLocalJournals();
				const idx = local.findIndex((j) => j.id === id);
				if (idx !== -1) {
					local[idx].likes += 1;
					saveLocalJournals(local);
					return true;
				}
				return false;
			}
		} else if (isGistEnabled) {
			const data = await fetchGistData();
			const idx = data.journals.findIndex((j) => j.id === id);
			if (idx !== -1) {
				data.journals[idx].likes += 1;
				return await saveGistData(data.journals, data.letters);
			}
			return false;
		} else {
			const local = getLocalJournals();
			const idx = local.findIndex((j) => j.id === id);
			if (idx !== -1) {
				local[idx].likes += 1;
				saveLocalJournals(local);
				return true;
			}
			return false;
		}
	},

	/**
	 * Send an anonymous letter
	 */
	async sendLetter(
		content: string,
		senderAlias: string,
		senderAvatar: Avatar,
		recipientId: string | null = null,
		replyToId: string | null = null
	): Promise<boolean> {
		const newLetter: Letter = {
			id: generateUUID(),
			content,
			senderId: userId,
			recipientId,
			replyToId,
			timestamp: Date.now(),
			senderAlias: senderAlias || "Người Lạ",
			senderAvatar,
		};

		if (isSupabaseEnabled) {
			try {
				const res = await fetch(`${supabaseUrl}/rest/v1/anonymous_letters`, {
					method: "POST",
					headers: getSupabaseHeaders(),
					body: JSON.stringify({
						content,
						sender_id: userId,
						recipient_id: recipientId,
						reply_to_id: replyToId,
						sender_alias: newLetter.senderAlias,
						sender_avatar: senderAvatar,
					}),
				});
				return res.ok;
			} catch (e) {
				console.warn("Supabase send letter failed, sending locally", e);
				const local = getLocalLetters();
				local.unshift(newLetter);
				saveLocalLetters(local);
				return true;
			}
		} else if (isGistEnabled) {
			const data = await fetchGistData();
			data.letters.unshift(newLetter);
			return await saveGistData(data.journals, data.letters);
		} else {
			const local = getLocalLetters();
			local.unshift(newLetter);
			saveLocalLetters(local);
			return true;
		}
	},

	/**
	 * Retrieve a random letter from the public pool (not written by this user, and recipientId is null)
	 */
	async getRandomLetter(): Promise<Letter | null> {
		if (isSupabaseEnabled) {
			try {
				const res = await fetch(
					`${supabaseUrl}/rest/v1/anonymous_letters?recipient_id=is.null&sender_id=neq.${userId}&limit=50`,
					{ headers: getSupabaseHeaders() }
				);
				if (!res.ok) throw new Error("Supabase fetch random letter failed");
				const data = await res.json();
				if (data && data.length > 0) {
					// Select one at random
					const idx = Math.floor(Math.random() * data.length);
					const item = data[idx];
					return {
						id: item.id,
						content: item.content,
						senderId: item.sender_id,
						recipientId: item.recipient_id,
						replyToId: item.reply_to_id,
						timestamp: new Date(item.created_at).getTime(),
						senderAlias: item.sender_alias || "Người Lạ",
						senderAvatar: (item.sender_avatar || "human") as Avatar,
					};
				}
				return null;
			} catch (e) {
				console.warn("Supabase random letter failed, using local fallback", e);
			}
		}

		// Fallback/Gist/Local mode
		const letters = isGistEnabled ? (await fetchGistData()).letters : getLocalLetters();
		// Filter letters: public (recipientId === null) and not sent by current user
		const pool = letters.filter((l) => !l.recipientId && l.senderId !== userId);
		if (pool.length > 0) {
			const idx = Math.floor(Math.random() * pool.length);
			return pool[idx];
		}
		return null;
	},

	/**
	 * Retrieve letters sent to this user (replies or direct letters)
	 */
	async getMyLetters(): Promise<Letter[]> {
		if (isSupabaseEnabled) {
			try {
				const res = await fetch(
					`${supabaseUrl}/rest/v1/anonymous_letters?recipient_id=eq.${userId}&order=created_at.desc`,
					{ headers: getSupabaseHeaders() }
				);
				if (!res.ok) throw new Error("Supabase fetch my letters failed");
				const data = await res.json();
				return data.map((item: any) => ({
					id: item.id,
					content: item.content,
					senderId: item.sender_id,
					recipientId: item.recipient_id,
					replyToId: item.reply_to_id,
					timestamp: new Date(item.created_at).getTime(),
					senderAlias: item.sender_alias || "Người Lạ",
					senderAvatar: (item.sender_avatar || "human") as Avatar,
				}));
			} catch (e) {
				console.warn("Supabase get my letters failed, using local fallback", e);
			}
		}

		// Fallback/Gist/Local mode
		const letters = isGistEnabled ? (await fetchGistData()).letters : getLocalLetters();
		// Filter letters: sent to this user
		return letters
			.filter((l) => l.recipientId === userId)
			.sort((a, b) => b.timestamp - a.timestamp);
	},
};
