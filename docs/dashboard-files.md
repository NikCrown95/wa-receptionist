# Dashboard: dove si trovano gli stili e gli script

La pagina della dashboard (`api/agenda.js`) non contiene piu' tutto il codice in una sola stringa.
Le parti grandi sono file normali, che si possono modificare direttamente:

| File | Contenuto |
| --- | --- |
| `public/dash/app.css` | tutti gli stili principali (le sezioni sono separate da commenti `/* ===== nome ===== */`) |
| `public/dash/profile-ref.css` | stili della scheda "Invita un amico" |
| `public/dash/app-nav.js` | navigazione tra le sezioni e menu |
| `public/dash/notes.js` | note del cliente e delle visite |
| `public/dash/push.js` | notifiche sul telefono |
| `public/dash/stats.js` | statistiche |
| `public/dash/settings.js` | impostazioni |
| `public/dash/service-sheet.js` | foglio per modificare un servizio |
| `public/dash/nav-core.js` | logica del tasto indietro |
| `public/dash/themes.js` | selettore e caricamento dei temi extra Nero e Rosa (solo personal trainer) |
| `public/dash/theme-nero.css`, `theme-rosa.css` | **generati**, non modificare a mano (vedi sotto) |
| `public/share.js`, `public/share.css` | menu, scheda attivita', condivisione, guida |

Restano dentro `api/agenda.js` (nella stringa `PAGE`) lo script del calendario e quello della campanella,
perche' il server li modifica al volo per le palestre (`patchGymBell`).

## Dopo ogni modifica a un file in `public/`

```
node scripts/bump-assets.js
```

Aggiorna il numero `?v=...` nei collegamenti di `api/agenda.js`, cosi' i browser scaricano la versione nuova.
Senza questo passo gli utenti possono continuare a vedere il file vecchio.

## Temi Nero e Rosa (solo personal trainer)

I due fogli `public/dash/theme-nero.css` e `theme-rosa.css` si **generano** dagli stessi CSS del tema scuro con `node scripts/build-themes.js`
(colori turchesi/blu rimappati a parita' di luminosita', stesso ordine delle regole). `node scripts/bump-assets.js` li rigenera da solo, quindi basta
lanciare quello dopo ogni modifica ai CSS. Il colore d'accento del Nero si cambia con la variabile `NERO_ACCENT` (oro, argento, rosso; di base oro);
la palette dei due temi sta in `scripts/build-themes.js` (`THEMES`, `neroVars`). Ritocchi a mano: funzione `extra()` nello stesso file.
Se in un CSS si scrive un colore turchese/blu a mano, nei due temi viene rimappato da solo; per colori scelti da JavaScript usare `var(--accent)` o simili.
