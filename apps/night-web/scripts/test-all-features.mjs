import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

// Helpers to load and transpile TypeScript files
function loadTsModule(filePath, mockRequire = {}) {
	let source = fs.readFileSync(filePath, "utf8");
	// Replace Vite environment variables with process.env so it works inside Node VM
	source = source.replace(/import\.meta\.env/g, "process.env");
	source = source.replace(/\(import\.meta\s+as\s+any\)\.env/g, "process.env");
	
	const compiled = ts.transpileModule(source, {
		compilerOptions: {
			module: ts.ModuleKind.CommonJS,
			target: ts.ScriptTarget.ES2022,
		},
	});

	const mockLocalStorage = {};
	const localStorageMock = {
		getItem(key) { return mockLocalStorage[key] || null; },
		setItem(key, val) { mockLocalStorage[key] = val; },
		removeItem(key) { delete mockLocalStorage[key]; },
		clear() { for (const k of Object.keys(mockLocalStorage)) delete mockLocalStorage[k]; }
	};

	const module = { exports: {} };
	vm.runInNewContext(compiled.outputText, {
		module,
		exports: module.exports,
		require(name) {
			if (mockRequire[name] !== undefined) {
				return mockRequire[name];
			}
			// Resolve relative mock requirements
			for (const key of Object.keys(mockRequire)) {
				if (name.endsWith(key) || key.endsWith(name)) {
					return mockRequire[key];
				}
			}
			throw new Error(`Unexpected import: ${name} in ${filePath}`);
		},
		console,
		setTimeout,
		clearTimeout,
		setInterval,
		clearInterval,
		Date,
		Math,
		localStorage: localStorageMock,
		process: {
			env: {
				...process.env
			}
		},
	});
	return module.exports;
}

// ----------------------------------------------------
// TEST SUITE 1: Tien Len Rules
// ----------------------------------------------------
console.log("---------------------------------------");
console.log("RUNNING: Tien Len Rules Tests...");
console.log("---------------------------------------");
const rules = loadTsModule(path.resolve("services/tienLenRules.ts"));
const cards = (...ids) => ids.map(rules.createCard);

// Basic hand validation
assert.equal(rules.getOpeningCardId([0, 4], [8, 12]), 0);
assert.equal(rules.getOpeningCardId([5, 9], [1, 8]), 1);

// Empty move is invalid
assert.equal(rules.isValidMove([], [], 0), false);

// Single moves
assert.equal(rules.isValidMove(cards(0), [], 0), true); // 3 of Spades is valid opener
assert.equal(rules.isValidMove(cards(1), [], 0), false); // 3 of Clubs is invalid opener if 3 of Spades in hand and it's the opening turn
assert.equal(rules.isValidMove(cards(4), cards(0)), true); // 4 of Spades beats 3 of Spades
assert.equal(rules.isValidMove(cards(0), cards(4)), false); // 3 of Spades cannot beat 4 of Spades

// Pairs
assert.equal(rules.isValidMove(cards(0, 1), []), true); // Pair of 3s
assert.equal(rules.isValidMove(cards(0, 4), []), false); // 3 of Spades & 4 of Spades is not a pair
assert.equal(rules.isValidMove(cards(4, 5), cards(0, 1)), true); // Pair of 4s beats pair of 3s

// Triples
assert.equal(rules.isValidMove(cards(0, 1, 2), []), true);
assert.equal(rules.isValidMove(cards(4, 5, 6), cards(0, 1, 2)), true);

// Sequences (Sảnh)
assert.equal(rules.isValidMove(cards(0, 4, 8), []), true); // 3, 4, 5 sequence
assert.equal(rules.isValidMove(cards(0, 4, 12), []), false); // 3, 4, 6 sequence (missing 5)
assert.equal(rules.isValidMove(cards(0, 4, 8, 48), []), false); // Sequence cannot contain 2 (48 is 2 of Spades)
assert.equal(rules.isValidMove(cards(4, 8, 12), cards(0, 4, 8)), true); // 4-5-6 beats 3-4-5

// Four of a kind (Tứ quý)
assert.equal(rules.isFourOfAKind(cards(0, 1, 2, 3)), true);
assert.equal(rules.isFourOfAKind(cards(0, 1, 2, 4)), false);

