/* lib/ratelimit.js  (Prenolia: limite di richieste per le pagine pubbliche)
   Conta le richieste per chiave in finestre fisse, usando la tabella auth_throttle (key, fails, updated_at).
   Se il database non risponde lascia passare: il limite non deve mai bloccare i clienti veri per un guasto. */
const { sb } = require("./lia.js");

function ipOf(req) {
  return String((req.headers && req.headers["x-forwarded-for"]) || "").split(",")[0].trim() || "unknown";
}

// true = richiesta consentita, false = troppe richieste
async function allow(key, max, windowMs) {
  try {
    const bucket = Math.floor(Date.now() / windowMs);
    const k = "rl:" + key + ":" + bucket;
    const r = await sb("GET", "auth_throttle?key=eq." + encodeURIComponent(k) + "&select=fails");
    const n = (r.ok && Array.isArray(r.data) && r.data[0] ? Number(r.data[0].fails) || 0 : 0) + 1;
    if (n > max) return false;
    await sb("POST", "auth_throttle?on_conflict=key", { key: k, fails: n, locked_until: null, updated_at: new Date().toISOString() }, "resolution=merge-duplicates,return=minimal");
    if (n === 1) sb("DELETE", "auth_throttle?key=eq." + encodeURIComponent("rl:" + key + ":" + (bucket - 2))).catch(function () {});
    return true;
  } catch (e) { return true; }
}

module.exports = { allow, ipOf };
