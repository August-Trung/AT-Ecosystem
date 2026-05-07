import { useEffect, useMemo, useState } from "react";

import type { Language } from "@/contexts/LanguageContext";

type RoomRole = "host" | "guest";
type PeerMap = Record<string, { role: RoomRole; seenAt: number }>;

type RoomMessage = {
  type: "hello" | "ping" | "leave";
  clientId: string;
  role: RoomRole;
};

type ServerMessage =
  | { type: "ready" }
  | {
      type: "room-state";
      peers: { clientId: string; role: RoomRole; seenAt: number }[];
    };

type TransportStatus = "connecting" | "server" | "local";

interface RealtimeRoomPanelProps {
  gameId: string;
  gameName: string;
  language: Language;
}

const ROOM_COPY = {
  vi: {
    eyebrow: "Realtime 1v1",
    title: "Phòng chơi 1v1",
    description:
      "Tạo phòng, gửi link mời và sẵn sàng ghép đôi cho game đối kháng.",
    create: "Tạo phòng",
    join: "Vào phòng",
    inputPlaceholder: "Nhập mã phòng",
    inviteLabel: "Link mời",
    copy: "Copy link",
    copied: "Đã copy",
    roomCode: "Mã phòng",
    roleLabel: "Vai trò",
    playersLabel: "Người chơi",
    connectionLabel: "Kết nối",
    connecting: "Đang kết nối",
    serverOnline: "Server realtime",
    localOnly: "Kênh local",
    roleHost: "Chủ phòng",
    roleGuest: "Khách",
    waiting: "Đang chờ người chơi thứ hai",
    connected: "Đã có đối thủ trong phòng",
    note: "Lobby và link mời đã sẵn sàng. Đồng bộ nước đi qua internet cần nối thêm WebSocket/Supabase.",
  },
  en: {
    eyebrow: "Realtime 1v1",
    title: "1v1 room",
    description:
      "Create a room, share an invite link, and prepare matchmaking for competitive games.",
    create: "Create room",
    join: "Join room",
    inputPlaceholder: "Enter room code",
    inviteLabel: "Invite link",
    copy: "Copy link",
    copied: "Copied",
    roomCode: "Room code",
    roleLabel: "Role",
    playersLabel: "Players",
    connectionLabel: "Connection",
    connecting: "Connecting",
    serverOnline: "Realtime server",
    localOnly: "Local channel",
    roleHost: "Host",
    roleGuest: "Guest",
    waiting: "Waiting for player two",
    connected: "Opponent detected in this room",
    note: "Lobby and invite links are ready. Internet move sync still needs a WebSocket/Supabase backend.",
  },
} as const;

const getInitialRoomCode = (gameId: string): string => {
  if (typeof window === "undefined") return "";

  const params = new URLSearchParams(window.location.search);
  const requestedGame = params.get("game");
  const room = params.get("room");

  return requestedGame === gameId && room ? room.toUpperCase() : "";
};

const generateRoomCode = (): string =>
  Math.random().toString(36).slice(2, 8).toUpperCase();

const normalizeRoomCode = (value: string): string =>
  value
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 8)
    .toUpperCase();

