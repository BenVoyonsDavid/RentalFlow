import { items } from '@wix/data';

export type DashboardQueryRefiner = (
  query: any,
) => any;

export async function loadAllDashboardItems<T>(
  collectionId: string,
  refine?: DashboardQueryRefiner,
  pageSize = 1000,
): Promise<T[]> {
  const normalizedPageSize = Math.min(
    1000,
    Math.max(1, Math.floor(pageSize)),
  );

  let query: any = items.query(collectionId);
  if (refine) query = refine(query);

  let result: any = await query
    .limit(normalizedPageSize)
    .find();

  const all = [...(result.items || [])] as T[];

  while (result.hasNext()) {
    result = await result.next();
    all.push(...((result.items || []) as T[]));
  }

  return all;
}
