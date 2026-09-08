/* ===================== 纯状态变更函数（mutator） ===================== */
/* 每个 mutator 接收克隆后的 game 数据，返回 {data} 表示成功写回，或 {error} 表示失败（不写回）。
   加新效果基本就是在这几个函数里加分支。 */

import { HEROES, CARDS, WIN_POS, STORE_REFRESH_PRICES, SELL_PRICE_FOR_30, SELL_PRICE_DEFAULT, MILESTONE_RATIO } from './data.js';
import { shuffle, uid } from './utils.js';
import {
  findPlayer, nameOf, isCurrentTurn, sumBuff, addBuff, tickBuffs,
  pushLog, drawCard, newPlayer, grantTurnStart, grantRoundResources, genStoreOffer
} from './game-logic.js';

/* 直接把玩家移动若干步（不经过骰子/buff 加成计算），供掷骰子和"凌云踏"这类
   立即位移的卡牌共用；胜负判定单独抽成 checkWinCondition，移动后调用即可。 */
function applyMovement(p, steps){
  p.position = Math.min(WIN_POS, p.position+steps);
}
function checkWinCondition(data, p){
  if(p.position>=WIN_POS && data.status==='playing'){
    data.status='finished';
    data.winner=p.id;
    data.log = pushLog(data.log, '🏆 '+p.name+' 抵达第40格终点，获得胜利！');
  }
}

/* 全场第一次有玩家抵达全程 80%（见 data.js 的 MILESTONE_RATIO）时记一下——
   之后商店给"其他玩家"（不是率先冲线的这个人）上架奇袭卡的概率会提高，
   见 game-logic.js 的 genStoreOffer。只记第一次，谁先到就是谁，不会被后来者
   顶替，也不会因为掉出80%以下而撤销。 */
function checkMilestone80(data, p){
  if(!data.milestone80PlayerId && p.position >= Math.ceil(WIN_POS*MILESTONE_RATIO) && data.status==='playing'){
    data.milestone80PlayerId = p.id;
    data.log = pushLog(data.log, '🔥 '+p.name+' 率先抵达全程的80%，商店里开始出现更多奇袭卡……');
  }
}

/* 天泉被动：在非自己回合内失去钱，获得（失去金额 ÷ 3）的步数增益。目前唯一会让人
   在非自己回合掉钱的是"梁上君子"，被偷的这一刻调用这个函数。用带随机后缀的
   source，让同一回合内被偷好几次时数值分别累加，而不是被"同一来源合并持续时间"
   的通用规则吞掉（那条规则是给"重复使用同一张卡/技能"设计的，这里每次触发的
   数值都不一样，应该分开算）。 */
function applyTianquanPassiveIfTriggered(data, target, lostAmount){
  if(target.hero==='tianquan' && lostAmount>0){
    var bonus = Math.floor(lostAmount/3);
    if(bonus>0){
      addBuff(target,'STEP_BONUS',bonus,1,'hero-passive:tianquan:'+uid(),'天泉被动');
      data.log = pushLog(data.log, target.name+' 因被动【天泉】：损失金钱触发 +'+bonus+' 步增益');
    }
  }
}

/* 文津馆被动：这次移动如果越过了某名玩家（移动前在对方位置或更后，移动后严格
   超过对方），可以立即再掷一次——不把本回合标记为"已掷骰"，这样"掷骰子"按钮
   仍然可点。掷骰子本身的移动、"凌云踏"这类卡牌的位移都要触发这个检查，所以
   抽成共用函数。返回是否触发了"再掷一次"。 */
function checkWenjinguanOvertake(data, p, beforePos){
  if(p.hero!=='wenjinguan' || data.status!=='playing') return false;
  var overtook = data.players.some(function(o){ return o.id!==p.id && beforePos<=o.position && p.position>o.position; });
  if(overtook){
    data.turnState.rolled = false;
    data.log = pushLog(data.log, p.name+' 凭借【运筹帷幄】被动越过了对手，可以再掷一次骰子');
  }
  return overtook;
}

