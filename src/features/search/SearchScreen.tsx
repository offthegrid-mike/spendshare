import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, ShoppingBag } from 'lucide-react';
import { format } from 'date-fns';
import { formatMoney } from '../../lib/money';
import { searchExpenses, highlightMatch } from '../../lib/search';
import { useAllExpenses } from '../../hooks/useAllExpenses';
import type { GroupDoc } from '../../types/models';

interface Props { group: GroupDoc; }

export default function SearchScreen({ group }: Props) {
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const { expenses, itemsByExpense, loading, error } = useAllExpenses(group.id);

  const results = useMemo(
    () => searchExpenses(expenses, itemsByExpense, query),
    [expenses, itemsByExpense, query],
  );

  function payerName(uid: string): string {
    return group.members[uid]?.displayName ?? uid;
  }

  const hasQuery = query.trim() !== '';

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search
          size={16}
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          type="search"
          autoFocus
          value={query}
          onChange={(e) => setParams(e.target.value ? { q: e.target.value } : {}, { replace: true })}
          placeholder="Search shop or item name"
          aria-label="Search shop or item name"
          className="w-full rounded-2xl border border-white/60 bg-white/80 py-3 pl-9 pr-3 text-sm shadow-card backdrop-blur-sm placeholder:text-slate-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-200"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!error && loading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/70 shadow-card" />
          ))}
        </div>
      )}

      {!error && !loading && !hasQuery && (
        <p className="px-1 py-8 text-center text-sm text-slate-500">
          Search by shop or item name — across every month.
        </p>
      )}

      {!error && !loading && hasQuery && results.length === 0 && (
        <p className="px-1 py-8 text-center text-sm text-slate-500">
          No results for “{query}”.
        </p>
      )}

      {!error && !loading && results.length > 0 && (
        <>
          <p className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {results.length} result{results.length !== 1 ? 's' : ''}
          </p>
          <div className="space-y-2.5">
            {results.map(({ expense, matchedItems }) => (
              <Link
                key={expense.id}
                to={`/expense/${expense.id}/edit`}
                className="block rounded-2xl border border-white/60 bg-white/80 shadow-card backdrop-blur-sm transition-shadow hover:shadow-card-hover"
              >
                <div className="flex min-h-[44px] items-center gap-3 px-4 py-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
                    <ShoppingBag size={18} aria-hidden="true" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">
                      {highlightMatch(expense.shopName, query)}
                    </p>
                    <p className="text-xs text-slate-400">
                      {expense.date ? format(expense.date.toDate(), 'd MMM yyyy') : expense.month}
                      {' · '}
                      {payerName(expense.payerUid)}
                    </p>
                  </div>
                  <span className="text-base font-bold tabular-nums text-slate-900">
                    {formatMoney(expense.total, group.currency)}
                  </span>
                </div>
                {matchedItems.length > 0 && (
                  <ul className="space-y-1 border-t border-slate-100 px-4 py-2.5">
                    {matchedItems.map((item) => (
                      <li key={item.id} className="flex items-start justify-between text-sm text-slate-600">
                        <span>{highlightMatch(item.name, query)}</span>
                        <span className="tabular-nums text-slate-400">
                          {formatMoney(item.amount, group.currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
