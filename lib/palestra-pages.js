// lib/palestra-pages.js  (Prenolia: le due pagine del modulo Palestra)
// Scritte con String.raw: dentro non ci sono apici inversi né ${ }.

const CSS = String.raw`
:root{--bg:#050608;--bg2:#0A0D12;--card:#0E131B;--card2:#161D29;--line:#1C2532;--line2:#2A3648;--ink:#F9F6F0;--muted:#9BA6B5;--accent:#4BB3D6;--on-accent:#04141A;--accent-soft:#0E2A33;--accent-ink:#B5E4F2;--ok:#3FE08A;--ok-soft:#0C2A1C;--warn:#F1B24A;--warn-soft:#2E2210;--bad:#FF7B7B;--bad-soft:#321516;color-scheme:dark}
*{box-sizing:border-box}
html,body{margin:0;background:var(--bg)}
body{color:var(--ink);font:15px/1.5 -apple-system,BlinkMacSystemFont,"SF Pro Text",Helvetica,Arial,sans-serif;padding-inline:16px;padding-block:18px 64px;-webkit-text-size-adjust:100%}
.wrap{max-width:560px;margin:0 auto}
h1{margin:0;font-size:1.25rem;letter-spacing:-.02em;line-height:1.2}
h2{margin:22px 0 8px;font-size:1.02rem;letter-spacing:-.01em}
small,.muted{color:var(--muted)}
.gh{position:relative;overflow:hidden;display:flex;align-items:center;gap:14px;margin-bottom:14px;padding:18px 16px;border-radius:20px;border:1px solid rgba(214,160,80,.35);background:linear-gradient(180deg,rgba(8,6,4,.3),rgba(8,6,4,.66)),url(/gym/hero.jpg) center 62%/cover no-repeat,#120d08;color:#fff}
.gh h1{color:#fff}.gh small{color:rgba(255,255,255,.78)}
.logo{flex:none;width:60px;height:60px;border-radius:15px;background:url(/gym/logo.png) center/cover no-repeat;box-shadow:0 10px 24px -8px rgba(0,0,0,.75)}
.lb{margin:16px 0 7px;font-size:.68rem;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:var(--muted)}
.card{padding:13px;border:1px solid var(--line);border-radius:16px;background:var(--card);margin-bottom:9px}
.row{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
.row>div{min-width:0}
.chip{display:inline-block;padding:3px 10px;border-radius:99px;font-size:.7rem;font-weight:700;letter-spacing:.03em;white-space:nowrap}
.chip.ok{background:var(--ok-soft);color:var(--ok)}.chip.warn{background:var(--warn-soft);color:var(--warn)}.chip.bad{background:var(--bad-soft);color:var(--bad)}.chip.none{background:var(--card2);color:var(--muted)}
.days{display:flex;gap:7px;overflow-x:auto;padding:2px 2px 8px;margin-inline:-2px;scrollbar-width:none}
.days::-webkit-scrollbar{display:none}
.d{flex:none;width:50px;padding:7px 0;border-radius:13px;border:1.5px solid var(--line2);background:var(--card);color:var(--ink);text-align:center;font:inherit;cursor:pointer}
.d small{display:block;font-size:.66rem;text-transform:uppercase;letter-spacing:.06em}.d b{font-size:1.02rem}
.d[aria-pressed="true"]{border-color:var(--accent);background:var(--accent-soft)}
.btn{min-height:40px;padding:0 16px;border-radius:12px;border:0;background:var(--accent);color:var(--on-accent);font:inherit;font-weight:700;cursor:pointer}
.btn.ghost{background:transparent;color:var(--ink);box-shadow:inset 0 0 0 1.5px var(--line2)}
.btn.danger{background:transparent;color:var(--bad);box-shadow:inset 0 0 0 1.5px #5a2a2c}
.btn.sm{min-height:34px;padding:0 12px;font-size:.84rem}
.btn[disabled]{background:var(--card2);color:var(--muted);cursor:not-allowed;box-shadow:none}
.btn.block{width:100%}
.bar{height:5px;border-radius:9px;background:var(--line);margin:9px 0 5px;overflow:hidden}.bar i{display:block;height:100%;background:var(--accent)}.bar i.full{background:var(--bad)}
.why{margin-top:9px;padding:9px 11px;border-radius:11px;background:var(--bad-soft);color:#FFC5C5;font-size:.84rem}
.good{margin-top:9px;padding:9px 11px;border-radius:11px;background:var(--ok-soft);color:#B8F5D3;font-size:.84rem}
label.f{display:block;margin-bottom:10px}
label.f>span{display:block;color:var(--muted);font-size:.74rem;margin-bottom:4px}
input,select,textarea{width:100%;min-height:44px;padding:10px 12px;border:1px solid var(--line2);border-radius:12px;background:var(--bg2);color:var(--ink);font:inherit;font-size:16px}
textarea{min-height:70px}
input:focus,select:focus,textarea:focus{outline:2px solid var(--accent);outline-offset:0}
.chk{display:flex;gap:9px;align-items:center;margin:4px 0 12px;color:var(--muted);font-size:.84rem}
.chk input{width:20px;min-height:20px;height:20px;flex:none}
.foot{margin-top:28px;color:var(--muted);font-size:.78rem;text-align:center}
.foot a{color:var(--muted)}
.toast{position:fixed;left:16px;right:16px;bottom:calc(18px + env(safe-area-inset-bottom,0px));max-width:528px;margin:0 auto;padding:12px 14px;border-radius:14px;background:var(--card2);border:1px solid var(--line2);box-shadow:0 14px 40px -12px #000;z-index:60;font-size:.9rem}
.toast.bad{background:var(--bad-soft);border-color:#5a2a2c;color:#FFC5C5}
.toast.ok{background:var(--ok-soft);border-color:#1d5a3a;color:#B8F5D3}
.chips{display:flex;flex-wrap:wrap;gap:7px}
.cp{padding:8px 13px;border-radius:99px;border:1.5px solid var(--line2);background:var(--card);color:var(--ink);font:inherit;font-size:.84rem;font-weight:600;cursor:pointer}
.cp[aria-pressed="true"]{border-color:var(--accent);background:var(--accent-soft);color:var(--accent-ink)}
.empty{padding:18px;text-align:center;color:var(--muted);border:1px dashed var(--line2);border-radius:14px}
`;

