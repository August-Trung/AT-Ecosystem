import Peer, { DataConnection } from "peerjs";
import mqtt from "mqtt";
import { Gender, Mood, Avatar, Memory } from "../types";

const XOR_KEY = 42;
const encryptPayload = (obj: any): string => {
	const str = JSON.stringify(obj);
	let res = "";
	for (let i = 0; i < str.length; i++) {
		res += String.fromCharCode(str.charCodeAt(i) ^ XOR_KEY);
	}
	return btoa(unescape(encodeURIComponent(res)));
};

const decryptPayload = (base64Str: string): any => {
	try {
		const str = decodeURIComponent(escape(atob(base64Str)));
		let res = "";
		for (let i = 0; i < str.length; i++) {
			res += String.fromCharCode(str.charCodeAt(i) ^ XOR_KEY);
		}
		return JSON.parse(res);
	} catch (e) {
		return null;
	}
};

const MQTT_BROKER = "wss://broker.emqx.io:8084/mqtt";
const MQTT_OPTIONS = {
	connectTimeout: 8000,
	reconnectPeriod: 3000,
	keepalive: 30,
	clean: true,
	protocolVersion: 4 as const,
};
const APP_PREFIX = "midnight-pixel-chat-v6";

export class P2PManager {
	private peer: Peer | null = null;
	private mqttClient: any = null;
	private connection: DataConnection | null = null;
	private peerId: string = "";
	private onlinePeersMap = new Map<string, number>();
	private lastReportedCount: number = 0;
	private presencePublishInterval: ReturnType<typeof setInterval> | null =
		null;
	private presenceMqttClient: any = null;
	public memories: Memory[] = [];

	public onMessage: (msg: any) => void = () => {};
	public onConnected: (strangerAvatar: Avatar, alias: string) => void =
		() => {};
	public onDisconnected: () => void = () => {};
	public onOnlineCountUpdate: (count: number) => void = () => {};
	public onJukeboxSync: (sync: any) => void = () => {};
	public onMemoriesUpdate: (memories: Memory[]) => void = () => {};

	private myAvatar: Avatar = "human";
	private myAlias: string = "";

	constructor() {
		this.peerId = `${APP_PREFIX}-${Math.random().toString(36).substr(2, 9)}`;
		this.initPresence();
	}

	public getPeerIdAndListen(myAvatar: Avatar, myAlias: string): string {
		this.myAvatar = myAvatar;
		this.myAlias = myAlias;
		this.ensurePeer();
		return this.peerId;
	}

	public startDirectConnect(
		targetPeerId: string,
		myAvatar: Avatar,
		myAlias: string,
	) {
		this.myAvatar = myAvatar;
		this.myAlias = myAlias;
		const peer = this.ensurePeer();
		this.stopMatching();
		
		console.log("Guest starting direct connection to target host peer:", targetPeerId);
		if (peer.open) {
			console.log("Peer is already open. Connecting now...");
			this.setupConnection(peer.connect(targetPeerId));
		} else {
			console.log("Peer not open yet. Waiting for open event...");
			peer.once("open", () => {
				console.log("Peer opened. Connecting to target host peer...");
				this.setupConnection(peer.connect(targetPeerId));
			});
		}
	}

	private ensurePeer() {
		if (this.peer && !this.peer.destroyed && !this.peer.disconnected)
			return this.peer;
		
		console.log("Initializing PeerJS with ID:", this.peerId);
		this.peer = new Peer(this.peerId, {
			debug: 1,
			config: {
				iceServers: [
					{ urls: "stun:stun.l.google.com:19302" },
					{ urls: "stun:stun1.l.google.com:19302" },
					{ urls: "stun:stun2.l.google.com:19302" },
					...(() => {
						try {
							const customTurn = localStorage.getItem("custom_turn_config");
							if (customTurn) {
								return JSON.parse(customTurn);
							}
						} catch (e) {}
						return [];
					})()
				]
			},
		});
		
		this.peer.on("open", (id) => {
			console.log("PeerJS signaling successfully opened with ID:", id);
		});

		this.peer.on("error", (err) => {
			console.error("PeerJS main error:", err.type, err.message);
			if (err.type === "peer-unavailable") {
				this.disconnect();
				this.onDisconnected();
			}
		});

		this.peer.on("connection", (conn) => {
			console.log("Incoming P2P connection from:", conn.peer);
			if (this.connection) {
				console.log("Already connected, closing incoming request from:", conn.peer);
				conn.close();
				return;
			}
			this.setupConnection(conn);
		});
		return this.peer;
	}

