// Helper to fetch ALL rows from a Supabase table, bypassing the default 1000-row limit.
// Usage: const data = await fetchAllRows((from, to) => supabase.from('x').select('*').range(from, to));

const PAGE_SIZE = 1000;

export async function fetchAllRows<T = any>(
  buildQuery: (from: number, to: number) => any
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  // Hard safety cap to avoid runaway loops
  const MAX_PAGES = 200;
  for (let page = 0; page < MAX_PAGES; page++) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await buildQuery(from, to);
    if (error) throw error;
    const batch = (data || []) as T[];
    all.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}