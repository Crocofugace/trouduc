// Analytics minimal, sans cookie, sans compte tiers requis pour que l'app tourne.
// Ne fait rien tant que GoatCounter n'est pas chargé (voir index.html) : sûr par défaut.
// Pour activer : créer un compte gratuit sur https://www.goatcounter.com/ (pas de CB),
// remplacer TON-CODE dans index.html par le code de site fourni, puis redéployer.
export function trackEvent(name, data = {}) {
  try {
    if (typeof window !== "undefined" && window.goatcounter && window.goatcounter.count) {
      const qs = Object.entries(data).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
      window.goatcounter.count({
        path: qs ? `${name}?${qs}` : name,
        title: name,
        event: true,
      });
    }
  } catch (e) {
    // silencieux : l'analytics ne doit jamais casser une partie
  }
}
