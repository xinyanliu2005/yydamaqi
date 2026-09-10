/* ===================== 纯状态变更函数（mutator） ===================== */
/* 每个 mutator 接收克隆后的 game 数据，返回 {data} 表示成功写回，或 {error} 表示失败（不写回）。
   加新效果基本就是在这几个函数里加分支。 */

import { HEROES, CARDS, WIN_POS, STORE_REFRESH_PRICES, SELL_PRICE_FOR_30, SELL_PRICE_DEFAULT, MILESTONE_RATIO, GRID_EFFECT_DEFS, GRID_EFFECT_KEYS } from './data.js';
import { shuffle, uid } from './utils.js';
import {
  findPlayer, nameOf, isCurrentTurn, sumBuff, addBuff, tickBuffs,
  pushLog, drawCard, newPlayer, grantTurnStart, grantRoundResources, genStoreOffer
} from './game-logic.js';

/* 直接把玩家移动若干步（不经过骰子/buff 加成计算），供掷骰子、"凌云踏"这类
   立即位移的卡牌、以及"张万师"格子效果的倒退共用；两头都夹住（0 到 WIN_POS），
   倒退也不会走到负数格。胜负判定单独抽成 checkWinCondition，移动后调用即可。 */
function applyMovement(p, steps){
  p.position = Math.max(0, Math.min(WIN_POS, p.position+steps));
}
function checkWinCondition(data, p){
  if(p.position>=WIN_POS && data.status==='playing'){
    data.status='finished';
    data.winner=p.id;
    if(data.mode==='2v2' && p.team){
      /* 组队模式下是"队伍获胜"——只要队里有一人先到终点，整个队伍都算赢，
         不是只有亲自跑到终点的这个人。 */
      var teammateNames = data.players.filter(function(o){ return o.team===p.team; }).map(function(o){ return o.name; });
      data.log = pushLog(data.log, '🏆 '+p.name+' 抵达第'+WIN_POS+'格终点，'+teammateNames.join('、')+' 所在的队伍获胜！');
    } else {
      data.log = pushLog(data.log, '🏆 '+p.name+' 抵达第'+WIN_POS+'格终点，获得胜利！');
    }
  }
}

/* 特殊格子效果——落在哪一格是每局开局时随机分配好的（见 mutStart 里的
   data.gridEffects），不管是自己掷骰子走到的、还是被某张卡/技能送过去的
   （比如被"狮吼正声"打退到了一个特殊格上），只要最终停在这一格就会触发。
   效果解析完就结束，不会因为效果本身又造成的移动（比如"张万师"的倒退）
   继续连锁检查下一个格子——避免极端情况下的连锁/死循环。 */
function resolveGridEffect(data, p){
  if(data.status!=='playing') return;
  var effectKey = data.gridEffects && data.gridEffects[p.position];
  var def = effectKey && GRID_EFFECT_DEFS[effectKey];
  if(!def) return;
  if(effectKey==='wuxianghuang'){
    addBuff(p,'SKILL_LOCKED',0,1,'grid:wuxianghuang','无相皇');
    data.log = pushLog(data.log, p.name+' 踩到【无相皇】，下一回合无法使用主动技能（可被清风霁月解除）');
  } else if(effectKey==='qianye'){
    addBuff(p,'STEP_PENALTY',3,2,'grid:qianye','千夜');
    data.log = pushLog(data.log, p.name+' 踩到【千夜】，接下来2回合 -3 步（可被清风霁月解除）');
  } else if(effectKey==='zhangwanshi'){
    var d = 1+Math.floor(Math.random()*6);
    applyMovement(p, -d);
    data.log = pushLog(data.log, p.name+' 踩到【张万师】，掷出 '+d+' 点并倒退了 '+d+' 格（到达第'+p.position+'格）');
  } else if(effectKey==='taipingzhonglou'){
    /* 用一个"从第几轮到第几轮"的区间记封禁，而不是单个"封禁到第几轮"的上限——
       单纯用上限的话，"当前轮数 <= 上限"这个判断在刚触发的那一轮就已经成立
       （毕竟这一轮的轮数总是小于"下一轮"），会把触发的这一轮也误判成被封禁。
       用区间就能精确表达"只封下一轮"：如果现在还没在封禁中，开一个新区间
       [下一轮, 下一轮]；如果现在已经处于封禁中（这一轮又被踩中），把区间的
       结束往后延一轮，不动开始，这样正在生效的封禁不会被这次触发提前解除。 */
    if(isSurpriseAttackBanned(data)){
      data.taipingBanUntil += 1;
    } else {
      data.taipingBanFrom = data.round+1;
      data.taipingBanUntil = data.round+1;
    }
    data.log = pushLog(data.log, p.name+' 踩到【太平钟楼】，下一轮全场禁止使用奇袭类卡牌和执锐系主动技能');
  } else if(effectKey==='changpingcang'){
    data.players.forEach(function(pl){ pl.money += 50; });
    data.log = pushLog(data.log, p.name+' 踩到【常平仓】，所有玩家获得50元');
  } else if(effectKey==='guishi'){
    for(var i=0;i<2;i++){
      var others = data.players.filter(function(o){ return o.id!==p.id && o.hand.length>0; });
      if(others.length===0) break;
      var victim = others[Math.floor(Math.random()*others.length)];
      var stealIdx = Math.floor(Math.random()*victim.hand.length);
      p.hand.push(victim.hand.splice(stealIdx,1)[0]);
    }
    data.log = pushLog(data.log, p.name+' 踩到【鬼市】，随机偷走了2张卡牌（内容对其他人保密）');
  } else if(effectKey==='chongyuandian'){
    addBuff(p,'STEP_BONUS',5,1,'grid:chongyuandian','崇元殿');
    data.log = pushLog(data.log, p.name+' 踩到【崇元殿】，下一次掷骰额外 +5 步');
  } else if(effectKey==='feitiancanyuan'){
    p.hand.push({uid:uid(), key:'lingyun'});
    data.log = pushLog(data.log, p.name+' 踩到【飞天残垣】，获得一张【凌云踏】');
  } else if(effectKey==='luchai'){
    /* 需要玩家自己选一项奖励，不能在这里直接结算——用 data.pendingGridChoice
       挂起，掷骰子/结束回合都会被这个挂起的选择卡住（见 pendingGridBlockError），
       直到 mutResolveGridChoice 处理完。同一时间只支持挂起一个，如果撞上另一名
       玩家还没处理完的挂起，这次触发就跳过，避免互相覆盖。 */
    if(data.pendingGridChoice){
      data.log = pushLog(data.log, p.name+' 踩到【鲁菜】，但当前还有其他玩家的鲁菜奖励待选择，这次触发被跳过');
    } else {
      data.pendingGridChoice = {playerId:p.id, key:'luchai'};
      data.log = pushLog(data.log, p.name+' 踩到【鲁菜】，请选择一项奖励：20元 / 下回合+3步 / 2张随机卡牌');
    }
  } else if(effectKey==='ronglu'){
    if(data.pendingDiscard){
      data.log = pushLog(data.log, p.name+' 踩到【熔炉】，但当前还有其他玩家的熔炉弃牌待处理，这次触发被跳过');
    } else {
      var ronlgMilestoneBoost = !!data.milestone80PlayerId && data.milestone80PlayerId!==p.id;
      p.hand.push(drawCard(data.round, ronlgMilestoneBoost));
      p.hand.push(drawCard(data.round, ronlgMilestoneBoost));
      data.pendingDiscard = {playerId:p.id, count:2};
      data.log = pushLog(data.log, p.name+' 踩到【熔炉】，获得2张随机卡牌，需要从手牌中弃置2张（含新卡）');
    }
  } else if(effectKey==='zhulinxiaowu'){
    addBuff(p,'STEP_BONUS',3,2,'grid:zhulinxiaowu','竹林小屋');
    data.log = pushLog(data.log, p.name+' 踩到【竹林小屋】，接下来2回合 +3 步');
  } else if(effectKey==='buxianxian'){
    var removedDebuffs = p.buffs.filter(function(b){ return b.type==='STEP_PENALTY'||b.type==='SKIP_TURN'||b.type==='SKILL_LOCKED'; });
    if(removedDebuffs.length>0){
      p.buffs = p.buffs.filter(function(b){ return !(b.type==='STEP_PENALTY'||b.type==='SKIP_TURN'||b.type==='SKILL_LOCKED'); });
      data.log = pushLog(data.log, p.name+' 踩到【不羡仙】，清除了身上所有减益（共'+removedDebuffs.length+'项）');
    } else {
      data.log = pushLog(data.log, p.name+' 踩到【不羡仙】，但身上暂时没有减益可清除');
    }
  }
}

