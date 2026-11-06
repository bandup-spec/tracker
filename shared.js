/* shared.html: everything both roles use (helpers, server calls, sheets, schedule grid). Exposes window.CWA. */
(function(){
'use strict';

/* ================= constants & state ================= */
var DOW=['SUN','MON','TUE','WED','THU','FRI','SAT'],DOW3=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
var MONS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
var MONF=['January','February','March','April','May','June','July','August','September','October','November','December'];
var HL={},COURSE={},CYCLE=['','P','A','L','E'];   /* HL: hour -> label (7AM..6PM); COURSE: filled from server config */
for(var hh=7;hh<=18;hh++)HL[hh]=hh<12?hh+'AM':(hh===12?'12NN':(hh-12)+'PM');
var S={token:null,user:null,boot:null,hol:{},tab:'home',list:null};
var T={ws:null,data:null,stu:{},tid:null,teachers:[],last:null,seq:0,undo:[],viewKey:''};
var H={},IN={},CH={},C={H:H,IN:IN,CH:CH,S:S,T:T,COURSE:COURSE,HL:HL,DOW:DOW,DOW3:DOW3,CYCLE:CYCLE,render:null,mount:null,showLogin:null};
var DEBUG=false,busyN=0,app=document.getElementById('app');
function $(s,r){return (r||document).querySelector(s);}

/* ================= date helpers (all dates are 'yyyy-MM-dd' strings) ================= */
function p2(n){return (n<10?'0':'')+n;}
function pd(s){var p=s.split('-');return new Date(Date.UTC(+p[0],+p[1]-1,+p[2]));}
function fd(d){return d.toISOString().slice(0,10);}
function add(s,n){var d=pd(s);d.setUTCDate(d.getUTCDate()+n);return fd(d);}
function dow(s){return pd(s).getUTCDay();}
function monday(s){var w=dow(s);return add(s,w===0?-6:1-w);}
function today(){var d=new Date();return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate());}
function mdy(s){return s?s.slice(5,7)+'-'+s.slice(8,10)+'-'+s.slice(0,4):'';}
function longD(s){var d=pd(s);return DOW3[d.getUTCDay()]+', '+MONS[d.getUTCMonth()]+' '+d.getUTCDate();}
function upD(s){var d=pd(s);return MONS[d.getUTCMonth()].toUpperCase()+' '+d.getUTCDate()+', '+d.getUTCFullYear();}
function monthStart(s){return s.slice(0,7)+'-01';}
function monthEnd(s){var d=pd(monthStart(s));d.setUTCMonth(d.getUTCMonth()+1);d.setUTCDate(0);return fd(d);}
function addMonth(s,n){var d=pd(monthStart(s));d.setUTCMonth(d.getUTCMonth()+n);return fd(d);}
function monthName(s){var d=pd(s);return MONF[d.getUTCMonth()]+' '+d.getUTCFullYear();}
function allDays(a,b){var o=[];for(var d=a;d<=b;d=add(d,1))o.push(d);return o;}
function calcEnd(start,weeks){var e=add(start,weeks*7-1),w=dow(e);if(w===6)e=add(e,-1);if(w===0)e=add(e,-2);return e;}
function nextMonday(){var t=today();return dow(t)===1?t:add(t,(8-dow(t))%7);}
function iso(y,m,d){var s=y+'-'+p2(m)+'-'+p2(d);try{return fd(pd(s))===s?s:'';}catch(e){return '';}}
function clamp(d,a,b){return d<a?a:(d>b?b:d);}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}

/* ================= server config + camp/holiday rules ================= */
function setHol(list){S.hol={};(list||[]).forEach(function(h){S.hol[h.date]=h;});}
function holOf(d){return S.hol[d]||null;}
function campOn(){return !!(S.boot&&S.boot.camp);}
function hrs(){var b=S.boot;return b.camp?b.hours.concat(b.campHours).sort(function(x,y){return x-y;}):b.hours;}
function allHrs(){return S.boot.hours.concat(S.boot.campHours);}
function lunchShown(){return !campOn();}                                   /* camp: 12NN is a class slot, not lunch */
function weekEnd(m){return add(m,campOn()?5:4);}
function isOff(d){var w=dow(d);if(w===0||(w===6&&!campOn()))return true;var h=holOf(d);return !!(h&&h.type==='NO_CLASS');}
function lastClassDay(t){var w=dow(t);if(w===0)return add(t,campOn()?-1:-2);if(w===6)return campOn()?t:add(t,-1);return t;}
function weekdays(a,b){var o=[];for(var d=a;d<=b;d=add(d,1)){var w=dow(d);if(w>0&&(w<6||(w===6&&campOn())))o.push(d);}return o;}
function nextWd(s,n){var d=add(s,n);while(dow(d)===0||(dow(d)===6&&!campOn()))d=add(d,n);return d;}
function lateAbs(n){var b=S.boot;return b.lateAbsent?n:(b.lateThree?Math.floor(n/b.latePerAbsent):0);}   /* lates counted as absent */
function setBoot(b){
  S.user=b.user;S.boot=b;S.list=null;setHol(b.holidays);DEBUG=!!b.debug;
  T.tid=null;T.last=null;T.teachers=[];T.data=null;
  Object.keys(COURSE).forEach(function(k){delete COURSE[k];});
  Object.keys(b.policy).forEach(function(k){COURSE[k]=b.policy[k].label;});
}
function setDebug(v){DEBUG=!!v;S.boot.debug=!!v;}
function courseOpts(withDesc){var p=S.boot.policy;return Object.keys(p).map(function(k){return '<option value="'+k+'">'+esc(p[k].label)+(withDesc?': '+esc(p[k].desc):'')+'</option>';}).join('');}

