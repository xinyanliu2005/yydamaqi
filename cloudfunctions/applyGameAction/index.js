/* ===================== 云函数：applyGameAction ===================== */
/* 浏览器不直接写数据库——CloudBase 的数据库事务只有 node-sdk（也就是云函数这一侧）
   才支持，客户端 SDK 没有对应能力。所以所有"读最新状态 -> 跑 mutator -> 写回"的
   操作都改成浏览器调用这个云函数（app.callFunction），由云函数在事务里原子地完成，
   避免多个玩家同时操作互相覆盖（比如两个人同时在商店买卡）。

   event 的形状：
   - 创建房间：{ code, action:'createRoom', args:[initialRoomData] }
   - 其余所有操作：{ code, action:'mutXxx', args:[...mutXxx 除 data 以外的参数] }
     （比如 mutJoin(data, id, name, hero) 对应 args:[id, name, hero]）

   返回 { ok:true } 或 { ok:false, error:'...' }，和之前 withGameLock 的约定一致。 */
"use strict";
var tcb = require('@cloudbase/node-sdk');
var gameLogic = require('./game-logic-bundle.js');

var MUTATORS = {
  mutJoin: gameLogic.mutJoin,
  mutSetHero: gameLogic.mutSetHero,
  mutKick: gameLogic.mutKick,
  mutStart: gameLogic.mutStart,
  mutUseSkill: gameLogic.mutUseSkill,
  mutPlayCard: gameLogic.mutPlayCard,
  mutBuyCard: gameLogic.mutBuyCard,
  mutSellCard: gameLogic.mutSellCard,
  mutRefreshStore: gameLogic.mutRefreshStore,
  mutRoll: gameLogic.mutRoll,
  mutEndTurn: gameLogic.mutEndTurn
};

exports.main = async function(event, context){
  var app = tcb.init({ env: tcb.SYMBOL_CURRENT_ENV });
  var db = app.database();

  var code = event && event.code;
  var action = event && event.action;
  var args = (event && event.args) || [];

  if(!code || typeof code !== 'string'){
    return { ok:false, error:'缺少房间号' };
  }

  /* 创建房间不需要"先读现有状态"，直接整份写入新文档即可；理论上两个人同时
     生成完全相同的随机房间号概率极低，这里不做额外的冲突检测。 */
  if(action === 'createRoom'){
    var initial = args[0];
    if(!initial || initial.code !== code){
      return { ok:false, error:'房间数据无效' };
    }
    try{
      await db.collection('games').doc(code).set(initial);
      return { ok:true };
    }catch(e){
      return { ok:false, error:'创建房间失败：'+(e && e.message ? e.message : e) };
    }
  }

  var mutatorFn = MUTATORS[action];
  if(!mutatorFn){
    return { ok:false, error:'未知操作：'+action };
  }

  var transaction = await db.startTransaction();
  try{
    var docRef = transaction.collection('games').doc(code);
    var snap = await docRef.get();
    var existing = snap && snap.data && snap.data[0];
    if(!existing){
      await transaction.rollback(new Error('房间不存在或已被删除'));
      return { ok:false, error:'房间不存在或已被删除' };
    }

    var data = JSON.parse(JSON.stringify(existing));
    var result;
    try{
      result = mutatorFn.apply(null, [data].concat(args));
    }catch(e){
      await transaction.rollback(e);
      return { ok:false, error:'操作失败：'+(e && e.message ? e.message : e) };
    }
    if(result.error){
      await transaction.rollback(new Error(result.error));
      return { ok:false, error:result.error };
    }

    /* 用 update 而不是 set：事务里的文档引用没有确认过 set()（完整覆盖）一定可用，
       但 update() 是确认可用的。我们的 mutator 从不删除顶层字段（只会重新赋值），
       所以传完整的 result.data 进 update() 效果上等同于整份覆盖。 */
    await docRef.update(result.data);
    await transaction.commit();
    return { ok:true };
  }catch(e){
    try{ await transaction.rollback(e); }catch(ignore){}
    return { ok:false, error:'操作失败，请重试：'+(e && e.message ? e.message : e) };
  }
};