export default function RealtimeRoomPanel({
  gameId,
  gameName,
  language,
}: RealtimeRoomPanelProps): JSX.Element {
  const copy = ROOM_COPY[language];
  const initialRoomCode = getInitialRoomCode(gameId);

  const [roomInput, setRoomInput] = useState(initialRoomCode);
  const [roomCode, setRoomCode] = useState(initialRoomCode);
  const [role, setRole] = useState<RoomRole>(
    initialRoomCode ? "guest" : "host",
  );
  const [peers, setPeers] = useState<PeerMap>({});
  const [copied, setCopied] = useState(false);
  const [transportStatus, setTransportStatus] =
    useState<TransportStatus>("connecting");

  const clientId = useMemo(
    () => `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    [],
  );

  const inviteLink = useMemo(() => {
    if (!roomCode || typeof window === "undefined") return "";

    const url = new URL(window.location.href);
    url.searchParams.set("game", gameId);
    url.searchParams.set("room", roomCode);
    return url.toString();
  }, [gameId, roomCode]);

  const playerCount = Math.min(2, 1 + Object.keys(peers).length);
  const connectionText =
    transportStatus === "server"
      ? copy.serverOnline
      : transportStatus === "local"
        ? copy.localOnly
        : copy.connecting;

  const setRoomInUrl = (code: string) => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    url.searchParams.set("game", gameId);
    url.searchParams.set("room", code);
    window.history.replaceState(null, "", url.toString());
  };

  const createRoom = () => {
    const nextCode = generateRoomCode();
    setRoomCode(nextCode);
    setRoomInput(nextCode);
    setRole("host");
    setPeers({});
    setTransportStatus("connecting");
    setRoomInUrl(nextCode);
    setCopied(false);
  };

  const joinRoom = () => {
    const nextCode = normalizeRoomCode(roomInput);
    if (!nextCode) return;

    setRoomCode(nextCode);
    setRoomInput(nextCode);
    setRole("guest");
    setPeers({});
    setTransportStatus("connecting");
    setRoomInUrl(nextCode);
    setCopied(false);
  };

  const copyInviteLink = async () => {
    if (!inviteLink) return;

    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  useEffect(() => {
    if (!roomCode) return;

    let disposed = false;
    let socket: WebSocket | null = null;
    let channel: BroadcastChannel | null = null;
    let interval: number | undefined;
    let fallbackTimeout: number | undefined;

    const clearPing = () => {
      if (interval) {
        window.clearInterval(interval);
        interval = undefined;
      }
    };

    const ownMessage = (type: RoomMessage["type"]): RoomMessage => ({
      type,
      clientId,
      role,
    });

    const applyServerPeers = (
      peerEntries: { clientId: string; role: RoomRole; seenAt: number }[],
    ) => {
      setPeers(
        Object.fromEntries(
          peerEntries
            .filter((peer) => peer.clientId !== clientId)
            .map((peer) => [
              peer.clientId,
              { role: peer.role, seenAt: peer.seenAt },
            ]),
        ),
      );
    };

    const startLocalChannel = () => {
      if (disposed || channel || typeof BroadcastChannel === "undefined") {
        return;
      }

      setTransportStatus("local");
      channel = new BroadcastChannel(`gamehub-room-${gameId}-${roomCode}`);

      const markPeer = (message: RoomMessage) => {
        if (message.clientId === clientId) return;

        setPeers((currentPeers) => ({
          ...currentPeers,
          [message.clientId]: {
            role: message.role,
            seenAt: Date.now(),
          },
        }));
      };

      channel.onmessage = (event) => {
        const message = event.data as RoomMessage;
        if (!message || typeof message !== "object") return;

        if (message.type === "leave") {
          setPeers((currentPeers) => {
            const nextPeers = { ...currentPeers };
            delete nextPeers[message.clientId];
            return nextPeers;
          });
          return;
        }

        markPeer(message);

        if (message.type === "hello") {
          channel?.postMessage(ownMessage("ping"));
        }
      };

      channel.postMessage(ownMessage("hello"));

      clearPing();
      interval = window.setInterval(() => {
        const now = Date.now();
        channel?.postMessage(ownMessage("ping"));
        setPeers((currentPeers) =>
          Object.fromEntries(
            Object.entries(currentPeers).filter(
              ([, peer]) => now - peer.seenAt < 4000,
            ),
          ),
        );
      }, 1200);
    };

    const fallbackToLocal = () => {
      if (disposed || channel) return;
      clearPing();
      setPeers({});
      startLocalChannel();
    };

    if (typeof WebSocket === "undefined" || typeof window === "undefined") {
      fallbackToLocal();
      return;
    }

    setTransportStatus("connecting");
    const host = window.location.hostname || "127.0.0.1";
    socket = new WebSocket(`ws://${host}:8787`);

    socket.onopen = () => {
      if (disposed) return;

      if (fallbackTimeout) {
        window.clearTimeout(fallbackTimeout);
        fallbackTimeout = undefined;
      }

      setTransportStatus("server");
      socket?.send(
        JSON.stringify({
          type: "join",
          gameId,
          roomCode,
          clientId,
          role,
        }),
      );

      clearPing();
      interval = window.setInterval(() => {
        if (socket?.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "ping" }));
        }
      }, 1200);
    };

    socket.onmessage = (event) => {
      let message: ServerMessage;
      try {
        message = JSON.parse(event.data) as ServerMessage;
      } catch {
        return;
      }

      if (message.type === "room-state") {
        applyServerPeers(message.peers);
      }
    };

    socket.onerror = () => {
      if (socket?.readyState !== WebSocket.OPEN) {
        fallbackToLocal();
      }
    };

    socket.onclose = () => {
      if (!disposed) fallbackToLocal();
    };

    fallbackTimeout = window.setTimeout(() => {
      if (socket?.readyState !== WebSocket.OPEN) {
        socket?.close();
        fallbackToLocal();
      }
    }, 900);

    return () => {
      disposed = true;

      if (fallbackTimeout) {
        window.clearTimeout(fallbackTimeout);
      }

      clearPing();
      channel?.postMessage(ownMessage("leave"));
      channel?.close();
      socket?.close();
    };
  }, [clientId, gameId, role, roomCode]);

  return (
    <section className="mb-4 rounded-lg border border-teal-100 bg-gradient-to-br from-white to-teal-50 p-4 shadow-sm">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div>
          <p className="text-xs font-bold uppercase text-teal-700">
            {copy.eyebrow}
          </p>
          <h2 className="mt-1 text-xl font-bold text-slate-800">
            {copy.title}: {gameName}
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            {copy.description}
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-white bg-white/80 p-3">
              <p className="text-xs font-semibold text-zinc-500">
                {copy.roomCode}
              </p>
              <p className="mt-1 text-lg font-bold text-slate-800">
                {roomCode || "--"}
              </p>
            </div>
            <div className="rounded-md border border-white bg-white/80 p-3">
              <p className="text-xs font-semibold text-zinc-500">
                {copy.roleLabel}
              </p>
              <p className="mt-1 text-lg font-bold text-slate-800">
                {role === "host" ? copy.roleHost : copy.roleGuest}
              </p>
            </div>
            <div className="rounded-md border border-white bg-white/80 p-3">
              <p className="text-xs font-semibold text-zinc-500">
                {copy.playersLabel}
              </p>
              <p className="mt-1 text-lg font-bold text-slate-800">
                {playerCount}/2
              </p>
            </div>
          </div>

          <p className="mt-3 text-sm font-semibold text-teal-800">
            {playerCount > 1 ? copy.connected : copy.waiting}
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {copy.connectionLabel}: {connectionText}
          </p>
          <p className="mt-2 text-xs leading-5 text-zinc-500">{copy.note}</p>
        </div>

        <div className="space-y-3 rounded-lg border border-white bg-white/85 p-3 shadow-sm">
          <button
            onClick={createRoom}
            className="w-full rounded-md bg-teal-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-teal-700"
          >
            {copy.create}
          </button>
          <div className="flex gap-2">
            <input
              value={roomInput}
              onChange={(event) =>
                setRoomInput(normalizeRoomCode(event.target.value))
              }
              placeholder={copy.inputPlaceholder}
              className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />
            <button
              onClick={joinRoom}
              className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-teal-500 hover:text-teal-700"
            >
              {copy.join}
            </button>
          </div>

          {inviteLink && (
            <div>
              <label className="text-xs font-semibold text-zinc-500">
                {copy.inviteLabel}
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  value={inviteLink}
                  readOnly
                  className="min-w-0 flex-1 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600"
                />
                <button
                  onClick={copyInviteLink}
                  className="rounded-md bg-slate-700 px-3 py-2 text-xs font-bold text-white transition hover:bg-slate-800"
                >
                  {copied ? copy.copied : copy.copy}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
