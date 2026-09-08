/* ===================== 渲染 ===================== */
/* 纯字符串拼 HTML 再整体替换，没有用框架。这里的函数只读 app.js 里的运行时状态
   （db / myRoom / game / myId / ui），不直接修改它们（除了 renderHome 里给输入框绑事件）。 */

import { HEROES, CARDS, PLAYER_COLORS, WIN_POS, STORE_REFRESH_PRICES } from './data.js';
import { esc } from './utils.js';
import { findPlayer, isCurrentTurn } from './game-logic.js';
import { runtime, paramRoom } from './app-state.js';

export function heroCardHtml(key, selected){
  var h=HEROES[key];
  return '<div class="hero-pick'+(selected?' selected':'')+'" data-action="pick-hero" data-hero="'+key+'">'+
    '<div class="hname">'+h.name+'</div>'+
    '<div class="hskill"><b style="color:var(--ivory)">主动·'+h.activeName+'</b>：'+h.activeDesc+'<br><b style="color:var(--ivory)">'+h.passiveName+'</b>：'+h.passiveDesc+'</div>'+
  '</div>';
}

export function buffChipsHtml(p){
  if(!p.buffs.length) return '';
  return '<div class="buff-row">'+p.buffs.map(function(b){
    var cls = (b.type==='STEP_PENALTY' || b.type==='SKIP_TURN')?'neg':'pos';
    var txt = b.type==='STEP_BONUS' ? ('+'+b.value+'步 '+b.label)
      : b.type==='STEP_PENALTY' ? ('-'+b.value+'步 '+b.label)
      : b.type==='SKIP_TURN' ? ('将跳过回合 '+b.label)
      : ('生财 '+b.label);
    return '<span class="buff-chip '+cls+'">'+esc(txt)+'（剩'+b.turnsLeft+'回合）</span>';
  }).join('')+'</div>';
}

export function boardHtml(game){
  var cells=[];
  for(var i=0;i<=WIN_POS;i++){
    var row=Math.floor(i/6), posInRow=i%6;
    var col = (row%2===0) ? posInRow : (5-posInRow);
    var cls='cell'+(i===0?' start':'')+(i===WIN_POS?' finish':'');
    var toksHtml = game.players.map(function(p,idx){
      return p.position===i ? '<span class="tok" style="background:'+PLAYER_COLORS[idx]+'" title="'+esc(p.name)+'">'+esc(p.name.slice(0,1))+'</span>' : '';
    }).join('');
    cells.push('<div class="'+cls+'" style="grid-row:'+(row+1)+';grid-column:'+(col+1)+'">'+
      '<div class="num">'+(i===0?'起':(i===WIN_POS?'终':i))+'</div>'+
      '<div class="tokens">'+toksHtml+'</div>'+
    '</div>');
  }
  return '<div class="board">'+cells.join('')+'</div>';
}

export function diePipsHtml(n){
  var layouts={
    1:[[50,50]],
    2:[[25,25],[75,75]],
    3:[[25,25],[50,50],[75,75]],
    4:[[25,25],[25,75],[75,25],[75,75]],
    5:[[25,25],[25,75],[50,50],[75,25],[75,75]],
    6:[[25,25],[25,50],[25,75],[75,25],[75,50],[75,75]]
  };
  var pips=layouts[n]||[];
  return '<div class="die">'+pips.map(function(p){ return '<i style="left:'+p[0]+'%;top:'+p[1]+'%;transform:translate(-50%,-50%)"></i>'; }).join('')+'</div>';
}

function storeRefreshCost(me){
  var count = (me && me.storeRefreshCount)||0;
  return STORE_REFRESH_PRICES[Math.min(count, STORE_REFRESH_PRICES.length-1)];
}

