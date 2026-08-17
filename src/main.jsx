import React from "react";
import { createRoot } from "react-dom/client";
import Home from "./Home.jsx";

createRoot(document.getElementById("root")).render(<Home />);

// PWA : enregistrement du service worker (production uniquement)
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
