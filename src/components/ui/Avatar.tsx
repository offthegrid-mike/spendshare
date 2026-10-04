import { initialOf } from '../../lib/initials';

interface AvatarProps {
  name: string;
  /** `me` = the viewer (accent fill); `them` = anyone else (ink fill). */
  tone: 'me' | 'them';
  size?: 'sm' | 'md';
  /** Surface-coloured ring, for overlapping stacks and badges. */
  ring?: boolean;
}

const SIZES = { sm: 'h-[18px] w-[18px] text-[9px]', md: 'h-[26px] w-[26px] text-[11px]' };

export default function Avatar({ name, tone, size = 'md', ring = false }: AvatarProps) {
  return (
    <span
      title={name}
      className={`grid shrink-0 place-items-center rounded-full font-semibold ${SIZES[size]} ${
        tone === 'me' ? 'bg-accent text-on-accent' : 'bg-ink text-canvas'
      } ${ring ? 'ring-2 ring-surface' : ''}`}
    >
      {initialOf(name)}
    </span>
  );
}

interface StackProps {
  people: { name: string; isMe: boolean }[];
  max?: number;
}

export function AvatarStack({ people, max = 3 }: StackProps) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <span className="flex items-center">
      {shown.map((p, i) => (
        <span key={`${p.name}-${i}`} className={i > 0 ? '-ml-2' : ''}>
          <Avatar name={p.name} tone={p.isMe ? 'me' : 'them'} ring={i > 0} />
        </span>
      ))}
      {extra > 0 && (
        <span className="-ml-2 grid h-[26px] min-w-[26px] place-items-center rounded-full bg-recessed px-1 text-[11px] font-semibold text-ink-muted ring-2 ring-surface">
          +{extra}
        </span>
      )}
    </span>
  );
}
