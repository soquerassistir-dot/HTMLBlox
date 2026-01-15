const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const ADMIN_KEY = "68@nisRY"; // 🔐 MUDA ISSO

const app = express();
const server = http.createServer(app);

// rota principal
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// arquivos estáticos
app.use(express.static(__dirname));

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// ================= ESTADO GLOBAL =================
let players = {};
let blocks = [];
let messages = [];

// ================= SOCKET =================
io.on("connection", (socket) => {
  console.log("✅ Conectado:", socket.id);

  players[socket.id] = {
    id: socket.id,
    x: 0, y: 1, z: 0,
    rotation: 0,
    username: "Player",
    animation: "idle"
  };

  socket.emit("init", {
    id: socket.id,
    players,
    blocks,
    messages
  });

  socket.broadcast.emit("playerJoined", players[socket.id]);

  socket.on("update", (data) => {
    if (!players[socket.id]) return;
    Object.assign(players[socket.id], data);
    socket.broadcast.emit("playerMoved", { id: socket.id, ...data });
  });

  socket.on("sendMessage", ({ text }) => {
    const msg = {
      id: socket.id,
      username: players[socket.id]?.username || "Player",
      text
    };
    messages.push(msg);
    if (messages.length > 50) messages.shift();
    io.emit("receiveMessage", msg);
  });

  // ================= ADMIN =================
socket.on("adminAuth", (key) => {
  if (key === ADMIN_KEY) {
    socket.isAdmin = true;

    // se existir player normal, remove
    if (players[socket.id]) {
      delete players[socket.id];
      io.emit("playerLeft", socket.id);
    }

    socket.emit("adminAuthSuccess");
    console.log("🔐 Admin autenticado:", socket.id);
  } else {
    socket.emit("adminAuthFail");
  }
});


  socket.on("adminMessage", (text) => {
    if (!socket.isAdmin) return;
    io.emit("receiveMessage", {
      id: "ADMIN",
      username: "🌐 SERVIDOR",
      text
    });
  });

  socket.on("resetWorld", () => {
    if (!socket.isAdmin) return;
    blocks = [];
    messages = [];
    io.emit("worldReset");
    console.log("♻ Mundo resetado");
  });

  socket.on("resetPlayers", () => {
    if (!socket.isAdmin) return;
    for (const id in players) {
      players[id].x = 0;
      players[id].y = 1;
      players[id].z = 0;
    }
    io.emit("playersReset");
    console.log("♻ Players resetados");
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    io.emit("playerLeft", socket.id);
  });
});

// ================= PORTA =================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("🚀 Online na porta", PORT);
});


