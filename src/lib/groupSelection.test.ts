import { describe, it, expect } from 'vitest';
import { resolveSelection } from './groupSelection';

const g = (...ids: string[]) => ids.map((id) => ({ id }));

describe('resolveSelection', () => {
  it('keeps a valid selection', () => {
    expect(resolveSelection(g('a', 'b'), 'b', null)).toEqual({ select: null, clearPending: false });
  });

  it('falls back to the first group when the selection is unknown', () => {
    expect(resolveSelection(g('a', 'b'), 'gone', null)).toEqual({ select: 'a', clearPending: false });
  });

  it('falls back to the first group when nothing is selected', () => {
    expect(resolveSelection(g('a'), null, null)).toEqual({ select: 'a', clearPending: false });
  });

  it('does nothing with no groups', () => {
    expect(resolveSelection([], null, null)).toEqual({ select: null, clearPending: false });
  });

  it('waits for a pending group without bouncing a valid selection', () => {
    expect(resolveSelection(g('a'), 'a', 'joined')).toEqual({ select: null, clearPending: false });
  });

  it('selects the pending group once it appears', () => {
    expect(resolveSelection(g('a', 'joined'), 'a', 'joined')).toEqual({ select: 'joined', clearPending: true });
  });

  it('still repairs an unknown selection while waiting', () => {
    expect(resolveSelection(g('a'), 'gone', 'joined')).toEqual({ select: 'a', clearPending: false });
  });
});