/* ================= server calls, errors, logging ================= */
function log(){if(DEBUG)console.log.apply(console,['[cwa]'].concat([].slice.call(arguments)));}
var busyT=[];
function busy(n){   /* top bar while any request runs; a message appears if it is slow */
  var was=busyN>0,b=$('#busy');busyN+=n;var on=busyN>0;b.classList.toggle('on',on);
  if(on&&!was)busyT=[setTimeout(function(){b.setAttribute('data-msg','Still working…');},3000),setTimeout(function(){b.setAttribute('data-msg','Waking up the server. This can take a few seconds…');},9000)];
  if(!on){busyT.forEach(clearTimeout);busyT=[];b.removeAttribute('data-msg');}
}
/* skeleton placeholders: grey shapes that match the screen that is about to appear */
function skel(kind){
  var s=function(st){return '<i class="sk" style="'+st+'"></i>';},o='<div class="skel" role="status" aria-label="Loading">',i;
  var rows=function(n,cells){var r='';for(i=0;i<n;i++)r+='<div class="sk-row">'+cells+'</div>';return r;};
  if(kind==='week')o+='<div class="sk-row">'+s('width:44px;height:44px')+s('flex:1;height:44px')+s('width:80px;height:44px')+'</div>'+s('width:100%;height:44px;margin-bottom:12px')+rows(8,s('width:46px')+s('width:110px')+s('flex:1')+s('flex:1')+s('flex:1')+s('flex:1')+s('flex:1'));
  else if(kind==='admin')o+=s('width:60%;height:28px;margin-bottom:12px')+'<div class="sk-tiles">'+s('')+s('')+s('')+s('')+'</div>'+rows(5,s('flex:1;height:48px'));
  else if(kind==='cards'){for(i=0;i<4;i++)o+='<div class="sk-card">'+s('width:40%;height:18px;margin-bottom:10px')+s('width:100%;height:40px;margin-bottom:8px')+s('width:100%;height:40px;margin-bottom:8px')+s('width:100%;height:40px')+'</div>';}
  else o+=rows(6,s('flex:1;height:52px'));
  return o+'</div>';
}
function mkErr(action,msg,code,trace){var e=new Error(msg);e.action=action;e.auth=code==='AUTH';e.trace=trace;return e;}
/* transport: one POST to the Supabase Edge Function (text/plain avoids a CORS preflight) */
function rpc(action,payload){
  return fetch(window.CWA_CONFIG.API_URL,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({action:action,token:S.token,p:payload||{}})}).then(function(r){
    return r.json().catch(function(){throw new Error('Server problem (HTTP '+r.status+'). Please try again.');});
  });
}
function api(action,payload){
  var t0=Date.now();busy(1);
  return rpc(action,payload).then(function(r){
    busy(-1);log(action,r&&r.ok?'ok':'FAIL',(Date.now()-t0)+'ms',payload);
    if(r&&r.ok)return r.data;
    throw mkErr(action,(r&&r.error)||'Something went wrong.',r&&r.code,r&&r.trace);
  },function(e){busy(-1);reportErr('network',e,{action:action});throw mkErr(action,(e&&e.message)||'Network problem. Check your connection and try again.');});
}
function fail(e){
  if(e&&e.auth){C.showLogin('Your session expired. Please sign in again.');return;}
  console.error('[cwa]',(e&&e.action)||'',(e&&e.message)||e,(e&&e.trace)||'');
  toast(((e&&e.message)||String(e))+(DEBUG&&e&&e.action?'  ['+e.action+']':''),'err');
}
/* ---- crash / error reporting: captured here, saved on the server, read in the admin's Diagnostics tab ---- */
var VERSION='2026.11.06',errQ=[],errSeen={},errSent=0;
function screenName(){return S.user?S.user.role+':'+(document.querySelector('.lt')?'lessons':(S.tab||'main')):'signed-out';}
function reportErr(kind,err,extra,force){
  try{
    var msg=String((err&&err.message)||err||'Unknown error').slice(0,500),key=kind+'|'+msg,now=Date.now();
    if(!force){if(errSeen[key]&&now-errSeen[key]<30000)return;errSeen[key]=now;if(errSent>=25)return;errSent++;}   /* same error within 30 s is sent once; max 25 per page load */
    errQ.push({kind:kind,message:msg,stack:String((err&&err.stack)||'').slice(0,4000),action:(extra&&extra.action)||'',screen:screenName(),ver:VERSION,
      device:navigator.userAgent.slice(0,200)+' | '+innerWidth+'x'+innerHeight+(navigator.onLine?'':' | offline'),extra:(extra&&extra.extra)||''});
    flushErr();
  }catch(e){}
}
function flushErr(){   /* plain fetch, not api(): reporting must never show toasts or trigger more reports */
  if(!errQ.length)return;
  var batch=errQ.splice(0,10);
  fetch(window.CWA_CONFIG.API_URL,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({action:'logError',token:S.token,p:{entries:batch}})}).catch(function(){
    try{localStorage.setItem('cwa_errq',JSON.stringify(JSON.parse(localStorage.getItem('cwa_errq')||'[]').concat(batch).slice(-30)));}catch(e){}   /* offline: keep for later */
  });
}
function flushStored(){try{var q=JSON.parse(localStorage.getItem('cwa_errq')||'[]');if(q.length){localStorage.removeItem('cwa_errq');errQ=errQ.concat(q);flushErr();}}catch(e){}}
window.addEventListener('error',function(e){
  var t=e.target;
  if(t&&t!==window&&(t.src||t.href)){reportErr('resource','Failed to load '+(t.src||t.href));return;}
  console.error('[cwa] uncaught',e.message,e.filename+':'+e.lineno);
  reportErr('js',e.error||e.message,{extra:String(e.filename||'').split('/').pop()+':'+e.lineno+':'+e.colno});
},true);
window.addEventListener('unhandledrejection',function(e){
  console.error('[cwa] unhandled rejection',e.reason);if(DEBUG)toast('Unhandled: '+((e.reason&&e.reason.message)||e.reason),'err');
  reportErr('promise',e.reason);
});
window.addEventListener('online',flushStored);setTimeout(flushStored,4000);
H.reportProblem=function(){
  openSheet(shHead('Report a problem','The screen and device details are added automatically')+'<textarea class="inp" id="prbNote" rows="5" maxlength="500" placeholder="What did you tap, and what happened instead?"></textarea><div class="sh-f"><button class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn green" data-act="prbSend">Send</button></div>');
  $('#prbNote').focus();
};
H.prbSend=function(){var v=$('#prbNote').value.trim();if(!v){toast('Please describe the problem first.');return;}closeSheet();reportErr('user',v,null,true);toast('Thanks, your report was sent.','ok');};

