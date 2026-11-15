# Pagine di settore della landing (SEO)

La home `prenolia.it` mostra tutti i settori. Ogni settore ha anche una pagina
dedicata con la stessa landing, ma con animazione in alto, sezione Dashboard e
"Per chi e'?" (telefono) limitati a quel settore, e con titolo/descrizione/canonical propri.

- Sorgente unico: `public/provahtml/index.html`. Se `window.PSEC` e' impostato
  (h, c, m, d, p) la landing si blocca su quel settore; senza, funziona come sempre.
- Le pagine `public/provahtml/<slug>.html` sono GENERATE da
  `python3 scripts/build-sector-pages.py`. **Dopo ogni modifica a
  `public/provahtml/index.html` va rieseguito lo script** e vanno committate
  anche le pagine generate, altrimenti restano indietro rispetto alla home.
- Per ogni pagina servono: voce in `SECTORS` dello script, rewrite in `vercel.json`
  (es. `/servizi-alla-persona` -> `/provahtml/servizi-alla-persona.html`), lo slug
  nella lista di esclusione della rewrite `/:slug(...)` (altrimenti sarebbe letto come
  attivita') e l'indirizzo in `public/sitemap.xml` quando la pagina e' approvata.
- Pagine attive (tutte in sitemap): servizi-alla-persona (h), centri-sportivi (c), personal-trainer (p), studi-medici (m), servizi-a-domicilio (d).
