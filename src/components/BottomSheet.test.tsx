import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import BottomSheet from './BottomSheet';

function renderSheet(open = true, onClose = vi.fn()) {
  return { onClose, ...render(
    <BottomSheet open={open} onClose={onClose} title="Add Expense">
      <p>Sheet content</p>
    </BottomSheet>
  )};
}

describe('BottomSheet', () => {
  it('renders title and children when open', () => {
    renderSheet(true);
    expect(screen.getByText('Add Expense')).toBeTruthy();
    expect(screen.getByText('Sheet content')).toBeTruthy();
  });

  it('renders nothing when closed', () => {
    renderSheet(false);
    expect(screen.queryByText('Sheet content')).toBeNull();
    expect(screen.queryByText('Add Expense')).toBeNull();
  });

  it('calls onClose when backdrop is clicked', () => {
    const { onClose } = renderSheet(true, vi.fn());
    const backdrop = document.querySelector('[data-testid="sheet-backdrop"]')!;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders a drag handle', () => {
    renderSheet(true);
    expect(document.querySelector('[data-testid="sheet-handle"]')).toBeTruthy();
  });
});

// Android Chrome's on-screen keyboard shrinks only the visual viewport, so a
// sheet sized against the layout viewport ends up partly behind the keyboard.
describe('BottomSheet with an on-screen keyboard', () => {
  class FakeVisualViewport extends EventTarget {
    height = 854;
    offsetTop = 0;
  }
  let vv: FakeVisualViewport;

  beforeEach(() => {
    vv = new FakeVisualViewport();
    vi.stubGlobal('visualViewport', vv);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function overlay() {
    return screen.getByRole('dialog').parentElement!;
  }

  it('pins the overlay to the visual viewport', () => {
    renderSheet(true);
    expect(overlay().style.top).toBe('0px');
    expect(overlay().style.height).toBe('854px');
  });

  it('shrinks to the space above the keyboard when it opens', () => {
    renderSheet(true);
    act(() => {
      vv.height = 445;
      vv.offsetTop = 120;
      vv.dispatchEvent(new Event('resize'));
    });
    expect(overlay().style.top).toBe('120px');
    expect(overlay().style.height).toBe('445px');
  });

  it('follows the visual viewport when the browser pans it', () => {
    renderSheet(true);
    act(() => {
      vv.offsetTop = 60;
      vv.dispatchEvent(new Event('scroll'));
    });
    expect(overlay().style.top).toBe('60px');
  });

  it('flags the keyboard as open and fills the space above it', () => {
    renderSheet(true);
    const sheet = screen.getByRole('dialog');
    expect(sheet.dataset.keyboard).toBeUndefined();

    act(() => {
      vv.height = window.innerHeight - 300;
      vv.dispatchEvent(new Event('resize'));
    });
    expect(sheet.dataset.keyboard).toBe('open');
    expect(sheet.className).toContain('max-h-full');
    expect(sheet.className).not.toContain('max-h-[85%]');
  });

  it('caps the sheet height relative to the overlay, not the layout viewport', () => {
    renderSheet(true);
    const sheet = screen.getByRole('dialog');
    expect(sheet.className).toContain('max-h-[85%]');
    expect(sheet.className).not.toContain('dvh');
  });
});
