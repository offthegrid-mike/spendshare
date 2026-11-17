import { useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

// Below this width a popover becomes a bottom sheet, which is easier to hit
// with a thumb than a small floating panel.
const SHEET_BELOW = 640;
const GAP = 6;
const EDGE = 8;

interface Props {
  open: boolean;
  onClose: () => void;
  /** The control the popover hangs from; clicks on it do not count as outside. */
  anchorRef: RefObject<HTMLElement | null>;
  /** Heading shown when the popover is presented as a bottom sheet. */
  title: string;
  children: ReactNode;
  /** Grow to at least the anchor's width (menus) rather than hug the content (pickers). */
  matchAnchorWidth?: boolean;
  minWidth?: number;
  className?: string;
}

/**
 * A themed floating panel in a portal, so no scroll container or
 * `overflow-hidden` ancestor can clip it. It flips above the anchor when
 * there's no room below, and turns into a bottom sheet on phones.
 */
export default function Popover(props: Props) {
  return props.open ? <PopoverPanel {...props} /> : null;
}

function PopoverPanel({
  onClose,
  anchorRef,
  title,
  children,
  matchAnchorWidth = false,
  minWidth = 0,
  className = '',
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const sheet = window.innerWidth < SHEET_BELOW;
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Positioned by writing styles straight to the node: it tracks scrolling
  // and resizing without a re-render on every frame.
  useLayoutEffect(() => {
    if (sheet) return;
    const place = () => {
      const panel = panelRef.current;
      const anchor = anchorRef.current;
      if (!panel || !anchor) return;
      const rect = anchor.getBoundingClientRect();
      panel.style.maxHeight = '';
      panel.style.minWidth = `${Math.max(minWidth, matchAnchorWidth ? rect.width : 0)}px`;
      const width = panel.offsetWidth;
      const height = panel.scrollHeight;
      const below = window.innerHeight - rect.bottom - GAP - EDGE;
      const above = rect.top - GAP - EDGE;
      const flip = height > below && above > below;
      const room = flip ? above : below;
      const shown = Math.min(height, room);
      panel.style.maxHeight = `${Math.max(room, 120)}px`;
      panel.style.top = `${flip ? rect.top - GAP - shown : rect.bottom + GAP}px`;
      panel.style.left = `${Math.max(EDGE, Math.min(rect.left, window.innerWidth - width - EDGE))}px`;
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [sheet, anchorRef, matchAnchorWidth, minWidth]);

  useEffect(() => {
    function outside(e: Event) {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onCloseRef.current();
    }
    function escape(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onCloseRef.current();
    }
    document.addEventListener('mousedown', outside);
    document.addEventListener('touchstart', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('touchstart', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [anchorRef]);

  // Lock page scroll behind a sheet, as BottomSheet does.
  useEffect(() => {
    if (!sheet) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [sheet]);

  if (sheet) {
    return createPortal(
      <div className="fixed inset-0 z-50">
        <div className="absolute inset-0 bg-ink/40" aria-hidden="true" />
        <div
          ref={panelRef}
          className={`absolute inset-x-0 bottom-0 max-h-[75%] overflow-y-auto overscroll-contain rounded-t-[20px] bg-surface pb-[max(1rem,env(safe-area-inset-bottom))] shadow-pop motion-safe:animate-sheet-in ${className}`}
        >
          <div className="flex justify-center pb-1 pt-3" aria-hidden="true">
            <div className="h-1 w-10 rounded-full bg-line" />
          </div>
          <p className="px-4 pb-2 pt-1 text-base font-semibold tracking-tight text-ink">{title}</p>
          {children}
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div
      ref={panelRef}
      className={`fixed left-0 top-0 z-50 overflow-y-auto overscroll-contain rounded-xl border border-line bg-surface shadow-pop motion-safe:animate-menu-in ${className}`}
    >
      {children}
    </div>,
    document.body,
  );
}
