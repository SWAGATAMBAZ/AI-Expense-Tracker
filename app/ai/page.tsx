import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  loadChatSessions,
  loadSessionMessages,
  getOrCreateFirstChatSessionId,
  createChatSession,
} from "@/app/actions/ai";
import { computeInsight, INSIGHT_KEYS, type InsightKey } from "@/lib/ai/insights";
import { ChatPanel } from "./ChatPanel";
import { SessionsDrawer } from "./SessionsDrawer";

function isInsightKey(value: string): value is InsightKey {
  return (INSIGHT_KEYS as readonly string[]).includes(value);
}

export default async function AiAssistantPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Inbox card entry point: create a fresh session seeded with that insight
  // (product ask: clicking a card "open[s] a new chat ... to discuss
  // further"), then redirect to its canonical /ai?session=<id> URL - so a
  // refresh or re-share of the resulting link never creates a second,
  // duplicate session.
  const insightParam = typeof params.insight === "string" ? params.insight : null;
  if (params.new === "1" && insightParam && isInsightKey(insightParam)) {
    const insight = await computeInsight(supabase, user.id, insightParam);
    const newSessionId = await createChatSession(
      insight?.title ?? "New chat",
      insight ? `${insight.message} Want help acting on this, or have other questions?` : undefined
    );
    if (newSessionId) redirect(`/ai?session=${newSessionId}`);
  }

  const [sessions, firstChatSessionId] = await Promise.all([
    loadChatSessions(),
    getOrCreateFirstChatSessionId(),
  ]);

  const requestedSessionId = typeof params.session === "string" ? params.session : null;
  // Demo simplification (product ask): with no session explicitly
  // requested, always default back to "First chat" rather than remembering
  // whichever session was last viewed.
  const activeSessionId =
    requestedSessionId && sessions.some((session) => session.id === requestedSessionId)
      ? requestedSessionId
      : firstChatSessionId;

  const history = activeSessionId ? await loadSessionMessages(activeSessionId) : [];

  return (
    // min-h-0 so this can actually shrink inside PageShell's bounded,
    // non-scrolling h-dvh container for this route (see PageShell.tsx) -
    // ChatPanel's own message list is the only thing that scrolls.
    <main className="flex min-h-0 flex-1 flex-col">
      {/* shrink-0: stays put while only ChatPanel's message list beneath it
          scrolls, which is what makes this read as "fixed at the top"
          without needing position:sticky - the page itself never scrolls. */}
      <div className="flex shrink-0 items-center justify-between pb-3">
        <h1 className="text-xl font-semibold tracking-tight">AI assistant</h1>
        <SessionsDrawer sessions={sessions} activeSessionId={activeSessionId} />
      </div>

      {/* "Back home" is docked in ChatPanel's own fixed input row - see
          ChatPanel.tsx for why a separate link here can't sit safely above
          the bottom nav without one covering the other. key={activeSessionId}
          forces a clean remount (fresh internal state) whenever the active
          session changes, instead of reusing the previous session's stale
          in-memory messages. */}
      <ChatPanel key={activeSessionId} initialMessages={history} sessionId={activeSessionId} />
    </main>
  );
}
