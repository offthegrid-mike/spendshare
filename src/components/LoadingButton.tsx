import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading: boolean;
  loadingText?: ReactNode;
  children: ReactNode;
}

export default function LoadingButton({
  loading,
  loadingText,
  children,
  disabled,
  ...rest
}: Props) {
  return (
    <button type="button" {...rest} disabled={loading || disabled}>
      {loading ? (
        <span className="inline-flex items-center gap-1.5" role="status">
          <Loader2 size={15} className="animate-spin" aria-hidden="true" />
          {loadingText ?? children}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