/* 找到"这名玩家手牌里是否有某张卡"，返回手牌下标（没有则 -1）——
   无相金身格挡奇袭、好兆骰被动加成都要检查对方/自己是否持有某张被动卡。 */
function findHandIndex(p, cardKey){
  for(var i=0;i<p.hand.length;i++){ if(p.hand[i].key===cardKey) return i; }
  return -1;
}

/* 玩家身上是否带着"即将跳过回合"的效果（被凌虚一指命中过、还没轮到自己回合被跳过）。
   处于这个状态时视为"保护中"：不能再被奇袭类效果命中，直到这一次跳过被消耗掉
   （也就是真正轮到、且跳过了那一次回合）为止，之后才能再被奇袭。 */
export function hasActiveSkipTurn(p){
  for(var i=0;i<p.buffs.length;i++){ if(p.buffs[i].type==='SKIP_TURN' && p.buffs[i].turnsLeft>0) return true; }
  return false;
}

/* 场上"最靠近终点"的玩家——position 最大的那个（如果就是自己，会得到自己，
   差距为0）。孤云的被动、"随便一个领先者"场景用这个。 */
function findLeader(data){
  return data.players.reduce(function(best,pl){ return (!best || pl.position>best.position) ? pl : best; }, null);
}

/* 排除掉某个人（通常是自己）之后，场上"最靠近终点"的玩家——孤云的主动技能、
   狮吼正声都要"排除自己去找领先者"：如果发起技能/卡牌的这个人自己就是全场
   第一，也应该找到"除自己以外"最领先的对手，而不是把自己当成目标。 */
function findLeaderExcluding(data, excludeId){
  return data.players.reduce(function(best,pl){
    if(pl.id===excludeId) return best;
    return (!best || pl.position>best.position) ? pl : best;
  }, null);
}

/* 飒沓流星：只要留在口袋里，自己每一次成功命中的奇袭都额外前进6格。
   在每一处"奇袭真正命中（不是被格挡/保护免疫）"的地方调用一次。 */
function onSurpriseAttackSuccess(data, attacker){
  if(findHandIndex(attacker,'sadaliuxing')>-1){
    applyMovement(attacker, 6);
    data.log = pushLog(data.log, attacker.name+' 凭借【飒沓流星】，奇袭命中后额外前进6格（到达第'+attacker.position+'格）');
    checkWinCondition(data, attacker);
  }
}

/* 把 data.turnIndex 往后推进一步，如果对方身上有【凌虚一指】/【军威赫赫】造成的
   跳过回合效果（SKIP_TURN），就消耗一层跳过并继续往下找，直到找到一个不需要
   跳过回合的玩家（最多绕场一圈，避免极端情况下死循环）。返回 {idx, wrapped}——
   wrapped 表示这次推进是否越过了"最后一名玩家→第一名玩家"的边界，也就是
   开启了新的一"轮"（round），调用方用它来判断要不要给所有玩家批量发放资源。 */
function advanceTurnIndex(data){
  var n = data.turnOrder.length;
  var idx = data.turnIndex;
  var wrapped = false;
  var loops = 0;
  while(loops <= n){
    idx = (idx+1) % n;
    if(idx===0) wrapped = true;
    var pl = findPlayer(data, data.turnOrder[idx]);
    var skip=null;
    for(var i=0;i<pl.buffs.length;i++){ if(pl.buffs[i].type==='SKIP_TURN' && pl.buffs[i].turnsLeft>0){ skip=pl.buffs[i]; break; } }
    if(skip){
      skip.turnsLeft -= 1;
      pl.buffs = pl.buffs.filter(function(b){ return b.turnsLeft>0; });
      data.log = pushLog(data.log, pl.name+' 处于奇袭效果中，跳过了这个回合');
      loops++;
      continue;
    }
    break;
  }
  return {idx:idx, wrapped:wrapped};
}

