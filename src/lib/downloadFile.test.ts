import { describe, it, expect, vi, afterEach } from 'vitest';
import { downloadFile } from './downloadFile';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('downloadFile', () => {
  it('saves the text with the given type through a temporary link, and cleans up', () => {
    vi.useFakeTimers();
    const types: string[] = [];
    const createObjectURL = vi.fn((blob: Blob) => {
      types.push(blob.type);
      return 'blob:x';
    });
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    const clicked: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this);
      expect(document.body.contains(this)).toBe(true);
    });

    downloadFile('spendshare-backup.json', '{}', 'application/json');

    expect(types).toEqual(['application/json']);
    expect(clicked).toHaveLength(1);
    expect(clicked[0].download).toBe('spendshare-backup.json');
    expect(clicked[0].getAttribute('href')).toBe('blob:x');
    // Revoked after the click has returned, so the browser can still read it.
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:x');
    expect(document.querySelectorAll('a')).toHaveLength(0);
  });
});
