-- 在 Supabase 控制台的 SQL Editor 里跑一次这个文件（或整段粘贴执行）即可。
--
-- 表结构很简单：每个房间一行，房间的全部状态（玩家、手牌、棋盘位置……）打包
-- 成一个 jsonb 字段存起来，跟之前 Firebase/CloudBase 版本"一个房间一份 JSON
-- 文档"的模型是一样的。version 字段用来做乐观锁（compare-and-swap）：写回时
-- 带上"读到的 version" 作为 WHERE 条件，数据库只有在没人抢先修改过的情况下
-- 才会真的写入，避免两个玩家同时操作互相覆盖（见 src/supabase-db.js）。

create table if not exists games (
  code text primary key,
  data jsonb not null,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);

-- 这个游戏没有账号系统，房间号本身就是访问凭证（知道/猜到房间号就能读写那个
-- 房间），所以这里对匿名角色完全放开读写——真正的"隔离"靠房间号本身的随机性。
-- 别把敏感信息塞进房间数据里。
alter table games enable row level security;

create policy "anyone can read games" on games
  for select using (true);

create policy "anyone can create games" on games
  for insert with check (true);

create policy "anyone can update games" on games
  for update using (true);

create policy "anyone can delete games" on games
  for delete using (true);

-- 打开这张表的实时推送，浏览器才能通过 postgres_changes 监听到别的玩家的操作。
alter publication supabase_realtime add table games;
