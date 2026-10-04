const SIZES = {
  sm: { tile: 'h-9 w-9 rounded-[10px]', glyph: 18 },
  md: { tile: 'h-11 w-11 rounded-xl', glyph: 22 },
} as const;

/**
 * The SpendShare receipt glyph on an accent tile. scripts/generate-icons.mjs
 * renders every app icon from the same glyph paths, so change both together.
 */
export default function BrandMark({ size = 'md' }: { size?: keyof typeof SIZES }) {
  const { tile, glyph } = SIZES[size];
  return (
    <span className={`grid shrink-0 place-items-center bg-accent text-on-accent ${tile}`}>
      <svg
        width={glyph}
        height={glyph}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 4h16v14l-2.5-1.5L15 18l-3-1.5L9 18l-2.5-1.5L4 18z" />
        <path d="M9 8h6M9 12h4" />
      </svg>
    </span>
  );
}
