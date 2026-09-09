import { useState, useRef } from "react";
import * as Tone from "tone";
import SoloGame from "./App.jsx";
import OnlineRouter from "./online/OnlineRouter.jsx";
import { C, MARKER, Shell, Btn, createAudio } from "./ui/shared.jsx";

export default function Home() {
  const [mode, setMode] = useState(null); // null | "solo" | "online"
  const audioRef = useRef(null);
  const [musicOn, setMusicOn] = useState(true);
  const [sfxOn, setSfxOn] = useState(true);

  const ensureAudio = async () => {
    if (audioRef.current) return;
    try {
      await Tone.start();
      audioRef.current = createAudio();
      if (musicOn) audioRef.current.musicStart();
    } catch (e) { }
  };

  const sfx = name => { if (sfxOn && audioRef.current) try { audioRef.current[name](); } catch (e) { } };

  const toggleMusic = () => {
    setMusicOn(on => {
      const next = !on;
      if (audioRef.current) (next ? audioRef.current.musicStart() : audioRef.current.musicStop());
      return next;
    });
  };
  const toggleSfx = () => setSfxOn(on => !on);

  const enterMode = m => { ensureAudio(); setMode(m); };

  const audioProps = { sfx, musicOn, sfxOn, toggleMusic, toggleSfx };

  if (mode === "solo") return <SoloGame {...audioProps} />;
  if (mode === "online") return <OnlineRouter onExit={() => setMode(null)} {...audioProps} />;

  return (
    <Shell musicOn={musicOn} sfxOn={sfxOn} onToggleMusic={toggleMusic} onToggleSfx={toggleSfx}>
      <div style={{ maxWidth: 420, width: "100%", textAlign: "center", marginTop: 60 }}>
        <div style={{ fontFamily: MARKER, fontSize: 52, color: C.fluo, transform: "rotate(-3deg)", lineHeight: 1, textShadow: `3px 3px 0 ${C.ink}` }}>
          TROUDUC
        </div>
        <div style={{ fontFamily: MARKER, fontSize: 16, color: C.pink, transform: "rotate(-1deg)", margin: "6px 0 40px" }}>
          le vrai jeu du Président
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
          <Btn label="Jouer solo (contre des bots)" onClick={() => enterMode("solo")} big rot={-1} />
          <Btn label="Jouer en ligne" onClick={() => enterMode("online")} big alt rot={1} />
        </div>
      </div>
    </Shell>
  );
}
