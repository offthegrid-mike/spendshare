import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import BottomSheet from '../../components/BottomSheet';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import { dayLabel } from '../../lib/work/workFormat';

// Where a picked day is edited: a bottom sheet on a phone, a card in the page on
// desktop (BottomSheet is hidden from lg up). Nothing is shown without a date.

interface Props {
  /** The day to show, 'YYYY-MM-DD', or null for none. */
  date: string | null;
  onClose: () => void;
  children: ReactNode;
}

export default function DaySheet({ date, onClose, children }: Props) {
  const isDesktop = useIsDesktop();
  const headingId = useId();
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // On desktop the card sits below the calendar, often below the fold, so a
  // picked day would open out of sight. Bring each date's card into view and
  // move focus to its heading, so screen readers announce the day too.
  useEffect(() => {
    if (!isDesktop || date === null) return;
    sectionRef.current?.scrollIntoView?.({ block: 'nearest' });
    headingRef.current?.focus();
  }, [isDesktop, date]);

  if (date === null) return null;
  const title = dayLabel(date);

  if (!isDesktop) {
    return (
      <BottomSheet open onClose={onClose} title={title}>
        {children}
      </BottomSheet>
    );
  }

  return (
    <section ref={sectionRef} aria-labelledby={headingId} className="card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 ref={headingRef} id={headingId} tabIndex={-1} className="text-base font-semibold text-ink outline-none">
          {title}
        </h2>
        <button type="button" aria-label="Close" onClick={onClose} className="btn-ghost h-8 w-8 shrink-0 px-0">
          <X size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
      {children}
    </section>
  );
}
