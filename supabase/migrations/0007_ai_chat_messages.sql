-- Persists the AI chat transcript per user (product ask: "maintain chat
-- history" across page loads/sessions, not just in-memory React state).
create table public.ai_chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  href text,
  created_at timestamptz not null default now()
);

create index ai_chat_messages_user_id_created_at_idx
  on public.ai_chat_messages (user_id, created_at);

alter table public.ai_chat_messages enable row level security;

create policy "Users can view their own chat messages"
  on public.ai_chat_messages for select
  using (user_id = auth.uid());

create policy "Users can insert their own chat messages"
  on public.ai_chat_messages for insert
  with check (user_id = auth.uid());

create policy "Users can delete their own chat messages"
  on public.ai_chat_messages for delete
  using (user_id = auth.uid());
