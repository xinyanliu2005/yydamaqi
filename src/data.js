/* ===================== 静态数据 ===================== */
/* 加新英雄/卡牌从这里加一条即可，逻辑代码（mutators.js）不用大改。 */

/* type 只用于选英雄界面按"流派"分组展示（省地方，不在挑英雄那一步就把一大段
   技能说明摊开）；具体数值/效果说明还是在游戏内的"规则说明"里。 */
export var HERO_TYPE_ORDER = ['神行','控场','执锐'];

export var HEROES = {
  tianquan: {
    key:'tianquan', name:'天泉', color:'#4d7eb0', type:'神行',
    activeName:'千金取义',
    activeDesc:'花20块钱获得随机两张卡牌',
    passiveName:'被动',
    passiveDesc:'在非自己回合内失去钱，将获得步数增益（失去金额 ÷ 3）'
  },
  zuihuayin: {
    key:'zuihuayin', name:'醉花阴', color:'#9a5cc0', type:'控场',
    activeName:'花醉三千',
    activeDesc:'对场上所有其他玩家施加3步减益，持续2回合',
    passiveName:'被动',
    passiveDesc:'场上敌人若带有减益，自己额外获得3步数'
  },
  wenjinguan: {
    key:'wenjinguan', name:'文津馆', color:'#3f6b8a', type:'神行',
    activeName:'运筹帷幄',
    activeDesc:'投两次骰子，取点数较大的一次结算本回合移动',
    passiveName:'被动',
    passiveDesc:'本回合的移动如果越过了某名玩家的位置，可以再掷一次骰子；只要还在越过别人，就能一直连续再掷'
  },
  kuanglan: {
    key:'kuanglan', name:'狂澜', color:'#a83232', type:'执锐',
    activeName:'军威赫赫',
    activeDesc:'对当前位置前后6格内的所有玩家发起奇袭，使其跳过下一回合（可被「无相金身」格挡，处于保护状态的玩家免疫）；无论是否命中，被扫到的玩家都会被随机移除自身一项效果。若本次无人被真正命中跳过，下回合仍可再次使用（不进入冷却）；若有人被命中，则进入2回合冷却，并使自己前进6格。',
    passiveName:'被动',
    passiveDesc:'每次使用主动技能，自己获得 +3 步（用于紧接着的下一次掷骰子）'
  },
  guyun: {
    key:'guyun', name:'孤云', color:'#6b8f71', type:'执锐',
    activeName:'大道无为',
    activeDesc:'朝场上最靠近终点的玩家靠近：若相距≤6格，直接移动到对方所在格；若超过6格，则朝对方方向移动6格。移动后立刻获得一张【凌虚一指】。冷却2回合。',
    passiveName:'被动',
    passiveDesc:'落后于场上最靠近终点的玩家3-4格时+2步，落后5-9格时+5步，落后10格及以上时+7步'
  },
  qingxi: {
    key:'qingxi', name:'青溪', color:'#5c8fae', type:'控场',
    activeName:'坐看云起',
    activeDesc:'获得一张【妙手回春】，冷却2回合',
    passiveName:'被动',
    passiveDesc:'组队模式（2v2）专属：队友被奇袭命中时，自己可以代为化解——从队友身上拿走15元或1张卡牌（各50%概率，缺哪样就改拿另一样）；同一轮内为同一名队友化解多次，代价翻倍；队友（翻倍后）金钱/卡牌都不足时不会触发。单人混战模式下没有队友，这条被动不生效。'
  },
  moshandao: {
    key:'moshandao', name:'墨山道', color:'#7a6a4f', type:'控场',
    activeName:'兼爱非攻',
    activeDesc:'自己获得2张随机卡牌（组队模式下，队友也会同时获得2张），冷却2回合',
    passiveName:'被动',
    passiveDesc:'这一轮里打出过的卡牌种类数会转化为掷骰步数加成：1种+1步，2种及以上+2步（本回合封顶+2步；组队模式下会把队友这一轮打出的种类也算进来）'
  },
  liyuan: {
    key:'liyuan', name:'梨园', color:'#c26b7a', type:'神行',
    activeName:'请君打榜',
    activeDesc:'随机从一名敌方玩家身上偷取15元或1张随机卡牌（各50%概率，对方缺哪样就改偷另一样，两样都没有则一无所获），冷却2回合',
    passiveName:'被动',
    passiveDesc:'落后当前第一名超过5格时+4步；自己就是第一名时不会触发'
  }
};

