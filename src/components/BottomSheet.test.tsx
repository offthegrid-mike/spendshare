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

// The pill itself is only 4px tall, so the whole header strip is the grab
// target. Pointer events cover touch as well as a mouse in a narrow window.
describe('BottomSheet drag to dismiss', () => {
  function dragZone() {
    return screen.getByTestId('sheet-drag-zone');
  }

  function drag(from: number, to: number) {
    const zone = dragZone();
    fireEvent.pointerDown(zone, { pointerId: 1, clientY: from });
    fireEvent.pointerMove(zone, { pointerId: 1, clientY: to });
  }

  it('wraps the handle and title in a drag zone the browser will not scroll', () => {
    renderSheet(true);
    const zone = dragZone();
    expect(zone.contains(screen.getByTestId('sheet-handle'))).toBe(true);
    expect(zone.contains(screen.getByText('Add Expense'))).toBe(true);
    expect(zone.style.touchAction).toBe('none');
  });

  it('moves the sheet with the pointer while dragging down', () => {
    renderSheet(true);
    drag(100, 150);
    expect(screen.getByRole('dialog').style.transform).toBe('translateY(50px)');
  });

  it('does not move the sheet above its resting position', () => {
    renderSheet(true);
    drag(100, 40);
    expect(screen.getByRole('dialog').style.transform).toBe('translateY(0px)');
  });

  it('closes when released past the threshold', () => {
    const { onClose } = renderSheet(true);
    drag(100, 220);
    fireEvent.pointerUp(dragZone(), { pointerId: 1, clientY: 220 });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('snaps back when released short of the threshold', () => {
    const { onClose } = renderSheet(true);
    drag(100, 130);
    fireEvent.pointerUp(dragZone(), { pointerId: 1, clientY: 130 });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog').style.transform).toBe('');
  });

  it('snaps back when the pointer is cancelled', () => {
    const { onClose } = renderSheet(true);
    drag(100, 220);
    fireEvent.pointerCancel(dragZone(), { pointerId: 1 });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog').style.transform).toBe('');
  });

  it('opens at rest again after being dragged closed', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <BottomSheet open onClose={onClose} title="Add Expense"><p>x</p></BottomSheet>
    );
    drag(100, 220);
    fireEvent.pointerUp(dragZone(), { pointerId: 1, clientY: 220 });
    rerender(<BottomSheet open={false} onClose={onClose} title="Add Expense"><p>x</p></BottomSheet>);
    rerender(<BottomSheet open onClose={onClose} title="Add Expense"><p>x</p></BottomSheet>);
    expect(screen.getByRole('dialog').style.transform).toBe('');
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
