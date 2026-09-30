import { items } from '@wix/data';

type QueryBuilder = ReturnType<typeof items.query>;

export type DashboardQueryRefiner = (
  query: QueryBuilder,
) => QueryBuilder;

export async function loadAllDashboardItems<T>(
  collectionId: string,
  refine?: DashboardQueryRefiner,
  pageSize = 500,
): Promise<T[]> {
  const normalizedPageSize = Math.min(
    1000,
    Math.max(1, Math.floor(pageSize)),
  );

  let query = items.query(collectionId);
  if (refine) query = refine(query);

  let result = await query
    .limit(normalizedPageSize)
    .find();

  const all = [...(result.items || [])] as T[];

  while (result.hasNext()) {
    result = await result.next();
    all.push(...((result.items || []) as T[]));
  }

  return all;
}
