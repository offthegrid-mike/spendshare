import { NavLink } from 'react-router-dom';

export interface SectionPill {
  to: string;
  label: string;
  end?: boolean;
}

interface Props {
  sections: SectionPill[];
  label?: string;
}

/** Pill-style section switcher for the desktop top bar. */
export default function SectionPills({ sections, label = 'Sections' }: Props) {
  return (
    <nav aria-label={label} className="flex rounded-full bg-recessed p-[3px]">
      {sections.map(({ to, label: text, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              isActive ? 'bg-surface text-ink ring-1 ring-line' : 'text-ink-muted hover:text-ink'
            }`
          }
        >
          {text}
        </NavLink>
      ))}
    </nav>
  );
}
