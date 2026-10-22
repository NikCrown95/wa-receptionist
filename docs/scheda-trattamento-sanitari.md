# Scheda descrittiva del trattamento: Prenolia per studi sanitari

Versione 1.2, 22 ottobre 2026. Da allegare dallo studio alla propria DPIA e al registro dei trattamenti (art. 30 GDPR).
Ruoli: lo studio sanitario è **titolare** del trattamento, Prenolia è **responsabile** (art. 28, accordo su /accordo-sanitari).

## 1. Finalità e base giuridica
- Finalità: gestione delle prenotazioni e dell'agenda dello studio, conferma e promemoria dell'appuntamento.
- Base giuridica: consenso esplicito del paziente (art. 6.1.a e art. 9.2.a), raccolto a ogni prenotazione con casella obbligatoria. La data e la versione dell'informativa sono registrate con l'appuntamento.
- Prenolia non è una cartella clinica e non serve a documentare prestazioni sanitarie.

## 2. Categorie di interessati e di dati
| Interessato | Dati trattati |
|---|---|
| Paziente | nome, telefono, email (facoltativa), data e ora dell'appuntamento, tipo di prestazione scelta, data/versione del consenso |
| Titolare / personale dello studio | email di accesso, nome del collaboratore (se inserito) |

Dati **non raccolti** per scelta di progetto: indirizzo, note libere o cliniche, messaggi di chat, dati di pagamento del paziente. L'esistenza stessa di un appuntamento presso uno studio sanitario è comunque trattata come dato relativo alla salute.

## 3. Misure di minimizzazione attive per gli studi sanitari
- Assistente IA (Lia), webchat e Telegram disattivati per codice: nessun testo del paziente va a servizi di IA.
- Campi indirizzo e note disattivati; il server rifiuta le note sui pazienti.
- Email di conferma/promemoria neutre: titolo "Appuntamento", nome dello studio, giorno e ora. Nessun servizio, operatore o nome del paziente.
- Notifiche push al titolare neutre.
- Riepilogo settimanale via email disattivato.
- L'amministrazione di Prenolia vede nomi, telefoni e prestazioni mascherati e non può leggere conversazioni.
- Il consenso è obbligatorio: senza di esso la prenotazione è rifiutata.

## 4. Conservazione
Dati personali del paziente anonimizzati automaticamente **12 mesi** dopo la data dell'appuntamento (nome, telefono, email, note rimossi). Il titolare può cancellare prima su richiesta dell'interessato.

## 5. Destinatari e sub-responsabili
| Fornitore | Ruolo | Dati | Sede |
|---|---|---|---|
| Supabase | database | tutti i dati sopra | UE (Irlanda) |
| Vercel | hosting, funzioni eseguite in Irlanda | transito dei dati | UE e USA |
| Resend | invio email | email, nome studio, giorno e ora (solo se il paziente lascia l'email) | USA |

I trasferimenti verso gli USA si basano sulle garanzie previste dai fornitori (clausole contrattuali standard / EU-US Data Privacy Framework). Da verificare e conservare i DPA dei fornitori.

## 6. Sicurezza
Connessioni cifrate (HTTPS), accesso del titolare tramite link/token personale, separazione dei dati per studio, accesso ai dati degli altri studi non possibile, accessi amministrativi a dati mascherati, notifica di violazioni al titolare entro 24 ore (accordo art. 28).

## 7. Diritti degli interessati
Accesso, rettifica, cancellazione, limitazione, opposizione e revoca del consenso si esercitano verso lo studio (titolare). Prenolia assiste lo studio nel rispondere. L'esportazione dei dati è disponibile nella sezione "I tuoi dati" della dashboard.
