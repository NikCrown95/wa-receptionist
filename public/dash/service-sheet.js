

window.liaServiceSheet=function(v,onSave,onDelete){
  var bg=document.createElement('div');bg.className='liaSheetBg';
  var sh=document.createElement('div');sh.className='liaSheet';sh.setAttribute('role','dialog');sh.setAttribute('aria-modal','true');sh.setAttribute('aria-label','Modifica servizio');
  sh.innerHTML='<div class="grab"></div><h2>Modifica servizio</h2><p class="lsub">Prezzo e durata valgono per le nuove prenotazioni.</p>'+
   '<div class="lf"><label for="lsName">Nome</label><input id="lsName" type="text" autocomplete="off"></div>'+
   '<div class="lrow"><div class="lf"><label for="lsPrice">Prezzo (€)</label><input id="lsPrice" type="text" inputmode="decimal"></div><div class="lf"><label for="lsMin">Durata (min)</label><input id="lsMin" type="text" inputmode="numeric"></div></div>'+
   '<div class="lerr" role="alert" hidden></div>'+
   '<button type="button" class="lb lsave">Salva</button><button type="button" class="lb ldel">Disattiva servizio</button><button type="button" class="lb lcancel">Annulla</button>';
  document.body.appendChild(bg);document.body.appendChild(sh);
  var $=function(q){return sh.querySelector(q)};
  $('#lsName').value=v.name||'';$('#lsPrice').value=String(v.price==null?'':v.price).replace('.',',');$('#lsMin').value=v.min==null?'':v.min;
  var err=$('.lerr');function fail(m){err.textContent=m;err.hidden=false}
  function close(){bg.classList.remove('on');sh.classList.remove('on');document.removeEventListener('keydown',esc);setTimeout(function(){bg.remove();sh.remove()},300)}
  function esc(e){if(e.key==='Escape')close()}
  document.addEventListener('keydown',esc);bg.addEventListener('click',close);$('.lcancel').addEventListener('click',close);
  requestAnimationFrame(function(){bg.classList.add('on');sh.classList.add('on')});
  $('.lsave').addEventListener('click',function(){
    var n=$('#lsName').value.trim(),p=parseFloat(String($('#lsPrice').value).replace(',','.')),d=parseInt($('#lsMin').value,10);
    if(!n)return fail('Scrivi il nome del servizio.');
    if(!(p>=0))return fail('Il prezzo deve essere un numero, per esempio 18 o 12,50.');
    if(!(d>=5))return fail('La durata deve essere di almeno 5 minuti.');
    var b=$('.lsave');b.disabled=true;b.textContent='Salvo…';err.hidden=true;
    Promise.resolve(onSave({name:n,price:p,min:d})).then(close).catch(function(e){b.disabled=false;b.textContent='Salva';fail((e&&e.message)||'Non sono riuscito a salvare. Riprova.')});
  });
  $('.ldel').addEventListener('click',function(){
    var box=document.createElement('div');box.className='lconf';
    box.innerHTML='<p>Disattivare “'+String(v.name||'').replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})+'”? Non sarà più prenotabile, ma gli appuntamenti già presi restano nello storico.</p><div class="two"><button type="button" class="lb lcancel keep">Tienilo</button><button type="button" class="lb ldel yes">Disattiva</button></div>';
    this.replaceWith(box);
    box.querySelector('.keep').addEventListener('click',close);
    box.querySelector('.yes').addEventListener('click',function(){var y=this;y.disabled=true;Promise.resolve(onDelete()).then(close).catch(function(e){y.disabled=false;fail((e&&e.message)||'Non sono riuscito a disattivare. Riprova.')})});
  });
};