/* ================= ui plumbing ================= */
function toast(msg,kind){
  var t=document.createElement('div');t.className='tst '+(kind||'');
  if(kind==='err'){   /* errors stay until tapped (or 20 s) so they can be read */
    t.innerHTML='<span class="tmsg"></span><b class="tx" aria-hidden="true">×</b>';
    t.querySelector('.tmsg').textContent=msg;t.setAttribute('role','alert');t.title='Tap to dismiss';
    t.addEventListener('click',function(){t.remove();});
  }else t.textContent=msg;
  var box=$('#toast');box.appendChild(t);
  while(box.children.length>3)box.firstChild.remove();
  setTimeout(function(){if(t.parentNode)t.remove();},kind==='err'?20000:2600);
}
function openSheet(html,o){
  var ov=document.createElement('div');ov.className='overlay';
  ov.innerHTML='<div class="sheet'+(o&&o.full?' full':'')+'" role="dialog" aria-modal="true">'+html+'</div>';
  ov.addEventListener('mousedown',function(e){if(e.target===ov)closeSheet();});
  document.body.appendChild(ov);document.body.classList.add('noscroll');
  return ov.firstChild;
}
function closeSheet(){
  var o=document.querySelectorAll('.overlay');if(o.length)o[o.length-1].remove();
  if(!document.querySelector('.overlay'))document.body.classList.remove('noscroll');
}
function closeAllSheets(){var o=document.querySelectorAll('.overlay');for(var i=0;i<o.length;i++)o[i].remove();document.body.classList.remove('noscroll');}
function shHead(title,sub,right){return '<div class="sh-h"><div><b>'+title+'</b>'+(sub?'<span>'+sub+'</span>':'')+'</div>'+(right||'')+'<button class="x" data-act="closeSheet" aria-label="Close">×</button></div>';}
function pill(label,act,style){return '<div class="pill"'+(style?' style="'+style+'"':'')+'><button data-act="'+act+'" data-n="-1" aria-label="Previous">‹</button><b>'+label+'</b><button data-act="'+act+'" data-n="1" aria-label="Next">›</button></div>';}
function legend(){return '<div class="legend"><span><i class="st-P">P</i>Present</span><span><i class="st-A">A</i>Absent</span><span><i class="st-L">L</i>Late</span><span><i class="st-E">E</i>Excused (counts as present)</span></div>';}
function copyText(t){
  function fb(){var a=document.createElement('textarea');a.value=t;document.body.appendChild(a);a.select();try{document.execCommand('copy');toast('Copied','ok');}catch(e){toast('Copy failed','err');}a.remove();}
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(function(){toast('Copied','ok');},fb);}else fb();
}
/* in-app confirm: window.confirm() is silently blocked in many app wrappers, so use a sheet instead */
function ask(msg,yes){
  C._ask=yes;
  openSheet(shHead('Please confirm','')+'<p style="margin:4px 0 14px;line-height:1.4">'+esc(msg)+'</p><div class="sh-f"><button class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn green" data-act="askYes">Yes</button></div>');
}
H.askYes=function(){var f=C._ask;C._ask=null;closeSheet();if(f)f();};
/* exports: Copy always works; Download and Share depend on the app wrapper */
function saveText(name,text){
  C._txt={name:name,text:text};
  openSheet(shHead('Save report',esc(name))+'<div class="hint" style="margin:0 0 8px">Tap <b>Copy</b> and paste into Excel or Google Sheets. <b>Download</b> and <b>Share</b> depend on your phone or app.</div><textarea class="inp" id="txtOut" rows="8" readonly></textarea><div class="sh-f"><button class="btn ghost" data-act="txtDl">Download</button>'+(navigator.share?'<button class="btn ghost" data-act="txtShare">Share</button>':'')+'<button class="btn green" data-act="txtCopy">Copy</button></div>');
  $('#txtOut').value=text;
}
H.txtCopy=function(){copyText(C._txt.text);};
H.txtDl=function(){var t=C._txt,a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+t.text],{type:'text/csv'}));a.download=t.name;document.body.appendChild(a);a.click();a.remove();};
H.txtShare=function(){var t=C._txt;navigator.share({title:t.name,text:t.text}).catch(function(){});};
function printHtml(html){$('#printArea').innerHTML=html;setTimeout(function(){window.print();},200);}