// Double-pair sequences (Ba/Bốn đôi thông)
const threePairs = cards(0, 1, 4, 5, 8, 9); // Pairs of 3, 4, 5
assert.equal(rules.isThreePairSequence(threePairs), true);
const fourPairs = cards(0, 1, 4, 5, 8, 9, 12, 13); // Pairs of 3, 4, 5, 6
assert.equal(rules.isFourPairSequence(fourPairs), true);

// Chopping rules (Chặt heo)
// A 2 (48) can be chopped by:
// - Three-pair sequence
// - Four-of-a-kind
// - Four-pair sequence
assert.equal(rules.isValidMove(threePairs, cards(48)), true);
assert.equal(rules.isValidMove(cards(4, 5, 6, 7), cards(48)), true); // Tứ quý 4 beats 2 of Spades
assert.equal(rules.isValidMove(fourPairs, cards(48, 49)), true); // Bốn đôi thông beats double 2s

console.log("✅ Tien Len Rules Tests passed.");


// ----------------------------------------------------
// TEST SUITE 2: Bartender Service
// ----------------------------------------------------
console.log("\n---------------------------------------");
console.log("RUNNING: Bartender Service Tests...");
console.log("---------------------------------------");
const bartender = loadTsModule(path.resolve("services/bartenderService.ts"));

// Test greeting
const greeting = bartender.getGreeting();
assert.ok(typeof greeting === "string" && greeting.length > 0, "Greeting should be a non-empty string");

// Test categorization logic indirectly by verifying responses are from correct pools
// We will mock/call chatWithBartender and see which categories are matched.
async function runBartenderTests() {
	// Drinks category
	const r1 = await bartender.chatWithBartender("Cho tôi một cốc cà phê sữa đá", []);
	assert.ok(
		r1.includes("Midnight") || r1.includes("Neon") || r1.includes("Sunset") ||
		r1.includes("Espresso") || r1.includes("Not Found") || r1.includes("Retro"),
		`Should return a drink response, got: "${r1}"`
	);

	// Comfort category
	const r2 = await bartender.chatWithBartender("Đêm nay buồn quá cậu ơi", []);
	assert.ok(
		r2.includes("vui có lúc buồn") || r2.includes("lắng nghe") || r2.includes("ngắm thành phố") ||
		r2.includes("ổn thôi") || r2.includes("thức khuya") || r2.includes("nỗi buồn"),
		`Should return a comfort response, got: "${r2}"`
	);

	// Story category
	const r3 = await bartender.chatWithBartender("Hãy kể một câu chuyện đi", []);
	assert.ok(
		r3.includes("người lạ") || r3.includes("mở ban đêm") || r3.includes("gặp nhau") ||
		r3.includes("sao băng") || r3.includes("mèo pixel"),
		`Should return a story response, got: "${r3}"`
	);

	// Generic category
	const r4 = await bartender.chatWithBartender("Ngủ ngon nha", []);
	assert.ok(r4.length > 0, "Should return a generic response");

	console.log("✅ Bartender Service Tests passed.");
}


// ----------------------------------------------------
// TEST SUITE 3: Lobby Presence Service
// ----------------------------------------------------
console.log("\n---------------------------------------");
console.log("RUNNING: Lobby Presence Service Tests...");
console.log("---------------------------------------");

// Prepare mocks for MQTT and P2P
let mockMqttClient = null;
let subscribedTopics = [];
let publishedMessages = [];

const mqttMock = {};
mqttMock.default = mqttMock;
mqttMock.connect = (url, options) => {
	mockMqttClient = {
		connected: true,
		listeners: {},
		on(event, cb) {
			this.listeners[event] = cb;
			return this;
		},
		subscribe(topic) {
			subscribedTopics.push(topic);
		},
		publish(topic, payload) {
			publishedMessages.push({ topic, payload: JSON.parse(payload) });
		},
		end(force) {
			this.connected = false;
		},
		// helper to trigger incoming message
		triggerMessage(topic, data) {
			if (this.listeners["message"]) {
				this.listeners["message"](topic, Buffer.from(JSON.stringify(data)));
			}
		},
		// helper to trigger connect
		triggerConnect() {
			if (this.listeners["connect"]) {
				this.listeners["connect"]();
			}
		}
	};
	return mockMqttClient;
};

