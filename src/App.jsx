import { useState, useRef, useEffect, useCallback } from "react";
import * as Tone from "tone";
import {
  newGame, dealRound, applyExchanges, legalMoves, applyMove,
  botMove, SUITS, RANK_LABEL,
} from "./engine/president.js";
import { trackEvent } from "./analytics.js";
import {
  C, MARKER, SANS, PLAYERS_META, nameOf, SEATS, TURN_TIME,
  Sticker, Card, Tag, HierarchyStrip, Btn, Shell, createAudio,
} from "./ui/shared.jsx";

export default function Trouduc() {
  const gRef = useRef(null);
  const audioRef = useRef(null);
  const [, setTick] = useState(0);
  const [screen, setScreen] = useState("menu");
  const [selected, setSelected] = useState([]);
  const [numRounds, setNumRounds] = useState(5);
  const [numPlayers, setNumPlayers] = useState(4);
  const [botLevel, setBotLevel] = useState("normal");
  const [announce, setAnnounce] = useState(null);
  const [revShow, setRevShow] = useState(false);
  const [fly, setFly] = useState(null);
  const [timeLeft, setTimeLeft] = useState(TURN_TIME);
  const [note, setNote] = useState("");
  const [soundOn, setSoundOn] = useState(true);
  const seenWinSeq = useRef(0);
  const ceremonyPlayed = useRef(0);
  const gameFinishTracked = useRef(false);
  const rerender = useCallback(() => setTick(t => t + 1), []);
  const g = gRef.current;

  const sfx = name => { if (soundOn && audioRef.current) try { audioRef.current[name](); } catch (e) { } };
  const ensureAudio = async () => {
    if (audioRef.current) return;
    try {
      await Tone.start();
      audioRef.current = createAudio();
      if (soundOn) audioRef.current.musicStart();
    } catch (e) { }
  };
  const toggleSound = () => {
    setSoundOn(on => {
      const next = !on;
      if (audioRef.current) (next ? audioRef.current.musicStart() : audioRef.current.musicStop());
      return next;
    });
  };

  const humanExchangeRole = () => {
    if (!g || !g.lastTitles) return null;
    const t = g.lastTitles[0];
    return t === 0 ? "P" : t === 1 ? "VP" : null;
  };

  const cardStr = cards => cards.map(c => RANK_LABEL(c.rank) + SUITS[c.suit]).join(" ");
  const exchangeNote = () => {
    const ex = g.lastExchange;
    if (!ex) return "";
    if (ex.pres === 0) return `Échange : t'as donné ${cardStr(ex.presGave)}, reçu ${cardStr(ex.tdcGave)}`;
    if (ex.tdc === 0) return `Échange : t'as lâché ${cardStr(ex.tdcGave)}, reçu ${cardStr(ex.presGave)}`;
    if (ex.vp === 0) return `Échange : t'as donné ${cardStr(ex.vpGave)}, reçu ${cardStr(ex.vtdcGave)}`;
    if (ex.vtdc === 0) return `Échange : t'as lâché ${cardStr(ex.vtdcGave)}, reçu ${cardStr(ex.vpGave)}`;
    return "";
  };

  const startGame = async () => {
    await ensureAudio();
    gRef.current = newGame(numPlayers, numRounds);
    dealRound(gRef.current);
    seenWinSeq.current = 0;
    ceremonyPlayed.current = 0;
    gameFinishTracked.current = false;
    setSelected([]); setNote(""); setAnnounce(null); setFly(null); setRevShow(false);
    setScreen("play");
    trackEvent("game_started", { players: numPlayers, rounds: numRounds, bots: botLevel });
    rerender();
  };

  const nextRound = () => {
    const needsExchange = dealRound(g);
    setSelected([]); setNote(""); setAnnounce(null); setFly(null); setRevShow(false);
    if (needsExchange && humanExchangeRole()) setScreen("exchange");
    else if (needsExchange) { applyExchanges(g); setNote(exchangeNote()); setScreen("play"); }
    else setScreen("play");
    rerender();
  };

  const confirmExchange = () => {
    const role = humanExchangeRole();
    const need = role === "P" ? 2 : 1;
    if (selected.length !== need) return;
    applyExchanges(g, role === "P" ? { presidentGives: selected } : { vicePresidentGives: selected });
    setSelected([]);
    setNote(exchangeNote());
    setScreen("play");
    rerender();
  };

  const afterMove = revBefore => {
    if (g.revolution !== revBefore) {
      sfx("revolution");
      setRevShow(true);
      setTimeout(() => { setRevShow(false); rerender(); }, 1500);
    }
    if (g.winSeq !== seenWinSeq.current) {
      seenWinSeq.current = g.winSeq;
      if (g.lastTrickPile && g.lastTrickPile.length > 0) {
        sfx("trick");
        const winningPlay = g.lastTrickPile.filter(pl => pl.player === g.lastWinner).slice(-1);
        setAnnounce({ winner: g.lastWinner });
        setFly({ pile: winningPlay, to: SEATS[g.n][g.lastWinner], go: false });
        setTimeout(() => setFly(f => (f ? { ...f, go: true } : null)), 60);
        setTimeout(() => { setAnnounce(null); setFly(null); rerender(); }, 1250);
      }
    }
    rerender();
  };

  useEffect(() => {
    if (!g || screen !== "play" || announce || revShow) return;
    if (g.phase !== "PLI_OUVERTURE" && g.phase !== "PLI_REPONSE") {
      const t = setTimeout(() => setScreen("roundEnd"), 400);
      return () => clearTimeout(t);
    }
    if (g.turn === 0) return;
    const t = setTimeout(() => {
      const p = g.turn;
      const revB = g.revolution;
      const mv = botMove(g, p, botLevel);
      applyMove(g, p, mv);
      sfx(mv.type === "pass" ? "pass" : "card");
      afterMove(revB);
    }, 700);
    return () => clearTimeout(t);
  });

  useEffect(() => {
    if (screen !== "roundEnd" || !g || !g.titles) return;
    if (ceremonyPlayed.current === g.round) return;
    ceremonyPlayed.current = g.round;
    sfx("fanfare");
    const t = setTimeout(() => sfx("wahwah"), 1300);
    if (g.phase === "PARTIE_FINIE" && !gameFinishTracked.current) {
      gameFinishTracked.current = true;
      trackEvent("game_finished", { players: g.n, rounds: g.numRounds, bots: botLevel });
    }
    return () => clearTimeout(t);
  }, [screen]); // eslint-disable-line

  const humanLegal = g && screen === "play" && g.turn === 0 && !announce && !revShow ? legalMoves(g, 0) : [];
  const humanPlays = humanLegal.filter(m => m.type === "play");
  const canPass = humanLegal.some(m => m.type === "pass");
  const mustAutoPass = humanLegal.length > 0 && humanPlays.length === 0;

  useEffect(() => {
    if (!g || screen !== "play" || announce || revShow || g.turn !== 0) return;
    if (g.phase !== "PLI_OUVERTURE" && g.phase !== "PLI_REPONSE") return;
    if (mustAutoPass) {
      setNote("Rien à jouer — tu passes");
      const t = setTimeout(() => {
        const revB = g.revolution;
        applyMove(g, 0, { type: "pass" }); sfx("pass"); setSelected([]); afterMove(revB);
      }, 900);
      return () => clearTimeout(t);
    }
    setTimeLeft(TURN_TIME);
    const started = Date.now();
    const iv = setInterval(() => {
      const left = TURN_TIME - (Date.now() - started) / 1000;
      setTimeLeft(Math.max(0, left));
      if (left <= 0) {
        clearInterval(iv);
        const revB = g.revolution;
        if (canPass) { applyMove(g, 0, { type: "pass" }); sfx("pass"); }
        else { applyMove(g, 0, botMove(g, 0)); sfx("card"); }
        setSelected([]);
        setNote("Trop lent !");
        afterMove(revB);
      }
    }, 100);
    return () => clearInterval(iv);
  }, [g && g.moveSeq, screen, announce, revShow]); // eslint-disable-line

  const selCards = g ? g.hands[0].filter(c => selected.includes(c.id)) : [];
  const selRank = selCards.length ? selCards[0].rank : null;
  const canPlay = selCards.length > 0 && selCards.every(c => c.rank === selRank) &&
    humanPlays.some(m => m.rank === selRank && m.count === selCards.length) &&
    (!g?.mustIncludeThreeClubs || selCards.some(c => c.rank === 3 && c.suit === 0));

  const toggleCard = id => {
    const card = g.hands[0].find(c => c.id === id);
    setSelected(sel => {
      if (sel.includes(id)) return sel.filter(x => x !== id);
      if (screen === "exchange") {
        const max = humanExchangeRole() === "P" ? 2 : 1;
        return [...sel, id].slice(-max);
      }
      const cur = g.hands[0].filter(c => sel.includes(c.id));
      if (cur.length && cur[0].rank !== card.rank) return [id];
      return [...sel, id];
    });
  };

  const playSelection = () => {
    if (!canPlay) return;
    const revB = g.revolution;
    applyMove(g, 0, { type: "play", cards: selCards });
    sfx("card");
    setSelected([]); setNote("");
    afterMove(revB);
  };
  const pass = () => {
    if (!canPass) return;
    const revB = g.revolution;
    applyMove(g, 0, { type: "pass" });
    sfx("pass");
    setSelected([]); setNote("");
    afterMove(revB);
  };

  /* ---- MENU ---- */
  if (screen === "menu") return (
    <Shell soundOn={soundOn} onToggleSound={toggleSound}>
    <div style={{ maxWidth: 430, width: "100%", textAlign: "center", marginTop: 30 }}>
      <div style={{ fontFamily: MARKER, fontSize: 52, color: C.fluo, transform: "rotate(-3deg)", lineHeight: 1, textShadow: `3px 3px 0 ${C.ink}` }}>
        TROUDUC
      </div>
      <div style={{ fontFamily: MARKER, fontSize: 16, color: C.pink, transform: "rotate(-1deg)", margin: "6px 0 20px" }}>
        le vrai jeu du Président
      </div>
      <div style={{ fontFamily: MARKER, fontSize: 14, color: C.dim, marginBottom: 10 }}>tes adversaires</div>
      <div style={{ display: "flex", justifyContent: "center", gap: 14, marginBottom: 24 }}>
        {[1, 2, 3, 4, 5].map(p => (
          <div key={p} style={{ textAlign: "center" }}>
            <Sticker p={p} size={42} />
            <div style={{ fontFamily: MARKER, fontSize: 11, color: C.dim, marginTop: 6 }}>{nameOf(p)}</div>
          </div>
        ))}
      </div>
      <div style={{ fontFamily: MARKER, fontSize: 14, color: C.dim, marginBottom: 8 }}>joueurs à table</div>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 18 }}>
        {[4, 5, 6].map(n => (
          <button key={n} onClick={() => setNumPlayers(n)} style={{
            padding: "9px 22px", borderRadius: 6, fontFamily: MARKER, fontSize: 16, cursor: "pointer",
            border: "3px solid #fff", outline: `2px solid ${C.ink}`,
            background: numPlayers === n ? C.cyan : C.panel, color: numPlayers === n ? C.ink : C.dim,
            boxShadow: "2.5px 2.5px 0 rgba(0,0,0,.6)", transform: `rotate(${n % 2 ? -1.5 : 1.5}deg)`,
          }}>{n}</button>
        ))}
      </div>
      <div style={{ fontFamily: MARKER, fontSize: 14, color: C.dim, marginBottom: 8 }}>manches</div>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 26 }}>
        {[3, 5, 10].map(n => (
          <button key={n} onClick={() => setNumRounds(n)} style={{
            padding: "9px 20px", borderRadius: 6, fontFamily: MARKER, fontSize: 16, cursor: "pointer",
            border: "3px solid #fff", outline: `2px solid ${C.ink}`,
            background: numRounds === n ? C.cyan : C.panel, color: numRounds === n ? C.ink : C.dim,
            boxShadow: "2.5px 2.5px 0 rgba(0,0,0,.6)", transform: `rotate(${n % 2 ? 1.5 : -1.5}deg)`,
          }}>{n}</button>
        ))}
      </div>
      <div style={{ fontFamily: MARKER, fontSize: 14, color: C.dim, marginBottom: 8 }}>niveau des bots</div>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 26 }}>
        {[["easy", "Facile"], ["normal", "Normal"], ["hard", "Difficile"]].map(([lvl, label]) => (
          <button key={lvl} onClick={() => setBotLevel(lvl)} style={{
            padding: "9px 18px", borderRadius: 6, fontFamily: MARKER, fontSize: 15, cursor: "pointer",
            border: "3px solid #fff", outline: `2px solid ${C.ink}`,
            background: botLevel === lvl ? C.cyan : C.panel, color: botLevel === lvl ? C.ink : C.dim,
            boxShadow: "2.5px 2.5px 0 rgba(0,0,0,.6)", transform: `rotate(${lvl === "normal" ? 0 : lvl === "easy" ? -1.5 : 1.5}deg)`,
          }}>{label}</button>
        ))}
      </div>
      <Btn label="ON DISTRIBUE !" onClick={startGame} big rot={-2} />
      <div style={{
        marginTop: 28, fontSize: 12.5, color: C.dim, lineHeight: 1.65, textAlign: "left",
        background: C.panel, border: `2px solid ${C.panelLine}`, borderRadius: 8, padding: "12px 14px",
        fontWeight: 600, transform: "rotate(-0.5deg)",
      }}>
        Les règles du mur : le 3♣ ouvre la 1re manche · le 2 clôt le pli · un carré = RÉVOLUTION, tout s'inverse
        jusqu'à la fin de la manche · interdit de finir sur un 2 (Trouduc direct) · le Trouduc ouvre les manches
        suivantes · échanges 2 cartes (Boss↔Trouduc) et 1 carte (Vice↔Vice) · {TURN_TIME} s par tour.
      </div>
    </div>
    </Shell>
  );

  if (!g) return null;
  const seats = SEATS[g.n];

  /* ---- ÉCHANGE ---- */
  if (screen === "exchange") {
    const role = humanExchangeRole();
    const need = role === "P" ? 2 : 1;
    return (
      <Shell soundOn={soundOn} onToggleSound={toggleSound}>
      <div style={{ maxWidth: 460, width: "100%", textAlign: "center", marginTop: 24 }}>
        <div style={{ display: "flex", justifyContent: "center" }}><Sticker p={0} size={54} /></div>
        <div style={{ fontFamily: MARKER, fontSize: 24, color: C.fluo, transform: "rotate(-2deg)", margin: "10px 0 4px" }}>
          {role === "P" ? "T'ES LE BOSS" : "VICE-BOSS"}
        </div>
        <p style={{ color: C.dim, fontSize: 14, fontWeight: 600 }}>
          {role === "P"
            ? "Lâche 2 cartes au Trouduc. Ses 2 meilleures sont déjà dans ta poche."
            : "Lâche 1 carte au Vice-Trouduc. Sa meilleure est déjà à toi."}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", margin: "16px 0" }}>
          {g.hands[0].map(c => (
            <Card key={c.id} card={c} selected={selected.includes(c.id)} onClick={() => toggleCard(c.id)} />
          ))}
        </div>
        <Btn label={need === 2 ? "Lâcher ces 2 cartes" : "Lâcher cette carte"} onClick={confirmExchange} disabled={selected.length !== need} />
      </div>
      </Shell>
    );
  }

  /* ---- FIN DE MANCHE ---- */
  if (screen === "roundEnd") {
    const order = Array.from({ length: g.n }, (_, p) => p).sort((a, b) => g.titles[a] - g.titles[b]);
    const label = (t) => t === 0 ? "LE BOSS" : t === 1 ? "VICE-BOSS" : t === g.n - 1 ? "TROUDUC" : t === g.n - 2 ? "VICE-TROUDUC" : "DANS LE VENT";
    return (
      <Shell soundOn={soundOn} onToggleSound={toggleSound}>
      <div style={{ maxWidth: 450, width: "100%", textAlign: "center", marginTop: 22 }}>
        <div style={{ fontFamily: MARKER, fontSize: 15, color: C.dim }}>manche {g.round}/{g.numRounds}</div>
        <div style={{ height: 16 }} />
        {order.map(p => {
          const t = g.titles[p];
          const isP = t === 0, isTdc = t === g.n - 1;
          return (
            <div key={p} style={{
              position: "relative",
              display: "flex", alignItems: "center", gap: 10,
              padding: "9px 13px", marginBottom: 8, borderRadius: 6,
              background: isP ? C.fluo : isTdc ? C.pink : C.off,
              border: "3px solid #fff", outline: `2px solid ${C.ink}`,
              boxShadow: "3px 3px 0 rgba(0,0,0,.6)", transform: `rotate(${p % 2 ? 0.8 : -0.8}deg)`,
            }}>
              {isP && (
                <div style={{ position: "absolute", right: -4, top: -16, animation: "slapIn .4s both", zIndex: 1 }}>
                  <Tag text="RESPECT !" bg={C.cyan} rotate={-5} size={13} />
                </div>
              )}
              {isTdc && (
                <div style={{ position: "absolute", right: -4, top: -16, animation: "slapIn .4s .5s both", zIndex: 1 }}>
                  <Tag text="TROP NUL !" bg={C.orange} rotate={4} size={13} />
                </div>
              )}
              <Sticker p={p} size={34} dead={isTdc} />
              <span style={{
                fontFamily: MARKER, fontSize: isP || isTdc ? 17 : 15, color: C.ink, flex: 1, textAlign: "left",
                textDecoration: isTdc ? "line-through" : "none",
              }}>{nameOf(p)}</span>
              <span style={{ fontFamily: MARKER, fontSize: 12, color: C.ink }}>{label(t)}</span>
              <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 15, color: C.ink }}>+{g.n - 1 - t}</span>
            </div>
          );
        })}
        {g.offenders.length > 0 && (
          <div style={{
            fontFamily: MARKER, color: C.ink, background: C.orange, borderRadius: 6, padding: "7px 12px",
            fontSize: 14, margin: "6px 0 12px", border: "3px solid #fff", outline: `2px solid ${C.ink}`,
            boxShadow: "3px 3px 0 rgba(0,0,0,.6)", transform: "rotate(-1deg)",
          }}>
            {g.offenders.map(nameOf).join(", ")} a fini sur un 2 : Trouduc direct !
          </div>
        )}
        <div style={{ marginTop: 12 }}><Btn label="Le mur des scores →" onClick={() => setScreen("standings")} rot={1} /></div>
      </div>
      </Shell>
    );
  }

  if (screen === "standings") {
    return <Standings g={g} onNext={g.phase === "PARTIE_FINIE" ? () => setScreen("menu") : nextRound} soundOn={soundOn} onToggleSound={toggleSound} />;
  }

  /* ---- TABLE DE JEU ---- */
  const lastPlay = g.trick ? g.trick.pile[g.trick.pile.length - 1] : null;
  const playableRanks = new Set(humanPlays.map(m => m.rank));
  return (
    <Shell soundOn={soundOn} onToggleSound={toggleSound}>
    <div style={{ maxWidth: 500, width: "100%", display: "flex", flexDirection: "column", flex: 1 }}>
      {revShow && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 60, background: C.wall,
          backgroundImage: "repeating-conic-gradient(from 0deg at 50% 50%, #CCFF0014 0deg 5deg, transparent 5deg 14deg)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12,
        }}>
          <div style={{ fontFamily: MARKER, fontSize: 46, color: C.fluo, transform: "rotate(-6deg)", textShadow: `4px 4px 0 ${C.ink}` }}>
            RÉVOLUTION !
          </div>
          <div style={{ fontFamily: MARKER, fontSize: 17, color: C.pink, transform: "rotate(-2deg)" }}>
            {g.revolution ? "le mur est repeint — tout est inversé" : "contre-révolution — retour à l'ordre"}
          </div>
        </div>
      )}
      {g.revolution && !revShow && (
        <div style={{
          textAlign: "center", padding: "4px 0", marginBottom: 6, borderRadius: 6,
          background: C.pink, color: C.ink, fontFamily: MARKER, fontSize: 14,
          border: "2px solid #fff", outline: `2px solid ${C.ink}`, transform: "rotate(-0.6deg)",
        }}>révolution en cours — tout est inversé</div>
      )}
      <HierarchyStrip rev={g.revolution} />

      <div style={{
        position: "relative", height: "min(46vh, 380px)", minHeight: 300, margin: "10px 0 6px",
        borderRadius: 12, background: C.panel, border: `2px solid ${C.panelLine}`,
        boxShadow: "inset 0 0 34px rgba(0,0,0,.4)",
      }}>
        <div style={{ position: "absolute", left: 14, top: -9, width: 52, height: 15, background: "#D9D2B84D", transform: "rotate(-12deg)" }} />
        <div style={{ position: "absolute", right: 22, bottom: -8, width: 44, height: 13, background: "#D9D2B84D", transform: "rotate(9deg)" }} />
        {seats.map(([x, y], p) => {
          const active = g.turn === p && !announce && !revShow && (g.phase === "PLI_OUVERTURE" || g.phase === "PLI_REPONSE");
          const passed = g.trick && g.trick.passed.has(p);
          const out = g.hands[p].length === 0;
          const won = announce && announce.winner === p;
          return (
            <div key={p} style={{
              position: "absolute", left: `${x}%`, top: `${y}%`, transform: "translate(-50%,-50%)",
              textAlign: "center", zIndex: 2, opacity: out && !won ? 0.55 : 1,
              animation: won ? "shake .3s 2" : "none",
            }}>
              <div style={{
                display: "inline-block", borderRadius: 12, padding: 3,
                animation: active ? "pulseFluo 1.1s infinite" : "none",
              }}>
                <Sticker p={p} size={40} dead={passed && !out} />
              </div>
              <div style={{
                marginTop: 3, fontFamily: MARKER, fontSize: 12, borderRadius: 4, padding: "1px 8px",
                background: won || active ? C.fluo : "rgba(26,26,30,.65)",
                color: won || active ? C.ink : C.off,
                transform: `rotate(${p % 2 ? 1.5 : -1.5}deg)`,
              }}>
                {won ? "★ " : ""}{nameOf(p)}
              </div>
              <div style={{ fontSize: 10.5, color: C.dim, fontWeight: 700, marginTop: 1 }}>
                {out ? "sorti" : passed ? "passe" : `${g.hands[p].length} cartes`}
              </div>
            </div>
          );
        })}

        <div style={{
          position: "absolute", left: "50%", top: "48%", transform: "translate(-50%,-50%)",
          textAlign: "center", zIndex: 1, width: "62%",
        }}>
          {announce ? (
            <div style={{ animation: "slapIn .3s both" }}>
              <Tag text="PLI CHOPÉ !" bg={C.fluo} rotate={-6} size={22} />
              <div style={{ fontWeight: 700, fontSize: 13, color: C.off, marginTop: 8 }}>{nameOf(announce.winner)} ramasse</div>
            </div>
          ) : g.trick ? (
            <>
              <div style={{ fontSize: 11.5, color: C.dim, fontWeight: 700, marginBottom: 5 }}>
                Pli en {["", "simple", "paire", "brelan", "carré"][g.trick.count]}
              </div>
              <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                {lastPlay.cards.map(c => <Card key={c.id} card={c} small />)}
              </div>
              <div style={{ fontSize: 11.5, color: C.dim, fontWeight: 700, marginTop: 4 }}>par {nameOf(lastPlay.player)}</div>
            </>
          ) : (
            <div style={{ color: C.dim, fontSize: 13.5, fontWeight: 700 }}>
              {g.turn === 0 ? "À toi d'ouvrir" : `${nameOf(g.turn)} ouvre…`}
              {g.mustIncludeThreeClubs && g.turn === 0 && <div style={{ color: C.fluo, marginTop: 3, fontFamily: MARKER }}>avec le 3♣</div>}
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

      <div style={{ textAlign: "center", fontSize: 13.5, minHeight: 20, fontFamily: MARKER, color: note ? C.dim : C.fluo }}>
        {note || (announce || revShow ? "" : g.turn === 0 ? "à toi de jouer" : <span style={{ color: C.dim }}>{nameOf(g.turn)} cogite…</span>)}
      </div>

      <div style={{ height: 6, borderRadius: 3, background: C.panel, margin: "6px 0 10px", overflow: "hidden", border: `1px solid ${C.panelLine}` }}>
        {g.turn === 0 && !announce && !revShow && !mustAutoPass && (
          <div style={{
            height: "100%", width: `${(timeLeft / TURN_TIME) * 100}%`,
            background: timeLeft < 5 ? C.pink : C.fluo, transition: "width .1s linear",
          }} />
        )}
      </div>

      <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 10 }}>
        <Btn label="JOUER" onClick={playSelection} disabled={!canPlay} rot={-1} />
        <Btn label="PASSER" onClick={pass} disabled={!canPass} alt rot={1} />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, justifyContent: "center" }}>
        {g.hands[0].map(c => {
          const faded = g.turn === 0 && !announce && !revShow && playableRanks.size > 0 && !playableRanks.has(c.rank);
          return <Card key={c.id} card={c} selected={selected.includes(c.id)} faded={faded} onClick={() => toggleCard(c.id)} />;
        })}
        {g.hands[0].length === 0 && (
          <div style={{ fontFamily: MARKER, color: C.fluo, fontSize: 15 }}>
            Sorti ! La bande continue sans toi…
          </div>
        )}
      </div>
      <div style={{ textAlign: "center", marginTop: 12, fontSize: 12, color: C.dim, fontWeight: 700 }}>
        Manche {g.round}/{g.numRounds} · {g.n} joueurs
      </div>
    </div>
    </Shell>
  );
}

