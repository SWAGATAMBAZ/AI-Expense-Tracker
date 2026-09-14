import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChatPanel } from "./ChatPanel";

export default async function AiAssistantPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="flex flex-1 flex-col gap-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">AI assistant</h1>

      <ChatPanel />

      <Link href="/home" className="text-sm font-medium text-[var(--color-text-secondary)]">
        &larr; Back home
      </Link>
    </main>
  );
}
