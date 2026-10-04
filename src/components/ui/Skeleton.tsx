/** A loading placeholder block; size and shape it like the content it stands in for. */
export default function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`rounded-md bg-recessed motion-safe:animate-pulse ${className}`} />;
}
