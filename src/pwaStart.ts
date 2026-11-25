// Imported by main.tsx before the app, so it runs even when a deploy's app
// code throws while loading or rendering: the service worker registers, update
// checks start, and the update banner has its own React root, so the next
// deploy can still be offered and loaded. (A file that fails to download
// stops every module, this one included; the browser's own update check on
// each launch then still finds the next deploy.) Also catches an early
// install prompt.
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { startInstallTracking, startUpdateChecks } from './lib/pwa';
import UpdateBanner from './components/UpdateBanner';

startInstallTracking();
startUpdateChecks(registerSW);

const bannerRoot = document.createElement('div');
bannerRoot.id = 'update-banner';
document.body.appendChild(bannerRoot);
createRoot(bannerRoot).render(createElement(UpdateBanner));