document.addEventListener('click',function(e){var t=e.target.closest('[data-act]');if(!t)return;var f=H[t.dataset.act];if(!f){console.error('[cwa] no handler H.'+t.dataset.act);return;}e.preventDefault();f(t,e);});
document.addEventListener('input',function(e){var t=e.target;if(t.dataset&&t.dataset.in&&IN[t.dataset.in])IN[t.dataset.in](t,e);});
document.addEventListener('change',function(e){var t=e.target;if(t.dataset&&t.dataset.ch&&CH[t.dataset.ch])CH[t.dataset.ch](t,e);});
document.addEventListener('keydown',function(e){if(e.key==='Escape'){if(document.querySelector('.overlay'))closeSheet();else H.drawClose();}});
H.closeSheet=function(){closeSheet();};

/* ================= burger menu (phones); each role passes its own item list ================= */
function drawerHtml(items){
  var u=S.user,adm=u.role==='admin';
  return '<div class="drawer" id="drawer"><div class="dr-bg" data-act="drawClose"></div><nav class="dr-pan"><div class="dr-h"><b>CWA Attendance Tracker</b><small>'+esc(adm?S.boot.org:u.name)+'</small></div><div class="dr-list">'+
    items.map(function(m){return '<button class="dr-i'+(adm&&m.t===S.tab?' on':'')+'" data-act="drawDo" data-do="'+m.doo+'"'+(m.t?' data-t="'+m.t+'"':'')+'>'+esc(m.label)+'</button>';}).join('')+
    '</div><div class="dr-f"><button class="dr-i" data-act="drawDo" data-do="logout">Sign out</button></div></nav></div>';
}
H.menu=function(){var d=$('#drawer');if(d)d.classList.add('open');};
H.drawClose=function(){var d=$('#drawer');if(d)d.classList.remove('open');};
H.drawDo=function(el){H.drawClose();var f=H[el.dataset.do];if(f)f(el);else console.error('[cwa] no handler H.'+el.dataset.do);};

/* ================= status sheet (P / A / L / E) ================= */
var MK=null;
function markSheet(cfg){
  var sh=openSheet('');
  MK={cfg:cfg,sh:sh};
  MK.draw=function(){
    var head='<div class="sh-h"><div><b>'+esc(cfg.title)+'</b><span>'+esc(cfg.sub||'')+'</span></div><button class="x" data-act="mkDone" aria-label="Close">×</button></div>';
    if(MK.ask){
      var n=MK.ask.length;
      sh.innerHTML=head+'<div class="askbox"><p>'+n+' student'+(n>1?'s are':' is')+' not marked yet:<br><span style="font-weight:500">'+MK.ask.map(function(x){return esc(x.name);}).join(', ')+'</span></p>'+
        '<button class="btn red block" data-act="mkFill" data-st="A">Mark them Absent</button>'+
        '<button class="btn green block" data-act="mkFill" data-st="P">Mark them Present</button>'+
        '<button class="btn ghost block" data-act="mkBack">Go back</button></div>';
      return;
    }
    sh.innerHTML=head+
      (cfg.students.length>1?'<button class="btn green block" data-act="mkAll" data-st="P" style="margin-bottom:6px">All present</button><div class="hint" style="margin:0 0 6px">Then tap A, L or E for anyone who was not present.</div>':'')+
      cfg.students.map(function(s){var cur=cfg.get(s.id);
        return '<div class="mk-row"><div class="mk-name">'+esc(s.name)+'</div><div class="mk-btns">'+['P','A','L','E'].map(function(k){
          return '<button class="mk'+(cur===k?' on st-'+k:'')+'" data-act="mk" data-sid="'+esc(s.id)+'" data-st="'+k+'" aria-label="'+k+'">'+k+'</button>';}).join('')+'</div></div>';}).join('')+
      (cfg.extra||'')+'<div class="sh-f"><button class="btn green" data-act="mkDone">Done</button></div>';
  };
  MK.draw();
}
H.mk=function(el){var id=el.dataset.sid,st=el.dataset.st;MK.cfg.apply([{id:id,st:MK.cfg.get(id)===st?'':st}]);MK.draw();};
H.mkAll=function(el){var st=el.dataset.st;MK.cfg.apply(MK.cfg.students.map(function(s){return {id:s.id,st:st};}));MK.draw();};
H.mkDone=function(){   /* group classes: ask before closing if anyone is still unmarked */
  var cfg=MK.cfg;
  if(cfg.students.length>1){
    var un=cfg.students.filter(function(s){return !cfg.get(s.id);});
    if(un.length){MK.ask=un;MK.draw();return;}
  }
  MK.ask=null;closeSheet();
};
H.mkFill=function(el){var un=MK.ask||[];MK.ask=null;if(un.length)MK.cfg.apply(un.map(function(s){return {id:s.id,st:el.dataset.st};}));closeSheet();};
H.mkBack=function(){MK.ask=null;MK.draw();};