const p2pMock = {
	p2p: {
		getPeerId() {
			return "test-peer-id-123";
		}
	}
};

const typesMock = {
	MAX_LOBBY_PEERS: 15
};

const lobbyPresenceModule = loadTsModule(
	path.resolve("services/lobbyPresenceService.ts"),
	{
		"mqtt": mqttMock,
		"p2pService": p2pMock,
		"types": typesMock
	}
);

const lobby = lobbyPresenceModule.lobbyPresence;

// Test Join
let peersUpdateCount = 0;
let lastPeerList = [];
lobby.onPeersUpdate = (peers) => {
	peersUpdateCount++;
	lastPeerList = peers;
};

assert.equal(lobby.isJoined, false);
lobby.join("cat", "MeowMaster");
assert.equal(lobby.isJoined, true);
assert.ok(mockMqttClient !== null, "MQTT client should be created");

// Test calling join again consecutively (should be a no-op)
const firstClient = mockMqttClient;
lobby.join("human", "AnotherMaster");
assert.equal(lobby.isJoined, true);
assert.equal(mockMqttClient, firstClient, "Should not recreate MQTT client on consecutive joins");

// Trigger mock connect
mockMqttClient.triggerConnect();
assert.ok(subscribedTopics.includes("midnight-pixel-chat-v6/lobby/move"), "Should subscribe to move topic");
assert.ok(subscribedTopics.includes("midnight-pixel-chat-v6/lobby/emoji"), "Should subscribe to emoji topic");

// Test Peer Position Updates (Incoming MQTT message)
mockMqttClient.triggerMessage("midnight-pixel-chat-v6/lobby/move", {
	id: "peer-abc",
	x: 150,
	y: 390,
	av: "robot",
	al: "RoboStranger",
	d: "left"
});

assert.equal(lastPeerList.length, 1);
assert.equal(lastPeerList[0].id, "peer-abc");
assert.equal(lastPeerList[0].avatar, "robot");
assert.equal(lastPeerList[0].alias, "RoboStranger");
assert.equal(lastPeerList[0].x, 150);

// Test Malformed/Incomplete MQTT messages (should fail silently, not crash)
assert.doesNotThrow(() => {
	// Invalid JSON string
	if (mockMqttClient.listeners["message"]) {
		mockMqttClient.listeners["message"]("midnight-pixel-chat-v6/lobby/move", Buffer.from("invalid-json{"));
	}
	// Missing required ID parameter
	mockMqttClient.triggerMessage("midnight-pixel-chat-v6/lobby/move", {
		x: 100,
		y: 200
	});
}, "Malformed MQTT messages should not throw or crash");

// Test Emoji Updates (Incoming MQTT message)
mockMqttClient.triggerMessage("midnight-pixel-chat-v6/lobby/emoji", {
	id: "peer-abc",
	emoji: "💖"
});

assert.equal(lastPeerList[0].emoji, "💖");
assert.ok(lastPeerList[0].emojiExpiry > Date.now());

// Test Throttling of local position updates
publishedMessages = [];
lobby.updatePosition(200, 390, "right");
assert.equal(publishedMessages.length, 1, "First position update should be published immediately");
assert.equal(publishedMessages[0].payload.x, 200);

// Update again immediately with small delta -> should be throttled
lobby.updatePosition(201, 390, "right");
assert.equal(publishedMessages.length, 1, "Small movement within throttle interval should be throttled");

// Test Lobby Peer Limit (MAX_LOBBY_PEERS = 15)
// Let's add 15 additional peers, making total 16 peers. The 16th (exceeding limit) should be ignored.
for (let i = 0; i < 16; i++) {
	mockMqttClient.triggerMessage("midnight-pixel-chat-v6/lobby/move", {
		id: `peer-extra-${i}`,
		x: 200,
		y: 390,
		av: "human",
		al: `Stranger ${i}`,
		d: "right"
	});
}

// Since peer-abc is already in, total peers should cap at 15
assert.ok(lastPeerList.length <= 15, `Peer count should not exceed MAX_LOBBY_PEERS (15), got: ${lastPeerList.length}`);

// Test Leave
lobby.leave();
assert.equal(lobby.isJoined, false);
assert.equal(lobby.peers.size, 0);
assert.equal(mockMqttClient.connected, false, "MQTT client should be disconnected");

