import BrandMark from '../../components/BrandMark';
import Avatar from '../../components/ui/Avatar';

/** Desktop-only left half of the sign-in screen. Phones get just the form. */
export default function BrandPanel() {
  return (
    <aside className="hidden bg-accent-soft p-12 lg:flex lg:flex-col xl:p-16">
      <div className="flex items-center gap-2.5">
        <BrandMark size="sm" />
        <span className="text-lg font-semibold tracking-tight text-ink">SpendShare</span>
      </div>
      <div className="my-auto py-12">
        <p className="text-4xl font-semibold leading-[1.1] tracking-tight text-ink xl:text-5xl">
          <span className="block">Split the shopping.</span>
          <span className="block">Settle up in one tap.</span>
        </p>
        <SampleSettleUp />
      </div>
    </aside>
  );
}

/**
 * A still of the Summary screen's settle-up card, drawn with the same
 * primitives and sample data. Decorative, so it is hidden from assistive tech
 * and has no controls.
 */
function SampleSettleUp() {
  return (
    <div aria-hidden="true" className="card mt-14 w-full max-w-[380px] -rotate-2 p-6 shadow-pop">
      <div className="flex items-baseline justify-between">
        <span className="text-base font-semibold text-ink">Settle up</span>
        <span className="text-sm font-medium text-ink-muted">October</span>
      </div>
      <div className="mt-5 flex items-center gap-3">
        <Avatar name="Priya" tone="them" />
        <span className="min-w-0 flex-1 text-sm text-ink">Priya owes you</span>
        <span className="money text-2xl font-semibold text-accent-ink">$42.18</span>
      </div>
    </div>
  );
}
