import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const { tripData, settlements } = vi.hoisted(() => ({
  tripData: vi.fn(),
  settlements: vi.fn(),
}));
vi.mock('./useTripData', () => ({ useTripData: tripData }));
vi.mock('./useSettlements', () => ({ useSettlements: settlements }));

import { useTripRecords } from './useTripRecords';

const wallet = (id: string, handovers: unknown[] = []) => ({ wallet: { id }, handovers });
function data(over: Record<string, unknown> = {}) {
  return { expenses: [], topUps: [], wallets: [], cash: { wallets: [] }, loading: false, ...over };
}

beforeEach(() => {
  tripData.mockReset().mockReturnValue(data());
  settlements.mockReset().mockReturnValue({ settlements: [], loading: false });
});

describe('useTripRecords', () => {
  it('is undefined while the trip loads', () => {
    tripData.mockReturnValue(data({ loading: true }));
    expect(renderHook(() => useTripRecords('taiwan')).result.current).toBeUndefined();
    tripData.mockReturnValue(data());
    settlements.mockReturnValue({ settlements: [], loading: true });
    expect(renderHook(() => useTripRecords('taiwan')).result.current).toBeUndefined();
  });

  it('is empty with no expenses, cash or settle-ups, and lists the wallets left behind', () => {
    tripData.mockReturnValue(data({ wallets: [{ id: 'mike_AUD' }], cash: { wallets: [wallet('mike_AUD')] } }));
    expect(renderHook(() => useTripRecords('taiwan')).result.current).toEqual({ empty: true, walletIds: ['mike_AUD'] });
    expect(settlements).toHaveBeenCalledWith('taiwan', 'trip');
  });

  it('is not empty with an expense, cash, a hand-over or a settle-up', () => {
    for (const [d, s] of [
      [data({ expenses: [{ id: 'e1' }] }), []],
      [data({ topUps: [{ id: 't1' }] }), []],
      [data({ wallets: [{ id: 'a_JPY' }], cash: { wallets: [wallet('a_JPY', [{ id: 'h1' }])] } }), []],
      [data(), [{ id: 's1' }]],
    ] as const) {
      tripData.mockReturnValue(d);
      settlements.mockReturnValue({ settlements: s, loading: false });
      expect(renderHook(() => useTripRecords('taiwan')).result.current?.empty).toBe(false);
    }
  });
});
