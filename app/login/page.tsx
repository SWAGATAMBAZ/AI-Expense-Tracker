"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn, type AuthActionState } from "@/app/actions/auth";
import { SubmitButton } from "@/app/components/SubmitButton";

const initialState: AuthActionState = {};

export default function LoginPage() {
  const [state, formAction] = useActionState(signIn, initialState);

  return (
    <main className="flex flex-1 flex-col justify-center gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Log in to see your expenses.
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
            autoComplete="current-password"
            required
            className="input-field"
          />
        </div>

        {state.error ? <p className="error-text">{state.error}</p> : null}

        <SubmitButton pendingLabel="Signing in…">Log in</SubmitButton>
      </form>

      <p className="text-center text-sm text-[var(--color-text-secondary)]">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-medium text-[var(--color-primary)]">
          Register
        </Link>
      </p>
    </main>
  );
}
