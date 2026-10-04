import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { initialOf } from '../../lib/initials';

interface Props {
  /** Category icon; without one the tile shows the label's first letter. */
  icon?: LucideIcon | null;
  label: string;
  selected?: boolean;
  size?: 'md' | 'lg';
  /** Overlay in the bottom-right corner, e.g. a payer badge. */
  badge?: ReactNode;
}

export default function CategoryTile({ icon: Icon, label, selected = false, size = 'md', badge }: Props) {
  const box = size === 'lg' ? 'h-11 w-11' : 'h-[38px] w-[38px]';
  return (
    <span
      className={`relative grid shrink-0 place-items-center rounded-[10px] bg-recessed ${box} ${
        selected ? 'text-accent-ink' : 'text-ink-muted'
      }`}
    >
      {Icon ? (
        <Icon size={size === 'lg' ? 20 : 18} strokeWidth={1.75} aria-hidden="true" />
      ) : (
        <span className="text-sm font-semibold" aria-hidden="true">{initialOf(label)}</span>
      )}
      {badge && <span className="absolute -bottom-[5px] -right-[5px]">{badge}</span>}
    </span>
  );
}
