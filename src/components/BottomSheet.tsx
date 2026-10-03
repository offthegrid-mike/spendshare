import { useEffect, useRef, type ReactNode } from 'react';
import { useVisualViewport } from '../hooks/useVisualViewport';

// The visible area shrinking by more than this means an on-screen keyboard
// (not just a collapsing browser toolbar) is covering the page.
const KEYBOARD_MIN_HEIGHT = 150;

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export default function BottomSheet({ open, onClose, title, children }: Props) {
  const startYRef = useRef<number | null>(null);
  const viewport = useVisualViewport();

  useEffect(() => {
    if (!open || window.innerWidth >= 640) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  const keyboardOpen = viewport !== null && window.innerHeight - viewport.height > KEYBOARD_MIN_HEIGHT;

  function handleTouchStart(e: React.TouchEvent) {
    startYRef.current = e.touches[0].clientY;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (startYRef.current === null) return;
    const delta = e.changedTouches[0].clientY - startYRef.current;
    if (delta > 60) onClose();
    startYRef.current = null;
  }

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
        className={`group/sheet absolute bottom-0 left-0 right-0 ${keyboardOpen ? 'max-h-full' : 'max-h-[85%]'} overflow-y-auto overscroll-contain rounded-t-2xl bg-white`}
        data-keyboard={keyboardOpen ? 'open' : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
      >
        <div className="flex justify-center pt-3 pb-1">
          <div
            className="h-1 w-10 rounded-full bg-slate-300"
            data-testid="sheet-handle"
            aria-hidden="true"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          />
        </div>
        <div className="px-4 pb-8">
          <h2 id="sheet-title" className="mb-4 text-lg font-bold text-slate-900">{title}</h2>
          {children}
        </div>
      </div>
    </div>
  );
}
