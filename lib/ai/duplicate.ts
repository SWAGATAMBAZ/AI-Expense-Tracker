import type { SupabaseClient } from "@supabase/supabase-js";

export interface DuplicateCandidate {
  amountPaise: number;
  date: string;
  type: string;
  merchant: string | null;
}

export interface DuplicateMatch {
  id: string;
  merchant: string | null;
  amount: number;
  transaction_date: string;
}

/**
 * PRD §17 duplicate detection for chat/AI-originated transactions only.
 * Exact-match on date+amount+type (chat entries are always "now", unlike
 * SMS timing fuzziness which is Phase 7's problem), plus a case-insensitive
 * merchant match when the candidate has a merchant.
 */
export async function findDuplicateTransaction(
  supabase: SupabaseClient,
  userId: string,
  candidate: DuplicateCandidate
): Promise<DuplicateMatch | null> {
  const { data, error } = await supabase
    .from("transactions")
    .select("id, merchant, amount, transaction_date")
    .eq("user_id", userId)
    .eq("transaction_date", candidate.date)
    .eq("amount", candidate.amountPaise)
    .eq("type", candidate.type);

  if (error) {
    console.error("[findDuplicateTransaction] supabase error:", error.message);
    return null;
  }
  if (!data || data.length === 0) return null;

  if (!candidate.merchant) {
    return data[0] as DuplicateMatch;
  }

  const merchantLower = candidate.merchant.trim().toLowerCase();
  const match = (data as DuplicateMatch[]).find(
    (row) => (row.merchant ?? "").trim().toLowerCase() === merchantLower
  );
  return match ?? null;
}
