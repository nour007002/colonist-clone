const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from /public
app.use(express.static(path.join(__dirname, "public")));


// --- Simple in-memory game data (lost when you restart server) ---
const rooms = {}; 
// rooms[roomCode] = {
//   mapId: "small",
//   players: { socketId: { name, score } },
//   board: [ { id, x, y, resource, ownerId }, ... ]
// }

// Predefined maps (you can add many)
const MAPS = {
  small: generateHexLikeMap(3, "small"),
  medium: generateHexLikeMap(4, "medium"),
  large: generateHexLikeMap(5, "large"),
};

// Helper to create a fake “hex-like” board (for now just a grid)
function generateHexLikeMap(radius, mapId) {
  const resources = ["wood", "brick", "sheep", "wheat", "ore", "desert"];
  const tiles = [];
  let idCounter = 0;

  for (let x = -radius; x <= radius; x++) {
    for (let y = -radius; y <= radius; y++) {
      // Simple filter to make diamond-ish shape
      if (Math.abs(x) + Math.abs(y) <= radius * 2) {
        tiles.push({
          id: idCounter++,
          x,
          y,
          resource: resources[Math.floor(Math.random() * resources.length)],
          ownerId: null,
        });
      }
    }
  }
  return { id: mapId, radius, tiles };
}

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("createRoom", ({ playerName, mapId }, callback) => {
    const roomCode = generateRoomCode();
    const map = MAPS[mapId] || MAPS.small;

    rooms[roomCode] = {
      mapId: mapId,
      players: {},
      board: JSON.parse(JSON.stringify(map.tiles)), // deep copy
    };

    joinRoom(socket, roomCode, playerName);
    callback({ roomCode, roomState: getRoomState(roomCode) });
  });

  socket.on("joinRoom", ({ roomCode, playerName }, callback) => {
    roomCode = roomCode.toUpperCase();
    if (!rooms[roomCode]) {
      return callback({ error: "Room not found" });
    }
    joinRoom(socket, roomCode, playerName);
    callback({ roomCode, roomState: getRoomState(roomCode) });
  });

  socket.on("clickTile", ({ roomCode, tileId }) => {
    const room = rooms[roomCode];
    if (!room) return;
    const player = room.players[socket.id];
    if (!player) return;

    const tile = room.board.find((t) => t.id === tileId);
    if (!tile) return;

    // Simple logic: claim tile, gain 1 point if you click a neutral tile
    if (!tile.ownerId) {
      tile.ownerId = socket.id;
      player.score += 1;
    } else if (tile.ownerId === socket.id) {
      // Optional: unclaim your own tile
      tile.ownerId = null;
      player.score -= 1;
    } else {
      // For now, do nothing if owned by someone else
    }

    io.to(roomCode).emit("roomUpdate", getRoomState(roomCode));
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
    // Remove from rooms
    for (const [roomCode, room] of Object.entries(rooms)) {
      if (room.players[socket.id]) {
        delete room.players[socket.id];

        // If room becomes empty, delete it
        if (Object.keys(room.players).length === 0) {
          delete rooms[roomCode];
        } else {
          io.to(roomCode).emit("roomUpdate", getRoomState(roomCode));
        }
      }
    }
  });
});

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  if (rooms[code]) return generateRoomCode();
  return code;
}

function joinRoom(socket, roomCode, playerName) {
  socket.join(roomCode);
  const room = rooms[roomCode];

  room.players[socket.id] = {
    id: socket.id,
    name: playerName || "Player",
    score: 0,
  };

  // Notify others that room changed
  io.to(roomCode).emit("roomUpdate", getRoomState(roomCode));
}

function getRoomState(roomCode) {
  const room = rooms[roomCode];
  if (!room) return null;
  return {
    mapId: room.mapId,
    players: Object.values(room.players),
    board: room.board,
  };
}

const PORT = 3000;
server.listen(PORT, () => {
  console.log("Server listening on http://localhost:" + PORT);
});

