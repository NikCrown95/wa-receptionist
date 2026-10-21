
// --- logica delle Statistiche ---


var DATA = [];
var STATS_WEEKLY_HOURS = {};
var STATS_CLOSED_DATES = {};
// Un appuntamento che cade in un giorno di chiusura (giorno senza orari di apertura, ferie o chiusura di giornata intera) non conta mai nel fatturato
function statsIsClosedRow(r){
  var d=new Date(r.startAt), key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  if(STATS_CLOSED_DATES[key])return true;
  var any=Object.keys(STATS_WEEKLY_HOURS).some(function(k){return (STATS_WEEKLY_HOURS[k]||[]).length;});
  if(!any)return false;
  var wd=d.getDay()===0?7:d.getDay();
  return !(STATS_WEEKLY_HOURS[wd]||[]).length;
}
function statsRevenueOf(r){ return statsIsClosedRow(r)?0:(Number(r.price)||0); }

;

(function(){
  var PALETTE_SVC = ['a', 's', 't'];
  var svcColor = {};
  function colorForSvc(name){ return window.liaSvcColor(name); }
  function customerPhoneKey(v){
    var s=String(v||'').trim();
    if(!s)return '';
    var plus=s.charAt(0)==='+'?'+':'';
    var digits=s.replace(/\D/g,'');
    return digits?plus+digits:'';
  }
  function loadRealStats(){
    window.liaGetHistory().then(function(data){
        var rows = data.appointments || [];
        var firstSeen = {};
        rows.slice().sort(function(a,b){ return new Date(a.starts_at) - new Date(b.starts_at); }).forEach(function(a){
          var key = customerPhoneKey(a.customer_phone);
          if (key && !firstSeen[key]){ firstSeen[key] = a.id; }
        });
        var today0 = new Date(); today0.setHours(0,0,0,0);
        DATA = rows.map(function(a){
          var start = new Date(a.starts_at);
          var dayOffset = Math.round((new Date(start.getFullYear(),start.getMonth(),start.getDate()) - today0) / 86400000);
          var key = customerPhoneKey(a.customer_phone);
          return {
            day: dayOffset,
            name: a.customer_name,
            customerKey: key,
            dateKey: start.getFullYear() + '-' + String(start.getMonth()+1).padStart(2,'0'),
            service: a.service || '\u2014',
            price: a.price_eur || 0,
            color: colorForSvc(a.service),
            hour: start.getHours(),
            startAt: a.starts_at,
            endAt: a.ends_at,
            channel: (a.channel && CHAN_LABEL[a.channel]) ? a.channel : 'manuale',
            cancelled: a.status !== 'confirmed',
            first: firstSeen[key] === a.id
          };
        });
        recomputeFirstConfirmed();
        statsErrorBanner(false);
        render();
      })
      .catch(function(){ statsErrorBanner(true); });
  }
  function statsErrorBanner(show){
    var panel = document.getElementById('panelStats'), b = document.getElementById('statsErrBanner');
    if (!show){ if (b) b.remove(); return; }
    if (b || !panel) return;
    b = document.createElement('div'); b.id = 'statsErrBanner'; b.className = 'heat-msg';
    b.appendChild(document.createTextNode('Non riesco a caricare i dati delle statistiche. Controlla la connessione e riprova.'));
    var btn = document.createElement('button'); btn.type = 'button'; btn.textContent = 'Riprova';
    btn.addEventListener('click', function(){ b.remove(); loadStatsHours(); loadRealStats(); });
    b.appendChild(btn); panel.insertBefore(b, panel.firstChild);
  }

  var SVC_COLOR = {a:'var(--accent)', s:'var(--sec)', t:'var(--ter)', u:'var(--qua)', v:'var(--qui)'};
  var SVC_SOFT  = {a:'var(--accent-soft)', s:'var(--sec-soft)', t:'var(--ter-soft)', u:'var(--qua-soft)', v:'var(--qui-soft)'};
  var CHAN_LABEL = {manuale:'Manuale (tu)', whatsapp:'WhatsApp', telegram:'Telegram', web:'Chat sul sito', selfservice:'Prenotazione online'};
  var CHAN_COLOR = {manuale:'var(--muted)', whatsapp:'var(--accent)', telegram:'var(--sec)', web:'var(--ter)', selfservice:'var(--ter)'};
  var MONTHS = ['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'];
  var eur = new Intl.NumberFormat('it-IT', {style:'currency', currency:'EUR', maximumFractionDigits:0, useGrouping:'always'});

  var period = 'month';

  // Primo giorno in cui ogni cliente ha avuto una visita confermata (le prenotazioni annullate non contano come "primo contatto")
  var FIRST_CONFIRMED = {};
  var FIRST_AT = {};
  function recomputeFirstConfirmed(){
    FIRST_CONFIRMED = {}; FIRST_AT = {};
    DATA.forEach(function(r){
      if (r.cancelled) return;
      var k=r.customerKey; if(k && (FIRST_CONFIRMED[k] === undefined || r.day < FIRST_CONFIRMED[k])) { FIRST_CONFIRMED[k] = r.day; FIRST_AT[k] = r.startAt; }
    });
  }
  recomputeFirstConfirmed();
  function isNewInPeriod(key, p){
    var at = FIRST_AT[key];
    if (!at) return false;
    return inPeriod({startAt:at}, p);
  }

  function statsPeriodBounds(p, previous){
    var now=new Date(), start, end; now.setHours(0,0,0,0);
    if(p==='week'){
      start=new Date(now); start.setDate(start.getDate()-((start.getDay()+6)%7));
      if(previous) start.setDate(start.getDate()-7);
      end=new Date(start); end.setDate(end.getDate()+7);
    }else if(p==='month'){
      var shift=previous?-1:0; start=new Date(now.getFullYear(),now.getMonth()+shift,1); end=new Date(now.getFullYear(),now.getMonth()+shift+1,1);
    }else{
      var y=now.getFullYear()-(previous?1:0); start=new Date(y,0,1); end=new Date(y+1,0,1);
    }
    return {start:start,end:end};
  }
  function rowInBounds(row,b){var d=new Date(row.startAt);return d>=b.start&&d<b.end;}
  function inPeriod(row,p){return rowInBounds(row,statsPeriodBounds(p,false));}
  function prevInPeriod(row,p){return rowInBounds(row,statsPeriodBounds(p,true));}

  function fmtDelta(cur, prev){
    if (!prev) return cur ? {text:'Nuovo rispetto al periodo precedente', cls:'up'} : {text:'Nessun dato per il confronto', cls:'flat'};
    var d = ((cur - prev) / prev) * 100;
    var sign = d > 0 ? '+' : '';
    var cls = d > 3 ? 'up' : (d < -3 ? 'down' : 'flat');
    return {text: sign + Math.round(d) + '% rispetto al periodo precedente', cls: cls};
  }

  function el(tag, attrs, text){
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }
  function reduceMotionStats(){ return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function animateLine(svg, sel){
    if (reduceMotionStats()) return;
    var path = svg.querySelector(sel || '.line');
    if (!path) return;
    var len = path.getTotalLength();
    path.style.strokeDasharray = len;
    path.style.strokeDashoffset = len;
    var area = svg.querySelector('.area');
    if (area) area.style.opacity = '0';
    requestAnimationFrame(function(){
      path.style.transition = 'stroke-dashoffset .9s cubic-bezier(.4,0,.2,1)';
      path.style.strokeDashoffset = '0';
      if (area){ area.style.transition = 'opacity .7s ease .25s'; area.style.opacity = '1'; }
    });
  }
  function loopBars(svg){ return; }
  function loopLine(svg, sel){ return; }

  function smoothPath(pts){
    var n = pts.length;
    function f(v){ return v.toFixed(1); }
    if (n < 3) return pts.map(function(p,i){ return (i===0?'M':'L') + f(p.x) + ',' + f(p.y); }).join(' ');
    var dx = [], m = [], t = [], i;
    for (i = 0; i < n-1; i++){ dx[i] = pts[i+1].x - pts[i].x || 1; m[i] = (pts[i+1].y - pts[i].y) / dx[i]; }
    t[0] = m[0]; t[n-1] = m[n-2];
    for (i = 1; i < n-1; i++){ t[i] = (m[i-1]*m[i] <= 0) ? 0 : (m[i-1] + m[i]) / 2; }
    for (i = 0; i < n-1; i++){
      if (m[i] === 0){ t[i] = 0; t[i+1] = 0; continue; }
      var a = t[i]/m[i], b = t[i+1]/m[i], q = a*a + b*b;
      if (q > 9){ var k = 3/Math.sqrt(q); t[i] = k*a*m[i]; t[i+1] = k*b*m[i]; }
    }
    var d = 'M' + f(pts[0].x) + ',' + f(pts[0].y);
    for (i = 0; i < n-1; i++){
      var c = dx[i]/3;
      d += ' C' + f(pts[i].x + c) + ',' + f(pts[i].y + t[i]*c) + ' ' + f(pts[i+1].x - c) + ',' + f(pts[i+1].y - t[i+1]*c) + ' ' + f(pts[i+1].x) + ',' + f(pts[i+1].y);
    }
    return d;
  }

  function animateBars(svg){
    if (reduceMotionStats()) return;
    var bars = svg.querySelectorAll('.bar');
    bars.forEach(function(rect, i){
      rect.style.transformBox = 'fill-box';
      rect.style.transformOrigin = 'bottom';
      rect.style.transform = 'scaleY(0)';
    });
    requestAnimationFrame(function(){
      bars.forEach(function(rect, i){
        rect.style.transition = 'transform .5s cubic-bezier(.2,.8,.2,1) ' + Math.min(i * 12, 260) + 'ms';
        rect.style.transform = 'scaleY(1)';
      });
    });
  }

  function svgEl(tag, attrs){
    var e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

    // --- tooltip dei grafici: tocco con il dito o passaggio del mouse ---
  var statsTipEl = null;
  function statsTipNode(){
    if (!statsTipEl){ statsTipEl = document.createElement('div'); statsTipEl.id = 'statsTip'; statsTipEl.setAttribute('role','status'); document.body.appendChild(statsTipEl); }
    return statsTipEl;
  }
  function statsTipShow(html, x, y, touch){
    var t = statsTipNode(); t.innerHTML = html; t.classList.add('on');
    var w = t.offsetWidth, h = t.offsetHeight, vw = document.documentElement.clientWidth;
    var tx = Math.min(Math.max(8, x - w/2), vw - w - 8);
    var ty = y - h - (touch ? 34 : 14);
    if (ty < 8) ty = y + (touch ? 28 : 18);
    t.style.transform = 'translate(' + tx + 'px,' + ty + 'px)';
  }
  var statsTipClear = {}, statsHeatOn = null;
  function statsTipHide(){
    if (statsTipEl) statsTipEl.classList.remove('on');
    Object.keys(statsTipClear).forEach(function(k){ statsTipClear[k](); });
    if (statsHeatOn){ statsHeatOn.classList.remove('on'); statsHeatOn = null; }
  }
  document.addEventListener('pointerdown', function(e){ if (!e.target.closest || !e.target.closest('[data-stats-tip]')) statsTipHide(); });
  window.addEventListener('scroll', statsTipHide, {passive:true});
  function svgPoint(svg, e){ var p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(svg.getScreenCTM().inverse()); }
  function svgToScreen(svg, x, y){ var p = svg.createSVGPoint(); p.x = x; p.y = y; return p.matrixTransform(svg.getScreenCTM()); }
  function statsHover(svg, count, idxFn, onShow, onHide){
    svg.setAttribute('data-stats-tip','1');
    function on(e){ var i = idxFn(svgPoint(svg, e).x); if (i < 0 || i >= count) return; onShow(i, e.pointerType === 'touch'); }
    function off(){ onHide(); if (statsTipEl) statsTipEl.classList.remove('on'); }
    svg.onpointerdown = on;
    svg.onpointermove = function(e){ if (e.pointerType === 'mouse' || e.buttons || e.pressure > 0) on(e); };
    svg.onpointerleave = function(e){ if (e.pointerType === 'mouse') off(); };
    svg.onpointercancel = function(){ off(); };
    statsTipClear[svg.id || 'svg'] = onHide;
  }
  function statsLineHover(svg, points, X, Y, padT, innerH, tipFn, color){
    var cross = svgEl('line', {y1:padT, y2:padT+innerH, stroke:'var(--muted)', 'stroke-width':1, 'stroke-dasharray':'3 3', opacity:0, 'pointer-events':'none'});
    var dot = svgEl('circle', {r:5.5, fill:'var(--bg)', stroke:color || 'var(--accent)', 'stroke-width':2.5, opacity:0, 'pointer-events':'none'});
    svg.appendChild(cross); svg.appendChild(dot);
    var n = points.length, x0 = X(0), x1 = X(n-1);
    statsHover(svg, n,
      function(x){ return Math.max(0, Math.min(n-1, Math.round((x - x0) / ((x1 - x0) || 1) * (n-1)))); },
      function(i, touch){
        var px = X(i), py = Y(points[i].value);
        cross.setAttribute('x1', px); cross.setAttribute('x2', px); cross.setAttribute('opacity', 1);
        dot.setAttribute('cx', px); dot.setAttribute('cy', py); dot.setAttribute('opacity', 1);
        var sp = svgToScreen(svg, px, py); statsTipShow(tipFn(points[i]), sp.x, sp.y, touch);
      },
      function(){ cross.setAttribute('opacity', 0); dot.setAttribute('opacity', 0); });
  }
  function statsDonutHover(donut, segs, tipFn, legend){
    donut.setAttribute('data-stats-tip','1');
    var total = segs.reduce(function(a,b){ return a + b.value; }, 0);
    var strong = donut.querySelector('.revenue-hole strong,.donut-hole strong'), span = donut.querySelector('.revenue-hole span,.donut-hole span');
    var base = donut.style.background, o1 = strong ? strong.textContent : '', o2 = span ? span.textContent : '', cur = -2;
    function paint(a){
      if (a === cur) return; cur = a;
      if (a === null) donut.style.background = base;
      else if (segs.length > 1){
        var acc = 0, stops = segs.map(function(sg, i){
          var from = acc / total * 100; acc += sg.value; var to = acc / total * 100;
          var col = i === a ? sg.color : 'color-mix(in srgb, ' + sg.color + ' 28%, var(--card))';
          return col + ' ' + from + '% ' + to + '%';
        });
        donut.style.background = 'conic-gradient(' + stops.join(',') + ')';
      }
      donut.classList.toggle('hot', a !== null);
      if (strong) strong.textContent = a === null ? o1 : segs[a].big;
      if (span) span.textContent = a === null ? o2 : segs[a].label;
      if (legend) Array.prototype.forEach.call(legend.children, function(row, i){ row.classList.toggle('on', i === a); row.classList.toggle('dim', a !== null && i !== a); });
    }
    function pick(e){
      var r = donut.getBoundingClientRect(), cx = r.left + r.width/2, cy = r.top + r.height/2;
      var dx = e.clientX - cx, dy = e.clientY - cy, dist = Math.sqrt(dx*dx + dy*dy);
      var hole = donut.querySelector('.revenue-hole,.donut-hole'), holeR = hole ? hole.offsetWidth/2 : r.width*0.3;
      if (!total || dist < holeR - 2 || dist > r.width/2 + 6) return -1;
      var ang = Math.atan2(dx, -dy); if (ang < 0) ang += 2*Math.PI;
      var pct = ang / (2*Math.PI) * total, acc = 0;
      for (var i = 0; i < segs.length; i++){ acc += segs[i].value; if (pct < acc) return i; }
      return segs.length - 1;
    }
    function hideTipOnly(){ if (statsTipEl) statsTipEl.classList.remove('on'); }
    function on(e){
      var i = pick(e);
      if (i < 0){ paint(null); hideTipOnly(); return; }
      paint(i); statsTipShow(tipFn(segs[i], total), e.clientX, e.clientY, e.pointerType === 'touch');
    }
    donut.onpointerdown = on;
    donut.onpointermove = function(e){ if (e.pointerType === 'mouse') on(e); };
    donut.onpointerleave = function(e){ if (e.pointerType === 'mouse'){ paint(null); hideTipOnly(); } };
    donut.onpointercancel = function(){ paint(null); hideTipOnly(); };
    statsTipClear[donut.id || 'donut'] = function(){ paint(null); };
    function rowIdx(e){ var r = e.target.closest ? e.target.closest('.revenue-row,.dl-row') : null; return r ? Array.prototype.indexOf.call(legend.children, r) : -1; }
    if (legend){
      legend.setAttribute('data-stats-tip','1');
      legend.onpointerover = function(e){ if (e.pointerType === 'mouse'){ var i = rowIdx(e); if (i >= 0) paint(i); } };
      legend.onpointerleave = function(e){ if (e.pointerType === 'mouse') paint(null); };
      legend.onpointerdown = function(e){ var i = rowIdx(e); if (i >= 0) paint(i); };
    }
  }

  function kpiPeriodBounds(p){
    var now=new Date(), start, end;
    if(p==='week'){
      start=new Date(now);start.setHours(0,0,0,0);start.setDate(start.getDate()-((start.getDay()+6)%7));
      end=new Date(start);end.setDate(end.getDate()+7);
    }else if(p==='month'){
      start=new Date(now.getFullYear(),now.getMonth(),1);
      end=new Date(now.getFullYear(),now.getMonth()+1,1);
    }else{
      start=new Date(now.getFullYear(),0,1);
      end=new Date(now.getFullYear()+1,0,1);
    }
    return {start:start,end:end,now:now};
  }
  function rowsInKpiPeriod(p){
    var bounds=kpiPeriodBounds(p);
    return DATA.filter(function(r){var d=new Date(r.startAt);return d>=bounds.start&&d<bounds.end;});
  }
  function renderKpis(rows, prevRows){
    var bounds=kpiPeriodBounds(period);
    var periodRows=rowsInKpiPeriod(period);
    var scheduled=periodRows.filter(function(r){return !r.cancelled;});
    var completed=scheduled.filter(function(r){var e=new Date(r.endAt||r.startAt);return e<=bounds.now;});
    var revenue=completed.reduce(function(s,r){return s+statsRevenueOf(r);},0);
    var projectedRevenue=scheduled.reduce(function(s,r){return s+statsRevenueOf(r);},0);
    var confirmed=rows.filter(function(r){return !r.cancelled;});
    var count=confirmed.length;
    var prevCount=prevRows.filter(function(r){return !r.cancelled;}).length;
    var namesInRows=Array.from(new Set(confirmed.map(function(r){return r.customerKey;}).filter(Boolean)));
    var newClients=namesInRows.filter(function(n){return isNewInPeriod(n,period);}).length;
    var prevConfirmed=prevRows.filter(function(r){return !r.cancelled;});
    var prevNamesInRows=Array.from(new Set(prevConfirmed.map(function(r){return r.customerKey;}).filter(Boolean)));
    var prevNew=prevNamesInRows.filter(function(n){var first=DATA.find(function(r){return !r.cancelled&&r.customerKey===n&&r.day===FIRST_CONFIRMED[n];});return first&&prevInPeriod(first,period);}).length;
    function fmtD(d){return d.getDate()+' '+MONTHS[d.getMonth()];}
    var rLast=new Date(bounds.end.getFullYear(),bounds.end.getMonth(),bounds.end.getDate()-1);
    var rToday=new Date(bounds.now.getFullYear(),bounds.now.getMonth(),bounds.now.getDate());
    var revRange='dal '+fmtD(bounds.start)+' al '+fmtD(rToday<rLast?rToday:rLast);
    var projRange='dal '+fmtD(bounds.start)+' al '+fmtD(rLast);
    var cards=[
      {lbl:'Fatturato',val:eur.format(revenue),range:revRange,delta:{text:'Appuntamenti già trascorsi',cls:'flat'}},
      {lbl:'Proiezione fatturato',val:eur.format(projectedRevenue),range:projRange,delta:{text:'Inclusi gli appuntamenti futuri in agenda',cls:'flat'}},
      {lbl:'Appuntamenti confermati',val:String(count),delta:fmtDelta(count,prevCount)},
      {lbl:'Totale clienti',val:String(Array.from(new Set(DATA.map(function(r){return r.customerKey;}).filter(Boolean))).length),delta:{text:'Clienti univoci per numero di telefono',cls:'flat'}}
    ];
    var box=document.getElementById('kpis');
    box.textContent='';
    cards.forEach(function(c){
      var k=el('div',{class:'kpi'});
      k.appendChild(el('div',{class:'lbl'},c.lbl));
      k.appendChild(el('div',{class:'val'},c.val));
      if(c.range)k.appendChild(el('div',{class:'range'},c.range));
      k.appendChild(el('div',{class:'delta '+c.delta.cls},c.delta.text));
      box.appendChild(k);
    });
  }

  function bucketsForPeriod(rows, p){
    // ritorna [{label, value}] di fatturato confermato, per giorno (settimana/mese) o per mese (anno)
    var confirmed = rows.filter(function(r){ return !r.cancelled; });
    var out = [];
    if (p === 'year'){
      var byMonth = {};
      confirmed.forEach(function(r){
        var nowM=new Date(), startM=new Date(nowM.getFullYear(),nowM.getMonth()-11,1);
        var parts=(r.dateKey||'').split('-'), rd=new Date(Number(parts[0]),Number(parts[1]||1)-1,1);
        var key=(rd.getFullYear()-startM.getFullYear())*12+(rd.getMonth()-startM.getMonth());
        if(key>=0&&key<12) byMonth[key]=(byMonth[key]||0)+statsRevenueOf(r);
      });
      var now = new Date();
      for (var i = 0; i < 12; i++){
        var d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
        out.push({label: MONTHS[d.getMonth()], value: byMonth[i] || 0});
      }
    } else {
      var span = p === 'week' ? 7 : 30;
      var byDay = {};
      confirmed.forEach(function(r){ byDay[r.day] = (byDay[r.day] || 0) + statsRevenueOf(r); });
      for (var d2 = -(span-1); d2 <= 0; d2++){
        var dt = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + d2);
        out.push({label: dt.getDate() + ' ' + MONTHS[dt.getMonth()], value: byDay[d2] || 0});
      }
    }
    return out;
  }

  function renderLineChart(points){
    var svg = document.getElementById('linechart');
    svg.textContent = '';
    var W = window.liaChartW(svg), H = 220, padL = 34, padR = 10, padT = 14, padB = 26; svg.setAttribute('viewBox','0 0 '+W+' '+H);
    var innerW = W - padL - padR, innerH = H - padT - padB;
    var max = Math.max.apply(null, points.map(function(p){ return p.value; })) || 1;
    max = Math.ceil(max / 50) * 50 || 50;

    var defs = svgEl('defs');
    var grad = svgEl('linearGradient', {id:'areaGrad', x1:'0', y1:'0', x2:'0', y2:'1'});
    var s1 = svgEl('stop', {offset:'0%', 'stop-color':'var(--accent)', 'stop-opacity':'0.35'});
    var s2 = svgEl('stop', {offset:'100%', 'stop-color':'var(--accent)', 'stop-opacity':'0'});
    grad.appendChild(s1); grad.appendChild(s2); defs.appendChild(grad); svg.appendChild(defs);

    [0, 0.5, 1].forEach(function(t){
      var y = padT + innerH * t;
      svg.appendChild(svgEl('line', {class:'grid-l', x1:padL, x2:W-padR, y1:y, y2:y}));
      var lab = svgEl('text', {class:'axis', x:4, y:y+4});
      lab.textContent = new Intl.NumberFormat('it-IT',{useGrouping:'always',maximumFractionDigits:0}).format(Math.round(max * (1-t)));
      svg.appendChild(lab);
    });

    function X(i){ return padL + (points.length > 1 ? i/(points.length-1) : 0) * innerW; }
    function Y(v){ return padT + innerH - (v/max)*innerH; }

    var pts = points.map(function(p,i){ return {x:X(i), y:Y(p.value)}; });
    var d = smoothPath(pts);
    var area = d + ' L' + X(points.length-1).toFixed(1) + ',' + (padT+innerH) + ' L' + X(0).toFixed(1) + ',' + (padT+innerH) + ' Z';
    svg.appendChild(svgEl('path', {class:'area', d:area}));
    svg.appendChild(svgEl('path', {class:'line', d:d}));

    var step = Math.max(1, Math.round(points.length / 6));
    points.forEach(function(p,i){
      if (i % step === 0 || i === points.length-1){
        var c = svgEl('circle', {class:'dot', cx:X(i), cy:Y(p.value), r:3.5});
        svg.appendChild(c);
        var t = svgEl('text', {class:'axis', x:X(i), y:H-6, 'text-anchor': i===0?'start':(i===points.length-1?'end':'middle')});
        t.textContent = p.label;
        svg.appendChild(t);
      }
    });
    // un punto che pulsa piano sull'ultimo dato, per dare vita al grafico
    var last = points.length - 1;
    var pulse = svgEl('circle', {class:'pulse-dot', cx:X(last), cy:Y(points[last].value), r:4.5});
    svg.appendChild(pulse);
    statsLineHover(svg, points, X, Y, padT, innerH, function(p){ return '<b>' + eur.format(p.value) + '</b>' + p.label; });
    animateLine(svg);
    loopLine(svg, '.line');
  }

  function bucketsCount(rows, p){
    var confirmed = rows.filter(function(r){ return !r.cancelled; });
    var out = [];
    if (p === 'year'){
      var byMonth = {};
      confirmed.forEach(function(r){
        var nowM=new Date(), startM=new Date(nowM.getFullYear(),nowM.getMonth()-11,1);
        var parts=(r.dateKey||'').split('-'), rd=new Date(Number(parts[0]),Number(parts[1]||1)-1,1);
        var key=(rd.getFullYear()-startM.getFullYear())*12+(rd.getMonth()-startM.getMonth());
        if(key>=0&&key<12) byMonth[key]=(byMonth[key]||0)+1;
      });
      var now = new Date();
      for (var i = 0; i < 12; i++){
        var d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
        out.push({label: MONTHS[d.getMonth()], value: byMonth[i] || 0});
      }
    } else {
      var span = p === 'week' ? 7 : 30;
      var byDay = {};
      confirmed.forEach(function(r){ byDay[r.day] = (byDay[r.day] || 0) + 1; });
      for (var d2 = -(span-1); d2 <= 0; d2++){
        var dt = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + d2);
        out.push({label: dt.getDate() + ' ' + MONTHS[dt.getMonth()], value: byDay[d2] || 0});
      }
    }
    return out;
  }

  function renderCountChart(points){
    var svg = document.getElementById('countchart');
    svg.textContent = '';
    var W = window.liaChartW(svg), H = 200, padL = 30, padR = 8, padT = 10, padB = 26; svg.setAttribute('viewBox','0 0 '+W+' '+H);
    var innerW = W - padL - padR, innerH = H - padT - padB;
    var max = Math.max.apply(null, points.map(function(p){ return p.value; })) || 1;
    [0, 0.5, 1].forEach(function(t){
      var y = padT + innerH * t;
      svg.appendChild(svgEl('line', {class:'grid-l', x1:padL, x2:W-padR, y1:y, y2:y}));
      var lab = svgEl('text', {class:'axis', x:2, y:y+4});
      lab.textContent = Math.round(max * (1-t));
      svg.appendChild(lab);
    });
    var rects = [];
var gap = points.length > 40 ? 2 : 6;
    var bw = (innerW - gap*(points.length-1)) / points.length;
    var step = Math.max(1, Math.round(points.length/6));
    points.forEach(function(p,i){
      var bh = (p.value/max) * innerH;
      var x = padL + i*(bw+gap);
      var y = padT + innerH - bh;
      var rect = svgEl('rect', {class:'bar', x:x, y:y, width:Math.max(bw,1), height:Math.max(bh,1), rx:Math.min(4,bw/2)});
rects.push(rect);
      svg.appendChild(rect);
      if (i % step === 0 || i === points.length-1){
        var t = svgEl('text', {class:'axis', x:x+bw/2, y:H-6, 'text-anchor': i===0?'start':(i===points.length-1?'end':'middle')});
        t.textContent = p.label;
        svg.appendChild(t);
      }
    });
    statsHover(svg, points.length,
      function(x){ return Math.max(0, Math.min(points.length-1, Math.floor((x - padL + gap/2) / (bw + gap)))); },
      function(i, touch){
        rects.forEach(function(r, j){ r.style.opacity = j === i ? '1' : '.35'; });
        var v = points[i].value, sp = svgToScreen(svg, padL + i*(bw+gap) + bw/2, parseFloat(rects[i].getAttribute('y')));
        statsTipShow('<b>' + v + (v === 1 ? ' appuntamento' : ' appuntamenti') + '</b>' + points[i].label, sp.x, sp.y, touch);
      },
      function(){ rects.forEach(function(r){ r.style.opacity = ''; }); });
    animateBars(svg);
    loopBars(svg);
  }

  function renderHourChart(rows){
    var svg = document.getElementById('hourchart');
    svg.textContent = '';
    var hours = [9,10,11,12,15,16,17,18,19];
    var counts = hours.map(function(h){ return rows.filter(function(r){ return !r.cancelled && r.hour === h; }).length; });
    var max = Math.max.apply(null, counts) || 1;
    var W = window.liaChartW(svg), H = 180, padL = 8, padR = 8, padT = 6, padB = 24; svg.setAttribute('viewBox','0 0 '+W+' '+H);
    var innerW = W - padL - padR, innerH = H - padT - padB;
    var gap = 10, bw = (innerW - gap*(hours.length-1)) / hours.length;
    hours.forEach(function(h, i){
      var v = counts[i];
      var bh = max ? (v/max) * innerH : 0;
      var x = padL + i*(bw+gap);
      var y = padT + innerH - bh;
      var rect = svgEl('rect', {class:'bar', x:x, y:y, width:bw, height:Math.max(bh,2), rx:6});
      var title = svgEl('title'); title.textContent = h + ':00 – ' + v + (v===1?' appuntamento':' appuntamenti');
      rect.appendChild(title);
      svg.appendChild(rect);
      var t = svgEl('text', {class:'axis', x:x+bw/2, y:H-6, 'text-anchor':'middle'});
      t.textContent = h;
      svg.appendChild(t);
    });
  }

  function renderHBars(containerId, items){
    var box = document.getElementById(containerId);
    if(!box)return;
    box.textContent = '';
    var max = Math.max.apply(null, items.map(function(i){ return i.value; })) || 1;
    items.forEach(function(it){
      var row = el('div', {class:'hbar-row'});
      var lab = el('div', {class:'lab'});
      lab.appendChild(el('i', {style:'background:' + it.color}));
      lab.appendChild(el('span', {}, it.label));
      row.appendChild(lab);
      var track = el('div', {class:'track'});
      var fill = el('div', {class:'fill', style:'width:' + Math.round(it.value/max*100) + '%;background:' + it.color});
      track.appendChild(fill);
      row.appendChild(track);
      row.appendChild(el('div', {class:'amt'}, it.amountLabel));
      box.appendChild(row);
    });
  }

  function renderRevenueDonut(items){
    var donut=document.getElementById('revenue-donut'), box=document.getElementById('byservice'), totalEl=document.getElementById('revenue-total');
    if(!donut||!box)return;
    box.textContent='';
    var total=items.reduce(function(s,it){return s+(Number(it.value)||0);},0);
    if(totalEl)totalEl.textContent=eur.format(total);
    if(!total){donut.style.background='var(--card2)';donut.onpointerdown=null;donut.onpointermove=null;return;}
    var stops=[],acc=0;
    items.forEach(function(it){var start=acc;acc+=it.value/total*100;stops.push(it.color+' '+start+'% '+acc+'%');});
    donut.style.background=items.length===1?items[0].color:'conic-gradient('+stops.join(',')+')';
    statsDonutHover(donut, items.map(function(it){ return {value:Number(it.value)||0, label:it.label, big:it.amountLabel, color:it.color}; }),
      function(sg, tot){ return '<b>' + sg.big + '</b>' + sg.label + ' \u00b7 ' + Math.round(sg.value/tot*100) + '%'; }, box);
    items.forEach(function(it){
      var pct=Math.round(it.value/total*100), row=el('div',{class:'revenue-row'});
      row.appendChild(el('i',{class:'revenue-dot',style:'background:'+it.color}));
      row.appendChild(el('div',{class:'revenue-name'},it.label));
      var val=el('div',{class:'revenue-value'});val.appendChild(el('b',{},it.amountLabel));val.appendChild(el('span',{},pct+'% del totale'));row.appendChild(val);box.appendChild(row);
    });
    function syncFade(){ box.classList.toggle('atend', box.scrollTop + box.clientHeight >= box.scrollHeight - 2); }
    box.classList.toggle('scrolly', box.scrollHeight > box.clientHeight + 2);
    box.onscroll = syncFade; syncFade();
  }

  function renderDonut(rows){
    var confirmed = rows.filter(function(r){ return !r.cancelled; });
    var names = Array.from(new Set(confirmed.map(function(r){ return r.customerKey; }).filter(Boolean)));
    var newCount = names.filter(function(n){ return isNewInPeriod(n, period); }).length;
    var retCount = names.length - newCount;
    var total = names.length;

    var donut = document.getElementById('donut');
    var newPct = total ? (newCount/total*100) : 0;
    var retPct = total ? (retCount/total*100) : 0;
    if(!total) donut.style.background='var(--card2)';
    else if(newCount===total) donut.style.background='var(--accent)';
    else if(retCount===total) donut.style.background='var(--sec)';
    else donut.style.background='conic-gradient(var(--accent) 0 '+newPct+'%, var(--sec) '+newPct+'% 100%)';
    var totalEl=document.getElementById('donut-total');
    if(totalEl)totalEl.textContent=total;
    if(total){
      statsDonutHover(donut, [{value:newCount, label:newCount===1?'nuovo cliente':'nuovi clienti', big:String(newCount), color:'var(--accent)'}, {value:retCount, label:retCount===1?'cliente abituale':'clienti abituali', big:String(retCount), color:'var(--sec)'}],
        function(sg, tot){ return '<b>' + sg.big + ' ' + sg.label + '</b>' + Math.round(sg.value/tot*100) + '% del totale'; }, document.getElementById('donut-legend'));
    } else { donut.onpointerdown = null; donut.onpointermove = null; }

    var legend = document.getElementById('donut-legend');
    legend.textContent = '';
    function row(color, label, value){
      var pct = total ? Math.round(value/total*100) : 0;
      var r2 = el('div', {class:'dl-row'});
      r2.appendChild(el('i', {style:'background:' + color}));
      var mid = el('div', {});
      mid.appendChild(el('b', {}, value + ' ' + label));
      mid.appendChild(el('span', {}, pct + '% del totale'));
      r2.appendChild(mid);
      legend.appendChild(r2);
    }
    row('var(--accent)', newCount===1?'nuovo cliente':'nuovi clienti', newCount);
    row('var(--sec)', 'clienti abituali', retCount);
  }

  function renderGrowth(){
    // crescita cumulata dei clienti unici, sempre sugli ultimi 12 mesi (non segue il periodo selezionato)
    var firstByName = {};
    DATA.forEach(function(r){
      if(r.cancelled) return;
      var k=r.customerKey, mk=r.dateKey||'';
      if(!k)return;
      if(mk && (firstByName[k] === undefined || mk < firstByName[k])) firstByName[k] = mk;
    });
    var now = new Date();
    var points = [];
    for (var i = 0; i < 12; i++){
      var d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      var monthKey=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
      var count = Object.keys(firstByName).filter(function(n){ return firstByName[n] <= monthKey; }).length;
      points.push({label: MONTHS[d.getMonth()], value: count});
    }

    var svg = document.getElementById('growthchart');
    svg.textContent = '';
    var W = window.liaChartW(svg), H = 200, padL = 30, padR = 10, padT = 14, padB = 26; svg.setAttribute('viewBox','0 0 '+W+' '+H);
    var innerW = W - padL - padR, innerH = H - padT - padB;
    var max = Math.max.apply(null, points.map(function(p){ return p.value; })) || 1;
    [0,0.5,1].forEach(function(t){
      var y = padT + innerH * t;
      svg.appendChild(svgEl('line', {class:'grid-l', x1:padL, x2:W-padR, y1:y, y2:y}));
      var lab = svgEl('text', {class:'axis', x:2, y:y+4});
      lab.textContent = Math.round(max*(1-t));
      svg.appendChild(lab);
    });
    function X(i){ return padL + (points.length>1 ? i/(points.length-1) : 0) * innerW; }
    function Y(v){ return padT + innerH - (v/max)*innerH; }
    var pts2 = points.map(function(p,i){ return {x:X(i), y:Y(p.value)}; });
    var d2 = smoothPath(pts2);
    svg.appendChild(svgEl('path', {class:'line2', d:d2}));
    points.forEach(function(p,i){
      var c = svgEl('circle', {class:'dot2', cx:X(i), cy:Y(p.value), r:3.5});
      svg.appendChild(c);
      var t = svgEl('text', {class:'axis', x:X(i), y:H-6, 'text-anchor': i===0?'start':(i===points.length-1?'end':'middle')});
      t.textContent = p.label;
      svg.appendChild(t);
    });
    var last2 = points.length - 1;
    svg.appendChild(svgEl('circle', {class:'pulse-dot2', cx:X(last2), cy:Y(points[last2].value), r:4.5}));
    statsLineHover(svg, points, X, Y, padT, innerH, function(p){ return '<b>' + p.value + (p.value === 1 ? ' cliente' : ' clienti') + '</b>' + p.label; }, 'var(--sec)');
    animateLine(svg, '.line2');
    loopLine(svg, '.line2');
  }

  function renderHeatmap(rows){
    var DOW = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];
    var confirmed = rows.filter(function(r){ return !r.cancelled && r.startAt; });
    // Colonne: dagli orari di apertura (sempre uguali), allargate alle ore in cui ci sono appuntamenti.
    var minH = 24, maxH = -1, hasHours = false, wd;
    for (wd = 1; wd <= 7; wd++){
      (STATS_WEEKLY_HOURS[wd] || []).forEach(function(rg){
        var a = String(rg.open || '').split(':'), b = String(rg.close || '').split(':');
        var o = parseInt(a[0], 10), c = parseInt(b[0], 10), cm = parseInt(b[1] || '0', 10);
        if (isNaN(o) || isNaN(c)) return;
        var last = cm > 0 ? c : c - 1;
        if (last < o) return;
        hasHours = true;
        if (o < minH) minH = o;
        if (last > maxH) maxH = last;
      });
    }
    confirmed.forEach(function(r){ var h = new Date(r.startAt).getHours(); if (h < minH) minH = h; if (h > maxH) maxH = h; });
    if (maxH < minH){ minH = 9; maxH = 19; }
    var HOURS = [], h;
    for (h = minH; h <= maxH; h++) HOURS.push(h);
    function isOpen(dayIdx, hour){
      if (!hasHours) return true;
      return (STATS_WEEKLY_HOURS[dayIdx + 1] || []).some(function(rg){
        var a = String(rg.open || '').split(':'), b = String(rg.close || '').split(':');
        var o = (+a[0]) * 60 + (+a[1] || 0), c = (+b[0]) * 60 + (+b[1] || 0);
        return hour * 60 < c && (hour + 1) * 60 > o;
      });
    }
    var grid = DOW.map(function(){ return HOURS.map(function(){ return 0; }); });
    confirmed.forEach(function(r){
      var d = new Date(r.startAt), idx = (d.getDay() + 6) % 7, hIdx = d.getHours() - minH;
      if (hIdx >= 0 && hIdx < HOURS.length) grid[idx][hIdx]++;
    });
    var max = 0;
    grid.forEach(function(row){ row.forEach(function(v){ if (v > max) max = v; }); });
    max = max || 1;

    var box = document.getElementById('heatmap');
    box.textContent = '';
    var cols = '38px repeat(' + HOURS.length + ',minmax(0,1fr))';
    var wrap = el('div', {class:'heat-grid'});
    wrap.style.minWidth = Math.max(300, 38 + HOURS.length * 28) + 'px';
    var hdr = el('div', {class:'heat-hdr'});
    hdr.style.gridTemplateColumns = cols;
    hdr.appendChild(el('span', {}, ''));
    HOURS.forEach(function(hh){ hdr.appendChild(el('span', {}, hh)); });
    wrap.appendChild(hdr);
    DOW.forEach(function(day, i){
      var row = el('div', {class:'heat-row'});
      row.style.gridTemplateColumns = cols;
      row.appendChild(el('span', {class:'dlab'}, day));
      HOURS.forEach(function(hh, j){
        var v = grid[i][j], open = isOpen(i, hh) || v > 0;
        var cell = el('div', {class:'heat-cell' + (open ? '' : ' closed'), 'data-stats-tip':'1'});
        if (v > 0) cell.style.background = 'color-mix(in srgb, var(--accent) ' + Math.round(15 + (v / max) * 75) + '%, var(--card2))';
        var when = day + ' ' + hh + ':00–' + (hh + 1) + ':00';
        var html = !open ? '<b>Chiuso</b>' + when : '<b>' + v + (v === 1 ? ' appuntamento' : ' appuntamenti') + '</b>' + when;
        function on(e){
          if (statsHeatOn && statsHeatOn !== cell) statsHeatOn.classList.remove('on');
          statsHeatOn = cell; cell.classList.add('on');
          var rc = cell.getBoundingClientRect();
          statsTipShow(html, rc.left + rc.width / 2, rc.top, e.pointerType === 'touch');
        }
        cell.addEventListener('pointerdown', on);
        cell.addEventListener('pointerenter', function(e){ if (e.pointerType === 'mouse') on(e); });
        cell.addEventListener('pointerleave', function(e){ if (e.pointerType === 'mouse') statsTipHide(); });
        row.appendChild(cell);
      });
      wrap.appendChild(row);
    });
    box.appendChild(wrap);

    var sw = document.getElementById('heat-sw');
    sw.textContent = '';
    [15,35,55,75,90].forEach(function(p){
      sw.appendChild(el('i', {style:'background:color-mix(in srgb, var(--accent) ' + p + '%, var(--card2))'}));
    });
  }

  function initials(name){ return name.split(' ').map(function(p){return p[0];}).join('').slice(0,2).toUpperCase(); }

  function renderClients(rows){
    var confirmed = rows.filter(function(r){ return !r.cancelled; });
    var byName = {};
    confirmed.forEach(function(r){
      var k=r.customerKey; if(!k)return; byName[k] = byName[k] || {name:r.name,visits:0, spent:0};
      byName[k].name=r.name; byName[k].visits++; byName[k].spent += statsRevenueOf(r);
    });
    var list = Object.keys(byName).map(function(n){ return {name:byName[n].name, visits:byName[n].visits, spent:byName[n].spent}; });
    list.sort(function(a,b){ return b.spent - a.spent; });
    list = list.slice(0,5);
    var sub=document.getElementById('clients-sub');
    var box = document.getElementById('clients');
    if(!sub||!box)return;
    sub.textContent = list.length ? 'Chi ha speso di più in questo periodo.' : 'Nessun cliente in questo periodo.';
    box.textContent = '';
    list.forEach(function(c){
      var row = el('div', {class:'crow'});
      row.appendChild(el('div', {class:'av'}, initials(c.name)));
      var mid = el('div', {class:'mid'});
      mid.appendChild(el('b', {}, c.name));
      mid.appendChild(el('span', {}, c.visits + (c.visits===1?' visita':' visite')));
      row.appendChild(mid);
      row.appendChild(el('div', {class:'spent'}, eur.format(c.spent)));
      box.appendChild(row);
    });
  }

  function statsOpenMinutes(d){
    var wd=d.getDay()===0?7:d.getDay(), ranges=STATS_WEEKLY_HOURS[wd]||[];
    return ranges.reduce(function(sum,r){var a=String(r.open||'').split(':'),b=String(r.close||'').split(':');var s=(+a[0])*60+(+a[1]),e=(+b[0])*60+(+b[1]);return sum+(e>s?e-s:0);},0);
  }
  function renderWeekdayOccupancy(rows){
    var box=document.getElementById('weekday-occ');if(!box)return;box.textContent='';
    var labels=['Lun','Mar','Mer','Gio','Ven','Sab','Dom'],booked=[0,0,0,0,0,0,0],available=[0,0,0,0,0,0,0];
    var bounds=period==='week'?[-6,0]:(period==='month'?[-29,0]:[-364,0]),today=new Date();today.setHours(0,0,0,0);
    for(var off=bounds[0];off<=bounds[1];off++){var d=new Date(today);d.setDate(d.getDate()+off);var idx=(d.getDay()+6)%7;available[idx]+=statsOpenMinutes(d);}
    rows.filter(function(r){return !r.cancelled;}).forEach(function(r){var s=new Date(r.startAt),e=new Date(r.endAt),mins=(e-s)/60000;if(Number.isFinite(mins)&&mins>0){var idx=(s.getDay()+6)%7;booked[idx]+=mins;}});
    labels.forEach(function(label,i){var pct=available[i]?Math.min(100,Math.round(booked[i]/available[i]*100)):0,row=el('div',{class:'occ-day'+(available[i]?'':' closed')});row.appendChild(el('div',{class:'occ-pct'},available[i]?pct+'%':'Chiuso'));var track=el('div',{class:'occ-track'});track.appendChild(el('div',{class:'occ-fill',style:'height:'+pct+'%'}));row.appendChild(track);row.appendChild(el('div',{class:'occ-label'},label));box.appendChild(row);
      row.setAttribute('data-stats-tip','1');
      var full=['Luned\u00ec','Marted\u00ec','Mercoled\u00ec','Gioved\u00ec','Venerd\u00ec','Sabato','Domenica'][i];
      function fmtMin(m){ m=Math.round(m); var h=Math.floor(m/60), r=m%60; return h+' h'+(r?' '+r+' min':''); }
      var html = available[i] ? '<b>'+full+' \u00b7 '+pct+'%</b>'+fmtMin(booked[i])+' prenotate su '+fmtMin(available[i])+' disponibili nel periodo' : '<b>'+full+'</b>Chiuso';
      function on(e){
        Array.prototype.forEach.call(box.children, function(x, j){ x.classList.toggle('on', j===i); x.classList.toggle('dim', j!==i); });
        var rc = track.getBoundingClientRect();
        statsTipShow(html, rc.left + rc.width/2, rc.top + rc.height*(1-pct/100), e.pointerType === 'touch');
      }
      function off(){ Array.prototype.forEach.call(box.children, function(x){ x.classList.remove('on','dim'); }); if (statsTipEl) statsTipEl.classList.remove('on'); }
      row.addEventListener('pointerdown', on);
      row.addEventListener('pointerenter', function(e){ if (e.pointerType==='mouse') on(e); });
      row.addEventListener('pointerleave', function(e){ if (e.pointerType==='mouse') off(); });
      row.addEventListener('pointercancel', off);
    });
    statsTipClear.occ = function(){ Array.prototype.forEach.call(box.children, function(x){ x.classList.remove('on','dim'); }); };
    if (box.parentNode) box.parentNode.classList.add('occ-panel');
  }
  function loadStatsHours(){
    var statsToken=(new URLSearchParams(location.search).get('t')||'').trim();
    if(!statsToken)return Promise.resolve();
    return (window.liaSettingsShared?window.liaSettingsShared().catch(function(){return {};}):fetch('/api/agenda?t='+encodeURIComponent(statsToken)+'&settings=1').then(function(r){return r.json();})).then(function(d){var weekly={};((Array.isArray(d.capacity_hours)&&d.capacity_hours.length?d.capacity_hours:d.hours)||[]).forEach(function(h){var wd=Number(h.weekday);if(!weekly[wd])weekly[wd]=[];weekly[wd].push({open:String(h.opens||''),close:String(h.closes||'')});});STATS_WEEKLY_HOURS=weekly;var closed={};(Array.isArray(d.blocks)?d.blocks:[]).forEach(function(b){if(b&&b.full_day&&b.date)closed[String(b.date).slice(0,10)]=1;});STATS_CLOSED_DATES=closed;render();}).catch(function(){});
  }

  function render(){
    var rows = DATA.filter(function(r){ return inPeriod(r, period); });
    var prevRows = DATA.filter(function(r){ return prevInPeriod(r, period); });

    renderKpis(rows, prevRows);

    var subLabel = period === 'week' ? 'Ultimi 7 giorni' : (period === 'month' ? 'Ultimi 30 giorni' : 'Ultimi 12 mesi');
    document.getElementById('trend-sub').textContent = subLabel + ', solo appuntamenti confermati.';
    document.getElementById('count-sub').textContent = subLabel + '.';
    renderLineChart(bucketsForPeriod(DATA, period));
    renderCountChart(bucketsCount(DATA, period));
    renderDonut(rows);
    renderGrowth();
    renderHeatmap(rows);
    renderWeekdayOccupancy(rows);

    var confirmed = rows.filter(function(r){ return !r.cancelled; });
    var bySvc = {};
    confirmed.forEach(function(r){ bySvc[r.service] = bySvc[r.service] || {value:0, color:r.color}; bySvc[r.service].value += statsRevenueOf(r); });
    var svcItems = Object.keys(bySvc).map(function(k){ return {label:k, value:bySvc[k].value, color:'var(--' + ({a:'accent',s:'sec',t:'ter',u:'qua',v:'qui'})[bySvc[k].color] + ')', amountLabel: eur.format(bySvc[k].value)}; });
    svcItems.sort(function(a,b){ return b.value - a.value; });
    renderRevenueDonut(svcItems);

    var byChan = {};
    confirmed.forEach(function(r){ byChan[r.channel] = (byChan[r.channel] || 0) + 1; });
    var total = confirmed.length || 1;
    var chanItems = Object.keys(byChan).map(function(k){ return {label:CHAN_LABEL[k], value:byChan[k], color:CHAN_COLOR[k], amountLabel: Math.round(byChan[k]/total*100) + '%'}; });
    chanItems.sort(function(a,b){ return b.value - a.value; });
    renderHBars('bychannel', chanItems);

    renderClients(rows);
  }

  var btns = document.querySelectorAll('.pseg button');
  for (var i=0;i<btns.length;i++){
    btns[i].addEventListener('click', function(){
      period = this.getAttribute('data-p');
      for (var j=0;j<btns.length;j++) btns[j].setAttribute('aria-pressed', btns[j]===this ? 'true':'false');
      render();
    });
  }
  render();
  var statsLoaded=false;
  function ensureStatsLoaded(){ if(statsLoaded)return; statsLoaded=true; loadStatsHours(); loadRealStats(); }
  document.addEventListener('lia:section',function(e){ if(e.detail==='stats')ensureStatsLoaded(); });
  document.addEventListener('lia:data-changed',function(){ statsLoaded=false; });
  var statsPanel=document.getElementById('panelStats');
  if(statsPanel&&statsPanel.classList.contains('on'))ensureStatsLoaded();

})();

