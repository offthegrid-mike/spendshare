import { useCallback, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Gift, Search, ShoppingBag } from 'lucide-react';
import { format } from 'date-fns';
import { formatMoney } from '../../lib/money';
import { searchExpenses, highlightMatch } from '../../lib/search';
import { useAllExpenses } from '../../hooks/useAllExpenses';
import type { GroupDoc } from '../../types/models';

interface Props { group: GroupDoc; }

export default function SearchScreen({ group }: Props) {
  // `draft` is what the field shows; `query` is what we actually search. They
  // differ only mid-IME-composition: re-rendering the field from shared state on
  // every keystroke tears down an in-progress composition, which with Cangjie
  // makes it impossible to type into.
  //
  // The query is held here rather than in the URL on purpose — mirroring it to
  // ?q= churned the address bar on every keystroke and seeded browser
  // autocomplete with search URLs. ?q= is only read, as a hand-off from the
  // desktop top bar's search field; adopt it whenever it changes (during
  // render, not in an effect).
  const [params] = useSearchParams();
  const urlQuery = params.get('q') ?? '';
  const [adoptedUrlQuery, setAdoptedUrlQuery] = useState(urlQuery);
  const [draft, setDraft] = useState(urlQuery);
  const [query, setQuery] = useState(urlQuery);
  if (urlQuery !== adoptedUrlQuery) {
    setAdoptedUrlQuery(urlQuery);
    setDraft(urlQuery);
    setQuery(urlQuery);
  }
  const composing = useRef(false);
  const { expenses, itemsByExpense, loading, error } = useAllExpenses(group.id);

  const commit = useCallback((value: string) => setQuery(value), []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { value } = e.target;
    setDraft(value);
    // Intermediate IME keystrokes ("一口廿" on the way to 街) are not a query.
    if (composing.current || (e.nativeEvent as InputEvent).isComposing) return;
    commit(value);
  }

  function handleCompositionEnd(e: React.CompositionEvent<HTMLInputElement>) {
    composing.current = false;
    const { value } = e.currentTarget;
    setDraft(value);
    commit(value);
  }

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
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
        />
        <input
          type="search"
          autoFocus
          value={draft}
          onChange={handleChange}
          onCompositionStart={() => { composing.current = true; }}
          onCompositionEnd={handleCompositionEnd}
          placeholder="Search shop or item name"
          aria-label="Search shop or item name"
          className="field py-3 pl-9 pr-3"
        />
      </div>

      {error && <p className="text-sm text-negative">{error}</p>}

      {!error && loading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-recessed" />
          ))}
        </div>
      )}

      {!error && !loading && !hasQuery && (
        <p className="px-1 py-8 text-center text-sm text-ink-muted">
          Search every item your group has bought
        </p>
      )}

      {!error && !loading && hasQuery && results.length === 0 && (
        <p className="px-1 py-8 text-center text-sm text-ink-muted">
          No items match '{query}'.
        </p>
      )}

      {!error && !loading && results.length > 0 && (
        <>
          <p className="px-1 text-xs font-medium text-ink-muted">
            {results.length} result{results.length !== 1 ? 's' : ''}
          </p>
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            {results.map(({ expense, matchedItems }) => (
              <Link
                key={expense.id}
                to={`/expense/${expense.id}/edit`}
                className="block border-b border-line last:border-0 hover:bg-recessed"
              >
                <div className="flex min-h-[44px] items-center gap-3 px-4 py-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-recessed text-ink-muted">
                    <ShoppingBag size={18} aria-hidden="true" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-ink">
                      {highlightMatch(expense.shopName, query)}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {expense.date ? format(expense.date.toDate(), 'd MMM yyyy') : expense.month}
                      {' · '}
                      {payerName(expense.payerUid)}
                    </p>
                  </div>
                  <div className="text-right">
                    {expense.giftCardAmount ? (
                      <>
                        <p className="money text-xs text-ink-faint line-through">
                          {formatMoney(expense.total, group.currency)}
                        </p>
                        <p className="money text-base font-semibold text-ink">
                          {formatMoney(expense.total - expense.giftCardAmount, group.currency)}
                        </p>
                        <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-ink-faint">
                          <Gift size={12} aria-hidden="true" /> Gift card {formatMoney(expense.giftCardAmount, group.currency)}
                        </span>
                      </>
                    ) : (
                      <span className="money text-base font-semibold text-ink">
                        {formatMoney(expense.total, group.currency)}
                      </span>
                    )}
                  </div>
                </div>
                {matchedItems.length > 0 && (
                  <ul className="space-y-1 border-t border-line px-4 py-2.5">
                    {matchedItems.map((item) => (
                      <li key={item.id} className="flex items-start justify-between text-sm text-ink-muted">
                        <mark className="bg-accent-soft text-inherit">{highlightMatch(item.name, query)}</mark>
                        <span className="money text-ink-muted">
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
