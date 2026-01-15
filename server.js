const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// 🔴 GARANTE QUE / FUNCIONA NO RENDER
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Arquivos estáticos (index.html, js, css, etc)
app.use(express.static(__dirname));

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// ================= ESTADO GLOBAL =================
let players = {};
let blocks = [];
let messages = [];

// ================= SOCKET.IO =================
io.on("connection", (socket) => {
  console.log("✅ Jogador conectado:", socket.id);

  // Criar player
  players[socket.id] = {
    id: socket.id,
    x: 0,
    y: 1,
    z: 0,
    rotation: 0,
    username: "Player",
    skinColor: 0xFFFF00,
    torsoColor: 0x0000FF,
    legsColor: 0x00FF00,
    animation: "idle",
    walking: false,
    velocityY: 0
  };

  // Enviar estado inicial
  socket.emit("init", {
    id: socket.id,
    players,
    blocks,
    messages
  });

  socket.broadcast.emit("playerJoined", players[socket.id]);

  // MOVIMENTO
  socket.on("update", (data) => {
    if (!players[socket.id]) return;

    Object.assign(players[socket.id], data);

    socket.broadcast.emit("playerMoved", {
      id: socket.id,
      ...data
    });
  });

  // ANIMAÇÃO
  socket.on("updateAnimation", (data) => {
    if (!players[socket.id]) return;

    players[socket.id].animation = data.animation;
    players[socket.id].walking = data.walking;
    players[socket.id].velocityY = data.velocityY;

    socket.broadcast.emit("playerAnimated", {
      id: socket.id,
      ...data
    });
  });

  // CORES
  socket.on("updateColor", ({ part, color }) => {
    if (!players[socket.id]) return;

    players[socket.id][part] = color;

    io.emit("playerColorChanged", {
      id: socket.id,
      part,
      color
    });
  });

  // USERNAME
  socket.on("updateUsername", (name) => {
    if (!players[socket.id]) return;

    const oldName = players[socket.id].username;
    players[socket.id].username = name;

    io.emit("playerRenamed", {
      id: socket.id,
      oldName,
      username: name
    });
  });

  // CHAT
  socket.on("sendMessage", ({ text }) => {
    const msg = {
      id: socket.id,
      username: players[socket.id]?.username || "Player",
      text,
      time: new Date().toLocaleTimeString()
    };

    messages.push(msg);
    if (messages.length > 50) messages.shift();

    io.emit("receiveMessage", msg);
  });

  // BUILD
  socket.on("placeBlock", (block) => {
    const blockData = {
      id: Date.now().toString(36) + Math.random().toString(36),
      ...block
    };

    blocks.push(blockData);
    io.emit("blockPlaced", blockData);
  });

  // DISCONNECT
  socket.on("disconnect", () => {
    console.log("❌ Jogador saiu:", socket.id);
    delete players[socket.id];
    io.emit("playerLeft", socket.id);
  });
});

// ================= PORTA (RENDER) =================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("🚀 Servidor online na porta", PORT);
});
