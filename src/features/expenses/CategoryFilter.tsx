interface Props {
  /** The categories to offer, in display order. */
  categories: string[];
  /** The chosen category, or null for All. */
  selected: string | null;
  onSelect: (category: string | null) => void;
}

const CHIP = 'h-8 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors';

/** A row of chips that narrows the month's expenses to one category. */
export default function CategoryFilter({ categories, selected, onSelect }: Props) {
  // With one category there is nothing to narrow.
  if (categories.length < 2) return null;

  const chip = (label: string, value: string | null) => {
    const pressed = selected === value;
    return (
      <button
        key={label}
        type="button"
        aria-pressed={pressed}
        onClick={() => onSelect(value)}
        className={`${CHIP} ${
          pressed
            ? 'border-accent bg-accent text-on-accent'
            : 'border-line bg-surface text-ink-muted hover:text-ink'
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <div
      role="group"
      aria-label="Filter by category"
      // Swipe sideways on touch screens; wrap on desktop, where a mouse wheel
      // cannot scroll a row whose scrollbar is hidden.
      className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex-wrap lg:overflow-visible"
    >
      {chip('All', null)}
      {categories.map((c) => chip(c, c))}
    </div>
  );
}
