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
 * PRD §17 duplicate detection, shared by manual entry and AI chat.
 * Exact-match on date+amount+type (SMS timing fuzziness is Phase 7's
 * problem, still deferred), plus a case-insensitive merchant match when
 * the candidate has a merchant.
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
    // No merchant to disambiguate on - date+amount+type alone is too weak a
    // signal to auto-flag as a duplicate (PRD §18: an unconfident match must
    // not be auto-assumed), since two distinct merchant-less transactions
    // (e.g. two cash purchases) can easily share it. Only treat it as a
    // duplicate when there's exactly one other merchant-less row to compare
    // against; multiple candidates are ambiguous, not confirmatory.
    const merchantless = (data as DuplicateMatch[]).filter((row) => !row.merchant);
    return merchantless.length === 1 ? merchantless[0] : null;
  }

  const merchantLower = candidate.merchant.trim().toLowerCase();
  const match = (data as DuplicateMatch[]).find(
    (row) => (row.merchant ?? "").trim().toLowerCase() === merchantLower
  );
  return match ?? null;
}
