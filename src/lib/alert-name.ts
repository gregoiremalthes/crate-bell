import { MAX_ALERT_NAME_LENGTH } from './discogs/constants';

/** "Seiji - Seiji5", or "Daft Punk - Homework (any vinyl pressing)" for a master. */
export function buildAlertName(artists: string[], title: string, suffix = ''): string {
  const artist = artists.join(', ').trim();
  const base = [artist, title.trim()].filter(Boolean).join(' - ') || 'Sale alert';
  const tail = suffix ? ` ${suffix}` : '';
  const room = MAX_ALERT_NAME_LENGTH - tail.length;
  const trimmed = base.length > room ? `${base.slice(0, Math.max(1, room - 1)).trimEnd()}…` : base;
  return `${trimmed}${tail}`;
}

/** Discogs refuses two alerts with the same name: add " (2)", " (3)"… when needed. */
export function makeUnique(name: string, existing: string[]): string {
  const taken = new Set(existing.map((n) => n.trim().toLowerCase()));
  if (!taken.has(name.toLowerCase())) return name;
  for (let i = 2; i < 1000; i++) {
    const suffix = ` (${i})`;
    const base =
      name.length + suffix.length > MAX_ALERT_NAME_LENGTH ? name.slice(0, MAX_ALERT_NAME_LENGTH - suffix.length) : name;
    const candidate = `${base}${suffix}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return name;
}
