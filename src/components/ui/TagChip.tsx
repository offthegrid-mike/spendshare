import type { ReactNode } from 'react';

/** The look of a tag: shared by plain tags, linked tags and removable ones. */
export const TAG_CHIP_CLASS =
  'inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-px text-[11px] font-medium text-accent-ink';

export default function TagChip({ children }: { children: ReactNode }) {
  return <span className={TAG_CHIP_CLASS}>{children}</span>;
}
