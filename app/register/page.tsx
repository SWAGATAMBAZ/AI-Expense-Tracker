"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUp, type AuthActionState } from "@/app/actions/auth";
import { SubmitButton } from "@/app/components/SubmitButton";

const initialState: AuthActionState = {};

export default function RegisterPage() {
  const [state, formAction] = useActionState(signUp, initialState);

  return (
    <main className="flex flex-1 flex-col justify-center gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Start tracking your expenses with AI assistance.
        </p>
      </div>

      <form action={formAction} className="card flex flex-col gap-4">
        <div>
          <label htmlFor="email" className="label-text">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="input-field"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="label-text">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            className="input-field"
            placeholder="At least 6 characters"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="label-text">
            Confirm password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            className="input-field"
          />
        </div>

        {state.error ? <p className="error-text">{state.error}</p> : null}

        <SubmitButton pendingLabel="Creating account…">Create account</SubmitButton>
      </form>

      <p className="text-center text-sm text-[var(--color-text-secondary)]">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-[var(--color-primary)]">
          Log in
        </Link>
      </p>
    </main>
  );
}
