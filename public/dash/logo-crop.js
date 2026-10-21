/* Ritaglio del logo: si trascina e si ingrandisce la foto dentro la cornice, poi esce un quadrato 256x256 pronto da inviare.
   Uso: PrenoliaCrop.open(file, function(dataUri){ ...dataUri vuoto = annullato o immagine illeggibile... }) */
(function(){
  var V=280,N=256,css=false;
  function addCss(){
    if(css)return;css=true;var s=document.createElement('style');
    s.textContent='.pcrop{position:fixed;inset:0;z-index:99999;background:rgba(3,6,10,.78);display:grid;place-items:center;padding:20px;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);font-family:inherit}'+
    '.pcrop .pcb{width:100%;max-width:360px;background:var(--card,#0E131B);color:var(--ink,#F9F6F0);border:1px solid var(--line2,#2A3648);border-radius:26px;padding:22px 20px;display:flex;flex-direction:column;gap:16px;box-shadow:0 30px 80px -20px rgba(0,0,0,.8)}'+
    '.pcrop h3{margin:0;font-size:1.1rem;font-weight:800;letter-spacing:-.01em}.pcrop p{margin:0;font-size:.84rem;color:var(--muted,#9BA6B5)}'+
    '.pcrop .pcv{position:relative;width:'+V+'px;height:'+V+'px;max-width:100%;margin:0 auto;border-radius:62px;overflow:hidden;background:#fff;touch-action:none;cursor:grab;box-shadow:0 0 0 2px var(--accent,#2DD2DC)}'+
    '.pcrop .pcv:active{cursor:grabbing}.pcrop canvas{display:block;width:100%;height:100%}'+
    '.pcrop input[type=range]{width:100%;accent-color:var(--accent,#2DD2DC)}'+
    '.pcrop .pcr{display:flex;gap:10px}.pcrop .pcr button{flex:1;min-height:48px;border-radius:14px;border:1px solid var(--line2,#2A3648);background:transparent;color:var(--ink,#F9F6F0);font:inherit;font-weight:700;cursor:pointer}'+
    '.pcrop .pcr button.go{border:0;background:var(--accent-grad,linear-gradient(135deg,#2DD2DC,#2F7BFF));color:var(--on-accent,#031016)}';
    document.head.appendChild(s);
  }
  function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x)e.textContent=x;return e}
  function open(file,done){
    addCss();
    var img=new Image(),url=URL.createObjectURL(file);
    img.onerror=function(){URL.revokeObjectURL(url);done('')};
    img.onload=function(){
      var min=Math.min(V/img.width,V/img.height),k=min,ox=(V-img.width*k)/2,oy=(V-img.height*k)/2;
      var ov=el('div','pcrop'),box=el('div','pcb'),vw=el('div','pcv'),cv=document.createElement('canvas');
      var dpr=Math.min(2,window.devicePixelRatio||1);cv.width=cv.height=Math.round(V*dpr);
      var rng=el('input');rng.type='range';rng.min='1';rng.max='4';rng.step='0.01';rng.value='1';rng.setAttribute('aria-label','Ingrandisci');
      var r=el('div','pcr'),no=el('button',null,'Annulla'),ok=el('button','go','Usa questa foto');no.type=ok.type='button';
      r.appendChild(no);r.appendChild(ok);vw.appendChild(cv);
      box.appendChild(el('h3',null,'Sistema il tuo logo'));box.appendChild(el('p',null,'Trascina la foto e ingrandiscila: quello che vedi nella cornice sarà il tuo logo.'));
      box.appendChild(vw);box.appendChild(rng);box.appendChild(r);ov.appendChild(box);document.body.appendChild(ov);
      function clamp(){var w=img.width*k,h=img.height*k;ox=Math.min(Math.max(ox,Math.min(0,V-w)),Math.max(0,V-w));oy=Math.min(Math.max(oy,Math.min(0,V-h)),Math.max(0,V-h))}
      function draw(c,size){var x=c.getContext('2d'),f=size/V;x.fillStyle='#fff';x.fillRect(0,0,size,size);x.imageSmoothingQuality='high';x.drawImage(img,ox*f,oy*f,img.width*k*f,img.height*k*f)}
      function paint(){clamp();draw(cv,cv.width)}
      function zoomTo(nk,cx,cy){nk=Math.min(Math.max(nk,min),min*4);ox=cx-(cx-ox)*(nk/k);oy=cy-(cy-oy)*(nk/k);k=nk;rng.value=String(k/min);paint()}
      var pts={},last=null;
      function pos(e){var b=vw.getBoundingClientRect();return{x:(e.clientX-b.left)*V/b.width,y:(e.clientY-b.top)*V/b.height}}
      vw.addEventListener('pointerdown',function(e){vw.setPointerCapture(e.pointerId);pts[e.pointerId]=pos(e);last=null});
      vw.addEventListener('pointermove',function(e){
        if(!pts[e.pointerId])return;var p=pos(e),ids=Object.keys(pts);
        if(ids.length>=2){var o=pts[ids[0]==String(e.pointerId)?ids[1]:ids[0]],d0=Math.hypot(pts[e.pointerId].x-o.x,pts[e.pointerId].y-o.y),d1=Math.hypot(p.x-o.x,p.y-o.y);pts[e.pointerId]=p;if(d0>0)zoomTo(k*d1/d0,(p.x+o.x)/2,(p.y+o.y)/2);return}
        ox+=p.x-pts[e.pointerId].x;oy+=p.y-pts[e.pointerId].y;pts[e.pointerId]=p;paint()});
      function up(e){delete pts[e.pointerId]}
      vw.addEventListener('pointerup',up);vw.addEventListener('pointercancel',up);
      vw.addEventListener('wheel',function(e){e.preventDefault();var p=pos(e);zoomTo(k*(e.deltaY<0?1.08:1/1.08),p.x,p.y)},{passive:false});
      rng.addEventListener('input',function(){zoomTo(min*Number(rng.value),V/2,V/2)});
      function close(v){URL.revokeObjectURL(url);ov.remove();document.removeEventListener('keydown',key);done(v)}
      function key(e){if(e.key==='Escape')close('')}
      document.addEventListener('keydown',key);
      no.onclick=function(){close('')};
      ok.onclick=function(){var c=document.createElement('canvas');c.width=c.height=N;draw(c,N);var d=c.toDataURL('image/webp',.9);if(d.indexOf('data:image/webp')!==0)d=c.toDataURL('image/jpeg',.9);close(d)};
      paint();ok.focus();
    };
    img.src=url;
  }
  window.PrenoliaCrop={open:open};
})();
