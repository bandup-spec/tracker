/* nurse.js: the nurse's screen (role "nurse"). Medicine features only; the screens live in medicine.js. */
(function(C){
'use strict';
var S=C.S,H=C.H,$=C.$,app=C.app,esc=C.esc;
function menuItems(){return [{label:'Give medicine',doo:'nvGive'},{label:'Stock',doo:'nvStock'},{label:'Records',doo:'nvRec'},{label:'Settings',doo:'nvSet'},{label:'Report a problem',doo:'reportProblem'}];}
H.nvGive=function(){C.med.go('give');};
H.nvStock=function(){C.med.go('stock');};
H.nvRec=function(){C.med.go('rec');};
H.nvSet=function(){C.med.go('set');};
C.render=function(){};   /* nothing to redraw: the medicine module draws itself */
C.mount=function(){
  app.innerHTML='<div class="t-wrap"><div class="t-top"><button class="iconbtn burger" data-act="menu" aria-label="Open menu">☰</button><div class="namebox"><button class="av-btn" data-act="myPhoto" aria-label="My photo">'+C.avatar('admin',S.user.id,S.user.name,30)+'</button> Nurse '+esc(S.user.name)+'</div><button class="iconbtn so" data-act="logout" aria-label="Sign out">Sign out</button></div><div id="medRoot">'+C.skel('list')+'</div></div>'+C.drawerHtml(menuItems());
  C.loadJs('medicine.js').then(function(){C.med.mount($('#medRoot'),'nurse');}).catch(C.fail);
};
})(window.CWA);