export var CARDS = {
  /* teamTargetable：单人混战（1vN）模式下没有队友，直接对自己生效，不用挑目标；
     组队模式（2v2）下会多出"自己/队友"二选一，见 app.js 的 play-card 处理。
     生财有道刻意不给这个标记——那是自己按下一次骰子结算拿钱的效果，送给队友
     没有意义。 */
  yinyang:  { key:'yinyang',  name:'阴阳迷踪步', price:20, desc:'为自己增加5步数增益，持续2回合', needsTarget:false, teamTargetable:true },
  shengcai: { key:'shengcai', name:'生财有道',   price:15, desc:'接下来2回合，按该回合最终步数获得等额金钱', needsTarget:false },
  qingfeng: { key:'qingfeng', name:'清风霁月',   price:15, desc:'消除自身一项减益（可解除“花醉三千”）', needsTarget:false, teamTargetable:true },
  jinyu:    { key:'jinyu',    name:'金玉手',     price:15, desc:'对一名敌方玩家施加减益，使其减少3步数', needsTarget:true },

  /* 被动卡：不主动打出，放在手牌（口袋）里就一直生效，直到被消耗或卖出。 */
  wuxiang:  { key:'wuxiang', name:'无相金身', price:15,
    desc:'被动：只要留在口袋里，就能抵御一次「奇袭」类卡牌（如凌虚一指）——被奇袭时自动消耗掉，本次奇袭完全无效',
    needsTarget:false, passive:true },
  haozhao:  { key:'haozhao', name:'好兆骰', price:30,
    desc:'被动：只要留在口袋里，掷骰点数为1-3时额外+3步，4-6时额外+1步。若同时持有好运骰/聚宝盆中恰好1张（合计2张幸运牌），改用统一的组合效果：点数≤4时+3步，≥5时+1步并额外获得1张随机卡牌；若3张全部持有，则各自独立生效，并且每次轮到自己的回合开始时额外获得1张随机卡牌',
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
    desc:'被动：只要留在口袋里，自己金钱超过30元时+2步，超过80元时改为+4步（两档不叠加，按最高档计算）。若同时持有好兆骰/好运骰中恰好1张（合计2张幸运牌），改用统一的组合效果，见好兆骰说明；3张全部持有则各自独立生效，并额外获得回合开始摸牌',
    needsTarget:false, passive:true },

  qiaoshan: { key:'qiaoshan', name:'敲山震虎', price:20,
    desc:'奇袭：无视距离，锁定当前排名第一的玩家（如果就是自己则改打第二名），使其跳过下一回合（若被「无相金身」格挡或对方处于保护状态，则完全无效）。只有在场上有玩家率先冲到全程80%之后，商店才会上架这张卡',
    needsTarget:false, surpriseAttack:true },

  pofuchenzhou: { key:'pofuchenzhou', name:'破釜沉舟', price:15,
    desc:'立即花费20元，获得2张【凌虚一指】（金钱不足20元时无法使用）',
    needsTarget:false },
  sancai: { key:'sancai', name:'散财消灾', price:15,
    desc:'被动：只要留在口袋里，被「奇袭」命中时不会跳过回合，而是改为损失20元（优先级高于无相金身）；若金钱不足20元，这张卡不生效，本次奇袭正常命中。触发一次就消耗掉这张卡',
    needsTarget:false, passive:true },
  qianlimu: { key:'qianlimu', name:'千里目', price:30,
    desc:'被动：只要留在口袋里，自己发起的【凌虚一指】奇袭距离限制额外 +2 格',
    needsTarget:false, passive:true },
  yizhiqianjin: { key:'yizhiqianjin', name:'一掷千金', price:20,
    desc:'押上全部身家：花光当前所有金钱，前进（花掉的金钱 ÷ 5）步，最多前进15步',
    needsTarget:false },

  /* 青溪的主动技能"坐看云起"专属产物，商店里买不到（见 STORE_WEIGHTS_EARLY/MID
     里的权重都是0）。单人混战（1vN）模式下没有队友，打出去只能是帮自己，不用
     挑目标；组队模式（2v2）下可以选择帮自己还是帮队友。 */
  miaoshouhuichun: { key:'miaoshouhuichun', name:'妙手回春', price:20,
    desc:'使用后立即对自己（或组队模式下的队友）生效：若目标当前没有减益，获得+4步增益（持续2回合）；若目标有减益，则清除所有减益，并改为获得+2步增益（持续2回合）。无法在商店购买，只能通过青溪的【坐看云起】获得',
    needsTarget:false, teamTargetable:true },

  /* teammateOnly：只在组队模式（2v2）下有意义——单人混战没有队友可以给，
     这两张卡在 1vN 模式下商店/免费发牌的权重直接是 0（见 computeCardWeights），
     打出时也固定送给队友，不用挑目标（队友只有一个，没什么好选的）。 */
  youqianrenxing: { key:'youqianrenxing', name:'有钱任性', price:15,
    desc:'把自己当前一半的金钱送给队友（组队模式专属）',
    needsTarget:false, teammateOnly:true },
  paiyoujienan: { key:'paiyoujienan', name:'排忧解难', price:15,
    desc:'从自己口袋里随机抽1张卡牌送给队友（组队模式专属）',
    needsTarget:false, teammateOnly:true },

  /* 后发制人：单人混战模式没有队友，固定对自己生效；组队模式下可以选自己还是
     队友。按"目标与当前第一名的差距占全程的百分比"分三档：差距>45%给得最多，
     30%-45%次之，其余（含目标自己就是第一名）只有个小奖励。 */
  houfazhiren: { key:'houfazhiren', name:'后发制人', price:15,
    desc:'对自己或队友使用：目标落后当前第一名的差距超过全程45%，获得2张随机卡牌和下次掷骰+4步；30%-45%之间，获得1张随机卡牌和+2步；差距不足30%（含目标自己就是第一名），只获得+1步',
    needsTarget:false, teamTargetable:true },

  tuonidaishui: { key:'tuonidaishui', name:'拖泥带水', price:15,
    desc:'无视距离，锁定当前排名第一的玩家（组队模式下排除自己的队友），使其接下来2回合 -3 步（可被清风霁月解除）',
    needsTarget:false },
  cunbunanxing: { key:'cunbunanxing', name:'寸步难行', price:15,
    desc:'无视距离，锁定当前排名第一的玩家（组队模式下排除自己的队友），使其下一次掷骰无论有多少增益/减益，最终都只能移动1步（可被清风霁月解除）',
    needsTarget:false },

  haoyunshai: { key:'haoyunshai', name:'好运骰', price:30,
    desc:'被动：只要留在口袋里，掷骰点数≥5时额外获得1张随机卡牌。与好兆骰/聚宝盆的组合效果见好兆骰说明',
    needsTarget:false, passive:true },
  zhuibuling: { key:'zhuibuling', name:'追捕令', price:30,
    desc:'被动：只要留在口袋里，自己每一次成功命中的奇袭（不含被防住/被保护免疫的）都立即额外获得30元',
    needsTarget:false, passive:true }
};

