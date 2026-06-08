import mqtt from "mqtt";
import { Avatar, LobbyPeer, MAX_LOBBY_PEERS } from "../types";
import { p2p } from "./p2pService";

const APP_PREFIX = "midnight-pixel-chat-v6";
const LOBBY_MOVE_TOPIC = `${APP_PREFIX}/lobby/move`;
const LOBBY_EMOJI_TOPIC = `${APP_PREFIX}/lobby/emoji`;
const MQTT_BROKER = "wss://broker.emqx.io:8084/mqtt";

const STALE_TIMEOUT = 12000; // Remove peers after 12 seconds of silence
const PUBLISH_THROTTLE = 200; // ms between position publishes
const MIN_MOVE_DELTA = 2; // Minimum pixel change to trigger publish

class LobbyPresenceService {
	private mqttClient: ReturnType<typeof mqtt.connect> | null = null;
	private peerId: string = "";
	private myAvatar: Avatar = "human";
	private myAlias: string = "";
	private lastPublishTime = 0;
	private lastPublishedX = -1;
	private lastPublishedY = -1;
	private staleCleanupInterval: ReturnType<typeof setInterval> | null = null;
	private _joined = false;

	public peers = new Map<string, LobbyPeer>();
	public onPeersUpdate: (peers: LobbyPeer[]) => void = () => {};

	join(avatar: Avatar, alias: string): void {
		if (this._joined) return;
		this._joined = true;
		this.peerId = p2p.getPeerId();
		this.myAvatar = avatar;
		this.myAlias = alias;
		this.peers.clear();

		// Create a dedicated MQTT client for lobby presence
		this.mqttClient = mqtt.connect(MQTT_BROKER, {
			connectTimeout: 8000,
			reconnectPeriod: 3000,
			keepalive: 30,
			clean: true,
			protocolVersion: 4,
			clientId: `${this.peerId}-lobby`,
		});

		this.mqttClient.on("connect", () => {
			this.mqttClient?.subscribe(LOBBY_MOVE_TOPIC);
			this.mqttClient?.subscribe(LOBBY_EMOJI_TOPIC);
		});

		this.mqttClient.on("message", (topic, msg) => {
			try {
				const data = JSON.parse(msg.toString());
				if (!data.id || data.id === this.peerId) return;

				if (topic === LOBBY_MOVE_TOPIC) {
					this.handleMoveMessage(data);
				} else if (topic === LOBBY_EMOJI_TOPIC) {
					this.handleEmojiMessage(data);
				}
			} catch (e) {
				// Ignore malformed messages
			}
		});

		this.mqttClient.on("error", (err) => {
			console.warn("Lobby MQTT error:", err.message);
		});

		// Periodically clean up stale peers
		this.staleCleanupInterval = setInterval(() => {
			const now = Date.now();
			let changed = false;
			for (const [id, peer] of this.peers.entries()) {
				if (now - peer.lastSeen > STALE_TIMEOUT) {
					this.peers.delete(id);
					changed = true;
				}
			}
			if (changed) this.notifyUpdate();
		}, 3000);
	}

	leave(): void {
		if (!this._joined) return;
		this._joined = false;
		if (this.staleCleanupInterval) {
			clearInterval(this.staleCleanupInterval);
			this.staleCleanupInterval = null;
		}
		if (this.mqttClient) {
			this.mqttClient.end(true);
			this.mqttClient = null;
		}
		this.peers.clear();
		this.lastPublishedX = -1;
		this.lastPublishedY = -1;
	}

	updatePosition(x: number, y: number, direction: "left" | "right"): void {
		if (!this._joined || !this.mqttClient?.connected) return;

		const now = Date.now();
		const dx = Math.abs(x - this.lastPublishedX);
		const dy = Math.abs(y - this.lastPublishedY);

		// Throttle: only publish if moved enough and enough time has passed
		if (
			now - this.lastPublishTime < PUBLISH_THROTTLE &&
			dx < MIN_MOVE_DELTA &&
			dy < MIN_MOVE_DELTA
		) {
			return;
		}

		this.lastPublishTime = now;
		this.lastPublishedX = x;
		this.lastPublishedY = y;

		const payload = JSON.stringify({
			id: this.peerId,
			x: Math.round(x),
			y: Math.round(y),
			av: this.myAvatar,
			al: this.myAlias,
			d: direction,
		});

		this.mqttClient.publish(LOBBY_MOVE_TOPIC, payload);
	}

	sendEmoji(emoji: string): void {
		if (!this._joined || !this.mqttClient?.connected) return;

		const payload = JSON.stringify({
			id: this.peerId,
			emoji,
		});

		this.mqttClient.publish(LOBBY_EMOJI_TOPIC, payload);
	}

	private handleMoveMessage(data: any): void {
		if (this.peers.size >= MAX_LOBBY_PEERS && !this.peers.has(data.id)) {
			return; // Don't exceed peer limit
		}

		const existing = this.peers.get(data.id);
		this.peers.set(data.id, {
			id: data.id,
			x: data.x ?? 200,
			y: data.y ?? 390,
			avatar: data.av ?? "human",
			alias: data.al ?? "Người Lạ",
			direction: data.d ?? "right",
			emoji: existing?.emoji,
			emojiExpiry: existing?.emojiExpiry,
			lastSeen: Date.now(),
		});

		this.notifyUpdate();
	}

	private handleEmojiMessage(data: any): void {
		const peer = this.peers.get(data.id);
		if (peer && data.emoji) {
			peer.emoji = data.emoji;
			peer.emojiExpiry = Date.now() + 3000; // 3 second display
			this.notifyUpdate();
		}
	}

	private notifyUpdate(): void {
		this.onPeersUpdate(Array.from(this.peers.values()));
	}

	get isJoined(): boolean {
		return this._joined;
	}
}

export const lobbyPresence = new LobbyPresenceService();
