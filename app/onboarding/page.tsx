"use client";

import { useActionState } from "react";
import { completeOnboarding } from "@/app/actions/profile";
import type { ProfileActionState } from "@/app/actions/profile";
import { CURRENCY_ALLOWLIST } from "@/lib/profile/validation";
import { SubmitButton } from "@/app/components/SubmitButton";

const initialState: ProfileActionState = {};

export default function OnboardingPage() {
  const [state, formAction] = useActionState(completeOnboarding, initialState);
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <main className="flex flex-1 flex-col justify-center gap-6 pb-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Let&apos;s set up your finances</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          A few numbers so we can forecast your spending and savings.
        </p>
      </div>

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
            className="input-field"
            placeholder="Your name"
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
            className="input-field"
            placeholder="e.g. 45000"
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
            className="input-field"
            placeholder="e.g. 1"
          />
          {fieldErrors.salaryDay ? (
            <p className="error-text mt-1">{fieldErrors.salaryDay}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="currency" className="label-text">
            Preferred currency
          </label>
          <select id="currency" name="currency" required className="input-field" defaultValue="INR">
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

        <div className="border-t border-[var(--color-border)] pt-4">
          <label htmlFor="bankInfo" className="label-text">
            Bank/payment info <span className="text-[var(--color-text-muted)]">(optional)</span>
          </label>
          <textarea
            id="bankInfo"
            name="bankInfo"
            rows={2}
            className="input-field"
            placeholder="e.g. HDFC Bank, card ending 1234"
          />
          {fieldErrors.bankInfo ? (
            <p className="error-text mt-1">{fieldErrors.bankInfo}</p>
          ) : null}
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">
            You can skip this and add recurring expenses (rent, EMI, subscriptions) anytime later.
          </p>
        </div>

        {state.error ? <p className="error-text">{state.error}</p> : null}

        <SubmitButton pendingLabel="Saving…">Continue</SubmitButton>
      </form>
    </main>
  );
}
