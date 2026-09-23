-- Multiple named chat "sessions" per user (product ask: a drawer of old
-- chat sessions on the AI assistant page, plus a fresh session seeded from
-- an Inbox insight card) instead of one single ever-growing transcript.
create table public.ai_chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Sorts the drawer by most recently active session first.
create index ai_chat_sessions_user_id_updated_at_idx
  on public.ai_chat_sessions (user_id, updated_at desc);

alter table public.ai_chat_sessions enable row level security;

create policy "Users can view their own chat sessions"
  on public.ai_chat_sessions for select
  using (user_id = auth.uid());

create policy "Users can insert their own chat sessions"
  on public.ai_chat_sessions for insert
  with check (user_id = auth.uid());

create policy "Users can update their own chat sessions"
  on public.ai_chat_sessions for update
  using (user_id = auth.uid());

create policy "Users can delete their own chat sessions"
  on public.ai_chat_sessions for delete
  using (user_id = auth.uid());

-- Attach every message to a session. Existing rows predate sessions, so:
-- backfill one "First chat" session per user who already has messages
-- (product ask: "name the current chat history 'First chat'"), point their
-- messages at it, then make the column required going forward.
alter table public.ai_chat_messages
  add column session_id uuid references public.ai_chat_sessions(id) on delete cascade;

insert into public.ai_chat_sessions (user_id, title, created_at, updated_at)
select user_id, 'First chat', min(created_at), max(created_at)
from public.ai_chat_messages
where session_id is null
group by user_id;

update public.ai_chat_messages m
set session_id = s.id
from public.ai_chat_sessions s
where m.session_id is null
  and s.user_id = m.user_id
  and s.title = 'First chat';

alter table public.ai_chat_messages
  alter column session_id set not null;

create index ai_chat_messages_session_id_created_at_idx
  on public.ai_chat_messages (session_id, created_at);
