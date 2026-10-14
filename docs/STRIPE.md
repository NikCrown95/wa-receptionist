# Stripe: come attivarlo (in modalità di prova, poi dal vivo)

Tutto il codice è già pronto. Mancano solo l'account Stripe e tre variabili su Vercel.
Si può fare tutto dall'iPad. Parti in **modalità di prova** (nessun soldo vero): quando avrai la partita IVA si passa al vivo cambiando due chiavi.

## Cosa fa il sistema
- **Prova gratuita di 14 giorni** al momento della registrazione, senza carta.
- Dalle Impostazioni → Abbonamento il titolare tocca **Attiva l'abbonamento** (24,99 € al mese) e paga su una pagina Stripe.
  Se è ancora in prova, il primo addebito parte **alla fine della prova**: non paga niente prima.
- Dopo la scadenza ci sono **3 giorni di tolleranza**, poi la pagina di prenotazione e Lia si fermano.
- **Disdetta stile Netflix**: dal pulsante *Gestisci pagamento e fatture* il titolare disdice e il piano resta attivo fino alla fine del periodo già pagato. Nessun rimborso.
- Stripe raccoglie indirizzo e partita IVA del cliente: ti servono per la fattura, che emetti tu.
- Email automatiche (da Prenolia): abbonamento attivato, pagamento non riuscito, disdetta registrata. Con `BILLING_EMAILS=1` anche: prova in scadenza (3 giorni prima), scaduto (inizio tolleranza), in pausa.

## 1. Account Stripe (modalità di prova)
1. Vai su stripe.com e crea un account. Per ora resta in **Modalità di prova** (interruttore in alto): non serve attivare l'account né la partita IVA.
2. (Facoltativo) *Catalogo prodotti* → *Aggiungi prodotto*: nome "Prenolia Smart", prezzo ricorrente **24,99 € / mese**. Copia l'ID del prezzo (inizia con `price_`).
   Se salti questo passaggio, il prezzo viene preso dal database (24,99 €).

## 2. Portale clienti (serve per disdire e cambiare carta)
*Impostazioni* → *Fatturazione* → *Portale clienti* → attiva e salva:
- Permetti ai clienti di **annullare gli abbonamenti** → *Alla fine del periodo di fatturazione*.
- Permetti di **aggiornare il metodo di pagamento** e di **vedere la cronologia delle fatture**.

## 3. Webhook
*Sviluppatori* → *Webhook* → *Aggiungi endpoint*:
- **URL**: `https://prenolia.it/api/stripe-webhook`
- **Eventi**: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`
- Dopo averlo creato copia il **Segreto di firma** (inizia con `whsec_`).

## 4. Variabili su Vercel (Settings → Environment Variables, tipo Secret)
| Nome | Valore |
|---|---|
| `STRIPE_SECRET_KEY` | la chiave segreta (`sk_test_...`), da *Sviluppatori → Chiavi API* |
| `STRIPE_WEBHOOK_SECRET` | il segreto del webhook (`whsec_...`) |
| `STRIPE_PRICE_ID` | (facoltativa) l'ID del prezzo `price_...` |
| `BILLING_EMAILS` | `1` per attivare le email di scadenza (dopo il lancio) |

Poi fai un nuovo deploy (Redeploy) perché le variabili vengano lette.

## 5. Prova
1. Dall'agenda → Impostazioni → Abbonamento → **Attiva l'abbonamento**.
2. Paga con la carta di prova `4242 4242 4242 4242`, scadenza futura, CVC qualsiasi.
3. Tornando all'agenda deve comparire *Abbonamento attivato*.
4. In Stripe → Webhook controlla che gli eventi risultino consegnati (risposta 200). Se vedi errori 400 di firma, il segreto `whsec_` è sbagliato.

## 6. Passare al vivo (quando avrai la partita IVA)
1. In Stripe completa l'attivazione dell'account e passa a *Modalità live*.
2. Ripeti i punti 1-3 in modalità live (prodotto/prezzo, portale, webhook): le chiavi e i segreti live sono diversi.
3. Sostituisci su Vercel `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (e `STRIPE_PRICE_ID` se l'hai usato) con quelli live e rifai il deploy.

## Fattura
Il pagamento arriva da Stripe; la fattura la emetti tu. Per ogni pagamento trovi in Stripe i dati del cliente (nome, indirizzo, partita IVA). Codice SDI/PEC non si possono chiedere nella pagina di pagamento: te li scrive il cliente dall'assistenza.
