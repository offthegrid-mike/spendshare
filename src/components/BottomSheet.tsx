import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export default function BottomSheet({ open, onClose, title, children }: Props) {
  const startYRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open || window.innerWidth >= 640) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

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
    <div className="fixed inset-0 z-40 sm:hidden">
      <div
        className="absolute inset-0 bg-black/40"
        data-testid="sheet-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="absolute bottom-0 left-0 right-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-white"
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
