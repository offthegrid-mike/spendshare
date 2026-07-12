import { Controller } from 'react-hook-form';
import type { Control, UseFormRegister, UseFormSetValue } from 'react-hook-form';
import { ChevronDown, ChevronRight, UserRound } from 'lucide-react';
import type { CategoryDoc, SuggestionEntry } from '../../types/models';
import { toCents, formatMoney } from '../../lib/money';
import type { FormValues } from './expenseForm';
import ItemNameCombobox from './ItemNameCombobox';

interface ItemRowProps {
  index: number;
  control: Control<FormValues>;
  register: UseFormRegister<FormValues>;
  setValue: UseFormSetValue<FormValues>;
  cats: CategoryDoc[];
  suggestions: SuggestionEntry[];
  summary: { name: string; categoryId: string; amount: string; shared: boolean } | undefined;
  currency: string;
  expanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
}

export default function ItemRow({
  index, control, register, setValue, cats, suggestions,
  summary, currency, expanded, onToggle, onRemove,
}: ItemRowProps) {
  const catName = cats.find((c) => c.id === summary?.categoryId)?.name ?? '';
  const amountCents = toCents(summary?.amount ?? '0');

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/60">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left"
      >
        {expanded
          ? <ChevronDown size={16} className="shrink-0 text-slate-500" />
          : <ChevronRight size={16} className="shrink-0 text-slate-400" />}
        <span className="min-w-0 flex-1 truncate text-sm text-slate-900" dir="auto">
          {summary?.name || 'Untitled item'}
        </span>
        {catName && (
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
            {catName}
          </span>
        )}
        {summary && !summary.shared && (
          <UserRound size={14} className="shrink-0 text-slate-400" role="img" aria-label="Not shared" />
        )}
        <span className="shrink-0 text-sm font-medium tabular-nums text-slate-900">
          {formatMoney(isNaN(amountCents) ? 0 : amountCents, currency)}
        </span>
      </button>

      {expanded && (
        <div className="space-y-2 border-t border-slate-200 px-3 pb-3 pt-2">
          <Controller
            control={control}
            name={`items.${index}.name`}
            render={({ field }) => (
              <ItemNameCombobox
                id={`items.${index}.name`}
                value={field.value}
                suggestions={suggestions}
                onChange={(name, suggestion) => {
                  field.onChange(name);
                  if (suggestion) setValue(`items.${index}.categoryId`, suggestion.categoryId);
                }}
              />
            )}
          />

          <select {...register(`items.${index}.categoryId`)} className="field">
            <option value="">No category</option>
            {cats.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>

          <div>
            <label
              htmlFor={`items.${index}.amount`}
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Amount
            </label>
            <input
              id={`items.${index}.amount`}
              type="text"
              inputMode="decimal"
              {...register(`items.${index}.amount`)}
              className="field"
            />
          </div>

          <div>
            <label
              htmlFor={`items.${index}.remark`}
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Remark <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input
              id={`items.${index}.remark`}
              type="text"
              placeholder="e.g. on sale, for party…"
              {...register(`items.${index}.remark`)}
              className="field"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              {...register(`items.${index}.shared`)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500/40"
            />
            Shared
          </label>

          <button
            type="button"
            onClick={onRemove}
            className="text-sm text-rose-600 hover:underline"
          >
            Remove item
          </button>
        </div>
      )}
    </div>
  );
}
