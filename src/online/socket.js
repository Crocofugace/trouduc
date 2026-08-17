import { io } from "socket.io-client";

const URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";

export function createSocket() {
  return io(URL, { autoConnect: true, transports: ["websocket", "polling"] });
}
