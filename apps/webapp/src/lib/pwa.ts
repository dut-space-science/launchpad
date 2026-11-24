import { useSyncExternalStore } from "react";
import { toast } from "sonner";

/**
 * Installable and offline support.
 *
 * - The service worker (generated at build time, see scripts/pwa-plugin.ts) stores the app so it opens without a
 *   network. It is only registered in production builds, so development is never served stale files.
 * - A new version waits until the learner chooses to reload, so a page that is already open never loses its files.
 * - The browser's install prompt is captured here, once and early, because it can fire before the app has rendered.
 */

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Running as an installed app (its own window) rather than in a browser tab. */
const standalone = () =>
  matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferred = e as InstallPromptEvent;
  emit();
});
window.addEventListener("appinstalled", () => {
  deferred = null;
  installed = true;
  emit();
});

export interface InstallState {
  /** The browser offered to install and the learner has not yet. */
  canInstall: boolean;
  /** Already running as an installed app. */
  installed: boolean;
  /** iPhone or iPad, where installing is a manual step in Safari. */
  ios: boolean;
  /** This browser can run the service worker at all (needs HTTPS or localhost). */
  supported: boolean;
}

const IOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const SUPPORTED = "serviceWorker" in navigator && window.isSecureContext;
let snapshot: InstallState = {
  canInstall: false,
  installed: false,
  ios: IOS,
  supported: SUPPORTED,
};
function current(): InstallState {
  const next = {
    canInstall: deferred !== null,
    installed: installed || standalone(),
    ios: IOS,
    supported: SUPPORTED,
  };
  // useSyncExternalStore needs the same object back until something changes.
  if (
    next.canInstall !== snapshot.canInstall ||
    next.installed !== snapshot.installed ||
    next.ios !== snapshot.ios ||
    next.supported !== snapshot.supported
  )
    snapshot = next;
  return snapshot;
}

export const useInstallState = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    current,
    current,
  );

/** Show the browser's install prompt. Resolves to whether the learner accepted. */
export async function installApp(): Promise<boolean> {
  if (!deferred) return false;
  const event = deferred;
  deferred = null; // a prompt can only be used once
  emit();
  await event.prompt();
  return (await event.userChoice).outcome === "accepted";
}

/** Register the service worker (production only) and offer a reload when a new version is ready. */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !SUPPORTED) return;
  let reloading = false;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    // Only after the learner chose to update; the first install also changes the controller and must not reload.
    if (reloading) location.reload();
  });

  const offerUpdate = (worker: ServiceWorker) =>
    toast("A new version of Launchpad is ready.", {
      id: "pwa-update",
      duration: Infinity,
      action: {
        label: "Reload",
        onClick: () => {
          reloading = true;
          worker.postMessage({ type: "SKIP_WAITING" });
        },
      },
    });

  navigator.serviceWorker
    .register(new URL("sw.js", document.baseURI), { scope: new URL("./", document.baseURI).href })
    .then((reg) => {
      if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const worker = reg.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller)
            offerUpdate(worker);
        });
      });
      // An installed app can stay open for days: look for a new version when it comes back into view and hourly.
      const check = () => void reg.update().catch(() => undefined);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") check();
      });
      setInterval(check, 60 * 60 * 1000);
    })
    .catch((e: unknown) => console.warn("Launchpad could not start offline support.", e));
}
