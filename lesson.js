/* lesson.html: Lesson Trackers. Fetched on first use by H.lessonOpen (index.html) through the lessonModule action; both roles.
   Students per slot come from the same roster as attendance (tap a name = the same search popup). Book / Unit / Notes save as you pick. */
(function(C){
'use strict';
var S=C.S,T=C.T,H=C.H,CH=C.CH,$=C.$,esc=C.esc,api=C.api,fail=C.fail,toast=C.toast,HL=C.HL,DOW=C.DOW,
    openSheet=C.openSheet,closeSheet=C.closeSheet,shHead=C.shHead,isRO=C.isRO,weekBar=C.weekBar,loadWeek=C.loadWeek,
    weekDates=C.weekDates,rowInfo=C.rowInfo,namesText=C.namesText,monday=C.monday,today=C.today,isOff=C.isOff,holOf=C.holOf,dow=C.dow,longD=C.longD;
var L={carry:{},init:null,teachers:[],sh:null,prev:null,key:'',seq:0,data:null,q:Promise.resolve(),bsh:null};

/* ---------- helpers ---------- */
var OTHER='OTHER';
function freeText(b){var k=book(b);return b===OTHER||!!(k&&!k.units.length);}   /* Others, or a book with no units listed: teacher types it */
function book(id){return L.init.books.filter(function(b){return b.id===id;})[0];}
function hours(){var camp=S.boot.camp?S.boot.campHours:[];return L.init.hours.concat(camp).filter(function(h,i,a){return a.indexOf(h)===i;}).sort(function(a,b){return a-b;});}
function bookOpts(sel){
  var o='<option value="">Book</option>'+L.init.books.filter(function(b){return b.active||b.id===sel;}).map(function(b){return '<option value="'+esc(b.id)+'"'+(b.id===sel?' selected':'')+'>'+esc(b.title)+'</option>';}).join('');
  o+='<option value="'+OTHER+'"'+(sel===OTHER?' selected':'')+'>Others (type it)</option>';
  if(sel&&sel!==OTHER&&!book(sel))o+='<option value="'+esc(sel)+'" selected>(removed book)</option>';
  return o;
}
function unitOpts(bid,sel,hint){
  var b=book(bid),u=b?b.units.slice():[];
  if(sel&&u.indexOf(sel)<0)u.push(sel);
  return '<option value="">'+(bid?(u.length?'Unit/Chapter'+(hint?' (last: '+esc(hint)+')':''):'No units listed'):'Unit/Chapter')+'</option>'+u.map(function(x){return '<option value="'+esc(x)+'"'+(x===sel?' selected':'')+'>'+esc(x)+'</option>';}).join('');
}

/* ---------- open / load / draw ---------- */
function open(){
  Promise.all([
    L.teachers.length?0:api('teacherList').then(function(l){L.teachers=l;}),
    api('lessonInit').then(function(d){L.init=d;})
  ]).then(function(){
    if(!L.teachers.length){toast('No teachers yet.');return;}
    if(!L.teachers.some(function(x){return x.id===T.tid;}))
      T.tid=S.user.role==='teacher'?S.user.id:(L.teachers.filter(function(x){return x.active;})[0]||L.teachers[0]).id;
    L.prev=C.render;C.render=draw;L.key='';L.data=null;
    L.sh=openSheet('<div class="loading">Loading…</div>',{full:true});
    var mo=new MutationObserver(function(){   /* sheet closed (X, outside tap, Esc): hand the screen back to the page underneath */
      if(document.body.contains(L.sh))return;
      mo.disconnect();C.render=L.prev;if(C.render)C.render();
    });
    mo.observe(document.body,{childList:true});
    return loadWeek(T.ws||monday(today()));
  }).catch(fail);
}
function draw(){
  if(!L.sh||!document.body.contains(L.sh))return;
  var k=T.tid+'|'+T.ws;
  if(L.key!==k){
    L.key=k;L.data=null;var s=++L.seq;
    api('getLessons',{teacherId:T.tid,weekStart:T.ws}).then(function(d){if(s!==L.seq)return;L.data=d.lessons;L.carry=d.carry||{};paint();}).catch(function(e){L.key='';fail(e);});
  }
  paint();
}
function paint(){
  if(!L.sh||!document.body.contains(L.sh)||!T.data)return;
  var ro=isRO(),adm=S.user.role==='admin';
  L.sh.innerHTML=shHead('Lesson Trackers',ro?'View only':'Saves as you go')+
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px"><select class="inp" data-ch="lsTeacher" style="flex:1 1 200px" aria-label="Choose a teacher">'+
    L.teachers.map(function(x){return '<option value="'+esc(x.id)+'"'+(x.id===T.tid?' selected':'')+'>'+esc(x.name)+(x.id===S.user.id?' (me)':'')+'</option>';}).join('')+'</select>'+
    (adm?'<button class="btn ghost sm" data-act="lsBooks">Manage books</button>':'')+'<button class="btn ghost sm" data-act="lsRefresh">Refresh</button></div>'+
    weekBar()+
    (L.init.books.some(function(b){return b.active;})?'':'<div class="banner"><span>'+(adm?'No books yet. Tap Manage books to add your first one.':'No books yet. Ask the admin to add the books.')+'</span></div>')+
    (L.data?grid(ro):'<div class="loading">Loading lessons…</div>')+
    '<div class="hint">Tap a name to change who is in that hour (same list as attendance). Pick the <b>Book</b> once: it carries forward (blue italics) to the next days and weeks until you choose another, and earlier days stay as they were. Then set the <b>Unit/Chapter</b> and tap <b>Notes</b>.</div>';
}
function grid(ro){
  var ds=weekDates(),t=today();
  var o='<div class="tw lt"><table class="tg t-grid"><colgroup><col style="width:46px"><col style="width:120px">'+ds.map(function(){return '<col>';}).join('')+'</colgroup><thead><tr><th class="c-time">TIME</th><th class="c-nm" style="text-align:center">STUDENT</th>'+
    ds.map(function(d){var hl=holOf(d);return '<th class="'+(d===t?'today ':'')+(isOff(d)?'off':'')+'">'+DOW[dow(d)]+'<small>'+d.slice(8)+(hl&&!isOff(d)?' ★':'')+'</small></th>';}).join('')+'</tr></thead><tbody>';
  hours().forEach(function(h){
    var ri=rowInfo(h),txt=namesText(ri.ids),cr=L.carry[h]||null;
    o+='<tr><td class="c-time" style="font-weight:800;font-size:12px">'+HL[h]+'</td><td class="nm'+(txt?'':' none')+'" data-act="pick" data-h="'+h+'">'+(txt?esc(txt)+(ri.varies?'<span class="v">varies</span>':''):(ro?'':'+ Add student'))+'</td>'+
      ds.map(function(d){
        if(isOff(d))return '<td class="off"></td>';
        var k=d+'|'+h;
        if(!(T.data.roster[k]||[]).length)return '<td class="lempty" data-act="cell" data-d="'+d+'" data-h="'+h+'">·</td>';
        var x=L.data[k]||{},inh=false,hint='';   /* a book carries forward until a later day sets a new one */
        if(x.b)cr={b:x.b,u:x.u};else if(cr){inh=true;hint=cr.u||'';x=Object.assign({},x,{b:cr.b});}
        return cell(d,h,x,ro,inh,hint);
      }).join('')+'</tr>';
  });
  return o+'</tbody></table></div>';
}
function cell(d,h,x,ro,inh,hint){
  var at=' data-d="'+d+'" data-h="'+h+'"',dis=ro?' disabled':'';
  return '<td class="lcell">'+
    '<select class="ls'+(inh?' inh':'')+'" data-ch="lsBook"'+at+dis+' aria-label="Book">'+bookOpts(x.b)+'</select>'+
    (freeText(x.b)?'<input class="ls" data-ch="lsUnit"'+at+dis+' maxlength="100" value="'+esc(x.u||'')+'" placeholder="'+(x.b===OTHER?'Book &amp; unit (type)':'Unit/Chapter (type)')+(hint?' · last: '+esc(hint):'')+'" aria-label="Unit or chapter">'
      :'<select class="ls" data-ch="lsUnit"'+at+(ro||!x.b?' disabled':'')+' aria-label="Unit or chapter">'+unitOpts(x.b,x.u,hint)+'</select>')+
    '<button class="ln'+(x.n?' on':'')+'" data-act="lsNote"'+at+(x.n?' title="'+esc(x.n.slice(0,200))+'"':'')+'>'+(x.n?'Notes ✓':(ro?'No notes':'+ Notes'))+'</button></td>';
}

/* ---------- saving (optimistic, one at a time and in order) ---------- */
function save(d,h,patch){
  var k=d+'|'+h,old=L.data[k],x=Object.assign({b:'',u:'',n:''},old,patch);
  L.data[k]=x;paint();
  L.q=L.q.then(function(){return api('saveLesson',{teacherId:T.tid,date:d,hour:h,bookId:x.b,unit:x.u,notes:x.n});}).catch(function(e){
    if(old)L.data[k]=old;else delete L.data[k];paint();fail(e);
  });
}
CH.lsBook=function(el){save(el.dataset.d,+el.dataset.h,{b:el.value,u:''});};
function bookOf(d,h){var s=L.sh.querySelector('select[data-ch="lsBook"][data-d="'+d+'"][data-h="'+h+'"]');return s?s.value:'';}   /* book shown in the cell, saved or carried */
CH.lsUnit=function(el){save(el.dataset.d,+el.dataset.h,{b:bookOf(el.dataset.d,el.dataset.h),u:el.value});};
CH.lsTeacher=function(el){T.tid=el.value;T.last=el.value;loadWeek(T.ws);};
H.lsRefresh=function(){L.key='';loadWeek(T.ws);};

/* ---------- notes popup ---------- */
H.lsNote=function(el){
  var d=el.dataset.d,h=+el.dataset.h,k=d+'|'+h,x=L.data[k]||{},ro=isRO(),b=book(x.b);
  var who=(T.data.roster[k]||[]).map(function(id){var s=T.stu[id];return s?s.name:'(removed)';}).join(', ');
  openSheet(shHead('Lesson notes',esc(longD(d)+' · '+HL[h]))+
    '<div class="hint" style="margin:0 0 8px">'+esc(who)+(b?'<br>'+esc(b.title)+(x.u?' · '+esc(x.u):''):'')+'</div>'+
    '<label class="lbl">What was covered / finished</label><textarea class="inp" id="lnText" rows="8" maxlength="2000"'+(ro?' readonly':'')+' placeholder="e.g. Finished reading passage 2, reviewed past tense, homework: p.14"></textarea>'+
    '<div class="sh-f"><button class="btn ghost" data-act="closeSheet">'+(ro?'Close':'Cancel')+'</button>'+(ro?'':'<button class="btn green" data-act="lnSave" data-d="'+d+'" data-h="'+h+'">Save</button>')+'</div>');
  $('#lnText').value=x.n||'';
  if(!ro)$('#lnText').focus();
};
H.lnSave=function(el){var v=$('#lnText').value;closeSheet();save(el.dataset.d,+el.dataset.h,{b:bookOf(el.dataset.d,el.dataset.h),n:v});};

/* ---------- admin: books ---------- */
function booksHtml(){
  var l=L.init.books;
  return shHead('Books','Used in the Book and Unit/Chapter dropdowns')+
    '<div class="sh-f" style="margin:0 0 10px"><button class="btn green" data-act="bkEdit" data-id="">+ Add book</button><button class="btn ghost" data-act="bkSeed">Load starter books</button></div>'+
    (l.length?l.map(function(b){
      return '<div class="mk-row"><div class="mk-name">'+esc(b.title)+(b.active?'':' <small>(hidden)</small>')+'<br><small>'+b.units.length+' units/chapters</small></div>'+
        '<button class="btn ghost sm" data-act="bkEdit" data-id="'+esc(b.id)+'">Edit</button> <button class="btn ghost sm" data-act="bkTog" data-id="'+esc(b.id)+'">'+(b.active?'Hide':'Show')+'</button></div>';
    }).join(''):'<div class="empty"><b>No books yet</b>Add a book and list its units or chapters.</div>');
}
function books(){api('lessonInit').then(function(d){L.init=d;L.bsh=openSheet(booksHtml());}).catch(fail);}
function afterBook(){return api('lessonInit').then(function(d){L.init=d;if(L.bsh&&document.body.contains(L.bsh))L.bsh.innerHTML=booksHtml();paint();});}
H.bkEdit=function(el){
  var b=book(el.dataset.id)||{};
  openSheet(shHead(b.id?'Edit book':'Add book')+
    '<label class="lbl">Book title</label><input class="inp" id="bkT" value="'+esc(b.title||'')+'" autocomplete="off">'+
    '<label class="lbl">Units / Chapters</label><textarea class="inp" id="bkU" rows="4" placeholder="Unit 1-12   or   Intro, Chapter 1, Chapter 2">'+esc(b.unitsText||'')+'</textarea>'+
    '<div class="hint">Separate with commas. A range with a space, like Unit 1-12, fills in Unit 1, Unit 2 … Unit 12.</div>'+
    '<div class="sh-f"><button class="btn ghost" data-act="closeSheet">Cancel</button><button class="btn green" data-act="bkSave" data-id="'+esc(b.id||'')+'">Save</button></div>');
};
H.bkSave=function(el){
  api('saveBook',{id:el.dataset.id,title:$('#bkT').value,units:$('#bkU').value}).then(function(){closeSheet();toast('Saved','ok');return afterBook();}).catch(fail);
};
H.bkSeed=function(){
  if(!confirm('Add the starter list (Evolve, Face2face, Prepare, Super Minds, TOEIC, IELTS, TOEFL, Working Holiday, Business English, Supplementary)? Books you already have are kept.'))return;
  api('seedBooks').then(function(r){toast('Added '+r.added+', updated '+r.updated,'ok');return afterBook();}).catch(fail);
};
H.bkTog=function(el){
  var b=book(el.dataset.id);if(!b)return;
  api('saveBook',{id:b.id,title:b.title,units:b.unitsText,active:!b.active}).then(afterBook).catch(fail);
};

C.lesson={open:open,books:books};
H.lessonOpen=open;H.lsBooks=books;
})(window.CWA);
