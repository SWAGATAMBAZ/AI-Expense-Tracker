-- Tracks a "bill paid" marker per card per calendar month (PRD-adjacent:
-- Credit Cards tab). Deliberately separate from `transactions` - paying a
-- card bill doesn't change historical spend, so it must never feed into
-- computeTotalSpend/computeCategoryBreakdown/computePaymentMethodMix.
create table public.credit_card_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_name text not null,
  -- 'YYYY-MM', matching the calendar month the bill covers.
  period_month text not null check (period_month ~ '^\d{4}-\d{2}$'),
  amount_paid integer not null check (amount_paid > 0),
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, card_name, period_month)
);

create index credit_card_payments_user_id_period_month_idx
  on public.credit_card_payments (user_id, period_month);

alter table public.credit_card_payments enable row level security;

create policy "Users can view their own credit card payments"
  on public.credit_card_payments for select
  using (user_id = auth.uid());

create policy "Users can insert their own credit card payments"
  on public.credit_card_payments for insert
  with check (user_id = auth.uid());

create policy "Users can update their own credit card payments"
  on public.credit_card_payments for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete their own credit card payments"
  on public.credit_card_payments for delete
  using (user_id = auth.uid());
