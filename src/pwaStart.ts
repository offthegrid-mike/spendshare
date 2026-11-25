// Imported by main.tsx before the app, so the service worker registers and
// update checks start even if the app's own modules fail to load (a broken
// deploy can still be replaced by the next one). Also catches an early
// install prompt.
import { registerSW } from 'virtual:pwa-register';
import { startInstallTracking, startUpdateChecks } from './lib/pwa';

startInstallTracking();
startUpdateChecks(registerSW);
