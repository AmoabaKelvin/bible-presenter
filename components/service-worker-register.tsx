"use client"

import { useEffect } from "react"

// Registers the offline service worker in production only — dev caching
// would otherwise mask code changes behind stale responses.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (window.flowcastDesktop) {
      void navigator.serviceWorker?.getRegistrations().then((registrations) => {
        for (const registration of registrations) void registration.unregister()
      })
      return
    }
    if (process.env.NODE_ENV !== "production") return
    if (!("serviceWorker" in navigator)) return
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // registration failures are non-fatal; the app still works online
      })
    }
    if (document.readyState === "complete") register()
    else window.addEventListener("load", register, { once: true })
  }, [])
  return null
}