const BOOK = String.raw`<!doctype html>
<html lang="it"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="dark"><meta name="robots" content="noindex">
<title>Prenota il tuo corso</title>
<style>` + CSS + String.raw`
.cl .t{display:flex;justify-content:space-between;gap:10px}.cl .tm{font-weight:700;font-variant-numeric:tabular-nums}
.cl b{font-size:1rem}.cl .ft{display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:.8rem;color:var(--muted)}
.cl.mine{border-color:#1d5a3a}
.pts{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.pts .cp{min-width:74px;font-variant-numeric:tabular-nums}.pts .cp[disabled]{opacity:.45;cursor:not-allowed}.pts .cp.mine{border-color:#1d5a3a;background:var(--ok-soft);color:var(--ok)}
.bk{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 0;border-top:1px solid var(--line)}.bk:first-of-type{border-top:0}
</style></head><body><div class="wrap">
<div class="gh"><div class="logo" role="img" aria-label="Logo"></div><div><h1 id="nm">Palestra</h1><small id="tg"></small></div></div>
<div id="closed" class="why" hidden>Le prenotazioni online sono sospese. Contatta la palestra.</div>
<div id="who"></div>
<div id="mine"></div>
<div class="lb">Scegli il giorno</div>
<div class="days" id="days"></div>
<div class="lb" id="dlab"></div>
<div id="cls"></div>
<div class="foot" id="foot"></div>
</div><div id="tz"></div>
<script>
(function(){
var API="/api/palestra?b="+encodeURIComponent((new URLSearchParams(location.search).get("b")||location.pathname.split("/").filter(Boolean).pop()||""));
var DN=["dom","lun","mar","mer","gio","ven","sab"],DL=["Domenica","Lunedì","Martedì","Mercoledì","Giovedì","Venerdì","Sabato"];
var MO=["gen","feb","mar","apr","mag","giu","lug","ago","set","ott","nov","dic"];
var S={info:null,id:null,me:null,day:null,days:[],busy:false};
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
function ymd(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
function parse(s){var p=s.split("-");return new Date(+p[0],+p[1]-1,+p[2])}
function lsGet(){try{return JSON.parse(localStorage.getItem("gym_id_"+API)||"null")}catch(e){return null}}
function lsSet(v){try{if(v)localStorage.setItem("gym_id_"+API,JSON.stringify(v));else localStorage.removeItem("gym_id_"+API)}catch(e){}}
function toast(m,k){var t=el("div","toast "+(k||""),m);document.getElementById("tz").textContent="";document.getElementById("tz").appendChild(t);setTimeout(function(){if(t.parentNode)t.parentNode.removeChild(t)},4200)}
function post(body){return fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}).then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.error||"Errore");return j})})}
function auth(x){var o=Object.assign({},x||{});if(S.id){o.first=S.id.first;o.last=S.id.last;o.phone=S.id.phone}return o}

function renderWho(){
  var box=document.getElementById("who");box.textContent="";
  if(S.me){
    var c=el("div","card"),r=el("div","row"),l=el("div");
    l.appendChild(el("b",null,S.me.member.first_name+" "+S.me.member.last_name));
    var st=S.me.status;l.appendChild(el("div","muted",st.detail));r.appendChild(l);r.appendChild(el("span","chip "+(st.s==="none"?"none":st.s),st.label));c.appendChild(r);
    var ex=S.me.plans.filter(function(p){return p.valid&&p.line!==st.detail}).map(function(p){return p.line});if(ex.length){var pl=el("div","muted",ex.join(" · "));pl.style.cssText="margin-top:6px;font-size:.82rem";c.appendChild(pl)}
    if(S.me.expired){var wx=el("div","why",S.me.ends_on?"Il tuo abbonamento è scaduto il "+parse(S.me.ends_on).getDate()+" "+MO[parse(S.me.ends_on).getMonth()]+". Rinnovalo in palestra per tornare a prenotare.":"Non hai un abbonamento attivo. Chiedi in palestra per prenotare.");c.appendChild(wx)}
    var out=el("button","btn ghost sm","Non sono io");out.style.marginTop="10px";out.onclick=function(){S.id=null;S.me=null;lsSet(null);renderAll()};c.appendChild(out);
    box.appendChild(c);return}
  var c2=el("div","card");c2.appendChild(el("b",null,"Chi sei?"));
  var p=el("div","muted","Scrivi gli stessi dati dati in palestra.");p.style.fontSize=".84rem";p.style.margin="2px 0 10px";c2.appendChild(p);
  function f(lab,id,type,ac){var l=el("label","f"),s=el("span",null,lab),i=el("input");i.id=id;i.type=type||"text";if(ac)i.autocomplete=ac;l.appendChild(s);l.appendChild(i);return l}
  c2.appendChild(f("Nome","f1","text","given-name"));c2.appendChild(f("Cognome","f2","text","family-name"));var ph=f("Telefono","f3","tel","tel");ph.querySelector("input").inputMode="tel";c2.appendChild(ph);
  var k=el("label","chk"),ck=el("input");ck.type="checkbox";ck.id="rem";ck.checked=true;k.appendChild(ck);k.appendChild(el("span",null,"Ricordami su questo dispositivo"));c2.appendChild(k);
  var b=el("button","btn block","Entra");b.onclick=function(){
    var id={first:document.getElementById("f1").value.trim(),last:document.getElementById("f2").value.trim(),phone:document.getElementById("f3").value.trim()};
    if(!id.first||!id.last||!id.phone){toast("Scrivi nome, cognome e telefono.","bad");return}
    b.disabled=true;
    post({action:"login",first:id.first,last:id.last,phone:id.phone}).then(function(j){S.id=id;S.me=j;if(document.getElementById("rem").checked)lsSet(id);renderAll();loadDay()}).catch(function(e){b.disabled=false;toast(e.message,"bad")})};
  c2.appendChild(b);var pr=el("div","muted");pr.style.cssText="font-size:.74rem;margin-top:9px";pr.appendChild(document.createTextNode("I tuoi dati servono solo a gestire le prenotazioni. "));var a=el("a",null,"Privacy");a.href=S.info.privacy;a.style.color="var(--muted)";pr.appendChild(a);c2.appendChild(pr);
  box.appendChild(c2)}

function renderMine(){
  var box=document.getElementById("mine");box.textContent="";
  if(!S.me||!S.me.bookings.length)return;
  box.appendChild(el("div","lb","Le tue prenotazioni"));
  var c=el("div","card");
  S.me.bookings.forEach(function(b){
    var r=el("div","bk"),l=el("div"),d=parse(b.date);
    l.appendChild(el("b",null,b.name));l.appendChild(el("div","muted",DL[d.getDay()]+" "+d.getDate()+" "+MO[d.getMonth()]+" · "+b.time));r.appendChild(l);
    if(b.can_cancel){var x=el("button","btn ghost sm","Disdici");x.onclick=function(){cancel(b.id,x,b.kind)};r.appendChild(x)}else r.appendChild(el("span","muted","Non più disdicibile"));
    c.appendChild(r)});
  box.appendChild(c)}

function renderDays(){
  var w=document.getElementById("days");w.textContent="";
  S.days.forEach(function(k){var d=parse(k),b=el("button","d");b.type="button";b.setAttribute("aria-pressed",k===S.day?"true":"false");b.appendChild(el("small",null,DN[d.getDay()]));b.appendChild(el("b",null,d.getDate()));b.onclick=function(){S.day=k;renderDays();loadDay()};w.appendChild(b)})}

function loadDay(){
  var box=document.getElementById("cls");
  var d=parse(S.day);document.getElementById("dlab").textContent=DL[d.getDay()]+" "+d.getDate()+" "+MO[d.getMonth()];
  post(auth({action:"day",date:S.day})).then(function(j){renderCls(j.sessions,j.pt||[])}).catch(function(e){box.textContent="";box.appendChild(el("div","why",e.message))})}

function renderCls(list,pt){
  var box=document.getElementById("cls");box.textContent="";
  if(!list.length){box.appendChild(el("div","empty","Nessuna lezione in questo giorno."));return}
  list.forEach(function(s){
    var c=el("div","card cl"+(s.mine?" mine":"")),t=el("div","t"),l=el("div");
    l.appendChild(el("b",null,s.course.name));
    var sub=s.duration_min+" min"+(s.course.description?" · "+s.course.description:"");l.appendChild(el("div","muted",sub));
    t.appendChild(l);t.appendChild(el("span","tm",s.time));c.appendChild(t);
    var bar=el("div","bar"),i=el("i",s.taken>=s.capacity?"full":"");i.style.width=Math.min(100,Math.round(s.taken/s.capacity*100))+"%";bar.appendChild(i);c.appendChild(bar);
    var ft=el("div","ft"),left=Math.max(0,s.capacity-s.taken);
    ft.appendChild(el("span",null,s.cancelled?"Annullata":left?(left===1?"1 posto libero":left+" posti liberi"):"Al completo"));
    if(s.mine){var x=el("button","btn ghost sm","Disdici");x.onclick=function(){cancel(s.mine,x)};ft.appendChild(x)}
    else if(s.cancelled||s.started){ft.appendChild(el("span",null,s.cancelled?"":"Già iniziata"))}
    else{var b=el("button","btn sm","Prenota");
      if(!S.me){b.onclick=function(){toast("Prima scrivi chi sei, qui sopra.");window.scrollTo({top:0,behavior:"smooth"})}}
      else if(s.can&&!s.can.ok){b.disabled=true;b.textContent="Non disponibile"}
      else b.onclick=function(){book(s,b)};
      ft.appendChild(b)}
    c.appendChild(ft);
    if(s.mine)c.appendChild(el("div","good","Sei prenotato."));
    else if(s.can&&!s.can.ok&&s.can.message&&s.can.code!=="expired")c.appendChild(el("div","why",s.can.message));
    box.appendChild(c)});
  renderPt(box,pt)}
function renderPt(box,pt){
  if(!pt||!pt.length)return;
  var c=el("div","card"),t=el("div","t"),l=el("div");
  l.appendChild(el("b",null,"Personal 1:1"));l.appendChild(el("div","muted","60 min con il trainer, nelle ore senza corso"));
  t.style.cssText="display:flex;justify-content:space-between;gap:10px";t.appendChild(l);c.appendChild(t);
  var g=el("div","pts"),why=null;
  pt.forEach(function(x){
    var b=el("button","cp"+(x.mine?" mine":""),x.time);b.type="button";
    if(x.mine){b.textContent=x.time+" ✓";b.onclick=function(){if(confirm_("Disdire il Personal delle "+x.time+"?"))cancel(x.mine,b,"pt")}}
    else if(!S.me){b.onclick=function(){toast("Prima scrivi chi sei, qui sopra.");window.scrollTo({top:0,behavior:"smooth"})}}
    else if(x.can&&!x.can.ok){b.disabled=true;if(!why&&x.can.message&&x.can.code!=="expired")why=x.can.message}
    else b.onclick=function(){bookPt(x,b)};
    g.appendChild(b)});
  c.appendChild(g);if(why)c.appendChild(el("div","why",why));
  box.appendChild(c)}
function confirm_(m){try{return window.confirm(m)}catch(e){return true}}
function bookPt(x,btn){
  if(S.busy)return;S.busy=true;btn.disabled=true;
  post(auth({action:"pt_book",date:S.day,time:x.time})).then(function(){toast("Prenotato: Personal 1:1 alle "+x.time+".","ok");return refresh()}).catch(function(e){toast(e.message,"bad");return refresh()}).then(function(){S.busy=false})}

function book(s,btn){
  if(S.busy)return;S.busy=true;btn.disabled=true;
  post(auth({action:"book",schedule_id:s.schedule_id,date:S.day})).then(function(j){toast("Prenotato: "+s.course.name+" alle "+s.time+".","ok");return refresh()}).catch(function(e){toast(e.message,"bad");return refresh()}).then(function(){S.busy=false})}
function cancel(id,btn,kind){
  if(S.busy)return;S.busy=true;btn.disabled=true;
  post(auth({action:"cancel",booking_id:id,kind:kind||"class"})).then(function(j){toast(j.refunded?"Prenotazione disdetta. L'ingresso ti è stato restituito.":"Prenotazione disdetta.","ok");return refresh()}).catch(function(e){toast(e.message,"bad");return refresh()}).then(function(){S.busy=false})}
function refresh(){
  var p=S.id?post(auth({action:"me"})).then(function(j){S.me=j}).catch(function(){}):Promise.resolve();
  return p.then(function(){renderWho();renderMine();loadDay()})}
function renderAll(){renderWho();renderMine();renderDays()}

fetch(API+"&info=1").then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.error||"Errore");return j})}).then(function(info){
  S.info=info;document.getElementById("nm").textContent=info.name;document.title=info.name+" · Prenota";
  document.getElementById("tg").textContent=info.tagline||info.address||"";
  if(info.open===false)document.getElementById("closed").hidden=false;
  var t=parse(info.today);for(var i=0;i<info.days_ahead;i++){var d=new Date(t);d.setDate(d.getDate()+i);S.days.push(ymd(d))}
  S.day=S.days[0];
  var f=document.getElementById("foot");f.textContent=(info.phone?"Per qualsiasi cosa: "+info.phone+". ":"")+"Puoi disdire fino a "+(info.cutoff_min%60===0?(info.cutoff_min/60)+(info.cutoff_min===60?" ora":" ore"):info.cutoff_min+" minuti")+" prima della lezione.";
  var saved=lsGet();
  if(saved){S.id=saved;return post({action:"me",first:saved.first,last:saved.last,phone:saved.phone}).then(function(j){S.me=j}).catch(function(){S.id=null;lsSet(null)})}
}).then(function(){renderAll();loadDay()}).catch(function(e){document.getElementById("cls").appendChild(el("div","why",e.message||"Palestra non trovata"))});
})();
</script></body></html>`;

