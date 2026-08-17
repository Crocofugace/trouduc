import express from "express";
import http from "http";
import { Server } from "socket.io";
import { createRoomManager, CONST } from "./rooms.js";

const PORT = process.env.PORT || 3001;
const extraOrigins = (process.env.CLIENT_ORIGIN || "")
  .split(",").map(s => s.trim()).filter(Boolean);
const allowedOrigins = ["http://localhost:5173", "http://127.0.0.1:5173", ...extraOrigins];

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: allowedOrigins, methods: ["GET", "POST"] },
});

app.get("/", (_req, res) => res.send("Trouduc — serveur en ligne actif."));
app.get("/health", (_req, res) => res.json({ ok: true }));

const rm = createRoomManager(io);

io.on("connection", (socket) => {
  socket.on("createRoom", ({ name, numPlayers, numRounds }, cb) => {
    const trimmed = (name || "").trim().slice(0, 20);
    if (!trimmed) return cb && cb({ error: "Pseudo invalide" });
    if (![4, 5, 6].includes(numPlayers)) return cb && cb({ error: "Nombre de joueurs invalide" });
    if (![3, 5, 10].includes(numRounds)) return cb && cb({ error: "Nombre de manches invalide" });
    const room = rm.newRoom("private", { numPlayersTarget: numPlayers, numRounds });
    const player = rm.addPlayer(room, trimmed);
    player.socketId = socket.id;
    socket.join(room.code);
    cb && cb({ code: room.code, playerId: player.playerId });
    rm.broadcastLobby(room);
  });

  socket.on("joinRoom", ({ code, name }, cb) => {
    const room = rm.getRoom(code);
    if (!room) return cb && cb({ error: "Partie introuvable" });
    if (room.engine) return cb && cb({ error: "La partie a déjà commencé" });
    const trimmed = (name || "").trim().slice(0, 20);
    if (!trimmed) return cb && cb({ error: "Pseudo invalide" });
    if (room.players.length >= rm.lobbyCap(room)) return cb && cb({ error: "Partie complète" });
    if (room.players.some(p => p.name.toLowerCase() === trimmed.toLowerCase())) {
      return cb && cb({ error: "Pseudo déjà pris dans cette partie" });
    }
    const player = rm.addPlayer(room, trimmed);
    player.socketId = socket.id;
    socket.join(room.code);
    cb && cb({ code: room.code, playerId: player.playerId });
    rm.broadcastLobby(room);
    if (room.lobbyType === "public") rm.evaluatePublicAutoStart(room);
  });

  socket.on("quickPlay", ({ name }, cb) => {
    const trimmed = (name || "").trim().slice(0, 20);
    if (!trimmed) return cb && cb({ error: "Pseudo invalide" });
    let room = rm.findPublicRoomWithSpace();
    if (!room) room = rm.newRoom("public", { numRounds: 5 });
    if (room.players.some(p => p.name.toLowerCase() === trimmed.toLowerCase())) {
      return cb && cb({ error: "Pseudo déjà pris, essaie un autre" });
    }
    const player = rm.addPlayer(room, trimmed);
    player.socketId = socket.id;
    socket.join(room.code);
    cb && cb({ code: room.code, playerId: player.playerId });
    rm.broadcastLobby(room);
    rm.evaluatePublicAutoStart(room);
  });

  socket.on("rejoin", ({ code, playerId }, cb) => {
    const res = rm.handleRejoin(code, playerId, socket.id);
    if (res.ok) socket.join((code || "").toUpperCase());
    cb && cb(res);
  });

  socket.on("startGame", ({ code, playerId }, cb) => {
    const room = rm.getRoom(code);
    if (!room) return cb && cb({ error: "Partie introuvable" });
    if (room.lobbyType !== "private") return cb && cb({ error: "Les parties publiques démarrent automatiquement" });
    const seat = rm.seatOf(room, playerId);
    if (seat !== room.hostSeat) return cb && cb({ error: "Seul l'hôte peut lancer la partie" });
    if (room.players.length !== room.numPlayersTarget) return cb && cb({ error: `Il faut ${room.numPlayersTarget} joueurs` });
    rm.startGame(room);
    cb && cb({ ok: true });
  });

  socket.on("playCards", ({ code, playerId, cardIds }, cb) => {
    const room = rm.getRoom(code);
    if (!room) return cb && cb({ error: "Partie introuvable" });
    const seat = rm.seatOf(room, playerId);
    if (seat === -1) return cb && cb({ error: "Joueur inconnu" });
    cb && cb(rm.handlePlay(room, seat, cardIds));
  });

  socket.on("pass", ({ code, playerId }, cb) => {
    const room = rm.getRoom(code);
    if (!room) return cb && cb({ error: "Partie introuvable" });
    const seat = rm.seatOf(room, playerId);
    if (seat === -1) return cb && cb({ error: "Joueur inconnu" });
    cb && cb(rm.handlePass(room, seat));
  });

  socket.on("exchangeChoice", ({ code, playerId, cardIds }, cb) => {
    const room = rm.getRoom(code);
    if (!room) return cb && cb({ error: "Partie introuvable" });
    const seat = rm.seatOf(room, playerId);
    if (seat === -1) return cb && cb({ error: "Joueur inconnu" });
    cb && cb(rm.handleExchangeChoice(room, seat, cardIds));
  });

  socket.on("leaveGame", ({ code, playerId }) => {
    rm.handleLeave(code, playerId);
  });

  socket.on("disconnect", () => {
    rm.handleDisconnectSocket(socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Trouduc — serveur en ligne démarré sur le port ${PORT} (timers: tour ${CONST.TURN_TIMEOUT_MS / 1000}s, échange ${CONST.EXCHANGE_TIMEOUT_MS / 1000}s)`);
});
