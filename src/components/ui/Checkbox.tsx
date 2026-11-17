import type { ComponentProps, ReactNode } from 'react';
import { Check } from 'lucide-react';

type Props = Omit<ComponentProps<'input'>, 'type' | 'className' | 'children'> & {
  children: ReactNode;
  className?: string;
};

/**
 * A themed checkbox. The real `<input>` stays in the DOM (visually hidden) so
 * the role, label, focus and keyboard behaviour are all native; only the box
 * is drawn here, because the browser's own looks different on every platform.
 */
export default function Checkbox({ children, className = '', ...input }: Props) {
  return (
    <label className={`inline-flex cursor-pointer items-center gap-2.5 text-sm text-ink ${className}`}>
      <input type="checkbox" className="peer sr-only" {...input} />
      <span
        aria-hidden="true"
        className="grid h-5 w-5 shrink-0 place-items-center rounded-md border border-ink-faint/60 bg-surface text-on-accent transition peer-checked:border-accent peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40 peer-disabled:opacity-50 [&>svg]:scale-50 [&>svg]:opacity-0 [&>svg]:transition peer-checked:[&>svg]:scale-100 peer-checked:[&>svg]:opacity-100"
      >
        <Check size={14} strokeWidth={3} />
      </span>
      {children}
    </label>
  );
}
