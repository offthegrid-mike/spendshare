import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import DaySheet from './DaySheet';

const { desktop } = vi.hoisted(() => ({ desktop: { value: false } }));
vi.mock('../../hooks/useMediaQuery', () => ({ useIsDesktop: () => desktop.value }));

function sheetFor(date: string | null, onClose: () => void) {
  return (
    <DaySheet date={date} onClose={onClose}>
      <p>Editor goes here</p>
    </DaySheet>
  );
}

function renderSheet(date: string | null = '2026-10-15') {
  const onClose = vi.fn();
  const view = render(sheetFor(date, onClose));
  return { onClose, ...view, showDate: (next: string | null) => view.rerender(sheetFor(next, onClose)) };
}

// jsdom has no scrollIntoView of its own.
const scrollIntoView = vi.fn();
const ownScrollIntoView = Element.prototype.scrollIntoView;

beforeEach(() => {
  desktop.value = false;
  scrollIntoView.mockReset();
  Element.prototype.scrollIntoView = scrollIntoView;
});

afterEach(() => {
  Element.prototype.scrollIntoView = ownScrollIntoView;
});

describe('DaySheet', () => {
  it('renders nothing without a date', () => {
    const { container } = renderSheet(null);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing without a date on desktop', () => {
    desktop.value = true;
    const { container } = renderSheet(null);
    expect(container).toBeEmptyDOMElement();
  });

  describe('on a phone', () => {
    it('shows the children in a bottom sheet titled with the day', () => {
      renderSheet();
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveTextContent('Thu 15 Oct');
      expect(screen.getByRole('heading', { name: 'Thu 15 Oct' })).toBeInTheDocument();
      expect(screen.getByText('Editor goes here')).toBeInTheDocument();
    });

    it('calls onClose when the backdrop is clicked', () => {
      const { onClose } = renderSheet();
      fireEvent.click(screen.getByTestId('sheet-backdrop'));
      expect(onClose).toHaveBeenCalledOnce();
    });

    it('has no inline Close button', () => {
      renderSheet();
      expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
    });

    it('scrolls nothing into view, the sheet being in view already', () => {
      const { showDate } = renderSheet();
      showDate('2026-10-16');
      expect(scrollIntoView).not.toHaveBeenCalled();
    });
  });

  describe('on desktop', () => {
    beforeEach(() => {
      desktop.value = true;
    });

    it('shows the title and the children inline, with no bottom sheet', () => {
      renderSheet();
      expect(screen.getByRole('heading', { name: 'Thu 15 Oct' })).toBeInTheDocument();
      expect(screen.getByText('Editor goes here')).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.queryByTestId('sheet-backdrop')).toBeNull();
    });

    it('is a card', () => {
      renderSheet();
      const region = screen.getByRole('region', { name: 'Thu 15 Oct' });
      expect(region).toHaveClass('card');
      expect(region).toContainElement(screen.getByText('Editor goes here'));
    });

    it('calls onClose from the Close button', () => {
      const { onClose } = renderSheet();
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      expect(onClose).toHaveBeenCalledOnce();
    });

    // The card sits below the calendar, often below the fold: without this a
    // click on a banner chip or a top-row day would look like it did nothing.
    it('scrolls the card into view and moves focus to its heading', () => {
      renderSheet();
      const region = screen.getByRole('region', { name: 'Thu 15 Oct' });
      expect(scrollIntoView).toHaveBeenCalledOnce();
      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
      expect(scrollIntoView.mock.contexts[0]).toBe(region);
      expect(screen.getByRole('heading', { name: 'Thu 15 Oct' })).toHaveFocus();
    });

    it('does it again for each date shown', () => {
      const { showDate } = renderSheet();
      showDate('2026-10-16');
      expect(scrollIntoView).toHaveBeenCalledTimes(2);
      expect(screen.getByRole('heading', { name: 'Fri 16 Oct' })).toHaveFocus();
    });

    it('leaves the scroll and focus alone when the date stays the same', () => {
      const { showDate } = renderSheet();
      screen.getByRole('button', { name: 'Close' }).focus();
      showDate('2026-10-15');
      expect(scrollIntoView).toHaveBeenCalledOnce();
      expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    });
  });
});
