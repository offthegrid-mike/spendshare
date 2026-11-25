import { Link, Outlet, useLocation } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import Notice from '../../components/Notice';
import { useScrolled } from '../../hooks/useScrolled';
import { backTarget } from './travelNav';

/** Travel shell: a header with the way back and the Travel title. */
export default function TravelLayout() {
  const { pathname } = useLocation();
  const scrolled = useScrolled();
  const back = backTarget(pathname);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className={`sticky top-0 z-20 border-b bg-canvas ${scrolled ? 'border-line' : 'border-transparent'}`}>
        <div className="mx-auto max-w-[760px] space-y-1 px-4 pb-2.5 pt-2.5 lg:px-8">
          <Link to={back.to} className="inline-flex items-center gap-1 text-sm font-medium text-ink-muted hover:text-ink">
            <ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" />
            {back.label}
          </Link>
          <h1 className="text-lg font-semibold tracking-tight text-ink">Travel</h1>
        </div>
      </header>
      <main className="mx-auto px-4 pb-16 pt-4 lg:max-w-[760px] lg:px-8 lg:pt-6">
        <Outlet />
      </main>
      <Notice />
    </div>
  );
}
