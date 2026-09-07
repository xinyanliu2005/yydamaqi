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
