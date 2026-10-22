# DPIA: verticale sanitaria di Prenolia (bozza)

Versione 1.0, 22 ottobre 2026. Valutazione d'impatto (art. 35 GDPR) per il servizio di prenotazione offerto a dentisti, fisioterapisti e studi medici. **Bozza da far rivedere a un consulente privacy/DPO prima del lancio.** Ogni studio titolare dovrà valutare la propria DPIA; questo documento e la [scheda del trattamento](scheda-trattamento-sanitari.md) servono da base.

## 1. Perché serve
Anche limitata a nome, telefono e orario, la prenotazione presso uno studio sanitario rivela una informazione sulla salute (categoria particolare, art. 9). Il trattamento è su più studi (scala), riguarda persone che possono essere vulnerabili e usa un servizio online esterno: si valuta quindi l'impatto per prudenza.

## 2. Descrizione del trattamento
Vedi scheda descrittiva: finalità, dati, conservazione, fornitori. Flusso: il paziente apre la pagina pubblica dello studio, sceglie giorno/ora, inserisce nome e telefono (email facoltativa), accetta l'informativa e prenota. Lo studio vede l'appuntamento in agenda e riceve una notifica neutra. Il paziente può ricevere email neutra di conferma e promemoria.

## 3. Necessità e proporzionalità
| Aspetto | Valutazione |
|---|---|
| Base giuridica | consenso esplicito, specifico, registrato; senza consenso non si prenota (lo studio dovrebbe offrire anche la prenotazione telefonica come alternativa) |
| Minimizzazione | niente indirizzo, note, chat, IA, dati clinici; email facoltativa |
| Limitazione conservazione | anonimizzazione automatica a 12 mesi |
| Trasparenza | informativa dedicata e pagina privacy; accordo art. 28 |
| Diritti | esercitabili verso lo studio; export e cancellazione disponibili |
| Responsabili | elenco sub-responsabili, DPA da acquisire e archiviare |

## 4. Rischi e misure
| # | Rischio | Prob. | Gravità | Misura | Residuo |
|---|---|---|---|---|---|
| 1 | Accesso non autorizzato all'agenda (link/token perso o condiviso) | media | alta | token lungo e casuale, possibilità di rigenerarlo, nessuna nota clinica in agenda | medio |
| 2 | Deduzione di condizioni di salute da email/notifiche | bassa | media | email e push neutre senza prestazione, operatore o nome | basso |
| 3 | Trasmissione di dati sanitari a servizi di IA | bassa | alta | Lia/chat/Telegram bloccate nel codice per il verticale | molto basso |
| 4 | Conservazione eccessiva | media | media | anonimizzazione a 12 mesi, esecuzione automatica da verificare periodicamente | basso |
| 5 | Accesso del personale Prenolia ai dati dei pazienti | bassa | alta | dati mascherati nel pannello admin, conversazioni non consultabili | basso |
| 6 | Violazione dei dati presso un fornitore | bassa | alta | hosting UE per il database, DPA, notifica entro 24 ore al titolare | medio |
| 7 | Trasferimento extra-UE (Resend, Vercel) | media | media | solo email neutre con nome studio, giorno e ora; garanzie contrattuali dei fornitori | basso |
| 8 | Mancato consenso valido (paziente inserisce dati di terzi, minori) | media | media | casella obbligatoria, registro data/versione; lo studio gestisce i minori con chi esercita la responsabilità genitoriale | medio |
| 9 | Errore di configurazione (studio sanitario non riconosciuto come tale) | bassa | alta | tipo "Altro" escluso dalla registrazione sanitaria; protezioni attive in base al tipo di attività | basso |
| 10 | Esercizio dei diritti non gestito | bassa | media | export, cancellazione, assistenza al titolare nell'accordo | basso |

## 5. Misure ancora da completare (azioni)
1. Compilare i dati legali di Prenolia in `lib/legal-config.js`.
2. Far rivedere informativa, accordo art. 28 e questa DPIA da un professionista.
3. Acquisire e archiviare i DPA di Supabase, Vercel, Resend e verificare le garanzie per i trasferimenti USA.
4. Verificare ogni 3 mesi che la pulizia automatica dei dati (`retention_cleanup`) giri e produca risultati (anche con una simulazione).
5. Predisporre la procedura interna di violazione dei dati (chi avvisa chi, entro 24 ore).
6. Valutare se Prenolia debba tenere un proprio registro dei trattamenti come responsabile (art. 30.2) e se serva un DPO.
7. Decidere se aggiungere una conferma di autenticazione più forte per l'accesso all'agenda (es. codice via email).
8. Rivedere la DPIA a ogni nuova funzione che tocchi i dati dei pazienti.

## 6. Conclusione
Con le misure attive il rischio residuo è **medio-basso** e accettabile, a condizione di completare le azioni del punto 5 prima di offrire il servizio a clienti reali. Non si ritiene necessaria la consultazione preventiva del Garante (art. 36) se i rischi 1, 6 e 8 restano a livello medio.
