"use client";

import { useEffect } from "react";

/**
 * Registers the service worker (production only — registering in dev fights
 * Next's HMR and serves stale chunks). Best-effort: failures are swallowed so
 * a blocked/unsupported SW never breaks the app.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* ignore — SW is an enhancement, not a requirement */
      });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
