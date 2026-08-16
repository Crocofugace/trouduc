// Simulation massive du moteur avec les bots heuristiques, à 4, 5 et 6 joueurs,
// et sur les trois niveaux de difficulté (easy/normal/hard) pour valider [D10].
import * as E from "../src/engine/president.js";

let totalGames = 0;
for (const level of ["easy", "normal", "hard"]) {
  for (const n of [4, 5, 6]) {
    let stats = { rounds: 0, moves: 0, revolutions: 0, offOpen: 0, offResp: 0 };
    const seeds = level === "normal" ? 200 : 60; // couverture complète en normal, sondage sur les extrêmes
    for (let s = 1; s <= seeds; s++) {
      const g = E.newGame(n, 5);
      for (let r = 0; r < 5; r++) {
        const ex = E.dealRound(g);
        if (ex) E.applyExchanges(g);
        const sizes = g.hands.map(h => h.length);
        if (sizes.reduce((a, b) => a + b) !== 52) throw new Error("total != 52");
        if (Math.max(...sizes) - Math.min(...sizes) > 1) throw new Error(`écart de mains > 1: ${sizes}`);
        let mv = 0;
        while (g.phase === "PLI_OUVERTURE" || g.phase === "PLI_REPONSE") {
          if (++mv > 4000) throw new Error(`boucle infinie level=${level} n=${n} seed=${s}`);
          const p = g.turn, phase = g.phase;
          const legal = E.legalMoves(g, p);
          if (phase === "PLI_REPONSE" && legal.some(m => m.offense)) throw new Error("offense en réponse !");
          const m = E.botMove(g, p, level);
          const chosen = m.type === "play" ? legal.find(l => l.type === "play" && l.rank === m.cards[0].rank && l.count === m.cards.length) : null;
          const revB = g.revolution;
          if (chosen && chosen.offense) (phase === "PLI_OUVERTURE" ? stats.offOpen++ : stats.offResp++);
          E.applyMove(g, p, m);
          if (g.revolution !== revB) stats.revolutions++;
          stats.moves++;
        }
        const t = g.titles.slice().sort((a, b) => a - b).join();
        if (t !== Array.from({ length: n }, (_, i) => i).join()) throw new Error(`titres invalides: ${g.titles}`);
        stats.rounds++;
      }
      if (g.phase !== "PARTIE_FINIE") throw new Error("partie non finie");
      const expect = 5 * n * (n - 1) / 2;
      if (g.scores.reduce((a, b) => a + b) !== expect) throw new Error(`scores incohérents: ${g.scores}`);
      totalGames++;
    }
    console.log(`${level} n=${n} → ${JSON.stringify(stats)}`);
    if (stats.offResp !== 0) throw new Error("régression D5");
  }
}
console.log(`OK — ${totalGames} parties simulées (4/5/6 joueurs × easy/normal/hard) sans erreur`);