export function mutJoin(data, id, name, hero){
  if(data.status!=='lobby') return {error:'游戏已经开始，无法加入'};
  if(findPlayer(data,id)) return {data:data};
  if(data.players.length>=4) return {error:'房间已满（最多4人）'};
  data.players.push(newPlayer(id,name,hero));
  data.log = pushLog(data.log, name+' 加入了房间');
  return {data:data};
}

export function mutSetHero(data, id, heroKey){
  var p=findPlayer(data,id);
  if(!p) return {error:'你不在这个房间里'};
  if(data.status!=='lobby') return {error:'游戏已开始，无法更换英雄'};
  p.hero = heroKey;
  return {data:data};
}

export function mutKick(data, requesterId, targetId){
  if(data.hostId!==requesterId) return {error:'只有房主可以移除玩家'};
  if(data.status!=='lobby') return {error:'游戏已开始，无法移除玩家'};
  var before=data.players.length;
  data.players = data.players.filter(function(p){ return p.id!==targetId; });
  if(data.players.length===before) return {error:'玩家不存在'};
  return {data:data};
}

export function mutStart(data, requesterId){
  if(data.hostId!==requesterId) return {error:'只有房主可以开始游戏'};
  if(data.status!=='lobby') return {error:'游戏已经开始'};
  if(data.players.length<2) return {error:'至少需要2名玩家才能开始'};
  for(var i=0;i<data.players.length;i++){ if(!data.players[i].hero) return {error:'还有玩家未选择英雄'}; }
  var order = shuffle(data.players.map(function(p){return p.id;}));
  data.turnOrder = order;
  data.turnIndex = 0;
  data.status = 'playing';
  data.round = 1;
  data.turnState = {rolled:false, skillUsed:false, lastRoll:null};
  /* 第一轮开始：所有玩家同时获得这一轮的金钱和卡牌，而不是等到各自的回合才发 */
  order.forEach(function(pid){ grantRoundResources(data, pid); });
  grantTurnStart(data, order[0]);
  data.log = pushLog(data.log, '游戏开始！骰子决定顺序，'+nameOf(data,order[0])+' 先手；本轮所有玩家已同时获得资源');
  return {data:data};
}

