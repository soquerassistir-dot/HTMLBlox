const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const ADMIN_KEY = "68@nisRY";

const app = express();
const server = http.createServer(app);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.use(express.static(__dirname));

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

let players = {};
let blocks = [];
let messages = [];

io.on("connection", (socket) => {
  console.log("✅ Conectado:", socket.id);

  players[socket.id] = {
    id: socket.id,
    x: 0, y: 1, z: 0,
    rotation: 0,
    username: "Player",
    isAdmin: false,
    color: 0x00ff00
  };

  socket.emit("init", { id: socket.id, players, blocks, messages });
  socket.broadcast.emit("playerJoined", players[socket.id]);

  socket.on("update", (data) => {
    if (!players[socket.id]) return;
    Object.assign(players[socket.id], data);
    socket.broadcast.emit("playerMoved", { id: socket.id, ...data });
  });

  socket.on("sendMessage", ({ text }) => {
    io.emit("receiveMessage", {
      id: socket.id,
      username: players[socket.id]?.username || "Player",
      text
    });
  });

  // 🔐 ADMIN AUTH
  socket.on("adminAuth", (key) => {
    if (key !== ADMIN_KEY) {
      socket.emit("adminAuthFail");
      return;
    }

    players[socket.id] = {
      id: socket.id,
      x: 0, y: 1, z: 0,
      rotation: 0,
      username: "Admin",
      isAdmin: true,
      color: 0xffffff
    };

    socket.isAdmin = true;

    socket.emit("adminAuthSuccess");
    io.emit("playerJoined", players[socket.id]);

    console.log("🔐 Admin autenticado:", socket.id);
  });

  // 🕹 MOVIMENTO ADMIN
  socket.on("adminMove", (dir) => {
    if (!socket.isAdmin) return;

    const p = players[socket.id];
    const speed = 0.3;

    if (dir === "up") p.z -= speed;
    if (dir === "down") p.z += speed;
    if (dir === "left") p.x -= speed;
    if (dir === "right") p.x += speed;

    io.emit("playerMoved", { id: socket.id, x: p.x, y: p.y, z: p.z });
  });

  socket.on("adminMessage", (text) => {
    if (!socket.isAdmin) return;
    io.emit("receiveMessage", {
      id: "ADMIN",
      username: "🌐 ADMIN",
      text
    });
  });

  socket.on("resetWorld", () => {
    if (!socket.isAdmin) return;
    blocks = [];
    messages = [];
    io.emit("worldReset");
  });

  socket.on("resetPlayers", () => {
    if (!socket.isAdmin) return;
    for (const id in players) {
      players[id].x = 0;
      players[id].y = 1;
      players[id].z = 0;
    }
    io.emit("playersReset");
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    io.emit("playerLeft", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("🚀 Online na porta", PORT);
});
