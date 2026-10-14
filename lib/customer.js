// lib/customer.js — eliminazione dei dati personali di un cliente (richiesta GDPR)
// Gli appuntamenti passati restano come numeri (servizio, prezzo, orario) per le statistiche, ma senza nome, telefono, email, indirizzo e note.
// Si cancellano anche le note sul cliente, le note per visita e la chat con Lia.

const { readAll, phoneKey } = require("./export.js");

const ANON = "Cliente eliminato";

function inList(values) {
  return "in.(" + values.map((v) => '"' + String(v).replace(/"/g, "") + '"').join(",") + ")";
}
function chunks(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

// Restituisce { ok:true, anonymized:N } oppure { ok:false, status, error }
async function deleteCustomer(biz, phone, sb) {
  const key = phoneKey(phone);
  if (!key || key.length < 6) return { ok: false, status: 400, error: "Numero di telefono non valido" };
  const id = biz.id;

  const all = await readAll(sb, "appointments?business_id=eq." + id + "&order=id.asc&select=id,customer_phone,starts_at,status");
  const mine = all.filter((a) => phoneKey(a.customer_phone) === key);
  const now = Date.now();
  const future = mine.filter((a) => a.status === "confirmed" && new Date(a.starts_at).getTime() > now);
  if (future.length) {
    return { ok: false, status: 409, error: future.length === 1 ? "Ha ancora un appuntamento in programma: annullalo prima di eliminare il cliente." : "Ha ancora " + future.length + " appuntamenti in programma: annullali prima di eliminare il cliente." };
  }

  const ids = mine.map((a) => a.id);
  const phones = new Set([String(phone).trim()]);
  mine.forEach((a) => { if (a.customer_phone) phones.add(String(a.customer_phone).trim()); });
  [key, "39" + key, "+39" + key].forEach((v) => phones.add(v));
  const plist = Array.from(phones).filter(Boolean);

  for (const part of chunks(ids, 80)) {
    const r = await sb("PATCH", "appointments?business_id=eq." + id + "&id=" + inList(part), { customer_name: ANON, customer_phone: "", customer_email: null, customer_address: null, notes: null, contact_id: null });
    if (!r.ok) return { ok: false, status: 500, error: "Non sono riuscito a eliminare i dati. Riprova." };
    await sb("DELETE", "appointment_notes?business_id=eq." + id + "&appointment_id=" + inList(part));
    await sb("PATCH", "notification_events?business_id=eq." + id + "&appointment_id=" + inList(part), { customer_name: ANON });
  }
  const enc = encodeURIComponent(inList(plist));
  await sb("DELETE", "customer_notes?business_id=eq." + id + "&customer_phone=" + enc);
  await sb("DELETE", "chat_messages?business_id=eq." + id + "&customer_phone=" + enc);

  sb("POST", "audit_logs", { actor: "owner", action: "delete_customer", business_id: id, details: { appointments: ids.length } }).catch(function () {});
  return { ok: true, anonymized: ids.length };
}

module.exports = { deleteCustomer, ANON };
