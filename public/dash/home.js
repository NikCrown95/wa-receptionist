/* Home con le scorciatoie (solo smartphone).
   Non duplica nessuna funzione: ogni riquadro "preme" il pulsante che esiste gia' nella dashboard. */
(function(){
  var panel=document.getElementById('panelHome'),wrap=document.getElementById('hmWrap');
  if(!panel||!wrap)return;
  function $(id){return document.getElementById(id);}
  function click(el){if(el)el.click();}
  var S='viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
  var IC={
    cal:'<svg '+S+'><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 10h18M8 2v4M16 2v4"/></svg>',
    add:'<svg '+S+'><path d="M12 5v14M5 12h14"/></svg>',
    cli:'<svg '+S+'><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.2a6.5 6.5 0 0 1 3.5 5.8"/></svg>',
    av:'<svg '+S+'><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    qr:'<svg '+S+'><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h3M20 17v4"/></svg>',
    st:'<svg '+S+'><path d="M5 20V10M12 20V4M19 20v-7"/></svg>'
  };
  function goCal(){
    click($('menuTabCal'));
    document.dispatchEvent(new CustomEvent('lia:calendar-home'));
  }
  /* ogni riquadro: id, titolo, sottotitolo, icona, come si apre, e quando esiste davvero nella dashboard */
  var TILES=[
    {k:'cal',t:'Calendario',s:'Agenda',i:IC.cal,go:goCal,ok:function(){return !!$('menuTabCal');}},
    {k:'add',t:'Aggiungi',s:'Appuntamento',i:IC.add,go:function(){goCal();setTimeout(function(){click($('fabNew'));},160);},ok:function(){return !!$('fabNew');}},
    {k:'cli',t:'Clienti',s:'Rubrica',i:IC.cli,go:function(){click($('menuTabClients'));},ok:function(){return !!$('menuTabClients');}},
    {k:'av',t:'Disponibilità',s:'Orari e ferie',i:IC.av,go:function(){click($('menuTabAvail'));},ok:function(){var m=$('menuTabAvail');return !!m&&m.style.display!=='none'&&typeof window.liaAvailOpen==='function';}},
    {k:'qr',t:'QR code',s:'La tua pagina',i:IC.qr,go:function(){click(document.querySelector('#mnShareCard [data-a="qr"]'));},ok:function(){var c=$('mnShareCard');return !!c&&!c.classList.contains('mnNoLink')&&!!c.querySelector('[data-a="qr"]');}},
    {k:'st',t:'Statistiche',s:'Andamento',i:IC.st,go:function(){click($('menuTabStats'));},ok:function(){return !!$('menuTabStats');}}
  ];
  var day=document.createElement('button');
  day.type='button';day.className='hmDay';day.hidden=true;
  day.setAttribute('aria-label','Apri il calendario di oggi');
  day.addEventListener('click',goCal);
  wrap.appendChild(day);
  var grid=document.createElement('div');grid.className='hmGrid';wrap.appendChild(grid);
  var els={};
  TILES.forEach(function(d){
    var b=document.createElement('button');
    b.type='button';b.className='hmTile';b.setAttribute('data-k',d.k);
    b.innerHTML='<span class="hmIc">'+d.i+'</span><span class="hmTxt"><span class="hmT1"></span><span class="hmT2"></span></span>';
    b.querySelector('.hmT1').textContent=d.t;
    b.querySelector('.hmT2').textContent=d.s;
    b.addEventListener('click',function(){d.go();});
    grid.appendChild(b);els[d.k]=b;
  });
  /* i riquadri compaiono solo se la funzione esiste per questa attivita'; se ne resta uno solo in fondo occupa tutta la riga */
  function sync(){
    var vis=[];
    TILES.forEach(function(d){
      var on=false;try{on=d.ok();}catch(e){}
      if(els[d.k].hidden===on)els[d.k].hidden=!on;
      if(on)vis.push(els[d.k]);
    });
    TILES.forEach(function(d){var lone=vis.length%2===1&&vis[vis.length-1]===els[d.k];if(els[d.k].classList.contains('hmLone')!==lone)els[d.k].classList.toggle('hmLone',lone);});
    /* nelle attivita' con gli iscritti la voce del menu ha un altro nome (es. "Iscritti"): uso quello */
    var m=$('menuTabClients');
    if(m){var tx=(m.textContent||'').replace(/\s+/g,' ').trim(),t1=els.cli.querySelector('.hmT1');if(tx&&t1.textContent!==tx)t1.textContent=tx;}
  }
  /* la card "Oggi" usa gli appuntamenti veri; per palestre, campi e personal trainer (che non hanno appuntamenti di questo tipo) non si mostra */
  function sameDay(a,b){return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();}
  function hm(d){return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);}
  function pill(st,en,now){
    if(now>=st&&now<en)return 'fino alle '+hm(en);
    var mins=Math.max(1,Math.round((st-now)/60000));
    if(mins<60)return 'tra '+mins+' min';
    var h=Math.floor(mins/60),m=mins%60;
    return m?'tra '+h+' h '+m+' min':(h===1?'tra 1 ora':'tra '+h+' ore');
  }
  var seq=0;
  function el(cls,txt){var e=document.createElement('span');e.className=cls;if(txt!=null)e.textContent=txt;return e;}
  function loadDay(){
    if(window.__LIA_PT||window.__liaCampi||window.liaGymOpen||typeof window.liaGetHistory!=='function'){day.hidden=true;return;}
    var my=++seq;
    window.liaGetHistory().then(function(data){
      if(my!==seq)return;
      var now=new Date(),list=((data&&data.appointments)||[]).filter(function(a){
        return a&&a.status==='confirmed'&&a.starts_at&&sameDay(new Date(a.starts_at),now);
      }).sort(function(a,b){return new Date(a.starts_at)-new Date(b.starts_at);});
      var next=null,done=0;
      list.forEach(function(a){
        var en=new Date(a.ends_at||a.starts_at);
        if(en<=now)done++;
        else if(!next)next=a;
      });
      day.textContent='';
      if(!list.length){
        day.appendChild(el('hmDayLbl','Oggi'));
        day.appendChild(el('hmDayNone','Oggi non hai appuntamenti'));
      }else if(next){
        var st=new Date(next.starts_at),en=new Date(next.ends_at||next.starts_at);
        var top=el('hmDayTop');top.appendChild(el('hmDayLbl',(now>=st&&now<en)?'Appuntamento in corso':'Prossimo appuntamento'));top.appendChild(el('hmDayPill',pill(st,en,now)));
        day.appendChild(top);
        day.appendChild(el('hmDayTime',hm(st)));
        day.appendChild(el('hmDayName',next.customer_name||''));
        if(next.service)day.appendChild(el('hmDaySvc',next.service));
      }else{
        day.appendChild(el('hmDayLbl','Oggi'));
        day.appendChild(el('hmDayNone','Per oggi hai finito'));
      }
      if(list.length){
        var bar=el('hmDayBar'),fill=el('hmDayFill');
        fill.style.width=Math.round(done/list.length*100)+'%';
        bar.appendChild(fill);day.appendChild(bar);
        day.appendChild(el('hmDayProg',done+' di '+list.length+(list.length===1?' appuntamento fatto':' appuntamenti fatti')));
      }
      day.hidden=false;
    }).catch(function(){if(my===seq)day.hidden=true;});
  }
  function refresh(){sync();}
  document.addEventListener('lia:section',function(e){
    /* nella Home l'intestazione e' piu' bassa e senza la scritta "Home" (vedi home.css) */
    document.body.classList.toggle('lia-sec-home',!!(e&&e.detail==='home'));
    if(e&&e.detail==='home'){refresh();loadDay();}
  });
  /* il menu (con Disponibilita' e il QR) viene costruito subito dopo il caricamento: riallineo i riquadri */
  [0,500,1500,3500].forEach(function(ms){setTimeout(refresh,ms);});
  var menu=$('burgerMenu');
  if(menu&&window.MutationObserver)new MutationObserver(function(){refresh();}).observe(menu,{childList:true});
  /* la funzione che legge gli appuntamenti viene definita poco dopo l'apertura: riprovo a pagina caricata */
  function again(){if(panel.classList.contains('on'))loadDay();}
  if(document.readyState==='complete')setTimeout(again,0);else window.addEventListener('load',function(){setTimeout(again,0);});
  /* la voce "Home" del menu va nel gruppo Agenda, subito prima di Calendario */
  var home=$('menuTabHome');
  function place(){
    var cal=$('menuTabCal');
    if(!home||!cal||!cal.parentNode)return;
    if(home.nextElementSibling!==cal)cal.parentNode.insertBefore(home,cal);
  }
  [0,500,1500,3500].forEach(function(ms){setTimeout(place,ms);});
  if(menu&&window.MutationObserver)new MutationObserver(place).observe(menu,{childList:true});
})();
