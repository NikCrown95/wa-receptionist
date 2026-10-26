(function(){
  var host=document.getElementById('regBody');
  if(!host)return;
  var token=(new URLSearchParams(location.search).get('t')||'').trim();
  var loadedOnce=false,busy=false,isGym=false;

  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}

  var TG="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z",WA="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z";
  function fill(p){return '<svg viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="'+p+'"></path></svg>';}
  function line(p){return '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+p+'</svg>';}
  var CH={
    selfservice:['Pagina di prenotazione','pg',line('<path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM16 3v4M8 3v4M4 11h16"></path>')],
    telegram:['Telegram','tg',fill(TG)],
    whatsapp:['WhatsApp','wa',fill(WA)],
    webchat:['Chat sul sito','wc',line('<path d="M4 5h16v11H9l-5 4z"></path>')],
    manuale:['Inserita da te','mn',line('<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"></path>')],
    corso:['Corso','pg',line('<path d="M3 10v4M6 8v8M18 8v8M21 10v4M6 12h12"></path>')],
    personal:['Personal 1:1','wc',line('<circle cx="12" cy="8" r="3.5"></circle><path d="M5 20a7 7 0 0 1 14 0"></path>')]
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
      host.innerHTML='<div class="regMsg"><b>Ancora nessuna prenotazione</b>'+(d.gym?'Appena un iscritto prenota un corso o un Personal, la trovi qui.':'Appena un cliente prenota, la trovi qui.')+'</div>';
      return;
    }
    var now=new Date(),todayK=dayKey(now,tz),yK=dayKey(new Date(now.getTime()-864e5),tz),thisYear=parts(now,tz,{year:'numeric'});
    var groups=[],cur=null;
    items.forEach(function(it){
      var cr=new Date(it.created_at);
      if(isNaN(cr.getTime()))return;
      var k=dayKey(cr,tz);
      if(!cur||cur.k!==k){
        var lab=k===todayK?'Oggi':k===yK?'Ieri':cap(parts(cr,tz,{weekday:'long',day:'numeric',month:'long'}))+(parts(cr,tz,{year:'numeric'})!==thisYear?' '+parts(cr,tz,{year:'numeric'}):'');
        cur={k:k,lab:lab,rows:[]};groups.push(cur);
      }
      cur.rows.push({it:it,cr:cr});
    });
    var html='';
    groups.forEach(function(g){
      html+='<div class="regDay">'+esc(g.lab)+'<span class="regN">'+g.rows.length+(g.rows.length===1?' prenotazione':' prenotazioni')+'</span></div>';
      g.rows.forEach(function(x){
        var it=x.it,st=new Date(it.starts_at),ok=!isNaN(st.getTime());
        var off=it.status==='cancelled'||it.status==='no_show';
        var ch=CH[it.channel]||null;
        var tag=it.status==='cancelled'?'<span class="regTag c">Annullata</span>':it.status==='no_show'?'<span class="regTag n">Non presentata</span>':'';
        var foot=tag+(ch?'<span class="regCh '+ch[1]+'"><i>'+ch[2]+'</i>'+esc(ch[0])+'</span>':'')+((off&&!d.gym)?'':'<span class="regBk">'+(d.gym?'prenotata ':'')+'alle '+esc(parts(x.cr,tz,{hour:'2-digit',minute:'2-digit'}))+'</span>');
        html+='<button type="button" class="regRow'+(off?' x':'')+'" data-id="'+esc(it.id)+'" data-start="'+esc(it.starts_at||'')+'">'+
          '<div class="regTile"><small>'+esc(ok?parts(st,tz,{weekday:'short'}).replace('.',''):'')+'</small><b>'+esc(ok?parts(st,tz,{day:'numeric'}):'')+'</b></div>'+
          '<div class="regBd"><div class="regL1"><span class="regNm">'+esc(it.customer_name||'Cliente')+'</span><span class="regHr">'+esc(ok?parts(st,tz,{hour:'2-digit',minute:'2-digit'}):'')+'</span></div>'+
          (it.service?'<div class="regSv">'+esc(it.service)+'</div>':'')+
          '<div class="regFt">'+foot+'</div></div>'+
          '<svg class="regChev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"></path></svg>'+
          '</button>';
      });
    });
    if(d.limit&&items.length>=d.limit)html+='<div class="regFoot">Qui trovi le ultime '+d.limit+' prenotazioni.</div>';
    host.innerHTML=html;
  }

  host.addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('.regRow');
    if(!b)return;
    var id=b.getAttribute('data-id'),start=b.getAttribute('data-start');
    var cal=document.getElementById('menuTabCal');if(cal)cal.click();
    if(isGym){
      var nm=(b.querySelector('.regNm')||{}).textContent||'',sv=(b.querySelector('.regSv')||{}).textContent||'';
      setTimeout(function(){if(window.liaOpenDate&&start){window.liaFocusEv={name:nm,svc:sv,start:start,exp:Date.now()+9000,first:0,bad:b.classList.contains('x')};window.liaOpenDate(start);}},80);
      return;
    }
    if(window.__liaCampi){setTimeout(function(){if(window.__cpOpen&&start)window.__cpOpen(id,start);},80);return;}
    setTimeout(function(){if(window.liaOpenAppt&&start)window.liaOpenAppt(id,start);},80);
  });

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
      .then(function(d){loadedOnce=true;isGym=!!d.gym;render(d);})
      .catch(fail)
      .then(function(){busy=false;});
  }

  document.addEventListener('lia:section',function(e){if(e&&e.detail==='registry')load();});
})();
