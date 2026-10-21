
(function(){
  var panels = { cal: document.getElementById('panelCal'), clients: document.getElementById('panelClients'), stats: document.getElementById('panelStats'), profile: document.getElementById('panelProfile'), other: document.getElementById('panelOther') };
  var LABELS = { cal: 'Calendario', clients: 'Clienti', stats: 'Statistiche', profile: 'Scheda attività', other: 'Impostazioni' };

  var menuTabs = { cal: document.getElementById('menuTabCal'), clients: document.getElementById('menuTabClients'), stats: document.getElementById('menuTabStats'), profile: document.getElementById('menuTabProfile'), other: document.getElementById('menuTabOther') };
  var burgerBtn = document.getElementById('burgerBtn');
  var burgerMenu = document.getElementById('burgerMenu');
  var menuBackdrop = document.getElementById('menuBackdrop');

  function show(which){
    if(!panels[which])which='cal';
    var panelHost=document.querySelector('.tabPanels');if(panelHost)panelHost.classList.toggle('profileScroll',which==='profile'||which==='plan');
    try{localStorage.setItem('lia_active_section',which);}catch(e){}
    Object.keys(panels).forEach(function(k){
      menuTabs[k].setAttribute('aria-current', k === which ? 'true' : 'false');
      panels[k].classList.toggle('on', k === which);
    });
    if((which==='profile'||which==='plan')&&panelHost)panelHost.scrollTop=0;if(which==='plan'&&panels.plan)panels.plan.scrollTop=0;
    document.getElementById('sectionLabel').textContent = LABELS[which];
    document.getElementById('today').hidden = true;
    document.querySelector('.mainTop').classList.remove('hide');
    document.dispatchEvent(new CustomEvent('lia:section',{detail:which}));
  }

  function openMenu(){
    burgerMenu.hidden = false; menuBackdrop.hidden = false;
    requestAnimationFrame(function(){ burgerMenu.classList.add('on'); menuBackdrop.classList.add('on'); });
    burgerBtn.setAttribute('aria-expanded', 'true');
  }
  function closeMenu(){
    burgerMenu.classList.remove('on'); menuBackdrop.classList.remove('on');
    burgerBtn.setAttribute('aria-expanded', 'false');
    setTimeout(function(){ burgerMenu.hidden = true; menuBackdrop.hidden = true; }, 180);
  }
  burgerBtn.addEventListener('click', function(){
    if (burgerBtn.getAttribute('aria-expanded') === 'true') closeMenu(); else openMenu();
  });
  menuBackdrop.addEventListener('click', closeMenu);
  menuTabs.cal.addEventListener('click', function(){ show('cal'); closeMenu(); });
  menuTabs.clients.addEventListener('click', function(){ show('clients'); closeMenu(); });
  menuTabs.stats.addEventListener('click', function(){ show('stats'); closeMenu(); });
  menuTabs.profile.addEventListener('click', function(){ show('profile'); closeMenu(); });
  menuTabs.other.addEventListener('click', function(){ show('other'); closeMenu(); });
  var logoutBtn=document.getElementById('logoutBtn');if(logoutBtn)logoutBtn.addEventListener('click',function(){logoutBtn.disabled=true;fetch('/api/business-auth',{method:'DELETE'}).finally(function(){try{localStorage.removeItem('lia_active_section');}catch(e){}location.replace('/login.html');});});
  var businessHome=document.getElementById('businessHome');if(businessHome){var goBusinessHome=function(){show('cal');document.dispatchEvent(new CustomEvent('lia:calendar-home'));};businessHome.addEventListener('click',goBusinessHome);businessHome.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();goBusinessHome();}});}
  var initialSection='cal';
  try{var _ne=(performance.getEntriesByType&&performance.getEntriesByType('navigation')[0])||{};if(_ne.type==='reload'){var savedSection=localStorage.getItem('lia_active_section');if(savedSection&&panels[savedSection])initialSection=savedSection;}}catch(e){}
  show(initialSection);

  // ---- mobile: header always visible; desktop keeps auto-hide behavior ----
  (function(){
    var mainTop = document.querySelector('.mainTop');
    if (!mainTop) return;
    if (window.matchMedia && window.matchMedia('(max-width:699px)').matches){ mainTop.classList.remove('hide'); return; }
    var lastY = {};
    function wire(el){
      if (!el) return;
      lastY[el] = el.scrollTop;
      el.addEventListener('scroll', function(){
        var y = el.scrollTop;
        var dy = y - (lastY[el] || 0);
        lastY[el] = y;
        if (y < 16){ mainTop.classList.remove('hide'); return; }
        if (dy > 4) mainTop.classList.add('hide');
        else if (dy < -4) mainTop.classList.remove('hide');
      }, {passive: true});
    }
    setTimeout(function(){
      wire(document.querySelector('.cal-wrap'));
      wire(document.querySelector('.clientsWrap'));
      wire(document.querySelector('#panelProfile'));
      wire(document.querySelector('#statsSubApp .wrap'));
    }, 0);
  })();



  var CLIENTS = [];
  window.liaHistoryVersion=window.liaHistoryVersion||0;
  window.liaGetHistory=function(opt){
    var token=(new URLSearchParams(location.search).get('t')||'').trim();
    if(!token)return Promise.resolve({appointments:[]});
    if(window.liaHistoryCache&&window.liaHistoryCache.version===window.liaHistoryVersion)return Promise.resolve(window.liaHistoryCache.data);
    if(window.liaHistoryPromise)return window.liaHistoryPromise;if(opt&&opt.defer){if(!window.liaHistoryWait)window.liaHistoryWait=new Promise(function(ok){setTimeout(ok,opt.defer)}).then(function(){window.liaHistoryWait=null;return window.liaGetHistory()});return window.liaHistoryWait;}
    window.liaHistoryPromise=fetch('/api/agenda?t='+encodeURIComponent(token)+'&history=1').then(function(r){return r.json().then(function(d){if(!r.ok)throw new Error(d&&d.error||'Storico non disponibile');return d;});}).then(function(d){window.liaHistoryCache={version:window.liaHistoryVersion,data:d};return d;}).finally(function(){window.liaHistoryPromise=null;});
    return window.liaHistoryPromise;
  };
  window.liaEnsureClients=function(){
    if(window.liaClients&&window.liaClients.length)return Promise.resolve(window.liaClients);
    if(window.liaClientsPromise)return window.liaClientsPromise;
    window.liaClientsPromise=window.liaGetHistory().then(function(data){
      var now=new Date(),byPhone={},ns={};
      (data.appointments||[]).forEach(function(a){
        if(a.status==='no_show'&&a.customer_phone){ns[a.customer_phone]=(ns[a.customer_phone]||0)+1;if(!byPhone[a.customer_phone])byPhone[a.customer_phone]={name:a.customer_name,phone:a.customer_phone,email:'',visits:0,lastDate:null,past:[],next:null,svc:{}};if(a.customer_email)byPhone[a.customer_phone].email=a.customer_email;return}
        if(a.status!=='confirmed'||!a.customer_phone)return;
        var key=a.customer_phone,st=new Date(a.starts_at),en=new Date(a.ends_at);
        var c=byPhone[key]||(byPhone[key]={name:a.customer_name,phone:key,email:'',visits:0,lastDate:null,past:[],next:null,svc:{}});
        c.name=a.customer_name;if(a.customer_email)c.email=a.customer_email;
        if(st<=now){
          c.visits++;c.past.push({id:a.id,start:st,service:a.service||'',price:a.price_eur});
          if(!c.lastDate||st>c.lastDate)c.lastDate=st;
          if(a.service)c.svc[a.service]=(c.svc[a.service]||0)+1;
        }else if(!c.next||st<c.next.start){c.next={start:st,end:en,service:a.service||''};}
      });
      CLIENTS=Object.keys(byPhone).map(function(k){
        var x=byPhone[k],top='',n=0;
        Object.keys(x.svc).forEach(function(s){if(x.svc[s]>n){n=x.svc[s];top=s;}});
        x.past.sort(function(p,q){return q.start-p.start;});
        return {name:x.name,phone:x.phone,email:x.email||'',visits:x.visits,last:x.lastDate?humanAgo(x.lastDate):'',lastDate:x.lastDate,
          ago:x.lastDate?Math.max(0,Math.round((now-x.lastDate)/86400000)):null,past:x.past,next:x.next,svc:top,noshow:ns[k]||0};
      }).sort(function(a,b){return b.visits-a.visits;});
      window.liaClients=CLIENTS;renderClients();return CLIENTS;
    }).catch(function(){return [];}).finally(function(){window.liaClientsPromise=null;});
    return window.liaClientsPromise;
  };
  function humanAgo(d){
    var days = Math.round((new Date() - d) / 86400000);
    if (days <= 0) return 'oggi';
    if (days === 1) return 'ieri';
    if (days < 14) return days + ' giorni fa';
    if (days < 60) return Math.round(days/7) + ' settimane fa';
    return Math.round(days/30) + ' mesi fa';
  }
  function loadClients(){ return window.liaEnsureClients(); }
  function initials(name){ return name.split(' ').map(function(p){return p[0];}).slice(0,2).join('').toUpperCase(); }
  var clSort='last',clFlt='',clSel=null,clShowAll=false,clDelAsk=false,clDelMsg='';
  var CL_RECALL_DAYS=45;
  function clToken(){return (new URLSearchParams(location.search).get('t')||'').trim();}
  function clWide(){return window.matchMedia&&window.matchMedia('(min-width:700px)').matches;}
  function clMoney(v){if(v===null||v===undefined||v==='')return '';var n=Number(v);if(!isFinite(n))return '';return n.toLocaleString('it-IT',{minimumFractionDigits:0,maximumFractionDigits:2})+' \u20ac';}
  function clHm(d){return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');}
  function clDate(d){return d.toLocaleDateString('it-IT',{day:'numeric',month:'short',year:'numeric'});}
  function clWa(p){var d=String(p||'').replace(/[^\d+]/g,'');if(d.charAt(0)==='+')return d.slice(1);d=d.replace(/^00/,'');if(/^3\d{8,9}$/.test(d))d='39'+d;return d;}
  function clLoadNotes(){ if(window.liaNotes)window.liaNotes.ensure(); }
  function clList(){
    var q=document.getElementById('clientSearch').value.trim().toLowerCase();
    var l=CLIENTS.filter(function(c){return c.name.toLowerCase().indexOf(q)!==-1||(c.email&&c.email.toLowerCase().indexOf(q)!==-1)||String(c.phone).replace(/\s+/g,'').indexOf(q.replace(/\s+/g,''))!==-1&&q.length>2;});
    if(clSort==='last')l.sort(function(a,b){return (a.ago===null?1e9:a.ago)-(b.ago===null?1e9:b.ago);});
    else if(clSort==='visits')l.sort(function(a,b){return b.visits-a.visits;});
    else l.sort(function(a,b){return a.name.localeCompare(b.name,'it');});
    return l;
  }
  function clRow(c){
    var row=document.createElement('div');row.className='crow'+(clSel===c.phone?' sel':'');row.dataset.p=c.phone;
    row.innerHTML='<span class="av"></span><div class="mid"><b></b><span class="last"></span></div><div class="cl-cols"><span class="c1"></span><span class="c2"></span><span class="c3"></span></div><div class="visits"><b></b><span>visite</span></div>';
    row.querySelector('.av').textContent=initials(c.name);
    var nm=row.querySelector('.mid b');nm.textContent=c.name;
    row.querySelector('.last').textContent=(c.lastDate?('Ultima volta: '+c.last):(c.next?'Nuovo cliente':'Nessuna visita'))+(c.noshow?' \u00b7 '+c.noshow+(c.noshow===1?' assenza':' assenze'):'');
    row.querySelector('.visits b').textContent=c.visits;
    row.querySelector('.c1').textContent=c.phone||'';row.querySelector('.c2').textContent=c.svc||'\u2014';
    row.querySelector('.c3').textContent=c.next?('Prossimo '+c.next.start.toLocaleDateString('it-IT',{day:'numeric',month:'short'})):'\u2014';
    return row;
  }
  function renderClients(){
    var l=clList(),box=document.getElementById('clientList'),wrap=document.querySelector('.clientsWrap');
    document.getElementById('clientSummary').textContent=l.length+(l.length===1?' cliente':' clienti');
    var chips=document.getElementById('clChips');
    if(!chips.dataset.ready){
      chips.dataset.ready='1';
      chips.innerHTML='<button type="button" class="cl-chip" data-s="last">Ultima visita</button><button type="button" class="cl-chip" data-s="visits">Pi\u00f9 visite</button><button type="button" class="cl-chip" data-s="name">Nome A\u2013Z</button>';
      chips.addEventListener('click',function(ev){var b=ev.target.closest('.cl-chip');if(!b)return;if(b.dataset.s)clSort=b.dataset.s;renderClients();});
    }
    chips.querySelectorAll('.cl-chip').forEach(function(b){b.classList.toggle('on',b.dataset.s===clSort);});
    box.innerHTML='';
    var az=document.getElementById('clAz');az.hidden=true;az.innerHTML='';wrap.classList.remove('cl-has-az');
    if(!l.length){box.innerHTML='<div class="cempty">Nessun cliente trovato.</div>';clRenderDetail();return;}
    if(clSort==='name'){
      var g='',letters=[];
      l.forEach(function(c){var L=(c.name.charAt(0)||'#').toUpperCase();if(L!==g){g=L;letters.push(L);var h=document.createElement('div');h.className='cl-grp';h.id='clg-'+L;h.textContent=L;box.appendChild(h);}box.appendChild(clRow(c));});
      if(letters.length>3){az.innerHTML=letters.map(function(L){return '<span data-l="'+L+'">'+L+'</span>';}).join('');az.hidden=false;wrap.classList.add('cl-has-az');}
    }else l.forEach(function(c){box.appendChild(clRow(c));});
    clRenderDetail();
  }
  function clDetailHtml(c){
    var ic={call:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>',
      chat:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20.5l1.7-5.4A8.4 8.4 0 1 1 21 11.5z"/></svg>',
      cal:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
      x:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'};
    function esc(t){return String(t==null?'':t).replace(/[&<>"]/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m];});}
    var tel=String(c.phone).replace(/\s+/g,'');
    var nx=c.next?('<div class="cd-next"><div class="cd-dd">'+c.next.start.getDate()+'<small>'+c.next.start.toLocaleDateString('it-IT',{month:'short'})+'</small></div><div><b>'+esc(c.next.service||'Appuntamento')+'</b><div style="color:var(--muted);font-size:.85rem;margin-top:2px">'+c.next.start.toLocaleDateString('it-IT',{weekday:'long'})+' alle '+clHm(c.next.start)+'</div></div></div>'):'<div style="color:var(--muted);font-size:.92rem">Nessun appuntamento in programma</div>';
    var lim=clShowAll?c.past.length:Math.min(c.past.length,8);
    var hist=c.past.slice(0,lim).map(function(h){return '<div class="cd-vh"><div class="cd-hr"><div class="t">'+esc(h.service||'Appuntamento')+'<small>'+clDate(h.start)+'</small></div><div class="pr">'+clMoney(h.price)+'</div></div>'+(h.id?'<div data-vn="'+esc(h.id)+'" data-vs="'+esc(h.start.toISOString())+'"></div>':'')+'</div>';}).join('')||'<div style="color:var(--muted);font-size:.92rem">Nessuna visita registrata</div>';
    var more=c.past.length>8?'<button type="button" class="cd-more" data-more="1">'+(clShowAll?'Mostra meno':'Mostra tutte ('+c.past.length+')')+'</button>':'';
    return '<div class="cd"><button type="button" class="cd-x" data-back="1" aria-label="Chiudi">'+ic.x+'</button>'+
      '<div class="cd-hero"><div class="cd-av">'+esc(initials(c.name))+'</div><h2>'+esc(c.name)+'</h2><div class="p">'+esc(c.phone)+'</div>'+(c.email?'<div class="p cd-mail"><a href="mailto:'+esc(c.email)+'" style="color:inherit;text-decoration:none;overflow-wrap:anywhere">'+esc(c.email)+'</a></div>':'')+'</div>'+
      '<div class="cd-acts"><a class="cd-act" href="tel:'+esc(tel)+'">'+ic.call+'Chiama</a><a class="cd-act" href="https://wa.me/'+esc(clWa(c.phone))+'" target="_blank" rel="noopener">'+ic.chat+'WhatsApp</a><button type="button" class="cd-act main" data-book="1">'+ic.cal+'Prenota</button></div>'+
      '<div class="cd-stats"><div class="cd-st"><small>Visite</small><b>'+c.visits+'</b></div>'+(c.email?'<a class="cd-st cd-st-mail" href="mailto:'+esc(c.email)+'"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 8 8 6 8-6"/></svg>Email</a>':'<div class="cd-st"><small>Ultima</small><b style="font-size:.9rem">'+(c.lastDate?esc(c.last):'\u2014')+'</b></div>')+'<div class="cd-st"><small>Abituale</small><b style="font-size:1rem;overflow-wrap:anywhere">'+(c.svc?esc(c.svc):'\u2014')+'</b></div></div>'+
      (c.noshow?'<p class="cd-ns">Non si \u00e8 presentato '+c.noshow+(c.noshow===1?' volta':' volte')+'</p>':'')+
      '<div class="cd-box"><h3>Prossimo appuntamento</h3>'+nx+'</div>'+
      '<div id="clFixedBox"></div>'+
      '<div class="cd-box"><h3>Storico visite</h3>'+hist+more+'</div>'+clDelHtml(c)+'</div>';
  }
  function clDelHtml(c){
    if(window.liaGymOpen)return '';
    var E=function(x){return String(x==null?'':x).replace(/[&<>"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]})};
    if(!clDelAsk)return '<div class="cd-del"><button type="button" class="cd-delbtn" data-del="ask">Elimina questo cliente</button></div>';
    return '<div class="cd-del"><div class="cd-delask"><p><b>Eliminare '+E(c.name)+'?</b> Cancello nome, telefono, email, note e chat. Le visite passate restano solo come numeri nelle statistiche. Non si può annullare.</p><div class="cd-delrow"><button type="button" data-del="no">Annulla</button><button type="button" class="go" data-del="yes">Sì, elimina</button></div>'+(clDelMsg?'<p class="cd-delmsg">'+E(clDelMsg)+'</p>':'')+'</div></div>';
  }
  function clDelAct(a){
    if(a==='ask'){clDelAsk=true;clDelMsg='';clRenderDetail();return}
    if(a==='no'){clDelAsk=false;clDelMsg='';clRenderDetail();return}
    if(clDelMsg==='Elimino…')return;
    var c=CLIENTS.filter(function(x){return x.phone===clSel})[0];if(!c)return;
    clDelMsg='Elimino…';clRenderDetail();
    fetch('/api/agenda?t='+encodeURIComponent(clToken()),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete_customer',customer_phone:c.phone})})
      .then(function(r){return r.json().catch(function(){return {}}).then(function(d){return {ok:r.ok,d:d}})})
      .then(function(x){
        if(!x.ok){clDelMsg=(x.d&&x.d.error)||'Non sono riuscito a eliminare i dati. Riprova.';clRenderDetail();return}
        clDelAsk=false;clDelMsg='';clSel=null;
        document.dispatchEvent(new CustomEvent('lia:data-changed'));
        clientsLoaded=true;window.liaEnsureClients().then(function(){renderClients()});
      }).catch(function(){clDelMsg='Connessione assente. Riprova.';clRenderDetail()});
  }
  function clMountNotes(root,c){
    if(!window.liaNotes||!root)return;
    var fb=root.querySelector('#clFixedBox');
    if(fb)window.liaNotes.mountFixed(fb,c.phone,{always:true});
    root.querySelectorAll('[data-vn]').forEach(function(b){
      window.liaNotes.mountVisit(b,b.getAttribute('data-vn'),{phone:c.phone,start:b.getAttribute('data-vs')});
    });
  }
  function clRenderDetail(){
    var c=CLIENTS.filter(function(x){return x.phone===clSel;})[0],det=document.getElementById('clDet'),sh=document.getElementById('clSheet'),split=document.getElementById('clSplit');
    if(!c){clSel=null;if(split)split.classList.remove('cl-open');if(sh)sh.hidden=true;if(!split||!split.classList.contains('cl-open'))setTimeout(function(){if(!clSel)det.innerHTML=''},340);return;}
    var html=clDetailHtml(c);
    if(clWide()){det.innerHTML=html;clMountNotes(det,c);if(sh)sh.hidden=true;if(split)split.classList.add('cl-open');}
    else{if(split)split.classList.remove('cl-open');
      if(!sh){sh=document.createElement('div');sh.id='clSheet';sh.hidden=true;document.body.appendChild(sh);}
      var keep=sh.hidden?0:sh.scrollTop;sh.innerHTML=html;clMountNotes(sh,c);sh.hidden=false;sh.scrollTop=keep;}
  }
  function clOpen(p){clSel=p;clShowAll=false;clDelAsk=false;clDelMsg='';clLoadNotes();renderClients();var sh=document.getElementById('clSheet');if(sh)sh.scrollTop=0;var cw=document.querySelector('.clientsWrap');if(cw){cw.scrollTop=0;setTimeout(function(){cw.scrollTop=0},350)}}
  function clClose(){clSel=null;renderClients();}
  document.getElementById('clientSearch').addEventListener('input',renderClients);
  document.addEventListener('click',function(ev){
    var t=ev.target;
    var r=t.closest&&t.closest('#panelClients .crow, #clSheet .cd, #clDet .cd, #clAz span');if(!r&&!(t.closest&&t.closest('#clSheet,#clDet')))return;
    var az=t.closest('#clAz span');if(az){var g=document.getElementById('clg-'+az.dataset.l);if(g)g.scrollIntoView({behavior:'smooth',block:'start'});return;}
    var row=t.closest('#panelClients .crow');if(row){clOpen(row.dataset.p);return;}
    if(t.closest('[data-back]')){clClose();return;}
    var dl=t.closest('[data-del]');if(dl){clDelAct(dl.getAttribute('data-del'));return;} if(t.closest('[data-more]')){clShowAll=!clShowAll;clRenderDetail();return;}
    if(t.closest('[data-book]')){var c=CLIENTS.filter(function(x){return x.phone===clSel;})[0];if(c){var sh=document.getElementById('clSheet');if(sh)sh.hidden=true;if(window.liaOpenNewForClient)window.liaOpenNewForClient(c.name,c.phone);}return;}
  });
  document.addEventListener('keydown',function(ev){if(ev.key==='Escape'&&clSel)clClose();});
  window.addEventListener('resize',function(){if(clSel)clRenderDetail();});
  renderClients();
  var clientsLoaded=false;
  document.addEventListener('lia:section',function(e){ if(e.detail==='clients'&&!clientsLoaded){clientsLoaded=true;loadClients();} });
  document.addEventListener('lia:data-changed',function(){ clientsLoaded=false; window.liaClients=[]; window.liaClientsPromise=null; window.liaHistoryVersion=(window.liaHistoryVersion||0)+1; window.liaHistoryCache=null; });
})();
