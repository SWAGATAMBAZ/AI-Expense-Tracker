alter table public.transactions
  add column matched_recurring_expense_id uuid
    references public.recurring_expenses(id) on delete set null;
