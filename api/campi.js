// api/campi.js  (Prenolia: pagina pubblica di prenotazione dei campi, per circoli e centri sportivi)
// Link: prenolia.it/circolo/nome-circolo  (vercel.json lo manda qui con ?b=nome-circolo)
// Un solo file: serve la pagina (HTML) e i dati (JSON): ?info=1, ?date=AAAA-MM-GG, POST per prenotare.

const courtsLib = require("../lib/courts.js");
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
.hd{display:flex;gap:12px;align-items:flex-start;justify-content:space-between}
.hd>div{min-width:0}
.hd h1{font-size:1.6rem;letter-spacing:-.02em;line-height:1.15;overflow-wrap:anywhere}
.lbtn{flex:none;min-height:44px;padding:0 14px;border-radius:14px;border:1.5px solid var(--accent);background:var(--accent-soft);color:var(--accent-ink);font:inherit;font-weight:700;font-size:.86rem;cursor:pointer;display:inline-flex;gap:7px;align-items:center;white-space:nowrap}
.chat{border:1px solid var(--line2);background:var(--card);border-radius:20px;display:grid;grid-template-rows:minmax(0,1fr) auto auto;height:min(72vh,600px);height:min(72dvh,600px);overflow:hidden}
.msgs{overflow-y:auto;-webkit-overflow-scrolling:touch;padding:14px;display:flex;flex-direction:column;gap:8px}
.bub{max-width:86%;padding:10px 13px;border-radius:18px;font-size:.95rem;white-space:pre-wrap;overflow-wrap:anywhere}
.bub.lia{align-self:flex-start;background:var(--card2);border:1px solid var(--line);border-bottom-left-radius:6px}
.bub.me{align-self:flex-end;background:var(--accent);color:var(--on-accent);border-bottom-right-radius:6px}
.bub.err{border-color:var(--err);color:var(--err)}
.bub.ok{border-color:color-mix(in srgb,var(--green) 50%,var(--line));background:color-mix(in srgb,var(--green) 10%,var(--card2))}
.typ{align-self:flex-start;display:flex;gap:4px;padding:12px 14px;background:var(--card2);border-radius:18px;border:1px solid var(--line)}
.typ i{width:7px;height:7px;border-radius:50%;background:var(--muted);animation:bl 1s infinite ease-in-out}
.typ i:nth-child(2){animation-delay:.15s}.typ i:nth-child(3){animation-delay:.3s}
@keyframes bl{0%,80%,100%{opacity:.3}40%{opacity:1}}
@media (prefers-reduced-motion:reduce){.typ i{animation:none;opacity:.7}}
.bar{display:flex;gap:8px;padding:10px;border-top:1px solid var(--line)}
.bar input{flex:1;min-width:0;min-height:48px;border-radius:14px;border:1.5px solid var(--line2);background:var(--card2);color:var(--ink);font:inherit;font-size:16px;padding:0 14px}
.send{flex:none;width:48px;height:48px;border-radius:14px;border:0;background:var(--accent);color:var(--on-accent);display:grid;place-items:center;cursor:pointer;padding:0}
.send[disabled]{opacity:.5}
.cnote{margin:0;padding:0 12px 10px;text-align:center;color:var(--muted);font-size:.74rem}
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
  var S={mode:'book',auto:0,info:null,day:null,free:null,pick:null,busy:false,err:'',done:null,f:{first_name:'',last_name:'',phone:'',email:'',players:'',members:'',fit_ok:false}};
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

  var CH={sid:'',msgs:[],busy:false,box:null,list:null,input:null,btn:null};
  function uuid(){if(window.crypto&&crypto.randomUUID)return crypto.randomUUID();return'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g,function(){return(Math.random()*16|0).toString(16)})}
  function lsGet(k){try{return localStorage.getItem(k)}catch(e){return null}}
  function lsSet(k,v){try{localStorage.setItem(k,v)}catch(e){}}
  function chatInit(){
    if(CH.sid)return;
    CH.sid=lsGet('lia-sid-'+slug)||'';if(!/^[0-9a-f-]{36}$/.test(CH.sid)){CH.sid=uuid();lsSet('lia-sid-'+slug,CH.sid)}
    try{CH.msgs=JSON.parse(lsGet('lia-msgs-'+slug)||'[]').slice(-40)}catch(e){CH.msgs=[]}
    if(!CH.msgs.length){var h=new Date().getHours();CH.msgs.push({r:'lia',t:(h<13?'Buongiorno':h<18?'Buon pomeriggio':'Buonasera')+'! Sono Lia, l’assistente virtuale di '+S.info.name+'. Posso dirti i campi liberi e prenotarti un campo, dimmi pure.'})}
  }
  function saveChat(){lsSet('lia-msgs-'+slug,JSON.stringify(CH.msgs.slice(-40)))}
  function bub(r,t,cls){var b=el('div','bub '+r+(cls?' '+cls:''),t);CH.list.appendChild(b);CH.list.scrollTop=CH.list.scrollHeight;return b}
  function chatBox(){
    chatInit();
    if(CH.box){CH.list.scrollTop=CH.list.scrollHeight;return CH.box}
    var box=el('div','chat'),list=el('div','msgs');list.setAttribute('aria-live','polite');box.appendChild(list);CH.list=list;
    var f=el('form','bar'),inp=el('input');inp.type='text';inp.maxLength=300;inp.placeholder='Scrivi un messaggio…';inp.setAttribute('enterkeyhint','send');inp.setAttribute('aria-label','Scrivi a Lia');inp.autocomplete='off';
    var sb=el('button','send');sb.type='submit';sb.setAttribute('aria-label','Invia');sb.innerHTML='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="6 11 12 5 18 11"/></svg>';
    f.appendChild(inp);f.appendChild(sb);box.appendChild(f);box.appendChild(el('p','cnote','Lia è un’intelligenza artificiale: controlla sempre i dati della prenotazione.'));
    CH.input=inp;CH.btn=sb;CH.box=box;
    CH.msgs.forEach(function(m){bub(m.r,m.t,m.ok?'ok':'')});
    f.onsubmit=function(e){e.preventDefault();chatSend(inp.value)};
    return box;
  }
  function chatSend(text){
    text=(text||'').trim();if(!text||CH.busy)return;
    CH.busy=true;CH.btn.disabled=true;CH.input.value='';
    CH.msgs.push({r:'me',t:text});saveChat();bub('me',text);
    var ty=el('div','typ');ty.innerHTML='<i></i><i></i><i></i>';CH.list.appendChild(ty);CH.list.scrollTop=CH.list.scrollHeight;
    fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({b:slug,s:CH.sid,text:text})})
      .then(function(r){return r.json().catch(function(){return{}}).then(function(d){return{ok:r.ok,d:d}})})
      .then(function(x){ty.remove();
        if(!x.ok||!x.d.reply){bub('lia','Scusa, ho avuto un problema. Riprova tra un attimo.','err')}
        else{var booked=!!(x.d.calendar&&x.d.calendar.start);CH.msgs.push({r:'lia',t:x.d.reply,ok:booked});saveChat();bub('lia',x.d.reply,booked?'ok':'')}})
      .catch(function(){ty.remove();bub('lia','Non riesco a collegarmi. Riprova tra poco.','err')})
      .then(function(){CH.busy=false;CH.btn.disabled=false;try{CH.input.focus({preventScroll:true})}catch(e){}});
  }
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
    var hd=el('div','hd'),hl=el('div');hl.appendChild(el('h1',null,I.name));var sub=[I.tagline,I.address].filter(Boolean).join(' · ');if(sub)hl.appendChild(el('p',null,sub));hd.appendChild(hl);
    if(I.lia){var lb=el('button','lbtn');lb.type='button';lb.innerHTML=S.mode==='chat'?'':'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-4.5 7.5 8.5 8.5 0 0 1-8.9-.4L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 8-8.5h.5a8.5 8.5 0 0 1 8 8v.5z"/></svg>';lb.appendChild(document.createTextNode(S.mode==='chat'?'Prenota da solo':'Chat con Lia'));lb.onclick=function(){S.mode=S.mode==='chat'?'book':'chat';if(S.mode==='book'){S.free=null;loadDay()}else draw()};hd.appendChild(lb)}
    app.appendChild(hd);
    if(S.mode==='chat'&&I.lia){app.appendChild(chatBox());return}
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

    if (req.method === "GET" && q.info === "1") { const o = await courtsLib.info(sb, biz); if (o.status === 200) o.body.lia = acc.lia_allowed !== false; return res.status(o.status).json(o.body); }
    if (req.method === "GET" && q.date) { const o = await courtsLib.freeDay(sb, biz, String(q.date)); return res.status(o.status).json(o.body); }
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const o = await courtsLib.book(sb, biz, body);
      if (o.status !== 200) return res.status(o.status).json(o.body);
      const emailSent = await courtsLib.afterBook(biz, o);
      return res.status(200).json({ ok: true, email_sent: !!emailSent, booking: o.body.booking });
    }
    return res.status(405).json({ error: "Metodo non consentito" });
  } catch (e) {
    console.error("campi:", e && e.message);
    return res.status(500).json({ error: "Errore del server" });
  }
};
