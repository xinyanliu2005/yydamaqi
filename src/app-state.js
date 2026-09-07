/* ===================== 运行时状态 ===================== */
/* 用一个共享对象承载可变的运行时状态，这样 app.js（写状态）和 render.js（读状态）
   都可以 import 同一份引用，不需要互相调用 setter。 */

import { uid } from './utils.js';

/* 身份用 sessionStorage（每个标签页独立），而不是 localStorage（同一浏览器的所有
   标签页共用）——这样在同一台电脑上开多个标签页测试时，每个标签页会被当成不同的人；
   同一个标签页里刷新页面则会保留同一个身份，方便断线后回到原来的位置。 */
var myId = sessionStorage.getItem('lq_myid') || uid();
sessionStorage.setItem('lq_myid', myId);

export var runtime = {
  db: null,
  myId: myId,
  myRoom: null,
  game: null,
  unsub: null,
  ui: { error:'', homeMode:'create', selectedHero:'tianquan', pendingTarget:null, pendingChoice:null, joining:false, gameTab:'board' }
};

export function paramRoom(){
  try{
    var sp=new URLSearchParams(location.search);
    var r=sp.get('room');
    return r? r.toUpperCase() : '';
  }catch(e){ return ''; }
}
