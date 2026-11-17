import { useEffect, useRef, useState } from 'react';
import { Controller } from 'react-hook-form';
import type { Control, UseFormRegister, UseFormSetValue } from 'react-hook-form';
import { ChevronDown, ChevronRight, TriangleAlert } from 'lucide-react';
import CategoryTile from '../../components/ui/CategoryTile';
import Chip from '../../components/ui/Chip';
import TagChip from '../../components/ui/TagChip';
import { iconForCategory } from '../../lib/categoryIcons';
import type { CategoryDoc, SuggestionEntry } from '../../types/models';
import { toCents, formatMoney } from '../../lib/money';
import type { FormValues } from './expenseForm';
import { parseQty } from './expenseForm';
import ItemNameCombobox from './ItemNameCombobox';
import LastPriceHint from './LastPriceHint';
import TagInput from './TagInput';
import Select from '../../components/ui/Select';
import Checkbox from '../../components/ui/Checkbox';

interface ItemRowProps {
  index: number;
  control: Control<FormValues>;
  register: UseFormRegister<FormValues>;
  setValue: UseFormSetValue<FormValues>;
  cats: CategoryDoc[];
  suggestions: SuggestionEntry[];
  /** Earlier tags, to offer in the item's tag field. */
  tagSuggestions: string[];
  summary:
    | {
        name: string; categoryId: string; amount: string; quantity?: string; shared: boolean; remark?: string;
        tags?: string[]; categoryUnconfirmed?: boolean;
      }
    | undefined;
  currency: string;
  expanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
}