/* ================= schedule grid (teacher screen + admin "Schedules") ================= */
function redraw(){if(C.render)C.render();}
/* A teacher looking at someone else's week is read-only. Admins can edit every schedule. */
function isRO(){return S.user.role==='teacher'&&T.tid!==S.user.id;}
function loadWeek(ws){
  T.ws=ws;var seq=++T.seq,vk=T.tid+'|'+ws;
  if(T.viewKey!==vk){T.undo=[];T.viewKey=vk;}   /* Undo only covers the week on screen */
  app.classList.add('wk-busy');   /* dim the current grid while the next week loads */
  return api('getTeacherWeek',{teacherId:T.tid,weekStart:ws}).then(function(d){
    if(seq!==T.seq)return;   /* a newer request replaced this one */
    app.classList.remove('wk-busy');T.data=d;S.boot.camp=d.camp;T.stu={};d.students.forEach(function(s){T.stu[s.id]=s;});setHol(d.holidays);redraw();
  }).catch(function(e){if(seq===T.seq)app.classList.remove('wk-busy');fail(e);});
}
function weekDates(){return (campOn()?[0,1,2,3,4,5]:[0,1,2,3,4]).map(function(i){return add(T.ws,i);});}
function nameOf(id){var s=T.stu[id];return s?s.name:'(removed)';}
function namesText(l){if(!l.length)return '';return l.length<=2?l.map(nameOf).join(', '):l.length+' students';}
function rowInfo(h){
  var cnt={},ids={};
  weekDates().forEach(function(d){var l=T.data.roster[d+'|'+h];if(l&&l.length){var k=l.slice().sort().join(',');cnt[k]=(cnt[k]||0)+1;ids[k]=l;}});
  var keys=Object.keys(cnt).sort(function(a,b){return cnt[b]-cnt[a];});
  return {key:keys[0]||'',ids:keys.length?ids[keys[0]]:[],varies:keys.length>1};
}
function cellInfo(d,h){
  var l=T.data.roster[d+'|'+h]||[];
  if(!l.length)return {t:'',c:''};
  var cnt={P:0,A:0,L:0,E:0},m=0,t=today();
  l.forEach(function(id){var s=T.data.att[d+'|'+h+'|'+id];if(s){cnt[s]++;m++;}});
  var fut=d>t,blank={t:'',c:fut?'fut':(d<t?'miss':'todo'),w:(!fut&&d<t)?'Not marked':''};
  if(l.length===1){var s1=T.data.att[d+'|'+h+'|'+l[0]];return s1?{t:s1,c:'st-'+s1}:blank;}
  if(!m)return blank;
  if(m<l.length)return {t:'\u26A0 '+m+'/'+l.length,c:'st-inc',w:(l.length-m)+' of '+l.length+' not marked'};
  return {t:(cnt.P+cnt.E+cnt.L)+'/'+l.length,c:cnt.A?'st-A':'st-P'};
}
function weekBar(){
  var ds=weekDates();
  return pill(mdy(ds[0])+' – '+mdy(ds[ds.length-1]),'wk')+
    (T.ws!==monday(today())?'<div class="pill-sub"><button class="mini" data-act="wkToday">Back to this week</button></div>':'');
}
function weekEmpty(){
  if(Object.keys(T.data.roster).length)return '';
  if(isRO())return '<div class="banner"><span>No schedule has been set for this week.</span></div>';
  return '<div class="banner"><span>Nothing here yet. Tap a name box to add students, or reuse last week.</span><button class="btn sm green" data-act="cwGo" data-dir="prev">Copy last week</button></div>';
}
function actionBar(){
  if(isRO())return '';
  return '<div class="acts-bar"><button class="btn green sm" data-act="allP">Mark all present</button><button class="btn ghost sm" data-act="copyMenu">Copy week</button><button class="btn ghost sm" data-act="undo"'+(T.undo.length?'':' disabled')+'>Undo</button></div>';
}
function gridHtml(){
  var ds=weekDates(),t=today(),ro=isRO();
  var o='<div class="tw"><table class="tg t-grid"><colgroup><col style="width:46px"><col>'+ds.map(function(){return '<col class="c-day" style="width:'+(ds.length>5?'12.5%':'15%')+'">';}).join('')+'</colgroup><thead><tr><th class="c-time">TIME</th><th class="c-nm" style="width:auto;text-align:center">Students names</th>'+
    ds.map(function(d){var hl=holOf(d);return '<th class="'+(d===t?'today ':'')+(isOff(d)?'off':'')+'">'+DOW[dow(d)]+'<small>'+d.slice(8)+(hl&&!isOff(d)?' ★':'')+'</small></th>';}).join('')+'</tr></thead><tbody>';
  hrs().forEach(function(h){
    if(h===13&&lunchShown())o+='<tr><td class="lunch" style="width:auto">12NN</td><td class="lunch" colspan="'+ds.length+'"></td></tr>';
    var ri=rowInfo(h),txt=namesText(ri.ids);
    o+='<tr><td class="c-time" style="font-weight:800;font-size:12px">'+HL[h]+'</td><td class="nm'+(txt?'':' none')+'" data-act="pick" data-h="'+h+'">'+(txt?esc(txt)+(ri.varies?'<span class="v">varies</span>':''):(ro?'':'+ Add student'))+'</td>'+
      ds.map(function(d){
        if(isOff(d))return '<td class="off" data-act="cell" data-d="'+d+'" data-h="'+h+'"></td>';
        var ci=cellInfo(d,h),l=T.data.roster[d+'|'+h]||[],diff=l.length&&ri.key&&l.slice().sort().join(',')!==ri.key;
        return '<td class="cell '+ci.c+(diff?' diff':'')+'"'+(ci.w?' title="'+ci.w+'"':'')+' data-act="cell" data-d="'+d+'" data-h="'+h+'">'+ci.t+'</td>';
      }).join('')+'</tr>';
  });
  return o+'</tbody></table></div>'+legend()+'<div class="hint"><b style="background:#ffd37a;padding:0 6px;border-radius:5px">\u26A0</b> = some students in a group class are not marked yet. Pink = a past hour with no attendance.</div>'+
    (ro?'<div class="hint">View only. Tap a box to see who was in that hour and how they were marked. Tap a name to see the whole week for that hour.</div>'
       :'<div class="hint">Tap a box to mark: <b>P</b> → <b>A</b> → <b>L</b> → <b>E</b> → blank. For a group class, tapping opens the list so you can mark each student. Tap a name to change who is in that hour.</div>');
}
H.wk=function(el){loadWeek(add(T.ws,7*(+el.dataset.n)));};
H.wkToday=function(){loadWeek(monday(today()));};
H.wkRefresh=function(){loadWeek(T.ws);};

