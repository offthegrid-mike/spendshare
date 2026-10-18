import { Navigate, useLocation } from 'react-router-dom';
import { legacyTarget, paths } from '../../lib/paths';

/** Old pre-/spend URLs land on their /spend twin, keeping the query and hash; anything else goes Home. */
export default function LegacyRedirect() {
  const { pathname, search, hash } = useLocation();
  const bare = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  return <Navigate to={{ pathname: legacyTarget(bare) ?? paths.home, search, hash }} replace />;
}
