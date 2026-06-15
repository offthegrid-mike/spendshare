import { NavLink } from 'react-router-dom';
import { ReceiptText, TrendingUp, BarChart2, MoreHorizontal } from 'lucide-react';

const tabs = [
  { to: '/',        label: 'Expenses', icon: ReceiptText,   end: true  },
  { to: '/income',  label: 'Income',   icon: TrendingUp,    end: false },
  { to: '/summary', label: 'Summary',  icon: BarChart2,     end: false },
  { to: '/more',    label: 'More',     icon: MoreHorizontal, end: false },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-slate-200 bg-white sm:hidden">
      {tabs.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
              isActive ? 'text-brand-700' : 'text-slate-400'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon size={22} strokeWidth={isActive ? 2.5 : 1.75} />
              {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
