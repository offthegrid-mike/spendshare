import { ReceiptText } from 'lucide-react';
import Skeleton from './ui/Skeleton';

/** Placeholder for a route whose data is still loading: a title and two panels of rows. */
export function RouteSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="space-y-5">
      <Skeleton className="h-6 w-40" />
      {[0, 1].map((panel) => (
        <div key={panel} className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <div className="card divide-y divide-line">
            {[0, 1].map((row) => (
              <div key={row} className="flex items-center gap-3 px-3.5 py-3">
                <Skeleton className="h-[38px] w-[38px] rounded-[10px]" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-1/3" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
                <Skeleton className="h-4 w-14" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Full-screen placeholder while auth and groups bootstrap. */
export function AppSplash() {
  return (
    <main role="status" aria-label="Loading" className="grid min-h-screen place-items-center bg-canvas">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-accent text-on-accent motion-safe:animate-pulse">
        <ReceiptText size={28} strokeWidth={1.75} aria-hidden="true" />
      </span>
    </main>
  );
}
