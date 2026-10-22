(function(){
  var host=document.getElementById('promoBody');
  if(!host)return;
  var token=(new URLSearchParams(location.search).get('t')||'').trim();
  var D=null,busy=false,loading=false;
  var F={service:'',preset:7,from:'',to:'',price:'',err:''};
  var PRESETS=[[3,'3 giorni'],[7,'1 settimana'],[14,'2 settimane'],[30,'1 mese'],[0,'Scegli le date']];
  var MESI=['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'];

  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function eur(n){n=Math.round(Number(n)*100)/100;return String(n).replace('.',',')+' €';}
  function addD(iso,n){var p=iso.split('-');var d=new Date(Date.UTC(+p[0],+p[1]-1,+p[2]+n));return d.toISOString().slice(0,10);}
  function lab(iso){var p=String(iso||'').split('-');return p.length===3?(+p[2])+' '+MESI[+p[1]-1]:'';}
  function num(v){return parseFloat(String(v||'').replace(',','.'));}
  function svc(){return D&&D.services.filter(function(s){return s.id===F.service})[0]||null;}
  function range(){
    if(!D)return {a:'',b:''};
    if(F.preset>0)return {a:D.today,b:addD(D.today,F.preset-1)};
    return {a:F.from,b:F.to};
  }

  function api(method,body){
    return fetch('/api/agenda?t='+encodeURIComponent(token)+(method==='GET'?'&promos=1':'&settings=1'),{method:method,cache:'no-store',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined})
      .then(function(r){return r.json().then(function(d){if(!r.ok)throw new Error(d.error||'Errore');return d;});});
  }

  function validate(){
    var s=svc(),p=num(F.price),r=range();
    if(!s)return 'Scegli un servizio';
    if(!(p>0))return 'Inserisci il nuovo prezzo';
    if(!(p<s.price))return 'Il nuovo prezzo deve essere più basso di '+eur(s.price);
    if(!r.a||!r.b)return 'Scegli le date';
    if(r.a<D.today)return 'La data di inizio è già passata';
    if(r.b<r.a)return 'La fine non può essere prima dell\'inizio';
    var clash=D.items.some(function(i){return i.service_id===s.id&&i.ends_on>=r.a&&i.starts_on<=r.b;});
    if(clash)return 'C\'è già una promozione su questo servizio in quelle date';
    return '';
  }

  function summary(){
    var e=document.getElementById('stSumPromos');if(!e||!D)return;
    var n=D.items.filter(function(i){return i.status==='active'}).length;
    e.textContent=!D.available?'Non ancora attivo':n===0?'Nessuna promozione attiva':n===1?'1 promozione attiva':n+' promozioni attive';
  }

  function render(){
    if(!D){host.innerHTML='<div class="prMsg">'+(loading?'Carico…':'')+'</div>';return;}
    summary();
    if(D.gym){host.innerHTML='<div class="prMsg"><b>Non disponibile</b>Le promozioni sui servizi non sono previste per questa attività.</div>';return;}
    if(!D.available){host.innerHTML='<div class="prMsg"><b>Non ancora attivo</b>Questa funzione si attiva a breve. Riprova più tardi.</div>';return;}
    if(!D.services.length){host.innerHTML='<div class="prMsg"><b>Nessun servizio</b>Crea prima un servizio in "Servizi e prezzi".</div>';return;}
    if(!F.service)F.service=D.services[0].id;
    var s=svc(),p=num(F.price),r=range(),html='';
    html+='<div class="stCard stAdd"><h4>Nuova promozione</h4><div class="stForm">';
    html+='<label class="stF"><span>Servizio</span><select class="set-select" id="prSvc">'+D.services.map(function(x){return '<option value="'+esc(x.id)+'"'+(x.id===F.service?' selected':'')+'>'+esc(x.name)+' — '+eur(x.price)+'</option>';}).join('')+'</select></label>';
    html+='<div class="stF"><span>Durata dell\'offerta</span><div class="prChips">'+PRESETS.map(function(c){return '<button type="button" class="ch" data-pre="'+c[0]+'" aria-pressed="'+(F.preset===c[0]?'true':'false')+'">'+c[1]+'</button>';}).join('')+'</div></div>';
    if(F.preset===0)html+='<div class="stRow2"><label class="stF"><span>Dal</span><input class="set-input" type="date" id="prFrom" min="'+esc(D.today)+'" value="'+esc(F.from)+'"></label><label class="stF"><span>Al</span><input class="set-input" type="date" id="prTo" min="'+esc(F.from||D.today)+'" value="'+esc(F.to)+'"></label></div>';
    else html+='<div class="prWhen">Da oggi, <b>'+esc(lab(r.a))+'</b> a <b>'+esc(lab(r.b))+'</b></div>';
    html+='<label class="stF"><span>Nuovo prezzo (€)</span><input class="set-input" id="prPrice" type="text" inputmode="decimal" placeholder="Es. '+esc(String(Math.max(1,Math.floor(s.price*0.8))))+'" value="'+esc(F.price)+'"></label>';
    if(p>0&&p<s.price){
      var pct=Math.round((1-p/s.price)*100);
      html+='<div class="prPrev"><small>Così lo vedranno i clienti</small><div class="prPrevRow"><div class="prPrevN"><b>'+esc(s.name)+'</b></div><div class="prPrevP"><s>'+esc(eur(s.price))+'</s><b>'+esc(eur(p))+'</b></div></div><div class="prStrip"><b>−'+pct+'% · risparmi '+esc(eur(s.price-p))+'</b>'+(r.b?'<em>fino al '+esc(lab(r.b))+'</em>':'')+'</div></div>';
    }
    html+='<div class="prErr" id="prErr" role="alert">'+esc(F.err)+'</div>';
    html+='<button type="button" class="stBtn" id="prGo"'+(busy?' disabled':'')+'>Attiva promozione</button></div></div>';
    html+='<div class="stCard stListCard prList"><h4 class="prH">Promozioni</h4>';
    if(!D.items.length)html+='<p class="set-empty">Nessuna promozione per ora.</p>';
    D.items.forEach(function(i){
      var act=i.status==='active',pct=Math.round((1-i.price/i.orig)*100);
      html+='<div class="prItem"><div class="prIn"><b>'+esc(i.service)+'</b><span class="prPill '+(act?'on':'sc')+'">'+(act?'Attiva':'Programmata')+'</span><div class="prSub"><s>'+esc(eur(i.orig))+'</s> '+esc(eur(i.price))+' · −'+pct+'%</div><div class="prSub">Dal '+esc(lab(i.starts_on))+' al '+esc(lab(i.ends_on))+'</div></div><button type="button" class="prEnd" data-id="'+esc(i.id)+'">'+(act?'Termina':'Annulla')+'</button></div>';
    });
    html+='</div>';
    host.innerHTML=html;
  }

  function keepFocus(fn){fn();}

  host.addEventListener('click',function(e){
    var c=e.target.closest&&e.target.closest('[data-pre]');
    if(c){F.preset=+c.getAttribute('data-pre');F.err='';if(F.preset===0&&!F.from){F.from=D.today;F.to=D.today;}render();return;}
    var en=e.target.closest&&e.target.closest('.prEnd');
    if(en){
      var id=en.getAttribute('data-id');en.disabled=true;
      api('POST',{action:'promo_delete',id:id}).then(load).catch(function(x){F.err=x.message;render();});
      return;
    }
    if(e.target.id==='prGo'){
      var er=validate();F.err=er;
      if(er){var el=document.getElementById('prErr');if(el)el.textContent=er;return;}
      var r=range();busy=true;render();
      api('POST',{action:'promo_create',service_id:F.service,promo_price_eur:num(F.price),starts_on:r.a,ends_on:r.b})
        .then(function(){busy=false;F.price='';F.err='';return load();})
        .catch(function(x){busy=false;F.err=x.message;render();});
    }
  });
  host.addEventListener('change',function(e){
    if(e.target.id==='prSvc'){F.service=e.target.value;F.err='';render();}
    else if(e.target.id==='prFrom'){F.from=e.target.value;if(F.to&&F.to<F.from)F.to=F.from;F.err='';render();}
    else if(e.target.id==='prTo'){F.to=e.target.value;F.err='';render();}
  });
  host.addEventListener('input',function(e){
    if(e.target.id!=='prPrice')return;
    F.price=e.target.value;F.err='';
    // aggiorno solo l'anteprima, cosi' la tastiera resta aperta
    var pos=e.target.selectionStart;render();
    var n=document.getElementById('prPrice');if(n){n.focus();try{n.setSelectionRange(pos,pos);}catch(x){}}
  });

  function load(){
    if(!token)return Promise.resolve();
    loading=true;if(!D)render();
    return api('GET').then(function(d){D=d;loading=false;render();}).catch(function(){loading=false;if(!D)host.innerHTML='<div class="prMsg"><b>Non riesco a caricare le promozioni</b>Controlla la connessione e riprova.</div>';});
  }

  document.addEventListener('click',function(e){
    var r=e.target.closest&&e.target.closest('.stRow[data-st="promos"]');
    if(r)load();
  });
  var origOpen=null;
  document.addEventListener('lia:section',function(e){if(e&&e.detail==='other'&&!D)load();});
  setTimeout(function(){var p=document.getElementById('panelOther');if(p&&!D&&document.getElementById('stSumPromos')&&p.offsetParent!==null)load();},1500);
})();
