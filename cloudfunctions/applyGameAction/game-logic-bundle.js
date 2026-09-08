"use strict";

/* ---- src/data.js ---- */
/* ===================== 静态数据 ===================== */
/* 加新英雄/卡牌从这里加一条即可，逻辑代码（mutators.js）不用大改。 */

var HEROES = {
  tianquan: {
    key:'tianquan', name:'天泉', color:'#4d7eb0',
    activeName:'千金取义',
    activeDesc:'花20块钱获得随机两张卡牌',
    passiveName:'被动',
    passiveDesc:'在非自己回合内失去钱，将获得步数增益（失去金额 ÷ 3）'
  },
  zuihuayin: {
    key:'zuihuayin', name:'醉花阴', color:'#9a5cc0',
    activeName:'花醉三千',
    activeDesc:'使敌方玩家减益3步数，持续2回合',
    passiveName:'被动',
    passiveDesc:'场上敌人若带有减益，自己额外获得3步数'
  },
  guyun: {
    key:'guyun', name:'孤云', color:'#6b8f71',
    activeName:'大道无为',
    activeDesc:'朝场上最靠近终点的玩家靠近：若相距≤6格，直接移动到对方所在格；若超过6格，则朝对方方向移动6格。移动后立刻获得一张【凌虚一指】。冷却2回合。',
    passiveName:'被动',
    passiveDesc:'落后于场上最靠近终点的玩家3-4格时+2步，落后5-9格时+5步，落后10格及以上时+7步'
  },
  wenjinguan: {
    key:'wenjinguan', name:'文津馆', color:'#3f6b8a',
    activeName:'运筹帷幄',
    activeDesc:'投两次骰子，取点数较大的一次结算本回合移动',
    passiveName:'被动',
    passiveDesc:'本回合的移动如果越过了某名玩家的位置，可以再掷一次骰子；只要还在越过别人，就能一直连续再掷'
  },
  kuanglan: {
    key:'kuanglan', name:'狂澜', color:'#a83232',
    activeName:'军威赫赫',
    activeDesc:'对当前位置前后6格内的所有玩家发起奇袭，使其跳过下一回合（可被「无相金身」格挡，处于保护状态的玩家免疫）；无论是否命中，被扫到的玩家都会被随机移除自身一项效果。若本次无人被真正命中跳过，下回合仍可再次使用（不进入冷却）；若有人被命中，则进入2回合冷却，并使自己前进6格。',
    passiveName:'被动',
    passiveDesc:'每次使用主动技能，自己获得 +3 步（用于紧接着的下一次掷骰子）'
  }
};

var CARDS = {
  yinyang:  { key:'yinyang',  name:'阴阳迷踪步', price:20, desc:'为自己增加5步数增益，持续2回合', needsTarget:false },
  shengcai: { key:'shengcai', name:'生财有道',   price:15, desc:'接下来2回合，按该回合最终步数获得等额金钱', needsTarget:false },
  qingfeng: { key:'qingfeng', name:'清风霁月',   price:15, desc:'消除自身一项减益（可解除“花醉三千”）', needsTarget:false },
  jinyu:    { key:'jinyu',    name:'金玉手',     price:15, desc:'对一名敌方玩家施加减益，使其减少3步数', needsTarget:true },

  /* 被动卡：不主动打出，放在手牌（口袋）里就一直生效，直到被消耗或卖出。 */
  wuxiang:  { key:'wuxiang', name:'无相金身', price:15,
    desc:'被动：只要留在口袋里，就能抵御一次「奇袭」类卡牌（如凌虚一指）——被奇袭时自动消耗掉，本次奇袭完全无效',
    needsTarget:false, passive:true },
  haozhao:  { key:'haozhao', name:'好兆骰', price:30,
    desc:'被动：只要留在口袋里，掷骰点数为1-2时额外+3步，4-5时额外+2步，6时额外+1步（点数为3时无加成）',
    needsTarget:false, passive:true },

  /* “奇袭”类：可以被 无相金身 格挡 */
  lingxu: { key:'lingxu', name:'凌虚一指', price:15,
    desc:'奇袭：对当前位置前后2格内的一名玩家使用，使其跳过下一个回合（若对方持有「无相金身」则被格挡、无效）',
    needsTarget:true, targetRange:2, surpriseAttack:true },

  liangshang: { key:'liangshang', name:'梁上君子', price:15,
    desc:'偷走一名玩家15元（若对方金钱不足15元，则偷走其全部金钱）',
    needsTarget:true },
  shexing: { key:'shexing', name:'摄星拿月', price:20,
    desc:'从一名玩家的手牌中随机偷走1张卡牌',
    needsTarget:true },
  lingyun: { key:'lingyun', name:'凌云踏', price:15,
    desc:'立即向前跳跃：可选择跳3格、4格、5格或6格（与本回合骰子移动叠加）',
    needsTarget:false, choice:{type:'jump', options:[3,4,5,6]} },

  sadaliuxing: { key:'sadaliuxing', name:'飒沓流星', price:30,
    desc:'被动：只要留在口袋里，每一次成功的「奇袭」命中（自己发起的）都会额外让自己前进6格',
    needsTarget:false, passive:true },
  daodao: { key:'daodao', name:'叨叨不叨叨', price:15,
    desc:'销毁一名玩家手牌中随机1张卡牌（对方不会获得任何补偿）',
    needsTarget:true },
  shihou: { key:'shihou', name:'狮吼正声', price:30,
    desc:'奇袭：无视距离，对当前排名第一的玩家（如果就是自己则改为第二名）发起奇袭，使其跳过下一回合；命中后目标额外倒退5格（若被「无相金身」格挡或对方处于保护状态，则完全无效）',
    needsTarget:false, surpriseAttack:true },
  jubaopen: { key:'jubaopen', name:'聚宝盆', price:30,
    desc:'被动：只要留在口袋里，自己金钱超过30元时+2步，超过80元时改为+4步（两档不叠加，按最高档计算）',
    needsTarget:false, passive:true }
};

