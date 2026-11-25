import { describe, it, expect } from 'vitest';
import { backTarget } from './travelNav';

describe('backTarget', () => {
  it('goes Home from the trip list, to the list from a trip, and to the trip from its settings', () => {
    expect(backTarget('/travel')).toEqual({ to: '/', label: 'Home' });
    expect(backTarget('/travel/')).toEqual({ to: '/', label: 'Home' });
    expect(backTarget('/travel/new')).toEqual({ to: '/travel', label: 'Trips' });
    expect(backTarget('/travel/japan')).toEqual({ to: '/travel', label: 'Trips' });
    expect(backTarget('/travel/japan/settings')).toEqual({ to: '/travel/japan', label: 'Trip' });
  });
});
