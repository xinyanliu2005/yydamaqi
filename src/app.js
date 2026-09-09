/* ===================== 入口：DB 读写、房间管理、事件委托、启动 ===================== */

import { CARDS, HEROES } from './data.js';
import { roomCode } from './utils.js';
import { findPlayer, newPlayer } from './game-logic.js';
import {
  mutJoin, mutSetHero, mutKick, mutStart, mutUseSkill, mutPlayCard,
  mutBuyCard, mutSellCard, mutRefreshStore, mutRoll, mutEndTurn, hasActiveSkipTurn,
  mutResolveGridChoice, mutResolveDiscard, mutSetTeam
} from './mutators.js';
import { render } from './render.js';
import { runtime, paramRoom } from './app-state.js';
import { getGame, subscribeGame, runGameTransaction, createRoom as sbCreateRoom } from './supabase-db.js';
import { SUPABASE_URL } from './supabase-config.js';

var app=document.getElementById('app');

function draw(){ render(app); }

/* Supabase 的乐观锁（读 version -> 跑 mutator -> 带 version 条件写回，见
   supabase-db.js）直接在浏览器里完成，不需要像 CloudBase 那样额外部署一个
   云函数。withGameLock 这个名字保留下来只是为了不用改下面几十处调用点。 */
function withGameLock(code, mutator){
  return runGameTransaction(code, mutator);
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
function createRoom(name, heroKey, mode){
  if(!runtime.db) return;
  var code=roomCode();
  var initial={
    code:code, status:'lobby', createdAt:Date.now(), hostId:runtime.myId,
    mode:mode||'1vn', /* '1vn'：单人混战（默认）；'2v2'：组队模式，需要正好4人、房主在大厅分好队 */
    players:[newPlayer(runtime.myId,name,heroKey)],
    turnOrder:[], turnIndex:0,
    turnState:{rolled:false, skillUsed:false, lastRoll:null},
    log:[{ts:Date.now(), text:'房间创建，等待玩家加入…'}],
    winner:null
  };
  sbCreateRoom(code, initial).then(function(res){
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
    return withGameLock(code, function(data){ return mutJoin(data, runtime.myId, name, heroKey); }).then(function(res){
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

  /* 首页的昵称/房间号输入框在每次点击触发重新渲染时会被整个替换掉——如果不先
     把当前输入暂存进 ui，用户刚打的字（还没触发输入框的 blur/change）就会
     凭空消失，比如选个英雄，房间号就被清空了、还得重新输一遍。这里在首页
     任何点击动作真正执行之前，先把两个输入框现在的内容记下来。 */
  if(!myRoom){
    var niSnap=document.getElementById('nameInput'); if(niSnap) ui.nameDraft=niSnap.value;
    var ciSnap=document.getElementById('codeInput'); if(ciSnap) ui.codeDraft=ciSnap.value;
  }

  if(action==='home-mode'){ ui.homeMode=el.getAttribute('data-mode'); draw(); return; }
  if(action==='pick-hero'){ ui.selectedHero=el.getAttribute('data-hero'); draw(); return; }
  if(action==='set-create-mode'){ ui.createMode=el.getAttribute('data-mode'); draw(); return; }
  if(action==='create-room'){
    var nm=(document.getElementById('nameInput')||{}).value || '';
    nm=nm.trim();
    if(!nm){ showError('请输入昵称'); return; }
    createRoom(nm, ui.selectedHero, ui.createMode);
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
    runAction(function(){ return withGameLock(myRoom, function(data){ return mutSetHero(data,myId,hk); }); });
    return;
  }
  if(action==='set-team'){
    var stId=el.getAttribute('data-id'), stTeam=el.getAttribute('data-team');
    runAction(function(){ return withGameLock(myRoom, function(data){ return mutSetTeam(data,myId,stId,stTeam); }); });
    return;
  }
  if(action==='kick'){
    var tid=el.getAttribute('data-id');
    runAction(function(){ return withGameLock(myRoom, function(data){ return mutKick(data,myId,tid); }); });
    return;
  }
  if(action==='start-game'){
    runAction(function(){ return withGameLock(myRoom, function(data){ return mutStart(data,myId); }); });
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
    /* 现在所有英雄的主动技能都不需要挑目标——花醉三千已经改成对所有其他玩家
       生效，其余英雄本来就是自动选目标（领先者/全场AoE/自己）或没有目标。 */
    runAction(function(){ return withGameLock(myRoom, function(data){ return mutUseSkill(data,myId,null); }); });
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
          return withGameLock(myRoom, function(data){ return mutPlayCard(data,myId,cuid,null,{jumpAmount:v}); });
        }};
      draw();
      return;
    }
    if(cdef && cdef.needsTarget){
      /* 金玉手/梁上君子/摄星拿月/凌虚一指/叨叨不叨叨这类"打敌人"的卡：默认排除
         自己；组队模式下还要排除自己的队友，队友不是敌人，不能拿这些卡打队友
         （服务端 mutPlayCard 里也有同样的校验，这里只是提前把界面上的选项过滤
         掉，省得选了又被拒）。 */
      var me0=findPlayer(game, myId);
      var opps=game.players.filter(function(p){ return p.id!==myId; });
      if(game.mode==='2v2' && me0.team){
        opps=opps.filter(function(p){ return p.team!==me0.team; });
      }
      if(cdef.targetRange!=null){
        /* 千里目：只要留在口袋里，自己发起的凌虚一指距离限制额外 +2 格——
           这里跟 mutators.js 的 mutPlayCard 保持一致，否则持有千里目的玩家会在
           客户端这一步就被过滤掉本该能选的目标，看不到选项 */
        var effRange = cdef.targetRange + (me0.hand.some(function(c){ return c.key==='qianlimu'; }) ? 2 : 0);
        opps=opps.filter(function(p){ return Math.abs(p.position-me0.position)<=effRange; });
      }
      if(cdef.surpriseAttack){
        opps=opps.filter(function(p){ return !hasActiveSkipTurn(p); });
      }
      if(opps.length===0){ showError('范围内没有可选目标（或对方都处于保护状态）'); return; }
      if(opps.length===1){
        runAction(function(){ return withGameLock(myRoom, function(data){ return mutPlayCard(data,myId,cuid,opps[0].id); }); });
      } else {
        ui.pendingTarget={ kind:'card', title:cdef.name+' · 选择目标', candidates:opps, confirmAction:function(tid){
          return withGameLock(myRoom, function(data){ return mutPlayCard(data,myId,cuid,tid); });
        }};
        draw();
      }
    } else if(cdef && cdef.teamTargetable && game.mode==='2v2'){
      /* 阴阳迷踪步/清风霁月/妙手回春这类增益卡：单人混战模式没有队友，固定
         对自己生效（走下面的 else 分支）；组队模式下多一个"自己/队友"二选一。 */
      var meTT=findPlayer(game, myId);
      var mate=meTT.team ? game.players.find(function(p){ return p.id!==myId && p.team===meTT.team; }) : null;
      if(!mate){
        runAction(function(){ return withGameLock(myRoom, function(data){ return mutPlayCard(data,myId,cuid,null); }); });
      } else {
        ui.pendingTarget={ kind:'card', title:cdef.name+' · 用给谁', candidates:[meTT, mate], confirmAction:function(tid){
          return withGameLock(myRoom, function(data){ return mutPlayCard(data,myId,cuid,tid); });
        }};
        draw();
      }
    } else {
      runAction(function(){ return withGameLock(myRoom, function(data){ return mutPlayCard(data,myId,cuid,null); }); });
    }
    return;
  }

  if(action==='sell-card'){
    var suid=el.getAttribute('data-uid');
    runAction(function(){ return withGameLock(myRoom, function(data){ return mutSellCard(data,myId,suid); }); });
    return;
  }

  if(action==='toggle-tab'){
    ui.gameTab = (ui.gameTab==='store') ? 'board' : 'store';
    draw();
    return;
  }
  if(action==='refresh-store'){
    runAction(function(){ return withGameLock(myRoom, function(data){ return mutRefreshStore(data,myId); }); });
    return;
  }
  if(action==='buy-card'){
    var bkey=el.getAttribute('data-key');
    runAction(function(){ return withGameLock(myRoom, function(data){ return mutBuyCard(data,myId,bkey); }); });
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

  if(action==='grid-choice'){
    var gcOption=el.getAttribute('data-option');
    runAction(function(){ return withGameLock(myRoom, function(data){ return mutResolveGridChoice(data,myId,gcOption); }); });
    return;
  }
  if(action==='toggle-discard-card'){
    var tdUid=el.getAttribute('data-uid');
    var sel=ui.discardSelection||[];
    var pos=sel.indexOf(tdUid);
    var neededCount=(game.pendingDiscard && game.pendingDiscard.count)||2;
    if(pos>-1){ sel=sel.filter(function(u){ return u!==tdUid; }); }
    else if(sel.length<neededCount){ sel=sel.concat([tdUid]); }
    ui.discardSelection=sel;
    draw();
    return;
  }
  if(action==='confirm-discard'){
    var discardUids=(ui.discardSelection||[]).slice();
    runAction(function(){ return withGameLock(myRoom, function(data){ return mutResolveDiscard(data,myId,discardUids); }).then(function(res){
      if(res && res.ok!==false) ui.discardSelection=[];
      return res;
    }); });
    return;
  }

  if(action==='roll-dice'){
    runAction(function(){ return withGameLock(myRoom, function(data){ return mutRoll(data,myId); }); });
    return;
  }
  if(action==='end-turn'){
    runAction(function(){ return withGameLock(myRoom, function(data){ return mutEndTurn(data,myId); }); });
    return;
  }
  if(action==='back-home-finished'){ leaveRoom(); return; }
});

app.addEventListener('focus', function(e){
  if(e.target && e.target.id==='shareLinkBox') e.target.select();
}, true);

/* 房间列表里换英雄的 <select> 用内联 onchange 调用，挂到 window 上 */
window.__lqSetHero = function(hk){
  runAction(function(){ return withGameLock(runtime.myRoom, function(data){ return mutSetHero(data,runtime.myId,hk); }); });
};

/* ===================== 启动 ===================== */
function boot(){
  var initial=paramRoom();
  if(initial){ runtime.ui.homeMode='join'; }

  /* Supabase 客户端在 supabase-db.js 第一次用到时才惰性初始化，这里只检查
     supabase-config.js 里的占位符有没有被换成真实项目配置，没换的话给出明确
     提示而不是让后面的调用抛出一堆看不懂的底层报错。 */
  runtime.db = SUPABASE_URL !== 'REPLACE_ME';
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
