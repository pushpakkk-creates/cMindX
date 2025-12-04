"use client";

import { useEffect } from "react";

export function useAnalytics(variantId?: string) {
  useEffect(() => {
    const sessionId =
      crypto.randomUUID?.() ?? `sess_${Date.now()}_${Math.random()}`;

    function send(eventType: string, payload: Record<string, unknown> = {}) {
      fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          eventType,
          payload,
          ts: new Date().toISOString(),
          variantId,
        }),
      }).catch(() => {
        // ignore errors on client
      });
    }

    // pageview once
    send("pageview", { path: window.location.pathname });

    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      const text = target.innerText?.slice(0, 80);
      send("click", {
        x: e.clientX,
        y: e.clientY,
        tag: target.tagName,
        text,
      });
    }

    function handleScroll() {
      const scrollTop =
        window.pageYOffset || document.documentElement.scrollTop;
      const docHeight =
        document.documentElement.scrollHeight -
        document.documentElement.clientHeight;
      const scrollPercent =
        docHeight > 0 ? Math.round((scrollTop / docHeight) * 100) : 0;

      send("scroll", { scrollPercent });
    }

    window.addEventListener("click", handleClick);
    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [variantId]);
}