export function storePanelHtml(me){
  var offer = (me && me.storeOffer) || [];
  var cost = storeRefreshCost(me);
  var canRefresh = me && me.money>=cost;
  var html='<div class="card-panel">';
  html+='<div class="section-title">商店 · 随机为你上架5张卡牌</div>';
  html+='<div class="hand-grid">';
  html+=offer.map(function(key){
    var cd=CARDS[key];
    var can = me && me.money>=cd.price;
    return '<div class="hand-card"><div class="cname">'+cd.name+'</div><div class="cdesc">'+cd.desc+'</div>'+
      '<div class="cfoot"><span class="price-tag">'+cd.price+' 元</span>'+
      '<button class="btn btn-small btn-gold" data-action="buy-card" data-key="'+key+'"'+(can?'':' disabled')+'>购买</button></div></div>';
  }).join('');
  html+='</div>';
  html+='<button class="btn btn-small" data-action="refresh-store" style="margin-top:12px"'+(canRefresh?'':' disabled')+'>换一批'+(cost>0?('（'+cost+'元）'):'（本回合首次免费）')+'</button>';
  html+='<div class="footnote">这一页的5张卡牌互不重复；买下的卡牌会立刻放进你的口袋（手牌），并从这一页下架（换一批之后可能重新出现）。不喜欢的卡牌也可以在手牌里卖出，固定获得5元。"换一批"在你本回合开始时第1次免费，第2次5元，之后每次10元。</div>';
  html+='</div>';
  return html;
}

export function renderHome(app){
  var ui=runtime.ui;
  var initial = paramRoom();
  var isJoin = ui.homeMode==='join' || !!initial;
  var heroOpts = Object.keys(HEROES).map(function(k){ return heroCardHtml(k, ui.selectedHero===k); }).join('');

  var html = '<div class="topline"><h1 class="brush">凌云棋局</h1><div class="tag">Airplane Chess · 英雄卡牌对战 · 2-4人</div></div>';
  html += '<div class="home-wrap"><div class="card-panel"><div class="stack">';
  html += '<div class="mode-switch">'+
    '<button class="btn'+(!isJoin?' active':'')+'" data-action="home-mode" data-mode="create">创建房间</button>'+
    '<button class="btn'+(isJoin?' active':'')+'" data-action="home-mode" data-mode="join">加入房间</button>'+
  '</div>';
  html += '<label class="field">昵称<input type="text" id="nameInput" placeholder="给自己起个名字" maxlength="12" value="'+esc(localStorage.getItem('lq_name')||'')+'"></label>';
  if(isJoin){
    html += '<label class="field">房间号<input type="text" id="codeInput" placeholder="例如 A7QK9" maxlength="8" style="letter-spacing:.2em;text-transform:uppercase" value="'+esc(initial)+'"></label>';
  }
  html += '<div class="section-title">选择英雄</div>';
  html += '<div class="hero-grid">'+heroOpts+'</div>';
  if(isJoin){
    html += '<button class="btn btn-gold" data-action="join-room"'+(ui.joining?' disabled':'')+'>'+(ui.joining?'加入中…':'加入房间')+'</button>';
  } else {
    html += '<button class="btn btn-gold" data-action="create-room">创建房间</button>';
  }
  if(ui.error) html += '<div class="err-banner">'+esc(ui.error)+'</div>';
  html += '<div class="footnote">最多4人对战 · 更多英雄与卡牌陆续加入 · 房间数据保存在共享房间内，仅供当前参与者读写，请勿存放敏感信息。</div>';
  html += '</div></div></div>';
  app.innerHTML = html;

  var ni=document.getElementById('nameInput');
  if(ni) ni.addEventListener('change', function(){ localStorage.setItem('lq_name', ni.value); });
}

