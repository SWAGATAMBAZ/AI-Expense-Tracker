import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadChatHistory } from "@/app/actions/ai";
import { ChatPanel } from "./ChatPanel";

export default async function AiAssistantPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const history = await loadChatHistory();

  return (
    <main className="flex flex-1 flex-col gap-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">AI assistant</h1>

      {/* "Back home" is docked in ChatPanel's own fixed input row - see
          ChatPanel.tsx for why a separate link here can't sit safely above
          the bottom nav without one covering the other. */}
      <ChatPanel initialMessages={history} />
    </main>
  );
}
