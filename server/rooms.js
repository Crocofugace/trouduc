// Gestion des salons en ligne : le moteur de jeu (src/engine/president.js) est importé tel quel,
// jamais modifié. Ce fichier ne fait qu'orchestrer réseau + timers autour de ses fonctions publiques.
import crypto from "crypto";
import { newGame, dealRound, applyExchanges, legalMoves, applyMove, botMove } from "../src/engine/president.js";
import { redactForSeat } from "./redact.js";

export const CONST = {
  MIN_PLAYERS: 4,
  MAX_PLAYERS: 6,
  PUBLIC_AUTOSTART_MS: 10000,
  TURN_TIMEOUT_MS: 15000,
  SHORT_TIMEOUT_MS: 1200, // délai réduit pour un siège déconnecté, pour ne pas bloquer la table
  EXCHANGE_TIMEOUT_MS: 30000,
  ROUND_END_DELAY_MS: 5000,
  GAME_END_DELAY_MS: 12000,
  LOBBY_DISCONNECT_GRACE_MS: 5000,
  GAME_DISCONNECT_GRACE_MS: 30000,
};

const CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";

export function createRoomManager(io) {
  const rooms = new Map();

  function generateCode() {
    let code;
    do {
      code = Array.from({ length: 4 }, () => CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)]).join("");
    } while (rooms.has(code));
    return code;
  }

  function newRoom(lobbyType, { numPlayersTarget = null, numRounds = 5 } = {}) {
    const code = generateCode();
    const room = {
      code, lobbyType, numPlayersTarget, numRounds,
      hostSeat: 0,
      players: [],
      engine: null,
      exchange: null,
      autoStartTimer: null, autoStartDeadline: null,
      turnTimer: null, turnDeadline: null,
      exchangeTimer: null, exchangeDeadline: null,
      roundTimer: null,
      disconnectTimers: {},
      endingAfterRound: false,
      endReason: null,
      constants: CONST,
    };
    rooms.set(code, room);
    return room;
  }

  function getRoom(code) { return rooms.get((code || "").toUpperCase()); }

  function deleteRoom(room) {
    clearTimeout(room.autoStartTimer);
    clearTimeout(room.turnTimer);
    clearTimeout(room.exchangeTimer);
    clearTimeout(room.roundTimer);
    for (const t of Object.values(room.disconnectTimers)) clearTimeout(t);
    rooms.delete(room.code);
  }

  function findPublicRoomWithSpace() {
    for (const room of rooms.values()) {
      if (room.lobbyType !== "public" || room.engine) continue;
      if (room.players.filter(p => p.connected).length < CONST.MAX_PLAYERS) return room;
    }
    return null;
  }

  function addPlayer(room, name) {
    const playerId = crypto.randomBytes(8).toString("hex");
    const player = { playerId, name, socketId: null, connected: true };
    room.players.push(player);
    return player;
  }

  function seatOf(room, playerId) {
    return room.players.findIndex(p => p && p.playerId === playerId);
  }

  function connectedCount(room) {
    return room.players.filter(p => p && p.connected).length;
  }

  function lobbyCap(room) {
    return room.lobbyType === "public" ? CONST.MAX_PLAYERS : room.numPlayersTarget;
  }

  // -------------------- Diffusion --------------------

  function broadcastLobby(room) {
    const payload = redactForSeat(room, -1);
    room.players.forEach((p, seat) => {
      if (!p || !p.socketId) return;
      io.to(p.socketId).emit("lobbyUpdate", { ...payload, me: seat });
    });
  }

  function broadcastState(room) {
    room.players.forEach((p, seat) => {
      if (!p || !p.socketId) return;
      io.to(p.socketId).emit("gameState", redactForSeat(room, seat));
    });
  }

  // -------------------- Démarrage --------------------

  function evaluatePublicAutoStart(room) {
    if (room.lobbyType !== "public" || room.engine) return;
    const count = connectedCount(room);
    if (count >= CONST.MIN_PLAYERS && !room.autoStartTimer) {
      room.autoStartDeadline = Date.now() + CONST.PUBLIC_AUTOSTART_MS;
      room.autoStartTimer = setTimeout(() => {
        room.autoStartTimer = null; room.autoStartDeadline = null;
        if (!room.engine && connectedCount(room) >= CONST.MIN_PLAYERS) startGame(room);
        broadcastLobby(room);
      }, CONST.PUBLIC_AUTOSTART_MS);
      broadcastLobby(room);
    } else if (count < CONST.MIN_PLAYERS && room.autoStartTimer) {
      clearTimeout(room.autoStartTimer);
      room.autoStartTimer = null; room.autoStartDeadline = null;
      broadcastLobby(room);
    }
  }

  function startGame(room) {
    clearTimeout(room.autoStartTimer);
    room.autoStartTimer = null; room.autoStartDeadline = null;
    // Sièges figés dans l'ordre d'arrivée au moment du lancement.
    room.players = room.players.filter(p => p.connected);
    const n = room.players.length;
    room.numPlayersTarget = n;
    const g = newGame(n, room.numRounds);
    room.engine = g;
    const needsExchange = dealRound(g);
    if (needsExchange) setupExchange(room); else scheduleTurnTimer(room);
    room.players.forEach(p => { if (p.socketId) io.to(p.socketId).emit("gameStarting"); });
    broadcastState(room);
  }

  // -------------------- Tour de jeu --------------------

  function clearTurnTimer(room) {
    clearTimeout(room.turnTimer);
    room.turnTimer = null; room.turnDeadline = null;
  }

  function scheduleTurnTimer(room) {
    clearTurnTimer(room);
    const g = room.engine;
    if (!g || (g.phase !== "PLI_OUVERTURE" && g.phase !== "PLI_REPONSE")) return;
    const player = room.players[g.turn];
    const delay = (player && player.connected) ? CONST.TURN_TIMEOUT_MS : CONST.SHORT_TIMEOUT_MS;
    room.turnDeadline = Date.now() + delay;
    room.turnTimer = setTimeout(() => {
      const g2 = room.engine;
      if (!g2 || (g2.phase !== "PLI_OUVERTURE" && g2.phase !== "PLI_REPONSE")) return;
      const seat = g2.turn;
      const legal = legalMoves(g2, seat);
      const canPass = legal.some(m => m.type === "pass");
      const revB = g2.revolution;
      applyMove(g2, seat, canPass ? { type: "pass" } : botMove(g2, seat, "easy"));
      afterMove(room, revB);
    }, delay);
  }

  function afterMove(room, revBefore) {
    const g = room.engine;
    if (g.phase === "MANCHE_FINIE" || g.phase === "PARTIE_FINIE") {
      clearTurnTimer(room);
      broadcastState(room);
      scheduleRoundTransition(room);
      return;
    }
    scheduleTurnTimer(room);
    broadcastState(room);
  }

  function handlePlay(room, seat, cardIds) {
    const g = room.engine;
    if (!g) return { error: "Partie introuvable" };
    if (g.phase !== "PLI_OUVERTURE" && g.phase !== "PLI_REPONSE") return { error: "Pas en phase de jeu" };
    if (g.turn !== seat) return { error: "Ce n'est pas ton tour" };
    if (!Array.isArray(cardIds) || cardIds.length < 1 || new Set(cardIds).size !== cardIds.length) return { error: "Sélection invalide" };
    const hand = g.hands[seat];
    const cards = cardIds.map(id => hand.find(c => c.id === id));
    if (cards.some(c => !c)) return { error: "Carte absente de ta main" };
    const rank = cards[0].rank, count = cards.length;
    const legal = legalMoves(g, seat);
    const match = legal.find(m => m.type === "play" && m.rank === rank && m.count === count);
    if (!match) return { error: "Coup illégal" };
    const revB = g.revolution;
    try { applyMove(g, seat, { type: "play", cards: match.cards }); }
    catch (e) { return { error: e.message }; }
    afterMove(room, revB);
    return { ok: true };
  }

  function handlePass(room, seat) {
    const g = room.engine;
    if (!g) return { error: "Partie introuvable" };
    if (g.phase !== "PLI_OUVERTURE" && g.phase !== "PLI_REPONSE") return { error: "Pas en phase de jeu" };
    if (g.turn !== seat) return { error: "Ce n'est pas ton tour" };
    const legal = legalMoves(g, seat);
    if (!legal.some(m => m.type === "pass")) return { error: "Tu dois jouer" };
    const revB = g.revolution;
    try { applyMove(g, seat, { type: "pass" }); }
    catch (e) { return { error: e.message }; }
    afterMove(room, revB);
    return { ok: true };
  }

  // -------------------- Échange de cartes --------------------

  function setupExchange(room) {
    const g = room.engine;
    const idxOf = t => g.lastTitles.indexOf(t);
    room.exchange = { presSeat: idxOf(0), vpSeat: idxOf(1), presGiven: null, vpGiven: null };
    scheduleExchangeTimer(room);
  }

  function pendingExchangeSeats(room) {
    const ex = room.exchange;
    const pending = [];
    if (!ex.presGiven) pending.push(ex.presSeat);
    if (!ex.vpGiven) pending.push(ex.vpSeat);
    return pending;
  }

  function allPendingDisconnected(room) {
    const pending = pendingExchangeSeats(room);
    return pending.length > 0 && pending.every(seat => !room.players[seat] || !room.players[seat].connected);
  }

  function clearExchangeTimer(room) {
    clearTimeout(room.exchangeTimer);
    room.exchangeTimer = null; room.exchangeDeadline = null;
  }

  function scheduleExchangeTimer(room) {
    clearExchangeTimer(room);
    if (!room.exchange) return;
    const delay = allPendingDisconnected(room) ? CONST.SHORT_TIMEOUT_MS : CONST.EXCHANGE_TIMEOUT_MS;
    room.exchangeDeadline = Date.now() + delay;
    room.exchangeTimer = setTimeout(() => resolveExchange(room), delay);
  }

  function resolveExchange(room) {
    const g = room.engine;
    const ex = room.exchange;
    if (!g || !ex) return;
    clearExchangeTimer(room);
    const choices = {};
    if (ex.presGiven) choices.presidentGives = ex.presGiven;
    if (ex.vpGiven) choices.vicePresidentGives = ex.vpGiven;
    room.exchange = null;
    applyExchanges(g, choices);
    scheduleTurnTimer(room);
    broadcastState(room);
  }

  function handleExchangeChoice(room, seat, cardIds) {
    const g = room.engine;
    const ex = room.exchange;
    if (!g || !ex) return { error: "Pas en phase d'échange" };
    if (!Array.isArray(cardIds) || new Set(cardIds).size !== cardIds.length) return { error: "Sélection invalide" };
    const hand = g.hands[seat];
    if (seat === ex.presSeat) {
      if (ex.presGiven) return { error: "Déjà fait" };
      if (!Array.isArray(cardIds) || cardIds.length !== 2) return { error: "Choisis 2 cartes" };
      if (!cardIds.every(id => hand.some(c => c.id === id))) return { error: "Carte absente" };
      ex.presGiven = hand.filter(c => cardIds.includes(c.id));
    } else if (seat === ex.vpSeat) {
      if (ex.vpGiven) return { error: "Déjà fait" };
      if (!Array.isArray(cardIds) || cardIds.length !== 1) return { error: "Choisis 1 carte" };
      if (!cardIds.every(id => hand.some(c => c.id === id))) return { error: "Carte absente" };
      ex.vpGiven = hand.filter(c => cardIds.includes(c.id));
    } else {
      return { error: "Tu n'es pas concerné par l'échange" };
    }
    if (ex.presGiven && ex.vpGiven) resolveExchange(room);
    else { scheduleExchangeTimer(room); broadcastState(room); }
    return { ok: true };
  }

  // -------------------- Transition entre manches --------------------

  function scheduleRoundTransition(room) {
    clearTimeout(room.roundTimer);
    room.roundTimer = setTimeout(() => {
      const g = room.engine;
      if (!g) return;
      if (g.phase === "PARTIE_FINIE" || room.endingAfterRound || connectedCount(room) < CONST.MIN_PLAYERS) {
        room.endReason = room.endingAfterRound || connectedCount(room) < CONST.MIN_PLAYERS
          ? "Plus assez de joueurs pour continuer" : "Partie terminée";
        broadcastState(room);
        setTimeout(() => deleteRoom(room), CONST.GAME_END_DELAY_MS);
        return;
      }
      const needsExchange = dealRound(g);
      if (needsExchange) setupExchange(room); else scheduleTurnTimer(room);
      broadcastState(room);
    }, CONST.ROUND_END_DELAY_MS);
  }

  // -------------------- Connexion / déconnexion --------------------

  function handleDisconnectSocket(socketId) {
    for (const room of rooms.values()) {
      const seat = room.players.findIndex(p => p && p.socketId === socketId);
      if (seat === -1) continue;
      const player = room.players[seat];
      player.connected = false;
      player.socketId = null;

      if (!room.engine) {
        room.disconnectTimers[player.playerId] = setTimeout(() => {
          if (player.connected) return;
          room.players.splice(room.players.indexOf(player), 1);
          if (room.players.length === 0) { deleteRoom(room); return; }
          if (room.hostSeat >= room.players.length) room.hostSeat = 0;
          broadcastLobby(room);
          evaluatePublicAutoStart(room);
        }, CONST.LOBBY_DISCONNECT_GRACE_MS);
        broadcastLobby(room);
        continue;
      }

      room.players.forEach(p => { if (p.socketId) io.to(p.socketId).emit("playerDisconnected", { name: player.name }); });
      if (connectedCount(room) < CONST.MIN_PLAYERS) room.endingAfterRound = true;
      if (room.engine.turn === seat) scheduleTurnTimer(room);
      if (room.exchange && (room.exchange.presSeat === seat || room.exchange.vpSeat === seat)) scheduleExchangeTimer(room);
      broadcastState(room);
      return;
    }
  }

  function handleRejoin(code, playerId, socketId) {
    const room = getRoom(code);
    if (!room) return { error: "Partie introuvable" };
    const seat = seatOf(room, playerId);
    if (seat === -1) return { error: "Joueur inconnu" };
    const player = room.players[seat];
    clearTimeout(room.disconnectTimers[playerId]);
    delete room.disconnectTimers[playerId];
    player.connected = true;
    player.socketId = socketId;
    if (!room.engine) broadcastLobby(room);
    else { scheduleTurnTimer(room); if (room.exchange) scheduleExchangeTimer(room); broadcastState(room); }
    return { ok: true };
  }

  function handleLeave(code, playerId) {
    const room = getRoom(code);
    if (!room) return;
    const seat = seatOf(room, playerId);
    if (seat === -1) return;
    const player = room.players[seat];
    clearTimeout(room.disconnectTimers[playerId]);
    delete room.disconnectTimers[playerId];

    if (!room.engine) {
      // Départ volontaire en salle d'attente : retrait immédiat, pas de délai de grâce.
      room.players.splice(seat, 1);
      if (room.players.length === 0) { deleteRoom(room); return; }
      if (room.hostSeat >= room.players.length) room.hostSeat = 0;
      broadcastLobby(room);
      evaluatePublicAutoStart(room);
      return;
    }

    // Départ volontaire en cours de partie : équivalent à une déconnexion sans espoir de retour
    // (pas de timer de grâce), la main du joueur sera écoulée par les timers courts existants.
    player.connected = false;
    player.socketId = null;
    room.players.forEach(p => { if (p.socketId) io.to(p.socketId).emit("playerDisconnected", { name: player.name }); });
    if (connectedCount(room) < CONST.MIN_PLAYERS) room.endingAfterRound = true;
    if (room.engine.turn === seat) scheduleTurnTimer(room);
    if (room.exchange && (room.exchange.presSeat === seat || room.exchange.vpSeat === seat)) scheduleExchangeTimer(room);
    broadcastState(room);
  }

  return {
    rooms, getRoom, newRoom, deleteRoom, findPublicRoomWithSpace, addPlayer, seatOf,
    connectedCount, lobbyCap, broadcastLobby, broadcastState, evaluatePublicAutoStart,
    startGame, handlePlay, handlePass, handleExchangeChoice, handleDisconnectSocket,
    handleRejoin, handleLeave,
  };
}
