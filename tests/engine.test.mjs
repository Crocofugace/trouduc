// Tests unitaires du moteur Trouduc (portés du prototype, adaptés au module ESM)
import * as E from "../src/engine/president.js";
import assert from "assert";
let passed = 0;
function T(name, fn) { fn(); console.log("✓ " + name); passed++; }

T("beats: normal, le 2 (15) bat l'As (14)", () => assert(E.beats(15, 14, false)));
T("beats: révolution, le 3 bat le 4", () => assert(E.beats(3, 4, true)));
T("strongestRank: 2 en normal, 3 en révolution", () => {
  assert.equal(E.strongestRank(false), 15); assert.equal(E.strongestRank(true), 3);
});
T("titleLabel à 4 et 6 joueurs", () => {
  assert.equal(E.titleLabel(0, 4), "Président");
  assert.equal(E.titleLabel(3, 4), "Trou du cul");
  assert.equal(E.titleLabel(2, 6), "Neutre");
  assert.equal(E.titleLabel(4, 6), "Vice-Trou du cul");
});

function state(hands, opts = {}) {
  const g = E.newGame(hands.length, 1);
  g.round = 1; g.revolution = opts.rev || false; g.finishOrder = []; g.offenders = [];
  g.hands = hands.map(h => h.map(([rank, suit]) => ({ rank, suit, id: (rank - 3) * 4 + suit })));
  g.trick = opts.trick || null;
  g.turn = opts.turn ?? 0;
  g.mustIncludeThreeClubs = opts.threeClubs || false;
  g.phase = g.trick ? "PLI_REPONSE" : "PLI_OUVERTURE";
  return g;
}

T("[D2] l'ouverture de la 1re manche doit inclure le 3♣", () => {
  const g = state([[[3, 0], [3, 1], [5, 0]], [[7, 0]], [[8, 0]], [[9, 0]]], { threeClubs: true });
  const moves = E.legalMoves(g, 0);
  assert(moves.every(m => m.rank === 3 && m.cards.some(c => c.rank === 3 && c.suit === 0)));
});

T("[D4] poser un 2 clôt le pli, le poseur ouvre", () => {
  const g = state([[[15, 0], [5, 0]], [[7, 0]], [[8, 0]], [[9, 0]]],
    { trick: { count: 1, rank: 10, lastPlayer: 3, passed: new Set(), pile: [] }, turn: 0 });
  E.applyMove(g, 0, { type: "play", cards: [{ rank: 15, suit: 0, id: 48 }] });
  assert.equal(g.phase, "PLI_OUVERTURE"); assert.equal(g.turn, 0);
});

T("[D6] carré => révolution + clôt le pli ; le 3 imbattable ensuite", () => {
  const g = state([[[6, 0], [6, 1], [6, 2], [6, 3], [3, 0]], [[15, 0], [4, 0]], [[8, 0]], [[9, 0]]], { turn: 0 });
  E.applyMove(g, 0, { type: "play", cards: [0, 1, 2, 3].map(s => ({ rank: 6, suit: s, id: 12 + s })) });
  assert(g.revolution); assert.equal(g.turn, 0);
  E.applyMove(g, 0, { type: "play", cards: [{ rank: 3, suit: 0, id: 0 }] });
  assert.equal(g.phase, "PLI_OUVERTURE");
});

T("[D5 corrigé] en réponse, finir sur un 2 n'est jamais proposé", () => {
  const g = state([[[8, 0]], [[15, 1]], [[9, 0], [10, 0]], [[9, 1], [10, 1]]],
    { trick: { count: 1, rank: 5, lastPlayer: 0, passed: new Set(), pile: [] }, turn: 1 });
  const moves = E.legalMoves(g, 1);
  assert(moves.every(m => m.type === "pass"));
});

T("[D5] main = un seul 2 à l'ouverture : coup forcé => Trouduc direct", () => {
  const g = state([[[15, 0]], [[8, 0], [9, 1]], [[8, 1]], [[9, 0]]], { turn: 0 });
  const moves = E.legalMoves(g, 0);
  assert.equal(moves.length, 1); assert(moves[0].offense);
  E.applyMove(g, 0, moves[0]);
  assert(g.offenders.includes(0));
});

T("[D5] fautif classé dernier même sorti premier", () => {
  const g = state([[[15, 0]], [[4, 0]], [[5, 0]], [[6, 0], [7, 0]]], { turn: 0 });
  E.applyMove(g, 0, E.legalMoves(g, 0)[0]);
  E.applyMove(g, 1, E.legalMoves(g, 1).find(m => m.type === "play"));
  E.applyMove(g, 2, E.legalMoves(g, 2).find(m => m.type === "play"));
  assert.equal(g.titles[1], 0); assert.equal(g.titles[0], 3);
});

T("[D8/D3] échanges corrects et le Trou du cul ouvre", () => {
  const g = E.newGame(4, 2);
  E.dealRound(g);
  g.lastTitles = [0, 1, 2, 3];
  g.phase = "MANCHE_FINIE";
  const needsEx = E.dealRound(g);
  assert(needsEx);
  E.applyExchanges(g);
  g.hands.forEach(h => assert.equal(h.length, 13));
  assert.equal(g.lastExchange.tdcGave.length, 2);
  assert.equal(g.turn, 3);
});

T("[D9] sortie sans clore le pli : le suivant en jeu ouvre après les passes", () => {
  const g = state([[[10, 0]], [[4, 0], [5, 0]], [[4, 1], [5, 1]], [[4, 2], [5, 2]]],
    { trick: { count: 1, rank: 8, lastPlayer: 3, passed: new Set(), pile: [] }, turn: 0 });
  E.applyMove(g, 0, { type: "play", cards: [{ rank: 10, suit: 0, id: 28 }] });
  E.applyMove(g, 1, { type: "pass" });
  E.applyMove(g, 2, { type: "pass" });
  E.applyMove(g, 3, { type: "pass" });
  assert.equal(g.phase, "PLI_OUVERTURE"); assert.equal(g.turn, 1);
});

console.log(`\n${passed} tests OK`);
