// client.js
const socket = io();

let currentRoomCode = null;
let mySocketId = null;
let currentRoomState = null;

// DOM elements
const playerNameInput = document.getElementById("playerName");
const createMapSelect = document.getElementById("createMap");
const createRoomBtn = document.getElementById("createRoomBtn");
const joinCodeInput = document.getElementById("joinCode");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const joinErrorDiv = document.getElementById("joinError");

const lobbyDiv = document.getElementById("lobby");
const gameDiv = document.getElementById("game");
const roomCodeDisplay = document.getElementById("roomCodeDisplay");
const mapIdDisplay = document.getElementById("mapIdDisplay");
const boardDiv = document.getElementById("board");
const playerListUl = document.getElementById("playerList");

createRoomBtn.addEventListener("click", () => {
  const name = (playerNameInput.value || "Player").trim();
  const mapId = createMapSelect.value;
  socket.emit("createRoom", { playerName: name, mapId }, (resp) => {
    if (resp && resp.roomCode) {
      mySocketId = socket.id; // will be set soon after connect
      enterGame(resp.roomCode, resp.roomState);
    }
  });
});

joinRoomBtn.addEventListener("click", () => {
  const name = (playerNameInput.value || "Player").trim();
  const code = (joinCodeInput.value || "").trim().toUpperCase();
  joinErrorDiv.textContent = "";
  if (!code) {
    joinErrorDiv.textContent = "Enter a room code.";
    return;
  }
  socket.emit("joinRoom", { playerName: name, roomCode: code }, (resp) => {
    if (resp.error) {
      joinErrorDiv.textContent = resp.error;
      return;
    }
    mySocketId = socket.id; 
    enterGame(resp.roomCode, resp.roomState);
  });
});

socket.on("connect", () => {
  mySocketId = socket.id;
});

socket.on("roomUpdate", (roomState) => {
  if (!currentRoomCode) return;
  currentRoomState = roomState;
  renderRoom();
});

function enterGame(roomCode, roomState) {
  currentRoomCode = roomCode;
  currentRoomState = roomState;

  lobbyDiv.classList.add("hidden");
  gameDiv.classList.remove("hidden");

  roomCodeDisplay.textContent = roomCode;
  mapIdDisplay.textContent = roomState.mapId;

  renderRoom();
}

function renderRoom() {
  if (!currentRoomState) return;

  // Render players
  playerListUl.innerHTML = "";
  currentRoomState.players.forEach((p) => {
    const li = document.createElement("li");
    const isMe = p.id === mySocketId;
    li.textContent = `${p.name} `;
    if (isMe) li.textContent += "(you) ";
    const spanScore = document.createElement("span");
    spanScore.className = "score";
    spanScore.textContent = `– ${p.score} pts`;
    li.appendChild(spanScore);
    playerListUl.appendChild(li);
  });

  // Render board
  boardDiv.innerHTML = "";
  if (!currentRoomState.board) return;

  currentRoomState.board.forEach((tile) => {
    const div = document.createElement("div");
    div.classList.add("tile");
    div.classList.add(tile.resource);

    if (tile.ownerId) {
      if (tile.ownerId === mySocketId) {
        div.classList.add("owner-me");
      } else {
        div.classList.add("owner-other");
      }
    }

    div.title = `Resource: ${tile.resource}\nTile ID: ${tile.id}`;
    div.textContent = tile.resource[0].toUpperCase();

    div.addEventListener("click", () => {
      if (!currentRoomCode) return;
      socket.emit("clickTile", {
        roomCode: currentRoomCode,
        tileId: tile.id,
      });
    });

    boardDiv.appendChild(div);
  });
}