var PLAYER_COLORS = ['#c1452c','#c9a24b','#4d7eb0','#9a5cc0'];
var WIN_POS = 40;

/* 商店"换一批"的价格阶梯：本回合第 N 次刷新对应下标 N（从0开始），
   超出数组长度的次数一律用最后一档的价格。 */
var STORE_REFRESH_PRICES = [0, 5, 10];

/* ---- src/utils.js ---- */
/* ===================== 通用工具函数（与游戏规则无关） ===================== */

function uid(){ return Math.random().toString(36).slice(2,10)+Date.now().toString(36); }

function roomCode(){
  var chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s='';
  for(var i=0;i<5;i++) s+=chars[Math.floor(Math.random()*chars.length)];
  return s;
}

function clone(x){ return JSON.parse(JSON.stringify(x)); }

function sleep(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }

function shuffle(arr){
  var a=arr.slice();
  for(var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; }
  return a;
}

function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }

/* ---- src/game-logic.js ---- */
/* ===================== 游戏规则用的辅助函数 ===================== */
/* 这些函数操作房间状态（data / player），供 mutators.js 里的各个 mutXxx 组合使用。 */

function findPlayer(data,id){ for(var i=0;i<data.players.length;i++) if(data.players[i].id===id) return data.players[i]; return null; }
function nameOf(data,id){ var p=findPlayer(data,id); return p? p.name : '?'; }
function isCurrentTurn(data,id){ return data.status==='playing' && data.turnOrder[data.turnIndex]===id; }
function sumBuff(p,type){ return p.buffs.filter(function(b){return b.type===type && b.turnsLeft>0;}).reduce(function(s,b){return s+b.value;},0); }

/* 叠加同一来源的buff时，不再把数值相加，而是把持续回合数相加——
   比如阴阳迷踪步用两次，不会变成 +10 步，而是维持 +5 步、持续时间变成 2+2=4 回合。
   "同一来源"用 source 字段判断（例如 'card:yinyang'、'skill:zuihuayin'），
   因为同一张卡/同一个技能每次触发的数值本来就是固定的。 */
