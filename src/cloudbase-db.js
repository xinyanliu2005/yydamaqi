/* ===================== CloudBase 房间存储 ===================== */
/* 取代之前的 Firebase Firestore（对中国大陆用户不可达）。CloudBase 的浏览器端
   SDK 不支持数据库事务——事务只有云函数那一侧（node-sdk）才有，所以这里的写操作
   全部通过调用云函数 applyGameAction 完成（见 cloudfunctions/applyGameAction/），
   由云函数在事务里原子地"读最新状态 -> 跑 mutator -> 写回"。浏览器这一侧只负责：
   - 读 / 实时监听房间文档（直接读数据库，不需要经过云函数）
   - 把"要做什么操作、带什么参数"转发给云函数

   CloudBase 的浏览器 SDK 是通过 <script> 标签挂到全局变量 window.cloudbase 上的
   （见 index.html），不是 ES module，所以这里直接用这个全局变量，不需要 import。 */

import { CLOUDBASE_ENV_ID } from './cloudbase-config.js';

var app = null;
var db = null;
var authPromise = null;

/* 第一次用到数据库之前，先初始化 SDK 并完成匿名登录——CloudBase 的安全规则
   即使写"任何人都能读写"，也要求调用方先有一个身份（哪怕是匿名的）。 */
function ensureReady(){
  if(!authPromise){
    if(!window.cloudbase){
      authPromise = Promise.reject(new Error('CloudBase SDK 未加载，请检查 index.html 里的 <script> 标签'));
    } else {
      app = window.cloudbase.init({ env: CLOUDBASE_ENV_ID });
      db = app.database();
      authPromise = app.auth.signInAnonymously();
    }
  }
  return authPromise;
}

function gameCollection(){ return db.collection('games'); }

/* 把 CloudBase 的返回结果包成和以前 Firestore 版本一样的形状（{exists, data()}），
   这样 app.js 里读快照的代码不用大改。 */
function wrapDocList(docs){
  var found = docs && docs.length>0;
  return { exists: found, data: function(){ return found ? docs[0] : undefined; } };
}

export function getGame(code){
  return ensureReady().then(function(){
    return gameCollection().doc(code).get();
  }).then(function(res){
    return wrapDocList(res && res.data);
  });
}

export function subscribeGame(code, onNext, onError){
  var watcher = null;
  var closed = false;
  ensureReady().then(function(){
    if(closed) return; /* 还没连上就被取消订阅了 */
    watcher = gameCollection().doc(code).watch({
      onChange: function(snapshot){ onNext(wrapDocList(snapshot && snapshot.docs)); },
      onError: onError
    });
  }).catch(onError);
  return function unsubscribe(){
    closed = true;
    if(watcher) watcher.close();
  };
}

/* mutatorName + args 会原样转发给云函数，由它决定跑哪个 mutator。返回值统一是
   {ok:true} 或 {ok:false, error}，和之前 withGameLock 的约定一致。 */
export function runGameTransaction(code, mutatorName, args){
  return ensureReady().then(function(){
    return app.callFunction({ name:'applyGameAction', data:{ code:code, action:mutatorName, args:args||[] } });
  }).then(function(res){
    var result = res && res.result;
    if(!result || typeof result.ok !== 'boolean'){
      return { ok:false, error:'云函数没有返回预期结果，请检查是否已正确部署 applyGameAction' };
    }
    return result;
  }).catch(function(e){
    return { ok:false, error:'网络异常，请重试：'+(e && e.message ? e.message : e) };
  });
}

export function createRoom(code, initialData){
  return runGameTransaction(code, 'createRoom', [initialData]);
}
