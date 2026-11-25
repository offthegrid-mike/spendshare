import { create } from 'zustand';

/** Chromium's install prompt event (Chrome, Edge, Android). Not in the DOM typings. */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

/** The parts of vite-plugin-pwa's `registerSW` (from 'virtual:pwa-register') this module uses. */
export type RegisterSW = (options?: {
  immediate?: boolean;
  onNeedRefresh?: () => void;
  onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration | undefined) => void;
}) => (reloadPage?: boolean) => Promise<void>;

/** How often an open app looks for a new deploy. */
export const UPDATE_CHECK_MS = 60 * 60 * 1000;

interface PwaState {
  /** The browser's install prompt, kept so the app can show it from its own button. */
  installPrompt: BeforeInstallPromptEvent | null;
  /** Running as an installed app, or installed during this visit. */
  installed: boolean;
  /** A new version has downloaded and is waiting for a reload. */
  needRefresh: boolean;
  /** Activates the waiting version; set once the service worker is registered. */
  updateSW: ((reloadPage?: boolean) => Promise<void>) | null;
}

export const usePwaStore = create<PwaState>(() => ({
  installPrompt: null,
  installed: false,
  needRefresh: false,
  updateSW: null,
}));

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** iPhone or iPad, where installing is Safari's Share → Add to Home Screen and there is no prompt. */
export function isIos(nav: Pick<Navigator, 'userAgent' | 'platform' | 'maxTouchPoints'> = navigator): boolean {
  if (/iPhone|iPad|iPod/.test(nav.userAgent)) return true;
  // iPadOS reports itself as a Mac; a Mac has no touch screen.
  return nav.platform === 'MacIntel' && nav.maxTouchPoints > 1;
}

/** Keeps the browser's install prompt for the app's own Install button. Returns a stop function. */
export function startInstallTracking(): () => void {
  usePwaStore.setState({ installed: isStandalone() });

  function onPrompt(e: Event) {
    // Stops Chrome's own mini-infobar; the app offers Install itself.
    e.preventDefault();
    usePwaStore.setState({ installPrompt: e as BeforeInstallPromptEvent });
  }
  function onInstalled() {
    usePwaStore.setState({ installed: true, installPrompt: null });
  }

  window.addEventListener('beforeinstallprompt', onPrompt);
  window.addEventListener('appinstalled', onInstalled);
  return () => {
    window.removeEventListener('beforeinstallprompt', onPrompt);
    window.removeEventListener('appinstalled', onInstalled);
  };
}

/** Shows the kept install prompt. A prompt can only be shown once, so it is dropped after. */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const event = usePwaStore.getState().installPrompt;
  if (!event) return 'unavailable';
  usePwaStore.setState({ installPrompt: null });
  await event.prompt();
  const { outcome } = await event.userChoice;
  return outcome;
}

/**
 * Registers the service worker and looks for a new deploy every hour and
 * whenever the app comes back into view, so an installed app left open still
 * hears about updates. Returns a stop function.
 */
export function startUpdateChecks(registerSW: RegisterSW): () => void {
  let timer: ReturnType<typeof setInterval> | undefined;
  let onVisible: (() => void) | undefined;
  let stopped = false;

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh: () => usePwaStore.setState({ needRefresh: true }),
    onRegisteredSW: (_url, registration) => {
      if (!registration || stopped) return;
      const check = () => {
        if (!navigator.onLine) return;
        // A failed check (flaky network) just waits for the next one.
        registration.update().catch(() => {});
      };
      timer = setInterval(check, UPDATE_CHECK_MS);
      onVisible = () => {
        if (document.visibilityState === 'visible') check();
      };
      document.addEventListener('visibilitychange', onVisible);
    },
  });
  usePwaStore.setState({ updateSW });

  return () => {
    stopped = true;
    clearInterval(timer);
    if (onVisible) document.removeEventListener('visibilitychange', onVisible);
  };
}

/** Switches to the waiting version and reloads the page. */
export async function applyUpdate(): Promise<void> {
  await usePwaStore.getState().updateSW?.(true);
}

/** Hides the update banner for this visit; the new version still loads on the next launch. */
export function dismissUpdate(): void {
  usePwaStore.setState({ needRefresh: false });
}
