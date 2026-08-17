// Construit la vue d'un joueur à partir de l'état moteur : jamais les mains adverses en clair.
import { RANK_LABEL, SUITS } from "../src/engine/president.js";

function cardStr(cards) {
  return (cards || []).map(c => RANK_LABEL(c.rank) + SUITS[c.suit]).join(" ");
}

// Même logique que exchangeNote() côté solo (App.jsx), généralisée à un siège quelconque.
function exchangeNoteFor(g, seat) {
  const ex = g.lastExchange;
  if (!ex) return "";
  if (ex.pres === seat) return `Échange : t'as donné ${cardStr(ex.presGave)}, reçu ${cardStr(ex.tdcGave)}`;
  if (ex.tdc === seat) return `Échange : t'as lâché ${cardStr(ex.tdcGave)}, reçu ${cardStr(ex.presGave)}`;
  if (ex.vp === seat) return `Échange : t'as donné ${cardStr(ex.vpGave)}, reçu ${cardStr(ex.vtdcGave)}`;
  if (ex.vtdc === seat) return `Échange : t'as lâché ${cardStr(ex.vtdcGave)}, reçu ${cardStr(ex.vpGave)}`;
  return "";
}

export function redactForSeat(room, seat) {
  const roster = room.players.map((p, i) => ({
    seat: i,
    name: p ? p.name : null,
    connected: p ? p.connected : false,
  }));

  if (!room.engine) {
    return {
      phase: "lobby",
      code: room.code,
      lobbyType: room.lobbyType,
      numPlayersTarget: room.numPlayersTarget,
      numRounds: room.numRounds,
      players: roster,
      hostSeat: room.hostSeat,
      autoStartDeadline: room.autoStartDeadline || null,
      me: seat,
    };
  }

  const g = room.engine;
  const trick = g.trick
    ? { count: g.trick.count, rank: g.trick.rank, lastPlayer: g.trick.lastPlayer, passed: [...g.trick.passed], pile: g.trick.pile }
    : null;

  return {
    phase: g.phase,
    code: room.code,
    lobbyType: room.lobbyType,
    n: g.n,
    numRounds: g.numRounds,
    round: g.round,
    scores: g.scores,
    scoresBefore: g.scoresBefore,
    revolution: g.revolution,
    mustIncludeThreeClubs: g.mustIncludeThreeClubs,
    turn: g.turn,
    moveSeq: g.moveSeq,
    winSeq: g.winSeq,
    myHand: g.hands[seat] || [],
    handCounts: g.hands.map(h => h.length),
    trick,
    titles: g.titles,
    lastTitles: g.lastTitles,
    finishOrder: g.finishOrder,
    offenders: g.offenders,
    lastTrickPile: g.lastTrickPile || null,
    lastWinner: g.lastWinner ?? null,
    exchangeNote: exchangeNoteFor(g, seat),
    exchangeRole: room.exchange
      ? (room.exchange.presSeat === seat ? "P" : room.exchange.vpSeat === seat ? "VP" : null)
      : null,
    exchangeDeadline: room.exchangeDeadline || null,
    turnDeadline: room.turnDeadline || null,
    turnTimeoutMs: room.constants.TURN_TIMEOUT_MS,
    players: roster,
    hostSeat: room.hostSeat,
    me: seat,
  };
}