	private createMqttClient(clientIdSuffix: string) {
		return mqtt.connect(MQTT_BROKER, {
			...MQTT_OPTIONS,
			clientId: `${this.peerId}-${clientIdSuffix}`,
		});
	}

	private initPresence() {
		const presenceMqtt = this.createMqttClient("presence");
		this.presenceMqttClient = presenceMqtt;
		const topic = `${APP_PREFIX}/presence/all`;
		const memoriesTopic = `${APP_PREFIX}/memories/retained`;
		presenceMqtt.on("connect", () => {
			presenceMqtt.subscribe(topic);
			presenceMqtt.subscribe(memoriesTopic);
			if (this.presencePublishInterval) {
				clearInterval(this.presencePublishInterval);
			}
			presenceMqtt.publish(topic, this.peerId);
			this.presencePublishInterval = setInterval(() => {
				if (presenceMqtt.connected)
					presenceMqtt.publish(topic, this.peerId);
			}, 3000);
		});
		presenceMqtt.on("error", (error: Error) => {
			console.warn("MQTT presence connection error:", error.message);
		});
		presenceMqtt.on("message", (t, msg) => {
			if (t === topic) {
				const id = msg.toString();
				const isNew = !this.onlinePeersMap.has(id);
				this.onlinePeersMap.set(id, Date.now());
				if (isNew) this.updateCount();
			} else if (t === memoriesTopic) {
				try {
					const data = JSON.parse(msg.toString());
					if (Array.isArray(data)) {
						this.memories = data;
						this.onMemoriesUpdate(data);
					}
				} catch (e) {}
			}
		});
		setInterval(() => {
			const now = Date.now();
			let changed = false;
			for (const [id, lastSeen] of this.onlinePeersMap.entries()) {
				if (now - lastSeen > 15000) {
					this.onlinePeersMap.delete(id);
					changed = true;
				}
			}
			if (changed) this.updateCount();
		}, 5000);
	}

	public submitMemory(text: string, alias: string) {
		const newMemory: Memory = {
			id: `${Math.random().toString(36).substr(2, 9)}`,
			text: text.substring(0, 50),
			alias: alias || "Người Lạ",
			timestamp: Date.now(),
		};
		const updated = [newMemory, ...this.memories].slice(0, 20);
		if (this.presenceMqttClient && this.presenceMqttClient.connected) {
			this.presenceMqttClient.publish(
				`${APP_PREFIX}/memories/retained`,
				JSON.stringify(updated),
				{ retain: true, qos: 1 }
			);
		}
	}

	private updateCount() {
		const currentCount = Math.max(1, this.onlinePeersMap.size);
		if (currentCount !== this.lastReportedCount) {
			this.lastReportedCount = currentCount;
			this.onOnlineCountUpdate(currentCount);
		}
	}

	private setupConnection(conn: DataConnection) {
		this.connection = conn;
		console.log("Setup connection bound. Waiting for open on conn:", conn.peer);
		conn.on("open", () => {
			console.log("P2P DataConnection opened. Sending handshake...");
			this.stopMatching();
			conn.send({
				type: "handshake",
				avatar: this.myAvatar,
				alias: this.myAlias,
			});
		});
		conn.on("data", (data: any) => {
			if (!data) return;
			console.log("P2P received package type:", data.type);
			if (data.type === "handshake")
				this.onConnected(data.avatar, data.alias);
			if (data.type === "jukebox_sync") {
				try {
					const syncPayload = JSON.parse(data.content);
					this.onJukeboxSync(syncPayload);
				} catch (e) {}
			}
			this.onMessage(data);
		});
		const cleanup = () => {
			if (this.connection === conn) {
				this.connection = null;
				this.onDisconnected();
			}
		};
		conn.on("close", cleanup);
		conn.on("error", cleanup);
	}