export function mutUseSkill(data, playerId, targetId){
  if(!isCurrentTurn(data,playerId)) return {error:'还没轮到你'};
  if(data.turnState.skillUsed) return {error:'本回合已使用过技能'};
  if(data.turnState.rolled) return {error:'掷骰子后无法再使用技能'};
  var p=findPlayer(data,playerId);
  var hero=HEROES[p.hero];
  if(!hero) return {error:'尚未选择英雄'};
  if(p.skillCooldown>0) return {error:'技能冷却中，还需 '+p.skillCooldown+' 回合后才能使用'};
  if(p.hero==='tianquan'){
    if(p.money<20) return {error:'金钱不足，千金取义需要20元'};
    p.money -= 20;
    p.hand.push(drawCard()); p.hand.push(drawCard());
    data.log = pushLog(data.log, p.name+' 使用【千金取义】，花费20元获得2张随机卡牌');
  } else if(p.hero==='zuihuayin'){
    /* 对场上所有其他玩家一起施加减益，不用挑目标 */
    var zTargets = data.players.filter(function(o){ return o.id!==p.id; });
    zTargets.forEach(function(o){ addBuff(o,'STEP_PENALTY',3,2,'skill:zuihuayin','花醉三千'); });
    data.log = pushLog(data.log, p.name+' 使用【花醉三千】，对所有其他玩家施加 -3 步减益（持续2回合）');
  } else if(p.hero==='guyun'){
    /* 排除自己去找"最靠近终点的玩家"——如果孤云自己就是全场第一，
       这里应该找到最领先的对手，然后朝TA的方向移动（可能是往回走）。 */
    var leader=findLeaderExcluding(data,p.id);
    var gap=leader.position-p.position; /* 如果孤云自己是第一，gap 会是负数，表示要往回走 */
    if(Math.abs(gap)<=6){ p.position=leader.position; } else { p.position += (gap>=0?6:-6); }
    p.position = Math.max(0, Math.min(WIN_POS, p.position));
    p.hand.push({uid:uid(), key:'lingxu'});
    data.log = pushLog(data.log, p.name+' 使用【大道无为】，向 '+leader.name+' 靠近（到达第'+p.position+'格），并获得一张【凌虚一指】');
    checkWinCondition(data,p);
    checkMilestone80(data,p);
  } else if(p.hero==='wenjinguan'){
    var d1=1+Math.floor(Math.random()*6), d2=1+Math.floor(Math.random()*6);
    performRoll(data, p, Math.max(d1,d2), ['运筹帷幄：两次骰子分别为'+d1+'和'+d2+'，取较大值']);
  } else if(p.hero==='kuanglan'){
    var range=6;
    var targets=data.players.filter(function(o){ return o.id!==p.id && Math.abs(o.position-p.position)<=range; });
    var killedSomeone=false;
    targets.forEach(function(o){
      /* 保护状态要在"随机移除一项效果"之前就判定好——否则如果对方身上唯一的
         buff 正好就是跳过回合本身，随机移除可能刚好把保护解除又立刻重新命中，
         导致这一下奇袭是否算"命中"变得难以预测。 */
      var wasProtected = hasActiveSkipTurn(o);
      if(o.buffs.length>0){
        var ri=Math.floor(Math.random()*o.buffs.length);
        var removedBuff=o.buffs.splice(ri,1)[0];
        data.log = pushLog(data.log, o.name+' 被【军威赫赫】的余波扫到，随机失去了一项效果「'+removedBuff.label+'」');
      }
      if(!wasProtected){
        var wIdx=findHandIndex(o,'wuxiang');
        if(wIdx>-1){
          o.hand.splice(wIdx,1);
          data.log = pushLog(data.log, p.name+' 使用【军威赫赫】奇袭 '+o.name+'，但被对方的【无相金身】格挡了');
        } else {
          addBuff(o,'SKIP_TURN',0,1,'skill:kuanglan','军威赫赫');
          killedSomeone=true;
          data.log = pushLog(data.log, p.name+' 使用【军威赫赫】奇袭 '+o.name+'，对方将跳过下一个回合');
          onSurpriseAttackSuccess(data, p); /* 飒沓流星：每命中一次就 +6 格，AoE 命中几个就触发几次 */
        }
      }
    });
    addBuff(p,'STEP_BONUS',3,1,'hero-passive:kuanglan','军威赫赫被动');
    if(killedSomeone){
      p.skillCooldown=2;
      applyMovement(p,6);
      data.log = pushLog(data.log, p.name+' 本次奇袭有玩家被真正命中，向前推进6格（到达第'+p.position+'格）');
      checkWinCondition(data,p);
      checkMilestone80(data,p);
    } else {
      p.skillCooldown=0;
      data.log = pushLog(data.log, p.name+' 本次奇袭无人被真正命中，下一回合仍可再次使用【军威赫赫】');
    }
  } else {
    return {error:'该英雄暂无主动技能'};
  }
  data.turnState.skillUsed = true;
  /* 冷却时间因人而异：狂澜由自己的分支决定（是否有人被真正命中）；
     文津馆冷却只有1回合，等于"每次轮到自己都能用"；其余英雄默认2回合。 */
  if(p.hero==='kuanglan'){ /* 已在上面分支里设置过 */ }
  else if(p.hero==='wenjinguan'){ p.skillCooldown = 1; }
  else { p.skillCooldown = 2; }
  return {data:data};
}

