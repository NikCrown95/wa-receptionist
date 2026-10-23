// Indirizzo pubblico del sito e link brevi. Un solo posto da cambiare.
// PUBLIC_URL su Vercel (es. https://prenolia.it). Finche' non e' impostato si usa il vecchio indirizzo.
const FALLBACK = "https://wa-receptionist-sigma.vercel.app";

function baseUrl() { return String(process.env.PUBLIC_URL || FALLBACK).replace(/\/+$/, ""); }

// Link pubblico di prenotazione: prenolia.it/nome-attivita (palestre: /palestra/nome)
// altBase: indirizzo della richiesta, usato solo se PUBLIC_URL non e' impostato
function bookingUrl(slug, type, altBase) {
  const s = encodeURIComponent(String(slug || ""));
  return (process.env.PUBLIC_URL ? baseUrl() : String(altBase || baseUrl()).replace(/\/+$/, "")) + (type === "palestra" ? "/palestra/" : type === "centro_sportivo" ? "/circolo/" : "/") + s;
}

// Link per annullare dall'email: prenolia.it/nome-attivita?cancel=ID&k=FIRMA
function cancelPath(slug) { return baseUrl() + "/" + encodeURIComponent(String(slug || "")); }

module.exports = { baseUrl, bookingUrl, cancelPath, FALLBACK };