window.liaHoursSheet=function(name,intervals,onSave,onAll){
  var t5=function(x){return String(x||'').slice(0,5)};
  var first=intervals[0]||{open:'09:00',close:'19:00'},last=intervals[intervals.length-1]||first;
  var brk=intervals.length>1,ps=brk?t5(intervals[0].close):'13:00',pe=brk?t5(intervals[1].open):'15:00';
  var bg=document.createElement('div');bg.className='liaSheetBg';
  var sh=document.createElement('div');sh.className='liaSheet';sh.setAttribute('role','dialog');sh.setAttribute('aria-modal','true');
  sh.innerHTML='<div class="grab"></div><h2></h2><p class="lsub">Orari di apertura di questo giorno.</p>'+
   '<div class="lrow"><div class="lf"><label for="hsOpen">Apertura</label><input id="hsOpen" class="tin" type="text" inputmode="numeric" maxlength="5" autocomplete="off" placeholder="09:00"></div><div class="lf"><label for="hsClose">Chiusura</label><input id="hsClose" class="tin" type="text" inputmode="numeric" maxlength="5" autocomplete="off" placeholder="19:00"></div></div>'+
   '<div class="lswrow"><div><b>Pausa</b><span>Chiuso a metà giornata</span></div><button type="button" class="sw2" id="hsBrk" role="switch" aria-label="Pausa"></button></div>'+
   '<div class="lrow" id="hsPause"><div class="lf"><label for="hsPs">Pausa dalle</label><input id="hsPs" class="tin" type="text" inputmode="numeric" maxlength="5" autocomplete="off" placeholder="13:00"></div><div class="lf"><label for="hsPe">Fino alle</label><input id="hsPe" class="tin" type="text" inputmode="numeric" maxlength="5" autocomplete="off" placeholder="15:00"></div></div>'+
   '<div class="lerr" role="alert" hidden></div>'+
   '<button type="button" class="lb lsave">Applica</button><button type="button" class="lb lalt lall">Copia su tutti i giorni aperti</button><button type="button" class="lb lcancel">Annulla</button>'+
   '<p class="lnote">Le modifiche vengono salvate quando premi “Salva orari”.</p>';
  sh.querySelector('h2').textContent=name;
  document.body.appendChild(bg);document.body.appendChild(sh);
  var $=function(q){return sh.querySelector(q)};
  var pad2=function(n){return String(n).padStart(2,'0')};
  function N(v){var dg=String(v||'').replace(/\D/g,'');if(!dg)return '';var hh,mm;if(dg.length<=2){hh=+dg;mm=0}else if(dg.length===3){hh=+dg.charAt(0);mm=+dg.slice(1)}else{hh=+dg.slice(0,2);mm=+dg.slice(2,4)}if(hh>23||mm>59)return '';return pad2(hh)+':'+pad2(mm)}
  [].forEach.call(sh.querySelectorAll('.tin'),function(inp){
    var w=document.createElement('div');w.className='tstep';inp.parentNode.insertBefore(w,inp);
    var mb=document.createElement('button');mb.type='button';mb.textContent='\u2212';mb.setAttribute('aria-label','15 minuti in meno');
    var pb=document.createElement('button');pb.type='button';pb.textContent='+';pb.setAttribute('aria-label','15 minuti in più');
    w.appendChild(mb);w.appendChild(inp);w.appendChild(pb);
    function step(dl){var v=N(inp.value)||'09:00';var t=(+v.slice(0,2))*60+(+v.slice(3))+dl;t=((t%1440)+1440)%1440;inp.value=pad2(Math.floor(t/60))+':'+pad2(t%60)}
    mb.onclick=function(){step(-15)};pb.onclick=function(){step(15)};
    inp.addEventListener('blur',function(){var n=N(inp.value);if(n)inp.value=n});
  });
  $('#hsOpen').value=t5(first.open);$('#hsClose').value=t5(last.close);$('#hsPs').value=ps;$('#hsPe').value=pe;
  function paint(){$('#hsBrk').setAttribute('aria-checked',brk?'true':'false');$('#hsPause').style.display=brk?'':'none'}
  paint();$('#hsBrk').addEventListener('click',function(){brk=!brk;paint()});
  var err=$('.lerr');function fail(m){err.textContent=m;err.hidden=false}
  function close(){bg.classList.remove('on');sh.classList.remove('on');document.removeEventListener('keydown',esc);setTimeout(function(){bg.remove();sh.remove()},300)}
  function esc(e){if(e.key==='Escape')close()}
  document.addEventListener('keydown',esc);bg.addEventListener('click',close);$('.lcancel').addEventListener('click',close);
  requestAnimationFrame(function(){bg.classList.add('on');sh.classList.add('on')});
  function build(){
    var o=N($('#hsOpen').value),c=N($('#hsClose').value);
    if(!o||!c)return {err:'Inserisci apertura e chiusura.'};
    if(o>=c)return {err:'La chiusura deve essere dopo l’apertura.'};
    if(!brk)return {v:[{open:o,close:c}]};
    var a=N($('#hsPs').value),b=N($('#hsPe').value);
    if(!a||!b)return {err:'Inserisci inizio e fine della pausa.'};
    if(!(o<a&&a<b&&b<c))return {err:'La pausa deve stare tra apertura e chiusura, con la fine dopo l’inizio.'};
    return {v:[{open:o,close:a},{open:b,close:c}]};
  }
  $('.lsave').addEventListener('click',function(){var r=build();if(r.err)return fail(r.err);onSave(r.v);close()});
  $('.lall').addEventListener('click',function(){var r=build();if(r.err)return fail(r.err);onAll(r.v);close()});
};
(function(){
  var other=document.getElementById('panelOther');if(!other)return;
  [].forEach.call(other.querySelectorAll('.set-section'),function(sec){
    var h=sec.querySelector(':scope > h3'),sub=sec.querySelector(':scope > .set-sub');if(!h)return;
    var head=document.createElement('div');head.className='setHead';head.appendChild(h);if(sub)head.appendChild(sub);
    sec.parentNode.insertBefore(head,sec);
  });
})();