export function mutPlayCard(data, playerId, cardUid, targetId, payload){
  if(!isCurrentTurn(data,playerId)) return {error:'还没轮到你'};
  var p=findPlayer(data,playerId);
  var idx=-1;
  for(var i=0;i<p.hand.length;i++){ if(p.hand[i].uid===cardUid){ idx=i; break; } }
  if(idx===-1) return {error:'卡牌不存在或已被使用'};
  var cardKey=p.hand[idx].key;
  var card=CARDS[cardKey];
  if(card && card.passive) return {error:'该卡牌是被动效果，留在口袋里即可自动生效，无需主动使用'};
  /* 卡牌的 price 是商店购买价，已经在口袋里的卡牌打出来不再收费 */
  if(cardKey==='qingfeng'){
    var dIdx=-1;
    for(var j=0;j<p.buffs.length;j++){ if(p.buffs[j].type==='STEP_PENALTY' && p.buffs[j].turnsLeft>0){ dIdx=j; break; } }
    if(dIdx===-1) return {error:'当前没有可解除的减益'};
    var removed=p.buffs[dIdx];
    p.buffs.splice(dIdx,1);
    data.log = pushLog(data.log, p.name+' 使用【清风霁月】，解除了减益「'+removed.label+'」');
  } else if(cardKey==='jinyu'){
    if(!targetId) return {error:'请选择目标玩家'};
    var t=findPlayer(data,targetId);
    if(!t || t.id===p.id) return {error:'目标无效'};
    addBuff(t,'STEP_PENALTY',3,1,'card:jinyu','金玉手');
    data.log = pushLog(data.log, p.name+' 使用【金玉手】，对 '+t.name+' 施加 -3 步减益');
  } else if(cardKey==='yinyang'){
    addBuff(p,'STEP_BONUS',5,2,'card:yinyang','阴阳迷踪步');
    data.log = pushLog(data.log, p.name+' 使用【阴阳迷踪步】，获得 +5 步增益（持续2回合）');
  } else if(cardKey==='shengcai'){
    addBuff(p,'MONEY_PER_STEP',1,2,'card:shengcai','生财有道');
    data.log = pushLog(data.log, p.name+' 使用【生财有道】，接下来2回合按步数获得金钱');
  } else if(cardKey==='lingxu'){
    if(!targetId) return {error:'请选择目标玩家'};
    var t=findPlayer(data,targetId);
    if(!t || t.id===p.id) return {error:'目标无效'};
    if(Math.abs(t.position-p.position) > card.targetRange) return {error:'目标不在你当前位置前后'+card.targetRange+'格范围内'};
    if(hasActiveSkipTurn(t)) return {error:t.name+' 已经处于「即将跳过回合」的保护状态，要等TA的下一次回合结束后才能再被奇袭'};
    var wuxiangIdx=findHandIndex(t,'wuxiang');
    if(wuxiangIdx>-1){
      t.hand.splice(wuxiangIdx,1);
      data.log = pushLog(data.log, p.name+' 使用【凌虚一指】奇袭 '+t.name+'，但被对方的【无相金身】格挡了');
    } else {
      addBuff(t,'SKIP_TURN',0,1,'card:lingxu','凌虚一指');
      data.log = pushLog(data.log, p.name+' 使用【凌虚一指】奇袭 '+t.name+'，对方将跳过下一个回合');
      onSurpriseAttackSuccess(data, p);
    }
  } else if(cardKey==='liangshang'){
    if(!targetId) return {error:'请选择目标玩家'};
    var t2=findPlayer(data,targetId);
    if(!t2 || t2.id===p.id) return {error:'目标无效'};
    var stolenMoney = Math.min(15, t2.money);
    t2.money -= stolenMoney;
    p.money += stolenMoney;
    data.log = pushLog(data.log, p.name+' 使用【梁上君子】，从 '+t2.name+' 那里偷走了 '+stolenMoney+' 元');
    applyTianquanPassiveIfTriggered(data, t2, stolenMoney);
  } else if(cardKey==='shexing'){
    if(!targetId) return {error:'请选择目标玩家'};
    var t3=findPlayer(data,targetId);
    if(!t3 || t3.id===p.id) return {error:'目标无效'};
    if(t3.hand.length===0) return {error:'对方没有手牌可偷'};
    var stealIdx = Math.floor(Math.random()*t3.hand.length);
    var stolenCard = t3.hand.splice(stealIdx,1)[0];
    p.hand.push(stolenCard);
    data.log = pushLog(data.log, p.name+' 使用【摄星拿月】，从 '+t3.name+' 手里偷走了一张卡牌（内容对其他人保密）');
  } else if(cardKey==='daodao'){
    if(!targetId) return {error:'请选择目标玩家'};
    var t4=findPlayer(data,targetId);
    if(!t4 || t4.id===p.id) return {error:'目标无效'};
    if(t4.hand.length===0) return {error:'对方没有手牌可销毁'};
    var destroyIdx = Math.floor(Math.random()*t4.hand.length);
    var destroyedCard = t4.hand.splice(destroyIdx,1)[0];
    data.log = pushLog(data.log, p.name+' 使用【叨叨不叨叨】，销毁了 '+t4.name+' 手里的一张卡牌（内容对其他人保密）');
  } else if(cardKey==='shihou'){
    /* 无视距离，直接锁定当前排名第一的玩家（排除自己——如果自己就是第一，改打第二名） */
    var top=findLeaderExcluding(data,p.id);
    if(hasActiveSkipTurn(top)) return {error:top.name+' 已经处于「即将跳过回合」的保护状态，要等TA的下一次回合结束后才能再被奇袭'};
    var wIdx2=findHandIndex(top,'wuxiang');
    if(wIdx2>-1){
      top.hand.splice(wIdx2,1);
      data.log = pushLog(data.log, p.name+' 对 '+top.name+' 使用【狮吼正声】，但被对方的【无相金身】格挡了');
    } else {
      addBuff(top,'SKIP_TURN',0,1,'card:shihou','狮吼正声');
      top.position = Math.max(0, top.position-5);
      data.log = pushLog(data.log, p.name+' 对 '+top.name+' 使用【狮吼正声】，命中！对方将跳过下一回合，并倒退5格（到达第'+top.position+'格）');
      onSurpriseAttackSuccess(data, p);
    }
  } else if(cardKey==='lingyun'){
    var amount = payload && payload.jumpAmount;
    if(card.choice.options.indexOf(amount)===-1) return {error:'请选择要跳跃的格数'};
    var beforePosLY = p.position;
    applyMovement(p, amount);
    data.log = pushLog(data.log, p.name+' 使用【凌云踏】，向前跳了 '+amount+' 格（到达第 '+p.position+' 格）');
    checkWinCondition(data, p);
    checkMilestone80(data, p);
    checkWenjinguanOvertake(data, p, beforePosLY); /* 用这张卡越过别人，也算越过，同样能再掷一次 */
  } else if(cardKey==='qiaoshan'){
    /* 无视距离，直接锁定当前排名第一的玩家（排除自己——如果自己就是第一，改打第二名） */
    var top3=findLeaderExcluding(data,p.id);
    if(hasActiveSkipTurn(top3)) return {error:top3.name+' 已经处于「即将跳过回合」的保护状态，要等TA的下一次回合结束后才能再被奇袭'};
    var wIdx4=findHandIndex(top3,'wuxiang');
    if(wIdx4>-1){
      top3.hand.splice(wIdx4,1);
      data.log = pushLog(data.log, p.name+' 对 '+top3.name+' 使用【敲山震虎】，但被对方的【无相金身】格挡了');
    } else {
      addBuff(top3,'SKIP_TURN',0,1,'card:qiaoshan','敲山震虎');
      data.log = pushLog(data.log, p.name+' 对 '+top3.name+' 使用【敲山震虎】，命中！对方将跳过下一回合');
      onSurpriseAttackSuccess(data, p);
    }
  } else {
    return {error:'未知卡牌'};
  }
  p.hand.splice(idx,1);
  return {data:data};
}

