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
| `public/share.js`, `public/share.css` | menu, scheda attivita', condivisione, guida |

Restano dentro `api/agenda.js` (nella stringa `PAGE`) lo script del calendario e quello della campanella,
perche' il server li modifica al volo per le palestre (`patchGymBell`).

## Dopo ogni modifica a un file in `public/`

```
node scripts/bump-assets.js
```

Aggiorna il numero `?v=...` nei collegamenti di `api/agenda.js`, cosi' i browser scaricano la versione nuova.
Senza questo passo gli utenti possono continuare a vedere il file vecchio.
