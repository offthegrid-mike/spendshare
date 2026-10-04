import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { CategoryDoc, SuggestionEntry } from '../../types/models';
import ItemNameCombobox from './ItemNameCombobox';

interface QuickAddBarProps {
  cats: CategoryDoc[];
  suggestions: SuggestionEntry[];
  onAdd: (item: {
    name: string;
    categoryId: string;
    amount: string;
    quantity: string;
    shared: boolean;
  }) => void;
}

export default function QuickAddBar({ cats, suggestions, onAdd }: QuickAddBarProps) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [categoryId, setCategoryId] = useState(''); // sticky across adds
  const [shared, setShared] = useState(true); // sticky across adds
  const [error, setError] = useState('');

  function handleAdd() {
    if (!name.trim()) {
      setError('Enter an item name');
      return;
    }
    const amountNum = Number(amount);
    if (!amount.trim() || isNaN(amountNum) || amountNum <= 0) {
      setError('Enter a unit price');
      return;
    }
    const qtyNum = Math.floor(Number(quantity));
    if (!Number.isFinite(qtyNum) || qtyNum < 1) {
      setError('Enter a quantity of 1 or more');
      return;
    }
    onAdd({ name: name.trim(), categoryId, amount, quantity: String(qtyNum), shared });
    setName('');
    setAmount('');
    setQuantity('1');
    setError('');
    // categoryId and shared intentionally retained (sticky) for the next item.
    // Return focus to the name input for rapid consecutive entry.
    document.getElementById('quickadd-name')?.focus();
  }

  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  // One row from lg up; on phones, name/price/qty then category/shared/add.
  return (
    <div className="rounded-[10px] bg-recessed p-2.5">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="min-w-0 flex-1">
            <ItemNameCombobox
              id="quickadd-name"
              value={name}
              suggestions={suggestions}
              onEnter={handleAdd}
              onChange={(n, suggestion) => {
                setName(n);
                if (suggestion) setCategoryId(suggestion.categoryId);
              }}
            />
          </div>
          <label htmlFor="qa-amount" className="sr-only">Unit price</label>
          <input
            id="qa-amount"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={onEnter}
            className="field money w-20 lg:w-[72px]"
          />
          <span className="text-sm text-ink-muted" aria-hidden="true">×</span>
          <input
            id="qa-qty"
            type="text"
            inputMode="numeric"
            aria-label="Quantity"
            placeholder="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            onKeyDown={onEnter}
            className="field money w-12"
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="qa-category" className="sr-only">Category</label>
          <select
            id="qa-category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="field flex-1 lg:w-32 lg:flex-none"
          >
            <option value="">No category</option>
            {cats.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>

          {/* A checkbox styled as a switch: role and keyboard stay native. */}
          <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap text-sm text-ink">
            <input
              type="checkbox"
              checked={shared}
              onChange={(e) => setShared(e.target.checked)}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className="relative h-5 w-9 shrink-0 rounded-full bg-line transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-surface after:shadow-sm after:transition-transform peer-checked:bg-accent peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40"
            />
            Shared
          </label>

          <button
            type="button"
            onClick={handleAdd}
            aria-label="Add item"
            className="grid h-9 w-10 shrink-0 place-items-center rounded-[10px] bg-accent text-on-accent transition hover:brightness-110 motion-safe:active:scale-95"
          >
            <Plus size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      </div>

      {error && <p className="mt-2 text-sm text-negative">{error}</p>}
    </div>
  );
}