/* 商店的买/卖/换一批完全不写进 data.log——这几件事只跟"这名玩家自己的钱和手牌"
   有关，别人不需要知道你买了什么、卖了什么、换了几次。跟"这个回合打出了什么牌、
   掷出了几步"这类会实际影响场上局势的操作不是一回事，见 render.js 的横幅播报。 */
export function mutBuyCard(data, playerId, cardKey){
  if(data.status!=='playing') return {error:'游戏未在进行中'};
  var p=findPlayer(data,playerId);
  if(!p) return {error:'你不在这个房间里'};
  var card=CARDS[cardKey];
  if(!card) return {error:'未知卡牌'};
  var offerIdx = (p.storeOffer||[]).indexOf(cardKey);
  if(offerIdx===-1) return {error:'该卡牌已经从这一页商店下架了，换一批或选别的卡牌吧'};
  if(p.money<card.price) return {error:'金钱不足，需要'+card.price+'元'};
  p.money -= card.price;
  p.hand.push({uid:uid(), key:cardKey});
  p.storeOffer.splice(offerIdx,1); /* 买过的卡牌从这一页下架，换一批之后才会重新出现 */
  return {data:data};
}

export function mutSellCard(data, playerId, cardUid){
  if(data.status!=='playing') return {error:'游戏未在进行中'};
  var p=findPlayer(data,playerId);
  if(!p) return {error:'你不在这个房间里'};
  var idx=-1;
  for(var i=0;i<p.hand.length;i++){ if(p.hand[i].uid===cardUid){ idx=i; break; } }
  if(idx===-1) return {error:'卡牌不存在或已被使用'};
  var card=CARDS[p.hand[idx].key];
  p.hand.splice(idx,1);
  /* 商店价30元的卡（好兆骰/飒沓流星/狮吼正声/聚宝盆）卖8元，其余固定卖5元 */
  p.money += (card && card.price===30) ? SELL_PRICE_FOR_30 : SELL_PRICE_DEFAULT;
  return {data:data};
}

