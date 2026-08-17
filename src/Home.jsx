import { useState } from "react";
import SoloGame from "./App.jsx";
import OnlineRouter from "./online/OnlineRouter.jsx";
import { C, MARKER, Shell, Btn } from "./ui/shared.jsx";

export default function Home() {
  const [mode, setMode] = useState(null); // null | "solo" | "online"

  if (mode === "solo") return <SoloGame />;
  if (mode === "online") return <OnlineRouter onExit={() => setMode(null)} />;

  return (
    <Shell>
      <div style={{ maxWidth: 420, width: "100%", textAlign: "center", marginTop: 60 }}>
        <div style={{ fontFamily: MARKER, fontSize: 52, color: C.fluo, transform: "rotate(-3deg)", lineHeight: 1, textShadow: `3px 3px 0 ${C.ink}` }}>
          TROUDUC
        </div>
        <div style={{ fontFamily: MARKER, fontSize: 16, color: C.pink, transform: "rotate(-1deg)", margin: "6px 0 40px" }}>
          le vrai jeu du Président
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
          <Btn label="Jouer solo (contre des bots)" onClick={() => setMode("solo")} big rot={-1} />
          <Btn label="Jouer en ligne" onClick={() => setMode("online")} big alt rot={1} />
        </div>
      </div>
    </Shell>
  );
}
