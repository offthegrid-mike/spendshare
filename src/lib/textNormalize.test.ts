import { describe, it, expect } from 'vitest';
import { isDotsOnly } from './textNormalize';

describe('isDotsOnly', () => {
  it('is true for text of nothing but dots, which a path would read as a folder', () => {
    expect(isDotsOnly('.')).toBe(true);
    expect(isDotsOnly('..')).toBe(true);
    expect(isDotsOnly('...')).toBe(true);
  });

  it('is false for anything else, including nothing at all', () => {
    expect(isDotsOnly('')).toBe(false);
    expect(isDotsOnly('.a')).toBe(false);
    expect(isDotsOnly('a.')).toBe(false);
    expect(isDotsOnly(' . ')).toBe(false);
  });
});
