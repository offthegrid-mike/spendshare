import { Download, Share } from 'lucide-react';
import { isIos, promptInstall, usePwaStore } from '../lib/pwa';

/**
 * Install HomeBase as an app: a button where the browser can show its install
 * prompt (Chrome, Edge, Android), Add to Home Screen steps on iPhone and iPad,
 * and nothing once installed or where the browser cannot install.
 */
export default function InstallApp() {
  const canPrompt = usePwaStore((s) => s.installPrompt !== null);
  const installed = usePwaStore((s) => s.installed);

  if (installed) return null;
  if (!canPrompt && !isIos()) return null;

  return (
    <section>
      <h2 className="mb-2 px-1 text-sm font-medium text-ink-muted">App</h2>
      {canPrompt ? (
        <button
          type="button"
          onClick={() => void promptInstall()}
          className="card flex min-h-[44px] w-full items-center gap-3 px-4 transition hover:bg-recessed"
        >
          <Download size={18} className="shrink-0 text-accent-ink" aria-hidden="true" />
          <span className="flex-1 text-left text-sm font-medium text-ink">Install HomeBase</span>
        </button>
      ) : (
        <div className="card flex items-start gap-3 px-4 py-3">
          <Share size={18} className="mt-0.5 shrink-0 text-accent-ink" aria-hidden="true" />
          <p className="text-sm text-ink">
            To install HomeBase, open it in Safari, tap <span className="font-medium">Share</span>, then{' '}
            <span className="font-medium">Add to Home Screen</span>.
          </p>
        </div>
      )}
    </section>
  );
}
