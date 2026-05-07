import Peer, { DataConnection } from "peerjs";
import mqtt from "mqtt";
import { Gender, Mood, Avatar } from "../types";

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

	public onMessage: (msg: any) => void = () => {};
	public onConnected: (strangerAvatar: Avatar, alias: string) => void =
		() => {};
	public onDisconnected: () => void = () => {};
	public onOnlineCountUpdate: (count: number) => void = () => {};
	public onVibeSync: (vibe: string) => void = () => {};

	private myAvatar: Avatar = "human";
	private myAlias: string = "";

	constructor() {
		this.peerId = `${APP_PREFIX}-${Math.random().toString(36).substr(2, 9)}`;
		this.initPresence();
	}

	private ensurePeer() {
		if (this.peer && !this.peer.destroyed && !this.peer.disconnected)
			return this.peer;
		this.peer = new Peer(this.peerId, {
			debug: 1,
			config: { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] },
		});
		this.peer.on("connection", (conn) => {
			if (this.connection) {
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
		const topic = `${APP_PREFIX}/presence/all`;
		presenceMqtt.on("connect", () => {
			presenceMqtt.subscribe(topic);
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
			const id = msg.toString();
			const isNew = !this.onlinePeersMap.has(id);
			this.onlinePeersMap.set(id, Date.now());
			if (isNew) this.updateCount();
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

	private updateCount() {
		const currentCount = Math.max(1, this.onlinePeersMap.size);
		if (currentCount !== this.lastReportedCount) {
			this.lastReportedCount = currentCount;
			this.onOnlineCountUpdate(currentCount);
		}
	}

	private setupConnection(conn: DataConnection) {
		this.connection = conn;
		conn.on("open", () => {
			this.stopMatching();
			conn.send({
				type: "handshake",
				avatar: this.myAvatar,
				alias: this.myAlias,
			});
		});
		conn.on("data", (data: any) => {
			if (!data) return;
			if (data.type === "handshake")
				this.onConnected(data.avatar, data.alias);
			if (data.type === "vibe_sync") this.onVibeSync(data.vibe);
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
				client.publish(
					signalTopic,
					JSON.stringify({
						id: this.peerId,
						g: myGender,
						pg: prefGender,
						m: myMood,
						pm: prefMood,
						av: myAvatar,
						al: myAlias,
					}),
				);
			}, 2500);
		});
		client.on("close", clearPublishInterval);
		client.on("error", (error: Error) => {
			console.warn("MQTT matching connection error:", error.message);
		});
		client.on("message", (t, message) => {
			if (this.mqttClient !== client || this.connection) return;
			try {
				const other = JSON.parse(message.toString());
				if (other.id === this.peerId) return;
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
	public sendMessage(text: string, id: string) {
		this.connection?.send({ type: "chat", content: text, id });
	}
	public sendVibeSync(vibe: "lofi" | "off") {
		this.connection?.send({ type: "vibe_sync", vibe });
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
	public disconnect() {
		if (this.connection) {
			this.connection.close();
			this.connection = null;
		}
		this.stopMatching();
	}
}

export const p2p = new P2PManager();