/* read-only detail sheets (looking at someone else's week) */
function roCell(d,h){
  if(isOff(d)){var hl=holOf(d);toast('No class on this date'+(hl?' ('+hl.label+')':'.'));return;}
  var l=T.data.roster[d+'|'+h]||[];
  if(!l.length){toast('No students scheduled here.');return;}
  openSheet(shHead(longD(d)+' · '+HL[h],esc(T.data.teacher.name)+' · view only')+
    l.map(function(id){var st=T.data.att[d+'|'+h+'|'+id]||'';return '<div class="mk-row"><div class="mk-name">'+esc(nameOf(id))+'</div>'+(st?'<span class="tag '+st+'">'+st+'</span>':'<span class="hint" style="margin:0">Not marked</span>')+'</div>';}).join('')+
    '<div class="sh-f"><button class="btn ghost" data-act="closeSheet">Close</button></div>');
}
function roRow(h){
  var rows=weekDates().filter(function(d){return !isOff(d);}).map(function(d){
    var l=T.data.roster[d+'|'+h]||[];
    return '<div class="li"><b>'+DOW3[dow(d)]+' '+d.slice(8)+'</b><span style="text-align:right">'+(l.length?esc(l.map(nameOf).join(', ')):'<small>–</small>')+'</span></div>';
  }).join('');
  openSheet(shHead('Students at '+HL[h],esc(T.data.teacher.name)+' · view only')+'<div class="list">'+(rows||'<div class="empty">No class days this week.</div>')+'</div><div class="sh-f"><button class="btn ghost" data-act="closeSheet">Close</button></div>');
}

/* ---------- marking: tap to cycle, group sheet, mark all present, undo ---------- */
H.cell=function(el){
  var d=el.dataset.d,h=+el.dataset.h;
  if(isRO()){roCell(d,h);return;}
  if(isOff(d)){var hl=holOf(d);toast('No class on this date'+(hl?' ('+hl.label+')':'.'));return;}
  var l=T.data.roster[d+'|'+h]||[];
  if(!l.length){openPicker(h,[d],rowInfo(h).ids);return;}
  if(d>today()){toast("You can't mark a future date yet.");return;}
  if(l.length===1){cycleCell(d,h,l[0]);return;}
  openMarkT(d,h,l);
};
function openMarkT(d,h,l){
  markSheet({title:longD(d)+' · '+HL[h],sub:'Tap a status. Tap it again to clear.',
    students:l.map(function(id){return {id:id,name:nameOf(id)};}),
    get:function(id){return T.data.att[d+'|'+h+'|'+id]||'';},
    apply:function(list){applyMarks(list.map(function(x){return {date:d,hour:h,studentId:x.id,st:x.st};}));},
    extra:'<div class="sh-f"><button class="btn ghost" data-act="mkChange" data-d="'+d+'" data-h="'+h+'">Change student</button></div>'});
}
H.mkChange=function(el){var d=el.dataset.d,h=+el.dataset.h;closeSheet();openPicker(h,[d],T.data.roster[d+'|'+h]||[]);};
var saveQ=Promise.resolve();
/* saves go out one after another so fast taps always land in the order they were made */
function queueSave(entries){
  var parts=[];for(var i=0;i<entries.length;i+=150)parts.push(entries.slice(i,i+150));
  saveQ=saveQ.then(function(){
    return parts.reduce(function(p,part){return p.then(function(){return api('saveAttendance',{entries:part});});},Promise.resolve());
  }).catch(function(e){fail(e);return loadWeek(T.ws);});   /* on failure reload so the screen shows what is really saved */
  return saveQ;
}
function setAtt(d,h,id,st){var k=d+'|'+h+'|'+id;if(st)T.data.att[k]=st;else delete T.data.att[k];}
/* items: [{date,hour,studentId,st}] -> updates the screen now, saves in the background, remembers it for Undo */
function applyMarks(items){
  var changes=[];
  items.forEach(function(x){var prev=T.data.att[x.date+'|'+x.hour+'|'+x.studentId]||'';if(prev!==x.st)changes.push({date:x.date,hour:x.hour,studentId:x.studentId,prev:prev,st:x.st});});
  if(!changes.length)return;
  changes.forEach(function(c){setAtt(c.date,c.hour,c.studentId,c.st);});
  T.undo.push(changes);if(T.undo.length>30)T.undo.shift();
  redraw();
  queueSave(changes.map(function(c){return {date:c.date,hour:c.hour,studentId:c.studentId,status:c.st,teacherId:T.tid};}));
}
H.undo=function(){
  if(isRO()||!T.undo.length)return;
  var changes=T.undo.pop();
  changes.forEach(function(c){setAtt(c.date,c.hour,c.studentId,c.prev);});
  redraw();
  queueSave(changes.map(function(c){return {date:c.date,hour:c.hour,studentId:c.studentId,status:c.prev,teacherId:T.tid};}));
};
function cycleCell(d,h,id){
  var cur=T.data.att[d+'|'+h+'|'+id]||'';
  applyMarks([{date:d,hour:h,studentId:id,st:CYCLE[(CYCLE.indexOf(cur)+1)%CYCLE.length]}]);
}
var MA=null;
function allPList(d){
  var out=[],t=today(),nowH=new Date().getHours();
  hrs().forEach(function(h){
    if(d===t&&h>nowH)return;   /* hours that have not started yet are skipped */
    (T.data.roster[d+'|'+h]||[]).forEach(function(id){if(!T.data.att[d+'|'+h+'|'+id])out.push({date:d,hour:h,studentId:id,st:'P'});});
  });
  return out;
}
function drawAllP(){
  var n=allPList(MA.day).length;
  MA.sh.innerHTML=shHead('Mark all present','Only empty boxes are filled. Anything already marked stays as it is.')+
    '<div class="days"><span>Day</span>'+MA.days.map(function(d){return '<button class="dchip'+(d===MA.day?' on':'')+'" data-act="maDay" data-d="'+d+'">'+DOW3[dow(d)]+' '+d.slice(8)+'</button>';}).join('')+'</div>'+
    '<div class="remark" style="margin-top:12px">'+(n?'This will mark <b>'+n+' student hour'+(n===1?'':'s')+'</b> as Present on <b>'+longD(MA.day)+'</b>.':'Nothing to mark on '+longD(MA.day)+': every box is already marked, or no one is scheduled yet.')+(MA.day===today()?' Hours that have not started yet are skipped.':'')+'</div>'+
    '<div class="sh-f"><button class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn green" data-act="maGo"'+(n?'':' disabled')+'>Mark present</button></div>';
}
H.allP=function(){
  if(isRO())return;
  var t=today(),days=weekDates().filter(function(d){return d<=t&&!isOff(d);});
  if(!days.length){toast('No class days to mark yet this week.');return;}
  MA={days:days,day:days.indexOf(t)>-1?t:days[days.length-1]};
  MA.sh=openSheet('');drawAllP();
};
H.maDay=function(el){MA.day=el.dataset.d;drawAllP();};
H.maGo=function(){var list=allPList(MA.day);closeSheet();applyMarks(list);};

