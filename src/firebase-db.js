/* ===================== Firebase / Firestore 房间存储 ===================== */
/* 取代之前 Claude Artifact 的 `window.claude.use('db')` 能力——同样是"一个房间
   一份 JSON 文档"的模型，所以上层（app.js）用到的接口尽量保持和以前一致：
   getGame / setGame / subscribeGame / runGameTransaction。

   用 Firestore 的事务（runTransaction）取代原来自己手写的"读最新 -> 跑 mutator ->
   写回"乐观锁（acquire + 重试 + sleep）——事务本身就保证原子性，多个人同时操作
   时 Firestore 会自动重试，不需要我们自己再写一套锁。 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js';
import {
  getFirestore, doc, getDoc, setDoc, onSnapshot, runTransaction
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

var app = initializeApp(firebaseConfig);
export var firestore = getFirestore(app);

function gameDocRef(code){ return doc(firestore, 'games', code); }

/* 把 Firestore 的 DocumentSnapshot 包成和之前 Claude db 能力同样形状的对象
   （{exists, data()}），这样 app.js 里读快照的代码不用大改。 */
function wrapSnap(snap){
  return { exists: snap.exists(), data: function(){ return snap.data(); } };
}

export function getGame(code){
  return getDoc(gameDocRef(code)).then(wrapSnap);
}

export function setGame(code, data){
  return setDoc(gameDocRef(code), data);
}

export function subscribeGame(code, onNext, onError){
  return onSnapshot(gameDocRef(code), function(snap){ onNext(wrapSnap(snap)); }, onError);
}

/* mutatorFn 的约定和之前完全一样：接收克隆后的房间数据，返回 {data} 表示成功写回，
   返回 {error} 表示失败（不写回）。这里额外包一层 {ok:true}/{ok:false,error} 方便
   调用方统一处理。 */
export function runGameTransaction(code, mutatorFn){
  var ref = gameDocRef(code);
  return runTransaction(firestore, function(tx){
    return tx.get(ref).then(function(snap){
      if(!snap.exists()) return { ok:false, error:'房间不存在或已被删除' };
      var data = JSON.parse(JSON.stringify(snap.data()));
      var result;
      try{ result = mutatorFn(data); }
      catch(e){ return { ok:false, error:'操作失败：'+(e&&e.message?e.message:e) }; }
      if(result.error) return { ok:false, error:result.error };
      tx.set(ref, result.data);
      return { ok:true };
    });
  }).catch(function(e){
    return { ok:false, error:'操作失败，请重试：'+(e&&e.message?e.message:e) };
  });
}
