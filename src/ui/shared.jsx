/* ================= UI partagée (solo + en ligne) ================= */
import * as Tone from "tone";
import { SUITS, RANK_LABEL } from "../engine/president.js";

export const C = {
  wall: "#26262B", wall2: "#2C2C33", panel: "#303038", panelLine: "#4A4A55",
  ink: "#1A1A1E", off: "#ECEFF1", dim: "rgba(236,239,241,.6)",
  fluo: "#CCFF00", pink: "#FF3D8A", cyan: "#00E5FF", orange: "#FF8A00", violet: "#9B5CFF", mint: "#4DFF88",
};
export const PLAYERS_META = [
  { name: "TOI", tag: "T", color: C.fluo },
  { name: "SKUB", tag: "S", color: C.cyan },
  { name: "MOKA", tag: "M", color: C.pink },
  { name: "VINZ", tag: "V", color: C.orange },
  { name: "KAYA", tag: "K", color: C.violet },
  { name: "ZBEUL", tag: "Z", color: C.mint },
];
export const nameOf = p => PLAYERS_META[p].name;
export const SEATS = {
  4: [[50, 90], [8, 52], [50, 10], [92, 52]],
  5: [[50, 90], [8, 58], [24, 12], [76, 12], [92, 58]],
  6: [[50, 90], [6, 58], [17, 14], [50, 7], [83, 14], [94, 58]],
};
export const TURN_TIME = 15;
export const MARKER = "'Permanent Marker','Comic Sans MS',cursive";
export const SANS = "'Archivo','Segoe UI',sans-serif";

