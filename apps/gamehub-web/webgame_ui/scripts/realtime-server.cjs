const crypto = require("node:crypto");
const http = require("node:http");

const PORT = Number(process.env.REALTIME_PORT || 8787);
const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

const rooms = new Map();
const socketRooms = new Map();

const getRoomKey = (gameId, roomCode) => `${gameId}:${roomCode}`;

const sendText = (socket, payload) => {
  if (socket.destroyed) return;

  const message = Buffer.from(JSON.stringify(payload));
  let header;

  if (message.length < 126) {
    header = Buffer.from([0x81, message.length]);
  } else if (message.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(message.length, 2);
  } else {
    return;
  }

  socket.write(Buffer.concat([header, message]));
};

const broadcastRoomState = (roomKey) => {
  const room = rooms.get(roomKey);
  if (!room) return;

  const peers = [...room.values()].map((client) => ({
    clientId: client.clientId,
    role: client.role,
    seenAt: client.seenAt,
  }));

  for (const socket of room.keys()) {
    sendText(socket, { type: "room-state", peers });
  }
};

const cleanupSocket = (socket) => {
  const roomKey = socketRooms.get(socket);
  if (!roomKey) return;

  const room = rooms.get(roomKey);
  if (room) {
    room.delete(socket);
    if (room.size === 0) {
      rooms.delete(roomKey);
    } else {
      broadcastRoomState(roomKey);
    }
  }

  socketRooms.delete(socket);
};

const handleClientMessage = (socket, rawMessage) => {
  let message;
  try {
    message = JSON.parse(rawMessage);
  } catch {
    return;
  }

  if (!message || typeof message !== "object") return;

  if (message.type === "join") {
    const gameId = String(message.gameId || "").trim();
    const roomCode = String(message.roomCode || "")
      .trim()
      .toUpperCase();
    const clientId = String(message.clientId || "").trim();
    const role = message.role === "guest" ? "guest" : "host";

    if (!gameId || !roomCode || !clientId) return;

    cleanupSocket(socket);

    const roomKey = getRoomKey(gameId, roomCode);
    if (!rooms.has(roomKey)) rooms.set(roomKey, new Map());

    rooms.get(roomKey).set(socket, {
      clientId,
      role,
      seenAt: Date.now(),
    });
    socketRooms.set(socket, roomKey);
    broadcastRoomState(roomKey);
    return;
  }

  if (message.type === "ping") {
    const roomKey = socketRooms.get(socket);
    const room = rooms.get(roomKey);
    const client = room?.get(socket);

    if (client) {
      client.seenAt = Date.now();
      broadcastRoomState(roomKey);
    }
  }
};

const handleFrames = (socket, chunk) => {
  socket.frameBuffer = socket.frameBuffer
    ? Buffer.concat([socket.frameBuffer, chunk])
    : chunk;

  while (socket.frameBuffer.length >= 2) {
    const buffer = socket.frameBuffer;
    const opcode = buffer[0] & 0x0f;
    const masked = Boolean(buffer[1] & 0x80);
    let length = buffer[1] & 0x7f;
    let offset = 2;

    if (length === 126) {
      if (buffer.length < offset + 2) return;
      length = buffer.readUInt16BE(offset);
      offset += 2;
    } else if (length === 127) {
      socket.end();
      return;
    }

    if (!masked) {
      socket.end();
      return;
    }

    if (buffer.length < offset + 4 + length) return;

    const mask = buffer.subarray(offset, offset + 4);
    offset += 4;
    const payload = Buffer.alloc(length);

    for (let index = 0; index < length; index += 1) {
      payload[index] = buffer[offset + index] ^ mask[index % 4];
    }

    socket.frameBuffer = buffer.subarray(offset + length);

    if (opcode === 0x8) {
      socket.end();
      return;
    }

    if (opcode === 0x1) {
      handleClientMessage(socket, payload.toString("utf8"));
    }
  }
};

const server = http.createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(
      JSON.stringify({
        ok: true,
        rooms: rooms.size,
      }),
    );
    return;
  }

  response.writeHead(200, { "Content-Type": "text/plain" });
  response.end("GameHub realtime server\n");
});

server.on("upgrade", (request, socket) => {
  const key = request.headers["sec-websocket-key"];
  if (!key) {
    socket.destroy();
    return;
  }

  const accept = crypto
    .createHash("sha1")
    .update(`${key}${WS_GUID}`)
    .digest("base64");

  socket.write(
    [
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Accept: ${accept}`,
      "",
      "",
    ].join("\r\n"),
  );

  socket.setNoDelay(true);
  socket.on("data", (chunk) => handleFrames(socket, chunk));
  socket.on("close", () => cleanupSocket(socket));
  socket.on("error", () => cleanupSocket(socket));
  sendText(socket, { type: "ready" });
});

server.listen(PORT, () => {
  console.log(`GameHub realtime server listening on ws://127.0.0.1:${PORT}`);
});