export function renderLobby(app){
  var game=runtime.game, myId=runtime.myId, ui=runtime.ui;
  var isHost = game.hostId===myId;
  var link = location.origin+location.pathname+'?room='+game.code;

  var html='<div class="topline"><h1 class="brush">凌云棋局</h1><div class="tag">等待玩家加入…</div></div>';
  html+='<div class="lobby-wrap"><div class="card-panel">';
  html+='<div class="room-code"><div>房间号<div class="code">'+game.code+'</div></div>'+
    '<button class="btn btn-small" data-action="copy-link">复制邀请链接</button></div>';
  html+='<input id="shareLinkBox" type="text" readonly value="'+esc(link)+'" style="margin-bottom:14px;font-size:.7rem;opacity:.7">';

  for(var i=0;i<4;i++){
    var p=game.players[i];
    if(p){
      var color=PLAYER_COLORS[i];
      html+='<div class="player-slot'+(p.id===myId?' me':'')+'">'+
        '<div class="token-dot" style="background:'+color+'">'+esc(p.name.slice(0,1))+'</div>'+
        '<div style="flex:1">'+
          '<div class="pname">'+esc(p.name)+(p.id===myId?' <span style="color:var(--gold);font-size:.7rem">（你）</span>':'')+(p.id===game.hostId?' <span class="host-badge">房主</span>':'')+'</div>'+
          (p.id===myId
            ? '<select data-role="hero-select" onchange="window.__lqSetHero(this.value)">'+
                Object.keys(HEROES).map(function(k){ return '<option value="'+k+'"'+(p.hero===k?' selected':'')+'>'+HEROES[k].name+'</option>'; }).join('')+
              '</select>'
            : '<div class="phero">'+(p.hero? HEROES[p.hero].name : '尚未选择英雄')+'</div>')+
        '</div>'+
        (isHost && p.id!==myId ? '<button class="btn btn-small" data-action="kick" data-id="'+p.id+'">移除</button>' : '')+
      '</div>';
    } else {
      html+='<div class="empty-slot">等待玩家加入…</div>';
    }
  }

  html+='<button class="btn btn-gold" data-action="start-game" style="margin-top:6px"'+(isHost?'':' disabled')+'>'+(isHost?'开始游戏':'等待房主开始游戏')+'</button>';
  html+='<button class="btn" data-action="leave">离开房间</button>';
  if(ui.error) html+='<div class="err-banner">'+esc(ui.error)+'</div>';
  html+='<div class="footnote">房主可移除玩家或调整完毕后开始游戏，需要至少2名玩家、且所有人已选择英雄。</div>';
  html+='</div></div>';
  app.innerHTML=html;
}

