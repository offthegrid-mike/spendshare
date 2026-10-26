import { Link } from 'react-router-dom';
import { Tag, Tags, UserPlus, Settings, ChevronRight } from 'lucide-react';
import AccountSection from '../../components/AccountSection';
import { formatVersionLabel } from '../../lib/appVersion';
import { paths } from '../../lib/paths';

const manageItems = [
  { to: paths.categories,     icon: Tag,      label: 'Categories'    },
  { to: paths.tags,          icon: Tags,     label: 'Tags'          },
  { to: paths.groupInvites,  icon: UserPlus, label: 'Invites'       },
  { to: paths.groupSettings, icon: Settings, label: 'Group settings' },
];

export default function MoreScreen() {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 px-1 text-sm font-medium text-ink-muted">
          Manage
        </h2>
        <div className="card divide-y divide-line overflow-hidden">
          {manageItems.map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              className="flex min-h-[44px] items-center gap-3 px-4 transition hover:bg-recessed"
            >
              <Icon size={18} className="shrink-0 text-accent-ink" aria-hidden="true" />
              <span className="flex-1 text-sm font-medium text-ink">{label}</span>
              <ChevronRight size={16} className="text-ink-faint" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>
      <AccountSection />
      <p className="px-1 text-center text-xs text-ink-faint">
        {formatVersionLabel(__APP_COMMIT__, __APP_BUILT_AT__)}
      </p>
    </div>
  );
}
