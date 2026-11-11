/* admin.html: admin screens. Loaded after login by the server's getModule action (admin only). */
(function(C){
'use strict';
var {S,T,H,IN,CH,$,app,esc,api,fail,toast,openSheet,closeSheet,shHead,pill,legend,markSheet,courseOpts,copyText,printHtml,drawerHtml,
  COURSE,CYCLE,DOW,DOW3,HL,
  add,addMonth,allDays,allHrs,calcEnd,clamp,dow,holOf,hrs,iso,isOff,lastClassDay,lateAbs,longD,lunchShown,mdy,monday,monthEnd,monthName,monthStart,nextMonday,nextWd,pd,today,upD,weekEnd,weekdays,
  loadWeek,weekBar,weekEmpty,actionBar,gridHtml}=C;

/* ================= shell ================= */
var TABS=[['home','Home'],['att','Attendance'],['sched','Schedules'],['lessons','Lesson Trackers'],['students','Students'],['teachers','Teachers'],['reports','Reports'],['cal','Holidays'],['settings','Settings'],['diag','Diagnostics']];
var VIEWS={};
function renderAdmin(){
  app.innerHTML='<div class="top"><div class="top-r"><div class="top-l"><button class="iconbtn burger" data-act="menu" aria-label="Open menu">☰</button><div class="brand">CWA Attendance Tracker<small>'+esc(S.boot.org)+'</small></div></div><span class="cur" id="cur"></span><button class="iconbtn so" data-act="logout">Sign out</button></div><div class="nav" id="nav">'+
    TABS.map(function(t){return '<button data-act="tab" data-t="'+t[0]+'">'+t[1]+'</button>';}).join('')+'</div></div><main id="content"></main>'+
    drawerHtml(TABS.map(function(t){return {label:t[1],doo:'tab',t:t[0]};}));
  goTab(S.tab);
}
function goTab(t){
  S.tab=t;var bs=document.querySelectorAll('#nav button');
  for(var i=0;i<bs.length;i++)bs[i].classList.toggle('on',bs[i].dataset.t===t);
  var dl=document.querySelectorAll('#drawer .dr-i[data-t]');for(var j=0;j<dl.length;j++)dl[j].classList.toggle('on',dl[j].dataset.t===t);
  var cu=$('#cur');if(cu){var ft=TABS.filter(function(x){return x[0]===t;})[0];cu.textContent=ft?ft[1]:'';}
  var c=$('#content');if(!c)return;c.innerHTML=C.skel('list');window.scrollTo(0,0);
  VIEWS[t]();
}
H.tab=function(el){goTab(el.dataset.t);};
function loadList(force){
  if(S.list&&!force)return Promise.resolve(S.list);
  return api('listStudents').then(function(d){S.list=d;return d;});
}
function content(html){var c=$('#content');if(c)c.innerHTML=html;}
function chip(status,cert){
  if(cert)return '<span class="chip c-'+(cert==='NOT ELIGIBLE'?'NOT':(cert==='ELIGIBLE'?'ELIGIBLE':'PENDING'))+'">'+cert+'</span>';
  return '<span class="chip c-'+status+'">'+status+'</span>';
}
/* date x hour record table; get(date,hour) -> status; ed = editable */
function hourHead(){var o='';hrs().forEach(function(h){if(h===13&&lunchShown())o+='<th class="lunch">12NN</th>';o+='<th>'+HL[h]+'</th>';});return o;}
function hourCells(fn){var o='';hrs().forEach(function(h){if(h===13&&lunchShown())o+='<td class="lunch"></td>';o+=fn(h);});return o;}
function hourCols(first){return '<colgroup><col style="width:'+first+'px">'+hrs().map(function(h){return (h===13&&lunchShown()?'<col style="width:30px">':'')+'<col>';}).join('')+'</colgroup>';}
function recTable(dates,get,ed){
  var o='<div class="tw"><table class="tg">'+hourCols(112)+'<thead><tr><th class="c-nm" style="width:112px">DATE</th>'+hourHead()+'</tr></thead><tbody>';
  dates.forEach(function(d){
    var hl=holOf(d);
    if(isOff(d)){o+='<tr><th class="rd">'+upD(d)+'</th><td class="off" colspan="'+(hrs().length+(lunchShown()?1:0))+'">No class'+(hl?' · '+esc(hl.label):'')+'</td></tr>';return;}
    o+='<tr><th class="rd">'+upD(d)+(hl?'<br><small>★ '+esc(hl.label)+'</small>':'')+'</th>'+hourCells(function(h){
      var st=get(d,h)||'';
      return '<td class="cell '+(st?'st-'+st:'')+'"'+(ed?' data-act="pCell" data-d="'+d+'" data-h="'+h+'"':'')+'>'+st+'</td>';
    })+'</tr>';
  });
  return o+'</tbody></table></div>';
}

/* ================= Home ================= */
VIEWS.home=function(){
  loadList(true).then(function(d){
    var act=d.students.filter(function(s){return s.active;}),n={'ON-TRACK':0,'AT-RISK':0,'OFF-TRACK':0};
    act.forEach(function(s){n[s.stats.status]++;});
    var t=today(),cls=!isOff(t),tt=d.today;
    var need=act.filter(function(s){return s.stats.status!=='ON-TRACK';}).sort(function(a,b){return a.stats.remaining-b.stats.remaining;});
    var o='<div class="stats"><div class="stat"><b>'+act.length+'</b><span>Active students</span></div><div class="stat g"><b>'+n['ON-TRACK']+'</b><span>On track</span></div><div class="stat a"><b>'+n['AT-RISK']+'</b><span>At risk</span></div><div class="stat r"><b>'+n['OFF-TRACK']+'</b><span>Not eligible</span></div></div>'+
      '<div class="card"><b>Today · '+longD(t)+'</b>'+(cls?'<div class="tsum"><span class="tag P">'+tt.P+' present</span><span class="tag A">'+tt.A+' absent</span><span class="tag L">'+tt.L+' late</span><span class="tag E">'+tt.E+' excused</span></div><div class="hint">Hours recorded so far today across all teachers.</div>':'<div class="hint" style="margin-top:6px">No class today'+(holOf(t)?' ('+esc(holOf(t).label)+')':' (weekend)')+'.</div>')+'</div>'+
      '<div id="missBox"></div><div class="ph" style="margin-top:18px"><h2>Needs attention</h2></div>';
    if(!act.length)o+='<div class="card empty"><b>No students yet</b>Add your first student or import a list.<div style="margin-top:12px"><button class="btn green" data-act="stNew">Add student</button> <button class="btn ghost" data-act="stBulk">Bulk import</button></div></div>';
    else if(!need.length)o+='<div class="card empty"><b>Everyone is on track</b>Students who are close to the absence limit will show up here.</div>';
    else o+='<div class="cards">'+need.map(stCard).join('')+'</div>';
    content(o);loadMissing();
  }).catch(fail);
};
/* past class hours where someone on the roster was never marked */
function loadMissing(){
  api('missingAttendance',{days:30}).then(function(d){
    var el=$('#missBox');if(!el||S.tab!=='home')return;
    if(!d.total){el.innerHTML='<div class="ph" style="margin-top:18px"><h2>Missing attendance</h2></div><div class="card empty" style="padding:16px"><b>All caught up</b>Every past class hour in the last '+d.days+' days has attendance for everyone on the roster.</div>';return;}
    el.innerHTML='<div class="ph" style="margin-top:18px"><h2>Missing attendance</h2><span class="chip c-AT-RISK">'+d.total+' class hour'+(d.total===1?'':'s')+'</span></div><div class="card list">'+
      d.slots.map(function(x){return '<div class="li" style="align-items:flex-start"><div><b>'+longD(x.date)+' · '+HL[x.hour]+'</b><small>'+esc(x.teacher)+'</small></div><div class="acts" style="justify-content:flex-end">'+
        x.students.map(function(st){return '<button class="mini" data-act="missOpen" data-id="'+esc(st.id)+'" data-d="'+x.date+'">'+esc(st.name)+'</button>';}).join('')+'</div></div>';}).join('')+
      (d.total>d.slots.length?'<div class="hint" style="padding:8px 4px">Showing the latest '+d.slots.length+' of '+d.total+'.</div>':'')+'</div><div class="hint">Last '+d.days+' days. Tap a name to open that day and fix the record.</div>';
  }).catch(function(e){console.error('[cwa] missingAttendance',e);});
}
H.missOpen=function(el){openProfile(el.dataset.id,'day',el.dataset.d);};

/* ================= Students ================= */
var SF={q:'',f:'active'};
function stCard(s){
  var t=s.stats,pct=t.allowed?Math.min(100,Math.round(t.absent/t.allowed*100)):0,st=s.active?t.status:'ARCH';
  return '<div class="scard" data-act="prof" data-id="'+esc(s.id)+'"><div class="sc-top"><b>'+esc(s.name)+'</b><span class="chip c-'+st+'">'+(s.active?t.status:'ARCHIVED')+'</span></div>'+
    '<div class="sc-sub">'+COURSE[s.course]+(s.type==='CAMP'?' · <b class="camptag">Camp</b>':'')+' · '+s.weeks+' wk'+(s.weeks>1?'s':'')+' · '+mdy(s.start)+' to '+mdy(s.end)+'</div>'+
    '<div class="meter '+t.status+'"><i style="width:'+pct+'%"></i></div>'+
    '<div class="sc-nums"><span>'+t.absent+' of '+t.allowed+' absent hrs used</span><button class="mini" data-act="stEdit" data-id="'+esc(s.id)+'">Edit</button></div></div>';
}
function stFiltered(){
  var q=SF.q.trim().toLowerCase();
  return S.list.students.filter(function(s){
    if(q&&s.name.toLowerCase().indexOf(q)<0)return false;
    if(SF.f==='archived')return !s.active;
    if(!s.active)return false;
    if(SF.f==='camp')return s.type==='CAMP';
    if(SF.f==='regular')return s.type!=='CAMP';
    if(SF.f==='risk')return s.stats.status==='AT-RISK';
    if(SF.f==='off')return s.stats.status==='OFF-TRACK';
    return true;
  });
}
function drawStList(){
  var l=stFiltered();
  $('#stList').innerHTML=l.length?l.map(stCard).join(''):'<div class="empty" style="grid-column:1/-1"><b>'+(S.list.students.length?'No students found':'No students yet')+'</b>'+(S.list.students.length?'Try a different search or filter.':'Add one, or import many at once.')+'</div>';
}
VIEWS.students=function(){
  loadList(true).then(function(){
    content('<div class="ph"><h2>Students</h2><div class="acts"><button class="btn green sm" data-act="stNew">+ Add student</button><button class="btn ghost sm" data-act="stBulk">Bulk import</button></div></div>'+
      '<div class="bars"><input class="search" data-in="stq" placeholder="Search student\'s name" value="'+esc(SF.q)+'"><select class="inp" data-ch="stf"><option value="active">Active</option><option value="camp">Camp students</option><option value="regular">Regular students</option><option value="risk">At risk</option><option value="off">Not eligible</option><option value="archived">Archived</option></select></div><div class="cards" id="stList"></div>');
    $('select[data-ch="stf"]').value=SF.f;drawStList();
  }).catch(fail);
};
IN.stq=function(el){SF.q=el.value;drawStList();};
CH.stf=function(el){SF.f=el.value;drawStList();};
H.stNew=function(){openStudentForm(null);};
H.stEdit=function(el){var s=S.list.students.filter(function(x){return x.id===el.dataset.id;})[0];if(s)openStudentForm(s);};
function afterStudentChange(){S.list=null;if(P&&P.sh&&document.body.contains(P.sh))loadProfile();if(S.tab==='students'||S.tab==='home')VIEWS[S.tab]();}
var SFM=null;
function openStudentForm(s){
  var isNew=!s,max=S.boot.maxWeeks;s=s||{name:'',course:'STANDARD',type:'REGULAR',start:nextMonday(),weeks:4,notes:'',active:true};
  SFM={id:s.id||'',custom:!isNew&&!!s.end&&s.end!==calcEnd(s.start,s.weeks)};
  openSheet(shHead(isNew?'Add student':'Edit student','Fill in the details below')+
    '<label class="lbl">Full name</label><input class="inp" id="sfName" value="'+esc(s.name)+'" autocomplete="off">'+
    '<label class="lbl">Course</label><select class="inp" id="sfCourse" data-ch="sfc">'+courseOpts(true)+'</select>'+
    '<label class="lbl">Student type</label><select class="inp" id="sfType"><option value="REGULAR">Regular</option><option value="CAMP">Camp</option></select>'+
    '<div class="row2"><div><label class="lbl">Start date</label><input class="inp" type="date" id="sfStart" data-in="sfd" value="'+s.start+'"></div><div><label class="lbl">Weeks (1–'+max+')</label><input class="inp" type="number" min="1" max="'+max+'" id="sfWeeks" data-in="sfd" value="'+s.weeks+'" inputmode="numeric"></div></div>'+
    '<label class="lbl">End date <span id="sfAuto" style="font-weight:500"></span></label><input class="inp" type="date" id="sfEnd" data-in="sfend" value="'+(s.end||'')+'">'+
    '<div class="remark" id="sfInfo" style="margin-top:12px"></div>'+
    '<label class="lbl">Notes (optional)</label><input class="inp" id="sfNotes" value="'+esc(s.notes)+'">'+
    (isNew?'':'<label class="sw"><input type="checkbox" id="sfActive"'+(s.active?' checked':'')+'> Active student</label>')+
    '<div class="sh-f"><button class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn green" data-act="sfSave">Save student</button></div>');
  $('#sfCourse').value=s.course;$('#sfType').value=s.type==='CAMP'?'CAMP':'REGULAR';sfInfo();
}
function sfInfo(recalc){
  var pol=S.boot.policy[$('#sfCourse').value],max=S.boot.maxWeeks,st=$('#sfStart').value,wEl=$('#sfWeeks'),el=$('#sfInfo');
  if(SFM.custom){
    var en=$('#sfEnd').value;
    if(recalc===true&&st&&en&&en>=st)wEl.value=Math.ceil(((pd(en)-pd(st))/864e5+1)/7);   /* weeks come from the dates */
    wEl.readOnly=true;
  }else wEl.readOnly=false;
  var w=Math.floor(+wEl.value);
  if(SFM.custom&&st&&$('#sfEnd').value&&$('#sfEnd').value<st){el.textContent='The end date is before the start date.';return;}
  if(!st||!(w>=1)){el.textContent='Enter a start date and the number of weeks.';return;}
  if(w>max){el.textContent='That is more than '+max+' weeks. Please shorten the end date.';return;}
  if(!SFM.custom)$('#sfEnd').value=calcEnd(st,w);
  $('#sfAuto').innerHTML=SFM.custom?'· weeks are calculated from the dates <button type="button" class="mini" data-act="sfAuto">Use automatic</button>':'· automatic from start date and weeks';
  el.innerHTML='Ends <b>'+mdy($('#sfEnd').value)+'</b> · <b>'+w+' week'+(w>1?'s':'')+'</b> · needs <b>'+(w*pol.hoursPerWeek)+' hrs</b> · up to <b>'+(w*pol.absencesPerWeek)+' absent hrs</b> allowed ('+pol.absencesPerWeek+' per week, based on weeks)';
}
IN.sfend=function(){SFM.custom=!!$('#sfEnd').value;sfInfo(true);};
H.sfAuto=function(){SFM.custom=false;sfInfo();};
IN.sfd=function(){sfInfo(true);};CH.sfc=function(){sfInfo();};
H.sfSave=function(){
  var body={id:SFM.id||undefined,name:$('#sfName').value,course:$('#sfCourse').value,type:$('#sfType').value,start:$('#sfStart').value,weeks:$('#sfWeeks').value,end:$('#sfEnd').value,notes:$('#sfNotes').value};
  if($('#sfActive'))body.active=$('#sfActive').checked;
  api('saveStudent',body).then(function(){closeSheet();toast('Student saved','ok');afterStudentChange();}).catch(fail);
};

/* bulk import. Only the name is required; after it these can appear in any order:
   course (Standard/Intensive), Camp/Regular, start date, end date, weeks, notes. Defaults: Standard, next Monday, 4 weeks. */
var BS=null;
H.stBulk=function(){
  BS={rows:[]};
  openSheet(shHead('Bulk import students','Paste from Excel or Google Sheets, or upload a CSV')+
    '<div class="hint" style="margin:0 0 8px">One student per line. Only the <b>Name</b> is required. Optional extras: <b>Course</b> (Standard/Intensive), <b>Camp</b> (for camp students), <b>Start date</b>, <b>End date</b>, <b>Weeks</b>. Missing values default to Standard, next Monday, and 4 weeks. Dates like 10/05/2026 are read as month/day/year.</div>'+
    '<textarea class="inp" id="bsText" placeholder="John Wick&#10;Bruce Wayne\tIntensive\t10/12/2026\t8"></textarea>'+
    '<div class="acts" style="margin-top:8px"><input type="file" id="bsFile" accept=".csv,.txt,.tsv" data-ch="bsFile"><button class="mini" data-act="bsExample">Insert example</button></div>'+
    '<div id="bsOut"></div><div class="sh-f"><button class="btn ghost" data-act="bsParse">Check list</button><button class="btn green" data-act="bsGo" id="bsGo" disabled>Import</button></div>');
};
H.bsExample=function(){$('#bsText').value='John Wick\nBruce Wayne\tIntensive\t10/12/2026\t8\nClark Kent\tStandard\t10/05/2026\t10/30/2026';};
CH.bsFile=function(el){var f=el.files[0];if(!f)return;var r=new FileReader();r.onload=function(){$('#bsText').value=String(r.result);H.bsParse();};r.readAsText(f);};
function splitLine(l){
  if(l.indexOf('\t')>-1)return l.split('\t').map(function(x){return x.trim();});
  var o=[],cur='',q=false;
  for(var i=0;i<l.length;i++){var ch=l[i];if(ch==='"'){q=!q;}else if(ch===','&&!q){o.push(cur.trim());cur='';}else cur+=ch;}
  o.push(cur.trim());return o;
}
function parseDate(x){
  x=String(x||'').trim();var m;
  if((m=x.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/)))return iso(+m[1],+m[2],+m[3]);
  if((m=x.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})$/))){var y=+m[3];if(y<100)y+=2000;return iso(y,+m[1],+m[2]);}
  var d=new Date(x);return isNaN(d.getTime())?'':iso(d.getFullYear(),d.getMonth()+1,d.getDate());
}
H.bsParse=function(){
  var lines=$('#bsText').value.split(/\r?\n/).filter(function(l){return l.trim();}),rows=[],def=nextMonday(),max=S.boot.maxWeeks;
  lines.forEach(function(l,i){
    var c=splitLine(l);
    if(i===0&&/^(student'?s?\s*)?name\b/i.test(c[0]))return; // header row
    var r={name:c[0]||'',course:'STANDARD',start:'',weeks:4,notes:''},err='',dates=[],weeksSet=false,notes=[];
    for(var j=1;j<c.length;j++){
      var x=(c[j]||'').trim();if(!x)continue;
      if(/^(camp|regular)$/i.test(x))r.type=/^c/i.test(x)?'CAMP':'REGULAR';
      else if(/^(standard|intensive|std|int)$/i.test(x))r.course=/^i/i.test(x)?'INTENSIVE':'STANDARD';
      else if(/^\d{1,2}$/.test(x)){r.weeks=+x;weeksSet=true;}
      else if(/\d/.test(x)&&/[-\/]/.test(x)){var dd=parseDate(x);if(dd)dates.push(dd);else err=err||'Date not understood';}
      else notes.push(x);
    }
    r.notes=notes.join(' ');
    r.start=dates[0]||def;
    if(dates[1]){
      if(dates[1]<r.start)err=err||'End date is before start date';
      else{r.end=dates[1];if(!weeksSet)r.weeks=Math.ceil(((pd(r.end)-pd(r.start))/864e5+1)/7);}
    }
    if(!r.name)err=err||'Name is missing';
    else if(!(r.weeks>=1&&r.weeks<=max))err=err||'Weeks must be 1–'+max;
    r.err=err;rows.push(r);
  });
  BS.rows=rows;var ok=rows.filter(function(r){return !r.err;}).length;
  $('#bsOut').innerHTML=rows.length?'<div class="tw" style="margin-top:10px;max-height:240px;overflow:auto"><table class="rt" style="min-width:0"><tr><th>Name</th><th>Course</th><th>Start</th><th>Wks</th><th></th></tr>'+rows.map(function(r){return '<tr><td>'+esc(r.name)+'</td><td>'+COURSE[r.course]+'</td><td>'+(r.start?mdy(r.start):'')+'</td><td class="n">'+(r.weeks||'')+'</td><td style="color:'+(r.err?'var(--danger)':'var(--p-fg)')+';font-weight:700">'+(r.err||'OK')+'</td></tr>';}).join('')+'</table></div><div class="hint">'+ok+' of '+rows.length+' ready to import.</div>':'<div class="hint">Nothing to import yet.</div>';
  $('#bsGo').disabled=!ok;$('#bsGo').textContent=ok?'Import '+ok+' student'+(ok>1?'s':''):'Import';
};
H.bsGo=function(){
  var rows=BS.rows.filter(function(r){return !r.err;});
  api('bulkAddStudents',{rows:rows}).then(function(r){
    closeSheet();S.list=null;
    toast('Added '+r.added+' student'+(r.added===1?'':'s')+(r.skipped.length?' · skipped '+r.skipped.length:''),r.added?'ok':'err');
    if(r.skipped.length)openSheet(shHead('Skipped rows','These were not imported')+'<div class="list">'+r.skipped.map(function(x){return '<div class="li"><div>'+esc(x.name||'(no name)')+'<small>Row '+x.line+'</small></div><span class="chip c-OFF-TRACK">'+esc(x.reason)+'</span></div>';}).join('')+'</div>');
    if(S.tab==='students'||S.tab==='home')VIEWS[S.tab]();
  }).catch(fail);
};

/* ================= Student profile ================= */
var P=null;
H.prof=function(el){openProfile(el.dataset.id);};
function openProfile(id,view,anchor){
  P={id:id,view:view||'month',anchor:anchor||null,rec:null,map:{}};
  P.sh=openSheet(C.skel('list'),{full:true});
  loadProfile(true);
}
function loadProfile(first){
  return api('getStudentRecord',{id:P.id}).then(function(r){
    P.rec=r;P.map={};r.rows.forEach(function(x){P.map[x[0]+'|'+x[1]]=x[2];});
    if(!P.anchor){var s=r.student;P.anchor=clamp(today(),s.start,s.end);}
    drawProfile();
  }).catch(function(e){if(first)closeSheet();fail(e);});
}
function profRange(){
  var a=P.anchor,s=P.rec.student;
  if(P.view==='day')return [a,a];
  if(P.view==='week'){var m=monday(a);return [m,weekEnd(m)];}
  if(P.view==='month')return [monthStart(a),monthEnd(a)];
  return [s.start,s.end];
}
function profLabel(){
  var a=P.anchor;
  if(P.view==='day')return mdy(a);
  if(P.view==='week'){var m=monday(a);return mdy(m)+' – '+mdy(weekEnd(m));}
  if(P.view==='month')return monthName(a);
  return mdy(P.rec.student.start)+' – '+mdy(P.rec.student.end);
}
function idCard(r){
  var s=r.student,t=r.stats;
  return '<div class="idcard"><div class="idn">'+esc(s.name)+(s.active?'':' (archived)')+'</div><div class="idg"><div><span>Course</span><b>'+COURSE[s.course]+'</b></div><div><span>Status</span><b class="tx-'+t.status+'">'+t.status+'</b></div><div><span>Cert. eligibility</span><b>'+(t.cert||'PENDING')+'</b></div><div><span>Start date</span><b>'+mdy(s.start)+'</b></div><div><span>End date</span><b>'+mdy(s.end)+'</b></div></div></div>';
}
function tiles(t){
  var pct=t.allowed?Math.min(100,Math.round(t.absent/t.allowed*100)):0;
  return '<div class="tiles"><div class="tile"><b>'+t.absent+' / '+t.allowed+'</b><span>Absent hrs used</span><div class="meter '+t.status+'" style="margin-top:6px"><i style="width:'+pct+'%"></i></div></div><div class="tile"><b>'+t.attended+' / '+t.required+'</b><span>Hrs attended</span></div><div class="tile"><b>'+t.late+'</b><span>Late hrs'+(t.lateAbs&&!S.boot.lateAbsent?' ('+t.lateAbs+' counted absent)':'')+'</span></div><div class="tile"><b>'+t.excused+'</b><span>Excused hrs</span></div></div>';
}
function drawProfile(){
  var r=P.rec,rg=profRange(),dates=weekdays(rg[0],rg[1]);
  P.sh.innerHTML=shHead('Student record','Tap a box to change it: P → A → L → E → blank','<div class="acts" style="margin-left:auto"><button class="btn ghost sm" data-act="pPrint">Print / PDF</button><button class="btn ghost sm" data-act="pEdit">Edit student</button></div>')+
    idCard(r)+'<div class="remark">'+esc(r.remark)+'</div>'+tiles(r.stats)+
    '<div class="seg" id="pseg">'+[['day','Day'],['week','Week'],['month','Month'],['course','Whole course']].map(function(v){return '<button data-act="pView" data-v="'+v[0]+'" class="'+(P.view===v[0]?'on':'')+'">'+v[1]+'</button>';}).join('')+'</div>'+
    '<button class="btn green sm" data-act="pAllP" style="margin-left:10px">Mark all as Present</button>'+
    '<div class="pnav">'+(P.view==='course'?'':pill(profLabel(),'pNav'))+'</div>'+
    (dates.length?recTable(dates,function(d,h){return P.map[d+'|'+h];},true):'<div class="empty">No class days in this range.</div>')+legend();
}
H.pView=function(el){P.view=el.dataset.v;drawProfile();};
H.pNav=function(el){
  var n=+el.dataset.n;
  if(P.view==='day')P.anchor=nextWd(P.anchor,n);
  else if(P.view==='week')P.anchor=add(P.anchor,7*n);
  else P.anchor=addMonth(P.anchor,n);
  drawProfile();
};
H.pEdit=function(){openStudentForm(P.rec.student);};
var pQ=Promise.resolve(),pPend=0;
H.pCell=function(el){   /* tap to cycle blank > P > A > L > E > blank, same as the other attendance screens */
  var d=el.dataset.d,h=+el.dataset.h,s=P.rec.student,k=d+'|'+h,cur=P.map[k]||'',st=CYCLE[(CYCLE.indexOf(cur)+1)%CYCLE.length];
  if(st)P.map[k]=st;else delete P.map[k];
  drawProfile();
  pPend++;   /* saves go out in order; reload only when the last one is done (also reverts the screen if a save failed) */
  pQ=pQ.then(function(){return api('saveAttendance',{entries:[{date:d,hour:h,studentId:s.id,status:st}]});}).catch(fail).then(function(){if(--pPend===0){S.list=null;return loadProfile();}});
};
H.pPrint=function(){
  var r=P.rec,rg=profRange(),dates=weekdays(rg[0],rg[1]);
  printHtml('<div class="pr">'+idCard(r)+'<p><b>Remarks:</b> '+esc(r.remark)+'</p>'+tiles(r.stats)+'<p><b>'+profLabel()+'</b></p>'+recTable(dates,function(d,h){return P.map[d+'|'+h];},false)+legend()+'<p style="color:#64747e;font-size:12px">Printed '+mdy(today())+'</p></div>');
};
/* Mark all as Present: fills only EMPTY class hours, up to today. */
H.pAllP=function(){
  var s=P.rec.student,rg=profRange(),from=clamp(rg[0],s.start,s.end),to=clamp(rg[1],s.start,s.end),t=today();
  if(to>t)to=t;
  if(from>to){toast('Nothing to mark: this range is in the future or outside the course dates.','err');return;}
  P.mark={from:from,to:to,perDay:Math.round(P.rec.stats.hoursPerWeek/5)};
  openSheet(shHead('Mark all as Present',esc(s.name)+' · '+profLabel())+
    '<div class="remark" id="pmInfo">Checking…</div>'+
    '<label class="lbl">Class hours per day</label><input class="inp" type="number" min="1" max="8" id="pmPer" data-in="pmper" value="'+P.mark.perDay+'" inputmode="numeric">'+
    '<div class="hint">Default is '+P.mark.perDay+' for '+COURSE[s.course]+' ('+P.rec.stats.hoursPerWeek+' hrs a week), so attended hours do not go over the course hours. Hours already marked count toward this number. Weekends, holidays, future dates and anything already marked (P, A, L or E) are left as they are.</div>'+
    '<div class="sh-f"><button class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn green" id="pmGo" data-act="pmGo" disabled>Mark present</button></div>');
  pMarkPreview();
};
IN.pmper=function(el){var v=Math.floor(+el.value);if(v>=1&&v<=8){P.mark.perDay=v;pMarkPreview();}};
function pMarkPreview(){
  var m=P.mark;
  api('markAllPresent',{id:P.id,from:m.from,to:m.to,perDay:m.perDay,dry:true}).then(function(r){
    var info=$('#pmInfo'),go=$('#pmGo');if(!info||!go)return;
    m.n=r.marked;
    info.innerHTML=r.marked?'This will mark <b>'+r.marked+' empty class hour'+(r.marked===1?'':'s')+'</b> as Present over <b>'+r.days+' day'+(r.days===1?'':'s')+'</b>, from '+mdy(m.from)+' to '+mdy(m.to)+'.':'There are no empty class hours to mark from '+mdy(m.from)+' to '+mdy(m.to)+'.';
    go.disabled=!r.marked;go.textContent=r.marked?'Mark '+r.marked+' hour'+(r.marked===1?'':'s')+' present':'Mark present';
  }).catch(fail);
}
H.pmGo=function(){
  var m=P.mark;$('#pmGo').disabled=true;
  api('markAllPresent',{id:P.id,from:m.from,to:m.to,perDay:m.perDay}).then(function(r){
    closeSheet();S.list=null;toast('Marked '+r.marked+' hour'+(r.marked===1?'':'s')+' present','ok');loadProfile();
  }).catch(fail);
};

/* ================= Attendance (daily / weekly / monthly) ================= */
var AT={mode:'day',date:null,q:'',data:null,map:{},undo:[],viewKey:''};
function attRange(){
  if(AT.mode==='day')return [AT.date,AT.date];
  if(AT.mode==='week'){var m=monday(AT.date);return [m,weekEnd(m)];}
  return [monthStart(AT.date),monthEnd(AT.date)];
}
function attLabel(){
  if(AT.mode==='day')return mdy(AT.date);
  if(AT.mode==='week'){var m=monday(AT.date);return mdy(m)+' – '+mdy(weekEnd(m));}
  return monthName(AT.date);
}
VIEWS.att=function(){if(!AT.date)AT.date=lastClassDay(today());loadAtt();};
function loadAtt(){
  var r=attRange(),vk=AT.mode+'|'+r.join('|');
  if(AT.viewKey!==vk){AT.undo=[];AT.viewKey=vk;}   /* Undo only covers the view on screen */
  return api('getAttendanceRange',{from:r[0],to:r[1]}).then(function(d){
    AT.data=d;AT.map={};d.rows.forEach(function(x){AT.map[x[2]+'|'+x[0]+'|'+x[1]]=x[3];});
    if(S.tab==='att')drawAtt();
  }).catch(fail);
}
function drawAtt(){
  content('<div class="ph"><h2>Attendance</h2><div class="seg">'+[['day','Daily'],['week','Weekly'],['month','Monthly']].map(function(m){return '<button data-act="attMode" data-m="'+m[0]+'" class="'+(AT.mode===m[0]?'on':'')+'">'+m[1]+'</button>';}).join('')+'</div></div>'+
    '<div class="bars"><input class="search" data-in="attq" placeholder="Search student\'s name" value="'+esc(AT.q)+'">'+pill(attLabel(),'attNav','flex:0 1 330px;margin:0')+'<button class="btn ghost sm" data-act="attToday">Today</button>'+(AT.mode==='day'?'<button class="btn ghost sm" id="aUndo" data-act="aUndo"'+(AT.undo.length?'':' disabled')+'>Undo</button>':'')+'</div><div id="attBody"></div>');
  drawAttBody();
}
function attStudents(){
  var r=attRange(),q=AT.q.trim().toLowerCase(),has={};
  AT.data.rows.forEach(function(x){has[x[2]]=1;});
  return AT.data.students.filter(function(s){
    if(q&&s.name.toLowerCase().indexOf(q)<0)return false;
    if(has[s.id])return true;
    return s.active&&s.start<=r[1]&&s.end>=r[0];
  });
}
function hrCounts(sid,dates){
  var c={P:0,A:0,L:0,E:0};
  dates.forEach(function(d){allHrs().forEach(function(h){var st=AT.map[sid+'|'+d+'|'+h];if(st)c[st]++;});});
  return c;
}
function nameTh(s,act){return '<th class="c-nm" data-act="'+act+'" data-id="'+esc(s.id)+'" title="'+esc(s.name)+'">'+esc(s.name.toUpperCase())+'</th>';}
function drawAttBody(){
  var list=attStudents(),o='';
  if(!list.length){$('#attBody').innerHTML='<div class="card empty"><b>No students to show</b>'+(AT.q?'Try a different name.':'Students appear here while their course is running.')+'</div>';return;}
  if(AT.mode==='day'){
    var d=AT.date,hl=holOf(d);
    if(isOff(d))o+='<div class="banner">No class on this day'+(hl?' · '+esc(hl.label):'')+'. You can still correct records if needed.</div>';
    o+='<div class="tw"><table class="tg dg">'+hourCols(150)+'<thead><tr><th class="c-nm">NAME OF STUDENTS</th>'+hourHead()+'</tr></thead><tbody>'+
      list.map(function(s){return '<tr>'+nameTh(s,'prof2')+hourCells(function(h){var st=AT.map[s.id+'|'+d+'|'+h]||'';return '<td class="cell '+(st?'st-'+st:'')+'" data-act="aCell" data-id="'+esc(s.id)+'" data-d="'+d+'" data-h="'+h+'">'+st+'</td>';})+'</tr>';}).join('')+'</tbody></table></div>'+legend()+'<div class="hint">Tap a box to change it: <b>P</b> → <b>A</b> → <b>L</b> → <b>E</b> → blank. Tap a name to open the student.</div>';
  }else if(AT.mode==='week'){
    var ds=weekdays(monday(AT.date),weekEnd(monday(AT.date)));
    o+='<div class="tw"><table class="tg"><colgroup><col style="width:150px">'+ds.map(function(){return '<col>';}).join('')+'</colgroup><thead><tr><th class="c-nm">NAME OF STUDENTS</th>'+ds.map(function(d){return '<th data-act="attDay" data-d="'+d+'" style="cursor:pointer" class="'+(isOff(d)?'off':'')+'">'+DOW[dow(d)]+'<small>'+d.slice(8)+'</small></th>';}).join('')+'</tr></thead><tbody>'+
      list.map(function(s){return '<tr>'+nameTh(s,'prof2')+ds.map(function(d){
        if(isOff(d))return '<td class="off">–</td>';
        var c=hrCounts(s.id,[d]),bad=c.A+(S.boot.lateAbsent?c.L:0),good=c.P+c.E+(S.boot.lateAbsent?0:c.L);
        return '<td class="cell '+(bad?'st-A':(good?'st-P':''))+'" data-act="attDay" data-d="'+d+'" title="P '+c.P+' · A '+c.A+' · L '+c.L+' · E '+c.E+'">'+(bad?bad+'A':(good?good+'P':''))+'</td>';}).join('')+'</tr>';}).join('')+'</tbody></table></div><div class="hint">Numbers are class hours. Tap a day to open the daily view.</div>';
  }else{
    var md=allDays(monthStart(AT.date),monthEnd(AT.date));
    o+='<div class="tw"><table class="tg"><colgroup><col style="width:150px"><col><col><col><col><col></colgroup><thead><tr><th class="c-nm">NAME OF STUDENTS</th><th>Present</th><th>Excused</th><th>Late</th><th>Absent</th><th>Rate</th></tr></thead><tbody>'+
      list.map(function(s){var c=hrCounts(s.id,md),tot=c.P+c.A+c.L+c.E,la=lateAbs(c.L),good=c.P+c.E+c.L-la,ab=c.A+(S.boot.lateAbsent?0:la);
        return '<tr>'+nameTh(s,'prof3')+'<td>'+c.P+'</td><td>'+c.E+'</td><td>'+c.L+'</td><td class="'+(ab?'st-A':'')+'" style="font-weight:800">'+ab+'</td><td>'+(tot?Math.round(good/tot*100)+'%':'–')+'</td></tr>';}).join('')+'</tbody></table></div><div class="hint">Class hours recorded in '+monthName(AT.date)+'.'+(S.boot.lateThree&&!S.boot.lateAbsent?' Every '+S.boot.latePerAbsent+' lates count as 1 absent.':'')+' Tap a name for the full record.</div>';
  }
  $('#attBody').innerHTML=o;
}
IN.attq=function(el){AT.q=el.value;drawAttBody();};
H.attMode=function(el){AT.mode=el.dataset.m;loadAtt();};
H.attNav=function(el){
  var n=+el.dataset.n;
  if(AT.mode==='day')AT.date=nextWd(AT.date,n);else if(AT.mode==='week')AT.date=add(AT.date,7*n);else AT.date=addMonth(AT.date,n);
  loadAtt();
};
H.attToday=function(){AT.date=lastClassDay(today());loadAtt();};
H.attDay=function(el){AT.mode='day';AT.date=el.dataset.d;loadAtt();};
H.prof2=function(el){openProfile(el.dataset.id,'day',AT.date);};
H.prof3=function(el){openProfile(el.dataset.id,'month',AT.date);};
H.aCell=function(el){   /* tap to cycle, same as the teacher screen */
  var id=el.dataset.id,d=el.dataset.d,h=+el.dataset.h,cur=AT.map[id+'|'+d+'|'+h]||'';
  atMark([{id:id,date:d,hour:h,prev:cur,st:CYCLE[(CYCLE.indexOf(cur)+1)%CYCLE.length]}]);
};
var atQ=Promise.resolve();
function atSave(items,key){   /* saves go out in order; key = 'st' (new) or 'prev' (undo) */
  var entries=items.map(function(c){return {date:c.date,hour:c.hour,studentId:c.id,status:c[key]};});
  atQ=atQ.then(function(){return api('saveAttendance',{entries:entries});}).catch(function(e){fail(e);return loadAtt();});
}
function atSet(c,key){var k=c.id+'|'+c.date+'|'+c.hour;if(c[key])AT.map[k]=c[key];else delete AT.map[k];}
function atBtn(){var b=$('#aUndo');if(b)b.disabled=!AT.undo.length;}
function atMark(changes){
  changes.forEach(function(c){atSet(c,'st');});
  AT.undo.push(changes);if(AT.undo.length>30)AT.undo.shift();
  S.list=null;drawAttBody();atBtn();atSave(changes,'st');
}
H.aUndo=function(){
  if(!AT.undo.length)return;
  var changes=AT.undo.pop();
  changes.forEach(function(c){atSet(c,'prev');});
  S.list=null;drawAttBody();atBtn();atSave(changes,'prev');
};

/* ================= Schedules (check and edit any teacher's week; the grid lives in shared.html) ================= */
/* ---------- diagnostics: health check + error log ---------- */
var DG={rows:[]};
VIEWS.diag=function(){
  content('<div class="ph"><h2>Diagnostics</h2></div>'+
    '<div class="card" style="padding:14px;margin-bottom:12px"><b>Health check</b><p class="hint" style="margin:4px 0 10px">Scans the data for broken links, duplicates and setup problems.</p><button class="btn green" data-act="dgScan">Run scan</button><div id="dgScan" style="margin-top:10px"></div></div>'+
    '<div class="card" style="padding:14px"><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px"><b style="flex:1">Error log</b><button class="btn ghost sm" data-act="dgCopy">Copy / Save</button><button class="btn ghost sm" data-act="dgClear">Clear</button></div><div id="dgLog">'+C.skel('list')+'</div></div>');
  H.dgLoad();
};
function dgTime(t){try{return new Date(t).toLocaleString('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});}catch(e){return String(t);}}
H.dgLoad=function(){
  api('listErrors',{limit:100}).then(function(rows){
    DG.rows=rows;var el=$('#dgLog');if(!el)return;
    el.innerHTML=rows.length?rows.map(function(r){
      return '<details style="border-top:1px solid var(--line);padding:8px 0"><summary style="cursor:pointer"><b>'+esc(r.kind)+'</b> · '+esc(dgTime(r.created_at))+'<br><span>'+esc(r.message)+'</span><br><small style="color:var(--mut)">'+esc([r.screen,r.user_role&&(r.user_role+(r.user_id?' '+r.user_id:'')),r.action,r.app_ver].filter(Boolean).join(' · '))+'</small></summary>'+
        '<pre style="white-space:pre-wrap;font-size:11px;margin:6px 0 0">'+esc([r.stack,r.device,r.extra].filter(Boolean).join('\n'))+'</pre></details>';
    }).join(''):'<div class="empty"><b>No errors logged</b>Crashes and failed requests will appear here.</div>';
  }).catch(fail);
};
H.dgScan=function(){
  var el=$('#dgScan');el.innerHTML=C.skel('list');
  api('healthCheck').then(function(list){
    var ic={ok:'✓',warn:'!',error:'✕'},col={ok:'#2e7d32',warn:'#b26a00',error:'#c62828'};
    el.innerHTML=list.map(function(x){return '<div style="display:flex;gap:8px;padding:6px 0;border-top:1px solid var(--line)"><b style="color:'+col[x.level]+';width:16px">'+ic[x.level]+'</b><div><div>'+esc(x.title)+'</div>'+(x.detail?'<small style="color:var(--mut)">'+esc(x.detail)+'</small>':'')+'</div></div>';}).join('');
  }).catch(function(e){el.innerHTML='';fail(e);});
};
H.dgCopy=function(){
  if(!DG.rows.length){toast('Nothing to copy yet.');return;}
  C.saveText('CWA error log '+new Date().toISOString().slice(0,10)+'.txt',DG.rows.map(function(r){
    return '['+dgTime(r.created_at)+'] '+r.kind+' | '+[r.screen,r.user_role,r.user_id,r.action,r.app_ver].filter(Boolean).join(' | ')+'\n'+r.message+(r.stack?'\n'+r.stack:'')+(r.device?'\nDevice: '+r.device:'')+(r.extra?'\n'+r.extra:'');
  }).join('\n\n----\n\n'));
};
H.dgClear=function(){C.ask('Delete all logged errors?',function(){api('clearErrors').then(function(){toast('Error log cleared','ok');H.dgLoad();}).catch(fail);});};
VIEWS.lessons=function(){
  content('<div class="ph"><h2>Lesson Trackers</h2></div><div class="card" style="padding:16px"><p style="margin:0 0 12px">Open any teacher\'s weekly lesson tracker: the book, unit and what was covered in each lesson.</p><div class="acts-bar"><button class="btn green" data-act="lessonOpen">Open Lesson Tracker</button><button class="btn ghost" data-act="lsBooks">Manage books</button></div></div>');
};
VIEWS.sched=function(){
  api('teacherList').then(function(list){
    T.teachers=list;
    if(!list.length){content('<div class="ph"><h2>Teacher schedules</h2></div><div class="card empty"><b>No teachers yet</b>Add a teacher first, then you can check and edit their schedule here.</div>');return;}
    if(!list.some(function(x){return x.id===T.tid;}))T.tid=(list.filter(function(x){return x.active;})[0]||list[0]).id;
    return loadWeek(T.ws||monday(today()));
  }).catch(fail);
};
function drawSched(){
  content('<div class="ph"><h2>Teacher schedules</h2></div>'+
    '<div class="bars"><select class="inp" data-ch="tvSel" style="flex:1 1 220px" aria-label="Choose a teacher">'+T.teachers.map(function(x){return '<option value="'+esc(x.id)+'"'+(x.id===T.tid?' selected':'')+'>'+esc(x.name)+(x.active?'':' (inactive)')+'</option>';}).join('')+'</select></div>'+
    weekBar()+weekEmpty()+actionBar()+gridHtml());
}
CH.tvSel=function(el){T.tid=el.value;T.last=el.value;loadWeek(T.ws);};

/* ================= Teachers ================= */
function pinSheet(title,sub,name,pin){
  openSheet(shHead(title,sub)+'<div style="text-align:center;margin:18px 0">'+(name?'<div style="font-weight:700;margin-bottom:8px">'+esc(name)+'</div>':'')+'<span class="pin" style="font-size:34px;padding:8px 18px">'+esc(pin)+'</span></div><div class="sh-f"><button class="btn ghost" data-act="tCopy" data-pin="'+esc(pin)+'">Copy PIN</button><button class="btn green" data-act="closeSheet">Done</button></div>');
}
VIEWS.teachers=function(){
  api('listTeachers').then(function(list){
    var act=list.filter(function(t){return t.active;}),old=list.filter(function(t){return !t.active;});
    function li(t){return '<div class="li"><div><b>'+esc(t.name)+'</b>'+(t.active?'':'<small>Inactive</small>')+'</div><div class="acts"><span class="pin" title="Login PIN">'+esc(t.pin)+'</span><button class="mini" data-act="tCopy" data-pin="'+esc(t.pin)+'">Copy</button><button class="mini" data-act="tRename" data-id="'+esc(t.id)+'" data-name="'+esc(t.name)+'">Rename</button><button class="mini" data-act="tReset" data-id="'+esc(t.id)+'" data-name="'+esc(t.name)+'">New PIN</button><button class="mini" data-act="tToggle" data-id="'+esc(t.id)+'" data-name="'+esc(t.name)+'" data-on="'+(t.active?1:0)+'">'+(t.active?'Deactivate':'Activate')+'</button></div></div>';}
    content('<div class="ph"><h2>Teachers</h2><div class="acts"><button class="btn green sm" data-act="tNew">+ Add teacher</button><button class="btn ghost sm" data-act="tBulk">Bulk import</button></div></div>'+
      (list.length?'<div class="card list">'+act.map(li).join('')+old.map(li).join('')+'</div><div class="hint">Teachers sign in by picking their name and typing their 4-digit PIN.</div>':'<div class="card empty"><b>No teachers yet</b>Add a teacher and a 4-digit PIN is created automatically.</div>'));
  }).catch(fail);
};
H.tCopy=function(el){copyText(el.dataset.pin);};
H.tNew=function(){
  openSheet(shHead('Add teacher','A 4-digit PIN is created for you')+'<label class="lbl">Teacher name</label><input class="inp" id="tnName" autocomplete="off"><div class="sh-f"><button class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn green" data-act="tnSave">Add teacher</button></div>');
};
H.tnSave=function(){
  api('saveTeacher',{name:$('#tnName').value}).then(function(r){closeSheet();pinSheet('Teacher added','Share this PIN with '+esc(r.name),r.name,r.pin);VIEWS.teachers();}).catch(fail);
};
H.tRename=function(el){
  openSheet(shHead('Rename teacher')+'<input class="inp" id="trName" value="'+esc(el.dataset.name)+'"><div class="sh-f"><button class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn green" data-act="trSave" data-id="'+esc(el.dataset.id)+'">Save</button></div>');
};
H.trSave=function(el){api('saveTeacher',{id:el.dataset.id,name:$('#trName').value}).then(function(){closeSheet();toast('Saved','ok');VIEWS.teachers();}).catch(fail);};
H.tReset=function(el){
  C.ask('Create a new PIN for '+el.dataset.name+'? Their old PIN will stop working.',function(){
    api('resetPin',{id:el.dataset.id}).then(function(r){pinSheet('New PIN',esc(el.dataset.name),null,r.pin);VIEWS.teachers();}).catch(fail);
  });
};
H.tToggle=function(el){
  var on=el.dataset.on==='1';
  function go(){api('saveTeacher',{id:el.dataset.id,name:el.dataset.name,active:!on}).then(function(){toast(on?'Teacher deactivated':'Teacher activated','ok');VIEWS.teachers();}).catch(fail);}
  if(on)C.ask('Deactivate '+el.dataset.name+'? They will no longer be able to sign in. Past records are kept.',go);else go();
};
H.tBulk=function(){
  openSheet(shHead('Bulk import teachers','One name per line. PINs are created automatically.')+'<textarea class="inp" id="tbText" placeholder="Teacher Zeus&#10;Teacher Hera&#10;Teacher Apollo"></textarea><div class="sh-f"><button class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn green" data-act="tbGo">Import teachers</button></div>');
};
H.tbGo=function(){
  var names=$('#tbText').value.split(/\r?\n|,/).map(function(x){return x.trim();}).filter(Boolean);
  if(!names.length){toast('Type at least one name.','err');return;}
  api('bulkAddTeachers',{names:names}).then(function(r){
    var tsv=r.added.map(function(a){return a.name+'\t'+a.pin;}).join('\n');
    closeSheet();
    openSheet(shHead('Added '+r.added.length+' teacher'+(r.added.length===1?'':'s'),'Share each PIN with its teacher')+'<div class="list">'+r.added.map(function(a){return '<div class="li"><b>'+esc(a.name)+'</b><span class="pin">'+esc(a.pin)+'</span></div>';}).join('')+r.skipped.map(function(x){return '<div class="li"><span>'+esc(x.name)+'</span><span class="chip c-OFF-TRACK">'+esc(x.reason)+'</span></div>';}).join('')+'</div><div class="sh-f"><button class="btn ghost" data-act="tCopy" data-pin="'+esc(tsv)+'">Copy list</button><button class="btn green" data-act="closeSheet">Done</button></div>');
    VIEWS.teachers();
  }).catch(fail);
};

/* ================= Holidays ================= */
VIEWS.cal=function(){
  var list=Object.keys(S.hol).sort().map(function(d){return S.hol[d];}),t=today();
  content('<div class="ph"><h2>Holidays and class changes</h2></div>'+
    '<div class="card"><div class="row2"><div><label class="lbl" style="margin-top:0">Date</label><input class="inp" type="date" id="hDate"></div><div><label class="lbl" style="margin-top:0">Name</label><input class="inp" id="hLabel" placeholder="e.g. National Heroes Day"></div></div>'+
    '<label class="lbl">What happens on this day?</label><select class="inp" id="hType"><option value="NO_CLASS">No class</option><option value="CLASS">Still have class</option></select>'+
    '<div class="sh-f"><button class="btn green" data-act="hSave" style="flex:none">Save day</button></div><div class="hint">Saturdays and Sundays never have class. Add a "Still have class" day to keep a holiday open for attendance.</div></div>'+
    '<div class="ph" style="margin-top:18px"><h2>Saved days</h2></div>'+
    (list.length?'<div class="card list">'+list.map(function(h){return '<div class="li" style="'+(h.date<t?'opacity:.6':'')+'"><div><b>'+longD(h.date)+', '+h.date.slice(0,4)+'</b><small>'+esc(h.label)+'</small></div><div class="acts"><span class="chip '+(h.type==='CLASS'?'c-ON-TRACK':'c-ARCH')+'">'+(h.type==='CLASS'?'Class':'No class')+'</span><button class="mini" data-act="hEdit" data-d="'+h.date+'">Edit</button><button class="mini" data-act="hDel" data-d="'+h.date+'">Remove</button></div></div>';}).join('')+'</div>':'<div class="card empty"><b>No holidays saved</b>Every weekday is a class day until you add one here.</div>'));
};
H.hSave=function(){
  var d=$('#hDate').value;if(!d){toast('Pick a date.','err');return;}
  api('saveHoliday',{date:d,label:$('#hLabel').value,type:$('#hType').value}).then(function(l){C.setHol(l);toast('Saved','ok');VIEWS.cal();}).catch(fail);
};
H.hEdit=function(el){var h=S.hol[el.dataset.d];$('#hDate').value=h.date;$('#hLabel').value=h.label;$('#hType').value=h.type;window.scrollTo(0,0);};
H.hDel=function(el){C.ask('Remove this day from the list?',function(){api('deleteHoliday',{date:el.dataset.d}).then(function(l){C.setHol(l);VIEWS.cal();}).catch(fail);});};

/* ================= Reports ================= */
var RP={mode:'all',sel:{},q:'',details:true,from:'',to:'',out:null};
VIEWS.reports=function(){
  if(!RP.from){RP.from=monthStart(today());RP.to=today();}
  loadList().then(drawReports).catch(fail);
};
function rpChecks(){
  var q=RP.q.trim().toLowerCase();
  var l=S.list.students.filter(function(s){return s.active&&(!q||s.name.toLowerCase().indexOf(q)>-1);});
  return l.map(function(s){var on=RP.sel[s.id];return '<div class="prow'+(on?' on':'')+'" data-act="rpTog" data-id="'+esc(s.id)+'"><i>'+(on?'✓':'')+'</i><span>'+esc(s.name)+'</span><small>'+COURSE[s.course]+(s.type==='CAMP'?' · Camp':'')+'</small></div>';}).join('')||'<div class="empty">No students.</div>';
}
function drawReports(){
  content('<div class="ph"><h2>Reports</h2></div><div class="card">'+
    '<label class="lbl" style="margin-top:0">Who is in the report?</label><div class="seg"><button data-act="rpMode" data-m="all" class="'+(RP.mode==='all'?'on':'')+'">All active students</button><button data-act="rpMode" data-m="sel" class="'+(RP.mode==='sel'?'on':'')+'">Choose students</button></div>'+
    (RP.mode==='sel'?'<input class="search" style="margin-top:10px" data-in="rpq" placeholder="Search student\'s name" value="'+esc(RP.q)+'"><div class="chk" id="rpChk">'+rpChecks()+'</div><div class="hint" id="rpCnt">'+Object.keys(RP.sel).length+' selected</div>':'')+
    '<label class="sw" style="margin-bottom:0"><input type="checkbox" id="rpDet" data-ch="rpdet"'+(RP.details?' checked':'')+'> Include the daily attendance log</label>'+
    '<div class="row2" id="rpDates" style="'+(RP.details?'':'display:none')+'"><div><label class="lbl">Log from</label><input class="inp" type="date" id="rpFrom" data-ch="rpd" value="'+RP.from+'"></div><div><label class="lbl">Log to</label><input class="inp" type="date" id="rpTo" data-ch="rpd" value="'+RP.to+'"></div></div>'+
    '<div class="hint">Eligibility and remarks always use the whole course so far. The date range only limits the daily log.</div>'+
    '<div class="sh-f" style="flex-wrap:wrap"><button class="btn ghost" data-act="rpGo">Preview</button><button class="btn ghost" data-act="rpPrint">Print / Save PDF</button><button class="btn green" data-act="rpSheet">Download CSV</button></div></div><div id="rpOut"></div>');
  if(RP.out)$('#rpOut').innerHTML='<div class="rep">'+reportHtml(RP.out)+'</div>';
}
H.rpMode=function(el){RP.mode=el.dataset.m;drawReports();};
H.rpTog=function(el){var id=el.dataset.id;if(RP.sel[id])delete RP.sel[id];else RP.sel[id]=1;$('#rpChk').innerHTML=rpChecks();$('#rpCnt').textContent=Object.keys(RP.sel).length+' selected';};
IN.rpq=function(el){RP.q=el.value;$('#rpChk').innerHTML=rpChecks();};
CH.rpdet=function(el){RP.details=el.checked;$('#rpDates').style.display=RP.details?'':'none';};
CH.rpd=function(){RP.from=$('#rpFrom').value;RP.to=$('#rpTo').value;};
function rpPayload(){
  if(RP.mode==='sel'&&!Object.keys(RP.sel).length){toast('Choose at least one student.','err');return null;}
  RP.from=($('#rpFrom')||{}).value||RP.from;RP.to=($('#rpTo')||{}).value||RP.to;
  return {ids:RP.mode==='sel'?Object.keys(RP.sel):[],details:RP.details,from:RP.from,to:RP.to};
}
function rpFetch(){var p=rpPayload();if(!p)return Promise.reject(new Error('Choose at least one student.'));return api('report',p).then(function(d){RP.out=d;$('#rpOut').innerHTML='<div class="rep">'+reportHtml(d)+'</div>';return d;});}
H.rpGo=function(){rpFetch().catch(fail);};
H.rpPrint=function(){rpFetch().then(function(d){printHtml(reportHtml(d));}).catch(fail);};
H.rpSheet=function(){   /* summary as a CSV file (opens in Excel / Google Sheets) */
  rpFetch().then(function(d){
    var q=function(v){v=String(v==null?'':v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;};
    var rows=[['#','Student','Course','Start','End','Weeks','Required Hrs','Attended Hrs','Present','Excused','Late','Absent','Allowed Absences','Remaining','Status','Certificate','Remarks']];
    d.items.forEach(function(it,i){var s=it.student,t=it.stats;rows.push([i+1,s.name,COURSE[s.course],s.start,s.end,s.weeks,t.required,t.attended,t.present,t.excused,t.late,t.absent,t.allowed,t.remaining,t.status,t.cert||'PENDING',it.remark]);});
    var csv=rows.map(function(r){return r.map(q).join(',');}).join('\r\n');
    C.saveText(d.org+' Attendance Report '+d.generatedAt.slice(0,10)+'.csv',csv);
  }).catch(fail);
};
function reportHtml(d){
  var o='<div class="pr"><h2>'+esc(d.org)+' · Attendance Report</h2><p>Generated '+esc(d.generatedAt)+' · '+d.items.length+' student'+(d.items.length===1?'':'s')+' · '+esc(d.lateNote)+'</p>';
  if(!d.items.length)return o+'<div class="empty">No students match.</div></div>';
  o+='<table class="rt"><tr><th>#</th><th>Student</th><th>Course</th><th>Start – End</th><th>Attended / Required hrs</th><th>Absent hrs</th><th>Allowed</th><th>Left</th><th>Status</th><th>Certificate</th><th>Remarks</th></tr>'+
    d.items.map(function(it,i){var s=it.student,t=it.stats;
      return '<tr><td class="n">'+(i+1)+'</td><td><b>'+esc(s.name)+'</b></td><td>'+COURSE[s.course]+'<br>'+s.weeks+' wk'+(s.weeks>1?'s':'')+'</td><td>'+mdy(s.start)+'<br>'+mdy(s.end)+'</td><td class="n">'+t.attended+' / '+t.required+'</td><td class="n">'+t.absent+'</td><td class="n">'+t.allowed+'</td><td class="n">'+t.remaining+'</td><td>'+chip(t.status)+'</td><td>'+chip(t.status,t.cert||'PENDING')+'</td><td>'+esc(it.remark)+'</td></tr>';}).join('')+'</table>';
  if(d.details){
    o+='<h3 style="margin-top:22px">Daily attendance log'+(d.from||d.to?' · '+(d.from?mdy(d.from):'start')+' to '+(d.to?mdy(d.to):'today'):'')+'</h3>';
    d.items.forEach(function(it){
      var m={},ds={};(it.log||[]).forEach(function(x){m[x[0]+'|'+x[1]]=x[2];ds[x[0]]=1;});
      var dates=Object.keys(ds).sort();
      o+='<div class="pr-sec"><h3>'+esc(it.student.name)+'</h3>'+(dates.length?recTable(dates,function(dd,h){return m[dd+'|'+h];},false):'<p>No attendance recorded in this range.</p>')+'</div>';
    });
    o+=legend();
  }
  return o+'</div>';
}

/* ================= Settings ================= */
VIEWS.settings=function(){
  api('getSettings').then(function(s){
    var b=S.boot,pol=b.policy,n=b.latePerAbsent;
    var rows=Object.keys(pol).map(function(k){return '<tr><td>'+esc(pol[k].label)+' ('+esc(pol[k].desc)+')</td><td class="n">'+pol[k].hoursPerWeek+'</td><td class="n">'+pol[k].absencesPerWeek+'</td></tr>';}).join('');
    content('<div class="ph"><h2>Settings</h2></div><div class="card"><label class="lbl" style="margin-top:0">School name</label><input class="inp" id="seOrg" value="'+esc(s.org)+'">'+
      '<label class="sw"><input type="checkbox" id="seLate" data-ch="seLateMode"'+(s.lateAbsent?' checked':'')+'> Count every Late (L) hour as absent</label><div class="hint" style="margin-top:-8px">Off by default: Late and Excused both count as present.</div>'+
      '<label class="sw"><input type="checkbox" id="seLate3" data-ch="seLateMode"'+(s.lateThree&&!s.lateAbsent?' checked':'')+'> Every '+n+' Late (L) hours count as 1 absent hour</label><div class="hint" style="margin-top:-8px">Counted over the whole course. For example, '+(2*n+1)+' lates = 2 absent hours. Only one of these two late options can be on at a time.</div>'+
      '<label class="sw"><input type="checkbox" id="seCamp"'+(s.camp?' checked':'')+'> Camp season</label><div class="hint" style="margin-top:-8px">Adds the 7AM, 12NN and 6PM slots and a Saturday column to every schedule and attendance grid. While it is on, 12NN is a class slot instead of the lunch break. Turning it off only hides them. Nothing is deleted.</div>'+
      '<label class="sw"><input type="checkbox" id="seDebug"'+(s.debug?' checked':'')+'> Debug mode</label><div class="hint" style="margin-top:-8px">Shows which action failed in error messages, adds the stack trace to the browser console, and logs every server call in the Apps Script Executions page. Turn it off when you are done.</div>'+
      '<div class="sh-f"><button class="btn green" data-act="seSave" style="flex:none">Save settings</button></div></div>'+
      '<div class="ph" style="margin-top:18px"><h2>Change admin password</h2></div><div class="card"><label class="lbl" style="margin-top:0">Current password</label><input class="inp" type="password" id="pwOld" autocomplete="off"><label class="lbl">New password</label><input class="inp" type="password" id="pwNew" autocomplete="off"><div class="sh-f"><button class="btn green" data-act="pwSave" style="flex:none">Change password</button></div><div class="hint">The first password is "admin". Please change it.</div></div>'+
      '<div class="ph" style="margin-top:18px"><h2>Certificate policy</h2></div><div class="card"><div class="tw"><table class="rt" style="min-width:0"><tr><th>Course</th><th>Hours per week</th><th>Absent hours allowed per week</th></tr>'+rows+'</table></div><div class="hint">Allowed absences = weeks of stay × the weekly allowance. A student is not eligible once absent hours go over the allowance. At risk starts at '+Math.round(b.warnAt*100)+'% used. Holidays marked "No class" never count as absences.</div></div>');
  }).catch(fail);
};
CH.seLateMode=function(el){var a=$('#seLate'),b=$('#seLate3');if(el.checked)(el===a?b:a).checked=false;};
H.seSave=function(){
  api('saveSettings',{org:$('#seOrg').value,lateAbsent:$('#seLate').checked,lateThree:$('#seLate3').checked,camp:$('#seCamp').checked,debug:$('#seDebug').checked}).then(function(s){
    var b=S.boot;b.camp=s.camp;b.org=s.org;b.lateAbsent=s.lateAbsent;b.lateThree=s.lateThree;C.setDebug(s.debug);S.list=null;
    toast('Settings saved','ok');var br=$('.brand small');if(br)br.textContent=s.org;
  }).catch(fail);
};
H.pwSave=function(){api('saveSettings',{currentPassword:$('#pwOld').value,newPassword:$('#pwNew').value}).then(function(){$('#pwOld').value='';$('#pwNew').value='';toast('Password changed','ok');}).catch(fail);};

C.render=function(){if(S.tab==='sched')drawSched();};
C.mount=function(){S.tab='home';renderAdmin();};
})(window.CWA);