export function Sticker({ p, size = 40, dead = false }) {
  const m = PLAYERS_META[p];
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.22, background: m.color,
      border: "3px solid #fff", outline: `2px solid ${C.ink}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: MARKER, fontSize: size * 0.5, color: C.ink, flexShrink: 0,
      transform: `rotate(${(p % 2 ? 1 : -1) * 4}deg)`, boxShadow: "3px 3px 0 rgba(0,0,0,.55)",
      opacity: dead ? 0.5 : 1, filter: dead ? "grayscale(.7)" : "none",
    }}>{m.tag}</div>
  );
}

export function Card({ card, small, selected, onClick, faded }) {
  const redSuit = card.suit === 1 || card.suit === 2;
  const tilt = ((card.id % 3) - 1) * 1.6; // légère pose "sticker", stable par carte
  return (
    <div onClick={faded ? undefined : onClick} data-testid={`card-${card.id}`} data-rank={card.rank} data-suit={card.suit} style={{
      width: small ? 32 : 46, height: small ? 44 : 64, borderRadius: small ? 8 : 10, background: "#fff",
      color: redSuit ? C.pink : C.ink,
      border: "3px solid #fff", outline: `2px solid ${C.ink}`,
      boxShadow: selected ? `0 0 0 3px ${C.fluo}, 3px 3px 0 rgba(0,0,0,.6)` : "3px 3px 0 rgba(0,0,0,.6)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: MARKER, fontSize: small ? 14 : 20, cursor: onClick && !faded ? "pointer" : "default",
      transform: selected ? "translateY(-10px) rotate(0deg)" : `rotate(${tilt}deg)`,
      transition: "transform .12s, opacity .15s",
      opacity: faded ? 0.3 : 1, flexShrink: 0, userSelect: "none",
    }}>
      <div style={{ lineHeight: 1 }}>{RANK_LABEL(card.rank)}</div>
      <div style={{ fontSize: small ? 12 : 16, lineHeight: 1.1 }}>{SUITS[card.suit]}</div>
    </div>
  );
}

export function Tag({ text, color = C.fluo, bg = null, rotate = -4, size = 20 }) {
  return (
    <span style={{
      display: "inline-block", fontFamily: MARKER, fontSize: size, color: bg ? C.ink : color,
      background: bg || "transparent", padding: bg ? "3px 12px" : 0, borderRadius: bg ? 4 : 0,
      transform: `rotate(${rotate}deg)`, boxShadow: bg ? "3px 3px 0 rgba(0,0,0,.55)" : "none",
      textShadow: bg ? "none" : `2px 2px 0 ${C.ink}`,
    }}>{text}</span>
  );
}

export function HierarchyStrip({ rev }) {
  const ranks = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  const order = rev ? ranks.slice().reverse() : ranks;
  return (
    <div style={{ display: "flex", gap: 3, justifyContent: "center", flexWrap: "wrap", fontFamily: SANS, fontSize: 11, color: C.dim, fontWeight: 700 }}>
      {order.map((r, i) => (
        <span key={r} style={{ color: i === order.length - 1 ? C.fluo : C.dim }}>
          {RANK_LABEL(r)}{i < order.length - 1 ? " ‹" : ""}
        </span>
      ))}
    </div>
  );
}

export function Btn({ label, onClick, disabled, big, alt, rot = 0 }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: big ? "13px 38px" : "11px 26px", borderRadius: 6, border: "3px solid #fff",
      outline: `2px solid ${C.ink}`, fontFamily: MARKER, fontSize: big ? 19 : 16,
      cursor: disabled ? "default" : "pointer",
      background: disabled ? "#3A3A42" : alt ? C.off : C.fluo,
      color: disabled ? C.dim : C.ink,
      boxShadow: disabled ? "none" : "3px 3px 0 rgba(0,0,0,.6)",
      transform: `rotate(${rot}deg)`,
    }}>{label}</button>
  );
}

export function Shell({ musicOn, sfxOn, onToggleMusic, onToggleSfx, children }) {
  return (
    <div style={{
      minHeight: "100vh", position: "relative", background: C.wall,
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='96'%3E%3Cpath d='M0 1h160M0 49h160M0 95h160' stroke='%23ffffff10' stroke-width='2'/%3E%3Cpath d='M0 0v48M80 0v48M160 0v48M40 48v48M120 48v48' stroke='%23ffffff0d' stroke-width='2'/%3E%3C/svg%3E")`,
      color: C.off, fontFamily: SANS,
      display: "flex", flexDirection: "column", alignItems: "center", padding: "12px 8px 24px",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Permanent+Marker&family=Archivo:wght@500;600;700&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes pulseFluo { 0%,100%{ box-shadow:0 0 0 0 rgba(204,255,0,.6);} 50%{ box-shadow:0 0 0 8px rgba(204,255,0,0);} }
        @keyframes slapIn { 0%{ transform:scale(2.2) rotate(-14deg); opacity:0;} 65%{ transform:scale(.94) rotate(-5deg); opacity:1;} 100%{ transform:scale(1) rotate(-6deg);} }
        @keyframes shake { 0%,100%{ transform:translate(-50%,-50%);} 25%{ transform:translate(calc(-50% - 3px),-50%);} 75%{ transform:translate(calc(-50% + 3px),-50%);} }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
      `}</style>
      {onToggleMusic && (
        <button onClick={onToggleMusic} title={musicOn ? "Couper la musique" : "Remettre la musique"} style={{
          position: "absolute", top: 10, right: 56, zIndex: 40, width: 40, height: 40, borderRadius: 8,
          border: "2px solid #fff", outline: `2px solid ${C.ink}`, background: musicOn ? C.panel : "#232328",
          color: musicOn ? C.off : "rgba(236,239,241,.35)",
          fontSize: 16, cursor: "pointer", transform: "rotate(-3deg)", boxShadow: "2px 2px 0 rgba(0,0,0,.6)",
        }}>🎵</button>
      )}
      {onToggleSfx && (
        <button onClick={onToggleSfx} title={sfxOn ? "Couper les bruitages" : "Remettre les bruitages"} style={{
          position: "absolute", top: 10, right: 10, zIndex: 40, width: 40, height: 40, borderRadius: 8,
          border: "2px solid #fff", outline: `2px solid ${C.ink}`, background: C.panel, color: C.off,
          fontSize: 16, cursor: "pointer", transform: "rotate(3deg)", boxShadow: "2px 2px 0 rgba(0,0,0,.6)",
        }}>{sfxOn ? "🔊" : "🔇"}</button>
      )}
      {children}
    </div>
  );
}

/* ================= AUDIO (musique réelle + bruitages Tone.js) ================= */
export function createAudio() {
  const master = new Tone.Volume(-6).toDestination();
  // Musique de fond : lecture directe du morceau fourni, en boucle (lecteur HTML natif, plus fiable
  // qu'un Tone.Player pour un simple fond audio — pas besoin de synchronisation avec le Transport).
  const music = new Audio("/audio/theme.mp3");
  music.loop = true;
  music.volume = 0.55;
  music.preload = "auto";
  // Cri de victoire (échantillon réel) joué pour le premier à finir sa main (le Boss/Président).
  const victory = new Audio("/audio/victory.mp3");
  victory.volume = 0.8;
  victory.preload = "auto";

  const spray = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.06, sustain: 0 } })
    .connect(new Tone.Volume(-14).connect(master));
  const spraySlow = new Tone.NoiseSynth({ noise: { type: "pink" }, envelope: { attack: 0.02, decay: 0.45, sustain: 0 } })
    .connect(new Tone.Volume(-12).connect(master));
  const thud = new Tone.MembraneSynth({ pitchDecay: 0.02, octaves: 1, envelope: { attack: 0.001, decay: 0.12, sustain: 0 } })
    .connect(new Tone.Volume(-11).connect(master));
  const slap = new Tone.MembraneSynth({ pitchDecay: 0.008, octaves: 2, envelope: { attack: 0.001, decay: 0.08, sustain: 0 } })
    .connect(new Tone.Volume(-9).connect(master));
  const click = new Tone.Synth({ oscillator: { type: "triangle" }, envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.02 } })
    .connect(new Tone.Volume(-24).connect(master));
  const stab = new Tone.PolySynth(Tone.Synth, { oscillator: { type: "sawtooth" }, envelope: { attack: 0.03, decay: 0.2, sustain: 0.4, release: 0.3 } })
    .connect(new Tone.Volume(-14).connect(master));
  const sad = new Tone.Synth({ oscillator: { type: "sawtooth" }, portamento: 0.22, envelope: { attack: 0.05, decay: 0.1, sustain: 0.7, release: 0.4 } })
    .connect(new Tone.Volume(-12).connect(master));
  // Coup de scratch vinyle (bruit filtré + pitch-bend descendant) déclenché juste avant le "wahwah" du Trou du Cul.
  const scratchNoise = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.18, sustain: 0 } });
  const scratchFilter = new Tone.Filter(1200, "bandpass").connect(new Tone.Volume(-16).connect(master));
  scratchNoise.connect(scratchFilter);

  return {
    card: () => spray.triggerAttackRelease("16n"),
    select: () => click.triggerAttackRelease("A5", "32n"),
    pass: () => thud.triggerAttackRelease("G2", "16n"),
    trick: () => { slap.triggerAttackRelease("C3", "16n"); spray.triggerAttackRelease("16n", Tone.now() + 0.05); },
    revolution: () => {
      const now = Tone.now();
      spraySlow.triggerAttackRelease("2n", now);
      stab.triggerAttackRelease(["D3", "G#3", "D4"], "4n", now + 0.15);
    },
    fanfare: () => { victory.currentTime = 0; victory.play().catch(() => { }); }, // cri de victoire du boss
    wahwah: () => { // scratch d'arrêt façon platine + motif descendant désolé
      const now = Tone.now();
      scratchFilter.frequency.setValueAtTime(2200, now);
      scratchFilter.frequency.exponentialRampToValueAtTime(300, now + 0.18);
      scratchNoise.triggerAttackRelease("8n", now);
      ["A3", "G3", "F#3"].forEach((n, i) => sad.triggerAttackRelease(n, "4n", now + 0.25 + i * 0.35));
      sad.triggerAttackRelease("C3", "2n", now + 1.3);
    },
    musicStart: () => { music.currentTime = 0; music.play().catch(() => { }); },
    musicStop: () => { music.pause(); },
  };
}
