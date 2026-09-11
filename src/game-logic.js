/* ===================== 游戏规则用的辅助函数 ===================== */
/* 这些函数操作房间状态（data / player），供 mutators.js 里的各个 mutXxx 组合使用。 */

import { CARDS, STORE_WEIGHTS_EARLY, STORE_WEIGHTS_MID, MILESTONE_SURPRISE_ATTACK_BOOST } from './data.js';
import { uid, weightedPickWithoutReplacement, weightedPickOne } from './utils.js';

export function findPlayer(data,id){ for(var i=0;i<data.players.length;i++) if(data.players[i].id===id) return data.players[i]; return null; }
export function nameOf(data,id){ var p=findPlayer(data,id); return p? p.name : '?'; }
export function isCurrentTurn(data,id){ return data.status==='playing' && data.turnOrder[data.turnIndex]===id; }
export function sumBuff(p,type){ return p.buffs.filter(function(b){return b.type===type && b.turnsLeft>0;}).reduce(function(s,b){return s+b.value;},0); }

/* 叠加同一来源的buff时，不再把数值相加，而是把持续回合数相加——
   比如阴阳迷踪步用两次，不会变成 +10 步，而是维持 +5 步、持续时间变成 2+2=4 回合。
   "同一来源"用 source 字段判断（例如 'card:yinyang'、'skill:zuihuayin'），
   因为同一张卡/同一个技能每次触发的数值本来就是固定的。 */
export function addBuff(p,type,value,turns,source,label){
  var existing=null;
  for(var i=0;i<p.buffs.length;i++){
    if(p.buffs[i].source===source && p.buffs[i].turnsLeft>0){ existing=p.buffs[i]; break; }
  }
  if(existing){
    existing.turnsLeft += turns;
  } else {
    p.buffs.push({id:uid(), type:type, value:value, turnsLeft:turns, source:source, label:label});
  }
}

export function tickBuffs(p){
  p.buffs = p.buffs.map(function(b){ return Object.assign({},b,{turnsLeft:b.turnsLeft-1}); }).filter(function(b){ return b.turnsLeft>0; });
}

export function pushLog(log,text){
  var l=log.slice();
  l.push({ts:Date.now(), text:text});
  return l.slice(-40);
}

/* 卡牌权重表——按"游戏阶段"分两档基础权重（见 data.js 里的 STORE_WEIGHTS_EARLY /
   STORE_WEIGHTS_MID / MILESTONE_SURPRISE_ATTACK_BOOST），商店上架、免费发牌、
   千金取义抽卡全都走这一套概率，不是各自独立的规则：
   - round < 3：用"早期"权重表（新手卡+被动卡常见，奇袭类很少见，部分卡完全不会出现）
   - round >= 3：用"中期"权重表（干扰/进攻类卡牌变多）
   - milestoneBoost：true 表示"已经有玩家冲到全程80%，且当前抽卡的不是那个人"，
     这时候在上面任一档权重的基础上，再给奇袭类卡牌加权重（可能让它们从0变成可抽到）。
   - mode：组队模式（2v2）专属的卡牌（teammateOnly，比如有钱任性/排忧解难）在
     单人混战模式下没有队友可以送，直接把权重归零，商店/免费发牌都不会抽到。 */
function computeCardWeights(round, milestoneBoost, mode){
  var base = (round && round>=3) ? STORE_WEIGHTS_MID : STORE_WEIGHTS_EARLY;
  var weights={};
  Object.keys(CARDS).forEach(function(k){ weights[k] = base[k]!=null ? base[k] : 1; });
  if(milestoneBoost){
    Object.keys(MILESTONE_SURPRISE_ATTACK_BOOST).forEach(function(k){
      weights[k] = (weights[k]||0) + MILESTONE_SURPRISE_ATTACK_BOOST[k];
    });
  }
  if(mode!=='2v2'){
    Object.keys(CARDS).forEach(function(k){ if(CARDS[k].teammateOnly) weights[k]=0; });
  }
  return weights;
}

/* 免费发牌（每轮发2张）、千金取义（抽2张）用这个——按权重抽1张，可以重复。 */
export function drawCard(round, milestoneBoost, mode){
  var k = weightedPickOne(computeCardWeights(round, milestoneBoost, mode));
  return {uid:uid(), key:k};
}

/* 商店每一页 5 张卡牌互不重复，按权重抽。 */
export function genStoreOffer(round, milestoneBoost, mode){
  return weightedPickWithoutReplacement(computeCardWeights(round, milestoneBoost, mode), 5);
}

