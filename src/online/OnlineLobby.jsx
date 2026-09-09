import { useEffect, useState } from "react";
import { C, MARKER, Shell, Btn, Sticker } from "../ui/shared.jsx";

export default function OnlineLobby({ lobby, onStart, onLeave, musicOn, sfxOn, toggleMusic, toggleSfx }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!lobby.autoStartDeadline) return;
    const iv = setInterval(() => setTick(t => t + 1), 250);
    return () => clearInterval(iv);
  }, [lobby.autoStartDeadline]);

  const isPublic = lobby.lobbyType === "public";
  const cap = isPublic ? 6 : lobby.numPlayersTarget;
  const isHost = lobby.hostSeat === lobby.me;
  const full = lobby.players.length === cap;
  const remaining = lobby.autoStartDeadline ? Math.max(0, Math.ceil((lobby.autoStartDeadline - Date.now()) / 1000)) : null;

  return (
    <Shell musicOn={musicOn} sfxOn={sfxOn} onToggleMusic={toggleMusic} onToggleSfx={toggleSfx}>
      <div style={{ maxWidth: 420, width: "100%", textAlign: "center", marginTop: 40 }}>
        <div style={{ fontFamily: MARKER, fontSize: 26, color: C.fluo, transform: "rotate(-2deg)" }}>
          {isPublic ? "Partie publique — en attente" : "Salle d'attente"}
        </div>

        {!isPublic && (
          <div style={{
            margin: "18px auto", padding: "10px 20px", borderRadius: 10, background: C.panel,
            border: `2px solid ${C.panelLine}`, display: "inline-block",
          }}>
            <div style={{ fontSize: 12, color: C.dim, fontWeight: 700 }}>code de la partie</div>
            <div style={{ fontFamily: MARKER, fontSize: 34, color: C.fluo, letterSpacing: 6 }}>{lobby.code}</div>
          </div>
        )}

        <div style={{ fontFamily: MARKER, fontSize: 16, color: C.dim, margin: "14px 0" }}>
          {lobby.players.length} / {cap} joueurs
        </div>

        {remaining !== null && (
          <div style={{ fontFamily: MARKER, fontSize: 14, color: C.mint, marginBottom: 14 }}>
            Démarrage automatique dans {remaining}s...
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "14px 0" }}>
          {lobby.players.map(p => (
            <div key={p.seat} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", borderRadius: 8,
              background: C.off, border: "3px solid #fff", outline: `2px solid ${C.ink}`,
              opacity: p.connected ? 1 : 0.5,
            }}>
              <Sticker p={p.seat % 6} size={30} />
              <span style={{ fontFamily: MARKER, fontSize: 15, color: C.ink, flex: 1, textAlign: "left" }}>{p.name}</span>
              {p.seat === lobby.hostSeat && !isPublic && (
                <span style={{ fontFamily: MARKER, fontSize: 11, color: C.ink, background: C.cyan, borderRadius: 4, padding: "2px 8px" }}>Hôte</span>
              )}
              {!p.connected && (
                <span style={{ fontFamily: MARKER, fontSize: 11, color: C.ink, background: C.orange, borderRadius: 4, padding: "2px 8px" }}>Déco</span>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 18 }}>
          <Btn label="Quitter" onClick={onLeave} alt />
          {!isPublic && isHost && <Btn label="Lancer la partie" onClick={onStart} disabled={!full} />}
        </div>
        <p style={{ fontSize: 13, color: C.dim, marginTop: 14, fontWeight: 600 }}>
          {isPublic
            ? (lobby.players.length < 4 ? `En attente de ${4 - lobby.players.length} joueur(s) minimum...` : "Tout le monde est prêt, démarrage imminent...")
            : (isHost ? (full ? "Prêt à lancer !" : `En attente de ${cap - lobby.players.length} joueur(s)...`) : "En attente que l'hôte lance la partie...")}
        </p>
      </div>
    </Shell>
  );
}
