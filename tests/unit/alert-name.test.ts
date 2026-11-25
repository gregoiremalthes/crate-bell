import { describe, expect, it } from 'vitest';
import { buildAlertName, makeUnique } from '@/lib/alert-name';

describe('buildAlertName', () => {
  it('reads like "Artist - Title"', () => {
    expect(buildAlertName(['Seiji'], 'Seiji5')).toBe('Seiji - Seiji5');
    expect(buildAlertName(['Steffi', 'Virginia'], 'Patterns Of Vibration')).toBe(
      'Steffi, Virginia - Patterns Of Vibration',
    );
    expect(buildAlertName([], 'Untitled')).toBe('Untitled');
    expect(buildAlertName([], '')).toBe('Sale alert');
  });

  it('keeps the suffix and stays within 100 characters', () => {
    const name = buildAlertName(['A'.repeat(80)], 'B'.repeat(80), '(any Vinyl pressing)');
    expect(name.length).toBeLessThanOrEqual(100);
    expect(name.endsWith(' (any Vinyl pressing)')).toBe(true);
    expect(name).toContain('…');
  });
});

describe('makeUnique', () => {
  it('adds a number when the name is taken, ignoring case', () => {
    expect(makeUnique('Seiji - Seiji5', ['Other'])).toBe('Seiji - Seiji5');
    expect(makeUnique('Seiji - Seiji5', ['seiji - seiji5'])).toBe('Seiji - Seiji5 (2)');
    expect(makeUnique('X', ['X', 'X (2)'])).toBe('X (3)');
  });

  it('never goes over 100 characters', () => {
    const long = 'L'.repeat(100);
    expect(makeUnique(long, [long]).length).toBe(100);
  });
});
