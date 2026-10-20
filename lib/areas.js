// Zone a domicilio: se l'attivita' ha scelto le citta' dove va, l'indirizzo del cliente deve contenerne una.
// Se l'elenco e' vuoto non c'e' nessun limite.
function norm(t) {
  return " " + String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim() + " ";
}
function areaList(biz) {
  return Array.isArray(biz && biz.service_areas) ? biz.service_areas.map((x) => String(x || "").trim()).filter(Boolean) : [];
}
// Restituisce "" se l'indirizzo va bene, altrimenti il messaggio da mostrare.
function areaProblem(biz, address) {
  const list = areaList(biz);
  if (!list.length) return "";
  const a = norm(address);
  if (list.some((c) => a.includes(norm(c)))) return "";
  const nice = list.length === 1 ? list[0] : list.slice(0, -1).join(", ") + " e " + list[list.length - 1];
  return "Questo indirizzo è fuori zona: a domicilio lavoriamo a " + nice + ". Scrivi l'indirizzo completo con la città.";
}
module.exports = { areaProblem, areaList };
