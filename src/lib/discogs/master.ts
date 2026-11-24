/** Versions of a master release, as returned by api.discogs.com/masters/{id}/versions. */
export interface MasterVersion {
  id: number;
  title?: string;
  country?: string;
  released?: string;
  major_formats?: string[];
}

export interface FormatGroup {
  format: string;
  count: number;
}

/** Formats present in the versions, most common first. */
export function groupByFormat(versions: MasterVersion[]): FormatGroup[] {
  const counts = new Map<string, number>();
  for (const v of versions) {
    for (const format of new Set(v.major_formats ?? [])) {
      counts.set(format, (counts.get(format) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([format, count]) => ({ format, count }))
    .sort((a, b) => b.count - a.count || a.format.localeCompare(b.format));
}

/** Default choice: vinyl if the album exists on vinyl (this is a record collectors' tool). */
export function defaultFormats(groups: FormatGroup[]): string[] {
  if (groups.some((g) => g.format === 'Vinyl')) return ['Vinyl'];
  return groups.map((g) => g.format);
}

const yearOf = (v: MasterVersion): number => {
  const year = Number.parseInt(v.released ?? '', 10);
  return Number.isFinite(year) ? year : 9999;
};

/** Release ids of the versions in the chosen formats, oldest first. */
export function selectVersionIds(versions: MasterVersion[], formats: string[]): number[] {
  const wanted = new Set(formats);
  return versions
    .filter((v) => (v.major_formats ?? []).some((f) => wanted.has(f)))
    .sort((a, b) => yearOf(a) - yearOf(b) || a.id - b.id)
    .map((v) => v.id);
}

interface VersionsPage {
  pagination?: { pages?: number };
  versions?: MasterVersion[];
}

/**
 * Fetches every version of a master from the public Discogs API (no login, no token).
 * Stops at `maxPages` pages of 100 to stay polite with the API's rate limit.
 */
export async function fetchMasterVersions(
  masterId: number,
  fetchImpl: typeof fetch = fetch,
  maxPages = 5,
): Promise<MasterVersion[]> {
  const all: MasterVersion[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const url = `https://api.discogs.com/masters/${masterId}/versions?per_page=100&page=${page}`;
    const response = await fetchImpl(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) {
      if (all.length) break;
      throw new Error(`Discogs API answered ${response.status}`);
    }
    const data = (await response.json()) as VersionsPage;
    for (const v of data.versions ?? []) {
      all.push({
        id: v.id,
        title: v.title,
        country: v.country,
        released: v.released,
        major_formats: v.major_formats,
      });
    }
    if (page >= (data.pagination?.pages ?? 1)) break;
  }
  return all;
}
