import { RefreshCw } from 'lucide-react';
import { applyUpdate, dismissUpdate, usePwaStore } from '../lib/pwa';

/** Tells the user a new version has downloaded and lets them reload into it. Shown on every screen. */
export default function UpdateBanner() {
  const needRefresh = usePwaStore((s) => s.needRefresh);

  // The live region is always mounted so screen readers announce the update.
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-3.5 top-3 z-50 flex justify-center lg:inset-x-auto lg:left-1/2 lg:-translate-x-1/2"
    >
      {needRefresh && (
        <div className="pointer-events-auto flex items-center gap-3 rounded-[12px] border border-line bg-surface py-2 pl-3.5 pr-2 text-sm text-ink shadow-pop motion-safe:animate-fade-in">
          <RefreshCw size={16} strokeWidth={1.75} className="shrink-0 text-accent-ink" aria-hidden="true" />
          <span>A new version of HomeBase is ready.</span>
          <button
            type="button"
            onClick={() => void applyUpdate()}
            className="rounded-lg px-2 py-1 font-semibold text-accent-ink hover:bg-recessed"
          >
            Reload
          </button>
          <button
            type="button"
            onClick={dismissUpdate}
            className="rounded-lg px-2 py-1 text-ink-muted hover:bg-recessed hover:text-ink"
          >
            Later
          </button>
        </div>
      )}
    </div>
  );
}
