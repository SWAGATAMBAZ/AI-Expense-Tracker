import type { SupabaseClient } from "@supabase/supabase-js";

export interface Category {
  id: number;
  name: string;
}

/** Fetches the fixed, DB-seeded category list, ordered for <select> rendering. */
export async function getCategories(supabase: SupabaseClient): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[getCategories] failed to load categories:", error);
    return [];
  }
  return data ?? [];
}
