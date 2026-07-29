"use client";

import { useEffect, useRef, useState } from "react";
import { accountSessionEvent } from "@/data/account-sync";
import { BellIcon } from "./icons";

export function NotificationNavButton({ active = false }: { active?: boolean }) {
  const [count, setCount] = useState(0);
  const [arrived, setArrived] = useState(false);
  const countRef = useRef(0);
  const initializedRef = useRef(false);
  const arrivalTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let activeRequest = true;
    const controller = new AbortController();
    const load = () => {
      fetch("/api/notifications?view=count", {
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
      }).then((response) => response.ok ? response.json() : null)
        .then((body: { unreadCount?: number } | null) => {
          if (!activeRequest) return;
          const next = Math.max(0, Math.min(99, Number(body?.unreadCount) || 0));
          if (initializedRef.current && next > countRef.current) {
            setArrived(false);
            window.requestAnimationFrame(() => setArrived(true));
            if (arrivalTimerRef.current) window.clearTimeout(arrivalTimerRef.current);
            arrivalTimerRef.current = window.setTimeout(() => setArrived(false), 700);
          }
          initializedRef.current = true;
          countRef.current = next;
          setCount(next);
        })
        .catch(() => undefined);
    };
    load();
    const accountChanged = () => {
      initializedRef.current = false;
      countRef.current = 0;
      setArrived(false);
      setCount(0);
      load();
    };
    window.addEventListener(accountSessionEvent, accountChanged);
    window.addEventListener("unlocked:notifications-updated", load);
    return () => {
      activeRequest = false;
      controller.abort();
      if (arrivalTimerRef.current) window.clearTimeout(arrivalTimerRef.current);
      window.removeEventListener(accountSessionEvent, accountChanged);
      window.removeEventListener("unlocked:notifications-updated", load);
    };
  }, []);

  const label = count ? `Notifications, ${count > 9 ? "9 or more" : count} unread` : "Notifications";
  return <a
    href="/notifications"
    aria-label={label}
    data-notification-arrived={arrived ? "true" : undefined}
    className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-full transition duration-200 active:scale-[.98] ${active ? "bg-white text-forest shadow-[0_8px_20px_rgba(43,33,26,.08)]" : "text-ink/45 hover:bg-white/75 hover:text-forest"}`}
  >
    <BellIcon className="h-5 w-5" />
    {count ? <span className="absolute right-1.5 top-1.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-forest px-1 text-[9px] font-bold leading-4 text-white" aria-hidden="true">{count > 9 ? "9+" : count}</span> : null}
  </a>;
}
