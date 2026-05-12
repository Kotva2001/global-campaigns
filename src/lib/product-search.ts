import { supabase } from "@/integrations/supabase/client";
import type { ProductRecord } from "@/types/product";

/**
 * Diacritics- and case-insensitive product search backed by the
 * `search_products` Postgres function (uses the `unaccent` extension).
 *
 * Multi-word queries are joined with `%` wildcards so all words must
 * appear in order somewhere in name / sku / category, e.g.
 * "bederni kap" -> matches "Bederní kapsa".
 */
export const searchProducts = async (
  query: string,
  maxResults = 20,
): Promise<ProductRecord[]> => {
  const q = query.trim();
  if (!q) return [];
  const term = q.split(/\s+/).filter(Boolean).join("%");
  const { data, error } = await supabase.rpc("search_products", {
    search_term: term,
    max_results: maxResults,
  });
  if (error) {
    console.error("search_products RPC failed", error);
    return [];
  }
  return (data ?? []) as ProductRecord[];
};