/* 商店"换一批"：本回合第1次免费，第2次5元，第3次及以后10元（见 STORE_REFRESH_PRICES）。
   刷新次数在每名玩家自己回合开始时重置（grantTurnStart 里）。 */
export function mutRefreshStore(data, playerId){
  if(data.status!=='playing') return {error:'游戏未在进行中'};
  var p=findPlayer(data,playerId);
  if(!p) return {error:'你不在这个房间里'};
  var count = p.storeRefreshCount||0;
  var cost = STORE_REFRESH_PRICES[Math.min(count, STORE_REFRESH_PRICES.length-1)];
  if(p.money<cost) return {error:'金钱不足，换一批需要'+cost+'元'};
  p.money -= cost;
  p.storeRefreshCount = count+1;
  var milestoneBoost = !!data.milestone80PlayerId && data.milestone80PlayerId!==p.id;
  p.storeOffer = genStoreOffer(data.round, milestoneBoost);
  return {data:data};
}

/* 掷骰子结算的核心逻辑，被"正常掷骰子"（mutRoll）和"文津馆·运筹帷幄"（投两次取较大值）
   共用——两者只是 base 点数的来源不同，后续的加成/移动/记录/胜负判定/连续掷骰判定完全一样。
   extraNotes：调用方想额外附加在这次结算说明里的文字（比如"两次骰子取较大值"）。 */