function addBuff(p,type,value,turns,source,label){
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

function tickBuffs(p){
  p.buffs = p.buffs.map(function(b){ return Object.assign({},b,{turnsLeft:b.turnsLeft-1}); }).filter(function(b){ return b.turnsLeft>0; });
}

function pushLog(log,text){
  var l=log.slice();
  l.push({ts:Date.now(), text:text});
  return l.slice(-40);
}

function drawCard(){
  var keys=Object.keys(CARDS);
  var k=keys[Math.floor(Math.random()*keys.length)];
  return {uid:uid(), key:k};
}

/* 商店每一页 5 张卡牌互不重复——先洗牌整个卡牌池，再取前 5 张。 */
function genStoreOffer(){
  return shuffle(Object.keys(CARDS)).slice(0,5);
}

function newPlayer(id,name,hero){
  return {
    id:id, name:name, hero:hero, money:0, position:0, hand:[], buffs:[], skillCooldown:0,
    storeOffer:genStoreOffer(), storeRefreshCount:0,
    joinedAt:Date.now()
  };
}

/* 每一"轮"（round）开始时，场上所有玩家同时获得的资源——不是等到某个人的回合才发，
   而是这一轮刚开始（游戏开局，或上一轮所有人都走完一遍）就一次性发给每个人。 */
function grantRoundResources(data, playerId){
  var p=findPlayer(data,playerId);
  if(!p) return;
  p.money += 30;
  p.hand.push(drawCard());
  p.hand.push(drawCard());
}

/* 轮到"这名玩家自己的回合"时才结算的个人状态——技能冷却递减、商店刷新次数重置。
   这些是跟着"这名玩家的回合"走的，跟上面按"轮"批量发放的资源是两回事。 */
function grantTurnStart(data, playerId){
  var p=findPlayer(data,playerId);
  if(!p) return;
  if(p.skillCooldown>0) p.skillCooldown -= 1;
  p.storeRefreshCount = 0; /* 新回合开始，本回合第一次"换一批"重新变为免费 */
}

/* ---- src/mutators.js ---- */
/* ===================== 纯状态变更函数（mutator） ===================== */
/* 每个 mutator 接收克隆后的 game 数据，返回 {data} 表示成功写回，或 {error} 表示失败（不写回）。
   加新效果基本就是在这几个函数里加分支。 */

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

/* 找到"这名玩家手牌里是否有某张卡"，返回手牌下标（没有则 -1）——
   无相金身格挡奇袭、好兆骰被动加成都要检查对方/自己是否持有某张被动卡。 */
function findHandIndex(p, cardKey){
  for(var i=0;i<p.hand.length;i++){ if(p.hand[i].key===cardKey) return i; }
  return -1;
}

/* 玩家身上是否带着"即将跳过回合"的效果（被凌虚一指命中过、还没轮到自己回合被跳过）。
   处于这个状态时视为"保护中"：不能再被奇袭类效果命中，直到这一次跳过被消耗掉
   （也就是真正轮到、且跳过了那一次回合）为止，之后才能再被奇袭。 */
function hasActiveSkipTurn(p){
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

function mutJoin(data, id, name, hero){
  if(data.status!=='lobby') return {error:'游戏已经开始，无法加入'};
  if(findPlayer(data,id)) return {data:data};
  if(data.players.length>=4) return {error:'房间已满（最多4人）'};
  data.players.push(newPlayer(id,name,hero));
  data.log = pushLog(data.log, name+' 加入了房间');
  return {data:data};
}

function mutSetHero(data, id, heroKey){
  var p=findPlayer(data,id);
  if(!p) return {error:'你不在这个房间里'};
  if(data.status!=='lobby') return {error:'游戏已开始，无法更换英雄'};
  p.hero = heroKey;
  return {data:data};
}

function mutKick(data, requesterId, targetId){
  if(data.hostId!==requesterId) return {error:'只有房主可以移除玩家'};
  if(data.status!=='lobby') return {error:'游戏已开始，无法移除玩家'};
  var before=data.players.length;
  data.players = data.players.filter(function(p){ return p.id!==targetId; });
  if(data.players.length===before) return {error:'玩家不存在'};
  return {data:data};
}

function mutStart(data, requesterId){
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

function mutUseSkill(data, playerId, targetId){
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
    if(!targetId) return {error:'请选择目标玩家'};
    var t=findPlayer(data,targetId);
    if(!t || t.id===p.id) return {error:'目标无效'};
    addBuff(t,'STEP_PENALTY',3,2,'skill:zuihuayin','花醉三千');
    data.log = pushLog(data.log, p.name+' 使用【花醉三千】，对 '+t.name+' 施加 -3 步减益（持续2回合）');
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

function mutPlayCard(data, playerId, cardUid, targetId, payload){
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
    applyMovement(p, amount);
    data.log = pushLog(data.log, p.name+' 使用【凌云踏】，向前跳了 '+amount+' 格（到达第 '+p.position+' 格）');
    checkWinCondition(data, p);
  } else {
    return {error:'未知卡牌'};
  }
  p.hand.splice(idx,1);
  return {data:data};
}

function mutBuyCard(data, playerId, cardKey){
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
  data.log = pushLog(data.log, p.name+' 在商店购买了【'+card.name+'】，花费'+card.price+'元');
  return {data:data};
}

function mutSellCard(data, playerId, cardUid){
  if(data.status!=='playing') return {error:'游戏未在进行中'};
  var p=findPlayer(data,playerId);
  if(!p) return {error:'你不在这个房间里'};
  var idx=-1;
  for(var i=0;i<p.hand.length;i++){ if(p.hand[i].uid===cardUid){ idx=i; break; } }
  if(idx===-1) return {error:'卡牌不存在或已被使用'};
  var card=CARDS[p.hand[idx].key];
  p.hand.splice(idx,1);
  p.money += 5;
  data.log = pushLog(data.log, p.name+' 卖出了【'+(card?card.name:'卡牌')+'】，获得5元');
  return {data:data};
}

/* 商店"换一批"：本回合第1次免费，第2次5元，第3次及以后10元（见 STORE_REFRESH_PRICES）。
   刷新次数在每名玩家自己回合开始时重置（grantTurnStart 里）。 */
function mutRefreshStore(data, playerId){
  if(data.status!=='playing') return {error:'游戏未在进行中'};
  var p=findPlayer(data,playerId);
  if(!p) return {error:'你不在这个房间里'};
  var count = p.storeRefreshCount||0;
  var cost = STORE_REFRESH_PRICES[Math.min(count, STORE_REFRESH_PRICES.length-1)];
  if(p.money<cost) return {error:'金钱不足，换一批需要'+cost+'元'};
  p.money -= cost;
  p.storeRefreshCount = count+1;
  p.storeOffer = genStoreOffer();
  data.log = pushLog(data.log, p.name+' 刷新了商店'+(cost>0?('，花费'+cost+'元'):'（本回合首次，免费）'));
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

  /* 文津馆被动：这次移动如果越过了某名玩家（移动前在对方位置或更后，移动后严格超过对方），
     可以立即再掷一次——不把本回合标记为"已掷骰"，这样"掷骰子"按钮仍然可点，可以连续触发。 */
  var overtook = data.status==='playing' && p.hero==='wenjinguan' &&
    data.players.some(function(o){ return o.id!==p.id && beforePos<=o.position && p.position>o.position; });
  if(overtook){
    data.turnState.rolled = false;
    data.log = pushLog(data.log, p.name+' 凭借【运筹帷幄】被动越过了对手，可以再掷一次骰子');
  } else {
    data.turnState.rolled = true;
  }
}

function mutRoll(data, playerId){
  if(!isCurrentTurn(data,playerId)) return {error:'还没轮到你'};
  if(data.turnState.rolled) return {error:'本回合已经掷过骰子'};
  var p=findPlayer(data,playerId);
  var base = 1+Math.floor(Math.random()*6);
  performRoll(data, p, base);
  return {data:data};
}

function mutEndTurn(data, playerId){
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

module.exports = {
  HEROES: HEROES,
  CARDS: CARDS,
  PLAYER_COLORS: PLAYER_COLORS,
  WIN_POS: WIN_POS,
  STORE_REFRESH_PRICES: STORE_REFRESH_PRICES,
  uid: uid,
  roomCode: roomCode,
  clone: clone,
  sleep: sleep,
  shuffle: shuffle,
  esc: esc,
  findPlayer: findPlayer,
  nameOf: nameOf,
  isCurrentTurn: isCurrentTurn,
  sumBuff: sumBuff,
  addBuff: addBuff,
  tickBuffs: tickBuffs,
  pushLog: pushLog,
  drawCard: drawCard,
  genStoreOffer: genStoreOffer,
  newPlayer: newPlayer,
  grantRoundResources: grantRoundResources,
  grantTurnStart: grantTurnStart,
  hasActiveSkipTurn: hasActiveSkipTurn,
  mutJoin: mutJoin,
  mutSetHero: mutSetHero,
  mutKick: mutKick,
  mutStart: mutStart,
  mutUseSkill: mutUseSkill,
  mutPlayCard: mutPlayCard,
  mutBuyCard: mutBuyCard,
  mutSellCard: mutSellCard,
  mutRefreshStore: mutRefreshStore,
  mutRoll: mutRoll,
  mutEndTurn: mutEndTurn
};
