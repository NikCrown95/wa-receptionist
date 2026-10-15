// Le tre aree di Prenolia. Il tipo di attivita' (business_type) decide in quale area ricade e quindi quale dashboard si vede.
//  servizi  : appuntamenti su servizi (parrucchieri, barbieri, estetica, dentisti, studi medici, ...)
//  palestra : abbonamenti, iscritti e lezioni a numero chiuso
//  campi    : prenotazione di campi (padel, tennis, calcetto) - in arrivo
const PALESTRA = ["palestra"];
const CAMPI = ["campo", "campi", "circolo_tennis", "padel", "calcetto"];

function areaOf(type) {
  const t = String(type || "").toLowerCase().trim();
  if (PALESTRA.includes(t)) return "palestra";
  if (CAMPI.includes(t)) return "campi";
  return "servizi";
}

// Parole usate nell'interfaccia: chi riceve il servizio cambia in base all'attivita'.
const SERVED = {
  dentista: { one: "paziente", many: "pazienti" },
  "studio medico": { one: "paziente", many: "pazienti" },
  fisioterapista: { one: "paziente", many: "pazienti" },
  palestra: { one: "iscritto", many: "iscritti" },
};
function servedWord(type) { return SERVED[String(type || "").toLowerCase().trim()] || { one: "cliente", many: "clienti" }; }

module.exports = { areaOf, servedWord };
