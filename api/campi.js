// api/campi.js  (Prenolia: pagina pubblica di prenotazione dei campi, per circoli e centri sportivi)
// Link: prenolia.it/circolo/nome-circolo  (vercel.json lo manda qui con ?b=nome-circolo)
// Un solo file: serve la pagina (HTML) e i dati (JSON): ?info=1, ?date=AAAA-MM-GG, POST per prenotare.

const courtsLib = require("../lib/courts.js");
const mail = require("../lib/mail.js");
const { getAccess, BOOKING_BLOCKED_MESSAGE } = require("../lib/access.js");

function sbHeaders(extra) {
  const key = process.env.SUPABASE_SECRET_KEY || "";
  const h = { apikey: key, "Content-Type": "application/json" };
  if (key.startsWith("eyJ")) h.Authorization = "Bearer " + key;
  return Object.assign(h, extra || {});
}
async function sb(method, path, body, prefer) {
  const res = await fetch(process.env.SUPABASE_URL + "/rest/v1/" + path, { method, headers: sbHeaders(prefer ? { Prefer: prefer } : {}), body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
  return { ok: res.ok, status: res.status, data };
}

const PAGE = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="dark">
<link rel="icon" type="image/png" sizes="512x512" href="/brand/favicon-512.png?v=2">
<title>Prenota un campo</title>
<style>
:root{--bg:#050608;--card:#0E131B;--card2:#161D29;--line:#1C2532;--line2:#2A3648;--ink:#F9F6F0;--muted:#9BA6B5;--accent:#4BB3D6;--on-accent:#04141A;--accent-soft:#0E2A33;--accent-ink:#B5E4F2;--green:#3FE08A;--err:#FF8A8A;--amber:#F5C15E;--amber-soft:#2A200A;color-scheme:dark}
*{box-sizing:border-box}
html{background:var(--bg)}
body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Helvetica Neue",Arial,sans-serif;font-size:16px;line-height:1.45;-webkit-font-smoothing:antialiased;padding-block:calc(18px + env(safe-area-inset-top,0px)) calc(40px + env(safe-area-inset-bottom,0px));padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
h1,h2,h3,p{margin:0}
.w{max-width:640px;margin:0 auto;display:grid;gap:16px}
.hd h1{font-size:1.6rem;letter-spacing:-.02em;line-height:1.15;overflow-wrap:anywhere}
.hd p{color:var(--muted);font-size:.92rem;margin-top:4px;overflow-wrap:anywhere}
.note{display:flex;gap:10px;align-items:flex-start;border:1px solid var(--line2);background:var(--card);border-radius:16px;padding:12px 14px;font-size:.9rem;color:var(--ink)}
.note b{font-weight:650}
.note.fit{border-color:#6a5420;background:var(--amber-soft)}
.note i{flex:none;font-style:normal;font-weight:800;color:var(--accent-ink)}
.note.fit i{color:var(--amber)}
h2{font-size:1.05rem;letter-spacing:-.01em}
.days{display:flex;gap:8px;overflow-x:auto;padding:2px 2px 8px;margin:0 -2px;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.days::-webkit-scrollbar{display:none}
.day{flex:none;min-width:58px;min-height:64px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;border:1.5px solid var(--line2);background:var(--card);color:var(--ink);border-radius:16px;padding:6px 8px;font:inherit;cursor:pointer}
.day span{font-size:.72rem;color:var(--muted);font-weight:600}
.day b{font-size:1.1rem}
.day[aria-pressed=true]{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}
.day[aria-pressed=true] span{color:rgba(4,20,26,.7)}
.court{border:1px solid var(--line2);background:var(--card);border-radius:18px;padding:14px;display:grid;gap:10px}
.court .t{display:flex;justify-content:space-between;gap:10px;align-items:baseline;flex-wrap:wrap}
.court h3{font-size:1.02rem}
.court small{color:var(--muted);font-size:.82rem}
.slots{display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:8px}
.slot{min-height:46px;border:1.5px solid var(--line2);background:var(--card2);color:var(--ink);border-radius:13px;font:inherit;font-weight:650;font-size:.95rem;cursor:pointer;font-variant-numeric:tabular-nums}
.slot:hover{border-color:var(--accent)}
.slot[aria-pressed=true]{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}
.none{color:var(--muted);font-size:.88rem}
.form{border:1px solid var(--line2);background:var(--card);border-radius:18px;padding:16px;display:grid;gap:12px}
.pick{background:var(--accent-soft);border:1px solid color-mix(in srgb,var(--accent) 40%,var(--line));border-radius:14px;padding:10px 12px;font-weight:650;color:var(--accent-ink)}
.f2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
label{display:grid;gap:5px;font-size:.84rem;font-weight:600;color:var(--muted);min-width:0}
input[type=text],input[type=tel],input[type=email],input[type=number]{width:100%;min-height:50px;border-radius:14px;border:1.5px solid var(--line2);background:var(--card2);color:var(--ink);font:inherit;font-size:16px;padding:0 14px;min-width:0}
input:focus{outline:3px solid var(--accent);outline-offset:1px;border-color:var(--accent)}
.help{font-size:.78rem;color:var(--muted);font-weight:500}
.chk{display:flex;gap:12px;align-items:flex-start;border:1.5px solid #6a5420;background:var(--amber-soft);border-radius:14px;padding:12px 14px;color:var(--ink);font-size:.92rem;font-weight:500;cursor:pointer}
.chk input{flex:none;width:24px;height:24px;margin:1px 0 0;accent-color:var(--accent)}
.btn{min-height:54px;border-radius:16px;border:0;background:var(--accent);color:var(--on-accent);font:inherit;font-weight:750;font-size:1rem;cursor:pointer}
.btn[disabled]{opacity:.55;cursor:default}
.btn.ghost{background:var(--card2);color:var(--ink);border:1px solid var(--line2)}
.err{color:var(--err);font-weight:600;font-size:.9rem}
.ok{border:1px solid color-mix(in srgb,var(--green) 45%,var(--line));background:var(--card);border-radius:20px;padding:20px;display:grid;gap:12px}
.ok h2{font-size:1.4rem;color:var(--green)}
.ok dl{margin:0;display:grid;gap:6px}
.ok dt{font-size:.78rem;color:var(--muted);font-weight:600}
.ok dd{margin:0 0 6px;font-weight:650}
.ld{color:var(--muted);text-align:center;padding:26px 0}
.foot{color:var(--muted);font-size:.78rem;text-align:center}
:focus-visible{outline:3px solid var(--accent);outline-offset:2px;border-radius:10px}
</style>
</head>
<body>
<div class="w" id="app"><div class="ld">Carico…</div></div>
<script>
(function(){
  var slug=decodeURIComponent(location.pathname.split('/').filter(Boolean).pop()||'');
  var API='/api/campi?b='+encodeURIComponent(slug);
  var app=document.getElementById('app');
  var DN=['dom','lun','mar','mer','gio','ven','sab'],DL=['domenica','lunedì','martedì','mercoledì','giovedì','venerdì','sabato'],MO=['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
  var S={auto:0,info:null,day:null,free:null,pick:null,busy:false,err:'',done:null,f:{first_name:'',last_name:'',phone:'',email:'',players:'',members:'',fit_ok:false}};
  function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
  function pd(s){var p=s.split('-');return new Date(Date.UTC(+p[0],+p[1]-1,+p[2]))}
  function pad(n){return String(n).padStart(2,'0')}
  function fmt(d){return d.getUTCFullYear()+'-'+pad(d.getUTCMonth()+1)+'-'+pad(d.getUTCDate())}
  function add(s,n){var d=pd(s);d.setUTCDate(d.getUTCDate()+n);return fmt(d)}
  function long(s){var d=pd(s);return DL[d.getUTCDay()]+' '+d.getUTCDate()+' '+MO[d.getUTCMonth()]}
  function eur(n){return (Math.round(n*100)%100===0?String(Math.round(n)):Number(n).toFixed(2).replace('.',','))+' €'}
  function dur(m){return m<60?m+' min':(m%60?(m/60).toString().replace('.',',')+' ore':(m/60===1?'1 ora':(m/60)+' ore'))}
  function api(body,q){var o=body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{};return fetch(API+(q||''),o).then(function(r){return r.json().catch(function(){return{}}).then(function(j){if(!r.ok)throw new Error(j.error||'Errore, riprova.');return j})})}
  function loadDay(){S.free=null;S.pick=null;S.err='';draw();api(null,'&date='+S.day).then(function(j){if(S.auto&&!j.courts.some(function(c){return c.slots.length})&&S.day<S.info.last_day){S.auto--;S.day=add(S.day,1);loadDay();return}S.auto=0;S.free=j.courts;draw()}).catch(function(e){S.auto=0;S.err=e.message;S.free=[];draw()})}
  function note(cls,ic,html){var n=el('div','note '+cls);n.appendChild(el('i',null,ic));var d=el('div');d.innerHTML=html;n.appendChild(d);return n}
  function draw(){
    app.textContent='';var I=S.info;
    if(S.done){var d=S.done,o=el('div','ok');o.appendChild(el('h2',null,'Prenotazione confermata'));
      var dl=el('dl');function row(a,b){dl.appendChild(el('dt',null,a));dl.appendChild(el('dd',null,b))}
      row('Campo',d.court);row('Quando',long(d.date)+', dalle '+d.start+' alle '+d.end);row('Giocatori',d.players+' (di cui '+d.members+(d.members===1?' socio)':' soci)'));
      if(d.price_eur!=null)row('Da pagare al circolo',eur(d.price_eur));o.appendChild(dl);
      if(I.club.fit)o.appendChild(note('fit','!','<b>Ricorda:</b> porta la tessera FIT e il certificato medico di tutti i giocatori.'));
      o.appendChild(el('p',null,'Il pagamento si fa direttamente al circolo.'+(S.done.email_sent?' Ti abbiamo mandato la conferma via email.':'')));
      if(I.phone){var a=el('p');a.appendChild(document.createTextNode('Per disdire o cambiare orario chiama il '));var l=el('a',null,I.phone);l.href='tel:'+I.phone.replace(/[^+\\d]/g,'');l.style.color='var(--accent-ink)';a.appendChild(l);a.appendChild(document.createTextNode('.'));o.appendChild(a)}
      var b=el('button','btn ghost','Prenota un altro campo');b.type='button';b.onclick=function(){S.done=null;S.pick=null;S.f.fit_ok=false;loadDay()};o.appendChild(b);app.appendChild(o);return}
    var hd=el('div','hd');hd.appendChild(el('h1',null,I.name));var sub=[I.tagline,I.address].filter(Boolean).join(' · ');if(sub)hd.appendChild(el('p',null,sub));app.appendChild(hd);
    app.appendChild(note('','i',I.club.open_to==='members'?'<b>Prenotano i soci.</b> Serve almeno un socio tra i giocatori.':'<b>Possono prenotare soci e non soci.</b> Ti chiederemo quanti dei giocatori sono soci.'));
    if(I.club.fit)app.appendChild(note('fit','!','<b>Circolo affiliato FIT.</b> Per giocare servono la tessera FIT e il certificato medico.'));
    app.appendChild(note('','€','Il pagamento si fa direttamente al circolo.'));
    app.appendChild(el('h2',null,'Scegli il giorno'));
    var days=el('div','days');days.setAttribute('role','group');
    for(var d0=I.today;d0<=I.last_day;d0=add(d0,1)){(function(dd){var b=el('button','day');b.type='button';b.setAttribute('aria-pressed',dd===S.day?'true':'false');b.setAttribute('aria-label',long(dd));b.appendChild(el('span',null,DN[pd(dd).getUTCDay()]));b.appendChild(el('b',null,String(pd(dd).getUTCDate())));b.onclick=function(){S.day=dd;loadDay()};days.appendChild(b)})(d0)}
    app.appendChild(days);
    if(S.err&&!S.pick)app.appendChild(el('p','err',S.err));
    if(!S.free){app.appendChild(el('div','ld','Cerco gli orari liberi…'));return}
    var any=false;
    I.courts.forEach(function(c){var fc=S.free.filter(function(x){return x.id===c.id})[0],slots=fc?fc.slots:[];if(slots.length)any=true;
      var box=el('div','court'),t=el('div','t');t.appendChild(el('h3',null,c.name));
      t.appendChild(el('small',null,[c.surface,c.indoor?'coperto':'',dur(c.slot_min),c.price_eur!=null?eur(c.price_eur):''].filter(Boolean).join(' · ')));box.appendChild(t);
      if(!slots.length)box.appendChild(el('p','none','Nessun orario libero in questo giorno.'));
      else{var g=el('div','slots');slots.forEach(function(s){var b=el('button','slot',s.time);b.type='button';var on=S.pick&&S.pick.court_id===c.id&&S.pick.time===s.time;b.setAttribute('aria-pressed',on?'true':'false');b.setAttribute('aria-label',c.name+' alle '+s.time+' fino alle '+s.end);b.onclick=function(){S.pick={court_id:c.id,court:c.name,time:s.time,end:s.end,price:c.price_eur};S.err='';draw();var f=document.getElementById('fm');if(f)f.scrollIntoView({behavior:'smooth',block:'start'})};g.appendChild(b)});box.appendChild(g)}
      app.appendChild(box)});
    if(!any&&!S.err)app.appendChild(el('p','none','Per questo giorno non ci sono campi liberi. Prova un altro giorno.'));
    if(S.pick)app.appendChild(form());
    app.appendChild(el('p','foot','I tuoi dati servono solo a gestire la prenotazione.'));
  }
  function form(){
    var P=S.pick,F=S.f,I=S.info,f=el('div','form');f.id='fm';
    f.appendChild(el('div','pick',P.court+' · '+long(S.day)+', '+P.time+'–'+P.end+(P.price!=null?' · '+eur(P.price):'')));
    function inp(l,k,type,ex,help){var lb=el('label',null,l),i=el('input');i.type=type;i.value=F[k];for(var x in (ex||{}))i.setAttribute(x,ex[x]);i.oninput=function(){F[k]=i.value};lb.appendChild(i);if(help)lb.appendChild(el('span','help',help));return lb}
    var r=el('div','f2');r.appendChild(inp('Nome','first_name','text',{autocomplete:'given-name',maxlength:60}));r.appendChild(inp('Cognome','last_name','text',{autocomplete:'family-name',maxlength:60}));f.appendChild(r);
    f.appendChild(inp('Telefono','phone','tel',{autocomplete:'tel',inputmode:'tel',maxlength:30}));
    f.appendChild(inp('Email (facoltativa)','email','email',{autocomplete:'email',inputmode:'email',maxlength:120},'Se la scrivi ti mandiamo la conferma.'));
    var r2=el('div','f2');r2.appendChild(inp('Quanti giocate','players','number',{inputmode:'numeric',min:1,max:22}));r2.appendChild(inp('Quanti sono soci','members','number',{inputmode:'numeric',min:0,max:22}));f.appendChild(r2);
    f.appendChild(el('p','help','Chi prenota è il referente. Indica quanti dei giocatori (te compreso) sono soci del circolo: se nessuno, scrivi 0.'));
    if(I.club.fit){var c=el('label','chk'),cb=el('input');cb.type='checkbox';cb.checked=F.fit_ok;cb.onchange=function(){F.fit_ok=cb.checked};c.appendChild(cb);c.appendChild(el('span',null,'Confermo che tutti i giocatori hanno la tessera FIT e il certificato medico in corso di validità, e li porterò al circolo.'));f.appendChild(c)}
    if(S.err){var e=el('p','err',S.err);e.setAttribute('role','alert');f.appendChild(e)}
    var b=el('button','btn',S.busy?'Prenoto…':'Conferma la prenotazione');b.type='button';b.disabled=S.busy;b.onclick=send;f.appendChild(b);return f}
  function send(){
    if(S.busy)return;var F=S.f,P=S.pick;
    S.busy=true;S.err='';draw();
    api({court_id:P.court_id,date:S.day,time:P.time,first_name:F.first_name,last_name:F.last_name,phone:F.phone,email:F.email,players:F.players,members:F.members,fit_ok:F.fit_ok===true})
      .then(function(j){S.busy=false;S.done=Object.assign({email_sent:j.email_sent},j.booking);draw();window.scrollTo(0,0)})
      .catch(function(e){S.busy=false;S.err=e.message;draw();var x=document.getElementById('fm');if(x)x.scrollIntoView({block:'center'});if(/appena stato preso/.test(e.message)){S.pick=null;api(null,'&date='+S.day).then(function(j){S.free=j.courts;draw()}).catch(function(){})}});
  }
  api(null,'&info=1').then(function(j){S.info=j;S.day=j.today;S.auto=7;loadDay()}).catch(function(e){app.textContent='';app.appendChild(el('p','err',e.message==='Attività non trovata'?'Questo circolo non è stato trovato.':e.message))});
})();
</script>
</body>
</html>`;

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const q = req.query || {};
    const slug = String(q.b || "");
    const wantsData = req.method === "POST" || q.info === "1" || !!q.date;
    if (req.method === "GET" && !wantsData) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(200).send(PAGE);
    }
    if (!/^[a-z0-9-]{1,60}$/.test(slug)) return res.status(404).json({ error: "Attività non trovata" });
    const r = await sb("GET", "businesses?slug=eq." + encodeURIComponent(slug) + "&active=eq.true&select=*&limit=1");
    const biz = r.ok && Array.isArray(r.data) && r.data[0];
    if (!biz || require("../lib/verticals.js").areaOf(biz.business_type) !== "campi") return res.status(404).json({ error: "Attività non trovata" });
    const acc = await getAccess(biz.id);
    if (!acc.allowed) return res.status(503).json({ error: BOOKING_BLOCKED_MESSAGE });

    if (req.method === "GET" && q.info === "1") { const o = await courtsLib.info(sb, biz); return res.status(o.status).json(o.body); }
    if (req.method === "GET" && q.date) { const o = await courtsLib.freeDay(sb, biz, String(q.date)); return res.status(o.status).json(o.body); }
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const o = await courtsLib.book(sb, biz, body);
      if (o.status !== 200) return res.status(o.status).json(o.body);
      const m = o._mail;
      let emailSent = false;
      try { await require("../lib/push.js").notifyNewBooking(biz.id, { name: m.first + " " + m.saved.last_name, service: m.court.name, startsAt: m.saved.starts_at, timezone: biz.timezone }); } catch (e) { /* non blocca */ }
      if (m.email) {
        try {
          const b = o.body.booking, sport = { tennis: "Tennis", padel: "Padel", calcio: "Calcio", altro: "" }[m.court.sport] || "";
          const extra = [["Giocatori", b.players + " (di cui " + b.members + (b.members === 1 ? " socio)" : " soci)")]];
          if (m.rules.fit) extra.push(["Da portare", "Tessera FIT e certificato medico di tutti i giocatori"]);
          extra.push(["Pagamento", "Al circolo" + (b.price_eur != null ? ", " + String(b.price_eur).replace(".", ",") + " €" : "")]);
          const em = mail.appointmentEmail({ kind: "confirm", bizName: biz.name, bizPhone: biz.public_phone || "", bizAddress: biz.address || "", customerName: m.first, service: m.court.name + (sport ? " · " + sport : ""), startsAt: m.startsAt.toISOString(), endsAt: m.endsAt.toISOString(), tz: biz.timezone, extraRows: extra, cancelLimitH: 0 });
          emailSent = await Promise.race([mail.sendMail(m.email, em.subject, em.html, em.text, biz.name), new Promise((ok) => setTimeout(() => ok(false), 4500))]);
        } catch (e) { console.error("Email di conferma non inviata:", e && e.message); }
      }
      return res.status(200).json({ ok: true, email_sent: !!emailSent, booking: o.body.booking });
    }
    return res.status(405).json({ error: "Metodo non consentito" });
  } catch (e) {
    console.error("campi:", e && e.message);
    return res.status(500).json({ error: "Errore del server" });
  }
};
