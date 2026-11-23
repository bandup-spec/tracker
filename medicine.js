/* medicine.js: medicine inventory. Nurse = give medicine, edit stock, records, reports. Owner admin = view stock, records, reports.
   Loaded on demand (nurse.js / the owner's Medicine tab). The server enforces who may do what; this file only hides what a role cannot use. */
(function(C){
'use strict';
var S=C.S,H=C.H,$=C.$,esc=C.esc,api=C.api,fail=C.fail,toast=C.toast,openSheet=C.openSheet,closeSheet=C.closeSheet,shHead=C.shHead,mdy=C.mdy,longD=C.longD,ask=C.ask;
function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila'}).format(new Date());}   /* the school's date (Manila), whatever the device's time zone */
var M={mode:'nurse',tab:'give',root:null,meds:null,people:null,q:'',pick:null,rep:null,
  g:{kind:'student',person:null,med:null,qty:1,reason:'',other:''},
  r:{view:'given',from:'',to:'',person:null,med:null,rows:null}};

function lab(m){return m.name+(m.strength?' '+m.strength:'');}
function medById(id){return (M.meds||[]).filter(function(m){return m.id===id;})[0];}
function flags(m){   /* [level, text]: red = out/expired, amber = low/expiring soon */
  var t=today(),f=[];
  if(m.stock<=0)f.push(['out','Out of stock']);else if(m.stock<=m.low)f.push(['low','Low stock']);
  if(m.expiry){if(m.expiry<t)f.push(['out','Expired '+mdy(m.expiry)]);else if(m.expiry<=C.add(t,60))f.push(['low','Expires '+mdy(m.expiry)]);}
  return f;
}
var KIND={student:'Student',teacher:'Teacher',other:'Other'};

/* ---------- mount / tabs ---------- */
function mount(root,mode){
  M.root=root;M.mode=mode;M.tab=mode==='nurse'?'give':'stock';M.meds=null;M.r.rows=null;M.tb=0;
  root.innerHTML=C.skel('list');
  Promise.all([api('medList'),M.people?null:api('medPeople'),teacherCount()]).then(function(r){M.meds=r[0];if(r[1])M.people=r[1];draw();}).catch(fail);
}
function teacherCount(){return api('medLog',{view:'pending',from:C.add(today(),-60),to:today()}).then(function(rows){M.tb=rows.length;}).catch(function(){});}   /* teacher doses still waiting for the nurse to confirm, shown on the Records tab */
function refresh(){return Promise.all([api('medList'),teacherCount()]).then(function(a){var l=a[0];M.meds=l;if(M.g.med)M.g.med=medById(M.g.med.id)||null;draw();});}
function go(tab){M.tab=tab;if(M.meds)draw();}
function tabs(){return M.mode==='nurse'?[['give','Give medicine'],['stock','Stock'],['rec','Records'],['set','Settings']]:[['stock','Stock'],['rec','Records']];}
function draw(){
  if(!M.root||!document.body.contains(M.root))return;
  var attention=M.meds.filter(function(m){return m.active&&flags(m).length;}).length;
  M.root.innerHTML='<div class="med"><div class="seg med-tabs">'+tabs().map(function(t){return '<button class="'+(M.tab===t[0]?'on':'')+'" data-act="mTab" data-v="'+t[0]+'">'+t[1]+(t[0]==='stock'&&attention?' <i class="med-badge">'+attention+'</i>':'')+(t[0]==='rec'&&M.tb?' <i class="med-badge teal">'+M.tb+'</i>':'')+'</button>';}).join('')+'</div><div id="medBody"></div></div>';
  var b=$('#medBody');
  b.innerHTML={give:giveHtml,stock:stockHtml,rec:recHtml,set:setHtml}[M.tab]();
  if(M.tab==='stock')bindStock();
  if(M.tab==='rec'){if(M.r.rows)recList();else loadRec();}
}
H.mTab=function(el){keepGive();M.tab=el.dataset.v;draw();};

/* searchable pick popup: uses the shared one when shared.js has it, otherwise this copy (so a stale shared.js cannot break the pickers) */
if(typeof C.pickSheet!=='function'){(function(){
  var PS={items:[],cb:null,q:''};
  function rows(){
    var q=PS.q.trim().toLowerCase(),list=PS.items.filter(function(i){return !q||String(i.label).toLowerCase().indexOf(q)>=0;}).slice(0,80);
    document.getElementById('psList').innerHTML=list.length?list.map(function(i){
      return '<button class="tk-row" data-act="psSel" data-id="'+C.esc(i.id)+'"><span>'+C.esc(i.label)+'</span>'+(i.sub?'<small style="color:var(--mut)">'+C.esc(i.sub)+'</small>':'')+'</button>';
    }).join(''):'<div class="empty"><b>No match</b></div>';
  }
  C.pickSheet=function(title,items,cb){
    PS.items=items;PS.cb=cb;PS.q='';
    C.openSheet(C.shHead(C.esc(title),'')+'<input class="inp" id="psQ" placeholder="Search…" autocomplete="off"><div id="psList"></div>',{full:true});
    document.getElementById('psQ').addEventListener('input',function(){PS.q=this.value;rows();});
    rows();
  };
  C.H.psSel=function(el){
    var it=PS.items.filter(function(x){return String(x.id)===el.dataset.id;})[0],cb=PS.cb;
    if(!it)return;C.closeSheet();if(cb)cb(it);
  };
})();}
var pickSheet=C.pickSheet;   /* searchable popup, shared with the teacher screen */
function peopleItems(kind){
  var p=M.people||{teachers:[],students:[]};
  if(kind==='student')return p.students.map(function(s){return {id:s.id,label:s.name,sub:'Student',kind:'student',av:['student',s.id]};});
  if(kind==='teacher')return p.teachers.map(function(t){return {id:t.id,label:t.name,sub:'Teacher',kind:'teacher',av:['teacher',t.id]};});
  return peopleItems('student').concat(peopleItems('teacher'));
}

/* ---------- Give medicine ---------- */
function keepGive(){var o=$('#mgOther'),r=$('#mgReason');if(o)M.g.other=o.value;if(r)M.g.reason=r.value;}
function giveHtml(){
  var g=M.g,m=g.med;
  return '<div class="card" style="padding:14px"><div class="lbl" style="margin-top:0">Who is taking the medicine?</div>'+
    '<div class="seg med-kinds">'+['student','teacher','other'].map(function(k){return '<button class="'+(g.kind===k?'on':'')+'" data-act="mgKind" data-v="'+k+'">'+KIND[k]+'</button>';}).join('')+'</div>'+
    (g.kind==='other'?'<input class="inp" id="mgOther" maxlength="60" placeholder="Name of the person" autocomplete="off" value="'+esc(g.other)+'" style="margin-top:8px">'
      :'<button class="selbtn" style="margin-top:8px" data-act="mgPerson">'+(g.person?'<span class="sb-v">'+C.avatar(g.kind,g.person.id,g.person.label,26)+' '+esc(g.person.label)+'</span>':'<span class="sb-ph">Choose '+g.kind+'…</span>')+'<i>▾</i></button>')+
    '<div class="lbl">Medicine</div><button class="selbtn" data-act="mgMed">'+(m?'<span class="sb-v">'+esc(lab(m))+'</span>':'<span class="sb-ph">Choose medicine…</span>')+'<i>▾</i></button>'+
    (m?'<div class="mg-avail'+(m.stock<=m.low?' low':'')+'">'+esc(lab(m))+' has <b>'+m.stock+'</b> available</div>':'')+
    (m&&m.description?'<div class="hint" style="margin-top:6px;white-space:pre-line">'+esc(m.description)+'</div>':'')+
    '<div class="lbl">Quantity'+(m&&m.unit?' ('+esc(m.unit)+')':'')+'</div><div class="stepper"><button data-act="mgQty" data-d="-1" aria-label="Less">−</button><b>'+g.qty+'</b><button data-act="mgQty" data-d="1" aria-label="More">+</button></div>'+
    '<div class="lbl">Reason (optional)</div><input class="inp" id="mgReason" maxlength="100" autocomplete="off" placeholder="e.g. headache" value="'+esc(g.reason)+'">'+
    '<div class="rsn">'+['Headache','Fever','Stomachache','Cough','Cramps'].map(function(c){return '<button class="mini" data-act="mgChip" data-v="'+c+'">'+c+'</button>';}).join('')+'</div>'+
    '<button class="btn green block" style="margin-top:16px" data-act="mgGive">Give medicine</button></div>';
}
function again(){keepGive();$('#medBody').innerHTML=giveHtml();}
H.mgKind=function(el){keepGive();if(M.g.kind!==el.dataset.v){M.g.kind=el.dataset.v;M.g.person=null;}again();};
H.mgPerson=function(){keepGive();pickSheet('Choose '+M.g.kind,peopleItems(M.g.kind),function(it){M.g.person=it;again();});};
H.mgMed=function(){
  keepGive();
  pickSheet('Choose medicine',M.meds.filter(function(m){return m.active;}).map(function(m){var f=flags(m).map(function(x){return x[1];});return {id:m.id,label:lab(m),sub:m.stock+' available'+(f.length?' · '+f.join(', '):'')};}),
    function(it){var m=medById(it.id);M.g.med=m;M.g.qty=Math.max(1,Math.min(M.g.qty,m.stock||1));again();toast(lab(m)+' has '+m.stock+' available');});
};
H.mgQty=function(el){keepGive();var max=M.g.med?Math.max(1,M.g.med.stock):99;M.g.qty=Math.max(1,Math.min(max,M.g.qty+(+el.dataset.d)));again();};
H.mgChip=function(el){keepGive();M.g.reason=el.dataset.v;$('#medBody').innerHTML=giveHtml();};   /* no keepGive() after: it would overwrite the chip with the old text box value */
H.mgGive=function(){
  keepGive();var g=M.g,name=g.kind==='other'?g.other.trim():(g.person&&g.person.label);
  if(!name){toast(g.kind==='other'?'Enter the name of the person.':'Choose who is taking the medicine.');return;}
  if(!g.med){toast('Choose the medicine first.');return;}
  if(g.qty>g.med.stock){toast(lab(g.med)+' has only '+g.med.stock+' available.');return;}
  ask('Give '+g.qty+' × '+lab(g.med)+' to '+name+'? '+(g.med.stock-g.qty)+' will remain.',function(){
    if(M.busy)return;M.busy=true;   /* ignore a double tap */
    api('medGive',{medicineId:g.med.id,qty:g.qty,personKind:g.kind,personId:g.person?g.person.id:'',personName:g.kind==='other'?name:'',reason:g.reason}).then(function(r){
      M.g={kind:g.kind,person:null,med:null,qty:1,reason:'',other:''};M.r.rows=null;
      return refresh().then(function(){toast(r.name+' has '+r.remaining+' available','ok');});
    }).catch(function(e){fail(e);refresh();}).then(function(){M.busy=false;});
  });
};

/* ---------- Stock ---------- */
function stockHtml(){
  var nurse=M.mode==='nurse';
  return '<div style="display:flex;gap:8px;margin-bottom:10px"><input class="inp" id="msQ" placeholder="Search medicine…" value="'+esc(M.q)+'" style="flex:1" autocomplete="off">'+(nurse?'<button class="btn green sm" data-act="msNew">+ New</button>':'')+'</div><div id="msList"></div>';
}
function stockList(){
  var q=M.q.trim().toLowerCase(),nurse=M.mode==='nurse',list=M.meds.filter(function(m){return !q||lab(m).toLowerCase().indexOf(q)>=0;});
  $('#msList').innerHTML=list.length?list.map(function(m){
    return '<div class="card med-card'+(m.active?'':' off')+'"><div class="mc-top"><div><b>'+esc(lab(m))+'</b><small>'+esc(m.unit||'')+(m.expiry?' · expires '+mdy(m.expiry):'')+(nurse&&m.purchased?' · bought '+mdy(m.purchased):'')+(m.active?'':' · hidden')+'</small></div><div class="mc-n'+(m.stock<=m.low?' low':'')+'">'+m.stock+'</div></div>'+
      (m.description?'<div class="mc-desc">'+esc(m.description)+'</div>':'')+(flags(m).length?'<div class="mc-flags">'+flags(m).map(function(f){return '<span class="tag '+(f[0]==='out'?'A':'L')+'">'+esc(f[1])+'</span>';}).join('')+'</div>':'')+
      (nurse?'<div class="mc-acts"><button class="btn ghost sm" data-act="msAdd" data-id="'+m.id+'">+ Add stock</button><button class="btn ghost sm" data-act="msSet" data-id="'+m.id+'">Correct count</button><button class="btn ghost sm" data-act="msEdit" data-id="'+m.id+'">Edit</button></div>':'')+'</div>';
  }).join(''):'<div class="empty"><b>No medicines found</b>'+(nurse?'Tap + New to add one.':'The nurse has not added any yet.')+'</div>';
}
function bindStock(){stockList();$('#msQ').addEventListener('input',function(){M.q=this.value;stockList();});}
function saved(r,m){return refresh().then(function(){var x=medById(r.id||m&&m.id);if(x)toast(lab(x)+' has '+x.stock+' available','ok');});}
H.msAdd=function(el){var m=medById(el.dataset.id);openSheet(shHead('Add stock',esc(lab(m)))+'<label class="lbl">How many were added?</label><input class="inp" id="saQ" type="number" inputmode="numeric" min="1" value="10"><label class="lbl">Date purchased</label><input class="inp" id="saP" type="date" value="'+today()+'"><label class="lbl">New expiry date (optional)</label><input class="inp" id="saE" type="date"><label class="lbl">Note (optional)</label><input class="inp" id="saN" maxlength="100" placeholder="e.g. delivery from pharmacy"><div class="sh-f"><button class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn green" data-act="msAddSave" data-id="'+m.id+'">Add</button></div>');};
H.msAddSave=function(el){api('medStock',{id:el.dataset.id,mode:'add',qty:$('#saQ').value,expiry:$('#saE').value,purchased:$('#saP').value,note:$('#saN').value}).then(function(r){closeSheet();return saved(r);}).catch(fail);};
H.msSet=function(el){var m=medById(el.dataset.id);openSheet(shHead('Correct the count',esc(lab(m)))+'<div class="hint" style="margin:0 0 8px">Use this after counting the box. Currently <b>'+m.stock+'</b>.</div><label class="lbl">Counted</label><input class="inp" id="scQ" type="number" inputmode="numeric" min="0" value="'+m.stock+'"><label class="lbl">Note (optional)</label><input class="inp" id="scN" maxlength="100" placeholder="e.g. monthly count"><div class="sh-f"><button class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn green" data-act="msSetSave" data-id="'+m.id+'">Save</button></div>');};
H.msSetSave=function(el){api('medStock',{id:el.dataset.id,mode:'set',qty:$('#scQ').value,note:$('#scN').value}).then(function(r){closeSheet();return saved(r);}).catch(fail);};
function medForm(m){
  var isNew=!m;m=m||{name:'',strength:'',unit:'tablet',low:5,expiry:'',purchased:'',description:'',stock:0,active:true};
  openSheet(shHead(isNew?'New medicine':'Edit medicine',isNew?'':esc(lab(m)))+
    '<label class="lbl">Name</label><input class="inp" id="mfN" maxlength="60" autocomplete="off" value="'+esc(m.name)+'" placeholder="e.g. Paracetamol">'+
    '<label class="lbl">Strength (optional)</label><input class="inp" id="mfS" maxlength="40" autocomplete="off" value="'+esc(m.strength)+'" placeholder="e.g. 500 mg">'+
    '<label class="lbl">Description (optional)</label><textarea class="inp" id="mfD" rows="3" maxlength="300" placeholder="e.g. For headache and fever. Adults: 1 to 2 tablets, not more than 4 a day.">'+esc(m.description||'')+'</textarea>'+
    '<label class="lbl">Unit</label><input class="inp" id="mfU" maxlength="20" autocomplete="off" value="'+esc(m.unit)+'" placeholder="tablet, bottle, sachet…">'+
    '<label class="lbl">Warn me when stock is at or below</label><input class="inp" id="mfL" type="number" inputmode="numeric" min="0" value="'+m.low+'">'+
    '<label class="lbl">Date purchased (optional)</label><input class="inp" id="mfP" type="date" value="'+esc(m.purchased||'')+'">'+
    '<label class="lbl">Expiry date (earliest, optional)</label><input class="inp" id="mfE" type="date" value="'+esc(m.expiry)+'">'+
    (isNew?'<label class="lbl">Stock now</label><input class="inp" id="mfK" type="number" inputmode="numeric" min="0" value="0">':'<label class="lbl" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="mfA"'+(m.active?' checked':'')+'> Show in the list (untick to hide)</label>')+
    '<div class="sh-f"><button class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn green" data-act="mfSave" data-id="'+(isNew?'':m.id)+'">Save</button></div>');
}
H.msNew=function(){medForm(null);};
H.msEdit=function(el){medForm(medById(el.dataset.id));};
H.mfSave=function(el){
  var id=el.dataset.id,body={id:id,name:$('#mfN').value,strength:$('#mfS').value,unit:$('#mfU').value,low:$('#mfL').value,expiry:$('#mfE').value,purchased:$('#mfP').value,description:$('#mfD').value};
  if(id)body.active=$('#mfA').checked;else body.stock=$('#mfK').value;
  api('medSave',body).then(function(r){closeSheet();return saved(r);}).catch(fail);
};

/* ---------- Records ---------- */
function recHtml(){
  var r=M.r;if(!r.from){r.from=C.add(today(),-30);r.to=today();}
  return '<div class="card" style="padding:12px"><div class="seg med-kinds">'+[['given','Given'],['teacher','By teachers'],['pending','To confirm'],['stock','Stock changes']].map(function(v){return '<button class="'+(r.view===v[0]?'on':'')+'" data-act="rcView" data-v="'+v[0]+'">'+v[1]+'</button>';}).join('')+'</div>'+
    '<div class="rec-dates"><label>From<input class="inp" type="date" id="rcFrom" value="'+esc(r.from)+'"></label><label>To<input class="inp" type="date" id="rcTo" value="'+esc(r.to)+'"></label></div>'+
    '<div class="rec-filters"><button class="selbtn" data-act="rcPerson"><span class="'+(r.person?'sb-v':'sb-ph')+'">'+esc(r.person?r.person.label:'Anyone')+'</span><i>▾</i></button><button class="selbtn" data-act="rcMed"><span class="'+(r.med?'sb-v':'sb-ph')+'">'+esc(r.med?lab(r.med):'Any medicine')+'</span><i>▾</i></button></div>'+
    '<div style="display:flex;gap:8px;margin-top:10px"><button class="btn green sm" data-act="rcGo">Show</button><button class="btn ghost sm" data-act="rcClear">Clear</button><button class="btn ghost sm" style="margin-left:auto" data-act="rcReport">Report…</button></div></div><div id="rcList"><div class="loading"></div></div>';
}
function keepRec(){var a=$('#rcFrom'),b=$('#rcTo');if(a)M.r.from=a.value;if(b)M.r.to=b.value;}
function loadRec(){
  var r=M.r;$('#rcList').innerHTML=C.skel('list');
  api('medLog',{view:r.view,from:r.from,to:r.to,personKind:r.person?r.person.kind:'',personId:r.person?r.person.id:'',medicineId:r.med?r.med.id:''}).then(function(rows){r.rows=rows;recList();}).catch(function(e){$('#rcList').innerHTML='';fail(e);});
}
function recList(){
  var rows=M.r.rows,el=$('#rcList');if(!el)return;
  if(!rows.length){el.innerHTML='<div class="empty"><b>No records</b>Nothing found for these filters.</div>';return;}
  var o='',day='',doses=0,who={};
  rows.forEach(function(x){
    if(x.date!==day){day=x.date;o+='<div class="rc-day">'+esc(longD(day))+'</div>';}
    if(x.kind==='dispense'){if(!x.voided){doses+=-x.delta;who[x.personKind+':'+(x.personId||x.person)]=1;}
      o+='<div class="rc-row'+(x.voided?' voided':'')+'"><div class="rc-t">'+esc(x.time)+'</div><div class="rc-m"><b>'+esc(x.person)+'</b> <span class="kind-chip">'+esc(KIND[x.personKind]||'')+'</span><br>'+esc(x.medicine)+' × '+(-x.delta)+(x.reason?' <small>· '+esc(x.reason)+'</small>':'')+'<br><small>'+(x.byTeacher?'recorded by teacher '+esc(x.by):'given by '+esc(x.by))+'</small>'+(x.byTeacher&&!x.voided?(x.confirmed?' <span class="kind-chip">✓ Confirmed by '+esc(x.confirmedBy)+'</span>':' <span class="kind-chip warn">Needs confirmation</span>'):'')+(x.voided?' <span class="kind-chip">Cancelled</span>':'')+(M.mode==='nurse'&&!x.voided?'<br>'+(x.byTeacher&&!x.confirmed?'<button class="mini" style="margin-top:4px;margin-right:6px" data-act="rcConfirm" data-id="'+x.id+'">Confirm taken</button>':'')+'<button class="mini" style="margin-top:4px" data-act="rcVoid" data-id="'+x.id+'" data-q="'+(-x.delta)+'">Cancel dose</button>':'')+'</div></div>';}
    else{var t=x.kind==='restock'?'Stock added +'+x.delta:x.kind==='void'?'Dose cancelled +'+x.delta:x.kind==='adjust'?'Count corrected '+(x.delta>0?'+':'')+x.delta:'Details edited';
      o+='<div class="rc-row"><div class="rc-t">'+esc(x.time)+'</div><div class="rc-m"><b>'+esc(x.medicine)+'</b><br>'+esc(t)+' → '+x.balance+' in stock'+(x.reason?' <small>· '+esc(x.reason)+'</small>':'')+'<br><small>by '+esc(x.by)+'</small></div></div>';}
  });
  var pend=rows.filter(function(x){return x.kind==='dispense'&&x.byTeacher&&!x.voided&&!x.confirmed;});
  el.innerHTML=(M.mode==='nurse'&&pend.length?'<div class="card" style="padding:12px;margin-top:10px"><b>'+pend.length+' teacher dose'+(pend.length===1?'':'s')+' to confirm</b><p class="hint" style="margin:4px 0 8px">Confirm only if the medicine really was taken from the clinic.</p><button class="btn green sm" data-act="rcConfirmAll">Confirm all '+pend.length+'</button></div>':'')+(M.r.view!=='stock'?'<p class="hint" style="margin:10px 0 0">'+doses+' dose'+(doses===1?'':'s')+' given to '+Object.keys(who).length+' '+(Object.keys(who).length===1?'person':'people')+'.'+(rows.length>=1000?' Showing the latest 1000.':'')+'</p>':'')+o;
}
H.rcVoid=function(el){
  var id=el.dataset.id;
  ask('Cancel this dose? The '+el.dataset.q+' will be added back to the stock. The record stays, marked as cancelled.',function(){
    api('medVoid',{id:id}).then(function(r){M.r.rows=null;return refresh().then(function(){toast(r.name+' has '+r.stock+' available','ok');});}).catch(fail);
  });
};
H.rcConfirm=function(el){
  api('medConfirm',{ids:[Number(el.dataset.id)]}).then(function(){M.r.rows=null;return refresh().then(function(){toast('Confirmed','ok');});}).catch(fail);
};
H.rcConfirmAll=function(){
  var ids=(M.r.rows||[]).filter(function(x){return x.kind==='dispense'&&x.byTeacher&&!x.voided&&!x.confirmed;}).map(function(x){return x.id;});
  if(!ids.length)return;
  ask('Confirm '+ids.length+' teacher dose'+(ids.length===1?'':'s')+' as taken from the clinic?',function(){
    api('medConfirm',{ids:ids}).then(function(r){M.r.rows=null;return refresh().then(function(){toast(r.confirmed+' confirmed','ok');});}).catch(fail);
  });
};
H.rcView=function(el){keepRec();M.r.view=el.dataset.v;M.r.rows=null;draw();};
H.rcGo=function(){keepRec();M.r.rows=null;loadRec();};
H.rcClear=function(){M.r.person=null;M.r.med=null;M.r.from=C.add(today(),-30);M.r.to=today();M.r.rows=null;draw();};
H.rcPerson=function(){keepRec();pickSheet('Choose a person',peopleItems(''),function(it){M.r.person=it;M.r.rows=null;draw();});};
H.rcMed=function(){keepRec();pickSheet('Choose a medicine',M.meds.map(function(m){return {id:m.id,label:lab(m),sub:m.active?'':'hidden'};}),function(it){M.r.med=medById(it.id);M.r.rows=null;draw();});};

/* ---------- Reports (print / save as PDF, or CSV) ---------- */
function q(v){v=String(v==null?'':v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;}
function csv(rows){return rows.map(function(r){return r.map(q).join(',');}).join('\r\n');}
function statusText(m){var f=flags(m);return f.length?f.map(function(x){return x[1];}).join(', '):'OK';}
function range(d){return (d.from?mdy(d.from):'start')+' to '+(d.to?mdy(d.to):'today');}
function invCols(){return M.mode==='nurse'?['Medicine','Unit','In stock','Warn at','Date purchased','Expiry','Status']:['Medicine','Unit','In stock','Warn at','Expiry','Status'];}   /* date purchased: nurse only */
function invRows(d){return d.stock.map(function(m){var r=[lab(m),m.unit,m.stock,m.low];if(M.mode==='nurse')r.push(m.purchased?mdy(m.purchased):'');r.push(m.expiry?mdy(m.expiry):'',statusText(m));return r;});}
function invHtml(d){
  return '<div class="pr"><h2>'+esc(d.org)+' · Medicine inventory</h2><p>As of '+esc(d.generatedAt)+'</p><table class="rt"><tr>'+invCols().map(function(c){return '<th>'+c+'</th>';}).join('')+'</tr>'+
    invRows(d).map(function(r){return '<tr>'+r.map(function(c,i){return '<td'+(i===2||i===3?' class="n"':'')+'>'+esc(c)+'</td>';}).join('')+'</tr>';}).join('')+'</table></div>';
}
function doseGroups(d){return [['Teachers',d.dispensing.filter(function(x){return x.personKind==='teacher';})],['Students',d.dispensing.filter(function(x){return x.personKind==='student';})],['Others',d.dispensing.filter(function(x){return x.personKind==='other';})]];}
function doseRow(x){return [mdy(x.date),x.time,x.person,x.medicine,-x.delta,x.reason,x.by];}
function doseHtml(d){
  var o='<div class="pr"><h2>'+esc(d.org)+' · Medicine given</h2><p>'+esc(range(d))+' · generated '+esc(d.generatedAt)+'</p>';
  doseGroups(d).forEach(function(g){
    if(!g[1].length&&g[0]==='Others')return;
    var people={};g[1].forEach(function(x){people[x.personId||x.person]=1;});
    o+='<h3>'+g[0]+' ('+Object.keys(people).length+' '+(Object.keys(people).length===1?'person':'people')+', '+g[1].reduce(function(s,x){return s-x.delta;},0)+' doses)</h3>';
    o+=g[1].length?'<table class="rt"><tr><th>Date</th><th>Time</th><th>Name</th><th>Medicine</th><th>Qty</th><th>Reason</th><th>Given by</th></tr>'+g[1].map(function(x){return '<tr>'+doseRow(x).map(function(c,i){return '<td'+(i===4?' class="n"':'')+'>'+esc(c)+'</td>';}).join('')+'</tr>';}).join('')+'</table>':'<p>None in this period.</p>';
  });
  return o+'</div>';
}
H.rcReport=function(){
  keepRec();
  api('medReport',{from:M.r.from,to:M.r.to}).then(function(d){
    M.rep=d;
    openSheet(shHead('Medicine reports',esc(range(d)))+
      '<div class="card" style="padding:12px;margin-bottom:10px"><b>Inventory now</b><p class="hint" style="margin:4px 0 8px">Every medicine with stock, expiry and warnings.</p><div class="acts"><button class="btn green sm" data-act="mrInvPrint">Print / PDF</button><button class="btn ghost sm" data-act="mrInvCsv">Copy / CSV</button></div></div>'+
      '<div class="card" style="padding:12px"><b>Medicine given</b><p class="hint" style="margin:4px 0 8px">Teachers and students who took medicine, '+esc(range(d))+'. '+d.dispensing.length+' record'+(d.dispensing.length===1?'':'s')+'.</p><div class="acts"><button class="btn green sm" data-act="mrDosePrint">Print / PDF</button><button class="btn ghost sm" data-act="mrDoseCsv">Copy / CSV</button></div></div>');
  }).catch(fail);
};
H.mrInvPrint=function(){C.printHtml(invHtml(M.rep));};
H.mrDosePrint=function(){C.printHtml(doseHtml(M.rep));};
H.mrInvCsv=function(){C.saveText('Medicine inventory '+M.rep.generatedAt.slice(0,10)+'.csv',csv([invCols()].concat(invRows(M.rep))));};
H.mrDoseCsv=function(){
  var rows=[['Group','Date','Time','Name','Medicine','Qty','Reason','Given by']];
  doseGroups(M.rep).forEach(function(g){g[1].forEach(function(x){rows.push([g[0].replace(/s$/,'')].concat(doseRow(x)));});});
  C.saveText('Medicine given '+M.rep.generatedAt.slice(0,10)+'.csv',csv(rows));
};

/* ---------- Settings (nurse) ---------- */
function setHtml(){
  return '<div class="card" style="padding:14px;margin-bottom:12px"><b>Message for teachers</b><p class="hint" style="margin:4px 0 8px">Shown on the teachers\' "Not feeling well?" page, for example where to find you.</p><textarea class="inp" id="stNote" rows="3" maxlength="200" placeholder="e.g. Clinic, Room 2. 8AM to 5PM"></textarea><button class="btn green sm" style="margin-top:8px" data-act="stNoteSave">Save message</button></div>'+
    '<div class="card" style="padding:14px"><b>Change my password</b><label class="lbl">Current password</label><input class="inp" type="password" id="pwO" autocomplete="current-password"><label class="lbl">New password (at least 6 characters)</label><input class="inp" type="password" id="pwN" autocomplete="new-password"><button class="btn green sm" style="margin-top:10px" data-act="stPwSave">Change password</button></div>';
}
H.stNoteSave=function(){api('medNote',{note:$('#stNote').value}).then(function(){toast('Saved','ok');}).catch(fail);};
H.stPwSave=function(){api('changePassword',{currentPassword:$('#pwO').value,newPassword:$('#pwN').value}).then(function(){$('#pwO').value='';$('#pwN').value='';toast('Password changed','ok');}).catch(fail);};
/* the message box starts with the saved text */
var setDraw=draw;draw=function(){setDraw();if(M.tab==='set'&&M.mode==='nurse'&&$('#stNote'))api('medAvailability').then(function(d){var n=$('#stNote');if(n&&!n.value)n.value=d.note||'';}).catch(function(){});};

C.med={mount:mount,go:go};
})(window.CWA);