function performRoll(data, p, base, extraNotes){
  var bonus = sumBuff(p,'STEP_BONUS') - sumBuff(p,'STEP_PENALTY');
  var notes = (extraNotes||[]).slice();
  if(p.hero==='zuihuayin'){
    var enemyDebuffed = data.players.some(function(o){ return o.id!==p.id && sumBuff(o,'STEP_PENALTY')>0; });
    if(enemyDebuffed){ bonus+=3; notes.push('醉花阴被动：敌方带减益，额外 +3 步'); }
  }
  if(findHandIndex(p,'haozhao')>-1){
    /* 好兆骰：点数1-2 => +3，4-5 => +2，6 => +1，点数为3时无加成 */
    var luckyBonus = base<3 ? 3 : (base>=4 && base<=5 ? 2 : (base===6 ? 1 : 0));
    if(luckyBonus>0){ bonus+=luckyBonus; notes.push('好兆骰：+'+luckyBonus+'步'); }
  }
  if(p.hero==='guyun'){
    var leader=findLeader(data);
    var gap=leader.position-p.position;
    var gapBonus = gap>=10 ? 7 : (gap>=5 ? 5 : (gap>=3 ? 2 : 0));
    if(gapBonus>0){ bonus+=gapBonus; notes.push('孤云被动：落后领先者'+gap+'格，额外 +'+gapBonus+'步'); }
  }
  if(findHandIndex(p,'jubaopen')>-1){
    /* 聚宝盆：按金钱数量分档，只取最高档，不叠加 */
    var richBonus = p.money>80 ? 4 : (p.money>30 ? 2 : 0);
    if(richBonus>0){ bonus+=richBonus; notes.push('聚宝盆：+'+richBonus+'步'); }
  }
  var passiveNote = notes.length ? ('（'+notes.join('；')+'）') : '';
  var finalSteps = Math.max(0, base+bonus);
  var moneyGain=0;
  p.buffs.forEach(function(b){ if(b.type==='MONEY_PER_STEP' && b.turnsLeft>0) moneyGain+=finalSteps; });
  p.money += moneyGain;
  var beforePos = p.position;
  applyMovement(p, finalSteps);
  tickBuffs(p);
  data.turnState.lastRoll = {base:base, bonus:bonus, finalSteps:finalSteps, moneyGain:moneyGain, passiveNote:passiveNote};
  var msg = p.name+' 掷出 '+base+' 点，本回合共移动 '+finalSteps+' 步（到达第 '+p.position+' 格）'+passiveNote;
  if(moneyGain>0) msg += '，获得 '+moneyGain+' 元';
  data.log = pushLog(data.log, msg);
  checkWinCondition(data, p);
  checkMilestone80(data, p);

  if(!checkWenjinguanOvertake(data, p, beforePos)){
    data.turnState.rolled = true;
  }
}

export function mutRoll(data, playerId){
  if(!isCurrentTurn(data,playerId)) return {error:'还没轮到你'};
  if(data.turnState.rolled) return {error:'本回合已经掷过骰子'};
  var p=findPlayer(data,playerId);
  var base = 1+Math.floor(Math.random()*6);
  performRoll(data, p, base);
  return {data:data};
}

export function mutEndTurn(data, playerId){
  if(!isCurrentTurn(data,playerId)) return {error:'还没轮到你'};
  if(data.status!=='playing') return {error:'游戏已结束'};
  /* 不要求必须先掷骰子——玩家可以选择放弃本回合的移动，直接结束回合 */
  var adv = advanceTurnIndex(data);
  data.turnIndex = adv.idx;
  data.turnState = {rolled:false, skillUsed:false, lastRoll:null};
  if(adv.wrapped){
    /* 新的一轮开始：所有玩家同时获得这一轮的金钱和卡牌 */
    data.round = (data.round||1) + 1;
    data.players.forEach(function(pl){ grantRoundResources(data, pl.id); });
    data.log = pushLog(data.log, '第 '+data.round+' 轮开始，所有玩家同时获得资源');
  }
  grantTurnStart(data, data.turnOrder[adv.idx]);
  data.log = pushLog(data.log, '轮到 '+nameOf(data,data.turnOrder[adv.idx])+' 的回合');
  return {data:data};
}