/* 有没有玩家的鲁菜奖励/熔炉弃牌还没处理完——占用期间不能掷骰子或结束回合，
   避免游戏在这类"需要玩家自己做选择"的效果还悬而未决时继续往前推进。 */
function pendingGridBlockError(data){
  if(data.pendingGridChoice) return nameOf(data,data.pendingGridChoice.playerId)+' 还没有选择【鲁菜】的奖励，请先处理';
  if(data.pendingDiscard) return nameOf(data,data.pendingDiscard.playerId)+' 还没有弃置【熔炉】给的手牌，请先处理';
  return null;
}

function isSurpriseAttackBanned(data){
  return data.taipingBanUntil!=null && data.round>=data.taipingBanFrom && data.round<=data.taipingBanUntil;
}

/* 每一轮结束时（回合顺序绕回第一个玩家）检查一次：是否已经有玩家的位置达到了
   全程 80%（见 data.js 的 MILESTONE_RATIO）——不是随时随地一有人踩到就立刻生效，
   而是"这一轮打完，盘点一下"。之后商店给"其他玩家"（不是率先冲线的这个人）
   上架奇袭卡的概率会提高，见 game-logic.js 的 genStoreOffer。只记一次，谁先到
   就是谁；如果这一轮结束时同时有好几个人都过了80%，算给位置最靠前的那个人。
   已经定过之后不会因为掉出80%以下而撤销，也不会被后来者顶替。 */
