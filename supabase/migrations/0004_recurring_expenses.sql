create table public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount integer not null check (amount > 0),
  frequency text not null check (frequency in ('weekly', 'monthly', 'yearly')),
  next_due_date date not null,
  category_id smallint references public.categories(id) on delete set null,
  payment_method text,
  account_info text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index recurring_expenses_user_id_active_next_due_date_idx
  on public.recurring_expenses (user_id, active, next_due_date);

alter table public.recurring_expenses enable row level security;

create policy "Users can view their own recurring expenses"
  on public.recurring_expenses for select
  using (user_id = auth.uid());

create policy "Users can insert their own recurring expenses"
  on public.recurring_expenses for insert
  with check (user_id = auth.uid());

create policy "Users can update their own recurring expenses"
  on public.recurring_expenses for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete their own recurring expenses"
  on public.recurring_expenses for delete
  using (user_id = auth.uid());
