export async function collectAllPages<T>(
  fetchPage: (offset: number, limit: number) => Promise<T[]>,
  pageSize = 1000,
): Promise<T[]> {
  const normalizedPageSize = Math.max(1, Math.floor(pageSize));
  const all: T[] = [];
  let offset = 0;

  while (true) {
    const page = await fetchPage(offset, normalizedPageSize);
    if (!page.length) break;

    all.push(...page);
    if (page.length < normalizedPageSize) break;

    offset += page.length;
  }

  return all;
}
