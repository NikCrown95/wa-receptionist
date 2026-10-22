(function(){
  var host=document.getElementById('regBody');
  if(!host)return;
  var token=(new URLSearchParams(location.search).get('t')||'').trim();
  var loadedOnce=false,busy=false;

  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}

  var CH={
    selfservice:['Pagina di prenotazione','<path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM16 3v4M8 3v4M4 11h16M12 14v4M10 16h4"></path>'],
    telegram:['Telegram','<path d="M21 4 3 11l5 2m13-9-3 15-7-6m10-9L8 13m0 0v6l3-3"></path>'],
    whatsapp:['WhatsApp','<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7zM9 10c0 3 2 5 5 5l1.2-1.2-1.7-1-.9.7a3 3 0 0 1-1.7-1.7l.7-.9-1-1.7z"></path>'],
    webchat:['Chat sul sito','<path d="M4 5h16v11H9l-5 4z"></path>'],
    manuale:['Inserita da te','<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16zM13.5 6.5l4 4"></path>']
  };
  CH.web=CH.selfservice;

  function parts(date,tz,opt){
    try{return new Intl.DateTimeFormat('it-IT',Object.assign({timeZone:tz},opt)).format(date);}catch(e){return new Intl.DateTimeFormat('it-IT',opt).format(date);}
  }
  function dayKey(date,tz){
    try{
      var p=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
      return p;
    }catch(e){return date.toISOString().slice(0,10);}
  }
  function cap(s){return s?s.charAt(0).toUpperCase()+s.slice(1):s;}
  function initials(n){
    var w=String(n||'').trim().split(/\s+/).filter(Boolean);
    if(!w.length)return '?';
    return (w[0].charAt(0)+(w.length>1?w[1].charAt(0):'')).toUpperCase();
  }

  function render(d){
    var items=Array.isArray(d.items)?d.items:[],tz=d.timezone||'Europe/Rome';
    if(!items.length){
      host.innerHTML='<div class="regMsg"><b>Ancora nessuna prenotazione</b>Appena un cliente prenota, la trovi qui.</div>';
      return;
    }
    var now=new Date(),todayK=dayKey(now,tz),yK=dayKey(new Date(now.getTime()-864e5),tz),thisYear=parts(now,tz,{year:'numeric'});
    var html='',last='';
    items.forEach(function(it){
      var cr=new Date(it.created_at);
      if(isNaN(cr.getTime()))return;
      var k=dayKey(cr,tz);
      if(k!==last){
        last=k;
        var lab=k===todayK?'Oggi':k===yK?'Ieri':cap(parts(cr,tz,{weekday:'long',day:'numeric',month:'long'}))+(parts(cr,tz,{year:'numeric'})!==thisYear?' '+parts(cr,tz,{year:'numeric'}):'');
        html+='<div class="regDay">'+esc(lab)+'</div>';
      }
      var st=new Date(it.starts_at),when='';
      if(!isNaN(st.getTime())){
        when='Per '+parts(st,tz,{weekday:'long',day:'numeric',month:'long'})+', '+parts(st,tz,{hour:'2-digit',minute:'2-digit'});
      }
      var ch=CH[it.channel]||null;
      var tag=it.status==='cancelled'?'<span class="regTag c">Annullata</span>':it.status==='no_show'?'<span class="regTag n">Non presentata</span>':'';
      html+='<div class="regRow'+(it.status==='cancelled'?' x':'')+'">'+
        '<div class="regAv">'+esc(initials(it.customer_name))+'</div>'+
        '<div class="regBd"><div class="regL1"><span class="regNm">'+esc(it.customer_name||'Cliente')+tag+'</span><span class="regTm">'+esc(parts(cr,tz,{hour:'2-digit',minute:'2-digit'}))+'</span></div>'+
        (it.service?'<div class="regSv">'+esc(it.service)+'</div>':'')+
        (when?'<div class="regWh">'+esc(when)+'</div>':'')+
        (ch?'<div class="regCh"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+ch[1]+'</svg>'+esc(ch[0])+'</div>':'')+
        '</div></div>';
    });
    if(d.limit&&items.length>=d.limit)html+='<div class="regFoot">Qui trovi le ultime '+d.limit+' prenotazioni.</div>';
    host.innerHTML=html;
  }

  function fail(){
    if(loadedOnce)return;
    host.innerHTML='<div class="regMsg"><b>Non riesco a caricare il registro</b>Controlla la connessione e riprova.<br><button type="button" id="regRetry">Riprova</button></div>';
    var b=document.getElementById('regRetry');
    if(b)b.addEventListener('click',function(){load(true);});
  }

  function load(force){
    if(busy||!token)return;
    busy=true;
    if(!loadedOnce)host.innerHTML='<div class="regMsg">Carico le prenotazioni…</div>';
    fetch('/api/agenda?t='+encodeURIComponent(token)+'&registry=1',{cache:'no-store'})
      .then(function(r){if(!r.ok)throw new Error('http');return r.json();})
      .then(function(d){loadedOnce=true;render(d);})
      .catch(fail)
      .then(function(){busy=false;});
  }

  document.addEventListener('lia:section',function(e){if(e&&e.detail==='registry')load();});
})();
