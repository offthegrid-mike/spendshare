import type { ExportResult } from '../../lib/exportActions';

interface Props {
  result: ExportResult | null;
  className?: string;
}

/** What an export said. The region is always there so a screen reader announces the message when it appears. */
export default function ExportMessage({ result, className = '' }: Props) {
  return (
    <div role="status">
      {result && (
        <p className={`text-xs ${result.status === 'error' ? 'text-negative' : 'text-ink-muted'} ${className}`}>
          {result.message}
        </p>
      )}
    </div>
  );
}