const OWNER = String.raw`<!doctype html>
<html lang="it"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="dark"><meta name="robots" content="noindex">
<meta name="apple-mobile-web-app-capable" content="yes"><link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<title>Palestra · Prenolia</title>
<style>` + CSS + String.raw`
.wrap{max-width:720px}
.tabs{display:flex;gap:6px;margin:6px 0 12px;position:sticky;top:env(safe-area-inset-top,0px);padding:8px 0;background:var(--bg);z-index:20}
.tab{flex:1;min-height:40px;border-radius:12px;border:1.5px solid var(--line2);background:var(--card);color:var(--ink);font:inherit;font-size:.84rem;font-weight:700;cursor:pointer}
.tab[aria-pressed="true"]{border-color:var(--accent);background:var(--accent-soft);color:var(--accent-ink)}
.mr{display:flex;align-items:center;gap:10px;padding:11px 12px;border:1px solid var(--line);border-radius:14px;background:var(--card);margin-bottom:7px;cursor:pointer;width:100%;text-align:left;color:inherit;font:inherit}
.mr .av{flex:none;width:36px;height:36px;border-radius:50%;background:var(--card2);display:grid;place-items:center;font-size:.76rem;font-weight:800;color:var(--accent-ink)}
.mr .tx{flex:1;min-width:0}.mr b{display:block;font-size:.92rem}.mr small{display:block;font-size:.78rem}
.fl{display:flex;gap:7px;margin:8px 0 10px;overflow-x:auto;scrollbar-width:none}.fl .cp{flex:none;white-space:nowrap}
.at{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 0;border-top:1px solid var(--line);font-size:.9rem}
.at:first-child{border-top:0}
.shade{position:fixed;inset:0;background:#000a;z-index:40;display:flex;align-items:flex-end;justify-content:center}
.sheet{width:100%;max-width:560px;max-height:90%;overflow:auto;background:var(--bg2);border:1px solid var(--line2);border-radius:22px 22px 0 0;padding:18px 16px calc(22px + env(safe-area-inset-bottom,0px))}
.sheet h3{margin:0 0 12px;font-size:1.05rem}
.two{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.dh{margin:14px 0 6px;font-size:.7rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.ls{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:9px 12px;border:1px solid var(--line);border-radius:12px;background:var(--card);margin-bottom:6px}
.acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
</style></head><body><div class="wrap">
<h1 id="bn">Palestra</h1><small id="bs"></small>
<div class="tabs" id="tabs"></div>
<div id="view"></div>
</div><div id="tz"></div>
<script>
(function(){
var T=new URLSearchParams(location.search).get("t")||"";
var API="/api/palestra?t="+encodeURIComponent(T);
var DN=["dom","lun","mar","mer","gio","ven","sab"],DL=["Domenica","Lunedì","Martedì","Mercoledì","Giovedì","Venerdì","Sabato"];
var WD=["","Lunedì","Martedì","Mercoledì","Giovedì","Venerdì","Sabato","Domenica"];
var MO=["gen","feb","mar","apr","mag","giu","lug","ago","set","ott","nov","dic"];
var CATL={corsi:"Corsi",circuiti:"Circuiti",hyrox:"Hyrox"};
var S={tab:"oggi",data:null,day:null,sessions:null,filter:"all",q:""};
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
function ymd(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
function parse(s){var p=s.split("-");return new Date(+p[0],+p[1]-1,+p[2])}
function cat(c){return CATL[c]||(c.charAt(0).toUpperCase()+c.slice(1))}
function eur(n){return n==null?"":(Math.round(n*100)%100===0?String(Math.round(n)):n.toFixed(2).replace(".",","))+" €"}
function toast(m,k){var t=el("div","toast "+(k||""),m);var z=document.getElementById("tz");z.textContent="";z.appendChild(t);setTimeout(function(){if(t.parentNode)t.parentNode.removeChild(t)},4200)}
function api(body,url){var o=body?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{};return fetch(url||API,o).then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.error||"Errore");return j})})}
function load(){return api(null,API+"&data=1").then(function(d){S.data=d;document.getElementById("bn").textContent=d.business.name;document.title=d.business.name+" · Palestra";document.getElementById("bs").textContent="Gestione palestra";if(!S.day)S.day=d.today})}
function act(body,okMsg){return api(body).then(function(j){if(okMsg)toast(okMsg,"ok");return j}).catch(function(e){toast(e.message,"bad");throw e})}
function reload(){return load().then(render)}

// ---- finestra a scorrimento dal basso ----
function sheet(title,build){
  var sh=el("div","shade"),s=el("div","sheet");sh.appendChild(s);
  function close(){if(sh.parentNode)sh.parentNode.removeChild(sh)}
  sh.onclick=function(e){if(e.target===sh)close()};
  s.appendChild(el("h3",null,title));build(s,close);document.body.appendChild(sh);return close}
function field(lab,input){var l=el("label","f"),s=el("span",null,lab);l.appendChild(s);l.appendChild(input);return l}
function inp(type,val,ph){var i=el("input");i.type=type||"text";if(val!=null)i.value=val;if(ph)i.placeholder=ph;return i}
function sel(opts,val){var s=el("select");opts.forEach(function(o){var op=el("option",null,o[1]);op.value=o[0];if(String(o[0])===String(val))op.selected=true;s.appendChild(op)});return s}
function btn(t,c,fn){var b=el("button","btn "+(c||""),t);b.type="button";b.onclick=fn;return b}
function confirmBar(parent,text,onYes){var w=el("div","why",text);var a=el("div","acts");a.appendChild(btn("Sì, conferma","danger sm",onYes));a.appendChild(btn("No","ghost sm",function(){w.parentNode.removeChild(w)}));w.appendChild(a);parent.appendChild(w)}

// ---- schede ----
function renderTabs(){
  var t=document.getElementById("tabs");t.textContent="";
  [["oggi","Lezioni"],["iscritti","Iscritti"],["programma","Programma"],["abbonamenti","Abbonamenti"]].forEach(function(x){var b=el("button","tab",x[1]);b.type="button";b.setAttribute("aria-pressed",S.tab===x[0]?"true":"false");b.onclick=function(){S.tab=x[0];render()};t.appendChild(b)})}
function render(){renderTabs();var v=document.getElementById("view");v.textContent="";
  if(!S.data){v.appendChild(el("div","empty","Carico..."));return}
  ({oggi:vOggi,iscritti:vIscritti,programma:vProgramma,abbonamenti:vAbb})[S.tab](v)}

// ---- Lezioni del giorno ----
function vOggi(v){
  var days=el("div","days"),t=parse(S.data.today);
  for(var i=-1;i<14;i++){var d=new Date(t);d.setDate(d.getDate()+i);var k=ymd(d);var b=el("button","d");b.type="button";b.setAttribute("aria-pressed",k===S.day?"true":"false");b.appendChild(el("small",null,DN[d.getDay()]));b.appendChild(el("b",null,d.getDate()));(function(k){b.onclick=function(){S.day=k;S.sessions=null;render()}})(k);days.appendChild(b)}
  v.appendChild(days);
  var d0=parse(S.day);v.appendChild(el("div","lb",DL[d0.getDay()]+" "+d0.getDate()+" "+MO[d0.getMonth()]));
  var box=el("div");v.appendChild(box);
  function draw(){
    box.textContent="";
    if(!S.sessions){box.appendChild(el("div","empty","Carico..."));return}
    if(!S.sessions.length){box.appendChild(el("div","empty","Nessuna lezione in questo giorno. Le aggiungi dalla scheda Programma."));return}
    S.sessions.forEach(function(s){
      var c=el("div","card"),r=el("div","row"),l=el("div");
      l.appendChild(el("b",null,s.time+" · "+s.course.name));l.appendChild(el("div","muted",cat(s.course.category)+" · "+s.duration_min+" min"));
      r.appendChild(l);r.appendChild(el("span","chip "+(s.cancelled?"bad":s.taken>=s.capacity?"warn":"ok"),s.cancelled?"Annullata":s.taken+" / "+s.capacity));c.appendChild(r);
      var bar=el("div","bar"),i=el("i",s.taken>=s.capacity?"full":"");i.style.width=Math.min(100,Math.round(s.taken/s.capacity*100))+"%";bar.appendChild(i);c.appendChild(bar);
      if(s.cancelled&&s.cancel_reason)c.appendChild(el("div","muted",s.cancel_reason));
      s.attendees.forEach(function(a){
        var row=el("div","at"),n=el("div");n.appendChild(el("span",null,a.name));var ph=el("small",null," "+a.phone);n.appendChild(ph);row.appendChild(n);
        row.appendChild(btn("Togli","ghost sm",function(){confirmBar(c,"Togliere "+a.name+" da questa lezione? Se aveva usato un ingresso, gli torna.",function(){act({action:"booking_cancel",booking_id:a.booking_id,member_id:a.member_id},"Tolto.").then(function(){S.sessions=null;render()})})}));c.appendChild(row)});
      var ac=el("div","acts");
      if(!s.cancelled){
        ac.appendChild(btn("Aggiungi iscritto","ghost sm",function(){addAtt(s)}));
        ac.appendChild(btn("Annulla lezione","danger sm",function(){annulla(s)}))}
      else ac.appendChild(btn("Riattiva lezione","ghost sm",function(){act({action:"session_restore",schedule_id:s.schedule_id,date:S.day},"Lezione riattivata.").then(function(){S.sessions=null;render()})}));
      c.appendChild(ac);box.appendChild(c)})}
  draw();
  if(!S.sessions)api(null,API+"&day="+S.day).then(function(j){S.sessions=j.sessions;if(S.tab==="oggi")draw()}).catch(function(e){box.textContent="";box.appendChild(el("div","why",e.message))})}
function addAtt(s){
  sheet("Aggiungi a "+s.course.name+" ("+s.time+")",function(w,close){
    var ids={};s.attendees.forEach(function(a){ids[a.member_id]=1});
    var opts=S.data.members.filter(function(m){return!ids[m.id]}).map(function(m){return[m.id,m.last_name+" "+m.first_name+" · "+m.status.label]});
    if(!opts.length){w.appendChild(el("div","empty","Non ci sono altri iscritti da aggiungere."));return}
    var sl=sel(opts);w.appendChild(field("Iscritto",sl));
    var msg=el("div");w.appendChild(msg);
    w.appendChild(btn("Aggiungi","block",function(){msg.textContent="";api({action:"booking_add",member_id:sl.value,schedule_id:s.schedule_id,date:S.day}).then(function(){toast("Aggiunto.","ok");close();S.sessions=null;render()}).catch(function(e){msg.className="why";msg.textContent=e.message})}))})}
function annulla(s){
  sheet("Annulla "+s.course.name+" ("+s.time+")",function(w,close){
    w.appendChild(el("p","muted","Chi è già prenotato viene tolto e gli ingressi tornano disponibili. Avvisa tu le persone: per ora non partono messaggi in automatico."));
    var r=inp("text","","Motivo (facoltativo)");w.appendChild(field("Motivo",r));
    w.appendChild(btn("Annulla la lezione","danger block",function(){act({action:"session_cancel",schedule_id:s.schedule_id,date:S.day,reason:r.value},"Lezione annullata.").then(function(){close();S.sessions=null;render()})}))})}

// ---- Iscritti ----
function vIscritti(v){
  var top=el("div","row");var q=inp("search",S.q,"Cerca per nome o telefono");q.oninput=function(){S.q=q.value;list()};top.appendChild(q);v.appendChild(top);
  var fl=el("div","fl");[["all","Tutti"],["warn","In scadenza"],["bad","Scaduti"],["none","Senza abbonamento"]].forEach(function(f){var b=el("button","cp",f[1]);b.type="button";b.setAttribute("aria-pressed",S.filter===f[0]?"true":"false");b.onclick=function(){S.filter=f[0];render()};fl.appendChild(b)});v.appendChild(fl);
  var box=el("div");v.appendChild(box);
  var add=btn("Nuovo iscritto","block",function(){memberForm()});add.style.marginTop="10px";v.appendChild(add);
  function list(){
    box.textContent="";
    var qq=S.q.trim().toLowerCase();
    var ms=S.data.members.filter(function(m){return(S.filter==="all"||m.status.s===S.filter)&&(!qq||(m.first_name+" "+m.last_name+" "+m.phone).toLowerCase().indexOf(qq)>=0)});
    if(!ms.length){box.appendChild(el("div","empty",S.data.members.length?"Nessun risultato.":"Ancora nessun iscritto. Aggiungi il primo."));return}
    ms.forEach(function(m){var r=el("button","mr");r.type="button";var av=el("div","av",(m.first_name[0]||"")+(m.last_name[0]||""));var tx=el("div","tx");tx.appendChild(el("b",null,m.first_name+" "+m.last_name));tx.appendChild(el("small","muted",m.status.detail));r.appendChild(av);r.appendChild(tx);r.appendChild(el("span","chip "+m.status.s,m.status.label));r.onclick=function(){memberSheet(m.id)};box.appendChild(r)})}
  list()}
function memberForm(m){
  sheet(m?"Modifica dati":"Nuovo iscritto",function(w,close){
    var f=inp("text",m?m.first_name:""),l=inp("text",m?m.last_name:""),p=inp("tel",m?m.phone:""),n=el("textarea");n.value=m?m.notes:"";
    var two=el("div","two");two.appendChild(field("Nome",f));two.appendChild(field("Cognome",l));w.appendChild(two);
    w.appendChild(field("Telefono",p));w.appendChild(field("Note (facoltative)",n));
    w.appendChild(el("p","muted","Nome, cognome e telefono servono all'iscritto per entrare e prenotare: devono essere scritti come li dirà lui."));
    var msg=el("div");w.appendChild(msg);
    w.appendChild(btn("Salva","block",function(){act({action:"member_save",id:m?m.id:undefined,first_name:f.value,last_name:l.value,phone:p.value,notes:n.value}).then(function(j){toast("Salvato.","ok");close();return reload().then(function(){if(!m)memberSheet(j.id)})}).catch(function(e){msg.className="why";msg.textContent=e.message})}))})}
function memberSheet(id){
  var m=S.data.members.filter(function(x){return x.id===id})[0];if(!m)return;
  sheet(m.first_name+" "+m.last_name,function(w,close){
    var top=el("div","row"),l=el("div");l.appendChild(el("div","muted",m.phone));if(m.notes)l.appendChild(el("div","muted",m.notes));top.appendChild(l);top.appendChild(el("span","chip "+m.status.s,m.status.label));w.appendChild(top);
    w.appendChild(el("div","dh","Abbonamenti"));
    if(!m.plans.length)w.appendChild(el("div","empty","Nessun abbonamento."));
    m.plans.forEach(function(p){
      var c=el("div","card"),r=el("div","row"),x=el("div");x.appendChild(el("b",null,p.plan_name));
      x.appendChild(el("div","muted",p.kind==="time"?"Dal "+parse(p.starts_on).getDate()+" "+MO[parse(p.starts_on).getMonth()]+" al "+parse(p.ends_on).getDate()+" "+MO[parse(p.ends_on).getMonth()]+" "+parse(p.ends_on).getFullYear():p.entries_left+" ingressi rimasti su "+p.entries_total));
      x.appendChild(el("div","muted",p.covers.map(cat).join(", ")+(p.price_paid!=null?" · "+eur(p.price_paid):"")));
      r.appendChild(x);r.appendChild(el("span","chip "+(p.valid?"ok":"bad"),p.valid?"Valido":"Non valido"));c.appendChild(r);
      var ac=el("div","acts");
      ac.appendChild(btn(p.kind==="time"?"Cambia scadenza":"Cambia ingressi","ghost sm",function(){editPlan(p,close)}));
      ac.appendChild(btn("Annulla","danger sm",function(){confirmBar(c,"Annullare questo abbonamento?",function(){act({action:"member_plan_update",id:p.id,cancelled:true},"Annullato.").then(function(){close();return reload().then(function(){memberSheet(id)})})})}));
      c.appendChild(ac);w.appendChild(c)});
    w.appendChild(btn("Nuovo abbonamento","block",function(){close();newPlan(m)}));
    var ac2=el("div","acts");ac2.appendChild(btn("Modifica dati","ghost sm",function(){close();memberForm(m)}));
    ac2.appendChild(btn("Elimina iscritto","danger sm",function(){confirmBar(w,"Eliminare "+m.first_name+" "+m.last_name+"? Le sue prenotazioni future vengono tolte.",function(){act({action:"member_delete",id:m.id},"Eliminato.").then(function(){close();return reload()})})}));w.appendChild(ac2)})}
function editPlan(p,closeParent){
  sheet(p.plan_name,function(w,close){
    var i=p.kind==="time"?inp("date",p.ends_on):inp("number",p.entries_left);if(p.kind==="entries"){i.min="0";i.inputMode="numeric"}
    w.appendChild(field(p.kind==="time"?"Scade il":"Ingressi rimasti",i));
    w.appendChild(btn("Salva","block",function(){var b={action:"member_plan_update",id:p.id};if(p.kind==="time")b.ends_on=i.value;else b.entries_left=i.value;act(b,"Salvato.").then(function(){close();closeParent();return reload()})}))})}
function newPlan(m){
  sheet("Nuovo abbonamento per "+m.first_name,function(w,close){
    if(!S.data.plans.length){w.appendChild(el("div","empty","Prima crea un tipo di abbonamento, dalla scheda Abbonamenti."));return}
    var ps=sel(S.data.plans.map(function(p){return[p.id,p.name+(p.price_eur!=null?" · "+eur(p.price_eur):"")]}));
    var st=inp("date",S.data.today),pr=inp("number","");pr.step="0.01";pr.inputMode="decimal";
    var info=el("p","muted");
    function upd(){var p=S.data.plans.filter(function(x){return x.id===ps.value})[0];pr.value=p&&p.price_eur!=null?p.price_eur:"";info.textContent=p?(p.kind==="time"?"Dura "+p.days+" giorni dalla data di inizio. ":p.entries+" ingressi. ")+"Include: "+p.covers.map(cat).join(", ")+".":""}
    ps.onchange=upd;upd();
    w.appendChild(field("Tipo",ps));w.appendChild(info);
    var two=el("div","two");two.appendChild(field("Inizia il",st));two.appendChild(field("Pagato (€)",pr));w.appendChild(two);
    w.appendChild(btn("Aggiungi","block",function(){act({action:"member_plan_add",member_id:m.id,plan_id:ps.value,starts_on:st.value,price_paid:pr.value},"Abbonamento aggiunto.").then(function(){close();return reload().then(function(){memberSheet(m.id)})})}))})}

// ---- Programma ----
function vProgramma(v){
  v.appendChild(el("div","lb","Corsi"));
  if(!S.data.courses.length)v.appendChild(el("div","empty","Nessun corso. Crea il primo."));
  S.data.courses.forEach(function(c){var r=el("div","ls"),l=el("div");l.appendChild(el("b",null,c.name));l.appendChild(el("div","muted",cat(c.category)+" · "+c.duration_min+" min · "+c.capacity+" posti"));r.appendChild(l);r.appendChild(btn("Modifica","ghost sm",function(){courseForm(c)}));v.appendChild(r)});
  var a=btn("Nuovo corso","block",function(){courseForm()});a.style.marginTop="8px";v.appendChild(a);
  v.appendChild(el("div","lb","Programma settimanale"));
  for(var d=1;d<=7;d++){
    var items=S.data.schedule.filter(function(s){return s.weekday===d});
    v.appendChild(el("div","dh",WD[d]));
    if(!items.length)v.appendChild(el("small","muted","Nessuna lezione"));
    items.forEach(function(s){var c=S.data.courses.filter(function(x){return x.id===s.course_id})[0];if(!c)return;var r=el("div","ls"),l=el("div");l.appendChild(el("b",null,s.time+" · "+c.name));if(s.capacity)l.appendChild(el("div","muted",s.capacity+" posti"));r.appendChild(l);r.appendChild(btn("Togli","ghost sm",function(){confirmBar(v,"Togliere "+c.name+" del "+WD[d].toLowerCase()+" alle "+s.time+"? Chi è prenotato viene tolto.",function(){act({action:"schedule_delete",id:s.id},"Tolta.").then(reload)})}));v.appendChild(r)})}
  var b=btn("Aggiungi lezione","block",function(){lessonForm()});b.style.marginTop="12px";v.appendChild(b)}
function courseForm(c){
  sheet(c?"Modifica corso":"Nuovo corso",function(w,close){
    var n=inp("text",c?c.name:"",""),ct=sel(S.data.categories.map(function(x){return[x,cat(x)]}),c?c.category:"corsi"),du=inp("number",c?c.duration_min:60),cp=inp("number",c?c.capacity:12),ds=inp("text",c?c.description:"");du.inputMode=cp.inputMode="numeric";
    w.appendChild(field("Nome",n));w.appendChild(field("Tipo (decide quali abbonamenti lo includono)",ct));
    var two=el("div","two");two.appendChild(field("Durata (minuti)",du));two.appendChild(field("Posti",cp));w.appendChild(two);
    w.appendChild(field("Descrizione breve (facoltativa)",ds));
    var msg=el("div");w.appendChild(msg);
    w.appendChild(btn("Salva","block",function(){act({action:"course_save",id:c?c.id:undefined,name:n.value,category:ct.value,duration_min:du.value,capacity:cp.value,description:ds.value}).then(function(){toast("Salvato.","ok");close();return reload()}).catch(function(e){msg.className="why";msg.textContent=e.message})}));
    if(c){var dl=btn("Elimina corso","danger block",function(){confirmBar(w,"Eliminare "+c.name+" e le sue lezioni? Chi è prenotato viene tolto.",function(){act({action:"course_delete",id:c.id},"Eliminato.").then(function(){close();return reload()})})});dl.style.marginTop="8px";w.appendChild(dl)}})}
function lessonForm(){
  if(!S.data.courses.length){toast("Prima crea un corso.","bad");return}
  sheet("Aggiungi lezione",function(w,close){
    var c=sel(S.data.courses.map(function(x){return[x.id,x.name]})),dd=sel([1,2,3,4,5,6,7].map(function(i){return[i,WD[i]]}),1),t=inp("time","18:30"),cp=inp("number","");cp.inputMode="numeric";
    w.appendChild(field("Corso",c));var two=el("div","two");two.appendChild(field("Giorno",dd));two.appendChild(field("Ora",t));w.appendChild(two);
    w.appendChild(field("Posti (vuoto = quelli del corso)",cp));
    var msg=el("div");w.appendChild(msg);
    w.appendChild(btn("Aggiungi","block",function(){act({action:"schedule_add",course_id:c.value,weekday:dd.value,time:t.value,capacity:cp.value}).then(function(){toast("Aggiunta.","ok");close();return reload()}).catch(function(e){msg.className="why";msg.textContent=e.message})}))})}

// ---- Abbonamenti ----
function vAbb(v){
  v.appendChild(el("div","lb","Tipi di abbonamento"));
  if(!S.data.plans.length)v.appendChild(el("div","empty","Nessun abbonamento. Crea il primo, per esempio Mensile."));
  S.data.plans.forEach(function(p){var r=el("div","ls"),l=el("div");l.appendChild(el("b",null,p.name+(p.price_eur!=null?" · "+eur(p.price_eur):"")));l.appendChild(el("div","muted",(p.kind==="time"?p.days+" giorni":p.entries+" ingressi")+" · "+p.covers.map(cat).join(", ")));r.appendChild(l);r.appendChild(btn("Modifica","ghost sm",function(){planForm(p)}));v.appendChild(r)});
  var a=btn("Nuovo tipo","block",function(){planForm()});a.style.marginTop="8px";v.appendChild(a);
  v.appendChild(el("div","lb","Regole"));
  var c=el("div","card"),h=sel([[0,"Fino all'inizio"],[1,"1 ora prima"],[2,"2 ore prima"],[3,"3 ore prima"],[6,"6 ore prima"],[12,"12 ore prima"],[24,"1 giorno prima"]],S.data.settings.cutoff_min/60);
  c.appendChild(field("Disdetta possibile fino a",h));
  c.appendChild(el("p","muted","Se l'iscritto disdice in tempo, l'ingresso gli torna. Dopo no."));
  c.appendChild(btn("Salva regola","ghost sm",function(){act({action:"settings_save",cutoff_hours:h.value},"Salvato.").then(reload)}));v.appendChild(c);
  v.appendChild(el("div","lb","Pagina per gli iscritti"));
  var lk=el("div","card"),url=location.origin+"/palestra/"+S.data.business.slug;
  lk.appendChild(el("div","muted","Manda questo link ai tuoi iscritti: lo aprono, scrivono nome, cognome e telefono e prenotano."));
  var u=el("input");u.value=url;u.readOnly=true;u.style.marginTop="8px";u.onfocus=function(){u.select()};lk.appendChild(u);
  var ac=el("div","acts");ac.appendChild(btn("Copia link","ghost sm",function(){if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(url).then(function(){toast("Link copiato.","ok")},function(){u.select();toast("Tieni premuto sul link per copiarlo.")});else{u.select();toast("Tieni premuto sul link per copiarlo.")}}));
  var o=el("a","btn ghost sm","Apri");o.href=url;o.target="_blank";o.rel="noopener";o.style.cssText="display:inline-flex;align-items:center;text-decoration:none";ac.appendChild(o);lk.appendChild(ac);v.appendChild(lk)}
function planForm(p){
  sheet(p?"Modifica abbonamento":"Nuovo tipo di abbonamento",function(w,close){
    var n=inp("text",p?p.name:""),k=sel([["time","A tempo (mensile, annuale...)"],["entries","A ingressi"]],p?p.kind:"time"),dv=inp("number",p?(p.kind==="time"?p.days:p.entries):30),pr=inp("number",p&&p.price_eur!=null?p.price_eur:"");dv.inputMode="numeric";pr.step="0.01";pr.inputMode="decimal";
    var lab=el("span",null,"");var dl=el("label","f");dl.appendChild(lab);dl.appendChild(dv);
    function sync(){lab.textContent=k.value==="time"?"Durata (giorni)":"Numero di ingressi"}
    k.onchange=function(){sync();dv.value=k.value==="time"?30:10};sync();
    w.appendChild(field("Nome",n));w.appendChild(field("Tipo",k));w.appendChild(dl);w.appendChild(field("Prezzo (€)",pr));
    w.appendChild(el("div","dh","Corsi inclusi"));
    var sel0=p?p.covers.slice():["corsi","circuiti"],ch=el("div","chips");
    S.data.categories.forEach(function(c){var b=el("button","cp",cat(c));b.type="button";function paint(){b.setAttribute("aria-pressed",sel0.indexOf(c)>=0?"true":"false")}paint();b.onclick=function(){var i=sel0.indexOf(c);if(i>=0)sel0.splice(i,1);else sel0.push(c);paint()};ch.appendChild(b)});w.appendChild(ch);
    var h=el("p","muted","Esempio: il Mensile include Corsi e Circuiti; un extra \"Hyrox +\" include solo Hyrox.");h.style.marginTop="8px";w.appendChild(h);
    var msg=el("div");w.appendChild(msg);
    w.appendChild(btn("Salva","block",function(){var b={action:"plan_save",id:p?p.id:undefined,name:n.value,kind:k.value,price_eur:pr.value,covers:sel0};if(k.value==="time")b.days=dv.value;else b.entries=dv.value;act(b).then(function(){toast("Salvato.","ok");close();return reload()}).catch(function(e){msg.className="why";msg.textContent=e.message})}));
    if(p){var d=btn("Elimina tipo","danger block",function(){confirmBar(w,"Eliminare questo tipo? Gli abbonamenti già venduti restano validi.",function(){act({action:"plan_delete",id:p.id},"Eliminato.").then(function(){close();return reload()})})});d.style.marginTop="8px";w.appendChild(d)}})}

render();
load().then(render).catch(function(e){var v=document.getElementById("view");v.textContent="";v.appendChild(el("div","why",e.message))});
})();
</script></body></html>`;

module.exports = { OWNER, BOOK };
