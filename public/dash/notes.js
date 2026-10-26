
// --- Note cliente (nota fissa) e note per visita: condivise tra scheda Clienti e foglio appuntamento ---
(function(){
  var MED=!!(window.__LIA_MED||window.__liaCampi); /* studi sanitari: nessuna nota libera, per non raccogliere dati sulla salute */
  var S={fixed:{},visits:{},okFixed:true,okVisits:true,loaded:false,p:null,focus:null};
  var drafts={},mounted=[];
  function tok(){return (new URLSearchParams(location.search).get('t')||'').trim();}
  function url(){return '/api/agenda?t='+encodeURIComponent(tok())+'&notes=1';}
  function mk(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e;}
  function refresh(){
    mounted=mounted.filter(function(m){return document.body.contains(m.box);});
    mounted.forEach(function(m){m.fn();});
  }
  function reg(box,fn){
    mounted=mounted.filter(function(m){return m.box!==box;});
    mounted.push({box:box,fn:fn});
  }
  function ensure(){
    if(MED){S.loaded=true;return Promise.resolve(S);}
    if(S.p)return S.p;
    if(!tok()){S.loaded=true;return Promise.resolve(S);}
    S.p=fetch(url(),{cache:'no-store'}).then(function(r){if(!r.ok)throw new Error('x');return r.json();}).then(function(d){
      S.fixed=d.notes||{};S.visits=d.visits||{};
      S.okFixed=d.available!==false;S.okVisits=d.visits_available!==false;
      S.loaded=true;refresh();return S;
    }).catch(function(){
      S.p=null;S.okFixed=false;S.okVisits=false;S.loaded=true;refresh();return S;
    });
    return S.p;
  }
  function post(body){
    return fetch(url(),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(function(r){if(!r.ok)throw new Error('x');return r.json();});
  }
  function time(v){var t=new Date(v).getTime();return isFinite(t)?t:0;}
  function editor(box,key,cur,placeholder,onSave){
    var ta=mk('textarea','nt-ta');
    ta.maxLength=2000;ta.placeholder=placeholder;ta.setAttribute('aria-label',placeholder);
    ta.value=drafts[key]!=null?drafts[key]:cur;
    ta.addEventListener('input',function(){drafts[key]=ta.value;});
    var bt=mk('div','nt-bt'),sv=mk('button','nt-b go','Salva'),cn=mk('button','nt-b','Annulla'),st=mk('span','nt-st');
    sv.type='button';cn.type='button';
    cn.addEventListener('click',function(){delete drafts[key];refresh();});
    sv.addEventListener('click',function(){
      sv.disabled=true;cn.disabled=true;st.className='nt-st';st.textContent='Salvataggio…';
      onSave(ta.value.trim()).then(function(){delete drafts[key];refresh();}).catch(function(){
        sv.disabled=false;cn.disabled=false;st.className='nt-st err';st.textContent='Non sono riuscito a salvare. Riprova.';
      });
    });
    bt.appendChild(sv);bt.appendChild(cn);bt.appendChild(st);
    box.appendChild(ta);box.appendChild(bt);
    if(S.focus===key){S.focus=null;setTimeout(function(){try{ta.focus();}catch(e){}},0);}
  }
  function startEdit(key,cur){drafts[key]=cur;S.focus=key;refresh();}

  // Nota fissa del cliente ("Da sapere prima di iniziare")
  function mountFixed(box,phone,opts){
    if(MED){box.innerHTML='';return;}
    opts=opts||{};
    function draw(){
      box.innerHTML='';
      if(!S.loaded)return;
      var key='f:'+phone,cur=S.fixed[phone]||'',editing=drafts[key]!=null;
      if(!S.okFixed){
        if(opts.always){var c0=mk('div','nt-fx'),h0=mk('div','nt-hd');h0.appendChild(mk('div','nt-lb','Da sapere prima di iniziare'));c0.appendChild(h0);c0.appendChild(mk('p','nt-em','Le note non sono ancora disponibili.'));box.appendChild(c0);}
        return;
      }
      if(!cur&&!editing&&!opts.always){
        var ad=mk('button','nt-add','+ Nota sul cliente');ad.type='button';
        ad.addEventListener('click',function(){startEdit(key,'');});
        box.appendChild(ad);return;
      }
      var card=mk('div','nt-fx'),hd=mk('div','nt-hd');
      hd.appendChild(mk('div','nt-lb','Da sapere prima di iniziare'));
      if(!editing){
        var eb=mk('button','nt-lk',cur?'Modifica':'Aggiungi');eb.type='button';
        eb.addEventListener('click',function(){startEdit(key,cur);});
        hd.appendChild(eb);
      }
      card.appendChild(hd);
      if(editing){
        editor(card,key,cur,'Allergie, preferenze, cose da ricordare…',function(v){
          return post({phone:phone,note:v}).then(function(){if(v)S.fixed[phone]=v;else delete S.fixed[phone];});
        });
      }else{
        card.appendChild(cur?mk('p','nt-tx',cur):mk('p','nt-em','Nessuna nota. Aggiungi allergie, preferenze o altro da ricordare.'));
      }
      box.appendChild(card);
    }
    reg(box,draw);draw();ensure();
  }

  // Nota di una singola visita (un appuntamento)
  function mountVisit(box,id,opts){
    if(MED){box.innerHTML='';return;}
    opts=opts||{};
    function draw(){
      box.innerHTML='';
      if(!S.loaded||!S.okVisits)return;
      var key='v:'+id,e=S.visits[id],cur=(e&&e.n)||'',editing=drafts[key]!=null;
      var wrap=opts.label?mk('div','nt-vc'):box;
      if(opts.label){wrap.appendChild(mk('div','nt-lb mut',opts.label));}
      if(editing){
        editor(wrap,key,cur,'Es. formula colore, prodotto usato, cosa ripetere…',function(v){
          return post({appointment_id:id,note:v}).then(function(){
            var o=S.visits[id];
            if(v)S.visits[id]={n:v,p:(o&&o.p)||opts.phone||'',s:(o&&o.s)||opts.start||''};
            else delete S.visits[id];
          });
        });
      }else if(cur){
        wrap.appendChild(mk('div','nt-vn',cur));
        var ed=mk('button','nt-add','Modifica nota');ed.type='button';
        ed.addEventListener('click',function(){startEdit(key,cur);});
        wrap.appendChild(ed);
      }else{
        var ad=mk('button','nt-add','+ Aggiungi nota');ad.type='button';
        ad.addEventListener('click',function(){startEdit(key,'');});
        wrap.appendChild(ad);
      }
      if(opts.label)box.appendChild(wrap);
    }
    reg(box,draw);draw();ensure();
  }

  // Nota dell'ultima visita precedente (solo lettura), per il foglio appuntamento
  function mountLast(box,phone,beforeMs,excludeId){
    if(MED){box.innerHTML='';return;}
    function draw(){
      box.innerHTML='';
      if(!S.loaded||!S.okVisits||!phone)return;
      var best=null;
      Object.keys(S.visits).forEach(function(id){
        var v=S.visits[id];
        if(id===excludeId||!v||!v.n||v.p!==phone)return;
        var t=time(v.s);
        if(!t||t>=beforeMs)return;
        if(!best||t>best.t)best={t:t,n:v.n};
      });
      if(!best)return;
      var card=mk('div','nt-last');
      card.appendChild(mk('div','nt-lb mut','Ultima visita · '+new Date(best.t).toLocaleDateString('it-IT',{day:'numeric',month:'short',year:'numeric'})));
      card.appendChild(mk('p','nt-tx',best.n));
      box.appendChild(card);
    }
    reg(box,draw);draw();ensure();
  }
  window.liaNotes={ensure:ensure,mountFixed:mountFixed,mountVisit:mountVisit,mountLast:mountLast,state:S};
})();
