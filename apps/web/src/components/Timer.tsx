"use client";

import { useEffect, useState } from "react";

/**
 * Renders a countdown to an absolute server-issued deadline. The remaining
 * time is recomputed from `phaseEndsAt` every tick rather than decremented
 * locally, so client clock drift or a slow tab can never desync the
 * displayed time from the server's authoritative phase end (blueprint §7).
 */
export function Timer({ phaseEndsAt, label }: { phaseEndsAt: string | null; label: string }) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!phaseEndsAt) {
      setRemaining(null);
      return;
    }
    const deadline = new Date(phaseEndsAt).getTime();
    const update = () => setRemaining(Math.max(0, Math.round((deadline - Date.now()) / 1000)));
    update();
    const interval = setInterval(update, 250);
    return () => clearInterval(interval);
  }, [phaseEndsAt]);

  const display = remaining === null ? "∞" : `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;
  const urgent = remaining !== null && remaining <= 10;

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="font-mono text-[11px] uppercase tracking-wide text-ink-muted">{label}</span>
      <span className={`font-mono text-3xl font-variant-tabular ${urgent ? "text-danger" : "text-ink"}`}>{display}</span>
    </div>
  );
}
