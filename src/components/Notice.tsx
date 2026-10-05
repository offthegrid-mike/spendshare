import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { useUIStore } from '../stores/uiStore';

const NOTICE_MS = 5000;

/** The single transient notice (group created, invite accepted). Dismisses itself after 5 s. */
export default function Notice() {
  const notice = useUIStore((s) => s.notice);
  const clearNotice = useUIStore((s) => s.clearNotice);
  const noticeId = notice?.id;

  useEffect(() => {
    if (noticeId === undefined) return;
    const timer = setTimeout(clearNotice, NOTICE_MS);
    return () => clearTimeout(timer);
  }, [noticeId, clearNotice]);

  // The live region is always mounted so screen readers announce new messages.
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-3.5 bottom-24 z-30 flex justify-center lg:inset-x-auto lg:bottom-auto lg:right-6 lg:top-[72px]"
    >
      {notice && (
        <div className="pointer-events-auto flex items-center gap-3 rounded-[12px] border border-line bg-surface py-2 pl-3.5 pr-1.5 text-sm text-ink shadow-pop motion-safe:animate-fade-in">
          <span>{notice.message}</span>
          {notice.action && (
            <Link to={notice.action.to} onClick={clearNotice} className="font-semibold text-accent-ink hover:underline">
              {notice.action.label}
            </Link>
          )}
          <button
            type="button"
            aria-label="Dismiss"
            onClick={clearNotice}
            className="grid h-7 w-7 place-items-center rounded-lg text-ink-muted hover:bg-recessed hover:text-ink"
          >
            <X size={14} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
