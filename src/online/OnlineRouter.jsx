import { useEffect, useRef, useState } from "react";
import { createSocket } from "./socket.js";
import OnlineMenu from "./OnlineMenu.jsx";
import OnlineLobby from "./OnlineLobby.jsx";
import OnlineGame from "./OnlineGame.jsx";
import { C, MARKER, Shell, Btn } from "../ui/shared.jsx";

const NAME_KEY = "trouducOnlineName";
const CODE_KEY = "trouducOnlineCode";
const PLAYER_KEY = "trouducOnlinePlayerId";

export default function OnlineRouter({ onExit, sfx, musicOn, sfxOn, toggleMusic, toggleSfx }) {
  const socketRef = useRef(null);
  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) || "");
  const [nameInput, setNameInput] = useState("");
  const [screen, setScreen] = useState(name ? "menu" : "name");
  const [lobby, setLobby] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    const socket = createSocket();
    socketRef.current = socket;

    socket.on("lobbyUpdate", (data) => { setLobby(data); setGameState(null); setScreen("lobby"); });
    socket.on("gameState", (data) => { setGameState(data); setLobby(null); setScreen("game"); });
    socket.on("gameStarting", () => setScreen("game"));
    socket.on("playerDisconnected", ({ name: n }) => { setToast(`${n} s'est déconnecté`); setTimeout(() => setToast(""), 3000); });

    socket.on("connect", () => {
      const code = sessionStorage.getItem(CODE_KEY);
      const playerId = sessionStorage.getItem(PLAYER_KEY);
      if (code && playerId) {
        socket.emit("rejoin", { code, playerId }, (res) => {
          if (!res || res.error) {
            sessionStorage.removeItem(CODE_KEY);
            sessionStorage.removeItem(PLAYER_KEY);
            setScreen("menu");
          }
        });
      }
    });

    return () => { socket.close(); socketRef.current = null; };
  }, []);

  const saveJoin = (code, playerId) => {
    sessionStorage.setItem(CODE_KEY, code);
    sessionStorage.setItem(PLAYER_KEY, playerId);
  };

  const submitName = () => {
    const v = nameInput.trim();
    if (!v) return;
    localStorage.setItem(NAME_KEY, v);
    setName(v);
    setScreen("menu");
  };

  const quickPlay = () => {
    setError("");
    socketRef.current.emit("quickPlay", { name }, (res) => {
      if (res.error) return setError(res.error);
      saveJoin(res.code, res.playerId);
    });
  };
  const createRoom = ({ numPlayers, numRounds }) => {
    setError("");
    socketRef.current.emit("createRoom", { name, numPlayers, numRounds }, (res) => {
      if (res.error) return setError(res.error);
      saveJoin(res.code, res.playerId);
    });
  };
  const joinRoom = ({ code }) => {
    setError("");
    socketRef.current.emit("joinRoom", { code, name }, (res) => {
      if (res.error) return setError(res.error);
      saveJoin(res.code, res.playerId);
    });
  };
  const startGame = () => {
    const code = sessionStorage.getItem(CODE_KEY);
    const playerId = sessionStorage.getItem(PLAYER_KEY);
    socketRef.current.emit("startGame", { code, playerId }, (res) => { if (res.error) setError(res.error); });
  };
  const leave = () => {
    const code = sessionStorage.getItem(CODE_KEY);
    const playerId = sessionStorage.getItem(PLAYER_KEY);
    if (code && playerId) socketRef.current.emit("leaveGame", { code, playerId });
    sessionStorage.removeItem(CODE_KEY);
    sessionStorage.removeItem(PLAYER_KEY);
    setLobby(null); setGameState(null); setError("");
    setScreen("menu");
  };
  const exitToMenu = () => {
    sessionStorage.removeItem(CODE_KEY);
    sessionStorage.removeItem(PLAYER_KEY);
    setLobby(null); setGameState(null); setError("");
    setScreen("menu");
  };

  if (screen === "name") {
    return (
      <Shell musicOn={musicOn} sfxOn={sfxOn} onToggleMusic={toggleMusic} onToggleSfx={toggleSfx}>
        <div style={{ maxWidth: 380, width: "100%", textAlign: "center", marginTop: 60 }}>
          <div style={{ fontFamily: MARKER, fontSize: 30, color: C.fluo, transform: "rotate(-2deg)", marginBottom: 20 }}>Comment tu t'appelles ?</div>
          <input value={nameInput} maxLength={20} autoFocus placeholder="Ton pseudo"
            onChange={e => setNameInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") submitName(); }}
            style={{
              fontFamily: MARKER, fontSize: 20, textAlign: "center", width: "100%", boxSizing: "border-box",
              padding: "10px 14px", borderRadius: 6, border: "3px solid #fff", outline: `2px solid ${C.ink}`,
              background: "#fff", color: C.ink,
            }} />
          <div style={{ marginTop: 20 }}><Btn label="Continuer" onClick={submitName} big /></div>
          <div style={{ marginTop: 24 }}><Btn label="← Retour" onClick={onExit} alt /></div>
        </div>
      </Shell>
    );
  }

  if (screen === "lobby" && lobby) {
    return <OnlineLobby lobby={lobby} onStart={startGame} onLeave={leave}
      musicOn={musicOn} sfxOn={sfxOn} toggleMusic={toggleMusic} toggleSfx={toggleSfx} />;
  }

  if (screen === "game" && gameState) {
    const code = sessionStorage.getItem(CODE_KEY);
    const playerId = sessionStorage.getItem(PLAYER_KEY);
    return <OnlineGame state={gameState} socket={socketRef.current} code={code} playerId={playerId} onExitToMenu={exitToMenu}
      sfx={sfx} musicOn={musicOn} sfxOn={sfxOn} toggleMusic={toggleMusic} toggleSfx={toggleSfx} />;
  }

  return (
    <>
      <OnlineMenu
        name={name}
        onChangeName={() => { setNameInput(name); setScreen("name"); }}
        onQuickPlay={quickPlay}
        onCreate={createRoom}
        onJoin={joinRoom}
        error={error}
        musicOn={musicOn} sfxOn={sfxOn} toggleMusic={toggleMusic} toggleSfx={toggleSfx}
      />
      {toast && (
        <div style={{
          position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)", zIndex: 80,
          background: C.panel, color: C.off, fontFamily: MARKER, fontSize: 13, padding: "8px 18px",
          borderRadius: 8, border: `2px solid ${C.panelLine}`,
        }}>{toast}</div>
      )}
      <div style={{ position: "fixed", top: 10, left: 10, zIndex: 40 }}>
        <button onClick={onExit} title="Retour à l'accueil" style={{
          width: 40, height: 40, borderRadius: 8, border: "2px solid #fff", outline: `2px solid ${C.ink}`,
          background: C.panel, color: C.off, fontSize: 16, cursor: "pointer", boxShadow: "2px 2px 0 rgba(0,0,0,.6)",
        }}>←</button>
      </div>
    </>
  );
}
