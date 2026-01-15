const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const ADMIN_KEY = "68@nisRY";

const app = express();
const server = http.createServer(app);

app.get("/", (_, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.use(express.static(__dirname));

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET","POST"] }
});

let players = {};

io.on("connection", socket => {
  console.log("Conectado:", socket.id);

  players[socket.id] = { id: socket.id };

  socket.on("adminAuth", key => {
    if (key === ADMIN_KEY) {
      socket.isAdmin = true;
      delete players[socket.id];
      io.emit("playerLeft", socket.id);
      socket.emit("adminAuthSuccess");
      console.log("ADMIN:", socket.id);
    } else socket.emit("adminAuthFail");
  });

  socket.on("adminMessage", text => {
    if (!socket.isAdmin) return;
    io.emit("receiveMessage", {
      username:"SERVIDOR",
      text
    });
  });

  socket.on("resetWorld", () => {
    if (!socket.isAdmin) return;
    io.emit("worldReset");
  });

  socket.on("resetPlayers", () => {
    if (!socket.isAdmin) return;
    io.emit("playersReset");
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    io.emit("playerLeft", socket.id);
  });
});

server.listen(process.env.PORT || 3000, () =>
  console.log("Servidor ON")
);
