import type { ReactNode } from 'react';

export default function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-line px-[7px] py-px text-[11px] font-medium text-ink-muted">
      {children}
    </span>
  );
}
