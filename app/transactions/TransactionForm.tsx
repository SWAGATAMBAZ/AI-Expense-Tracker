"use client";

import { useActionState } from "react";
import type { TransactionActionState } from "@/app/actions/transactions";
import { TRANSACTION_TYPES } from "@/lib/transactions/validation";
import { SubmitButton } from "@/app/components/SubmitButton";
import type { Category } from "@/lib/transactions/categories";

const initialState: TransactionActionState = {};

const TYPE_LABELS: Record<(typeof TRANSACTION_TYPES)[number], string> = {
  expense: "Expense",
  income: "Income",
  refund: "Refund",
  transfer: "Transfer",
};

export interface TransactionFormDefaultValues {
  merchant?: string;
  amountRupees?: number;
  categoryId?: number;
  date?: string;
  paymentMethod?: string;
  accountInfo?: string;
  type?: string;
  notes?: string;
}

export function TransactionForm({
  action,
  categories,
  defaultValues,
  submitLabel,
  pendingLabel,
}: {
  action: (prevState: TransactionActionState, formData: FormData) => Promise<TransactionActionState>;
  categories: Category[];
  defaultValues?: TransactionFormDefaultValues;
  submitLabel: string;
  pendingLabel: string;
}) {
  const [state, formAction] = useActionState(action, initialState);
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="card flex flex-col gap-4">
      <div>
        <label htmlFor="merchant" className="label-text">
          Merchant <span className="text-[var(--color-text-muted)]">(optional)</span>
        </label>
        <input
          id="merchant"
          name="merchant"
          type="text"
          defaultValue={defaultValues?.merchant ?? ""}
          className="input-field"
        />
        {fieldErrors.merchant ? <p className="error-text mt-1">{fieldErrors.merchant}</p> : null}
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
        <label htmlFor="categoryId" className="label-text">
          Category
        </label>
        <select
          id="categoryId"
          name="categoryId"
          required
          defaultValue={defaultValues?.categoryId ?? ""}
          className="input-field"
        >
          <option value="" disabled>
            Select a category
          </option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        {fieldErrors.categoryId ? <p className="error-text mt-1">{fieldErrors.categoryId}</p> : null}
      </div>

      <div>
        <label htmlFor="date" className="label-text">
          Date
        </label>
        <input
          id="date"
          name="date"
          type="date"
          required
          defaultValue={defaultValues?.date ?? ""}
          className="input-field"
        />
        {fieldErrors.date ? <p className="error-text mt-1">{fieldErrors.date}</p> : null}
      </div>

      <div>
        <label htmlFor="paymentMethod" className="label-text">
          Payment method <span className="text-[var(--color-text-muted)]">(optional)</span>
        </label>
        <input
          id="paymentMethod"
          name="paymentMethod"
          type="text"
          placeholder="e.g. Cash, UPI, Credit Card"
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
          placeholder="e.g. HDFC XXXX1234"
          defaultValue={defaultValues?.accountInfo ?? ""}
          className="input-field"
        />
        {fieldErrors.accountInfo ? (
          <p className="error-text mt-1">{fieldErrors.accountInfo}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="type" className="label-text">
          Transaction type
        </label>
        <select
          id="type"
          name="type"
          required
          defaultValue={defaultValues?.type ?? "expense"}
          className="input-field"
        >
          {TRANSACTION_TYPES.map((type) => (
            <option key={type} value={type}>
              {TYPE_LABELS[type]}
            </option>
          ))}
        </select>
        {fieldErrors.type ? <p className="error-text mt-1">{fieldErrors.type}</p> : null}
      </div>

      <div>
        <label htmlFor="notes" className="label-text">
          Notes <span className="text-[var(--color-text-muted)]">(optional)</span>
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          defaultValue={defaultValues?.notes ?? ""}
          className="input-field"
        />
        {fieldErrors.notes ? <p className="error-text mt-1">{fieldErrors.notes}</p> : null}
      </div>

      {state.error ? <p className="error-text">{state.error}</p> : null}

      <SubmitButton pendingLabel={pendingLabel}>{submitLabel}</SubmitButton>
    </form>
  );
}
