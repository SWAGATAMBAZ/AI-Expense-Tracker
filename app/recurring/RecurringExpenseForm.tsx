"use client";

import { useActionState } from "react";
import type { RecurringExpenseActionState } from "@/app/actions/recurring";
import { RECURRING_FREQUENCIES } from "@/lib/recurring/validation";
import { SubmitButton } from "@/app/components/SubmitButton";
import type { Category } from "@/lib/transactions/categories";

const initialState: RecurringExpenseActionState = {};

const FREQUENCY_LABELS: Record<(typeof RECURRING_FREQUENCIES)[number], string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

export interface RecurringExpenseFormDefaultValues {
  name?: string;
  amountRupees?: number;
  frequency?: string;
  nextDueDate?: string;
  categoryId?: number;
  paymentMethod?: string;
  accountInfo?: string;
  active?: boolean;
}

export function RecurringExpenseForm({
  action,
  categories,
  defaultValues,
  submitLabel,
  pendingLabel,
  mode,
}: {
  action: (
    prevState: RecurringExpenseActionState,
    formData: FormData
  ) => Promise<RecurringExpenseActionState>;
  categories: Category[];
  defaultValues?: RecurringExpenseFormDefaultValues;
  submitLabel: string;
  pendingLabel: string;
  mode: "create" | "edit";
}) {
  const [state, formAction] = useActionState(action, initialState);
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="card flex flex-col gap-4">
      <div>
        <label htmlFor="name" className="label-text">
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          placeholder="e.g. Rent, Netflix"
          defaultValue={defaultValues?.name ?? ""}
          className="input-field"
        />
        {fieldErrors.name ? <p className="error-text mt-1">{fieldErrors.name}</p> : null}
      </div>

      <div>
        <label htmlFor="amount" className="label-text">
          Amount
        </label>
        <input
          id="amount"
          name="amount"
          type="text"
          inputMode="decimal"
          required
          defaultValue={defaultValues?.amountRupees ?? ""}
          className="input-field"
        />
        {fieldErrors.amount ? <p className="error-text mt-1">{fieldErrors.amount}</p> : null}
      </div>

      <div>
        <label htmlFor="frequency" className="label-text">
          Frequency
        </label>
        <select
          id="frequency"
          name="frequency"
          required
          defaultValue={defaultValues?.frequency ?? "monthly"}
          className="input-field"
        >
          {RECURRING_FREQUENCIES.map((frequency) => (
            <option key={frequency} value={frequency}>
              {FREQUENCY_LABELS[frequency]}
            </option>
          ))}
        </select>
        {fieldErrors.frequency ? <p className="error-text mt-1">{fieldErrors.frequency}</p> : null}
      </div>

      <div>
        <label htmlFor="nextDueDate" className="label-text">
          Next due date
        </label>
        <input
          id="nextDueDate"
          name="nextDueDate"
          type="date"
          required
          defaultValue={defaultValues?.nextDueDate ?? ""}
          className="input-field"
        />
        {fieldErrors.nextDueDate ? (
          <p className="error-text mt-1">{fieldErrors.nextDueDate}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="categoryId" className="label-text">
          Category <span className="text-[var(--color-text-muted)]">(optional)</span>
        </label>
        <select
          id="categoryId"
          name="categoryId"
          defaultValue={defaultValues?.categoryId ?? ""}
          className="input-field"
        >
          <option value="">No category</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        {fieldErrors.categoryId ? (
          <p className="error-text mt-1">{fieldErrors.categoryId}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="paymentMethod" className="label-text">
          Payment method <span className="text-[var(--color-text-muted)]">(optional)</span>
        </label>
        <input
          id="paymentMethod"
          name="paymentMethod"
          type="text"
          placeholder="e.g. Bank Transfer, Credit Card"
          defaultValue={defaultValues?.paymentMethod ?? ""}
          className="input-field"
        />
        {fieldErrors.paymentMethod ? (
          <p className="error-text mt-1">{fieldErrors.paymentMethod}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="accountInfo" className="label-text">
          Account/card <span className="text-[var(--color-text-muted)]">(optional)</span>
        </label>
        <input
          id="accountInfo"
          name="accountInfo"
          type="text"
          defaultValue={defaultValues?.accountInfo ?? ""}
          className="input-field"
        />
        {fieldErrors.accountInfo ? (
          <p className="error-text mt-1">{fieldErrors.accountInfo}</p>
        ) : null}
      </div>

      {mode === "edit" ? (
        <div className="flex items-center gap-2">
          <input
            id="active"
            name="active"
            type="checkbox"
            defaultChecked={defaultValues?.active ?? true}
            className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
          />
          <label htmlFor="active" className="text-sm text-[var(--color-text-secondary)]">
            Active
          </label>
        </div>
      ) : null}

      {state.error ? <p className="error-text">{state.error}</p> : null}

      <SubmitButton pendingLabel={pendingLabel}>{submitLabel}</SubmitButton>
    </form>
  );
}
