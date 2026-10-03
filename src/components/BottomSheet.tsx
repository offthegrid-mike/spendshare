import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useVisualViewport } from '../hooks/useVisualViewport';

// The visible area shrinking by more than this means an on-screen keyboard
// (not just a collapsing browser toolbar) is covering the page.
const KEYBOARD_MIN_HEIGHT = 150;

// Dragging the header down further than this dismisses the sheet.
const DISMISS_DRAG_DISTANCE = 80;

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export default function BottomSheet({ open, onClose, title, children }: Props) {
  const startYRef = useRef<number | null>(null);
  // How far the sheet is dragged down; null when no drag is in progress.
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const viewport = useVisualViewport();

  useEffect(() => {
    if (!open || window.innerWidth >= 640) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  const keyboardOpen = viewport !== null && window.innerHeight - viewport.height > KEYBOARD_MIN_HEIGHT;

  function handlePointerDown(e: React.PointerEvent) {
    startYRef.current = e.clientY;
    setDragOffset(0);
    // Keep receiving moves when the finger or mouse leaves the header strip.
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (startYRef.current === null) return;
    setDragOffset(Math.max(0, e.clientY - startYRef.current));
  }

  function endDrag(dismiss: boolean) {
    startYRef.current = null;
    setDragOffset(null);
    if (dismiss) onClose();
  }

  const dragging = dragOffset !== null;

  return (
    <div
      className="fixed inset-0 z-40 sm:hidden"
      // Track the visible area so the sheet stays above the on-screen keyboard.
      style={viewport ? { top: viewport.offsetTop, height: viewport.height, bottom: 'auto' } : undefined}
    >
      <div
        className="absolute inset-0 bg-black/40"
        data-testid="sheet-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`group/sheet absolute bottom-0 left-0 right-0 ${keyboardOpen ? 'max-h-full' : 'max-h-[85%]'} overflow-y-auto overscroll-contain rounded-t-2xl bg-white ${dragging ? '' : 'transition-transform duration-200'}`}
        style={dragging ? { transform: `translateY(${dragOffset}px)` } : undefined}
        data-keyboard={keyboardOpen ? 'open' : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
      >
        <div
          className="cursor-grab select-none px-4 active:cursor-grabbing"
          style={{ touchAction: 'none' }}
          data-testid="sheet-drag-zone"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={e => {
            if (startYRef.current !== null) endDrag(e.clientY - startYRef.current > DISMISS_DRAG_DISTANCE);
          }}
          onPointerCancel={() => endDrag(false)}
        >
          <div className="flex justify-center pt-3 pb-1">
            <div
              className="h-1 w-10 rounded-full bg-slate-300"
              data-testid="sheet-handle"
              aria-hidden="true"
            />
          </div>
          <h2 id="sheet-title" className="pb-4 text-lg font-bold text-slate-900">{title}</h2>
        </div>
        <div className="px-4 pb-8">
          {children}
        </div>
      </div>
    </div>
  );
}
