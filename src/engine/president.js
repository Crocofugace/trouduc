/* ================= MOTEUR v2 — 4/5/6 joueurs ================= */
const SUITS = ["♣", "♦", "♥", "♠"];
const RANK_LABEL = r => (r <= 10 ? String(r) : { 11: "V", 12: "D", 13: "R", 14: "A", 15: "2" }[r]);
const titleLabel = (i, n) =>
  i === 0 ? "Président" : i === 1 ? "Vice-Président" : i === n - 1 ? "Trou du cul" : i === n - 2 ? "Vice-Trou du cul" : "Neutre";
const titleEmoji = (i, n) => (i === 0 ? "👑" : i === 1 ? "🎩" : i === n - 1 ? "💩" : i === n - 2 ? "🩴" : "😐");

function makeDeck() {
  const d = [];
  for (let r = 3; r <= 15; r++) for (let s = 0; s < 4; s++) d.push({ rank: r, suit: s, id: (r - 3) * 4 + s });
  return d;
}
function shuffle(deck) {
  const a = deck.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const strongestRank = rev => (rev ? 3 : 15);
const beats = (a, b, rev) => (rev ? a < b : a > b);
const sortHand = h => h.sort((a, b) => a.rank - b.rank || a.suit - b.suit);

function newGame(numPlayers, numRounds) {
  return {
    n: numPlayers, numRounds, round: 0, scores: Array(numPlayers).fill(0),
    lastTitles: null, phase: "INIT", hands: Array.from({ length: numPlayers }, () => []),
    moveSeq: 0, winSeq: 0,
  };
}

function dealRound(g) {
  g.round += 1;
  const deck = shuffle(makeDeck());
  g.hands = Array.from({ length: g.n }, () => []);
  const offset = Math.floor(Math.random() * g.n); // qui reçoit les cartes en trop varie
  deck.forEach((c, i) => g.hands[(i + offset) % g.n].push(c));
  g.hands.forEach(sortHand);
  g.revolution = false;
  g.finishOrder = [];
  g.offenders = [];
  g.trick = null;
  g.titles = null;
  g.lastExchange = null;
  g.scoresBefore = g.scores.slice();
  if (g.round === 1) {
    g.turn = g.hands.findIndex(h => h.some(c => c.rank === 3 && c.suit === 0));
    g.mustIncludeThreeClubs = true;
    g.phase = "PLI_OUVERTURE";
    return false;
  }
  g.phase = "ECHANGES";
  return true;
}

// [D8] échanges gradués : P↔TDC 2 cartes, VP↔VTDC 1 carte, neutres non concernés
function applyExchanges(g, choices = {}) {
  const idxOf = t => g.lastTitles.indexOf(t);
  const pres = idxOf(0), vp = idxOf(1), vtdc = idxOf(g.n - 2), tdc = idxOf(g.n - 1);
  const best = (h, k) => h.slice().sort((a, b) => b.rank - a.rank || b.suit - a.suit).slice(0, k);
  const worst = (h, k) => h.slice().sort((a, b) => a.rank - b.rank || a.suit - b.suit).slice(0, k);
  const pick = (h, ids) => h.filter(c => ids.includes(c.id));
  const presGives = choices.presidentGives ? pick(g.hands[pres], choices.presidentGives) : worst(g.hands[pres], 2);
  const vpGives = choices.vicePresidentGives ? pick(g.hands[vp], choices.vicePresidentGives) : worst(g.hands[vp], 1);
  const tdcGives = best(g.hands[tdc], 2);
  const vtdcGives = best(g.hands[vtdc], 1);
  const transfer = (from, to, cards) => {
    const ids = new Set(cards.map(c => c.id));
    g.hands[to].push(...g.hands[from].filter(c => ids.has(c.id)));
    g.hands[from] = g.hands[from].filter(c => !ids.has(c.id));
    sortHand(g.hands[to]);
  };
  transfer(tdc, pres, tdcGives);
  transfer(pres, tdc, presGives);
  transfer(vtdc, vp, vtdcGives);
  transfer(vp, vtdc, vpGives);
  g.lastExchange = { tdcGave: tdcGives, presGave: presGives, vtdcGave: vtdcGives, vpGave: vpGives, pres, tdc, vp, vtdc };
  g.turn = tdc; // [D3]
  g.mustIncludeThreeClubs = false;
  g.phase = "PLI_OUVERTURE";
}

const playersWithCards = g => Array.from({ length: g.n }, (_, p) => p).filter(p => g.hands[p].length > 0);

function legalMoves(g, p) {
  if ((g.phase !== "PLI_OUVERTURE" && g.phase !== "PLI_REPONSE") || p !== g.turn) return [];
  const hand = g.hands[p];
  const byRank = {};
  hand.forEach(c => { (byRank[c.rank] = byRank[c.rank] || []).push(c); });
  const opening = g.phase === "PLI_OUVERTURE";
  const moves = [];
  for (const r of Object.keys(byRank).map(Number)) {
    const cards = byRank[r];
    const counts = opening ? [1, 2, 3, 4].filter(k => k <= cards.length) : (g.trick.count <= cards.length ? [g.trick.count] : []);
    for (const k of counts) {
      if (!opening && !beats(r, g.trick.rank, g.revolution)) continue;
      let sel = cards.slice(0, k);
      if (opening && g.mustIncludeThreeClubs) {
        if (r !== 3) continue;
        const tc = cards.find(c => c.suit === 0);
        if (!sel.includes(tc)) sel = [tc, ...cards.filter(c => c !== tc)].slice(0, k);
      }
      moves.push({ type: "play", cards: sel, rank: r, count: k });
    }
  }
  const isOffense = m => !g.revolution && m.rank === 15 && m.count === hand.length;
  let result;
  if (opening) {
    // [D5] à l'ouverture : filtrer si alternative, sinon coup forcé marqué offense
    const clean = moves.filter(m => !isOffense(m));
    result = clean.length > 0 ? clean : moves.map(m => ({ ...m, offense: true }));
  } else {
    // [D5 corrigé] en réponse, passer est toujours possible : finir sur un 2 est simplement interdit
    result = moves.filter(m => !isOffense(m));
    result.push({ type: "pass" });
  }
  return result;
}

function applyMove(g, p, move) {
  const legals = legalMoves(g, p);
  g.moveSeq++;
  if (move.type === "pass") {
    if (!legals.some(m => m.type === "pass")) throw new Error("Passe interdit à l'ouverture");
    g.trick.passed.add(p);
    advanceOrClose(g);
    return;
  }
  const rank = move.cards[0].rank, count = move.cards.length;
  if (!move.cards.every(c => c.rank === rank && g.hands[p].some(h => h.id === c.id))) throw new Error("Sélection invalide");
  const legal = legals.find(m => m.type === "play" && m.rank === rank && m.count === count);
  if (!legal) throw new Error("Coup illégal");
  if (g.mustIncludeThreeClubs && !move.cards.some(c => c.rank === 3 && c.suit === 0)) throw new Error("Le 3♣ doit ouvrir");
  const ids = new Set(move.cards.map(c => c.id));
  g.hands[p] = g.hands[p].filter(c => !ids.has(c.id));
  g.mustIncludeThreeClubs = false;
  if (g.phase === "PLI_OUVERTURE") g.trick = { count, rank, lastPlayer: p, passed: new Set(), pile: [] };
  else { g.trick.rank = rank; g.trick.lastPlayer = p; }
  g.trick.pile.push({ player: p, cards: move.cards });
  g.phase = "PLI_REPONSE";
  let closes = false;
  if (count === 4) { g.revolution = !g.revolution; closes = true; }
  if (!closes && rank === strongestRank(g.revolution)) closes = true;
  if (g.hands[p].length === 0) {
    g.finishOrder.push(p);
    if (legal.offense) g.offenders.push(p);
  }
  if (checkRoundEnd(g)) return;
  if (closes) closeTrick(g, p);
  else advanceOrClose(g);
}

function advanceOrClose(g) {
  const t = g.trick;
  const eligible = playersWithCards(g).filter(q => !t.passed.has(q) && q !== t.lastPlayer);
  if (eligible.length === 0) { closeTrick(g, t.lastPlayer); return; }
  let q = g.turn;
  for (let i = 0; i < g.n; i++) {
    q = (q + 1) % g.n;
    if (g.hands[q].length > 0 && !t.passed.has(q) && q !== t.lastPlayer) { g.turn = q; return; }
  }
  closeTrick(g, t.lastPlayer);
}

function closeTrick(g, winner) {
  g.lastTrickPile = g.trick ? g.trick.pile : null;
  g.lastWinner = winner;
  g.winSeq++;
  g.trick = null;
  let opener = winner;
  if (g.hands[opener].length === 0) {
    let q = opener;
    for (let i = 0; i < g.n; i++) { q = (q + 1) % g.n; if (g.hands[q].length > 0) { opener = q; break; } }
  }
  g.turn = opener;
  g.phase = "PLI_OUVERTURE";
}

function checkRoundEnd(g) {
  const withCards = playersWithCards(g);
  if (withCards.length > 1) return false;
  const nonOff = g.finishOrder.filter(p => !g.offenders.includes(p));
  const ranking = [...nonOff, ...withCards, ...g.offenders.slice().reverse()];
  g.titles = [];
  ranking.forEach((p, i) => { g.titles[p] = i; g.scores[p] += g.n - 1 - i; });
  g.lastTitles = g.titles;
  g.phase = g.round >= g.numRounds ? "PARTIE_FINIE" : "MANCHE_FINIE";
  return true;
}

/* ================= BOTS v2 ================= */
// [D10] niveaux de difficulté : easy = joue parfois un coup sous-optimal et brade sa carte
// maîtresse trop tôt ; hard = ne se trompe jamais et garde sa carte maîtresse le plus longtemps possible.
const SAVE_PASS_CHANCE = { easy: 0.15, normal: 0.55, hard: 0.85 };

function botMove(g, p, level = "normal") {
  const legal = legalMoves(g, p);
  const plays = legal.filter(m => m.type === "play");
  if (plays.length === 0) return { type: "pass" };
  const hand = g.hands[p];
  const byRank = {};
  hand.forEach(c => { byRank[c.rank] = (byRank[c.rank] || 0) + 1; });
  const strong = strongestRank(g.revolution);
  const endgame = hand.length <= 4;
  const cost = m => {
    let c = g.revolution ? 18 - m.rank : m.rank;
    if (m.rank === strong) c += endgame ? -6 : 9; // en fin de main : brader la carte maîtresse au lieu de rester coincé
    if (byRank[m.rank] > m.count) c += 4;
    if (m.count === 4 && hand.length > 6) c += 6;
    return c;
  };
  plays.sort((a, b) => cost(a) - cost(b));
  let best = plays[0];
  if (level === "easy" && plays.length > 1 && Math.random() < 0.4) {
    const pool = plays.slice(Math.ceil(plays.length / 2));
    best = pool[Math.floor(Math.random() * pool.length)];
  }
  const savePassChance = SAVE_PASS_CHANCE[level] ?? SAVE_PASS_CHANCE.normal;
  if (g.phase === "PLI_REPONSE" && best.rank === strong && hand.length > 5 && Math.random() < savePassChance) return { type: "pass" };
  return { type: "play", cards: best.cards };
}


export {
  newGame, dealRound, applyExchanges, legalMoves, applyMove, playersWithCards,
  strongestRank, beats, botMove, SUITS, RANK_LABEL, titleLabel, titleEmoji, makeDeck,
};