/* ---------- copy a week (either direction; only empty hours are filled) ---------- */
H.copyMenu=function(){
  if(isRO())return;
  var prev=add(T.ws,-7),next=add(T.ws,7);
  function rng(m){return mdy(m)+' – '+mdy(weekEnd(m));}
  openSheet(shHead('Copy a week','Only empty hours are filled. Hours you already set are not changed.')+
    '<button class="btn ghost block" data-act="cwGo" data-dir="prev" style="text-align:left;margin-bottom:8px">Copy last week into this week<br><small style="color:var(--mut)">'+rng(prev)+'  →  '+rng(T.ws)+'</small></button>'+
    '<button class="btn ghost block" data-act="cwGo" data-dir="next" style="text-align:left">Copy this week into next week<br><small style="color:var(--mut)">'+rng(T.ws)+'  →  '+rng(next)+'</small></button>'+
    '<div class="sh-f"><button class="btn ghost" data-act="closeSheet">Cancel</button></div>');
};
H.cwGo=function(el){
  if(isRO())return;
  var dir=el.dataset.dir,from=dir==='prev'?add(T.ws,-7):T.ws,to=dir==='prev'?T.ws:add(T.ws,7);
  closeSheet();
  api('copyWeek',{fromWeek:from,toWeek:to,teacherId:T.tid}).then(function(r){
    toast(r.copied?'Copied '+r.copied+' hour'+(r.copied===1?'':'s')+(dir==='next'?' to next week':' into this week'):'Nothing to copy: the source week is empty, or the other week is already filled.',r.copied?'ok':'');
    return loadWeek(dir==='next'&&r.copied?add(T.ws,7):T.ws);
  }).catch(fail);
};

