/* ===================== 入口：DB 读写、房间管理、事件委托、启动 ===================== */

import { CARDS, HEROES } from './data.js';
import { roomCode } from './utils.js';
import { findPlayer, newPlayer } from './game-logic.js';
import { hasActiveSkipTurn } from './mutators.js';
import { render } from './render.js';
import { runtime, paramRoom } from './app-state.js';
import { getGame, subscribeGame, runGameTransaction, createRoom as cbCreateRoom } from './cloudbase-db.js';
import { CLOUDBASE_ENV_ID } from './cloudbase-config.js';

var app=document.getElementById('app');

function draw(){ render(app); }

/* 所有会改动房间状态的操作都转发给云函数 applyGameAction（见 cloudbase-db.js 里的
   runGameTransaction）——CloudBase 的浏览器端 SDK 不支持数据库事务，只有云函数
   那一侧才有，所以"读最新状态 -> 跑 mutator -> 写回"必须放在服务端做，浏览器这边
   只负责告诉它"用哪个 mutator、传哪些参数"。mutatorName 要和
   cloudfunctions/applyGameAction/index.js 里 MUTATORS 表的 key 对上。 */
function withGameLock(code, mutatorName, args){
  return runGameTransaction(code, mutatorName, args);
}

function showError(msg){
  runtime.ui.error = msg;
  draw();
  setTimeout(function(){ if(runtime.ui.error===msg){ runtime.ui.error=''; draw(); } }, 3200);
}

function runAction(promiseFn){
  promiseFn().then(function(res){
    if(res && res.ok===false) showError(res.error||'操作失败');
  });
}

/* ===================== 房间创建 / 加入 / 订阅 ===================== */
function createRoom(name, heroKey){
  if(!runtime.db) return;
  var code=roomCode();
  var initial={
    code:code, status:'lobby', createdAt:Date.now(), hostId:runtime.myId,
    players:[newPlayer(runtime.myId,name,heroKey)],
    turnOrder:[], turnIndex:0,
    turnState:{rolled:false, skillUsed:false, lastRoll:null},
    log:[{ts:Date.now(), text:'房间创建，等待玩家加入…'}],
    winner:null
  };
  cbCreateRoom(code, initial).then(function(res){
    if(res.ok===false){ showError(res.error||'创建房间失败，请重试'); return; }
    enterRoom(code);
  });
}

function joinRoom(code, name, heroKey){
  if(!runtime.db) return;
  code=code.toUpperCase().trim();
  if(!code){ showError('请输入房间号'); return; }
  runtime.ui.joining=true; draw();
  getGame(code).then(function(snap){
    if(!snap.exists){ runtime.ui.joining=false; showError('房间不存在，请检查房间号'); return; }
    return withGameLock(code, 'mutJoin', [runtime.myId, name, heroKey]).then(function(res){
      runtime.ui.joining=false;
      if(res.ok===false){ showError(res.error); return; }
      enterRoom(code);
    });
  }).catch(function(){ runtime.ui.joining=false; showError('加入房间失败，请重试'); });
}

function enterRoom(code){
  runtime.myRoom=code;
  history.replaceState(null,'',location.pathname+'?room='+code);
  if(runtime.unsub) runtime.unsub();
  runtime.unsub = subscribeGame(code, function(snap){
    if(!snap.exists){ runtime.game=null; showError('房间已关闭'); leaveRoom(); return; }
    runtime.game = snap.data();
    draw();
  }, function(){ showError('连接中断，正在重试…'); });
  draw();
}

function leaveRoom(){
  if(runtime.unsub){ runtime.unsub(); runtime.unsub=null; }
  runtime.myRoom=null; runtime.game=null; runtime.ui.pendingTarget=null;
  history.replaceState(null,'',location.pathname);
  draw();
}

