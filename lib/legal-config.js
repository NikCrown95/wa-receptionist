// lib/legal-config.js  (Prenolia: dati legali da mostrare nelle pagine privacy, termini e cookie)
//
// Compila qui UNA SOLA VOLTA i dati di chi gestisce Prenolia.
// Finché un campo necessario è vuoto, nella pagina compare un'evidenza gialla "[da compilare]".
//
// FASE DI TEST (statoTest: true): Prenolia è gestita da una persona fisica, senza partita IVA.
// Le pagine mostrano nome, cognome (e codice fiscale, se lo scrivi) al posto di ragione sociale e P. IVA.
// Quando aprirai la partita IVA: statoTest: false, compila ragioneSociale e piva, aggiorna versione e data.
module.exports = {
  statoTest: true,
  nomeTitolare: "Nico Corona",     // nome e cognome di chi gestisce Prenolia (persona fisica)
  codiceFiscale: "",    // facoltativo: se lo scrivi compare nelle pagine
  ragioneSociale: "",   // dopo l'apertura della partita IVA, es. "Prenolia S.r.l." o "Mario Rossi"
  sede: "Carmagnola (TO)",       // comune (o indirizzo completo) della sede
  piva: "",             // partita IVA, quando ci sarà
  emailPrivacy: "assistenza@prenolia.it",
  foro: "Torino",           // es. "Torino" (tribunale competente per le controversie)
  aggiornato: "10 novembre 2026",
  versione: "2.0",
};