/* ---------- student picker ---------- */
var PK=null;
H.pick=function(el){
  if(isRO()){roRow(+el.dataset.h);return;}
  var h=+el.dataset.h;
  openPicker(h,weekDates().filter(function(d){return !isOff(d);}),rowInfo(h).ids);
};
function openPicker(h,days,ids){
  PK={h:h,days:days.filter(function(d){return !isOff(d);}),sel:ids.slice(),q:''};
  PK.sh=openSheet('');drawPicker();
}
function pkChips(){return PK.sel.length?'<div class="chips">'+PK.sel.map(function(id){return '<span class="c">'+esc(nameOf(id))+'<b data-act="pkTog" data-id="'+esc(id)+'" aria-label="Remove">×</b></span>';}).join('')+'</div>':'<div class="hint" style="margin:0 0 8px">No one selected. Saving will leave this hour empty.</div>';}
function pkList(){
  var q=PK.q.trim().toLowerCase(),list=T.data.students.filter(function(s){return s.active&&(!q||s.name.toLowerCase().indexOf(q)>-1);});
  var addRow=PK.q.trim()?'<div class="prow" data-act="pkNew"><i>+</i><span><b>Add "'+esc(PK.q.trim())+'" as a new student</b></span></div>':'';
  if(!list.length)return addRow+'<div class="empty">'+(T.data.students.length?'No student matches "'+esc(PK.q)+'".':'No students yet.')+'<br>Type the full name above, then tap Add.</div>';
  return list.slice(0,80).map(function(s){var on=PK.sel.indexOf(s.id)>-1;
    return '<div class="prow'+(on?' on':'')+'" data-act="pkTog" data-id="'+esc(s.id)+'"><i>'+(on?'✓':'')+'</i><span>'+esc(s.name)+'</span><small>'+COURSE[s.course]+(s.type==='CAMP'?' · Camp':'')+'</small></div>';}).join('')+(list.length>80?'<div class="hint" style="padding:8px 12px">Keep typing to narrow the list.</div>':'')+addRow;
}
function drawPicker(){
  PK.sh.innerHTML=shHead('Students at '+HL[PK.h],'Pick one for man-to-man, or several for a group class')+
    '<div id="pkSel">'+pkChips()+'</div>'+
    '<input class="search" id="pkQ" data-in="pkq" placeholder="Search student\'s name" autocomplete="off" value="'+esc(PK.q)+'">'+
    '<div class="plist" id="pkList">'+pkList()+'</div>'+
    '<div class="days"><span>Apply to</span>'+weekDates().map(function(d){return '<button class="dchip'+(PK.days.indexOf(d)>-1?' on':'')+(isOff(d)?' dis':'')+'" data-act="pkDay" data-d="'+d+'">'+DOW3[dow(d)]+' '+d.slice(8)+'</button>';}).join('')+'</div>'+
    '<div class="sh-f"><button class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn green" data-act="pkSave">Save</button></div>';
}
IN.pkq=function(el){PK.q=el.value;$('#pkList').innerHTML=pkList();};
H.pkTog=function(el){var id=el.dataset.id,i=PK.sel.indexOf(id);if(i>-1)PK.sel.splice(i,1);else PK.sel.push(id);$('#pkSel').innerHTML=pkChips();$('#pkList').innerHTML=pkList();};
H.pkNew=function(){
  var max=S.boot.maxWeeks;
  openSheet(shHead('Add new student','An admin will verify the details later')+
    '<label class="lbl">Full name</label><input class="inp" id="nsName" value="'+esc(PK.q.trim())+'" autocomplete="off">'+
    '<label class="lbl">Course</label><select class="inp" id="nsCourse">'+courseOpts(false)+'</select>'+
    (campOn()?'<label class="lbl">Student type</label><select class="inp" id="nsType"><option value="REGULAR">Regular</option><option value="CAMP">Camp</option></select>':'')+
    '<div class="row2"><div><label class="lbl">Start date</label><input class="inp" type="date" id="nsStart" value="'+weekDates()[0]+'"></div><div><label class="lbl">Weeks (1–'+max+')</label><input class="inp" type="number" min="1" max="'+max+'" id="nsWeeks" value="4" inputmode="numeric"></div></div>'+
    '<div class="sh-f"><button class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn green" data-act="nsSave">Add student</button></div>');
};
H.nsSave=function(){
  api('addStudentT',{name:$('#nsName').value,course:$('#nsCourse').value,type:$('#nsType')?$('#nsType').value:'REGULAR',start:$('#nsStart').value,weeks:$('#nsWeeks').value}).then(function(st){
    T.data.students.push(st);T.stu[st.id]=st;PK.sel.push(st.id);PK.q='';closeSheet();drawPicker();toast('Student added','ok');
  }).catch(fail);
};
H.pkDay=function(el){var d=el.dataset.d,i=PK.days.indexOf(d);if(i>-1)PK.days.splice(i,1);else PK.days.push(d);el.classList.toggle('on');};
H.pkSave=function(){
  if(!PK.days.length){toast('Pick at least one day.','err');return;}
  var h=PK.h,days=PK.days.slice(),ids=PK.sel.slice();
  api('setRoster',{hour:h,dates:days,studentIds:ids,teacherId:T.tid}).then(function(){
    days.forEach(function(d){if(ids.length)T.data.roster[d+'|'+h]=ids.slice();else delete T.data.roster[d+'|'+h];});
    closeSheet();redraw();toast('Saved','ok');
  }).catch(fail);
};

/* ================= console self-test: CWA.selfTest() ================= */
function selfTest(){
  var ok=true;
  function eq(n,got,want){if(got!==want){ok=false;console.error('[cwa] FAIL',n,'got',got,'want',want);}}
  eq('calcEnd 4 weeks from Monday',calcEnd('2026-10-05',4),'2026-10-30');
  eq('monday of a Sunday',monday('2026-11-01'),'2026-10-26');
  eq('add across month',add('2026-02-28',1),'2026-03-01');
  eq('hour labels',HL[12]+HL[18]+HL[13]+HL[7],'12NN6PM1PM7AM');
  eq('invalid date',iso(2026,2,30),'');
  eq('monthEnd',monthEnd('2026-02-10'),'2026-02-28');
  console.log(ok?'[cwa] selfTest OK':'[cwa] selfTest FAILED');
  return ok;
}

Object.assign(C,{$:$,app:app,esc:esc,api:api,fail:fail,toast:toast,log:log,openSheet:openSheet,closeSheet:closeSheet,closeAllSheets:closeAllSheets,shHead:shHead,pill:pill,legend:legend,
  copyText:copyText,printHtml:printHtml,markSheet:markSheet,drawerHtml:drawerHtml,courseOpts:courseOpts,setBoot:setBoot,setDebug:setDebug,setHol:setHol,selfTest:selfTest,
  add:add,addMonth:addMonth,allDays:allDays,allHrs:allHrs,calcEnd:calcEnd,clamp:clamp,dow:dow,holOf:holOf,hrs:hrs,iso:iso,isOff:isOff,lastClassDay:lastClassDay,lateAbs:lateAbs,longD:longD,lunchShown:lunchShown,
  mdy:mdy,monday:monday,monthEnd:monthEnd,monthName:monthName,monthStart:monthStart,nextMonday:nextMonday,nextWd:nextWd,pd:pd,today:today,upD:upD,weekEnd:weekEnd,weekdays:weekdays,
  isRO:isRO,reportErr:reportErr,skel:skel,ask:ask,saveText:saveText,weekDates:weekDates,rowInfo:rowInfo,namesText:namesText,loadWeek:loadWeek,weekBar:weekBar,weekEmpty:weekEmpty,actionBar:actionBar,gridHtml:gridHtml});
window.CWA=C;
})();
