
// --- Notifiche push sul telefono (Impostazioni > Notifiche) ---
(function(){
  var $=function(id){return document.getElementById(id);};
  var busy=false;
  function tok(){return (new URLSearchParams(location.search).get('t')||'').trim();}
  function api(method,body){
    return fetch('/api/agenda?t='+encodeURIComponent(tok())+'&push=1',{method:method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,cache:'no-store'})
      .then(function(r){return r.json().catch(function(){return {};}).then(function(d){if(!r.ok)throw new Error((d&&d.error)||'Errore');return d;});});
  }
  function isIOS(){return /iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);}
  function standalone(){return window.navigator.standalone===true||(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches);}
  function supported(){return 'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;}
  function keyBytes(s){
    var p='='.repeat((4-s.length%4)%4),b=(s+p).replace(/-/g,'+').replace(/_/g,'/'),r=atob(b),o=new Uint8Array(r.length);
    for(var i=0;i<r.length;i++)o[i]=r.charCodeAt(i);return o;
  }
  function msg(t,err){var m=$('pnMsg');if(!m)return;m.textContent=t||'';m.className='pnMsg'+(err?' err':'');}
  function currentSub(){
    if(!supported())return Promise.resolve(null);
    return navigator.serviceWorker.getRegistration().then(function(reg){return reg&&reg.pushManager?reg.pushManager.getSubscription():null;}).catch(function(){return null;});
  }
  var TXT={
    install:{s:'Aggiungi Prenolia alla schermata Home per poterle attivare.',p:'Da installare',c:'warn'},
    unsupported:{s:'Questo browser non supporta le notifiche. Prova con Chrome o con Safari aggiornato.',p:'Non disponibili',c:''},
    denied:{s:'Hai bloccato le notifiche per Prenolia. Riattivale dalle impostazioni del telefono, alla voce Notifiche di Prenolia.',p:'Bloccate',c:'warn'},
    noserver:{s:'Le notifiche non sono ancora disponibili. Riprova più tardi.',p:'Non disponibili',c:''},
    ready:{s:'Non sono ancora attive su questo dispositivo.',p:'Non attive',c:''},
    on:{s:'Questo dispositivo riceve gli avvisi di Prenolia.',p:'Attive',c:'ok'}
  };
  var SUM={install:'Da installare',unsupported:'Non disponibili',denied:'Bloccate',noserver:'Non disponibili',ready:'Non attive',on:'Attive'};
  function render(state){
    var x=TXT[state]||TXT.ready;
    if($('pnSub'))$('pnSub').textContent=x.s;
    if($('pnPill')){$('pnPill').className='pnPill'+(x.c?' '+x.c:'');}
    if($('pnPillT'))$('pnPillT').textContent=x.p;
    if($('pnInstall'))$('pnInstall').hidden=state!=='install';
    if($('pnReady'))$('pnReady').hidden=state!=='ready';
    if($('pnOn'))$('pnOn').hidden=state!=='on';
    if($('stSumNotif'))$('stSumNotif').textContent=SUM[state]||'Avvisi sul telefono';
  }
  function compute(){
    if(isIOS()&&!standalone())return Promise.resolve('install');
    if(!supported())return Promise.resolve('unsupported');
    if(Notification.permission==='denied')return Promise.resolve('denied');
    return Promise.all([currentSub(),api('GET').catch(function(){return null;})]).then(function(r){
      var info=r[1];
      if(!info||info.configured===false||info.table===false)return 'noserver';
      return (r[0]&&Notification.permission==='granted')?'on':'ready';
    });
  }
  function refresh(){return compute().then(render).catch(function(){render('noserver');});}

  function subscribeNow(reg,key){
    function go(){return reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(key)});}
    return go().catch(function(){
      return reg.pushManager.getSubscription().then(function(old){if(!old)throw new Error('subscribe');return old.unsubscribe().then(go);});
    });
  }
  function enable(){
    if(busy)return;busy=true;msg('');
    var b=$('pnEnable');if(b)b.disabled=true;
    Promise.resolve(Notification.requestPermission()).then(function(p){
      if(p!=='granted')throw new Error('denied');
      return navigator.serviceWorker.register('/sw.js');
    }).then(function(){return navigator.serviceWorker.ready;}).then(function(reg){
      return api('GET').then(function(info){
        if(!info||!info.configured||!info.key)throw new Error('noserver');
        return subscribeNow(reg,info.key);
      });
    }).then(function(sub){
      return api('POST',{subscription:sub.toJSON(),ua:String(navigator.userAgent||'').slice(0,200)});
    }).then(function(){msg('Notifiche attivate su questo dispositivo.');}).catch(function(e){
      if(e&&e.message==='denied')msg('Permesso non concesso. Puoi riprovare quando vuoi.',true);
      else if(e&&e.message==='noserver')msg('Le notifiche non sono ancora disponibili. Riprova più tardi.',true);
      else msg('Non sono riuscito ad attivarle. Riprova.',true);
    }).then(function(){busy=false;if(b)b.disabled=false;return refresh();});
  }
  function test(){
    if(busy)return;busy=true;msg('');
    var b=$('pnTest');if(b)b.disabled=true;
    api('POST',{test:true}).then(function(d){
      if(d&&d.sent>0)msg('Notifica di prova inviata. Arriva tra pochi secondi.');
      else msg('Nessun dispositivo registrato. Prova a disattivare e riattivare le notifiche.',true);
    }).catch(function(){msg('Non sono riuscito a inviare la prova. Riprova.',true);})
    .then(function(){busy=false;if(b)b.disabled=false;});
  }
  function disable(){
    if(busy)return;busy=true;msg('');
    currentSub().then(function(sub){
      if(!sub)return null;
      var ep=sub.endpoint;
      return sub.unsubscribe().then(function(){return api('POST',{unsubscribe:true,endpoint:ep}).catch(function(){});});
    }).then(function(){msg('Notifiche disattivate su questo dispositivo.');}).catch(function(){msg('Non sono riuscito a disattivarle. Riprova.',true);})
    .then(function(){busy=false;return refresh();});
  }
  // Tiene allineato il server se il dispositivo e' gia' registrato (es. dopo un reinstallo del database)
  function sync(){
    if(!supported()||!tok()||Notification.permission!=='granted')return;
    navigator.serviceWorker.register('/sw.js').then(function(){return currentSub();}).then(function(sub){
      if(sub)return api('POST',{subscription:sub.toJSON(),ua:String(navigator.userAgent||'').slice(0,200)});
    }).catch(function(){});
  }

  if($('pnEnable'))$('pnEnable').addEventListener('click',enable);
  if($('pnTest'))$('pnTest').addEventListener('click',test);
  if($('pnOff'))$('pnOff').addEventListener('click',disable);
  document.addEventListener('click',function(ev){
    var r=ev.target.closest&&ev.target.closest('.stRow[data-st="notifications"]');
    if(r){msg('');refresh();}
  });
  setTimeout(function(){refresh();sync();},1500);
})();

// --- App installabile (Android/Chrome): il service worker va registrato subito all'apertura, non solo per le notifiche ---
(function(){
  try{
    if(!('serviceWorker' in navigator))return;
    window.addEventListener('load',function(){
      navigator.serviceWorker.register('/sw.js').catch(function(){});
    });
  }catch(e){}
})();