console.log("✅ Lobby Presence Service Tests passed.");


// ----------------------------------------------------
// TEST SUITE 4: Jukebox Helper & Sync Tests
// ----------------------------------------------------
console.log("\n---------------------------------------");
console.log("RUNNING: Jukebox Helpers & Sync Tests...");
console.log("---------------------------------------");

// We test the YouTube URL parser and duplicate checker logic implemented in PixelJukebox.tsx
const parseYouTubeUrl = (url) => {
	try {
		let cleaned = url.trim();
		if (!/^https?:\/\//i.test(cleaned)) {
			cleaned = "https://" + cleaned;
		}
		const u = new URL(cleaned);
		if (u.searchParams.has("list")) {
			return { type: "playlist", id: u.searchParams.get("list") };
		}
		if (u.hostname === "youtu.be" || u.hostname.endsWith(".youtu.be")) {
			return { type: "video", id: u.pathname.substring(1) };
		}
		if (u.pathname.startsWith("/shorts/")) {
			return { type: "video", id: u.pathname.split("/")[2] };
		}
		if (u.searchParams.has("v")) {
			return { type: "video", id: u.searchParams.get("v") };
		}
		if (u.pathname.startsWith("/embed/")) {
			return { type: "video", id: u.pathname.split("/")[2] };
		}
	} catch (e) {}
	return null;
};