export function newPlayer(id,name,hero,mode){
  return {
    id:id, name:name, hero:hero, money:0, position:0, hand:[], buffs:[], skillCooldown:0,
    storeOffer:genStoreOffer(0,false,mode), storeRefreshCount:0,
    cardsPlayedThisRound:[], /* 墨山道被动用：这一轮打出过的不同卡牌种类，每轮开始重置 */
    team:null, /* 只在组队模式（2v2）下有意义：'A' 或 'B'，大厅里由房主分配 */
    qingxiSavedCount:0, /* 青溪被动用：这一轮里，队友已经替自己化解过几次奇袭（决定下一次代价翻几倍），每轮开始重置 */
    nextRollOverride:null, /* 樊楼格子用：{min,max}，覆盖下一次掷骰子的点数范围，用一次就消耗掉 */
    joinedAt:Date.now()
  };
}

/* 每一轮发放的基础金钱/卡牌数量，按轮数分阶梯——不是每轮都一样多：
   第1轮30元2张，第2-3轮回落到20元1张，第4轮回到30元2张，第5轮起固定
   45元2张。 */
function roundResourceAmounts(round){
  if(round===1) return {money:30, cards:2};
  if(round===2 || round===3) return {money:20, cards:1};
  if(round===4) return {money:30, cards:2};
  return {money:45, cards:2}; /* 第5轮起 */
}

/* 组队模式（2v2）的"落后追赶奖励"：每一轮重新判定一次（不是像80%里程碑那样
   一旦触发就永久生效）——如果一个队伍的两名玩家都落后于对方队伍里跑得最远
   的那个人超过20格，这个队伍这一轮额外获得45元和2张卡牌。用"两人都"而不是
   "任意一人"，是因为只要队里还有一个人跟得上，就不算真正被甩开。 */
function isTeamLeftBehind(data, team){
  if(data.mode!=='2v2' || !team) return false;
  var teamPlayers = data.players.filter(function(p){ return p.team===team; });
  var otherPlayers = data.players.filter(function(p){ return p.team && p.team!==team; });
  if(teamPlayers.length===0 || otherPlayers.length===0) return false;
  var otherLeaderPos = Math.max.apply(null, otherPlayers.map(function(p){ return p.position; }));
  return teamPlayers.every(function(p){ return (otherLeaderPos - p.position) > 20; });
}

/* 每一"轮"（round）开始时，场上所有玩家同时获得的资源——不是等到某个人的回合才发，
   而是这一轮刚开始（游戏开局，或上一轮所有人都走完一遍）就一次性发给每个人。 */
export function grantRoundResources(data, playerId){
  var p=findPlayer(data,playerId);
  if(!p) return;
  var amounts = roundResourceAmounts(data.round);
  var money = amounts.money, cardCount = amounts.cards;
  if(isTeamLeftBehind(data, p.team)){
    money += 45;
    cardCount += 2;
    data.log = pushLog(data.log, p.name+' 所在的 '+p.team+' 队落后对方队伍超过20格，这一轮额外获得45元和2张卡牌（落后追赶奖励）');
  }
  p.money += money;
  var milestoneBoost = !!data.milestone80PlayerId && data.milestone80PlayerId!==playerId;
  for(var ci=0; ci<cardCount; ci++){
    p.hand.push(drawCard(data.round, milestoneBoost, data.mode));
  }
  p.cardsPlayedThisRound = []; /* 新的一轮开始，墨山道被动的计数清零重新算 */
  p.qingxiSavedCount = 0; /* 新的一轮开始，青溪被动的翻倍计数也清零重新算 */
}

/* 好兆骰/好运骰/聚宝盆这3张"幸运牌"，集齐全部3张才享受这个额外福利——
   每次轮到自己的回合开始时多摸1张随机卡牌（3张各自的效果仍然独立生效，
   见 performRoll；只集齐2张时改用组合效果，不享受这条摸牌福利）。 */
var LUCKY_CARD_KEYS = ['haozhao','haoyunshai','jubaopen'];
function hasAllLuckyCards(p){
  return LUCKY_CARD_KEYS.every(function(k){ return p.hand.some(function(c){ return c.key===k; }); });
}

/* 轮到"这名玩家自己的回合"时才结算的个人状态——技能冷却递减、商店刷新次数重置。
   这些是跟着"这名玩家的回合"走的，跟上面按"轮"批量发放的资源是两回事。 */
export function grantTurnStart(data, playerId){
  var p=findPlayer(data,playerId);
  if(!p) return;
  if(p.skillCooldown>0) p.skillCooldown -= 1;
  p.storeRefreshCount = 0; /* 新回合开始，本回合第一次"换一批"重新变为免费 */
  if(hasAllLuckyCards(p)){
    var milestoneBoost = !!data.milestone80PlayerId && data.milestone80PlayerId!==playerId;
    p.hand.push(drawCard(data.round, milestoneBoost, data.mode));
    data.log = pushLog(data.log, p.name+' 集齐好兆骰/好运骰/聚宝盆，回合开始额外获得1张随机卡牌');
  }
}
