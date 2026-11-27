"use client";
import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
export function RefreshControl() {
  const router = useRouter();
  const [pending, start] = useTransition();
  useEffect(() => {
    const refresh = () => router.refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [router]);
  return (
    <button
      className="refresh"
      disabled={pending}
      onClick={() => start(() => router.refresh())}
    >
      {pending ? "Refreshing…" : "↻ Refresh"}
    </button>
  );
}
