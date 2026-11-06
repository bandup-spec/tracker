/* teacher.html: teacher screen. Loaded after login by the server's getModule action (teachers only). */
(function(C){
'use strict';
var S=C.S,T=C.T,H=C.H,CH=C.CH,$=C.$,app=C.app,esc=C.esc,api=C.api,fail=C.fail,toast=C.toast,
    isRO=C.isRO,weekBar=C.weekBar,weekEmpty=C.weekEmpty,actionBar=C.actionBar,gridHtml=C.gridHtml,drawerHtml=C.drawerHtml,
    loadWeek=C.loadWeek,monday=C.monday,today=C.today;

function menuItems(){
  var m=[{label:'Lesson Trackers',doo:'lessonOpen'},{label:'My schedule',doo:'tvMine'},{label:"Other teachers' schedules",doo:'tvOthers'},{label:'This week',doo:'wkToday'}];
  if(!isRO())m.push({label:'Copy week',doo:'copyMenu'});
  m.push({label:'Refresh',doo:'wkRefresh'},{label:'Report a problem',doo:'reportProblem'});
  return m;
}
function renderTeacher(){
  var nm=S.user.name,ro=isRO();
  var o='<div class="t-wrap"><div class="t-top"><button class="iconbtn burger" data-act="menu" aria-label="Open menu">☰</button><div class="namebox">'+esc(/^teacher/i.test(nm)?nm:'Teacher '+nm)+'</div><button class="iconbtn so" data-act="logout" aria-label="Sign out">Sign out</button></div>'+
    '<div class="seg tv-seg"><button data-act="tvMine" class="'+(ro?'':'on')+'">My schedule</button><button data-act="tvOthers" class="'+(ro?'on':'')+'">Other teachers</button></div><button class="btn green sm block" data-act="lessonOpen" style="margin-bottom:10px">Lesson Trackers</button>';
  if(ro)o+='<select class="inp" data-ch="tvSel" style="margin-bottom:10px" aria-label="Choose a teacher">'+T.teachers.map(function(x){return '<option value="'+esc(x.id)+'"'+(x.id===T.tid?' selected':'')+'>'+esc(x.name)+'</option>';}).join('')+'</select><div class="ro-note">View only: you can look at this schedule but not change it.</div>';
  app.innerHTML=o+weekBar()+weekEmpty()+actionBar()+gridHtml()+'</div>'+drawerHtml(menuItems());
}

/* switching between my own schedule and other teachers' (view only) */
H.tvMine=function(){if(!isRO())return;T.tid=S.user.id;loadWeek(T.ws);};
H.tvOthers=function(){
  if(isRO())return;
  api('teacherList').then(function(list){
    T.teachers=list.filter(function(x){return x.id!==S.user.id;});
    if(!T.teachers.length){toast('No other teachers yet.');return;}
    T.tid=(T.last&&T.teachers.some(function(x){return x.id===T.last;}))?T.last:T.teachers[0].id;
    return loadWeek(T.ws);
  }).catch(fail);
};
CH.tvSel=function(el){T.tid=el.value;T.last=el.value;loadWeek(T.ws);};

C.render=renderTeacher;
C.mount=function(){T.tid=S.user.id;loadWeek(monday(today()));};
})(window.CWA);
