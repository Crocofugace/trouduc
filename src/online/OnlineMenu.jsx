import { useState } from "react";
import { C, MARKER, Shell, Btn } from "../ui/shared.jsx";

export default function OnlineMenu({ name, onChangeName, onQuickPlay, onCreate, onJoin, error }) {
  const [sub, setSub] = useState("main"); // main | create | join
  const [numPlayers, setNumPlayers] = useState(4);
  const [numRounds, setNumRounds] = useState(5);
  const [code, setCode] = useState("");
  const [localErr, setLocalErr] = useState("");

  const field = (label, children) => (
    <label style={{ display: "block", fontFamily: MARKER, fontSize: 14, color: C.dim, margin: "14px 0 6px" }}>
      {label}
      <div style={{ marginTop: 6 }}>{children}</div>
    </label>
  );

  const choiceRow = (options, value, onChange) => (
    <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
      {options.map(n => (
        <button key={n} onClick={() => onChange(n)} style={{
          padding: "9px 22px", borderRadius: 6, fontFamily: MARKER, fontSize: 16, cursor: "pointer",
          border: "3px solid #fff", outline: `2px solid ${C.ink}`,
          background: value === n ? C.cyan : C.panel, color: value === n ? C.ink : C.dim,
          boxShadow: "2.5px 2.5px 0 rgba(0,0,0,.6)",
        }}>{n}</button>
      ))}
    </div>
  );

  if (sub === "create") {
    return (
      <Shell>
        <div style={{ maxWidth: 420, width: "100%", textAlign: "center", marginTop: 40 }}>
          <div style={{ fontFamily: MARKER, fontSize: 28, color: C.fluo, transform: "rotate(-2deg)" }}>Créer une partie</div>
          {field("joueurs à table", choiceRow([4, 5, 6], numPlayers, setNumPlayers))}
          {field("manches", choiceRow([3, 5, 10], numRounds, setNumRounds))}
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 24 }}>
            <Btn label="← Retour" onClick={() => setSub("main")} alt />
            <Btn label="Créer" onClick={() => onCreate({ numPlayers, numRounds })} />
          </div>
          {(error || localErr) && <p style={{ color: C.pink, fontWeight: 700, marginTop: 14 }}>{error || localErr}</p>}
        </div>
      </Shell>
    );
  }

  if (sub === "join") {
    return (
      <Shell>
        <div style={{ maxWidth: 420, width: "100%", textAlign: "center", marginTop: 40 }}>
          <div style={{ fontFamily: MARKER, fontSize: 28, color: C.fluo, transform: "rotate(-2deg)" }}>Rejoindre par code</div>
          {field("code à 4 lettres", (
            <input value={code} maxLength={4} autoCapitalize="characters"
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="ABCD"
              style={{
                fontFamily: MARKER, fontSize: 24, letterSpacing: 6, textAlign: "center", width: 140,
                padding: "8px 10px", borderRadius: 6, border: "3px solid #fff", outline: `2px solid ${C.ink}`,
                background: "#fff", color: C.ink,
              }} />
          ))}
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 24 }}>
            <Btn label="← Retour" onClick={() => setSub("main")} alt />
            <Btn label="Rejoindre" onClick={() => {
              if (code.trim().length !== 4) { setLocalErr("Code à 4 lettres"); return; }
              setLocalErr(""); onJoin({ code: code.trim() });
            }} />
          </div>
          {(error || localErr) && <p style={{ color: C.pink, fontWeight: 700, marginTop: 14 }}>{error || localErr}</p>}
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div style={{ maxWidth: 420, width: "100%", textAlign: "center", marginTop: 40 }}>
        <div style={{ fontFamily: MARKER, fontSize: 40, color: C.fluo, transform: "rotate(-3deg)", textShadow: `3px 3px 0 ${C.ink}` }}>
          JOUER EN LIGNE
        </div>
        <div style={{ fontFamily: MARKER, fontSize: 15, color: C.pink, margin: "6px 0 30px" }}>
          {name} <a href="#" onClick={e => { e.preventDefault(); onChangeName(); }} style={{ color: C.dim, fontSize: 12, marginLeft: 8 }}>(changer)</a>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
          <Btn label="⚡ Partie rapide" onClick={onQuickPlay} big rot={-1} />
          <Btn label="Créer une partie privée" onClick={() => setSub("create")} rot={1} />
          <Btn label="Rejoindre par code" onClick={() => setSub("join")} alt rot={-1} />
        </div>
        {error && <p style={{ color: C.pink, fontWeight: 700, marginTop: 18 }}>{error}</p>}
      </div>
    </Shell>
  );
}
