import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  usePwaStore, startInstallTracking, startUpdateChecks, promptInstall, applyUpdate, isIos,
  UPDATE_CHECK_MS, type BeforeInstallPromptEvent, type RegisterSW,
} from './pwa';

function installEvent(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const event = new Event('beforeinstallprompt') as BeforeInstallPromptEvent;
  Object.assign(event, {
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome, platform: 'web' }),
  });
  return event;
}

function reset() {
  usePwaStore.setState({ installPrompt: null, installed: false, needRefresh: false, updateSW: null });
}

describe('install tracking', () => {
  let stop: () => void;
  beforeEach(reset);
  afterEach(() => stop?.());

  it('keeps the browser install prompt for later, instead of letting the browser show its own', () => {
    stop = startInstallTracking();
    const event = installEvent();
    const preventDefault = vi.spyOn(event, 'preventDefault');
    window.dispatchEvent(event);
    expect(preventDefault).toHaveBeenCalled();
    expect(usePwaStore.getState().installPrompt).toBe(event);
  });

  it('marks the app installed and drops the prompt once it is installed', () => {
    stop = startInstallTracking();
    window.dispatchEvent(installEvent());
    window.dispatchEvent(new Event('appinstalled'));
    expect(usePwaStore.getState()).toMatchObject({ installed: true, installPrompt: null });
  });

  it('counts the app as installed when it is running standalone', () => {
    const matchMedia = vi.spyOn(window, 'matchMedia').mockImplementation(
      (q: string) => ({ matches: q === '(display-mode: standalone)' }) as MediaQueryList,
    );
    stop = startInstallTracking();
    expect(usePwaStore.getState().installed).toBe(true);
    matchMedia.mockRestore();
  });

  it('stops listening when stopped', () => {
    stop = startInstallTracking();
    stop();
    window.dispatchEvent(installEvent());
    expect(usePwaStore.getState().installPrompt).toBeNull();
  });
});

describe('promptInstall', () => {
  beforeEach(reset);

  it('shows the kept prompt once and clears it, returning the choice', async () => {
    const event = installEvent('accepted');
    usePwaStore.setState({ installPrompt: event });
    await expect(promptInstall()).resolves.toBe('accepted');
    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(usePwaStore.getState().installPrompt).toBeNull();
  });

  it('does nothing without a prompt', async () => {
    await expect(promptInstall()).resolves.toBe('unavailable');
  });
});

describe('update checks', () => {
  beforeEach(() => {
    reset();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  function register() {
    const updateSW = vi.fn().mockResolvedValue(undefined);
    let options: NonNullable<Parameters<RegisterSW>[0]> = {};
    const registerSW: RegisterSW = (o) => {
      options = o ?? {};
      return updateSW;
    };
    const stop = startUpdateChecks(registerSW);
    return { updateSW, options: () => options, stop };
  }

  it('flags a waiting new version and reloads into it on apply', async () => {
    const { updateSW, options, stop } = register();
    expect(usePwaStore.getState().needRefresh).toBe(false);
    options().onNeedRefresh?.();
    expect(usePwaStore.getState().needRefresh).toBe(true);
    await applyUpdate();
    expect(updateSW).toHaveBeenCalledWith(true);
    stop();
  });

  it('checks for a new version on a timer and when the app comes back into view', () => {
    const { options, stop } = register();
    const registration = { update: vi.fn().mockResolvedValue(undefined) } as unknown as ServiceWorkerRegistration;
    options().onRegisteredSW?.('/sw.js', registration);

    vi.advanceTimersByTime(UPDATE_CHECK_MS);
    expect(registration.update).toHaveBeenCalledTimes(1);

    document.dispatchEvent(new Event('visibilitychange'));
    expect(registration.update).toHaveBeenCalledTimes(2);

    stop();
    vi.advanceTimersByTime(UPDATE_CHECK_MS);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(registration.update).toHaveBeenCalledTimes(2);
  });

  it('skips the check while offline, and swallows a failed check', async () => {
    const { options, stop } = register();
    const registration = { update: vi.fn().mockRejectedValue(new Error('offline')) } as unknown as ServiceWorkerRegistration;
    options().onRegisteredSW?.('/sw.js', registration);

    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    vi.advanceTimersByTime(UPDATE_CHECK_MS);
    expect(registration.update).not.toHaveBeenCalled();
    onLine.mockReturnValue(true);
    vi.advanceTimersByTime(UPDATE_CHECK_MS);
    expect(registration.update).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    onLine.mockRestore();
    stop();
  });
});

describe('isIos', () => {
  it('spots iPhones and iPads, including iPads that report as a Mac', () => {
    expect(isIos({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', platform: 'iPhone', maxTouchPoints: 5 })).toBe(true);
    expect(isIos({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', maxTouchPoints: 5 })).toBe(true);
    expect(isIos({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', maxTouchPoints: 0 })).toBe(false);
    expect(isIos({ userAgent: 'Mozilla/5.0 (Linux; Android 15)', platform: 'Linux armv8l', maxTouchPoints: 5 })).toBe(false);
  });
});