export default function ItemRow({
  index, control, register, setValue, cats, suggestions, tagSuggestions,
  summary, currency, expanded, onToggle, onRemove,
}: ItemRowProps) {
  const catName = cats.find((c) => c.id === summary?.categoryId)?.name ?? '';
  const categoryOptions = [
    { value: '', label: 'No category' },
    ...cats.map((cat) => ({ value: cat.id, label: cat.name })),
  ];
  const unconfirmed = !!summary?.categoryUnconfirmed;
  const unitCents = toCents(summary?.amount ?? '0');
  const qty = parseQty(summary?.quantity);
  const lineCents = (isNaN(unitCents) ? 0 : unitCents) * qty;

  const [armed, setArmed] = useState(false);
  const disarmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearDisarmTimer = () => {
    if (disarmTimer.current) {
      clearTimeout(disarmTimer.current);
      disarmTimer.current = null;
    }
  };

  const disarm = () => {
    clearDisarmTimer();
    setArmed(false);
  };

  useEffect(() => clearDisarmTimer, []);

  const handleRemoveClick = () => {
    if (armed) {
      disarm();
      onRemove();
      return;
    }
    setArmed(true);
    clearDisarmTimer();
    disarmTimer.current = setTimeout(() => setArmed(false), 3000);
  };

  return (
    <div className={`overflow-hidden rounded-[10px] border bg-surface ${unconfirmed ? 'border-warning/60' : 'border-line'}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-recessed/55"
      >
        <CategoryTile icon={iconForCategory(catName)} label={catName || summary?.name || '?'} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium text-ink" dir="auto">
              {summary?.name || 'Untitled item'}
            </span>
            {summary && !summary.shared && <Chip>Personal</Chip>}
          </span>
          {(catName || summary?.remark || unconfirmed) && (
            <span className="block truncate text-xs text-ink-muted">
              {unconfirmed ? (
                <span className="inline-flex items-center gap-1 font-medium text-warning">
                  <TriangleAlert size={12} strokeWidth={1.75} aria-hidden="true" />
                  {catName ? `Check category: ${catName}` : 'Check category'}
                </span>
              ) : (
                catName && <span>{catName}</span>
              )}
              {catName && summary?.remark && ' · '}
              {summary?.remark && <span dir="auto">{summary.remark}</span>}
            </span>
          )}
          {summary?.tags && summary.tags.length > 0 && (
            <span className="mt-0.5 flex flex-wrap gap-1">
              {summary.tags.map((tag) => <TagChip key={tag}>{tag}</TagChip>)}
            </span>
          )}
        </span>
        {qty > 1 && (
          <span className="money shrink-0 text-xs text-ink-muted">
            {formatMoney(isNaN(unitCents) ? 0 : unitCents, currency)} × {qty}
          </span>
        )}
        <span className="money shrink-0 text-sm font-medium text-ink">
          {formatMoney(lineCents, currency)}
        </span>
        {expanded
          ? <ChevronDown size={16} strokeWidth={1.75} className="shrink-0 text-ink-faint" aria-hidden="true" />
          : <ChevronRight size={16} strokeWidth={1.75} className="shrink-0 text-ink-faint" aria-hidden="true" />}
      </button>

      {expanded && (
        <div className="space-y-2 border-t border-line px-3 pb-3 pt-2">
          <Controller
            control={control}
            name={`items.${index}.name`}
            render={({ field }) => (
              <>
                <ItemNameCombobox
                  id={`items.${index}.name`}
                  value={field.value}
                  suggestions={suggestions}
                  currency={currency}
                  onChange={(name, suggestion) => {
                    field.onChange(name);
                    if (suggestion) {
                      setValue(`items.${index}.categoryId`, suggestion.categoryId);
                      setValue(`items.${index}.categoryUnconfirmed`, false);
                    }
                  }}
                />
                <LastPriceHint name={field.value} suggestions={suggestions} currency={currency} />
              </>
            )}
          />

          <Controller
            control={control}
            name={`items.${index}.categoryId`}
            render={({ field }) => (
              <div>
                <span id={`items.${index}.categoryId-label`} className="sr-only">Category</span>
                <Select
                  id={`items.${index}.categoryId`}
                  aria-labelledby={`items.${index}.categoryId-label`}
                  title="Category"
                  value={field.value ?? ''}
                  // Every pick counts as the user checking the category, even
                  // re-picking the current one.
                  onChange={(v) => {
                    field.onChange(v);
                    setValue(`items.${index}.categoryUnconfirmed`, false);
                  }}
                  options={categoryOptions}
                />
              </div>
            )}
          />

          <div className="flex gap-2">
            <div className="flex-1">
              <label
                htmlFor={`items.${index}.amount`}
                className="mb-1 block text-sm font-medium text-ink"
              >
                Unit price
              </label>
              <input
                id={`items.${index}.amount`}
                type="text"
                inputMode="decimal"
                {...register(`items.${index}.amount`)}
                className="field"
              />
            </div>
            <div className="w-24">
              <label
                htmlFor={`items.${index}.quantity`}
                className="mb-1 block text-sm font-medium text-ink"
              >
                Qty
              </label>
              <input
                id={`items.${index}.quantity`}
                type="text"
                inputMode="numeric"
                {...register(`items.${index}.quantity`)}
                className="field"
              />
            </div>
          </div>
          {qty > 1 && (
            <p className="money text-xs text-ink-muted">
              Line total: {formatMoney(lineCents, currency)}
            </p>
          )}

          <div>
            <label
              htmlFor={`items.${index}.remark`}
              className="mb-1 block text-sm font-medium text-ink"
            >
              Remark <span className="font-normal text-ink-muted">(optional)</span>
            </label>
            <input
              id={`items.${index}.remark`}
              type="text"
              placeholder="e.g. on sale, for party…"
              {...register(`items.${index}.remark`)}
              className="field"
            />
          </div>

          <Controller
            control={control}
            name={`items.${index}.tags`}
            render={({ field }) => (
              <TagInput
                id={`items.${index}.tags`}
                label="Tags"
                tags={field.value ?? []}
                onChange={field.onChange}
                suggestions={tagSuggestions}
              />
            )}
          />

          <Checkbox {...register(`items.${index}.shared`)}>Shared</Checkbox>

          <button
            type="button"
            onClick={handleRemoveClick}
            onBlur={disarm}
            className="text-sm text-negative hover:underline"
          >
            {armed ? 'Click again to remove' : 'Remove item'}
          </button>
        </div>
      )}
    </div>
  );
}