export function renderGame(app){
  var game=runtime.game, myId=runtime.myId, ui=runtime.ui;
  var me=findPlayer(game,myId);
  var myTurn = isCurrentTurn(game,myId);
  var lr=game.turnState.lastRoll;
  var storeMode = ui.gameTab==='store';

  var skillDisabled = !(myTurn && me && !game.turnState.skillUsed && !game.turnState.rolled && game.status==='playing' && me.skillCooldown<=0);
  var skillLabel = '使用技能'+(me&&HEROES[me.hero]?'：'+HEROES[me.hero].activeName:'');
  if(me && me.skillCooldown>0) skillLabel += '（冷却中，还需'+me.skillCooldown+'回合）';

  var html='<div class="game-wrap">';
  html+='<div class="game-head"><h1 class="brush" style="font-size:1.8rem;margin:0">凌云棋局</h1>'+
    '<div class="room-tag">房间 '+game.code+' &nbsp;·&nbsp; '+
    '<button class="btn btn-small" data-action="toggle-tab">'+(storeMode?'返回牌局':'🛒 商店')+'</button> &nbsp;'+
    '<button class="btn btn-small" data-action="leave">离开房间</button></div></div>';

  /* 左侧：棋盘 + 骰子 + 规则，或者商店 */
  html+='<div class="board-area">';
  if(storeMode){
    html+=storePanelHtml(me);
  } else {
    html+=boardHtml(game);
    html+='<div class="card-panel">';
    html+='<div class="section-title">骰子</div>';
    html+='<div class="dice-box">'+diePipsHtml(lr?lr.base:1)+
      '<div class="roll-summary">'+
        (lr ? ('本回合：骰子 <b>'+lr.base+'</b> 点 '+(lr.bonus>=0?'+':'')+lr.bonus+' 修正 = <b>'+lr.finalSteps+'</b> 步'+(lr.moneyGain>0?'，获得 <b>'+lr.moneyGain+'</b> 元':'')+(lr.passiveNote?('<br>'+esc(lr.passiveNote)):'')) : '尚未掷骰子')+
      '</div>'+
    '</div>';
    html+='<div class="action-bar" style="margin-top:14px">'+
      '<button class="btn btn-cinnabar" data-action="roll-dice"'+((myTurn && !game.turnState.rolled && game.status==='playing')?'':' disabled')+'>掷骰子</button>'+
      '<button class="btn" data-action="use-skill"'+(skillDisabled?' disabled':'')+'>'+skillLabel+'</button>'+
      '<button class="btn btn-gold" data-action="end-turn"'+((myTurn && game.status==='playing')?'':' disabled')+'>结束回合</button>'+
    '</div>';
    html+='</div>';

    html+='<div class="card-panel">';
    html+='<details class="rules"><summary>规则说明</summary>'+
      '<div class="rsec"><b>目标</b>：率先到达第40格获胜。</div>'+
      '<div class="rsec"><b>每一轮开始</b>：所有玩家同时免费获得 30 元和 2 张随机卡牌，直接放进各自口袋，不用花钱（开局是第1轮；之后每当轮完一圈、回到最先手的玩家时，就开始新的一轮，再同时发一次）。</div>'+
      '<div class="rsec"><b>商店</b>：随时可以打开商店，里面随机上架 5 张互不重复的卡牌，花钱买下放进口袋；买过的卡牌会从这一页下架（刷新后可能重新出现）。口袋里不想要的卡牌也可以随时卖出，固定获得 5 元。"换一批"在你本回合开始时第1次免费，第2次5元，之后每次10元。</div>'+
      '<div class="rsec"><b>回合流程</b>：可先使用技能 / 打出口袋里的卡牌，再掷骰子结算步数（掷骰子之后仍然可以继续打卡牌，只是不能再用技能），最后结束回合——即使还没掷骰子，也可以直接结束回合放弃本回合的移动。</div>'+
      '<div class="rsec"><b>技能冷却</b>：主动技能用一次后默认冷却2回合——本回合用过，下一次轮到自己不能用，再下一次轮到自己才能再用（文津馆的冷却只有1回合，狂澜的冷却取决于本次是否真正命中，见各自说明）。</div>'+
      '<div class="rsec"><b>叠加同一效果</b>：如果同一张卡/同一个技能的效果已经在身上生效，再次使用不会把数值继续叠加，而是把持续回合数相加（比如阴阳迷踪步用两次仍是 +5 步，但持续时间变成4回合）。</div>'+
      '<div class="rsec"><b>天泉</b>——主动·千金取义：花20元获得2张随机卡牌；被动：非自己回合内失去钱，获得（失去金额÷3）步数增益。</div>'+
      '<div class="rsec"><b>醉花阴</b>——主动·花醉三千：使目标玩家 -3 步，持续2回合；被动：场上有敌人带减益时，自己 +3 步。</div>'+
      '<div class="rsec"><b>孤云</b>——主动·大道无为（冷却2回合）：朝场上（除自己以外）最靠近终点的玩家靠近——相距≤6格则直接到达对方所在格，否则朝对方方向移动6格；如果自己已经是全场第一，则会转而朝落后自己最多的那名对手移动，方向可能是往回走。移动后立刻获得一张凌虚一指；被动：落后领先者3-4格+2步，5-9格+5步，10格以上+7步。</div>'+
      '<div class="rsec"><b>文津馆</b>——主动·运筹帷幄（冷却1回合，相当于每轮到自己都能用）：投两次骰子取较大值作为本回合点数；被动：本回合移动越过了某名玩家的位置，可以再掷一次骰子，只要还在越过别人就能连续触发。</div>'+
      '<div class="rsec"><b>狂澜</b>——主动·军威赫赫：对前后6格内所有玩家发起奇袭（可被无相金身格挡、保护状态免疫），被扫到的玩家无论是否命中都会随机失去自身一项效果；若无人被真正命中，下回合仍可再用，命中则2回合冷却并前进6格；被动：每次使用主动技能，自己 +3 步（用于紧接着的下一次掷骰子）。</div>'+
      '<div class="rsec"><b>阴阳迷踪步</b>（商店价20元）：自身 +5 步，持续2回合。&nbsp; <b>生财有道</b>（商店价15元）：按最终步数获得金钱，持续2回合。</div>'+
      '<div class="rsec"><b>清风霁月</b>（商店价15元）：解除自身一项减益。&nbsp; <b>金玉手</b>（商店价15元）：使目标玩家 -3 步。</div>'+
      '<div class="rsec"><b>被动卡牌</b>：无相金身、好兆骰这两张卡不需要主动使用，只要留在口袋（手牌）里就一直生效；被消耗（无相金身格挡奇袭）或卖出后才会失效。</div>'+
      '<div class="rsec"><b>无相金身</b>（商店价15元，被动）：留在口袋里可以抵御一次"奇袭"类卡牌（目前指凌虚一指），格挡后自身消耗掉。</div>'+
      '<div class="rsec"><b>凌虚一指</b>（商店价15元，奇袭）：对你当前位置前后2格内的一名玩家使用，使其跳过下一个回合；若对方持有无相金身则被格挡、无效。同一名玩家一次只能被奇袭命中一次——已经"即将跳过回合"的玩家处于保护状态，要等TA的那次回合真正跳过之后才能再被奇袭。</div>'+
      '<div class="rsec"><b>梁上君子</b>（商店价15元）：偷走一名玩家15元（对方不足15元则偷走全部）。&nbsp; <b>摄星拿月</b>（商店价20元）：随机偷走一名玩家手牌中的1张卡牌。</div>'+
      '<div class="rsec"><b>好兆骰</b>（商店价30元，被动）：留在口袋里时，掷骰点数1-2额外+3步，4-5额外+2步，6额外+1步（点数为3无加成）。</div>'+
      '<div class="rsec"><b>凌云踏</b>（商店价15元）：立即向前跳3/4/5/6格（自选），与本回合骰子移动叠加。</div>'+
      '<div class="rsec"><b>飒沓流星</b>（商店价30元，被动）：留在口袋里时，自己每一次成功命中的奇袭（不含被格挡/被保护免疫的）都额外前进6格。&nbsp; <b>聚宝盆</b>（商店价30元，被动）：留在口袋里时，自己金钱超过30元+2步，超过80元改为+4步（不叠加，取最高档）。</div>'+
      '<div class="rsec"><b>叨叨不叨叨</b>（商店价15元）：销毁一名玩家手牌中随机1张卡牌，对方没有任何补偿。&nbsp; <b>狮吼正声</b>（商店价30元，奇袭）：无视距离，直接对当前排名第一的玩家（自己是第一则改打第二名）发起奇袭，命中后目标跳过下一回合并倒退5格；同样可被无相金身格挡、对保护状态中的玩家无效。</div>'+
    '</details>';
    html+='</div>';
  }
  html+='</div>'; // board-area

  /* 右侧：玩家状态 + 我的手牌 + 日志 */
  html+='<div class="side-panel">';
  html+='<div class="card-panel"><div class="section-title">玩家</div><div class="players-panel">';
  html+=game.players.map(function(p,idx){
    var isCur = game.status==='playing' && game.turnOrder[game.turnIndex]===p.id;
    var hero=HEROES[p.hero];
    return '<div class="pstat'+(isCur?' current':'')+'">'+
      '<div class="token-dot" style="background:'+PLAYER_COLORS[idx]+'">'+esc(p.name.slice(0,1))+'</div>'+
      '<div>'+
        '<div class="pline1">'+esc(p.name)+(p.id===myId?' <span class="youtag">你</span>':'')+'</div>'+
        '<div class="pline2"><span>'+(hero?hero.name:'—')+'</span><span>💰 '+p.money+'</span><span>🃏 '+p.hand.length+'张</span><span>📍 第'+p.position+'格</span>'+
          (p.skillCooldown>0?('<span>⏳技能冷却'+p.skillCooldown+'</span>'):'')+
        '</div>'+
      '</div>'+
      (isCur?'<span class="turn-flag">回合中</span>':'')+
      buffChipsHtml(p)+
    '</div>';
  }).join('');
  html+='</div></div>';

  if(me){
    html+='<div class="card-panel"><div class="section-title">我的手牌（仅自己可见）</div><div class="hand-grid">';
    if(me.hand.length===0) html+='<div style="font-size:.78rem;color:var(--ivory-dim)">暂无卡牌，去商店看看吧</div>';
    html+=me.hand.map(function(c){
      var cd=CARDS[c.key];
      var canUse = myTurn && game.status==='playing';
      return '<div class="hand-card"><div class="cname">'+cd.name+(cd.passive?' <span style="font-size:.62rem;color:var(--ivory-dim);font-weight:400">（被动·留在口袋里生效）</span>':'')+'</div><div class="cdesc">'+cd.desc+'</div>'+
        '<div class="cfoot"><span class="price-tag">商店价 '+cd.price+' 元</span>'+
        '<div style="display:flex;gap:6px">'+
          '<button class="btn btn-small" data-action="sell-card" data-uid="'+c.uid+'">卖出 +5</button>'+
          (cd.passive ? '' : '<button class="btn btn-small btn-gold" data-action="play-card" data-uid="'+c.uid+'" data-key="'+c.key+'"'+(canUse?'':' disabled')+'>使用</button>')+
        '</div></div></div>';
    }).join('');
    html+='</div></div>';
  }

  html+='<div class="card-panel"><div class="section-title">对局日志</div><div class="log-panel">'+
    game.log.slice().reverse().map(function(l,i){ return '<div'+(i===0?' class="lg-new"':'')+'>'+esc(l.text)+'</div>'; }).join('')+
  '</div></div>';
  html+='</div>'; // side-panel

  if(ui.error) html+='<div class="err-banner" style="grid-column:1/-1">'+esc(ui.error)+'</div>';
  html+='</div>'; // game-wrap

  if(ui.pendingTarget){
    var opts=ui.pendingTarget.candidates || game.players.filter(function(p){return p.id!==myId;});
    html+='<div class="modal-backdrop"><div class="modal-box"><h3>'+esc(ui.pendingTarget.title)+'</h3><p>选择要施加效果的目标玩家</p><div class="target-list">'+
      opts.map(function(p){ return '<button class="btn" data-action="pick-target" data-id="'+p.id+'">'+esc(p.name)+'</button>'; }).join('')+
    '</div><button class="btn btn-small" data-action="cancel-target">取消</button></div></div>';
  }

  if(ui.pendingChoice){
    html+='<div class="modal-backdrop"><div class="modal-box"><h3>'+esc(ui.pendingChoice.title)+'</h3><p>选择一个选项</p><div class="target-list">'+
      ui.pendingChoice.options.map(function(o){ return '<button class="btn" data-action="pick-choice" data-value="'+esc(String(o.value))+'">'+esc(o.label)+'</button>'; }).join('')+
    '</div><button class="btn btn-small" data-action="cancel-choice">取消</button></div></div>';
  }

  if(game.status==='finished'){
    var w=findPlayer(game, game.winner);
    html+='<div class="winner-overlay"><div class="winner-box"><div class="wtitle">🏆 胜利！</div><div class="wname">'+esc(w?w.name:'')+' 率先抵达第40格</div>'+
      '<button class="btn btn-gold" data-action="back-home-finished">返回首页</button></div></div>';
  }

  app.innerHTML = html;
}

export function render(app){
  var ui=runtime.ui;
  if(!runtime.db){
    app.innerHTML =
      '<div class="topline"><h1 class="brush">凌云棋局</h1><div class="tag">Airplane Chess · 英雄卡牌对战</div></div>'+
      '<div class="center-msg">多人对战功能尚未配置：请先在 <code>src/supabase-config.js</code> 里填入你自己 Supabase 项目的 URL 和 anon key（Supabase 控制台 → Project Settings → API），然后重新部署。</div>';
    return;
  }
  if(!runtime.myRoom || !runtime.game){ renderHome(app); return; }
  if(runtime.game.status==='lobby'){ renderLobby(app); return; }
  renderGame(app);
}
