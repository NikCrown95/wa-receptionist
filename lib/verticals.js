// Le tre aree di Prenolia. Il tipo di attivita' (business_type) decide in quale area ricade e quindi quale dashboard si vede.
//  servizi  : appuntamenti su servizi (parrucchieri, barbieri, estetica, dentisti, studi medici, ...)
//  palestra : abbonamenti, iscritti e lezioni a numero chiuso
//  campi    : prenotazione di campi (padel, tennis, calcetto) - in arrivo
const PALESTRA = ["palestra"];
const CAMPI = ["campo", "campi", "circolo_tennis", "padel", "calcetto"];
// Studi sanitari: trattano dati che possono rivelare lo stato di salute (art. 9 GDPR). Per loro Prenolia raccoglie il minimo:
// solo calendario, nessun testo libero, nessuna IA, email e notifiche neutre, conservazione piu' breve.
const SANITARI = ["dentista", "studio medico", "fisioterapista"];
function isMedical(type) {
  return SANITARI.includes(String(type || "").toLowerCase().trim());
}
// Mesi dopo i quali i dati personali dei pazienti vengono anonimizzati (le altre attivita': 24).
const MEDICAL_RETENTION_MONTHS = 12;

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

module.exports = { areaOf, servedWord, isMedical, SANITARI, MEDICAL_RETENTION_MONTHS };
