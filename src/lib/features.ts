/** Every screen uses semantic tokens, so the saved theme preference is available. */
export const DARK_MODE_ENABLED = true;

/** The Home screen, the Work tracker and the Home link in SpendShare. On since v2.1.0. */
export const WORK_ENABLED = true;

/**
 * Travel: shared trip costs in any currency (docs/TRAVEL_PLAN.md). On in
 * development; in a production build only when VITE_TRAVEL_ENABLED is 'true',
 * so the milestones can merge (every merge deploys) before it is ready to use.
 */
export const TRAVEL_ENABLED = import.meta.env.DEV || import.meta.env.VITE_TRAVEL_ENABLED === 'true';
