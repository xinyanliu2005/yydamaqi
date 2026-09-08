/* ===================== Supabase 房间存储 ===================== */
/* 取代之前的 Firebase（对中国大陆用户不可达）和 CloudBase（免费额度到期后收费）。
   Supabase 底层是 Postgres，浏览器 SDK 可以直接做"带条件的 UPDATE"，所以不需要
   像 CloudBase 那样另外部署一个云函数——mutator 直接在浏览器里跑，用一个
   version 字段做乐观锁（compare-and-swap）：写回时带上"我读到的 version"作为
   WHERE 条件，数据库只有在 version 还没被别人改过时才会真的更新；如果没更新到
   任何一行，说明有人抢先一步，重新读最新状态、重算、再试一次。
   这跟最早 Claude db 能力的 acquire+重试锁、后来 Firestore 的事务，本质上是同一
   件事的三种不同实现方式。

   Supabase 的浏览器 SDK 是通过 <script> 标签挂到全局变量 window.supabase 上的
   （见 index.html，文件本地放在 src/vendor/ 下——jsdelivr/unpkg 这类第三方 CDN
   在中国大陆经常被 DNS 污染，所以直接把 SDK 文件提交进仓库、跟着 Netlify 一起
   发布，不依赖任何第三方 CDN）。 */

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

var client = null;
function getClient(){
  if(!client){
    if(!window.supabase){
      throw new Error('Supabase SDK 未加载，请检查 index.html 里的 <script> 标签');
    }
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return client;
}

/* 把数据库返回的行包成和之前 Firebase/CloudBase 版本一样的形状（{exists, data()}），
   这样 app.js 里读快照的代码不用大改。 */
function wrapRow(row){
  return { exists: !!row, data: function(){ return row ? row.data : undefined; } };
}

export function getGame(code){
  return getClient().from('games').select('data').eq('code', code).maybeSingle().then(function(res){
    if(res.error) throw res.error;
    return wrapRow(res.data);
  });
}

export function subscribeGame(code, onNext, onError){
  var channel = getClient()
    .channel('game-'+code)
    .on('postgres_changes', { event:'*', schema:'public', table:'games', filter:'code=eq.'+code },
      function(payload){
        if(payload.eventType==='DELETE' || !payload.new || !payload.new.code){
          onNext({ exists:false, data:function(){ return undefined; } });
        } else {
          onNext(wrapRow(payload.new));
        }
      })
    .subscribe();

  /* Realtime 只推送"订阅之后发生的变化"，不会在刚订阅时把当前状态推一次，
     所以这里手动补一次初始读取。 */
  getGame(code).then(function(snap){ onNext(snap); }).catch(onError);

  return function unsubscribe(){ channel.unsubscribe(); };
}

/* 乐观锁重试的核心：读最新 version -> 跑 mutator -> 带 version 条件写回，
   没写成功（version 已被别人改过）就重读重试，最多 5 次。 */
export function runGameTransaction(code, mutatorFn){
  var client = getClient();
  function attempt(retriesLeft){
    return client.from('games').select('data,version').eq('code',code).maybeSingle().then(function(readRes){
      if(readRes.error){ return { ok:false, error:'读取房间失败：'+readRes.error.message }; }
      if(!readRes.data){ return { ok:false, error:'房间不存在或已被删除' }; }
      var row = readRes.data;
      var data = JSON.parse(JSON.stringify(row.data));
      var result;
      try{ result = mutatorFn(data); }
      catch(e){ return { ok:false, error:'操作失败：'+(e && e.message ? e.message : e) }; }
      if(result.error){ return { ok:false, error:result.error }; }

      return client.from('games')
        .update({ data: result.data, version: row.version+1, updated_at: new Date().toISOString() })
        .eq('code', code)
        .eq('version', row.version)
        .select()
        .then(function(writeRes){
          if(writeRes.error){ return { ok:false, error:'写入失败：'+writeRes.error.message }; }
          if(!writeRes.data || writeRes.data.length===0){
            /* version 已经被别人改过，重新读最新状态再试一次 */
            if(retriesLeft>0) return attempt(retriesLeft-1);
            return { ok:false, error:'房间繁忙，请重试' };
          }
          return { ok:true };
        });
    });
  }
  return attempt(5).catch(function(e){
    return { ok:false, error:'网络异常，请重试：'+(e && e.message ? e.message : e) };
  });
}

export function createRoom(code, initialData){
  return getClient().from('games').insert({ code:code, data:initialData, version:1 }).select().then(function(res){
    if(res.error) return { ok:false, error:'创建房间失败：'+res.error.message };
    return { ok:true };
  }).catch(function(e){
    return { ok:false, error:'创建房间失败，请重试：'+(e && e.message ? e.message : e) };
  });
}
