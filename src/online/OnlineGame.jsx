import { useState, useRef, useEffect } from "react";
import { legalMoves } from "../engine/president.js";
import {
  C, MARKER, SANS, nameOf, SEATS, TURN_TIME,
  Sticker, Card, Tag, HierarchyStrip, Btn, Shell,
} from "../ui/shared.jsx";

// Reconstruit un état moteur minimal pour calculer nos propres coups légaux côté client
// (retour visuel immédiat — la légalité réelle est de toute façon revérifiée par le serveur).
function fakeG(state, mySeat) {
  return {
    phase: state.phase,
    turn: state.turn,
    revolution: state.revolution,
    mustIncludeThreeClubs: state.mustIncludeThreeClubs,
    hands: Object.assign([], { [mySeat]: state.myHand }),
    trick: state.trick ? { ...state.trick, passed: new Set(state.trick.passed) } : null,
  };
}

export default function OnlineGame({ state, socket, code, playerId, onExitToMenu, sfx, musicOn, sfxOn, toggleMusic, toggleSfx }) {
  const mySeat = state.me;
  const [selected, setSelected] = useState([]);
  const [announce, setAnnounce] = useState(null);
  const [revShow, setRevShow] = useState(false);
  const [fly, setFly] = useState(null);
  const [note, setNote] = useState("");
  const [timeLeft, setTimeLeft] = useState(null);
  const [view, setView] = useState("play"); // play | roundEnd | standings
  const prevRef = useRef({ revolution: state.revolution, winSeq: state.winSeq });
  const ceremonyRound = useRef(0);
  const autoPassedMoveSeq = useRef(-1);

  // Réinitialise la sélection de cartes quand la main change vraiment (nouveau tour, nouvelle manche).
  useEffect(() => { setSelected([]); }, [state.round, state.phase]);

  // Animations/sons déclenchés par les changements d'état reçus du serveur.
  useEffect(() => {
    const prev = prevRef.current;
    if (state.revolution !== prev.revolution) {
      sfx("revolution");
      setRevShow(true);
      setTimeout(() => setRevShow(false), 1500);
    }
    if (state.winSeq !== prev.winSeq && state.lastTrickPile && state.lastTrickPile.length > 0) {
      sfx("trick");
      const winningPlay = state.lastTrickPile.filter(pl => pl.player === state.lastWinner).slice(-1);
      setAnnounce({ winner: state.lastWinner });
      setFly({ pile: winningPlay, to: SEATS[state.n][state.lastWinner], go: false });
      setTimeout(() => setFly(f => (f ? { ...f, go: true } : null)), 60);
      setTimeout(() => { setAnnounce(null); setFly(null); }, 1250);
    }
    prevRef.current = { revolution: state.revolution, winSeq: state.winSeq };
  }, [state.revolution, state.winSeq]); // eslint-disable-line

  useEffect(() => {
    if (state.phase !== "MANCHE_FINIE" && state.phase !== "PARTIE_FINIE") { setView("play"); return; }
    setView("roundEnd");
    if (ceremonyRound.current === state.round) return;
    ceremonyRound.current = state.round;
    sfx("fanfare");
    const t = setTimeout(() => sfx("wahwah"), 1300);
    const t2 = setTimeout(() => setView(v => (v === "roundEnd" ? "standings" : v)), 2600);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, [state.phase, state.round]); // eslint-disable-line

  useEffect(() => {
    if (state.phase !== "PARTIE_FINIE" || view !== "standings") return;
    const t = setTimeout(() => onExitToMenu(), 8000);
    return () => clearTimeout(t);
  }, [state.phase, view]); // eslint-disable-line

  // Compte à rebours de tour.
  useEffect(() => {
    if (!state.turnDeadline || (state.phase !== "PLI_OUVERTURE" && state.phase !== "PLI_REPONSE")) { setTimeLeft(null); return; }
    const update = () => setTimeLeft(Math.max(0, (state.turnDeadline - Date.now()) / 1000));
    update();
    const iv = setInterval(update, 100);
    return () => clearInterval(iv);
  }, [state.turnDeadline, state.phase]);

  const myTurn = (state.phase === "PLI_OUVERTURE" || state.phase === "PLI_REPONSE") && state.turn === mySeat;
  const humanLegal = myTurn ? legalMoves(fakeG(state, mySeat), mySeat) : [];
  const humanPlays = humanLegal.filter(m => m.type === "play");
  const canPass = humanLegal.some(m => m.type === "pass");
  const mustAutoPass = humanLegal.length > 0 && humanPlays.length === 0;

  useEffect(() => {
    if (!mustAutoPass || autoPassedMoveSeq.current === state.moveSeq) return;
    autoPassedMoveSeq.current = state.moveSeq;
    setNote("Rien à jouer — tu passes");
    const t = setTimeout(() => pass(), 900);
    return () => clearTimeout(t);
  }, [mustAutoPass, state.moveSeq]); // eslint-disable-line

  const selCards = state.myHand.filter(c => selected.includes(c.id));
  const selRank = selCards.length ? selCards[0].rank : null;
  const canPlay = selCards.length > 0 && selCards.every(c => c.rank === selRank) &&
    humanPlays.some(m => m.rank === selRank && m.count === selCards.length) &&
    (!state.mustIncludeThreeClubs || selCards.some(c => c.rank === 3 && c.suit === 0));

  const toggleCard = id => {
    sfx("select");
    const card = state.myHand.find(c => c.id === id);
    setSelected(sel => {
      if (sel.includes(id)) return sel.filter(x => x !== id);
      if (state.phase === "ECHANGES") {
        const max = state.exchangeRole === "P" ? 2 : 1;
        return [...sel, id].slice(-max);
      }
      const cur = state.myHand.filter(c => sel.includes(c.id));
      if (cur.length && cur[0].rank !== card.rank) return [id];
      return [...sel, id];
    });
  };

  const playSelection = () => {
    if (!canPlay) return;
    sfx("card");
    socket.emit("playCards", { code, playerId, cardIds: selected }, (res) => {
      if (res && res.error) setNote(res.error); else setSelected([]);
    });
  };
  const pass = () => {
    if (!canPass) return;
    sfx("pass");
    socket.emit("pass", { code, playerId }, (res) => {
      if (res && res.error) setNote(res.error); else setSelected([]);
    });
  };
  const confirmExchange = () => {
    const need = state.exchangeRole === "P" ? 2 : 1;
    if (selected.length !== need) return;
    socket.emit("exchangeChoice", { code, playerId, cardIds: selected }, (res) => {
      if (res && res.error) setNote(res.error); else setSelected([]);
    });
  };

  /* ---- ÉCHANGE ---- */
  if (state.phase === "ECHANGES") {
    if (!state.exchangeRole) {
      return (
        <Shell musicOn={musicOn} sfxOn={sfxOn} onToggleMusic={toggleMusic} onToggleSfx={toggleSfx}>
          <div style={{ maxWidth: 420, width: "100%", textAlign: "center", marginTop: 60 }}>
            <div style={{ fontFamily: MARKER, fontSize: 22, color: C.fluo }}>Échange de cartes</div>
            <p style={{ color: C.dim, fontSize: 14, fontWeight: 600 }}>Les échanges entre Boss/Trouduc et Vice-Boss/Vice-Trouduc sont en cours...</p>
          </div>
        </Shell>
      );
    }
    const need = state.exchangeRole === "P" ? 2 : 1;
    return (
      <Shell musicOn={musicOn} sfxOn={sfxOn} onToggleMusic={toggleMusic} onToggleSfx={toggleSfx}>
        <div style={{ maxWidth: 460, width: "100%", textAlign: "center", marginTop: 24 }}>
          <div style={{ display: "flex", justifyContent: "center" }}><Sticker p={mySeat % 6} size={54} /></div>
          <div style={{ fontFamily: MARKER, fontSize: 24, color: C.fluo, transform: "rotate(-2deg)", margin: "10px 0 4px" }}>
            {state.exchangeRole === "P" ? "T'ES LE BOSS" : "VICE-BOSS"}
          </div>
          <p style={{ color: C.dim, fontSize: 14, fontWeight: 600 }}>
            {state.exchangeRole === "P"
              ? "Lâche 2 cartes au Trouduc. Ses 2 meilleures sont déjà dans ta poche."
              : "Lâche 1 carte au Vice-Trouduc. Sa meilleure est déjà à toi."}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", margin: "16px 0" }}>
            {state.myHand.map(c => (
              <Card key={c.id} card={c} selected={selected.includes(c.id)} onClick={() => toggleCard(c.id)} />
            ))}
          </div>
          <Btn label={need === 2 ? "Lâcher ces 2 cartes" : "Lâcher cette carte"} onClick={confirmExchange} disabled={selected.length !== need} />
          {note && <p style={{ color: C.pink, fontWeight: 700, marginTop: 10 }}>{note}</p>}
        </div>
      </Shell>
    );
  }

  /* ---- FIN DE MANCHE ---- */
  if (view === "roundEnd") {
    const order = Array.from({ length: state.n }, (_, p) => p).sort((a, b) => state.titles[a] - state.titles[b]);
    const label = (t) => t === 0 ? "LE BOSS" : t === 1 ? "VICE-BOSS" : t === state.n - 1 ? "TROUDUC" : t === state.n - 2 ? "VICE-TROUDUC" : "DANS LE VENT";
    return (
      <Shell musicOn={musicOn} sfxOn={sfxOn} onToggleMusic={toggleMusic} onToggleSfx={toggleSfx}>
        <div style={{ maxWidth: 450, width: "100%", textAlign: "center", marginTop: 22 }}>
          <div style={{ fontFamily: MARKER, fontSize: 15, color: C.dim }}>manche {state.round}/{state.numRounds}</div>
          <div style={{ height: 16 }} />
          {order.map(p => {
            const t = state.titles[p];
            const isP = t === 0, isTdc = t === state.n - 1;
            return (
              <div key={p} style={{
                position: "relative", display: "flex", alignItems: "center", gap: 10,
                padding: "9px 13px", marginBottom: 8, borderRadius: 6,
                background: isP ? C.fluo : isTdc ? C.pink : C.off,
                border: "3px solid #fff", outline: `2px solid ${C.ink}`,
                boxShadow: "3px 3px 0 rgba(0,0,0,.6)", transform: `rotate(${p % 2 ? 0.8 : -0.8}deg)`,
              }}>
                <Sticker p={p % 6} size={34} dead={isTdc} />
                <span style={{
                  fontFamily: MARKER, fontSize: isP || isTdc ? 17 : 15, color: C.ink, flex: 1, textAlign: "left",
                  textDecoration: isTdc ? "line-through" : "none",
                }}>{state.players[p]?.name || nameOf(p % 6)}</span>
                <span style={{ fontFamily: MARKER, fontSize: 12, color: C.ink }}>{label(t)}</span>
                <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 15, color: C.ink }}>+{state.n - 1 - t}</span>
              </div>
            );
          })}
          {state.offenders.length > 0 && (
            <div style={{
              fontFamily: MARKER, color: C.ink, background: C.orange, borderRadius: 6, padding: "7px 12px",
              fontSize: 14, margin: "6px 0 12px", border: "3px solid #fff", outline: `2px solid ${C.ink}`,
              boxShadow: "3px 3px 0 rgba(0,0,0,.6)", transform: "rotate(-1deg)",
            }}>
              {state.offenders.map(p => state.players[p]?.name || nameOf(p % 6)).join(", ")} a fini sur un 2 : Trouduc direct !
            </div>
          )}
          <div style={{ marginTop: 12 }}><Btn label="Le mur des scores →" onClick={() => setView("standings")} rot={1} /></div>
        </div>
      </Shell>
    );
  }

  if (view === "standings") {
    const finished = state.phase === "PARTIE_FINIE";
    const players = Array.from({ length: state.n }, (_, p) => p);
    const byScore = scores => players.slice().sort((a, b) => scores[b] - scores[a] || state.titles[a] - state.titles[b]);
    const order = byScore(state.scores);
    return (
      <Shell musicOn={musicOn} sfxOn={sfxOn} onToggleMusic={toggleMusic} onToggleSfx={toggleSfx}>
        <div style={{ maxWidth: 440, width: "100%", textAlign: "center", marginTop: 24 }}>
          <div style={{ fontFamily: "'Permanent Marker',cursive", fontSize: 26, color: "#ECEFF1", transform: "rotate(-2deg)", textShadow: "3px 3px 0 #1A1A1E" }}>
            {finished ? "LE MUR FINAL" : "LE MUR DES SCORES"} <span style={{ color: "#FF3D8A" }}>↓</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "16px 0" }}>
            {order.map((p, idx) => (
              <div key={p} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 6,
                background: idx === 0 ? "#CCFF00" : "#ECEFF1", border: "3px solid #fff", outline: "2px solid #1A1A1E",
                boxShadow: "3px 3px 0 rgba(0,0,0,.6)", transform: `rotate(${p % 2 ? 1 : -1}deg)`,
              }}>
                <span style={{ fontFamily: "'Permanent Marker',cursive", fontSize: 17, color: "#1A1A1E", width: 30, textAlign: "left" }}>#{idx + 1}</span>
                <Sticker p={p % 6} size={30} />
                <span style={{ fontFamily: "'Permanent Marker',cursive", fontSize: 15, color: "#1A1A1E", flex: 1, textAlign: "left" }}>
                  {finished && idx === 0 ? "★ " : ""}{state.players[p]?.name || nameOf(p % 6)}
                </span>
                <span style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 700, fontSize: 16, color: "#1A1A1E" }}>{state.scores[p]}pts</span>
              </div>
            ))}
          </div>
          <p style={{ fontFamily: MARKER, color: C.dim, fontSize: 14 }}>
            {finished ? "Retour au menu dans quelques secondes..." : "Manche suivante dans quelques secondes..."}
          </p>
          <div style={{ marginTop: 10 }}><Btn label="Quitter" onClick={onExitToMenu} alt /></div>
        </div>
      </Shell>
    );
  }

  /* ---- TABLE DE JEU ---- */
  const seats = SEATS[state.n];
  const lastPlay = state.trick ? state.trick.pile[state.trick.pile.length - 1] : null;
  const playableRanks = new Set(humanPlays.map(m => m.rank));
  return (
    <Shell musicOn={musicOn} sfxOn={sfxOn} onToggleMusic={toggleMusic} onToggleSfx={toggleSfx}>
      <div style={{ maxWidth: 500, width: "100%", display: "flex", flexDirection: "column", flex: 1 }}>
        {revShow && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 60, background: C.wall,
            backgroundImage: "repeating-conic-gradient(from 0deg at 50% 50%, #CCFF0014 0deg 5deg, transparent 5deg 14deg)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12,
          }}>
            <div style={{ fontFamily: MARKER, fontSize: 46, color: C.fluo, transform: "rotate(-6deg)", textShadow: `4px 4px 0 ${C.ink}` }}>RÉVOLUTION !</div>
            <div style={{ fontFamily: MARKER, fontSize: 17, color: C.pink, transform: "rotate(-2deg)" }}>
              {state.revolution ? "le mur est repeint — tout est inversé" : "contre-révolution — retour à l'ordre"}
            </div>
          </div>
        )}
        {state.revolution && !revShow && (
          <div style={{
            textAlign: "center", padding: "4px 0", marginBottom: 6, borderRadius: 6,
            background: C.pink, color: C.ink, fontFamily: MARKER, fontSize: 14,
            border: "2px solid #fff", outline: `2px solid ${C.ink}`, transform: "rotate(-0.6deg)",
          }}>révolution en cours — tout est inversé</div>
        )}
        <HierarchyStrip rev={state.revolution} />

        <div style={{
          position: "relative", height: "min(46vh, 380px)", minHeight: 300, margin: "10px 0 6px",
          borderRadius: 12, background: C.panel, border: `2px solid ${C.panelLine}`,
          boxShadow: "inset 0 0 34px rgba(0,0,0,.4)",
        }}>
          {seats.map(([x, y], p) => {
            const active = state.turn === p && !announce && !revShow && (state.phase === "PLI_OUVERTURE" || state.phase === "PLI_REPONSE");
            const passed = state.trick && state.trick.passed.includes(p);
            const out = state.handCounts[p] === 0;
            const won = announce && announce.winner === p;
            const pname = state.players[p]?.name || nameOf(p % 6);
            return (
              <div key={p} style={{
                position: "absolute", left: `${x}%`, top: `${y}%`, transform: "translate(-50%,-50%)",
                textAlign: "center", zIndex: 2, opacity: out && !won ? 0.55 : 1,
                animation: won ? "shake .3s 2" : "none",
              }}>
                <div style={{ display: "inline-block", borderRadius: 12, padding: 3, animation: active ? "pulseFluo 1.1s infinite" : "none" }}>
                  <Sticker p={p % 6} size={40} dead={passed && !out} />
                </div>
                <div style={{
                  marginTop: 3, fontFamily: MARKER, fontSize: 12, borderRadius: 4, padding: "1px 8px",
                  background: won || active ? C.fluo : "rgba(26,26,30,.65)", color: won || active ? C.ink : C.off,
                  transform: `rotate(${p % 2 ? 1.5 : -1.5}deg)`,
                }}>
                  {won ? "★ " : ""}{pname}{!state.players[p]?.connected ? " 🔌" : ""}
                </div>
                <div style={{ fontSize: 10.5, color: C.dim, fontWeight: 700, marginTop: 1 }}>
                  {out ? "sorti" : passed ? "passe" : `${state.handCounts[p]} cartes`}
                </div>
              </div>
            );
          })}

          <div style={{ position: "absolute", left: "50%", top: "48%", transform: "translate(-50%,-50%)", textAlign: "center", zIndex: 1, width: "62%" }}>
            {announce ? (
              <div style={{ animation: "slapIn .3s both" }}>
                <Tag text="PLI CHOPÉ !" bg={C.fluo} rotate={-6} size={22} />
                <div style={{ fontWeight: 700, fontSize: 13, color: C.off, marginTop: 8 }}>
                  {state.players[announce.winner]?.name || nameOf(announce.winner % 6)} ramasse
                </div>
              </div>
            ) : state.trick ? (
              <>
                <div style={{ fontSize: 11.5, color: C.dim, fontWeight: 700, marginBottom: 5 }}>
                  Pli en {["", "simple", "paire", "brelan", "carré"][state.trick.count]}
                </div>
                <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                  {lastPlay.cards.map(c => <Card key={c.id} card={c} small />)}
                </div>
                <div style={{ fontSize: 11.5, color: C.dim, fontWeight: 700, marginTop: 4 }}>
                  par {state.players[lastPlay.player]?.name || nameOf(lastPlay.player % 6)}
                </div>
              </>
            ) : (
              <div style={{ color: C.dim, fontSize: 13.5, fontWeight: 700 }}>
                {state.turn === mySeat ? "À toi d'ouvrir" : `${state.players[state.turn]?.name || nameOf(state.turn % 6)} ouvre…`}
                {state.mustIncludeThreeClubs && state.turn === mySeat && <div style={{ color: C.fluo, marginTop: 3, fontFamily: MARKER }}>avec le 3♣</div>}
              </div>
            )}
          </div>

          {fly && (
            <div style={{
              position: "absolute", zIndex: 3, display: "flex", gap: 4, pointerEvents: "none",
              left: fly.go ? `${fly.to[0]}%` : "50%", top: fly.go ? `${fly.to[1]}%` : "48%",
              transform: `translate(-50%,-50%) scale(${fly.go ? 0.35 : 1}) rotate(${fly.go ? -14 : 0}deg)`, opacity: fly.go ? 0 : 1,
              transition: "left .9s ease-in, top .9s ease-in, transform .9s, opacity .9s",
            }}>
              {fly.pile.flatMap(pl => pl.cards).map(c => <Card key={c.id} card={c} small />)}
            </div>
          )}
        </div>

        <div style={{ textAlign: "center", fontSize: 13.5, minHeight: 20, fontFamily: MARKER, color: note ? C.pink : C.fluo }}>
          {note || (announce || revShow ? "" : state.turn === mySeat ? "à toi de jouer" : <span style={{ color: C.dim }}>{state.players[state.turn]?.name || nameOf(state.turn % 6)} cogite…</span>)}
        </div>

        <div style={{ height: 6, borderRadius: 3, background: C.panel, margin: "6px 0 10px", overflow: "hidden", border: `1px solid ${C.panelLine}` }}>
          {myTurn && !announce && !revShow && !mustAutoPass && timeLeft !== null && (
            <div style={{ height: "100%", width: `${(timeLeft / TURN_TIME) * 100}%`, background: timeLeft < 5 ? C.pink : C.fluo, transition: "width .1s linear" }} />
          )}
        </div>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 10 }}>
          <Btn label="JOUER" onClick={playSelection} disabled={!canPlay} rot={-1} />
          <Btn label="PASSER" onClick={pass} disabled={!canPass} alt rot={1} />
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, justifyContent: "center" }}>
          {state.myHand.map(c => {
            const faded = myTurn && !announce && !revShow && playableRanks.size > 0 && !playableRanks.has(c.rank);
            return <Card key={c.id} card={c} selected={selected.includes(c.id)} faded={faded} onClick={() => toggleCard(c.id)} />;
          })}
          {state.myHand.length === 0 && (
            <div style={{ fontFamily: MARKER, color: C.fluo, fontSize: 15 }}>Sorti ! La bande continue sans toi…</div>
          )}
        </div>
        <div style={{ textAlign: "center", marginTop: 12, fontSize: 12, color: C.dim, fontWeight: 700 }}>
          Manche {state.round}/{state.numRounds} · {state.n} joueurs · salon {state.code}
        </div>
      </div>
    </Shell>
  );
}
