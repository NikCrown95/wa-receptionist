// Logo dell'attività: controlli sul file ricevuto e lettura/scrittura.
// Si accettano solo JPEG, PNG e WebP veri (si guardano i primi byte): niente SVG, che potrebbe contenere codice.
const MAX_BYTES = 150 * 1024;

function parseLogo(uri) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(String(uri || ""));
  if (!m) return { error: "Il logo deve essere una foto JPG, PNG o WebP." };
  const buf = Buffer.from(m[2], "base64");
  if (buf.length < 100) return { error: "L'immagine non sembra valida." };
  if (buf.length > MAX_BYTES) return { error: "L'immagine è troppo pesante. Riprova con un'altra foto." };
  const mime = m[1];
  const okMagic = mime === "image/jpeg" ? (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
    : mime === "image/png" ? (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)
    : (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP");
  if (!okMagic) return { error: "L'immagine non sembra valida." };
  return { mime, b64: m[2] };
}

function logoUrl(biz) {
  return biz && Number(biz.logo_v) > 0 && biz.slug ? "/api/booking?b=" + encodeURIComponent(biz.slug) + "&logo=1&v=" + Number(biz.logo_v) : null;
}

async function saveLogo(sb, biz, parsed) {
  const up = await sb("POST", "business_logos?on_conflict=business_id", { business_id: biz.id, mime: parsed.mime, data: parsed.b64, updated_at: new Date().toISOString() }, "resolution=merge-duplicates,return=minimal");
  if (!up.ok) return false;
  const v = (Number(biz.logo_v) || 0) + 1;
  const r = await sb("PATCH", "businesses?id=eq." + biz.id, { logo_v: v }, "return=minimal");
  if (!r.ok) return false;
  biz.logo_v = v;
  return true;
}

async function clearLogo(sb, biz) {
  await sb("DELETE", "business_logos?business_id=eq." + biz.id);
  const r = await sb("PATCH", "businesses?id=eq." + biz.id, { logo_v: 0 }, "return=minimal");
  if (r.ok) biz.logo_v = 0;
  return r.ok;
}

module.exports = { parseLogo, logoUrl, saveLogo, clearLogo };
