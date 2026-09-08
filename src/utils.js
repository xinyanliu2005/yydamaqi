/* ===================== 通用工具函数（与游戏规则无关） ===================== */

export function uid(){ return Math.random().toString(36).slice(2,10)+Date.now().toString(36); }

export function roomCode(){
  var chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s='';
  for(var i=0;i<5;i++) s+=chars[Math.floor(Math.random()*chars.length)];
  return s;
}

export function clone(x){ return JSON.parse(JSON.stringify(x)); }

export function sleep(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }

export function shuffle(arr){
  var a=arr.slice();
  for(var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; }
  return a;
}

export function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }

/* 按权重、不放回地抽 count 个 key。weights 是 {key: 权重数字} 的形式，权重<=0
   的 key 永远不会被抽到。商店卡牌概率就是靠这个函数实现的。 */
export function weightedPickWithoutReplacement(weights, count){
  var pool = Object.keys(weights)
    .filter(function(k){ return weights[k]>0; })
    .map(function(k){ return {key:k, w:weights[k]}; });
  var result=[];
  while(result.length<count && pool.length>0){
    var total = pool.reduce(function(s,e){ return s+e.w; }, 0);
    var r = Math.random()*total;
    var acc=0, idx=pool.length-1;
    for(var i=0;i<pool.length;i++){ acc+=pool[i].w; if(r<acc){ idx=i; break; } }
    result.push(pool[idx].key);
    pool.splice(idx,1);
  }
  return result;
}

/* 按权重抽 1 个 key（放回抽样，可以重复）——免费发牌/千金取义用这个，跟商店那种
   "5张互不重复"的抽法不一样，每次抽都是独立的。 */
export function weightedPickOne(weights){
  var keys = Object.keys(weights).filter(function(k){ return weights[k]>0; });
  var total = keys.reduce(function(s,k){ return s+weights[k]; }, 0);
  var r = Math.random()*total;
  var acc=0;
  for(var i=0;i<keys.length;i++){ acc+=weights[keys[i]]; if(r<acc) return keys[i]; }
  return keys[keys.length-1];
}
