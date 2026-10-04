interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  /** Accessible name of the group. */
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  className?: string;
}

export default function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  size = 'md',
  className = '',
}: Props<T>) {
  return (
    <div role="group" aria-label={label} className={`flex rounded-full bg-recessed p-[3px] ${className}`}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`flex-1 rounded-full font-medium transition-colors ${
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm'
            } ${active ? 'bg-surface text-ink ring-1 ring-line' : 'text-ink-muted hover:text-ink'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
