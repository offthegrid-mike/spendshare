/** A small headline figure: a muted label over a bold mono value. */
export default function Stat({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div>
      <p className="text-xs text-ink-muted">{label}</p>
      <p data-testid={testId} className="money text-xl font-semibold tracking-tight text-ink">{value}</p>
    </div>
  );
}
