/* take.js: a teacher takes medicine ("Not feeling well?"), for themselves or for a student they are with.
   Stock drops and the record is written at once. The nurse sees the entry flagged "recorded by teacher" and can cancel it.
   Loaded on demand from the teacher menu. Teachers see availability only, never the counts or anyone else's records. */
(function(C){
'use strict';
var S=C.S,H=C.H,$=C.$,esc=C.esc,api=C.api,fail=C.fail,toast=C.toast,openSheet=C.openSheet,closeSheet=C.closeSheet,shHead=C.shHead,mdy=C.mdy;
var K={sh:null,ts:null,d:null,mine:[],q:'',head:'',t:{med:null,forKind:'self',student:null,qty:1,reason:''}};
var ST={in:['P','In stock'],low:['L','Few left'],out:['A','Out of stock']};

function open(){
  if(H.drawClose)H.drawClose();
  K.head=shHead('Not feeling well?','Take medicine and it is recorded for the nurse');K.q='';
  K.sh=openSheet(K.head+C.skel('list'),{full:true});load();
}
function load(){Promise.all([api('medAvailability'),api('medMine')]).then(function(r){K.d=r[0];K.mine=r[1];draw();}).catch(function(e){closeSheet();fail(e);});}
function draw(){
  if(!K.sh||!document.body.contains(K.sh))return;
  var d=K.d;
  K.sh.innerHTML=K.head+'<div class="card" style="padding:14px;margin-bottom:14px">'+
    (d.nurses.length?d.nurses.map(function(n){return '<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">'+C.avatar('admin',n.id,n.name,52)+'<div><b>Nurse '+esc(n.name)+'</b></div></div>';}).join(''):'<b>No nurse has been set up yet.</b>')+
    (d.note?'<div style="margin-top:4px">'+esc(d.note)+'</div>':'')+'<div class="hint" style="margin-top:8px">You can also go to the nurse for help.</div></div>'+
    '<div class="ap-label">Take medicine</div><input class="inp" id="tkQ" placeholder="Search medicine…" autocomplete="off" value="'+esc(K.q)+'"><div id="tkList"></div>'+mineHtml();
  list();$('#tkQ').addEventListener('input',function(){K.q=this.value;list();});
}
function list(){
  var q=K.q.trim().toLowerCase(),rows=K.d.items.filter(function(m){return !q||m.name.toLowerCase().indexOf(q)>=0;});
  $('#tkList').innerHTML=rows.length?rows.map(function(m){
    var s=ST[m.status]||ST.out,inner='<span>'+esc(m.name)+(m.unit?' <small style="color:var(--mut)">('+esc(m.unit)+')</small>':'')+(m.description?'<small class="tk-desc">'+esc(m.description)+'</small>':'')+'</span><span class="tag '+s[0]+'">'+s[1]+'</span>';
    return m.status==='out'?'<div class="tk-row off">'+inner+'</div>':'<button class="tk-row" data-act="tkPick" data-id="'+esc(m.id)+'">'+inner+'</button>';
  }).join(''):'<div class="empty"><b>'+(K.d.items.length?'No match':'No medicines listed yet')+'</b></div>';
}
function mineHtml(){
  if(!K.mine.length)return '';
  return '<div class="ap-label" style="margin-top:18px">My recent entries</div>'+K.mine.map(function(x){
    return '<div class="tk-mine"><b>'+x.qty+' × '+esc(x.medicine)+'</b>'+(x.voided?' <span class="tag A">Cancelled</span>':'')+'<br><small>'+esc(mdy(x.date))+' '+esc(x.time)+' · for '+(x.personKind==='student'?esc(x.person):'you')+'</small></div>';
  }).join('');
}

/* ---------- choose who, how many, why ---------- */
function keep(){var r=$('#tkReason');if(r)K.t.reason=r.value;}
function takeHtml(){
  var t=K.t,m=t.med;
  return shHead('Take medicine',esc(m.name))+
    (m.description?'<div class="hint" style="margin:0 0 10px;white-space:pre-line">'+esc(m.description)+'</div>':'')+
    '<div class="lbl" style="margin-top:0">Who is it for?</div><div class="seg med-kinds"><button class="'+(t.forKind==='self'?'on':'')+'" data-act="tkKind" data-v="self">Me</button><button class="'+(t.forKind==='student'?'on':'')+'" data-act="tkKind" data-v="student">A student</button></div>'+
    (t.forKind==='student'?'<button class="selbtn" style="margin-top:8px" data-act="tkStudent">'+(t.student?'<span class="sb-v">'+C.avatar('student',t.student.id,t.student.label,26)+' '+esc(t.student.label)+'</span>':'<span class="sb-ph">Choose student…</span>')+'<i>▾</i></button><div class="hint" style="margin-top:6px">Use this when you are with the student. Please follow the school\'s medicine rules.</div>':'')+
    '<div class="lbl">Quantity'+(m.unit?' ('+esc(m.unit)+')':'')+'</div><div class="stepper"><button data-act="tkQty" data-d="-1" aria-label="Less">−</button><b>'+t.qty+'</b><button data-act="tkQty" data-d="1" aria-label="More">+</button></div>'+
    '<div class="lbl">Reason (optional)</div><input class="inp" id="tkReason" maxlength="100" autocomplete="off" placeholder="e.g. headache" value="'+esc(t.reason)+'">'+
    '<div class="rsn">'+['Headache','Fever','Stomachache','Cough','Cramps'].map(function(c){return '<button class="mini" data-act="tkChip" data-v="'+c+'">'+c+'</button>';}).join('')+'</div>'+
    '<div class="hint" style="margin-top:10px">Follow the label. If you feel worse, see the nurse.</div>'+
    '<div class="sh-f"><button class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn green" data-act="tkGo">Take medicine</button></div>';
}
function redraw(){K.ts.innerHTML=takeHtml();}
H.tkPick=function(el){
  var m=K.d.items.filter(function(x){return x.id===el.dataset.id;})[0];if(!m)return;
  K.t={med:m,forKind:'self',student:null,qty:1,reason:''};K.ts=openSheet(takeHtml());
};
H.tkKind=function(el){keep();K.t.forKind=el.dataset.v;redraw();};
H.tkQty=function(el){keep();K.t.qty=Math.max(1,Math.min(20,K.t.qty+(+el.dataset.d)));redraw();};
H.tkChip=function(el){keep();K.t.reason=el.dataset.v;redraw();};
H.tkStudent=function(){keep();C.pickSheet('Choose student',K.d.students.map(function(s){return {id:s.id,label:s.name,sub:'Student',av:['student',s.id]};}),function(it){K.t.student=it;redraw();});};
H.tkGo=function(){
  keep();var t=K.t;
  if(t.forKind==='student'&&!t.student){toast('Choose the student first.');return;}
  api('medTake',{medicineId:t.med.id,qty:t.qty,forKind:t.forKind,studentId:t.student?t.student.id:'',reason:t.reason}).then(function(r){
    closeSheet();toast('Recorded: '+r.qty+' × '+r.name+(r.forKind==='student'?' for '+r.person:' for you')+'. Follow the label.','ok');load();
  }).catch(function(e){fail(e);load();});
};
C.take={open:open};
})(window.CWA);