	public startMatching(
		myGender: Gender,
		prefGender: Gender,
		myMood: Mood,
		prefMood: Mood,
		myAvatar: Avatar,
		myAlias: string,
	) {
		this.myAvatar = myAvatar;
		this.myAlias = myAlias;
		this.ensurePeer();
		this.stopMatching();
		const client = this.createMqttClient("matching");
		this.mqttClient = client;
		const signalTopic = `${APP_PREFIX}/signals/broadcast`;
		let publishInterval: ReturnType<typeof setInterval> | null = null;
		const clearPublishInterval = () => {
			if (publishInterval) {
				clearInterval(publishInterval);
				publishInterval = null;
			}
		};
		client.on("connect", () => {
			client.subscribe(signalTopic);
			clearPublishInterval();
			publishInterval = setInterval(() => {
				if (this.connection || this.mqttClient !== client) {
					clearPublishInterval();
					return;
				}
				const payload = encryptPayload({
					id: this.peerId,
					g: myGender,
					pg: prefGender,
					m: myMood,
					pm: prefMood,
					av: myAvatar,
					al: myAlias,
				});
				client.publish(signalTopic, payload);
			}, 2500);
		});
		client.on("close", clearPublishInterval);
		client.on("error", (error: Error) => {
			console.warn("MQTT matching connection error:", error.message);
		});
		client.on("message", (t, message) => {
			if (this.mqttClient !== client || this.connection) return;
			try {
				const other = decryptPayload(message.toString());
				if (!other || other.id === this.peerId) return;
				const genderMatch =
					prefGender === "other" || prefGender === other.g;
				const theyMatchMe =
					other.pg === "other" || other.pg === myGender;
				if (genderMatch && theyMatchMe && myMood === other.m) {
					if (this.peerId > other.id)
						this.setupConnection(
							this.ensurePeer().connect(other.id),
						);
				}
			} catch (e) {}
		});
	}

	public stopMatching() {
		if (this.mqttClient) {
			this.mqttClient.end(true);
			this.mqttClient = null;
		}
	}
	public isConnected(): boolean {
		return !!this.connection;
	}
	public sendPing() {
		this.connection?.send({ type: "ping" });
	}
	public sendMessage(text: string, id: string) {
		this.connection?.send({ type: "chat", content: text, id });
	}
	public sendJukeboxSync(payloadStr: string) {
		this.connection?.send({ type: "jukebox_sync", content: payloadStr });
	}
	public sendDiceRoll(value: number) {
		this.connection?.send({ type: "dice_roll", diceValue: value });
	}
	public sendImage(base64: string, id: string) {
		this.connection?.send({ type: "image", content: base64, id });
	}
	public sendReaction(
		messageId: string,
		emoji: string,
		action: "add" | "remove" = "add",
	) {
		this.connection?.send({ type: "reaction", messageId, emoji, action });
	}
	public sendTyping(isTyping: boolean) {
		this.connection?.send({ type: "typing", isTyping });
	}
	public sendSketch(sketch: string) {
		this.connection?.send({ type: "sketch_data", sketch });
	}
	public sendSketchClose() {
		this.connection?.send({ type: "sketch_close" });
	}
	public sendGameInvite() {
		this.connection?.send({ type: "game_invite" });
	}
	public sendGameDecline() {
		this.connection?.send({ type: "game_decline" });
	}
	public sendGameStart(
		dealerCards: number[],
		cards: number[],
		firstTurn: boolean,
		openingCardId: number,
	) {
		this.connection?.send({
			type: "game_start",
			dealerCards,
			cards,
			firstTurn,
			openingCardId,
		});
	}
	public sendGameMove(cardIds: number[], remainingCount: number) {
		this.connection?.send({
			type: "game_move",
			cards: cardIds,
			count: remainingCount,
		});
	}
	public sendGamePass() {
		this.connection?.send({ type: "game_pass" });
	}
	public sendGameQuit() {
		this.connection?.send({ type: "game_quit" });
	}
	public sendGameEmoji(emoji: string) {
		this.connection?.send({ type: "game_emoji", emoji });
	}
	public sendTttInvite() {
		this.connection?.send({ type: "game_ttt_invite" });
	}
	public sendTttDecline() {
		this.connection?.send({ type: "game_ttt_decline" });
	}
	public sendTttStart(firstTurn: boolean) {
		this.connection?.send({ type: "game_ttt_start", firstTurn });
	}
	public sendTttMove(cellIndex: number, symbol: "X" | "O") {
		this.connection?.send({ type: "game_ttt_move", cellIndex, symbol });
	}
	public sendTttQuit() {
		this.connection?.send({ type: "game_ttt_quit" });
	}
	public sendTttEmoji(emoji: string) {
		this.connection?.send({ type: "game_ttt_emoji", emoji });
	}
	public getPresenceMqttClient() {
		return this.presenceMqttClient;
	}

	public getPeerId(): string {
		return this.peerId;
	}

	public disconnect() {
		if (this.connection) {
			this.connection.close();
			this.connection = null;
		}
		this.stopMatching();
	}
}

export const p2p = new P2PManager();
