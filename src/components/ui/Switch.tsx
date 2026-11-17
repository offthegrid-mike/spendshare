import type { ComponentProps, ReactNode } from 'react';

type Props = Omit<ComponentProps<'input'>, 'type' | 'className' | 'children'> & {
  children: ReactNode;
  className?: string;
};

/** A checkbox drawn as an on/off switch. The input stays real, so role and keyboard are native. */
export default function Switch({ children, className = '', ...input }: Props) {
  return (
    <label className={`inline-flex cursor-pointer items-center gap-2 whitespace-nowrap text-sm text-ink ${className}`}>
      <input type="checkbox" className="peer sr-only" {...input} />
      <span
        aria-hidden="true"
        className="relative h-5 w-9 shrink-0 rounded-full bg-ink-faint/40 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-surface after:shadow-sm after:transition-transform peer-checked:bg-accent peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40 peer-disabled:opacity-50"
      />
      {children}
    </label>
  );
}