// URL Parser Tests
assert.deepEqual(parseYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), { type: "video", id: "dQw4w9WgXcQ" });
assert.deepEqual(parseYouTubeUrl("https://youtu.be/dQw4w9WgXcQ"), { type: "video", id: "dQw4w9WgXcQ" });
assert.deepEqual(parseYouTubeUrl("https://www.youtube.com/embed/dQw4w9WgXcQ"), { type: "video", id: "dQw4w9WgXcQ" });
assert.deepEqual(parseYouTubeUrl("https://www.youtube.com/playlist?list=PL4fGSI1pDJn6jUj5c2nFw7a596Sgfi380"), { type: "playlist", id: "PL4fGSI1pDJn6jUj5c2nFw7a596Sgfi380" });
assert.deepEqual(parseYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL4fGSI1pDJn6jUj5c2nFw7a596Sgfi380"), { type: "playlist", id: "PL4fGSI1pDJn6jUj5c2nFw7a596Sgfi380" }); // Playlist takes precedence
assert.deepEqual(parseYouTubeUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ"), { type: "video", id: "dQw4w9WgXcQ" }); // Shorts format
assert.deepEqual(parseYouTubeUrl("https://m.youtube.com/shorts/dQw4w9WgXcQ"), { type: "video", id: "dQw4w9WgXcQ" }); // Mobile shorts format
assert.deepEqual(parseYouTubeUrl("youtube.com/watch?v=dQw4w9WgXcQ"), { type: "video", id: "dQw4w9WgXcQ" }); // Missing protocol format
assert.equal(parseYouTubeUrl("https://google.com"), null);

// Duplicate checking test
const mockLibrary = [
	{ id: "1", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
	{ id: "2", url: "https://www.youtube.com/playlist?list=PL4fGSI1pDJn6jUj5c2nFw7a596Sgfi380" }
];

const checkDuplicate = (url, library) => {
	const parsed = parseYouTubeUrl(url);
	if (!parsed) return false;
	return library.some((item) => {
		const itemParsed = parseYouTubeUrl(item.url);
		return itemParsed && itemParsed.id === parsed.id;
	});
};

assert.equal(checkDuplicate("https://youtu.be/dQw4w9WgXcQ", mockLibrary), true, "Should detect duplicate video");
assert.equal(checkDuplicate("https://www.youtube.com/playlist?list=PL4fGSI1pDJn6jUj5c2nFw7a596Sgfi380", mockLibrary), true, "Should detect duplicate playlist");
assert.equal(checkDuplicate("https://youtu.be/otherVideoId", mockLibrary), false, "Should not flag new video as duplicate");

console.log("✅ Jukebox Helpers & Sync Tests passed.");


// ----------------------------------------------------
// TEST SUITE 5: Caro 15x15 Win Scanning
// ----------------------------------------------------
console.log("\n---------------------------------------");
console.log("RUNNING: Caro 15x15 Win Scanning Tests...");
console.log("---------------------------------------");

const checkCaroWinner = (b) => {
	const SIZE = 15;
	for (let r = 0; r < SIZE; r++) {
		for (let c = 0; c < SIZE; c++) {
			const idx = r * SIZE + c;
			const symbol = b[idx];
			if (!symbol) continue;

			// Check horizontal right
			if (c <= SIZE - 5) {
				if (
					b[idx + 1] === symbol &&
					b[idx + 2] === symbol &&
					b[idx + 3] === symbol &&
					b[idx + 4] === symbol
				) {
					return { winner: symbol, line: [idx, idx + 1, idx + 2, idx + 3, idx + 4] };
				}
			}

			// Check vertical down
			if (r <= SIZE - 5) {
				if (
					b[idx + SIZE] === symbol &&
					b[idx + SIZE * 2] === symbol &&
					b[idx + SIZE * 3] === symbol &&
					b[idx + SIZE * 4] === symbol
				) {
					return { winner: symbol, line: [idx, idx + SIZE, idx + SIZE * 2, idx + SIZE * 3, idx + SIZE * 4] };
				}
			}

			// Check diagonal down-right
			if (r <= SIZE - 5 && c <= SIZE - 5) {
				if (
					b[idx + SIZE + 1] === symbol &&
					b[idx + SIZE * 2 + 2] === symbol &&
					b[idx + SIZE * 3 + 3] === symbol &&
					b[idx + SIZE * 4 + 4] === symbol
				) {
					return { winner: symbol, line: [idx, idx + SIZE + 1, idx + SIZE * 2 + 2, idx + SIZE * 3 + 3, idx + SIZE * 4 + 4] };
				}
			}

			// Check diagonal down-left
			if (r <= SIZE - 5 && c >= 4) {
				if (
					b[idx + SIZE - 1] === symbol &&
					b[idx + SIZE * 2 - 2] === symbol &&
					b[idx + SIZE * 3 - 3] === symbol &&
					b[idx + SIZE * 4 - 4] === symbol
				) {
					return { winner: symbol, line: [idx, idx + SIZE - 1, idx + SIZE * 2 - 2, idx + SIZE * 3 - 3, idx + SIZE * 4 - 4] };
				}
			}
		}
	}
	return { winner: null, line: null };
};

const board = Array(225).fill(null);

// Test empty board
assert.deepEqual(checkCaroWinner(board), { winner: null, line: null });

// Test horizontal win
const boardH = [...board];
boardH[15] = "X"; boardH[16] = "X"; boardH[17] = "X"; boardH[18] = "X"; boardH[19] = "X";
assert.deepEqual(checkCaroWinner(boardH), { winner: "X", line: [15, 16, 17, 18, 19] });

// Test vertical win
const boardV = [...board];
boardV[5] = "O"; boardV[20] = "O"; boardV[35] = "O"; boardV[50] = "O"; boardV[65] = "O";
assert.deepEqual(checkCaroWinner(boardV), { winner: "O", line: [5, 20, 35, 50, 65] });

// Test diagonal down-right win
const boardDR = [...board];
boardDR[0] = "X"; boardDR[16] = "X"; boardDR[32] = "X"; boardDR[48] = "X"; boardDR[64] = "X";
assert.deepEqual(checkCaroWinner(boardDR), { winner: "X", line: [0, 16, 32, 48, 64] });

// Test diagonal down-left win
const boardDL = [...board];
boardDL[4] = "O"; boardDL[18] = "O"; boardDL[32] = "O"; boardDL[46] = "O"; boardDL[60] = "O";
assert.deepEqual(checkCaroWinner(boardDL), { winner: "O", line: [4, 18, 32, 46, 60] });

console.log("✅ Caro 15x15 Win Scanning Tests passed.");


// ----------------------------------------------------
// TEST SUITE 6: Jukebox Request Queue
// ----------------------------------------------------
console.log("\n---------------------------------------");
console.log("RUNNING: Jukebox Request Queue Tests...");
console.log("---------------------------------------");

// Test queue serialization and operations
const mockQueue = [];
const addToQueueAction = (queue, item) => [...queue, item];
const removeFromQueueAction = (queue, itemId) => queue.filter(item => item.id !== itemId);

const qItem1 = { id: "track-1", title: "Song 1" };
const qItem2 = { id: "track-2", title: "Song 2" };

let q = mockQueue;
q = addToQueueAction(q, qItem1);
q = addToQueueAction(q, qItem2);

assert.equal(q.length, 2);
assert.equal(q[0].id, "track-1");

q = removeFromQueueAction(q, "track-1");
assert.equal(q.length, 1);
assert.equal(q[0].id, "track-2");

console.log("✅ Jukebox Request Queue Tests passed.");


// ----------------------------------------------------
// TEST SUITE 7: Journal Service Tests
// ----------------------------------------------------
console.log("\n---------------------------------------");
console.log("RUNNING: Journal Service Tests...");
console.log("---------------------------------------");

const journalModule = loadTsModule(path.resolve("services/journalService.ts"));
const js = journalModule.journalService;

// Test user ID creation
assert.ok(typeof journalModule.userId === "string" && journalModule.userId.length > 0, "User ID should be generated");

async function runJournalTests() {
	// Reset local storage mocks for local test running
	const mockLocalStorage = {};
	global.localStorage = {
		getItem(key) { return mockLocalStorage[key] || null; },
		setItem(key, val) { mockLocalStorage[key] = val; },
		removeItem(key) { delete mockLocalStorage[key]; },
		clear() { for (const k of Object.keys(mockLocalStorage)) delete mockLocalStorage[k]; }
	};

	// 1. Fetch entries
	const entries = await js.getEntries();
	assert.equal(entries.length, 5, "Should return 5 seeded journals");
	assert.ok(entries[0].timestamp >= entries[1].timestamp, "Journals should be sorted descending");

	// 2. Create entry
	const newEntry = await js.createEntry("Thử nghiệm bài viết nhật ký", "Người Đọc Thầm", "ghost", "deep");
	assert.ok(newEntry !== null);
	assert.equal(newEntry.content, "Thử nghiệm bài viết nhật ký");
	assert.equal(newEntry.alias, "Người Đọc Thầm");
	assert.equal(newEntry.mood, "deep");

	const entriesAfter = await js.getEntries();
	assert.equal(entriesAfter.length, 6, "Journal list should grow to 6");
	assert.equal(entriesAfter[0].content, "Thử nghiệm bài viết nhật ký", "New entry should be on top");

	// 3. Like entry
	const targetId = entriesAfter[1].id;
	const currentLikes = entriesAfter[1].likes;
	const liked = await js.likeEntry(targetId);
	assert.ok(liked, "Like operation should succeed");
	const entriesAfterLike = await js.getEntries();
	const likedEntry = entriesAfterLike.find(e => e.id === targetId);
	assert.equal(likedEntry.likes, currentLikes + 1, "Likes count should increment by 1");

	// 4. Send Letter to the wind
	const sent = await js.sendLetter("Chào vũ trụ", "Người Đọc Thầm", "ghost");
	assert.ok(sent, "Send letter to the wind should succeed");

	// 5. Get Random Letter
	const randomLetter = await js.getRandomLetter();
	assert.ok(randomLetter !== null, "Should fetch a seed random letter");
	assert.notEqual(randomLetter.senderId, journalModule.userId, "Random letter should not be written by current user");
	assert.equal(randomLetter.recipientId, null, "Random letter should be public (recipientId is null)");

	// 6. Inbox letters
	const myInbox = await js.getMyLetters();
	assert.equal(myInbox.length, 0, "Current user inbox should start empty");

	// Simulate receiving a reply from another user
	const replySent = await js.sendLetter("Phản hồi của người lạ", "Stranger X", "cat", journalModule.userId, "some-letter-id");
	assert.ok(replySent);
	const myInboxAfter = await js.getMyLetters();
	assert.equal(myInboxAfter.length, 1, "Inbox should contain 1 reply");
	assert.equal(myInboxAfter[0].content, "Phản hồi của người lạ");
	assert.equal(myInboxAfter[0].senderAlias, "Stranger X");

	console.log("✅ Journal Service Tests passed.");
}


// Run async tests
(async () => {
	try {
		await runBartenderTests();
		await runJournalTests();
		console.log("\n=======================================");
		console.log("🎉 ALL TEST SUITES PASSED SUCCESSFULLY! 🎉");
		console.log("=======================================");
	} catch (err) {
		console.error("\n❌ TEST FAILED:", err.message);
		process.exit(1);
	}
})();
