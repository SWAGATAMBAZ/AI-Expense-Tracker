import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/auth";
import { ProfileForm } from "./ProfileForm";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, currency, monthly_salary, salary_day, bank_info")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <main className="flex flex-1 flex-col gap-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Your profile</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{user.email}</p>
      </div>

      <ProfileForm
        defaultFullName={profile?.full_name ?? (user.user_metadata?.full_name as string | undefined) ?? ""}
        defaultSalaryRupees={
          profile?.monthly_salary != null ? profile.monthly_salary / 100 : undefined
        }
        defaultSalaryDay={profile?.salary_day ?? undefined}
        defaultCurrency={profile?.currency ?? "INR"}
        defaultBankInfo={profile?.bank_info ?? ""}
      />

      <form action={signOut}>
        <button type="submit" className="btn-secondary">
          Sign out
        </button>
      </form>
    </main>
  );
}
