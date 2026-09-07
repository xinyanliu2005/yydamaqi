/* ===================== 静态数据 ===================== */
/* 加新英雄/卡牌从这里加一条即可，逻辑代码（mutators.js）不用大改。 */

export var HEROES = {
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

export var CARDS = {
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

export var PLAYER_COLORS = ['#c1452c','#c9a24b','#4d7eb0','#9a5cc0'];
export var WIN_POS = 40;

/* 商店"换一批"的价格阶梯：本回合第 N 次刷新对应下标 N（从0开始），
   超出数组长度的次数一律用最后一档的价格。 */
export var STORE_REFRESH_PRICES = [0, 5, 10];
