const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const { Server } = require("socket.io");

const ADMIN_KEY = "68@nisRY";

const app = express();
const server = http.createServer(app);

// ================= ROTAS =================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.use(express.static(__dirname));

// ================= SOCKET =================
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// ================= ARQUIVOS JSON =================
const BLOCKS_FILE = "./world_blocks.json";
const MESSAGES_FILE = "./world_messages.json";

function loadJSON(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ================= ESTADO GLOBAL =================
let players = {};
let blocks = loadJSON(BLOCKS_FILE, []);
let messages = loadJSON(MESSAGES_FILE, []);

// ================= CONEXÃO =================
io.on("connection", (socket) => {
  console.log("✅ Conectado:", socket.id);

  // PLAYER NORMAL
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
    velocityY: 0,
    isAdmin: false
  };

  socket.emit("init", { id: socket.id, players, blocks, messages });
  socket.broadcast.emit("playerJoined", players[socket.id]);

  // MOVIMENTO NORMAL
  socket.on("update", (data) => {
    if (!players[socket.id]) return;
    Object.assign(players[socket.id], data);
    socket.broadcast.emit("playerMoved", { id: socket.id, ...data });
  });

  // CHAT
  socket.on("sendMessage", ({ text }) => {
    const msg = {
      id: socket.id,
      username: players[socket.id]?.username || "Player",
      text
    };
    messages.push(msg);
    if (messages.length > 50) messages.shift();
    saveJSON(MESSAGES_FILE, messages);
    io.emit("receiveMessage", msg);
  });

  // ================= ADMIN AUTH =================
  socket.on("adminAuth", (key) => {
    if (key !== ADMIN_KEY) {
      socket.emit("adminAuthFail");
      return;
    }

    players[socket.id] = {
      id: socket.id,
      x: 0,
      y: 1,
      z: 0,
      rotation: 0,
      username: "Admin",
      skinColor: 0xFFFFFF,
      torsoColor: 0xFFFFFF,
      legsColor: 0xFFFFFF,
      animation: "idle",
      walking: false,
      velocityY: 0,
      isAdmin: true
    };

    socket.isAdmin = true;

    socket.emit("adminAuthSuccess");
    io.emit("playerJoined", players[socket.id]);

    console.log("🔐 Admin autenticado:", socket.id);
  });

  // ================= MOVIMENTO ADMIN (FIX) =================
  socket.on("adminMove", (dir) => {
    if (!socket.isAdmin) return;
    if (!players[socket.id]) return;

    const p = players[socket.id];
    const speed = 0.3;

    if (dir === "up") p.z -= speed;
    if (dir === "down") p.z += speed;
    if (dir === "left") p.x -= speed;
    if (dir === "right") p.x += speed;

    io.emit("playerMoved", {
      id: socket.id,
      x: p.x,
      y: p.y,
      z: p.z,
      rotation: p.rotation
    });
  });

  // ================= ADMIN CHAT =================
  socket.on("adminMessage", (text) => {
    if (!socket.isAdmin) return;
    io.emit("receiveMessage", {
      id: "ADMIN",
      username: "🌐 ADMIN",
      text
    });
  });

  // ================= RESET =================
  socket.on("resetWorld", () => {
    if (!socket.isAdmin) return;
    blocks = [];
    messages = [];
    saveJSON(BLOCKS_FILE, blocks);
    saveJSON(MESSAGES_FILE, messages);
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

// ================= PORTA =================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("🚀 Online na porta", PORT);
});
