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
.logo{flex:none;width:64px;height:64px;background:url(/gym/logo.png?v=72) center/contain no-repeat;filter:drop-shadow(0 8px 12px rgba(0,0,0,.55))}
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
.hi{display:flex;align-items:center;gap:10px;margin:0 0 12px}.hi b{font-size:1rem}.hi .muted{font-size:.8rem}.hi .sp{flex:1}
.lnk{background:none;border:0;color:var(--muted);font:inherit;font-size:.8rem;text-decoration:underline;cursor:pointer;padding:6px}
.nudge{display:flex;gap:10px;align-items:center;padding:11px 13px;border:1px solid var(--line);border-radius:14px;background:var(--card);margin-bottom:12px;font-size:.86rem;color:var(--muted)}
.nudge b{color:var(--ink)}
.strip{position:sticky;top:env(safe-area-inset-top,0px);z-index:20;margin:0 -16px 10px;padding:8px 16px;background:linear-gradient(var(--bg) 82%,transparent);display:flex;gap:7px;overflow-x:auto;scroll-snap-type:x proximity;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.strip::-webkit-scrollbar{display:none}
.dd{flex:none;scroll-snap-align:center;width:54px;padding:8px 0 7px;border-radius:15px;border:1.5px solid var(--line);background:var(--card);color:var(--ink);text-align:center;font:inherit;cursor:pointer;position:relative;transition:background .15s,border-color .15s,transform .12s}
.dd:active{transform:scale(.96)}
.dd small{display:block;font-size:.66rem;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}.dd b{display:block;font-size:1.12rem;line-height:1.25}
.dd em{display:block;font-style:normal;font-size:.58rem;color:var(--muted);height:11px;line-height:11px}
.dd[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}.dd[aria-pressed="true"] small,.dd[aria-pressed="true"] em{color:var(--on-accent);opacity:.8}
.dd.off{opacity:.45}.dd.has::after{content:"";position:absolute;right:7px;top:7px;width:7px;height:7px;border-radius:50%;background:var(--ok)}
.flt{display:flex;gap:7px;overflow-x:auto;padding:2px 0 12px;scrollbar-width:none}.flt::-webkit-scrollbar{display:none}.flt .cp{flex:none;padding:7px 12px}
.dl{display:flex;align-items:baseline;justify-content:space-between;margin:2px 2px 8px}.dl b{font-size:1.02rem;letter-spacing:-.01em}.dl span{font-size:.78rem;color:var(--muted)}
.it{display:grid;grid-template-columns:54px minmax(0,1fr);gap:12px;margin-bottom:9px;animation:in .22s ease both}
@keyframes in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.it .tm{padding-top:12px;text-align:right;font-weight:800;font-variant-numeric:tabular-nums;font-size:1rem;line-height:1.1}.it .tm small{display:block;font-weight:500;font-size:.7rem;color:var(--muted);margin-top:2px}
.it .bd{position:relative;border:1px solid var(--line);border-left:4px solid var(--cc,var(--accent));border-radius:16px;background:var(--card);padding:11px 12px 11px 13px;display:flex;flex-direction:column;gap:7px;transition:border-color .2s,background .2s}
.it.mine .bd{border-color:#1d5a3a;border-left-color:var(--ok);background:linear-gradient(0deg,var(--ok-soft),var(--card))}
.it.off .bd{opacity:.55}
.it .r1{display:flex;align-items:center;gap:10px}.it .r1 b{font-size:1rem;flex:1;min-width:0}.it .r1 .btn{flex:none}
.it .sub{font-size:.78rem;color:var(--muted)}
.it .wt{all:unset;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:34px;cursor:pointer;font-size:.8rem;font-weight:700;color:var(--cc,var(--accent))}.it .wt i{font-style:normal;font-size:1.1rem;line-height:1}
.wsh{max-height:90%;display:flex;flex-direction:column;padding:0!important;overflow:hidden;background:linear-gradient(180deg,var(--card2),var(--bg2) 42%);border-color:var(--line2);box-shadow:0 -24px 70px #000a}
.wsh .gr{align-self:center;flex:none;width:42px;height:5px;border-radius:3px;background:var(--line2);margin:10px 0 4px}
.wsh .wh{position:relative;display:flex;align-items:flex-start;gap:12px;padding:12px 18px 14px 24px}.wsh .wh::before{content:"";position:absolute;left:0;top:14px;bottom:16px;width:5px;border-radius:0 5px 5px 0;background:var(--cc,var(--accent))}
.wsh .wh>div{flex:1;min-width:0}.wsh .wk{display:block;font-size:.66rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--cc,var(--accent));margin-bottom:5px}
.wsh h3{font-size:1.6rem;font-weight:800;letter-spacing:-.015em;line-height:1.05;margin:0 0 5px}.wsh .wh p{margin:0;font-size:.88rem;font-weight:600;color:var(--muted)}
.wsh .wx{width:44px;height:44px;flex:none;border-radius:50%;border:1px solid var(--line2);background:var(--card);color:var(--ink);display:grid;place-items:center;padding:0;cursor:pointer}
.wsh .wo{margin:0 18px 14px;padding:14px 16px;border-radius:18px;background:var(--card);border:1px solid var(--line);display:flex;flex-direction:column;gap:12px}
.wsh .wr{display:flex;align-items:flex-end;justify-content:space-between;gap:10px}.wsh .wr>span{display:flex;align-items:baseline;gap:7px}.wsh .wr b{font-size:2.3rem;font-weight:800;line-height:.95;letter-spacing:-.02em}.wsh .wr small{font-size:.86rem;font-weight:600;color:var(--muted)}
.wsh .wc{height:30px;padding:0 12px;border-radius:15px;background:var(--ok-soft);color:var(--ok);font-size:.78rem;font-weight:800;display:flex;align-items:center;white-space:nowrap}.wsh .wc.low{background:var(--warn-soft);color:var(--warn)}.wsh .wc.full{background:var(--bad-soft);color:var(--bad)}
.wsh .wpips{display:flex;gap:4px}.wsh .wpips i{flex:1;min-width:0;height:9px;border-radius:5px;background:var(--line2)}.wsh .wpips i.on{background:var(--cc,var(--accent))}
.wsh .wl{padding:2px 24px 6px;font-size:.66rem;font-weight:800;letter-spacing:.14em;color:var(--muted)}
.wsh .wg{flex:1;min-height:0;overflow:auto;padding:0 14px 10px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;align-content:start}
.wsh .wp{height:58px;display:flex;align-items:center;gap:11px;padding:0 12px 0 9px;border-radius:16px;min-width:0;background:var(--card);border:1px solid var(--line);animation:wpin .35s ease both}@keyframes wpin{from{opacity:0;transform:translateY(6px)}}
.wsh .wp.me{grid-column:1/-1;background:linear-gradient(100deg,var(--accent-soft),var(--card));border-color:color-mix(in srgb,var(--accent) 55%,transparent)}
.wsh .wa{width:40px;height:40px;flex:none;border-radius:50%;display:grid;place-items:center;font-size:.78rem;font-weight:800;letter-spacing:.02em}.wsh .wp.me .wa{background:var(--accent);color:var(--on-accent)}
.wsh .wp b{flex:1;min-width:0;font-size:.92rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.wsh .wp .wm{flex:none;height:24px;padding:0 10px;border-radius:12px;background:var(--accent);color:var(--on-accent);font-size:.7rem;font-weight:800;display:flex;align-items:center}
.wsh .wf{padding:14px 18px calc(20px + env(safe-area-inset-bottom,0px));border-top:1px solid var(--line);background:color-mix(in srgb,var(--bg2) 88%,transparent);backdrop-filter:blur(10px)}.wsh .wf .btn{width:100%;height:56px;font-size:1.02rem;font-weight:800;border-radius:18px;box-shadow:0 8px 24px color-mix(in srgb,var(--accent) 30%,transparent)}
.it .bar{margin:0;height:5px}.it .bar i{background:var(--cc,var(--accent))}.it .bar i.full{background:var(--bad)}
.it .r2{display:flex;justify-content:space-between;gap:10px;font-size:.78rem;color:var(--muted)}
.it .r2 .lo{color:var(--warn);font-weight:700}
.it.pt .bd{padding:9px 12px 9px 13px;flex-direction:row;align-items:center;gap:10px}.it.pt .tm{padding-top:10px}
.btn.sm{min-height:36px;padding:0 15px;font-size:.86rem}
.btn.ok{background:var(--ok-soft);color:var(--ok);box-shadow:inset 0 0 0 1.5px #1d5a3a}
.btn.pop{animation:pop .3s ease}@keyframes pop{50%{transform:scale(1.08)}}
.sk{height:78px;border-radius:16px;margin:0 0 9px;background:linear-gradient(90deg,var(--card),var(--card2),var(--card));background-size:200% 100%;animation:sk 1.2s linear infinite}
@keyframes sk{to{background-position:-200% 0}}
.mn{display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid var(--line);cursor:pointer}.mn:first-of-type{border-top:0}.mn .d1{flex:1;min-width:0}.mn .d1 b{display:block;font-size:.92rem}.mn .d1 span{font-size:.78rem;color:var(--muted)}
.toast{display:flex;align-items:center;gap:10px}.toast span{flex:1}.toast button{flex:none;background:transparent;border:0;color:inherit;font:inherit;font-weight:800;text-decoration:underline;cursor:pointer;padding:4px 2px}
.shade{position:fixed;inset:0;background:#000b;z-index:50;display:flex;align-items:flex-end;justify-content:center;animation:fd .15s ease}@keyframes fd{from{opacity:0}}
.sheet{width:100%;max-width:560px;background:var(--bg2);border:1px solid var(--line2);border-radius:22px 22px 0 0;padding:18px 16px calc(22px + env(safe-area-inset-bottom,0px));animation:up .22s ease}@keyframes up{from{transform:translateY(40px);opacity:.4}}
.sheet h3{margin:0 0 2px;font-size:1.1rem}.sheet p{margin:0 0 12px;color:var(--muted);font-size:.86rem}
.sheet .err{margin:0 0 10px}
.gate{padding:20px 18px 18px;border:1px solid var(--line);border-radius:22px;background:var(--card);animation:in .28s ease both}
.gate h2{margin:0 0 4px;font-size:1.35rem;letter-spacing:-.01em}.gate p{margin:0 0 14px;color:var(--muted);font-size:.92rem}
.gate .two{display:grid;grid-template-columns:1fr 1fr;gap:10px}@media(max-width:480px){.gate .two{grid-template-columns:1fr}}
.gate .btn{margin-top:6px}
.seg[hidden]{display:none}
.seg{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:4px;border-radius:16px;background:var(--card);border:1px solid var(--line);margin:0 0 10px}
.seg button{min-height:42px;border:0;border-radius:12px;background:transparent;color:var(--muted);font:inherit;font-weight:700;cursor:pointer;transition:background .15s,color .15s}
.seg button[aria-pressed="true"]{background:var(--accent);color:var(--on-accent)}
.appin{animation:in .28s ease both}
.pl{font-size:.8rem;color:var(--muted);line-height:1.35}
</style></head><body><div class="wrap">
<div class="gh"><div class="logo" role="img" aria-label="Logo"></div><div><h1 id="nm">Palestra</h1><small id="tg"></small></div></div>
<div id="closed" class="why" hidden>Le prenotazioni online sono sospese. Contatta la palestra.</div>
<div id="gate" hidden></div>
<div id="app" hidden>
<div id="who"></div>
<div id="mine"></div>
<div id="sched">
<div class="seg" id="seg" hidden></div>
<div class="strip" id="days" aria-label="Scegli il giorno"></div>
<div class="flt" id="flt"></div>
<div class="dl" id="dl"></div>
<div id="cls"><div class="sk"></div><div class="sk"></div><div class="sk"></div></div>
</div>
</div>
<div class="foot" id="foot"></div>
</div><div id="tz"></div><div id="sh"></div>
<script>
(function(){
var API="/api/palestra?b="+encodeURIComponent((new URLSearchParams(location.search).get("b")||location.pathname.split("/").filter(Boolean).pop()||""));
var DN=["dom","lun","mar","mer","gio","ven","sab"],DL=["Domenica","Lunedì","Martedì","Mercoledì","Giovedì","Venerdì","Sabato"];
var MO=["gen","feb","mar","apr","mag","giu","lug","ago","set","ott","nov","dic"];
var CC={circuiti:"#2BB3A6",hyrox:"#E0A030",pilates:"#9C84E0",personal:"#4F8DF0"};
var S={info:null,id:null,me:null,day:null,days:[],data:{},flt:"all",busy:{},ready:false,mode:"cls"};
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
function pad(n){return String(n).padStart(2,"0")}
function ymd(d){return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())}
function parse(s){var p=s.split("-");return new Date(+p[0],+p[1]-1,+p[2])}
function endT(t,m){var a=t.split(":"),x=(+a[0])*60+(+a[1])+m;return pad(Math.floor(x/60)%24)+":"+pad(x%60)}
function lsGet(){try{return JSON.parse(localStorage.getItem("gym_id_"+API)||"null")}catch(e){return null}}
function lsSet(v){try{if(v)localStorage.setItem("gym_id_"+API,JSON.stringify(v));else localStorage.removeItem("gym_id_"+API)}catch(e){}}
function post(body){return fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}).then(function(r){return r.json().then(function(j){if(!r.ok){var er=new Error(j.error||"Errore");er.status=r.status;throw er}return j})})}
function auth(x){var o=Object.assign({},x||{});if(S.id){o.first=S.id.first;o.last=S.id.last;o.phone=S.id.phone}return o}
var tt=null;
function toast(m,k,act,fn){var box=document.getElementById("tz");box.textContent="";var t=el("div","toast "+(k||"")),s=el("span",null,m);t.appendChild(s);
  if(act){var b=el("button",null,act);b.onclick=function(){box.textContent="";fn()};t.appendChild(b)}
  box.appendChild(t);clearTimeout(tt);tt=setTimeout(function(){if(t.parentNode)t.parentNode.removeChild(t)},act?6500:3800)}
function catOf(s){return s.course&&s.course.category?s.course.category:"corsi"}

/* ---------- dati: tutta la finestra in una chiamata, poi tutto è locale ---------- */
function loadAll(silent){
  return post(auth({action:"days"})).then(function(j){var m={};j.days.forEach(function(d){m[d.date]=d});S.data=m;S.ready=true;if(!silent||true){renderStrip();renderDay()}}).catch(function(e){
    if(e.status===401&&S.id){S.id=null;S.me=null;lsSet(null);showGate();return}
    if(!S.ready){var b=document.getElementById("cls");b.textContent="";b.appendChild(el("div","why",e.message))}})}
function loadMe(){return S.id?post(auth({action:"me"})).then(function(j){S.me=j}):Promise.resolve()}
function syncAll(){return Promise.all([loadMe().catch(function(){}),loadAll(true)]).then(function(){var m=modes();if(!m[S.mode]&&(m.cls||m.pt))S.mode=m.cls?"cls":"pt";renderWho();renderMine();renderSeg();renderStrip();renderDay()})}

/* ---------- cosa può prenotare questa persona ---------- */
function modes(){var m={cls:false,pt:false};((S.me&&S.me.plans)||[]).forEach(function(p){if(!p.valid)return;(p.covers||[]).forEach(function(c){var I=S.info||{};if(c==="personal"){if(I.personal!==false)m.pt=true}else if(I.classes!==false)m.cls=true})});return m}
function shown(s){return s.mine||(!s.cancelled&&!s.started)}
function cnt(d0){return !d0?0:(S.mode==="pt"?d0.pt.length:d0.sessions.filter(shown).length)}

/* ---------- prima schermata: chi sei ---------- */
function showGate(msg){
  S.id=null;S.me=null;lsSet(null);try{localStorage.removeItem("gym_boot_"+API)}catch(e){}S.data={};S.ready=false;
  document.getElementById("app").hidden=true;
  var g=document.getElementById("gate");g.textContent="";g.hidden=false;
  var c=el("div","gate");c.appendChild(el("h2",null,"Prenota il tuo posto"));c.appendChild(el("p",null,"Scrivi i dati con cui sei iscritto in palestra: ci vuole un attimo."));
  var err=el("div","why err");err.hidden=!msg;if(msg)err.textContent=msg;err.style.marginBottom="10px";c.appendChild(err);
  function f(lab,id,type,ac){var l=el("label","f"),sp=el("span",null,lab),i=el("input");i.id=id;i.type=type||"text";if(ac)i.autocomplete=ac;i.setAttribute("enterkeyhint","next");l.appendChild(sp);l.appendChild(i);return l}
  var two=el("div","two");two.appendChild(f("Nome","f1","text","given-name"));two.appendChild(f("Cognome","f2","text","family-name"));c.appendChild(two);
  var ph=f("Numero di telefono","f3","tel","tel");ph.querySelector("input").inputMode="tel";ph.querySelector("input").setAttribute("enterkeyhint","go");c.appendChild(ph);
  var b=el("button","btn block","Continua");b.type="button";
  function go(){
    var id={first:document.getElementById("f1").value.trim(),last:document.getElementById("f2").value.trim(),phone:document.getElementById("f3").value.trim()};
    if(!id.first||!id.last||!id.phone){err.textContent="Scrivi nome, cognome e telefono.";err.hidden=false;return}
    b.disabled=true;b.textContent="Un attimo…";err.hidden=true;
    post({action:"login",first:id.first,last:id.last,phone:id.phone}).then(function(j){S.id=id;S.me=j;lsSet(id);return loadAll(true).then(function(){showApp()})}).catch(function(e){b.disabled=false;b.textContent="Continua";err.textContent=e.message;err.hidden=false})}
  b.onclick=go;c.appendChild(b);
  c.addEventListener("keydown",function(e){if(e.key==="Enter"){e.preventDefault();go()}});
  var pr=el("div","muted");pr.style.cssText="font-size:.74rem;margin-top:12px";pr.appendChild(document.createTextNode("I tuoi dati servono solo a gestire le prenotazioni. "));var a=el("a",null,"Privacy");a.href=S.info.privacy;a.style.color="var(--muted)";pr.appendChild(a);c.appendChild(pr);
  g.appendChild(c);setTimeout(function(){var i=document.getElementById("f1");if(i)i.focus()},150)}

/* ---------- seconda schermata ---------- */
function showApp(){
  document.getElementById("gate").hidden=true;var app=document.getElementById("app");
  if(app.hidden){app.hidden=false;app.classList.remove("appin");void app.offsetWidth;app.classList.add("appin")}
  var m=modes();if(!m[S.mode])S.mode=m.cls?"cls":"pt";
  renderWho();renderMine();
  var sc=document.getElementById("sched");sc.hidden=!(m.cls||m.pt);
  if(sc.hidden)return;
  renderSeg();renderStrip();renderDay();
  var on=S.days.find(function(k){return cnt(S.data[k])>0});if(on&&on!==S.day&&cnt(S.data[S.day])===0){S.day=on;renderStrip();renderDay()}}
function renderSeg(){
  var m=modes(),box=document.getElementById("seg");box.textContent="";box.hidden=!(m.cls&&m.pt);if(box.hidden)return;
  [["cls","Corsi"],["pt","Personal 1:1"]].forEach(function(x){var b=el("button",null,x[1]);b.type="button";b.setAttribute("aria-pressed",S.mode===x[0]?"true":"false");b.onclick=function(){if(S.mode===x[0])return;S.mode=x[0];S.flt="all";renderSeg();renderStrip();renderDay()};box.appendChild(b)})}

/* ---------- intestazione persona ---------- */
function renderWho(){
  var box=document.getElementById("who");box.textContent="";
  if(!S.me)return;
  var h=el("div","hi"),l=el("div");l.appendChild(el("b",null,"Ciao "+S.me.member.first_name));
  var pls=(S.me.plans||[]).filter(function(p){return p.valid});if(!pls.length)l.appendChild(el("div","muted",S.me.status.detail));
  pls.forEach(function(p){l.appendChild(el("div","pl",p.line))});
  h.appendChild(l);h.appendChild(el("span","sp"));
  var st=S.me.status;h.appendChild(el("span","chip "+(st.s==="none"?"none":st.s),st.label));
  var out=el("button","lnk","Non sono io");out.onclick=function(){showGate()};h.appendChild(out);box.appendChild(h);
  var m=modes();
  if(!m.cls&&!m.pt){
    var anyPt=(S.me.plans||[]).some(function(p){return (p.covers||[]).indexOf("personal")>=0});
    var wx=el("div","why",anyPt&&!S.me.expired?"Hai finito le lezioni del Piano Personal. Chiedi in palestra di rinnovarlo.":S.me.ends_on?"Il tuo abbonamento è scaduto il "+parse(S.me.ends_on).getDate()+" "+MO[parse(S.me.ends_on).getMonth()]+". Rinnovalo in palestra per tornare a prenotare.":"Non hai un abbonamento attivo. Chiedi in palestra per prenotare.");wx.style.marginBottom="12px";box.appendChild(wx)}}

function renderMine(){
  var box=document.getElementById("mine");box.textContent="";
  if(!S.me||!S.me.bookings.length)return;
  var c=el("div","card");c.style.marginBottom="12px";c.appendChild(el("div","lb","Le tue prenotazioni")).style.margin="0 0 4px";
  S.me.bookings.slice(0,3).forEach(function(b){
    var r=el("div","mn"),l=el("div","d1"),d=parse(b.date);
    l.appendChild(el("b",null,b.name));l.appendChild(el("span",null,DL[d.getDay()]+" "+d.getDate()+" "+MO[d.getMonth()]+" · "+b.time));r.appendChild(l);
    r.onclick=function(){if(S.data[b.date]){S.day=b.date;renderStrip();renderDay()}};
    if(b.can_cancel){var x=el("button","btn ghost sm","Disdici");x.onclick=function(ev){ev.stopPropagation();cancel(b.id,b.kind,x)};r.appendChild(x)}else r.appendChild(el("span","muted","Non più disdicibile"));
    c.appendChild(r)});
  if(S.me.bookings.length>3){var m=el("div","muted","+ altre "+(S.me.bookings.length-3)+" prenotazioni");m.style.cssText="font-size:.78rem;padding-top:6px";c.appendChild(m)}
  box.appendChild(c)}

/* ---------- giorni ---------- */
function hasBk(k){var d=S.data[k];return !!(d&&(d.sessions.some(function(s){return s.mine})||d.pt.some(function(p){return p.mine})))}
function renderStrip(){
  var w=document.getElementById("days");w.textContent="";var last="";
  S.days.forEach(function(k,i){var d=parse(k),d0=S.data[k],off=S.ready&&d0&&cnt(d0)===0;
    var b=el("button","dd"+(off?" off":"")+(hasBk(k)?" has":""));b.type="button";b.setAttribute("aria-pressed",k===S.day?"true":"false");
    b.appendChild(el("small",null,i===0?"oggi":DN[d.getDay()]));b.appendChild(el("b",null,d.getDate()));
    var mo=MO[d.getMonth()];b.appendChild(el("em",null,mo!==last?mo:""));last=mo;
    b.onclick=function(){pick(k)};w.appendChild(b)});
  var on=w.querySelector('[aria-pressed="true"]');if(on&&on.scrollIntoView){try{w.scrollTo({left:on.offsetLeft-w.clientWidth/2+on.clientWidth/2,behavior:"smooth"})}catch(e){}}}
function pick(k){if(k===S.day)return;S.day=k;S.flt=S.flt;renderStrip();renderDay()}
function step(n){var i=S.days.indexOf(S.day)+n;if(i>=0&&i<S.days.length)pick(S.days[i])}

function renderFlt(d){
  var box=document.getElementById("flt");box.textContent="";
  var names=[],seen={};if(S.mode==="pt"){box.style.display="none";return}Object.keys(S.data).forEach(function(k){S.data[k].sessions.forEach(function(s){if(!shown(s))return;if(!seen[s.course.name]){seen[s.course.name]=1;names.push(s.course.name)}})});
  if(names.length<2){box.style.display="none";return}box.style.display="";
  ["Tutti"].concat(names).forEach(function(n){var v=n==="Tutti"?"all":n,b=el("button","cp",n);b.type="button";b.setAttribute("aria-pressed",S.flt===v?"true":"false");b.onclick=function(){S.flt=v;renderFlt();renderDay()};box.appendChild(b)})}

/* ---------- lista del giorno ---------- */
function renderDay(){
  var d0=S.data[S.day],d=parse(S.day),box=document.getElementById("cls");
  document.getElementById("dl").textContent="";
  var dl=document.getElementById("dl");dl.appendChild(el("b",null,DL[d.getDay()]+" "+d.getDate()+" "+MO[d.getMonth()]));
  renderFlt();
  if(!d0){box.textContent="";for(var i=0;i<3;i++)box.appendChild(el("div","sk"));return}
  var items=[],pt=S.mode==="pt";
  if(pt)d0.pt.forEach(function(p){items.push({t:p.time,p:p})});else d0.sessions.forEach(function(s){if(shown(s))items.push({t:s.time,s:s})});
  items.sort(function(a,b){return a.t<b.t?-1:a.t>b.t?1:0});
  if(!pt&&S.flt!=="all")items=items.filter(function(x){return x.s.course.name===S.flt});
  var n=items.filter(function(x){return x.s?!x.s.cancelled:true}).length;
  dl.appendChild(el("span",null,n?(pt?n+(n===1?" slot libero":" slot liberi"):n+(n===1?" lezione":" lezioni")):""));
  box.textContent="";
  if(!items.length){var e=el("div","empty",pt?"Nessuno slot libero in questo giorno.":"Nessuna lezione in questo giorno.");
    var nx=null;for(var j=S.days.indexOf(S.day)+1;j<S.days.length;j++){var q=S.data[S.days[j]];if(cnt(q)>0){nx=S.days[j];break}}
    if(nx){var bb=el("button","btn sm",pt?"Vai al prossimo giorno con slot liberi":"Vai al prossimo giorno con lezioni");bb.style.cssText="display:block;margin:10px auto 0";bb.onclick=function(){pick(nx)};e.appendChild(bb)}
    box.appendChild(e);return}
  items.forEach(function(x,i){var node=x.s?cardCls(x.s):cardPt(x.p);node.style.animationDelay=Math.min(i,8)*25+"ms";box.appendChild(node)})}

function cardCls(s){
  var cat=catOf(s),it=el("div","it"+(s.mine?" mine":"")+(s.cancelled?" off":""));it.style.setProperty("--cc",CC[cat]||"var(--accent)");
  var tm=el("div","tm",s.time);tm.appendChild(el("small",null,endT(s.time,s.duration_min)));it.appendChild(tm);
  var bd=el("div","bd"),r1=el("div","r1");r1.appendChild(el("b",null,s.course.name));
  var left=Math.max(0,s.capacity-s.taken),pend=!!S.busy[s.schedule_id];
  if(s.mine){var x=el("button","btn ok sm",pend?"…":"Prenotato ✓");x.type="button";x.onclick=function(){if(pend)return;x.textContent="Disdire?";x.className="btn ghost sm";x.onclick=function(){cancel(s.mine,"class",x)};setTimeout(function(){if(x.isConnected)renderDay()},3000)};r1.appendChild(x)}
  else if(s.cancelled||s.started){r1.appendChild(el("span","muted",s.cancelled?"Annullata":"Già iniziata"))}
  else if(left===0){r1.appendChild(el("span","muted","Al completo"))}
  else{var b=el("button","btn sm",pend?"…":"Prenota");b.type="button";
    if(s.can&&!s.can.ok){b.disabled=true;b.textContent="Non disponibile"}else b.onclick=function(){bookCls(s)};
    r1.appendChild(b)}
  bd.appendChild(r1);
  var sub=s.duration_min+" min"+(s.course.description?" · "+s.course.description:"");bd.appendChild(el("div","sub",sub));
  var bar=el("div","bar"),i2=el("i",s.taken>=s.capacity?"full":"");i2.style.width=Math.min(100,Math.round(s.taken/s.capacity*100))+"%";bar.appendChild(i2);bd.appendChild(bar);
  var r2=el("div","r2");r2.appendChild(el("span",left&&left<=3?"lo":null,s.cancelled?"":left?(left===1?"Ultimo posto":left+" posti liberi"):"Al completo"));r2.appendChild(el("span",null,s.taken+"/"+s.capacity));bd.appendChild(r2);
  if(s.who&&s.who.length&&!s.cancelled){var wt=el("button","wt");wt.type="button";wt.appendChild(el("span",null,"Chi partecipa · "+s.who.length));wt.appendChild(el("i",null,"›"));wt.onclick=function(ev){ev.stopPropagation();openWho(s)};bd.appendChild(wt);it.addEventListener("click",function(ev){if(ev.target.closest("button"))return;openWho(s)})}
  if(!s.mine&&s.can&&!s.can.ok&&s.can.message&&s.can.code!=="expired"&&s.can.code!=="full"&&!s.cancelled&&!s.started)bd.appendChild(el("div","sub",s.can.message));
  it.appendChild(bd);return it}
function cardPt(p){
  var it=el("div","it pt"+(p.mine?" mine":""));it.style.setProperty("--cc",CC.personal);
  var tm=el("div","tm",p.time);tm.appendChild(el("small",null,endT(p.time,60)));it.appendChild(tm);
  var bd=el("div","bd"),l=el("div");l.style.flex="1";var nm=el("b",null,"Personal 1:1");nm.style.fontSize="1rem";l.appendChild(nm);l.appendChild(el("div","sub","60 min con il trainer"));bd.appendChild(l);
  var pend=!!S.busy["pt"+p.time];
  if(p.mine){var x=el("button","btn ok sm",pend?"…":"Prenotato ✓");x.type="button";x.onclick=function(){if(pend)return;x.textContent="Disdire?";x.className="btn ghost sm";x.onclick=function(){cancel(p.mine,"pt",x)};setTimeout(function(){if(x.isConnected)renderDay()},3000)};bd.appendChild(x)}
  else{var b=el("button","btn sm",pend?"…":"Prenota");b.type="button";
    if(p.can&&!p.can.ok){b.disabled=true;b.textContent=p.can.code==="one_per_day"?"Già uno oggi":"Non disponibile"}else b.onclick=function(){bookPt(p)};
    bd.appendChild(b)}
  it.appendChild(bd);return it}

/* ---------- azioni: la schermata risponde subito, il server conferma dopo ---------- */
function openWho(s){
  var sh=el("div","shade"),w=el("div","sheet wsh");sh.appendChild(w);function close(){if(sh.parentNode)sh.parentNode.removeChild(sh)}
  w.style.setProperty("--cc",CC[catOf(s)]||"var(--accent)");
  sh.addEventListener("click",function(e){if(e.target===sh)close()});
  w.appendChild(el("span","gr"));
  var d=parse(S.day),hd=el("div","wh"),tx=el("div");tx.appendChild(el("span","wk","Chi partecipa"));tx.appendChild(el("h3",null,s.course.name+" · "+s.time));tx.appendChild(el("p",null,DL[d.getDay()]+" "+d.getDate()+" "+MO[d.getMonth()]));hd.appendChild(tx);
  var x=el("button","wx");x.type="button";x.setAttribute("aria-label","Chiudi");x.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';x.onclick=close;hd.appendChild(x);w.appendChild(hd);
  var left=Math.max(0,s.capacity-s.taken),oc=el("div","wo"),rw=el("div","wr"),nb=el("span");nb.appendChild(el("b",null,String(s.taken)));nb.appendChild(el("small",null,"su "+s.capacity+" posti"));rw.appendChild(nb);
  rw.appendChild(el("span","wc"+(!left?" full":left<=3?" low":""),left?left+(left===1?" posto libero":" posti liberi"):"Al completo"));oc.appendChild(rw);
  if(s.capacity<=40){var pp=el("div","wpips");for(var q=0;q<s.capacity;q++)pp.appendChild(el("i",q<s.taken?"on":""));oc.appendChild(pp)}
  w.appendChild(oc);
  w.appendChild(el("div","wl","ISCRITTI · "+(s.who||[]).length));
  var g=el("div","wg"),names=(s.who||[]).slice();
  function hue(n){var h=0;for(var i=0;i<n.length;i++)h=(h*31+n.charCodeAt(i))%360;return h}
  names.forEach(function(n,ix){var me=n==="Tu",p=el("div","wp"+(me?" me":"")),pp2=n.replace(".","").split(" "),a=el("span","wa",me?"TU":((pp2[0]||"?").charAt(0)+(pp2[1]||"").charAt(0)).toUpperCase());
    if(!me){var h=hue(n);a.style.background="hsl("+h+" 42% 22%)";a.style.color="hsl("+h+" 80% 80%)"}
    p.style.animationDelay=Math.min(ix*25,500)+"ms";p.appendChild(a);p.appendChild(el("b",null,me?"Tu":n));if(me)p.appendChild(el("span","wm","Prenotato"));g.appendChild(p)});w.appendChild(g);
  var can=!s.mine&&!s.cancelled&&!s.started&&left>0&&!(s.can&&!s.can.ok);
  if(can){var f=el("div","wf"),b=el("button","btn","Prenota");b.type="button";b.onclick=function(){close();bookCls(s)};f.appendChild(b);w.appendChild(f)}
  document.body.appendChild(sh);
}
function bookCls(s){
  var key=s.schedule_id;if(S.busy[key])return;S.busy[key]=1;var day=S.day;
  s.mine="tmp";s.taken++;renderDay();renderStrip();
  post(auth({action:"book",schedule_id:s.schedule_id,date:day})).then(function(j){
    S.busy[key]=0;var bid=j&&j.booking&&j.booking.id;if(bid)s.mine=bid;renderDay();
    toast("Prenotato: "+s.course.name+" alle "+s.time,"ok","Annulla",function(){var id=s.mine;if(!id||id==="tmp"){syncAll().then(function(){var q=(S.data[day]||{sessions:[]}).sessions.filter(function(z){return z.schedule_id===s.schedule_id})[0];if(q&&q.mine)cancel(q.mine,"class")});return}cancel(id,"class")});
    syncAll()}).catch(function(e){S.busy[key]=0;s.mine=null;s.taken=Math.max(0,s.taken-1);renderDay();renderStrip();toast(e.message,"bad");syncAll()})}
function bookPt(p){
  var key="pt"+p.time;if(S.busy[key])return;S.busy[key]=1;var day=S.day;p.mine="tmp";renderDay();renderStrip();
  post(auth({action:"pt_book",date:day,time:p.time})).then(function(j){S.busy[key]=0;var bid=j&&j.booking&&j.booking.id;if(bid)p.mine=bid;renderDay();
    toast("Prenotato: Personal 1:1 alle "+p.time,"ok","Annulla",function(){var id=p.mine;if(!id||id==="tmp"){syncAll().then(function(){var q=(S.data[day]||{pt:[]}).pt.filter(function(z){return z.time===p.time})[0];if(q&&q.mine)cancel(q.mine,"pt")});return}cancel(id,"pt")});syncAll()
  }).catch(function(e){S.busy[key]=0;p.mine=null;renderDay();renderStrip();toast(e.message,"bad");syncAll()})}
function cancel(id,kind,btn){
  if(btn){btn.disabled=true;btn.textContent="…"}
  post(auth({action:"cancel",booking_id:id,kind:kind||"class"})).then(function(j){toast(j.refunded?"Disdetto. L'ingresso ti è stato restituito.":"Prenotazione disdetta.","ok");return syncAll()}).catch(function(e){toast(e.message,"bad");return syncAll()})}

/* ---------- scorrimento laterale tra i giorni ---------- */
(function(){var x0=null,y0=null,box=document.body;
  box.addEventListener("touchstart",function(e){if(e.target.closest&&(e.target.closest("#days")||e.target.closest("#flt")||e.target.closest(".sheet")))return x0=null;var t=e.touches[0];x0=t.clientX;y0=t.clientY},{passive:true});
  box.addEventListener("touchend",function(e){if(x0==null)return;var t=e.changedTouches[0],dx=t.clientX-x0,dy=t.clientY-y0;x0=null;if(Math.abs(dx)>70&&Math.abs(dx)>Math.abs(dy)*1.8)step(dx<0?1:-1)},{passive:true})})();

function applyInfo(info){
  S.info=info;document.getElementById("nm").textContent=info.name;document.title=info.name+" · Prenota";
  document.getElementById("tg").textContent=info.tagline||info.address||"";
  var cl=document.getElementById("closed");cl.hidden=info.open!==false;cl.textContent=info.online===false?"Questa palestra non usa la prenotazione online. Per prenotare contatta la palestra.":"Le prenotazioni online sono sospese. Contatta la palestra.";
  S.days=[];var t=parse(info.today);for(var i=0;i<info.days_ahead;i++){var d=new Date(t);d.setDate(d.getDate()+i);S.days.push(ymd(d))}
  if(!S.day||S.days.indexOf(S.day)<0)S.day=S.days[0];
  var f=document.getElementById("foot");f.textContent="Puoi disdire fino a "+(info.cutoff_min%60===0?(info.cutoff_min/60)+"h":info.cutoff_min+" min")+" prima della lezione.";
}
function applyBoot(j){applyInfo(j.info);S.me=j.me;var m={};j.days.forEach(function(d){m[d.date]=d});S.data=m;S.ready=true}
var CK="gym_boot_"+API;
function ckGet(){try{return JSON.parse(localStorage.getItem(CK)||"null")}catch(e){return null}}
function ckSet(v){try{if(v)localStorage.setItem(CK,JSON.stringify(v));else localStorage.removeItem(CK)}catch(e){}}
function fail(e){var g=document.getElementById("gate");g.hidden=false;g.textContent="";g.appendChild(el("div","why",e.message||"Palestra non trovata"))}
function gateFromInfo(){return fetch(API+"&info=1").then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.error||"Errore");return j})}).then(function(info){applyInfo(info);showGate()})}
S.id=lsGet();
if(!S.id){ckSet(null);gateFromInfo().catch(fail)}
else{
  /* apertura veloce: mostra subito l'ultima schermata salvata, intanto una sola richiesta porta i dati aggiornati */
  var ck=ckGet(),painted=false;
  if(ck&&ck.info&&ck.days){try{applyBoot(ck);showApp();painted=true}catch(e){painted=false}}
  post({action:"boot",first:S.id.first,last:S.id.last,phone:S.id.phone}).then(function(j){applyBoot(j);ckSet(j);showApp();renderStrip();renderDay()},function(e){
    if(e&&e.status===401){ckSet(null);return gateFromInfo()}
    if(!painted)throw e});
}
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
