// lib/validate.js  (Prenolia: controllo di telefono ed email inseriti dai clienti)
// Le due funzioni sono scritte "semplici" (nessuna sintassi moderna) perche' il loro testo viene copiato
// identico nella pagina di prenotazione: cosi' browser, server e Lia applicano le stesse regole.
// Restituiscono "" se il valore va bene, altrimenti la frase da mostrare al cliente.

function phoneProblem(raw) {
  var s = String(raw == null ? "" : raw).trim();
  if (!s) return "Scrivi il numero di telefono.";
  if (/[^\d\s+().\-\/]/.test(s)) return "Il numero può contenere solo cifre, spazi e il segno +.";
  if (s.lastIndexOf("+") > 0) return "Il segno + va solo all’inizio del numero.";
  var plus = s.charAt(0) === "+";
  var d = s.replace(/\D/g, "");
  if (!plus && d.slice(0, 2) === "00") { plus = true; d = d.slice(2); }
  var national = d;
  if (plus) {
    if (d.slice(0, 2) === "39") national = d.slice(2);
    else {
      if (d.length < 9 || d.length > 15) return "Il numero estero non sembra completo. Controllalo (prefisso del Paese e numero).";
      national = d.slice(3);
    }
  }
  if (!plus || d.slice(0, 2) === "39") {
    var c = national.charAt(0);
    if (c === "3") {
      if (!/^3\d{8,9}$/.test(national)) return "Un cellulare italiano ha di solito 10 cifre e inizia con 3 (es. 345 123 4567). Controlla il numero.";
    } else if (c === "0") {
      if (!/^0\d{5,10}$/.test(national)) return "Un numero fisso italiano inizia con 0 e ha da 6 a 11 cifre. Controlla il numero.";
    } else {
      return "Il numero deve iniziare con 3 (cellulare) o con 0 (fisso). Se è estero, scrivilo con il prefisso, es. +41.";
    }
  }
  if (/(\d)\1{6,}/.test(national) || national.replace(/(\d)(?=.*\1)/g, "").length <= 2) return "Il numero non sembra vero. Controllalo.";
  var up = true, down = true, i;
  for (i = 1; i < national.length; i++) {
    var a = Number(national.charAt(i - 1)), b = Number(national.charAt(i));
    if ((a + 1) % 10 !== b) up = false;
    if ((b + 1) % 10 !== a) down = false;
  }
  if (national.length >= 8 && (up || down)) return "Il numero non sembra vero. Controllalo.";
  return "";
}

function emailProblem(raw) {
  var s = String(raw == null ? "" : raw).trim().toLowerCase();
  if (!s) return "";
  if (s.indexOf("@") < 0) return "Nell’email manca la chiocciola (@). Controllala oppure lasciala vuota.";
  if (/\s/.test(s) || s.length > 120) return "L’email non sembra corretta. Controllala oppure lasciala vuota.";
  var p = s.split("@");
  if (p.length !== 2 || !p[0] || !p[1]) return "L’email non sembra corretta. Controllala oppure lasciala vuota.";
  var local = p[0], dom = p[1];
  if (!/^[a-z0-9._%+\-']+$/.test(local) || local.charAt(0) === "." || local.charAt(local.length - 1) === "." || local.indexOf("..") >= 0) return "L’email non sembra corretta. Controllala oppure lasciala vuota.";
  var labels = dom.split(".");
  if (labels.length < 2) return "Nell’email manca la parte finale dopo il punto (es. .it o .com). Controllala oppure lasciala vuota.";
  var j;
  for (j = 0; j < labels.length; j++) {
    if (!/^[a-z0-9-]+$/.test(labels[j]) || labels[j].charAt(0) === "-" || labels[j].charAt(labels[j].length - 1) === "-") return "L’email non sembra corretta. Controllala oppure lasciala vuota.";
  }
  if (!/^[a-z]{2,24}$/.test(labels[labels.length - 1])) return "L’email non sembra corretta. Controllala oppure lasciala vuota.";
  var typos = { "gmai.com": "gmail.com", "gmial.com": "gmail.com", "gmal.com": "gmail.com", "gnail.com": "gmail.com", "gamil.com": "gmail.com", "gmaill.com": "gmail.com", "gmail.con": "gmail.com", "gmail.co": "gmail.com", "gmail.cm": "gmail.com",
    "hotmial.com": "hotmail.com", "hotmai.com": "hotmail.com", "hotmail.con": "hotmail.com", "hotnail.com": "hotmail.com", "outlok.com": "outlook.com", "outlook.con": "outlook.com", "outlook.co": "outlook.com", "iclod.com": "icloud.com", "icloud.con": "icloud.com", "icoud.com": "icloud.com",
    "yaho.com": "yahoo.com", "yahoo.con": "yahoo.com", "yahooo.com": "yahoo.com", "libero.con": "libero.it", "libero.i": "libero.it", "liberoo.it": "libero.it", "virgilio.i": "virgilio.it", "tiscali.i": "tiscali.it" };
  if (typos[dom]) return "L’email sembra avere un errore: intendevi " + local + "@" + typos[dom] + "? Correggila oppure lasciala vuota.";
  return "";
}

module.exports = {
  phoneProblem: phoneProblem,
  emailProblem: emailProblem,
  // Testo da copiare nella pagina pubblica (stesse regole del server).
  clientSource: phoneProblem.toString() + "\n" + emailProblem.toString(),
};
