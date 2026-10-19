
(function(){
/*CORE-START*/
function liaNavCore(D,H){
  var i=0,stack=[],applying=false,silent=0;
  function key(o){return o.sec+'|'+o.mode+'|'+o.ov.join(',');}
  function push(o){i++;stack[i]=key(o);stack.length=i+1;H.pushState({lia:1,i:i,sig:o},'');}
  function check(){
    if(applying)return;
    var o=D.sig(),k=key(o);
    if(k===stack[i])return;
    if(i>1&&stack[i-1]===k){silent++;i--;H.back();return;}
    push(o);
  }
  function apply(T,done){
    var n=0;
    function modeStep(){
      var o=D.sig();
      if(T.sec==='Cal'&&T.mode&&o.mode!==T.mode)D.setMode(T.mode);
      D.later(done,150);
    }
    (function closing(){
      var cur=D.sig(),extra=cur.ov.filter(function(x){return T.ov.indexOf(x)<0;});
      if(extra.length&&n++<10){D.closeOv(extra[extra.length-1]);D.later(closing,90);return;}
      if(cur.sec!==T.sec){D.openSection(T.sec);D.later(modeStep,120);}else modeStep();
    })();
  }
  function onPop(ev){
    var st=ev&&ev.state;
    if(silent>0){silent--;return;}
    if(!st||!st.lia)return;
    if(st.base){
      var o=D.sig();i=1;stack[1]=key(o);stack.length=2;
      H.pushState({lia:1,i:1,sig:o},'');
      return;
    }
    i=st.i;applying=true;
    apply(st.sig,function(){stack[i]=key(D.sig());applying=false;});
  }
  function start(){
    var o=D.sig(),st=H.state;
    if(st&&st.lia&&st.i>=1){i=st.i;stack[i]=key(o);return;}
    H.replaceState({lia:1,i:0,base:1},'');
    H.pushState({lia:1,i:1,sig:o},'');
    i=1;stack[1]=key(o);
  }
  return {check:check,onPop:onPop,start:start};
}
/*CORE-END*/
  if(!window.history||!history.pushState||!document.getElementById)return;
  function $(id){return document.getElementById(id);}
  function q(s){return document.querySelector(s);}
  function click(el){if(el)el.click();}
  var OV=[
    ['client',function(){var s=$('clSplit'),h=$('clSheet');return !!((s&&s.classList.contains('cl-open'))||(h&&!h.hidden&&getComputedStyle(h).display!=='none'));},function(){click(q('#clSheet:not([hidden]) .cd-x')||q('#clSplit.cl-open .cd-x'));}],
    ['settings',function(){var s=$('stShell');return !!(s&&s.classList.contains('inPage'));},function(){click(q('#stShell .stPage.on .stBack')||q('#stShell .stBack'));}],
    ['monthside',function(){var a=$('calSubApp');return !!(a&&a.classList.contains('sideOpen'));},function(){click(q('#calSubApp .msClose'));}],
    ['weekside',function(){var a=$('calSubApp');return !!(a&&a.classList.contains('wkOpen')&&window.matchMedia('(max-width:979px)').matches);},function(){click(q('#calSubApp .wkClose')||q('#calSubApp .wkHandle'));}],
    ['sheet',function(){return !!q('#calSubApp .sheet.on');},function(){click($('sheet-close'));}],
    ['new',function(){var o=$('newOv');return !!(o&&!o.hidden);},function(){click($('newScrim'));}],
    ['lsheet',function(){return !!q('.liaSheet.on');},function(){click(q('.liaSheetBg.on'));}],
    ['qr',function(){var m=$('pfQrModal');return !!(m&&!m.hidden);},function(){click(q('#pfQrModal [data-qclose]'));}],
    ['chart',function(){return !!q('#statsSubApp .chartModal.on');},function(){click(q('#statsSubApp .chartModalHead button'));}],
    ['notif',function(){var p=$('notifPanel');return !!(p&&!p.hidden);},function(){click($('notifScrim'));}],
    ['avail',function(){var o=$('avLayer');return !!(o&&!o.hidden);},function(){click($('avBack'));}],
    ['mnguide',function(){var o=$('mnGuide');return !!(o&&!o.hidden);},function(){click($('mnGuideBack'));}],
    ['mnshare',function(){var o=$('mnShareSheet');return !!(o&&!o.hidden);},function(){click($('mnShareScrim'));}],
    ['menu',function(){var m=$('burgerMenu');return !!(m&&m.classList.contains('on'));},function(){click($('menuBackdrop'));}]
  ];
  function sec(){var p=q('.tabPanels > .tabPanel.on');return p&&p.id?p.id.replace('panel',''):'Cal';}
  function mode(){
    if(sec()!=='Cal')return '';
    var w=$('view-week'),m=$('view-month');
    if(w&&w.getAttribute('aria-pressed')==='true')return 'week';
    if(m&&m.getAttribute('aria-pressed')==='true')return 'month';
    return 'day';
  }
  var D={
    sig:function(){return {sec:sec(),mode:mode(),ov:OV.filter(function(o){try{return o[1]();}catch(e){return false;}}).map(function(o){return o[0];})};},
    closeOv:function(name){OV.forEach(function(o){if(o[0]===name){try{o[2]();}catch(e){}}});},
    openSection:function(s){click($('menuTab'+s));},
    setMode:function(m){click($('view-'+m));},
    later:function(fn,ms){setTimeout(fn,ms);}
  };
  var nav=liaNavCore(D,history),timer=null,started=false;
  window.addEventListener('popstate',function(ev){if(started)nav.onPop(ev);});
  var EVS=['touchend','pointerup','mousedown','keydown'];
  function go(){
    if(started)return;started=true;
    EVS.forEach(function(n){document.removeEventListener(n,go,true);});
    nav.start();
  }
  function begin(){
    if(window.MutationObserver){
      var mo=new MutationObserver(function(){if(!started)return;clearTimeout(timer);timer=setTimeout(nav.check,70);});
      mo.observe(document.body,{attributes:true,subtree:true,attributeFilter:['class','hidden','aria-pressed']});
      mo.observe(document.body,{childList:true});
    }
    /* le voci di cronologia create prima del primo tocco vengono saltate da Chrome: parto al primo tocco/tasto
       (dopo un ricaricamento le voci ci sono gia' e parto subito) */
    if(history.state&&history.state.lia&&history.state.i>=1)go();
    else EVS.forEach(function(n){document.addEventListener(n,go,true);});
  }
  if(document.readyState==='complete')setTimeout(begin,300);else window.addEventListener('load',function(){setTimeout(begin,300);});
  /* effetto "evidenzia" valido solo dopo il tocco su una notifica */
  window.liaFxActive=function(){var f=window.liaFocusEv;return !!(f&&Date.now()<f.exp&&(!f.first||Date.now()-f.first<4600));};
})();

