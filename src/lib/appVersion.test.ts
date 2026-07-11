import { describe, it, expect } from 'vitest';
import { formatVersionLabel } from './appVersion';

describe('formatVersionLabel', () => {
  it('combines the commit and a yyyy-MM-dd build date', () => {
    expect(formatVersionLabel('a1b2c3d', '2026-07-11T03:04:05.000Z')).toBe(
      'a1b2c3d · built 2026-07-11',
    );
  });

  it('falls back to the raw string when builtAt is not a valid date', () => {
    expect(formatVersionLabel('a1b2c3d', 'unknown')).toBe('a1b2c3d · built unknown');
  });

  it('falls back to "dev" wording when commit is unset', () => {
    expect(formatVersionLabel('dev', '2026-07-11T03:04:05.000Z')).toBe(
      'dev build · 2026-07-11',
    );
  });
});
