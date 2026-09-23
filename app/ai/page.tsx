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
    // min-h-0 so this can actually shrink inside PageShell's bounded,
    // non-scrolling h-dvh container for this route (see PageShell.tsx) -
    // ChatPanel's own message list is the only thing that scrolls.
    <main className="flex min-h-0 flex-1 flex-col">
      {/* shrink-0: stays put while only ChatPanel's message list beneath it
          scrolls, which is what makes this read as "fixed at the top"
          without needing position:sticky - the page itself never scrolls. */}
      <h1 className="shrink-0 pb-3 text-xl font-semibold tracking-tight">AI assistant</h1>

      {/* "Back home" is docked in ChatPanel's own fixed input row - see
          ChatPanel.tsx for why a separate link here can't sit safely above
          the bottom nav without one covering the other. */}
      <ChatPanel initialMessages={history} />
    </main>
  );
}