function checkMilestone80AtRoundEnd(data){
  if(data.milestone80PlayerId) return;
  var threshold = Math.ceil(WIN_POS*MILESTONE_RATIO);
  var candidates = data.players.filter(function(pl){ return pl.position>=threshold; });
  if(candidates.length===0) return;
  var winner = candidates.reduce(function(best,pl){ return pl.position>best.position ? pl : best; });
  data.milestone80PlayerId = winner.id;
  data.log = pushLog(data.log, '🔥 '+winner.name+' 在这一轮结束时率先达到全程的80%，商店里开始出现更多奇袭卡……');
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
  /* o.position>0：越过一个还停在起点（0格）的玩家不算——开局所有人都堆在0格，
     否则任何人一动就会"越过"一堆还没走的玩家，等于每次都白送一次再掷。 */
  var overtook = data.players.some(function(o){ return o.id!==p.id && o.position>0 && beforePos<=o.position && p.position>o.position; });
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

/* 阴阳迷踪步/清风霁月/妙手回春这类"增益卡"共用的目标解析：单人混战模式下
   没有队友，不管传没传 targetId 都只认自己；组队模式下允许传一个明确的
   targetId，但必须是自己或者自己的队友，其余一律当无效目标（防止客户端被
   篡改后拿这张卡去"帮"敌人——虽然帮敌人也没坏处，但至少行为要跟界面上给的
   选项一致）。返回目标玩家对象，或者 null 表示目标不合法。 */
function resolveBuffTarget(data, p, targetId){
  if(!targetId || targetId===p.id) return p;
  if(data.mode==='2v2'){
    var t=findPlayer(data,targetId);
    if(t && p.team && t.team===p.team) return t;
  }
  return null;
}

/* 金玉手/梁上君子/摄星拿月/凌虚一指/叨叨不叨叨这类"针对单个敌方玩家"的卡
   共用的合法性检查：目标必须存在、不能是自己，组队模式下也不能是自己的队友
   （队友不是敌人）。 */
function isValidEnemyTarget(data, p, t){
  if(!t || t.id===p.id) return false;
  if(data.mode==='2v2' && p.team && t.team===p.team) return false;
  return true;
}

/* 青溪的被动（组队模式专属）：队友被奇袭命中时，可以由自己出面化解——从队友
   身上拿走15元或1张卡牌（各50%概率，缺哪样就改拿另一样，跟梨园的兜底逻辑一样）；
   同一轮内为同一名队友化解过几次，代价就翻几倍（用 qingxiSavedCount 记录，
   每轮开始重置）；翻倍后的代价队友两样都掏不出时，这条被动不生效。
   返回 true 表示已经被化解（日志写好了），false 表示没有青溪队友可以帮忙。 */
function tryQingxiTeamSave(data, attacker, target, attackName){
  if(data.mode!=='2v2' || !target.team) return false;
  var mate = data.players.find(function(o){ return o.id!==target.id && o.team===target.team && o.hero==='qingxi'; });
  if(!mate) return false;
  var mult = Math.pow(2, target.qingxiSavedCount||0);
  var costMoney = 15*mult, costCards = 1*mult;
  var canPayMoney = target.money>=costMoney;
  var canPayCards = target.hand.length>=costCards;
  if(!canPayMoney && !canPayCards) return false;
  var payMoney = (canPayMoney && canPayCards) ? (Math.random()<0.5) : canPayMoney;
  if(payMoney){
    target.money -= costMoney;
    mate.money += costMoney;
    data.log = pushLog(data.log, attacker.name+' 对 '+target.name+' 使用【'+attackName+'】，但队友 '+mate.name+' 用【青溪】被动出面化解，从 '+target.name+' 那里拿走了 '+costMoney+' 元');
  } else {
    var stolen=[];
    for(var i=0;i<costCards;i++){
      var idx=Math.floor(Math.random()*target.hand.length);
      stolen.push(target.hand.splice(idx,1)[0]);
    }
    mate.hand = mate.hand.concat(stolen);
    data.log = pushLog(data.log, attacker.name+' 对 '+target.name+' 使用【'+attackName+'】，但队友 '+mate.name+' 用【青溪】被动出面化解，从 '+target.name+' 那里拿走了 '+stolen.length+' 张卡牌');
  }
  target.qingxiSavedCount = (target.qingxiSavedCount||0)+1;
  return true;
}

/* 被奇袭时的防御，优先级从高到低：散财消灾 > 无相金身 > 青溪队友出面化解——
   前两项都会在触发时消耗掉持有的那一张。散财消灾只有在目标金钱够20元时才
   生效（改为扣20元，不会跳过回合）；金钱不够则这张卡视为没生效，继续往下看
   无相金身能不能格挡；再往下如果还有组队模式下的青溪队友，看队友能不能出面
   化解。返回 true 表示这次奇袭已经被防住了（日志已经写好，调用方不应该再
   施加跳过回合等原本的效果）；返回 false 表示没有防御，调用方按原计划继续。 */
function checkSurpriseDefense(data, attacker, target, attackName){
  var sIdx = findHandIndex(target,'sancai');
  if(sIdx>-1 && target.money>=20){
    target.hand.splice(sIdx,1);
    target.money -= 20;
    data.log = pushLog(data.log, attacker.name+' 对 '+target.name+' 使用【'+attackName+'】，但被对方的【散财消灾】化解，对方改为损失20元');
    return true;
  }
  var wIdx = findHandIndex(target,'wuxiang');
  if(wIdx>-1){
    target.hand.splice(wIdx,1);
    data.log = pushLog(data.log, attacker.name+' 对 '+target.name+' 使用【'+attackName+'】，但被对方的【无相金身】格挡了');
    return true;
  }
  if(tryQingxiTeamSave(data, attacker, target, attackName)) return true;
  return false;
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

/* 跟上面那个几乎一样，多了"组队模式下也排除自己的队友"——孤云的主动技能
   用这个，靠近的应该是敌方的领先者，不能是自己队友（就算队友刚好全场领先，
   也不该往队友那边靠）。狮吼正声/敲山震虎这两张卡的自动选敌逻辑暂时还是
   用上面那个不区分队伍的版本，见 README 里记的已知范围限制。 */
function findLeaderExcludingTeam(data, p){
  return data.players.reduce(function(best,pl){
    if(!isValidEnemyTarget(data,p,pl)) return best;
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

/* 组队模式（2v2）下，房主在大厅里把每个人分到 A/B 两队——由房主统一安排，
   不是玩家自己选，避免"两个想一队的朋友手速慢了被分开"这种尴尬。 */
export function mutSetTeam(data, requesterId, targetId, team){
  if(data.mode!=='2v2') return {error:'当前不是组队模式'};
  if(data.hostId!==requesterId) return {error:'只有房主可以分配队伍'};
  if(data.status!=='lobby') return {error:'游戏已开始，无法调整队伍'};
  if(team!=='A' && team!=='B') return {error:'队伍只能是 A 或 B'};
  var p=findPlayer(data,targetId);
  if(!p) return {error:'玩家不存在'};
  p.team = team;
  return {data:data};
}

/* 天泉开局福利：只在游戏刚开始的这一刻发生一次（不是每轮都有）。场上每一个
   天泉玩家都会给所有"其他玩家"（哪怕对方也是天泉）+40元，自己额外+90元。
   多个天泉会互相叠加——两个天泉的话，彼此都会从对方那里再拿到一份+40，
   普通玩家则会拿到两份+40。 */
function applyTianquanStartingBonus(data){
  var tianquans = data.players.filter(function(p){ return p.hero==='tianquan'; });
  tianquans.forEach(function(tq){
    data.players.forEach(function(p){
      if(p.id!==tq.id) p.money += 40;
    });
    tq.money += 90;
    data.log = pushLog(data.log, '天泉 '+tq.name+' 开局慷慨解囊：其他玩家各获得40元，自己额外获得90元');
  });
}

/* 把 GRID_EFFECT_KEYS 里的每种效果随机分配到棋盘上一个格子（排除起点0和终点
   WIN_POS），每种效果目前只出现一次，具体落在哪一格每局都不一样。 */
function generateGridEffects(){
  var candidatePositions = [];
  for(var i=1;i<WIN_POS;i++){ candidatePositions.push(i); }
  var positions = shuffle(candidatePositions).slice(0, GRID_EFFECT_KEYS.length);
  var effects = shuffle(GRID_EFFECT_KEYS);
  var map = {};
  positions.forEach(function(pos, idx){ map[pos] = effects[idx]; });
  return map;
}

export function mutStart(data, requesterId){
  if(data.hostId!==requesterId) return {error:'只有房主可以开始游戏'};
  if(data.status!=='lobby') return {error:'游戏已经开始'};
  if(data.players.length<2) return {error:'至少需要2名玩家才能开始'};
  for(var i=0;i<data.players.length;i++){ if(!data.players[i].hero) return {error:'还有玩家未选择英雄'}; }
  if(data.mode==='2v2'){
    if(data.players.length!==4) return {error:'组队模式（2v2）需要正好4名玩家才能开始'};
    var teamCounts={A:0,B:0};
    for(var ti=0;ti<data.players.length;ti++){
      var pTeam=data.players[ti].team;
      if(pTeam!=='A' && pTeam!=='B') return {error:'还有玩家未分配队伍'};
      teamCounts[pTeam]++;
    }
    if(teamCounts.A!==2 || teamCounts.B!==2) return {error:'两支队伍必须各有2人'};
  }
  var order = shuffle(data.players.map(function(p){return p.id;}));
  data.turnOrder = order;
  data.turnIndex = 0;
  data.status = 'playing';
  data.round = 1;
  data.gridEffects = generateGridEffects();
  data.turnState = {rolled:false, skillUsed:false, lastRoll:null};
  data.pendingGridChoice = null;
  data.pendingDiscard = null;
  /* 第一轮开始：所有玩家同时获得这一轮的金钱和卡牌，商店也按第1轮的权重刷新一次
     （不是等到各自的回合才发，也不是沿用大厅里的初始商店） */
  order.forEach(function(pid){
    grantRoundResources(data, pid);
    var pl = findPlayer(data, pid);
    pl.storeOffer = genStoreOffer(data.round, false); /* 第1轮不可能有人已到80% */
  });
  applyTianquanStartingBonus(data);
  grantTurnStart(data, order[0]);
  data.log = pushLog(data.log, '游戏开始！骰子决定顺序，'+nameOf(data,order[0])+' 先手；本轮所有玩家已同时获得资源');
  return {data:data};
}

export function mutUseSkill(data, playerId, targetId){
  if(!isCurrentTurn(data,playerId)) return {error:'还没轮到你'};
  if(data.turnState.skillUsed) return {error:'本回合已使用过技能'};
  var p=findPlayer(data,playerId);
  var hero=HEROES[p.hero];
  if(!hero) return {error:'尚未选择英雄'};
  if(p.skillCooldown>0) return {error:'技能冷却中，还需 '+p.skillCooldown+' 回合后才能使用'};
  if(p.buffs.some(function(b){ return b.type==='SKILL_LOCKED' && b.turnsLeft>0; })){
    return {error:'无相皇效应：本回合无法使用主动技能'};
  }
  if(hero.type==='执锐' && isSurpriseAttackBanned(data)){
    return {error:'太平钟楼效应：这一轮执锐系主动技能被禁止使用'};
  }
  if(p.hero==='tianquan'){
    if(p.money<20) return {error:'金钱不足，千金取义需要20元'};
    p.money -= 20;
    var tqMilestoneBoost = !!data.milestone80PlayerId && data.milestone80PlayerId!==p.id;
    p.hand.push(drawCard(data.round, tqMilestoneBoost)); p.hand.push(drawCard(data.round, tqMilestoneBoost));
    data.log = pushLog(data.log, p.name+' 使用【千金取义】，花费20元获得2张随机卡牌');
  } else if(p.hero==='zuihuayin'){
    /* 对场上所有其他玩家一起施加减益，不用挑目标；组队模式下排除自己的队友，
       不会误伤队友。 */
    var zTargets = data.players.filter(function(o){ return isValidEnemyTarget(data,p,o); });
    zTargets.forEach(function(o){ addBuff(o,'STEP_PENALTY',3,2,'skill:zuihuayin','花醉三千'); });
    data.log = pushLog(data.log, p.name+' 使用【花醉三千】，对所有敌方玩家施加 -3 步减益（持续2回合）');
  } else if(p.hero==='guyun'){
    /* 排除自己（组队模式下也排除队友）去找"最靠近终点的玩家"——如果孤云
       自己就是全场领先的那个，这里应该找到最领先的对手，然后朝TA的方向
       移动（可能是往回走）。 */
    var leader=findLeaderExcludingTeam(data,p);
    var gap=leader.position-p.position; /* 如果孤云自己是第一，gap 会是负数，表示要往回走 */
    if(Math.abs(gap)<=6){ p.position=leader.position; } else { p.position += (gap>=0?6:-6); }
    p.position = Math.max(0, Math.min(WIN_POS, p.position));
    p.hand.push({uid:uid(), key:'lingxu'});
    data.log = pushLog(data.log, p.name+' 使用【大道无为】，向 '+leader.name+' 靠近（到达第'+p.position+'格），并获得一张【凌虚一指】');
    checkWinCondition(data,p);
    resolveGridEffect(data,p);
  } else if(p.hero==='wenjinguan'){
    var d1=1+Math.floor(Math.random()*6), d2=1+Math.floor(Math.random()*6);
    performRoll(data, p, Math.max(d1,d2), ['运筹帷幄：两次骰子分别为'+d1+'和'+d2+'，取较大值']);
  } else if(p.hero==='kuanglan'){
    var range=6;
    /* 组队模式下排除自己的队友，军威赫赫的余波不会扫到队友身上 */
    var targets=data.players.filter(function(o){ return isValidEnemyTarget(data,p,o) && Math.abs(o.position-p.position)<=range; });
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
        if(checkSurpriseDefense(data, p, o, '军威赫赫')){
          /* 已被散财消灾/无相金身防住，日志已经在 checkSurpriseDefense 里写好了 */
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
      resolveGridEffect(data,p);
    } else {
      p.skillCooldown=0;
      data.log = pushLog(data.log, p.name+' 本次奇袭无人被真正命中，下一回合仍可再次使用【军威赫赫】');
    }
  } else if(p.hero==='qingxi'){
    p.hand.push({uid:uid(), key:'miaoshouhuichun'});
    data.log = pushLog(data.log, p.name+' 使用【坐看云起】，获得一张【妙手回春】');
  } else if(p.hero==='moshandao'){
    var mBoost=!!data.milestone80PlayerId && data.milestone80PlayerId!==p.id;
    p.hand.push(drawCard(data.round, mBoost)); p.hand.push(drawCard(data.round, mBoost));
    var moshandaoLog = p.name+' 使用【兼爱非攻】，获得2张随机卡牌';
    if(data.mode==='2v2' && p.team){
      var moshandaoMate = data.players.find(function(o){ return o.id!==p.id && o.team===p.team; });
      if(moshandaoMate){
        var mateBoost=!!data.milestone80PlayerId && data.milestone80PlayerId!==moshandaoMate.id;
        moshandaoMate.hand.push(drawCard(data.round, mateBoost)); moshandaoMate.hand.push(drawCard(data.round, mateBoost));
        moshandaoLog += '，队友 '+moshandaoMate.name+' 也获得2张随机卡牌';
      }
    }
    data.log = pushLog(data.log, moshandaoLog);
  } else if(p.hero==='liyuan'){
    /* 组队模式下排除自己的队友，请君打榜只会偷敌方玩家 */
    var lyTargets=data.players.filter(function(o){ return isValidEnemyTarget(data,p,o); });
    var lyTarget=lyTargets[Math.floor(Math.random()*lyTargets.length)];
    var lyHasCards = lyTarget.hand.length>0;
    var lyHasMoney = lyTarget.money>0;
    /* 双向兜底：只有两种都有才真的抛硬币决定；只有一种就直接用那一种；
       两种都没有就什么都拿不到——分开算清楚，不用"半路改主意"的写法，
       避免"改主意"改到一个其实也没有的选项上（那样会去偷一手空手牌）。 */
    var lyStealCard = (lyHasCards && lyHasMoney) ? (Math.random()<0.5) : lyHasCards;
    if(lyStealCard){
      var lyIdx=Math.floor(Math.random()*lyTarget.hand.length);
      var lyCard=lyTarget.hand.splice(lyIdx,1)[0];
      p.hand.push(lyCard);
      data.log = pushLog(data.log, p.name+' 使用【请君打榜】，从 '+lyTarget.name+' 手里偷走了一张卡牌（内容对其他人保密）');
    } else if(lyHasMoney){
      var lyMoney=Math.min(15, lyTarget.money);
      lyTarget.money -= lyMoney;
      p.money += lyMoney;
      data.log = pushLog(data.log, p.name+' 使用【请君打榜】，从 '+lyTarget.name+' 那里偷走了 '+lyMoney+' 元');
      applyTianquanPassiveIfTriggered(data, lyTarget, lyMoney);
    } else {
      data.log = pushLog(data.log, p.name+' 使用【请君打榜】，但 '+lyTarget.name+' 既没有钱也没有卡牌，一无所获');
    }
  } else {
    return {error:'该英雄暂无主动技能'};
  }
  data.turnState.skillUsed = true;
  /* 冷却时间因人而异：狂澜由自己的分支决定（是否有人被真正命中）；
     文津馆冷却只有1回合，等于"每次轮到自己都能用"；其余英雄默认2回合
     （梨园、青溪、墨山道都是每2回合用一次）。 */
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
  if(card && card.surpriseAttack && isSurpriseAttackBanned(data)){
    return {error:'太平钟楼效应：这一轮奇袭类卡牌被禁止使用'};
  }
  /* 卡牌的 price 是商店购买价，已经在口袋里的卡牌打出来不再收费 */
  if(cardKey==='qingfeng'){
    /* 单人混战模式没有队友，固定对自己生效；组队模式下可以选队友（帮TA解除减益） */
    var tQF = resolveBuffTarget(data, p, targetId);
    if(!tQF) return {error:'目标无效'};
    var qfSelf = tQF.id===p.id;
    var dIdx=-1;
    /* 无相皇（SKILL_LOCKED）、千夜（STEP_PENALTY）都能被这张卡解除，找到哪个
       算哪个（"解除自身一项减益"，不是全解）。 */
    for(var j=0;j<tQF.buffs.length;j++){
      if((tQF.buffs[j].type==='STEP_PENALTY' || tQF.buffs[j].type==='SKILL_LOCKED') && tQF.buffs[j].turnsLeft>0){ dIdx=j; break; }
    }
    if(dIdx===-1) return {error:qfSelf?'当前没有可解除的减益':(tQF.name+' 当前没有可解除的减益')};
    var removed=tQF.buffs[dIdx];
    tQF.buffs.splice(dIdx,1);
    data.log = pushLog(data.log, qfSelf ? (p.name+' 使用【清风霁月】，解除了减益「'+removed.label+'」') : (p.name+' 对队友 '+tQF.name+' 使用【清风霁月】，解除了对方的减益「'+removed.label+'」'));
  } else if(cardKey==='jinyu'){
    if(!targetId) return {error:'请选择目标玩家'};
    var t=findPlayer(data,targetId);
    if(!isValidEnemyTarget(data,p,t)) return {error:'目标无效（组队模式下不能对队友使用这张卡）'};
    addBuff(t,'STEP_PENALTY',3,1,'card:jinyu','金玉手');
    data.log = pushLog(data.log, p.name+' 使用【金玉手】，对 '+t.name+' 施加 -3 步减益');
  } else if(cardKey==='yinyang'){
    /* 单人混战模式没有队友，固定对自己生效；组队模式下可以选队友 */
    var tYY = resolveBuffTarget(data, p, targetId);
    if(!tYY) return {error:'目标无效'};
    addBuff(tYY,'STEP_BONUS',5,2,'card:yinyang','阴阳迷踪步');
    data.log = pushLog(data.log, tYY.id===p.id ? (p.name+' 使用【阴阳迷踪步】，获得 +5 步增益（持续2回合）') : (p.name+' 把【阴阳迷踪步】用在队友 '+tYY.name+' 身上，对方获得 +5 步增益（持续2回合）'));
  } else if(cardKey==='shengcai'){
    addBuff(p,'MONEY_PER_STEP',1,2,'card:shengcai','生财有道');
    data.log = pushLog(data.log, p.name+' 使用【生财有道】，接下来2回合按步数获得金钱');
  } else if(cardKey==='lingxu'){
    if(!targetId) return {error:'请选择目标玩家'};
    var t=findPlayer(data,targetId);
    if(!isValidEnemyTarget(data,p,t)) return {error:'目标无效（组队模式下不能对队友使用这张卡）'};
    /* 千里目：只要留在口袋里，自己发起的凌虚一指距离限制额外 +2 格 */
    var lingxuRange = card.targetRange + (findHandIndex(p,'qianlimu')>-1 ? 2 : 0);
    if(Math.abs(t.position-p.position) > lingxuRange) return {error:'目标不在你当前位置前后'+lingxuRange+'格范围内'};
    if(hasActiveSkipTurn(t)) return {error:t.name+' 已经处于「即将跳过回合」的保护状态，要等TA的下一次回合结束后才能再被奇袭'};
    if(checkSurpriseDefense(data, p, t, '凌虚一指')){
      /* 已被散财消灾/无相金身/青溪队友防住，日志已经在 checkSurpriseDefense 里写好了 */
    } else {
      addBuff(t,'SKIP_TURN',0,1,'card:lingxu','凌虚一指');
      data.log = pushLog(data.log, p.name+' 使用【凌虚一指】奇袭 '+t.name+'，对方将跳过下一个回合');
      onSurpriseAttackSuccess(data, p);
    }
  } else if(cardKey==='liangshang'){
    if(!targetId) return {error:'请选择目标玩家'};
    var t2=findPlayer(data,targetId);
    if(!isValidEnemyTarget(data,p,t2)) return {error:'目标无效（组队模式下不能对队友使用这张卡）'};
    var stolenMoney = Math.min(15, t2.money);
    t2.money -= stolenMoney;
    p.money += stolenMoney;
    data.log = pushLog(data.log, p.name+' 使用【梁上君子】，从 '+t2.name+' 那里偷走了 '+stolenMoney+' 元');
    applyTianquanPassiveIfTriggered(data, t2, stolenMoney);
  } else if(cardKey==='shexing'){
    if(!targetId) return {error:'请选择目标玩家'};
    var t3=findPlayer(data,targetId);
    if(!isValidEnemyTarget(data,p,t3)) return {error:'目标无效（组队模式下不能对队友使用这张卡）'};
    if(t3.hand.length===0) return {error:'对方没有手牌可偷'};
    var stealIdx = Math.floor(Math.random()*t3.hand.length);
    var stolenCard = t3.hand.splice(stealIdx,1)[0];
    p.hand.push(stolenCard);
    data.log = pushLog(data.log, p.name+' 使用【摄星拿月】，从 '+t3.name+' 手里偷走了一张卡牌（内容对其他人保密）');
  } else if(cardKey==='daodao'){
    if(!targetId) return {error:'请选择目标玩家'};
    var t4=findPlayer(data,targetId);
    if(!isValidEnemyTarget(data,p,t4)) return {error:'目标无效（组队模式下不能对队友使用这张卡）'};
    if(t4.hand.length===0) return {error:'对方没有手牌可销毁'};
    var destroyIdx = Math.floor(Math.random()*t4.hand.length);
    var destroyedCard = t4.hand.splice(destroyIdx,1)[0];
    data.log = pushLog(data.log, p.name+' 使用【叨叨不叨叨】，销毁了 '+t4.name+' 手里的一张卡牌（内容对其他人保密）');
  } else if(cardKey==='shihou'){
    /* 无视距离，直接锁定当前排名第一的玩家（排除自己——如果自己就是第一，改打第二名） */
    var top=findLeaderExcluding(data,p.id);
    if(hasActiveSkipTurn(top)) return {error:top.name+' 已经处于「即将跳过回合」的保护状态，要等TA的下一次回合结束后才能再被奇袭'};
    if(checkSurpriseDefense(data, p, top, '狮吼正声')){
      /* 已被散财消灾/无相金身防住，日志已经在 checkSurpriseDefense 里写好了 */
    } else {
      addBuff(top,'SKIP_TURN',0,1,'card:shihou','狮吼正声');
      applyMovement(top, -5);
      data.log = pushLog(data.log, p.name+' 对 '+top.name+' 使用【狮吼正声】，命中！对方将跳过下一回合，并倒退5格（到达第'+top.position+'格）');
      onSurpriseAttackSuccess(data, p);
      resolveGridEffect(data, top); /* 被打退后如果正好落在特殊格上，一样会触发 */
    }
  } else if(cardKey==='lingyun'){
    var amount = payload && payload.jumpAmount;
    if(card.choice.options.indexOf(amount)===-1) return {error:'请选择要跳跃的格数'};
    var beforePosLY = p.position;
    applyMovement(p, amount);
    data.log = pushLog(data.log, p.name+' 使用【凌云踏】，向前跳了 '+amount+' 格（到达第 '+p.position+' 格）');
    checkWinCondition(data, p);
    resolveGridEffect(data, p);
    checkWenjinguanOvertake(data, p, beforePosLY); /* 用这张卡越过别人，也算越过，同样能再掷一次 */
  } else if(cardKey==='qiaoshan'){
    /* 无视距离，直接锁定当前排名第一的玩家（排除自己——如果自己就是第一，改打第二名） */
    var top3=findLeaderExcluding(data,p.id);
    if(hasActiveSkipTurn(top3)) return {error:top3.name+' 已经处于「即将跳过回合」的保护状态，要等TA的下一次回合结束后才能再被奇袭'};
    if(checkSurpriseDefense(data, p, top3, '敲山震虎')){
      /* 已被散财消灾/无相金身防住，日志已经在 checkSurpriseDefense 里写好了 */
    } else {
      addBuff(top3,'SKIP_TURN',0,1,'card:qiaoshan','敲山震虎');
      data.log = pushLog(data.log, p.name+' 对 '+top3.name+' 使用【敲山震虎】，命中！对方将跳过下一回合');
      onSurpriseAttackSuccess(data, p);
    }
  } else if(cardKey==='pofuchenzhou'){
    if(p.money<20) return {error:'金钱不足，破釜沉舟需要花费20元'};
    p.money -= 20;
    p.hand.push({uid:uid(), key:'lingxu'});
    p.hand.push({uid:uid(), key:'lingxu'});
    data.log = pushLog(data.log, p.name+' 使用【破釜沉舟】，花费20元获得2张【凌虚一指】');
  } else if(cardKey==='yizhiqianjin'){
    if(p.money<=0) return {error:'没有钱可以一掷千金'};
    var stakedMoney = p.money;
    var stepsYZ = Math.min(15, Math.floor(stakedMoney/5));
    p.money = 0;
    var beforePosYZ = p.position;
    applyMovement(p, stepsYZ);
    data.log = pushLog(data.log, p.name+' 使用【一掷千金】，押上全部'+stakedMoney+'元，前进了 '+stepsYZ+' 格（到达第 '+p.position+' 格）');
    checkWinCondition(data, p);
    resolveGridEffect(data, p);
    checkWenjinguanOvertake(data, p, beforePosYZ);
  } else if(cardKey==='miaoshouhuichun'){
    /* 单人混战模式没有队友，固定对自己生效；组队模式下可以选队友（帮TA） */
    var tMSHC = resolveBuffTarget(data, p, targetId);
    if(!tMSHC) return {error:'目标无效'};
    var hasDebuffMSHC = tMSHC.buffs.some(function(b){ return (b.type==='STEP_PENALTY'||b.type==='SKIP_TURN'||b.type==='SKILL_LOCKED') && b.turnsLeft>0; });
    var mshcSelf = tMSHC.id===p.id;
    if(hasDebuffMSHC){
      tMSHC.buffs = tMSHC.buffs.filter(function(b){ return !((b.type==='STEP_PENALTY'||b.type==='SKIP_TURN'||b.type==='SKILL_LOCKED') && b.turnsLeft>0); });
      addBuff(tMSHC,'STEP_BONUS',2,2,'card:miaoshouhuichun','妙手回春');
      data.log = pushLog(data.log, mshcSelf ? (p.name+' 使用【妙手回春】，清除了自己所有减益，并获得 +2 步增益（持续2回合）') : (p.name+' 对 '+tMSHC.name+' 使用【妙手回春】，清除了对方所有减益，并获得 +2 步增益（持续2回合）'));
    } else {
      addBuff(tMSHC,'STEP_BONUS',4,2,'card:miaoshouhuichun','妙手回春');
      data.log = pushLog(data.log, mshcSelf ? (p.name+' 使用【妙手回春】，获得 +4 步增益（持续2回合）') : (p.name+' 对 '+tMSHC.name+' 使用【妙手回春】，获得 +4 步增益（持续2回合）'));
    }
  } else {
    return {error:'未知卡牌'};
  }
  /* 墨山道被动要按"这一轮打出过几种不同的卡牌"算加成，这里统一给所有玩家记录
     （不只是墨山道自己），逻辑更简单，对其他英雄也没有副作用——反正没人会去读
     这个字段，除非他们是墨山道。 */
  if(p.cardsPlayedThisRound && p.cardsPlayedThisRound.indexOf(cardKey)===-1){
    p.cardsPlayedThisRound.push(cardKey);
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
    /* 场上"别人"带减益就触发，不区分敌我——组队模式下队友带减益一样算，
       跟主动技能"只打敌方"是两回事，不要混在一起改。 */
    var someoneElseDebuffed = data.players.some(function(o){ return o.id!==p.id && sumBuff(o,'STEP_PENALTY')>0; });
    if(someoneElseDebuffed){ bonus+=3; notes.push('醉花阴被动：场上有人带减益，额外 +3 步'); }
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
  if(p.hero==='liyuan'){
    /* 落后当前第一名超过5格才加成；自己就是第一名时 gap 为0，自然不会触发 */
    var liyuanLeader=findLeader(data);
    var liyuanGap=liyuanLeader.position-p.position;
    if(liyuanGap>5){ bonus+=4; notes.push('梨园被动：落后当前第一名超过5格，额外 +4 步'); }
  }
  if(p.hero==='moshandao'){
    /* 单人混战模式只算自己这一轮打出过的卡牌种类数；组队模式下把队友这一轮
       打出的种类也并进来一起算（同一种卡两人都打出过也只算一种），上限仍是+2步 */
    var moshandaoTypes = (p.cardsPlayedThisRound||[]).slice();
    if(data.mode==='2v2' && p.team){
      var moshandaoMateForPassive = data.players.find(function(o){ return o.id!==p.id && o.team===p.team; });
      if(moshandaoMateForPassive){
        (moshandaoMateForPassive.cardsPlayedThisRound||[]).forEach(function(k){ if(moshandaoTypes.indexOf(k)===-1) moshandaoTypes.push(k); });
      }
    }
    var moshandaoDistinct = moshandaoTypes.length;
    var moshandaoBonus = Math.min(2, moshandaoDistinct);
    if(moshandaoBonus>0){ bonus+=moshandaoBonus; notes.push('墨山道被动：这一轮打出过'+moshandaoDistinct+'种卡牌，+'+moshandaoBonus+'步'); }
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
  resolveGridEffect(data, p);

  if(!checkWenjinguanOvertake(data, p, beforePos)){
    data.turnState.rolled = true;
  }
}

export function mutRoll(data, playerId){
  if(!isCurrentTurn(data,playerId)) return {error:'还没轮到你'};
  if(data.turnState.rolled) return {error:'本回合已经掷过骰子'};
  var blockMsg = pendingGridBlockError(data);
  if(blockMsg) return {error:blockMsg};
  var p=findPlayer(data,playerId);
  var base = 1+Math.floor(Math.random()*6);
  performRoll(data, p, base);
  return {data:data};
}

/* 鲁菜：从三项奖励里选一项。option 是 'money' / 'steps' / 'cards'。 */
export function mutResolveGridChoice(data, playerId, option){
  var pending = data.pendingGridChoice;
  if(!pending) return {error:'当前没有待选择的格子奖励'};
  if(pending.playerId!==playerId) return {error:'这不是你的选择'};
  var p=findPlayer(data,playerId);
  if(pending.key==='luchai'){
    if(option==='money'){
      p.money += 20;
      data.log = pushLog(data.log, p.name+' 在【鲁菜】效应中选择了20元');
    } else if(option==='steps'){
      addBuff(p,'STEP_BONUS',3,1,'grid:luchai','鲁菜');
      data.log = pushLog(data.log, p.name+' 在【鲁菜】效应中选择了下回合 +3 步');
    } else if(option==='cards'){
      var luchaiMilestoneBoost = !!data.milestone80PlayerId && data.milestone80PlayerId!==p.id;
      p.hand.push(drawCard(data.round, luchaiMilestoneBoost));
      p.hand.push(drawCard(data.round, luchaiMilestoneBoost));
      data.log = pushLog(data.log, p.name+' 在【鲁菜】效应中选择了2张随机卡牌');
    } else {
      return {error:'请选择一个有效选项'};
    }
  } else {
    return {error:'未知的待选择效果'};
  }
  data.pendingGridChoice = null;
  return {data:data};
}

/* 熔炉：从手牌（含刚获得的2张）里弃置指定数量的卡牌，uids 是要弃置的卡牌 uid 列表。 */
export function mutResolveDiscard(data, playerId, uids){
  var pending = data.pendingDiscard;
  if(!pending) return {error:'当前没有待弃置的手牌'};
  if(pending.playerId!==playerId) return {error:'这不是你的弃牌'};
  if(!Array.isArray(uids) || uids.length!==pending.count) return {error:'请选择'+pending.count+'张要弃置的手牌'};
  var p=findPlayer(data,playerId);
  var seen={};
  for(var i=0;i<uids.length;i++){
    if(seen[uids[i]]) return {error:'不能重复选择同一张卡牌'};
    seen[uids[i]]=true;
    if(!p.hand.some(function(c){ return c.uid===uids[i]; })) return {error:'手牌不存在或已被使用'};
  }
  p.hand = p.hand.filter(function(c){ return uids.indexOf(c.uid)===-1; });
  data.log = pushLog(data.log, p.name+' 在【熔炉】效应中弃置了'+pending.count+'张手牌');
  data.pendingDiscard = null;
  return {data:data};
}

export function mutEndTurn(data, playerId){
  if(!isCurrentTurn(data,playerId)) return {error:'还没轮到你'};
  if(data.status!=='playing') return {error:'游戏已结束'};
  var blockMsg2 = pendingGridBlockError(data);
  if(blockMsg2) return {error:blockMsg2};
  /* 不要求必须先掷骰子——玩家可以选择放弃本回合的移动，直接结束回合 */
  var adv = advanceTurnIndex(data);
  data.turnIndex = adv.idx;
  data.turnState = {rolled:false, skillUsed:false, lastRoll:null};
  if(adv.wrapped){
    /* 新的一轮开始：先盘点一下这一轮结束时是否有人率先冲到全程80%（决定接下来
       商店的奇袭卡权重），再让所有玩家同时获得这一轮的金钱和卡牌、商店也自动
       刷新成全新的5张（不占用"换一批"的次数/费用，纯粹是新的一轮开始了）。 */
    data.round = (data.round||1) + 1;
    checkMilestone80AtRoundEnd(data);
    data.players.forEach(function(pl){
      grantRoundResources(data, pl.id);
      var milestoneBoost = !!data.milestone80PlayerId && data.milestone80PlayerId!==pl.id;
      pl.storeOffer = genStoreOffer(data.round, milestoneBoost);
    });
    data.log = pushLog(data.log, '第 '+data.round+' 轮开始，所有玩家同时获得资源，商店已自动刷新');
  }
  grantTurnStart(data, data.turnOrder[adv.idx]);
  data.log = pushLog(data.log, '轮到 '+nameOf(data,data.turnOrder[adv.idx])+' 的回合');
  return {data:data};
}
