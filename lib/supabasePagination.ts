export const POSTGREST_PAGE_SIZE = 1000;
export const IN_FILTER_BATCH_SIZE = 100;

export interface SupabaseListResponse<T> {
  data: T[] | null;
  error: any;
}

/**
 * Fetches every row from a Supabase/PostgREST query by paging in deterministic
 * 1,000-row windows, preventing silent truncation at PostgREST's default 1,000-row cap.
 *
 * Callers MUST pass a factory that creates a fresh query builder with a deterministic
 * `.order(...)` (e.g. `.order('created_at', { ascending: false }).order('id', { ascending: true })`)
 * before `.range(from, to)`, because PostgREST query builders mutate internal state on execution
 * and unstable sort order can skip/duplicate rows across page boundaries.
 */
export async function fetchAllPages<T = any>(
  fetchPage: (from: number, to: number) => PromiseLike<SupabaseListResponse<T>>,
  pageSize: number = POSTGREST_PAGE_SIZE
): Promise<T[]> {
  const safePageSize = Math.max(1, Math.min(pageSize, POSTGREST_PAGE_SIZE));
  const allRows: T[] = [];
  let from = 0;

  while (true) {
    const to = from + safePageSize - 1;
    const { data, error } = await fetchPage(from, to);
    if (error) throw error;
    if (!data || data.length === 0) break;

    allRows.push(...data);
    if (data.length < safePageSize) break;
    from += safePageSize;
  }

  return allRows;
}

/**
 * Splits a large `.in(...)` filter list into safe URL-length batches (default 100 IDs)
 * so queries never fail with 414 URI Too Long or truncate at PostgREST's 1,000-row limit.
 */
export async function fetchInBatches<T = any, K = string>(
  ids: K[],
  fetchBatch: (batch: K[]) => PromiseLike<SupabaseListResponse<T>>,
  batchSize: number = IN_FILTER_BATCH_SIZE
): Promise<T[]> {
  if (!ids || ids.length === 0) return [];
  const safeBatchSize = Math.max(1, Math.min(batchSize, IN_FILTER_BATCH_SIZE));
  const uniqueIds = Array.from(new Set(ids));
  const results: T[] = [];

  for (let i = 0; i < uniqueIds.length; i += safeBatchSize) {
    const batch = uniqueIds.slice(i, i + safeBatchSize);
    const { data, error } = await fetchBatch(batch);
    if (error) throw error;
    if (data && data.length > 0) {
      results.push(...data);
    }
  }

  return results;
}