/* ===================== 事件委托 ===================== */
app.addEventListener('click', function(e){
  var el=e.target.closest('[data-action]');
  if(!el) return;
  var action=el.getAttribute('data-action');
  var ui=runtime.ui, myId=runtime.myId, myRoom=runtime.myRoom, game=runtime.game;

  if(action==='home-mode'){ ui.homeMode=el.getAttribute('data-mode'); draw(); return; }
  if(action==='pick-hero'){ ui.selectedHero=el.getAttribute('data-hero'); draw(); return; }
  if(action==='create-room'){
    var nm=(document.getElementById('nameInput')||{}).value || '';
    nm=nm.trim();
    if(!nm){ showError('请输入昵称'); return; }
    createRoom(nm, ui.selectedHero);
    return;
  }
  if(action==='join-room'){
    var nm2=(document.getElementById('nameInput')||{}).value || '';
    var code=(document.getElementById('codeInput')||{}).value || '';
    nm2=nm2.trim();
    if(!nm2){ showError('请输入昵称'); return; }
    joinRoom(code, nm2, ui.selectedHero);
    return;
  }
  if(action==='set-hero-lobby'){
    var hk=el.getAttribute('data-hero');
    runAction(function(){ return withGameLock(myRoom, 'mutSetHero', [myId,hk]); });
    return;
  }
  if(action==='kick'){
    var tid=el.getAttribute('data-id');
    runAction(function(){ return withGameLock(myRoom, 'mutKick', [myId,tid]); });
    return;
  }
  if(action==='start-game'){
    runAction(function(){ return withGameLock(myRoom, 'mutStart', [myId]); });
    return;
  }
  if(action==='leave'){ leaveRoom(); return; }

  if(action==='copy-link'){
    var link=location.origin+location.pathname+'?room='+myRoom;
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(link).then(function(){
        el.textContent='已复制！';
        setTimeout(function(){ el.textContent='复制邀请链接'; }, 1600);
      }).catch(function(){ /* 静默失败，用户可手动选择房间号 */ });
    }
    return;
  }

  if(action==='use-skill'){
    var me=findPlayer(game, myId);
    if(!me) return;
    if(me.hero==='zuihuayin'){
      var opponents=game.players.filter(function(p){ return p.id!==myId; });
      if(opponents.length===0) return;
      if(opponents.length===1){
        runAction(function(){ return withGameLock(myRoom, 'mutUseSkill', [myId,opponents[0].id]); });
      } else {
        ui.pendingTarget={ kind:'skill', title:'花醉三千 · 选择目标', confirmAction:function(tid){
          return withGameLock(myRoom, 'mutUseSkill', [myId,tid]);
        }};
        draw();
      }
    } else {
      runAction(function(){ return withGameLock(myRoom, 'mutUseSkill', [myId,null]); });
    }
    return;
  }

  if(action==='play-card'){
    var cuid=el.getAttribute('data-uid');
    var ckey=el.getAttribute('data-key');
    var cdef=CARDS[ckey];
    if(cdef && cdef.choice){
      /* 目前只有"跳X格"这一种选择类型，选项直接来自卡牌定义 */
      ui.pendingChoice={ title:cdef.name+' · 选择跳跃格数', options:cdef.choice.options.map(function(n){ return {label:'+'+n+'格', value:n}; }),
        confirmAction:function(v){
          return withGameLock(myRoom, 'mutPlayCard', [myId,cuid,null,{jumpAmount:v}]);
        }};
      draw();
      return;
    }
    if(cdef && cdef.needsTarget){
      var me0=findPlayer(game, myId);
      var opps=game.players.filter(function(p){ return p.id!==myId; });
      if(cdef.targetRange!=null){
        opps=opps.filter(function(p){ return Math.abs(p.position-me0.position)<=cdef.targetRange; });
      }
      if(cdef.surpriseAttack){
        opps=opps.filter(function(p){ return !hasActiveSkipTurn(p); });
      }
      if(opps.length===0){ showError('范围内没有可选目标（或对方都处于保护状态）'); return; }
      if(opps.length===1){
        runAction(function(){ return withGameLock(myRoom, 'mutPlayCard', [myId,cuid,opps[0].id]); });
      } else {
        ui.pendingTarget={ kind:'card', title:cdef.name+' · 选择目标', candidates:opps, confirmAction:function(tid){
          return withGameLock(myRoom, 'mutPlayCard', [myId,cuid,tid]);
        }};
        draw();
      }
    } else {
      runAction(function(){ return withGameLock(myRoom, 'mutPlayCard', [myId,cuid,null]); });
    }
    return;
  }

  if(action==='sell-card'){
    var suid=el.getAttribute('data-uid');
    runAction(function(){ return withGameLock(myRoom, 'mutSellCard', [myId,suid]); });
    return;
  }

  if(action==='toggle-tab'){
    ui.gameTab = (ui.gameTab==='store') ? 'board' : 'store';
    draw();
    return;
  }
  if(action==='refresh-store'){
    runAction(function(){ return withGameLock(myRoom, 'mutRefreshStore', [myId]); });
    return;
  }
  if(action==='buy-card'){
    var bkey=el.getAttribute('data-key');
    runAction(function(){ return withGameLock(myRoom, 'mutBuyCard', [myId,bkey]); });
    return;
  }

  if(action==='pick-target'){
    var tgId=el.getAttribute('data-id');
    var pend=ui.pendingTarget;
    ui.pendingTarget=null;
    draw();
    if(pend) runAction(function(){ return pend.confirmAction(tgId); });
    return;
  }
  if(action==='cancel-target'){ ui.pendingTarget=null; draw(); return; }

  if(action==='pick-choice'){
    var val=Number(el.getAttribute('data-value'));
    var pendC=ui.pendingChoice;
    ui.pendingChoice=null;
    draw();
    if(pendC) runAction(function(){ return pendC.confirmAction(val); });
    return;
  }
  if(action==='cancel-choice'){ ui.pendingChoice=null; draw(); return; }

  if(action==='roll-dice'){
    runAction(function(){ return withGameLock(myRoom, 'mutRoll', [myId]); });
    return;
  }
  if(action==='end-turn'){
    runAction(function(){ return withGameLock(myRoom, 'mutEndTurn', [myId]); });
    return;
  }
  if(action==='back-home-finished'){ leaveRoom(); return; }
});

app.addEventListener('focus', function(e){
  if(e.target && e.target.id==='shareLinkBox') e.target.select();
}, true);

/* 房间列表里换英雄的 <select> 用内联 onchange 调用，挂到 window 上 */
window.__lqSetHero = function(hk){
  runAction(function(){ return withGameLock(runtime.myRoom, 'mutSetHero', [runtime.myId,hk]); });
};

/* ===================== 启动 ===================== */
function boot(){
  var initial=paramRoom();
  if(initial){ runtime.ui.homeMode='join'; }

  /* CloudBase 本身在 cloudbase-db.js 第一次用到时才初始化（惰性），这里只检查
     cloudbase-config.js 里的占位符有没有被换成真实环境 ID，没换的话给出明确
     提示而不是让后面的调用抛出一堆看不懂的底层报错。 */
  runtime.db = CLOUDBASE_ENV_ID !== 'REPLACE_ME';
  draw();

  if(runtime.db && initial){
    /* 如果地址栏里带着房间号，且这个标签页（sessionStorage 里的身份）本来就是
       这个房间里的玩家，直接把他带回牌桌，而不是让他重新填一遍加入表单——
       这样同一个标签页刷新页面时会自动回到原来的位置。 */
    getGame(initial).then(function(snap){
      if(snap.exists && findPlayer(snap.data(), runtime.myId)){
        enterRoom(initial);
      }
    }).catch(function(){});
  }
}
boot();
