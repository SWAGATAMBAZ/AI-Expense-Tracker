create table public.categories (
  id smallint primary key generated always as identity,
  name text not null unique,
  sort_order smallint not null
);

alter table public.categories enable row level security;

create policy "Any authenticated user can read categories"
  on public.categories for select
  to authenticated
  using (true);

insert into public.categories (name, sort_order) values
  ('Food & Dining', 1),
  ('Groceries', 2),
  ('Shopping', 3),
  ('Transportation', 4),
  ('Fuel', 5),
  ('Travel', 6),
  ('Entertainment', 7),
  ('Bills & Utilities', 8),
  ('Rent', 9),
  ('EMI / Loans', 10),
  ('Healthcare', 11),
  ('Education', 12),
  ('Fitness & Gym', 13),
  ('Subscriptions', 14),
  ('Insurance', 15),
  ('Personal Care', 16),
  ('Investments', 17),
  ('Household', 18),
  ('Gifts', 19),
  ('Taxes', 20),
  ('Fees & Charges', 21),
  ('Other', 22);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  merchant text,
  amount integer not null check (amount > 0),
  currency text not null default 'INR',
  category_id smallint references public.categories(id) on delete set null,
  transaction_date date not null,
  payment_method text,
  account_info text,
  type text not null check (type in ('expense', 'income', 'refund', 'transfer')),
  notes text,
  source text not null default 'manual' check (source in ('manual', 'llm', 'sms')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index transactions_user_id_transaction_date_idx
  on public.transactions (user_id, transaction_date desc);

alter table public.transactions enable row level security;

create policy "Users can view their own transactions"
  on public.transactions for select
  using (user_id = auth.uid());

create policy "Users can insert their own transactions"
  on public.transactions for insert
  with check (user_id = auth.uid());

create policy "Users can update their own transactions"
  on public.transactions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete their own transactions"
  on public.transactions for delete
  using (user_id = auth.uid());
