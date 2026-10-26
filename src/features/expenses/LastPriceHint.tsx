import { formatLastPrice } from '../../lib/priceHistory';
import { lastPriceFor } from '../../lib/suggestions';
import type { SuggestionEntry } from '../../types/models';

/** "Last A$3.40 at Coles, 12 Oct" for an item the group has bought before; nothing otherwise. */
export default function LastPriceHint({ name, suggestions, currency }: {
  name: string;
  suggestions: SuggestionEntry[];
  currency: string;
}) {
  const last = lastPriceFor(suggestions, name);
  if (!last) return null;
  return <p className="text-xs text-ink-muted">{`Last ${formatLastPrice(last, currency)}`}</p>;
}
