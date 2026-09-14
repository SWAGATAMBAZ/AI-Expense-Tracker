"use client";

import { useActionState } from "react";
import { updateProfile, type ProfileActionState } from "@/app/actions/profile";
import { CURRENCY_ALLOWLIST } from "@/lib/profile/validation";
import { SubmitButton } from "@/app/components/SubmitButton";

const initialState: ProfileActionState = {};

export function ProfileForm({
  defaultFullName,
  defaultSalaryRupees,
  defaultSalaryDay,
  defaultCurrency,
  defaultBankInfo,
}: {
  defaultFullName: string;
  defaultSalaryRupees?: number;
  defaultSalaryDay?: number;
  defaultCurrency: string;
  defaultBankInfo: string;
}) {
  const [state, formAction] = useActionState(updateProfile, initialState);
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="card flex flex-col gap-4">
      <div>
        <label htmlFor="fullName" className="label-text">
          Name
        </label>
        <input
          id="fullName"
          name="fullName"
          type="text"
          autoComplete="name"
          required
          maxLength={100}
          defaultValue={defaultFullName}
          className="input-field"
        />
        {fieldErrors.fullName ? <p className="error-text mt-1">{fieldErrors.fullName}</p> : null}
      </div>

      <div>
        <label htmlFor="salary" className="label-text">
          Monthly salary
        </label>
        <input
          id="salary"
          name="salary"
          type="text"
          inputMode="decimal"
          required
          defaultValue={defaultSalaryRupees ?? ""}
          className="input-field"
        />
        {fieldErrors.salary ? <p className="error-text mt-1">{fieldErrors.salary}</p> : null}
      </div>

      <div>
        <label htmlFor="salaryDay" className="label-text">
          Salary day of month
        </label>
        <input
          id="salaryDay"
          name="salaryDay"
          type="number"
          min={1}
          max={31}
          required
          defaultValue={defaultSalaryDay ?? ""}
          className="input-field"
        />
        {fieldErrors.salaryDay ? (
          <p className="error-text mt-1">{fieldErrors.salaryDay}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="currency" className="label-text">
          Preferred currency
        </label>
        <select
          id="currency"
          name="currency"
          required
          defaultValue={defaultCurrency}
          className="input-field"
        >
          {CURRENCY_ALLOWLIST.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
        {fieldErrors.currency ? (
          <p className="error-text mt-1">{fieldErrors.currency}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="bankInfo" className="label-text">
          Bank/payment info <span className="text-[var(--color-text-muted)]">(optional)</span>
        </label>
        <textarea
          id="bankInfo"
          name="bankInfo"
          rows={2}
          defaultValue={defaultBankInfo}
          className="input-field"
        />
        {fieldErrors.bankInfo ? (
          <p className="error-text mt-1">{fieldErrors.bankInfo}</p>
        ) : null}
      </div>

      {state.error ? <p className="error-text">{state.error}</p> : null}
      {state.success ? <p className="success-text">Saved.</p> : null}

      <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
    </form>
  );
}
