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

export function Shell({ soundOn, onToggleSound, children }) {
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
      {onToggleSound && (
        <button onClick={onToggleSound} title="Musique et sons" style={{
          position: "absolute", top: 10, right: 10, zIndex: 40, width: 40, height: 40, borderRadius: 8,
          border: "2px solid #fff", outline: `2px solid ${C.ink}`, background: C.panel, color: C.off,
          fontSize: 16, cursor: "pointer", transform: "rotate(3deg)", boxShadow: "2px 2px 0 rgba(0,0,0,.6)",
        }}>{soundOn ? "🔊" : "🔇"}</button>
      )}
      {children}
    </div>
  );
}

/* ================= AUDIO (Tone.js — identité sonore street lo-fi) ================= */
export function createAudio() {
  const master = new Tone.Volume(-6).toDestination();
  // Bus d'ambiance lo-fi : vrai échantillon de crépitement vinyle en boucle + reverb sur les éléments mélodiques.
  const atmoBus = new Tone.Freeverb({ roomSize: 0.6, dampening: 3000 }).connect(master);
  const vinyl = new Tone.Player({ url: "/audio/vinyl-crackle.mp3", loop: true, autostart: false })
    .connect(new Tone.Volume(-22).connect(master));

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
  const horn = new Tone.Synth({ oscillator: { type: "sawtooth" }, portamento: 0.06, envelope: { attack: 0.02, decay: 0.05, sustain: 0.85, release: 0.15 } })
    .connect(new Tone.Volume(-13).connect(master));
  const stab = new Tone.PolySynth(Tone.Synth, { oscillator: { type: "sawtooth" }, envelope: { attack: 0.03, decay: 0.2, sustain: 0.4, release: 0.3 } })
    .connect(new Tone.Volume(-14).connect(master));
  const sad = new Tone.Synth({ oscillator: { type: "sawtooth" }, portamento: 0.22, envelope: { attack: 0.05, decay: 0.1, sustain: 0.7, release: 0.4 } })
    .connect(new Tone.Volume(-12).connect(master));
  // Coup de scratch vinyle (bruit filtré + pitch-bend descendant) déclenché juste avant le "wahwah" du Trou du Cul.
  const scratchNoise = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.18, sustain: 0 } });
  const scratchFilter = new Tone.Filter(1200, "bandpass").connect(new Tone.Volume(-16).connect(master));
  scratchNoise.connect(scratchFilter);

  // musique : groove boom-bap 4 mesures (batterie, basse, accords mineurs, motif call-and-response)
  const bassS = new Tone.Synth({ oscillator: { type: "triangle" }, envelope: { attack: 0.005, decay: 0.25, sustain: 0.3, release: 0.18 } })
    .connect(new Tone.Volume(-19).connect(master));
  const keys = new Tone.PolySynth(Tone.Synth, { oscillator: { type: "sine" }, envelope: { attack: 0.01, decay: 0.6, sustain: 0.06, release: 0.6 } })
    .connect(new Tone.Volume(-23).connect(atmoBus));
  const hook = new Tone.Synth({ oscillator: { type: "triangle" }, envelope: { attack: 0.003, decay: 0.3, sustain: 0.02, release: 0.3 } })
    .connect(new Tone.Volume(-25).connect(atmoBus));
  const kick = new Tone.MembraneSynth({ pitchDecay: 0.04, octaves: 5, envelope: { attack: 0.001, decay: 0.3, sustain: 0 } })
    .connect(new Tone.Volume(-14).connect(master));
  const snare = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.13, sustain: 0 } })
    .connect(new Tone.Volume(-19).connect(master));
  const hat = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.025, sustain: 0 } })
    .connect(new Tone.Volume(-29).connect(master));
  const K = "k", S = "s", F = "f"; // F = coup de caisse claire de fill (même son que S, motif différent)
  // Mesures 1-2 : groove principal. Mesures 3-4 : reprise + petite variation (accord ii au lieu du IV, fill final).
  const drums = [
    K, 0, 0, 0, S, 0, 0, K, 0, 0, K, 0, S, 0, 0, 0,
    K, 0, 0, K, S, 0, 0, 0, K, 0, K, 0, S, 0, 0, S,
    K, 0, 0, 0, S, 0, 0, K, 0, 0, K, 0, S, 0, 0, 0,
    K, 0, 0, K, S, 0, 0, 0, K, 0, S, 0, F, S, F, S,
  ];
  const hats = [
    1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0,
    1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1,
    1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0,
    1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1,
  ];
  const bassline = [
    "A1", 0, 0, "A1", 0, 0, "C2", 0, "A1", 0, 0, 0, "G1", 0, "E1", 0,
    "F1", 0, 0, "F1", 0, 0, "A1", 0, "E1", 0, 0, "E1", 0, "G1", 0, 0,
    "A1", 0, 0, "A1", 0, 0, "C2", 0, "A1", 0, 0, 0, "G1", 0, "E1", 0,
    "D1", 0, 0, "D1", 0, 0, "F1", 0, "E1", 0, 0, "E1", 0, "G1", 0, 0,
  ];
  const chords = [
    ["A2", "C3", "E3", "G3"], 0, 0, 0, 0, 0, 0, 0, 0, 0, ["A2", "C3", "E3", "G3"], 0, 0, 0, 0, 0,
    ["F2", "A2", "C3", "E3"], 0, 0, 0, 0, 0, 0, 0, ["E2", "G#2", "B2", "D3"], 0, 0, 0, 0, 0, 0, 0,
    ["A2", "C3", "E3", "G3"], 0, 0, 0, 0, 0, 0, 0, 0, 0, ["A2", "C3", "E3", "G3"], 0, 0, 0, 0, 0,
    ["D2", "F2", "A2", "C3"], 0, 0, 0, 0, 0, 0, 0, ["E2", "G#2", "B2", "D3"], 0, 0, 0, 0, 0, 0, 0,
  ];
  const hookline = [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, "E4", 0, "C4", 0,
    "A3", 0, 0, "B3", "C4", 0, 0, 0, 0, 0, 0, 0, "G3", 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, "G4", 0, "E4", 0,
    "C4", 0, 0, "B3", "A3", 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ];
  const seqD = new Tone.Sequence((t, d) => {
    if (d === K) kick.triggerAttackRelease("C1", "8n", t);
    else if (d === S || d === F) snare.triggerAttackRelease("16n", t);
  }, drums, "16n");
  const seqH = new Tone.Sequence((t, h) => { if (h) hat.triggerAttackRelease("32n", t); }, hats, "16n");
  const seqB = new Tone.Sequence((t, n) => { if (n) bassS.triggerAttackRelease(n, "8n", t); }, bassline, "16n");
  const seqC = new Tone.Sequence((t, ch) => { if (ch) keys.triggerAttackRelease(ch, "2n", t); }, chords, "16n");
  const seqK = new Tone.Sequence((t, n) => { if (n) hook.triggerAttackRelease(n, "8n", t); }, hookline, "16n");
  Tone.Transport.bpm.value = 88;
  Tone.Transport.swing = 0.22;
  Tone.Transport.swingSubdivision = "16n";

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
    fanfare: () => { // air horn du boss
      const now = Tone.now();
      horn.triggerAttackRelease("C4", "8n", now);
      horn.triggerAttackRelease("G4", "8n", now + 0.28);
      horn.triggerAttackRelease("C4", "16n", now + 0.56);
      horn.triggerAttackRelease("G4", "2n", now + 0.68);
    },
    wahwah: () => { // scratch d'arrêt façon platine + motif descendant désolé
      const now = Tone.now();
      scratchFilter.frequency.setValueAtTime(2200, now);
      scratchFilter.frequency.exponentialRampToValueAtTime(300, now + 0.18);
      scratchNoise.triggerAttackRelease("8n", now);
      ["A3", "G3", "F#3"].forEach((n, i) => sad.triggerAttackRelease(n, "4n", now + 0.25 + i * 0.35));
      sad.triggerAttackRelease("C3", "2n", now + 1.3);
    },
    musicStart: () => {
      seqD.start(0); seqH.start(0); seqB.start(0); seqC.start(0); seqK.start(0);
      // Le fichier vinyle se charge en arrière-plan : on le lance dès qu'il est prêt.
      if (vinyl.loaded) { try { vinyl.start(0); } catch (e) { } }
      else vinyl.autostart = true;
      Tone.Transport.start();
    },
    musicStop: () => {
      Tone.Transport.stop(); seqD.stop(); seqH.stop(); seqB.stop(); seqC.stop(); seqK.stop();
      vinyl.autostart = false;
      if (vinyl.loaded) { try { vinyl.stop(); } catch (e) { } }
    },
  };
}
