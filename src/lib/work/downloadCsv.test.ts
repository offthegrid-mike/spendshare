import { describe, it, expect, vi, afterEach } from 'vitest';
import { downloadCsv } from './downloadCsv';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('downloadCsv', () => {
  it('downloads the text through a temporary link and cleans up', () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn((blob: Blob) => (blob.type === 'text/csv;charset=utf-8' ? 'blob:x' : 'blob:wrong'));
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    const clicked: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this);
      expect(document.body.contains(this)).toBe(true);
    });

    downloadCsv('work-days-2026-27.csv', 'date\n');

    expect(clicked).toHaveLength(1);
    expect(clicked[0].download).toBe('work-days-2026-27.csv');
    expect(clicked[0].getAttribute('href')).toBe('blob:x');
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    // Revoked after the click has returned, so the browser can still read it.
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:x');
    expect(document.body.contains(clicked[0])).toBe(false);
    expect(document.querySelectorAll('a')).toHaveLength(0);
  });
});