export var PLAYER_COLORS = ['#c1452c','#c9a24b','#4d7eb0','#9a5cc0'];
export var WIN_POS = 99;

/* 特殊格子效果。每局开始时（mutStart）会把这些效果随机分配到棋盘上 0 和
   WIN_POS 之外的格子上，每种效果目前只出现一次，落在哪一格是随机的——具体
   分配结果存在 data.gridEffects（{格子号: 效果key}）里，跟着这一局的房间状态走。
   short 是格子上显示的极简标记（棋盘格太小放不下全名），完整名字/效果放在
   title 提示和"规则说明"里。 */
export var GRID_EFFECT_DEFS = {
  wuxianghuang: { name:'无相皇', short:'皇',
    desc:'下一回合无法使用主动技能（可被「清风霁月」解除）' },
  qianye: { name:'千夜', short:'夜',
    desc:'接下来2回合 -3 步（可被「清风霁月」解除）' },
  zhangwanshi: { name:'张万师', short:'师',
    desc:'立即掷一次骰子，并倒退相应的格数' },
  taipingzhonglou: { name:'太平钟楼', short:'楼',
    desc:'下一轮，全场禁止使用奇袭类卡牌和执锐系主动技能（同一轮内多人踩中只算一次，不会延长）' },
  changpingcang: { name:'常平仓', short:'仓',
    desc:'所有玩家立即获得50元' },
  guishi: { name:'鬼市', short:'市',
    desc:'随机偷走其他玩家的2张卡牌（可能来自同一人，也可能分属不同人，内容对其他人保密）' },
  chongyuandian: { name:'崇元殿', short:'殿',
    desc:'下一次掷骰额外 +5 步' },
  feitiancanyuan: { name:'飞天残垣', short:'垣',
    desc:'立即获得一张【凌云踏】' },
  luchai: { name:'鲁菜', short:'菜',
    desc:'从三项奖励中任选一项：20元 / 下回合+3步 / 2张随机卡牌（需要选择后才能继续掷骰子或结束回合）' },
  ronglu: { name:'熔炉', short:'炉',
    desc:'获得2张随机卡牌，然后必须从手牌中弃置2张（需要选择后才能继续掷骰子或结束回合）' },
  zhulinxiaowu: { name:'竹林小屋', short:'竹',
    desc:'接下来2回合 +3 步' },
  buxianxian: { name:'不羡仙', short:'仙',
    desc:'清除自身当前所有减益' },
  dufu: { name:'独夫', short:'夫',
    desc:'下一回合无法使用任何卡牌（可被「清风霁月」解除）' },
  heiyinvzi: { name:'黑衣女子', short:'衣',
    desc:'接下来2回合，无法防御任何奇袭（无相金身/散财消灾/队友化解都不生效），无法被任何效果解除' },
  wangyuechanyuan: { name:'望月婵媛', short:'婵',
    desc:'立即掷一次骰子，点数1-2则跳过下一个回合（无法被任何效果解除）' },
  feimao: { name:'肥猫', short:'猫',
    desc:'立即掷一次骰子：1点倒退2格；2-3点获得20元；4-5点获得20元和1张随机卡牌；6点获得30元和1张随机卡牌' },
  foguangding: { name:'佛光顶', short:'佛',
    desc:'立即获得一张【无相金身】' },
  bishuiyuntao: { name:'碧水云涛', short:'涛',
    desc:'直到下回合结束前，自己发起的凌虚一指奇袭距离不受限制' },
  daozhu: { name:'道主', short:'主',
    desc:'失去2张随机手牌' },
  heicaishen: { name:'黑财神', short:'财',
    desc:'损失20元' },
  fanlou: { name:'樊楼', short:'樊',
    desc:'下一次掷骰子的点数范围变为 -2 到 8（不是正常的1-6）' }
};
export var GRID_EFFECT_KEYS = Object.keys(GRID_EFFECT_DEFS);

