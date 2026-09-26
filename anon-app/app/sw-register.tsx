"use client";
import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (location.protocol !== "https:" && location.hostname !== "localhost") return;

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => console.log("[sw] registered:", reg.scope))
      .catch((err) => console.warn("[sw] registration failed:", err));
  }, []);

  return null;
}
