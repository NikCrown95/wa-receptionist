// lib/legal-config.js  (Prenolia: dati legali da mostrare nelle pagine privacy e termini)
//
// Compila qui UNA SOLA VOLTA i dati dell'azienda che gestisce Prenolia.
// Finché un campo è vuoto, nella pagina compare un'evidenza gialla "[da compilare]".
module.exports = {
  ragioneSociale: "",   // es. "Mario Rossi" oppure "Prenolia S.r.l."
  sede: "",             // es. "Via Roma 1, 10022 Carmagnola (TO)"
  piva: "",             // partita IVA (o codice fiscale se non ce l'hai)
  emailPrivacy: "",     // es. "privacy@prenolia.it"
  foro: "",             // es. "Torino" (tribunale competente per le controversie)
  aggiornato: "21 ottobre 2026",
  versione: "1.1",
};