/* 商店"换一批"的价格阶梯：本回合第 N 次刷新对应下标 N（从0开始），
   超出数组长度的次数一律用最后一档的价格。 */
export var STORE_REFRESH_PRICES = [0, 5, 10];

/* 卖出手牌卡片能拿回多少钱：商店价30元的卡（好兆骰/飒沓流星/狮吼正声/聚宝盆）
   卖8元，其余卡固定卖5元。 */
export var SELL_PRICE_FOR_30 = 8;
export var SELL_PRICE_DEFAULT = 5;

/* 全程达到这个比例（0.8 = 80%）时，触发"商店开始上架奇袭卡"的里程碑。 */
export var MILESTONE_RATIO = 0.8;

/* 商店卡牌权重表——按"游戏阶段"分两档基础权重：第1-2轮 vs 第3轮起。数值只是
   相对比例，不是百分比。0 表示这个阶段完全不会出现在商店里。这里的具体数字
   还在摸索阶段，后续会继续调整。 */
export var STORE_WEIGHTS_EARLY = { /* 第1-2轮：新手卡 + 被动卡常见，奇袭类很少见 */
  yinyang:8, shengcai:8, qingfeng:8, jinyu:8,
  wuxiang:8, haozhao:8, sadaliuxing:8, jubaopen:8, sancai:8,
  lingxu:1, lingyun:1, qianlimu:1, yizhiqianjin:1,
  daodao:0, shihou:0, shexing:0, liangshang:0, qiaoshan:0, pofuchenzhou:0,
  miaoshouhuichun:0, /* 只能靠青溪的技能获得，商店/免费发牌永远不会抽到 */
  youqianrenxing:8, paiyoujienan:8, /* 组队模式专属，1vN下权重会被强制归零，见 computeCardWeights */
  houfazhiren:1, /* 落后差距早期基本不存在，跟凌虚一指/凌云踏一样早期少见 */
  tuonidaishui:0, cunbunanxing:0, /* 针对"当前第一名"的干扰卡，早期没有明显领先者，跟其他干扰卡一样第3轮才出现 */
  haoyunshai:8, zhuibuling:8 /* 跟其他30元被动卡（好兆骰/飒沓流星/聚宝盆）一样，早期常见 */
};
export var STORE_WEIGHTS_MID = { /* 第3轮起：干扰/进攻类卡牌成为主流，但基础卡/被动卡也没有变得
   罕见——两档权重从8:2（约7.3% : 1.8%，四倍差距）改成8:7（约4.9% : 4.2%，1vN模式下），
   差距明显缩小了很多。 */
  lingxu:8, lingyun:8, daodao:8, shexing:8, liangshang:8,
  qianlimu:8, yizhiqianjin:8, pofuchenzhou:8,
  yinyang:7, shengcai:7, qingfeng:7, jinyu:7,
  wuxiang:7, haozhao:7, sadaliuxing:7, jubaopen:7, sancai:7,
  shihou:0, qiaoshan:0,
  miaoshouhuichun:0,
  youqianrenxing:7, paiyoujienan:7,
  houfazhiren:8,
  tuonidaishui:8, cunbunanxing:8,
  haoyunshai:7, zhuibuling:7
};
/* 达成80%里程碑后，"非率先冲刺者"抽卡时额外叠加的权重——奇袭类卡牌变得更常见，
   给落后的玩家更多反打领先者的机会。 */
export var MILESTONE_SURPRISE_ATTACK_BOOST = { lingxu:6, shihou:6, qiaoshan:6 };
