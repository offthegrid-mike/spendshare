import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TugBar from './TugBar';
import { computeSummary } from '../../lib/settlement';
import { makeGroup } from '../../test/fixtures';

const pair = makeGroup('g1', 'Home');
const trio = makeGroup('g2', 'Flat', ['Mike', 'Priya', 'Sam']);

function segments(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-segment]')).map((el) => ({
    uid: el.dataset.segment,
    width: el.style.width,
  }));
}

describe('TugBar', () => {
  it('sizes one segment per payer by shared spending, viewer first', () => {
    const s = computeSummary(pair.memberUids, [
      { amount: 6883, shared: true, payerUid: 'priya' },
      { amount: 24542, shared: true, payerUid: 'mike' },
    ], []);
    const { container } = render(<TugBar summary={s} viewerUid="mike" group={pair} />);
    const segs = segments(container);
    expect(segs.map((x) => x.uid)).toEqual(['mike', 'priya']);
    expect(parseFloat(segs[0].width)).toBeCloseTo(78.1, 1);
    expect(screen.getByRole('img', { name: /shared spending by payer/i })).toBeInTheDocument();
  });

  it('labels a two-person bar with who paid what and the even split', () => {
    const s = computeSummary(pair.memberUids, [
      { amount: 24542, shared: true, payerUid: 'mike' },
      { amount: 6883, shared: true, payerUid: 'priya' },
    ], []);
    render(<TugBar summary={s} viewerUid="mike" group={pair} />);
    expect(screen.getByText('You paid')).toBeInTheDocument();
    expect(screen.getByText('245.42')).toBeInTheDocument();
    expect(screen.getByText('even split')).toBeInTheDocument();
    expect(screen.getByText('Priya paid')).toBeInTheDocument();
    expect(screen.getByText('68.83')).toBeInTheDocument();
  });

  it('puts a tick at every even-split boundary', () => {
    const s = computeSummary(trio.memberUids, [{ amount: 900, shared: true, payerUid: 'sam' }], []);
    const { container } = render(<TugBar summary={s} viewerUid="mike" group={trio} />);
    const ticks = Array.from(container.querySelectorAll<HTMLElement>('[data-tick]')).map((t) => t.style.left);
    expect(ticks.map(parseFloat).map((n) => Math.round(n * 10) / 10)).toEqual([33.3, 66.7]);
  });

  it('shows a legend for three or more people', () => {
    const s = computeSummary(trio.memberUids, [{ amount: 900, shared: true, payerUid: 'sam' }], []);
    render(<TugBar summary={s} viewerUid="mike" group={trio} />);
    expect(screen.getByText('Sam')).toBeInTheDocument();
    expect(screen.getByText('9.00')).toBeInTheDocument();
  });

  it('renders nothing when nothing was shared', () => {
    const s = computeSummary(pair.memberUids, [{ amount: 500, shared: false, payerUid: 'mike' }], []);
    const { container } = render(<TugBar summary={s} viewerUid="mike" group={pair} />);
    expect(container).toBeEmptyDOMElement();
  });
});