/* Le mur des scores : stickers claqués sur le béton, lignes animées */
function Standings({ g, onNext, soundOn, onToggleSound }) {
  const [moved, setMoved] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMoved(true), 500); return () => clearTimeout(t); }, []);
  const players = Array.from({ length: g.n }, (_, p) => p);
  const byScore = scores => players.slice().sort((a, b) => scores[b] - scores[a] || g.titles[a] - g.titles[b]);
  const oldOrder = byScore(g.scoresBefore);
  const newOrder = byScore(g.scores);
  const rowH = 60;
  const finished = g.phase === "PARTIE_FINIE";
  return (
    <Shell soundOn={soundOn} onToggleSound={onToggleSound}>
    <div style={{ maxWidth: 440, width: "100%", textAlign: "center", marginTop: 24 }}>
      <div style={{ fontFamily: "'Permanent Marker',cursive", fontSize: 26, color: "#ECEFF1", transform: "rotate(-2deg)", textShadow: "3px 3px 0 #1A1A1E" }}>
        {finished ? "LE MUR FINAL" : "LE MUR DES SCORES"} <span style={{ color: "#FF3D8A" }}>↓</span>
      </div>
      <div style={{ position: "relative", height: g.n * rowH + 8, margin: "16px 0" }}>
        {players.map(p => {
          const from = oldOrder.indexOf(p), to = newOrder.indexOf(p);
          const idx = moved ? to : from;
          const rank = (moved ? to : from) + 1;
          const isWinner = finished && to === 0;
          const isFirst = rank === 1;
          return (
            <div key={p} style={{
              position: "absolute", left: 0, right: 0, top: idx * rowH, height: rowH - 10,
              display: "flex", alignItems: "center", gap: 10,
              padding: "0 12px", borderRadius: 6, transition: "top .9s cubic-bezier(.2,.8,.2,1)",
              background: isFirst ? "#CCFF00" : "#ECEFF1",
              border: "3px solid #fff", outline: "2px solid #1A1A1E",
              boxShadow: "3px 3px 0 rgba(0,0,0,.6)",
              transform: `rotate(${p % 2 ? 1 : -1}deg)`,
            }}>
              <span style={{ fontFamily: "'Permanent Marker',cursive", fontSize: 17, color: "#1A1A1E", width: 30, textAlign: "left" }}>#{rank}</span>
              <Sticker p={p} size={30} />
              <span style={{ fontFamily: "'Permanent Marker',cursive", fontSize: 15, color: "#1A1A1E", flex: 1, textAlign: "left" }}>
                {isWinner ? "★ " : ""}{nameOf(p)}{isFirst && !finished ? " — le boss" : ""}
              </span>
              {moved && to !== from && (
                <span style={{
                  fontFamily: "'Archivo',sans-serif", fontWeight: 700, fontSize: 13,
                  background: "#1A1A1E", color: to < from ? "#CCFF00" : "#FF3D8A",
                  borderRadius: 4, padding: "2px 8px", whiteSpace: "nowrap",
                }}>
                  {to < from ? `▲ ${from - to}` : `▼ ${to - from}`}
                </span>
              )}
              <span style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 700, fontSize: 16, color: "#1A1A1E" }}>{g.scores[p]}pts</span>
            </div>
          );
        })}
      </div>
      <Btn label={finished ? "On remet ça !" : "Manche suivante"} onClick={onNext} big rot={-1} />
    </div>
    </Shell>
  );
}
