"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";

// Filtre de période (jours locaux) des écrans de pilotage WhatsApp, avec
// raccourcis. Met à jour ?from=&to= sur la page courante.
export default function WaPeriodFilter({ from, to, today }) {
  const router = useRouter();
  const pathname = usePathname();
  const [start, setStart] = useState(from);
  const [end, setEnd] = useState(to);

  const go = (f, t) => router.push(`${pathname}?from=${f}&to=${t}`);
  const shift = (days) => {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - days);
    return d.toISOString().slice(0, 10);
  };

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        go(start, end);
      }}
    >
      <div className="gf-segmented">
        <button type="button" onClick={() => go(today, today)}>
          Aujourd&apos;hui
        </button>
        <button type="button" onClick={() => go(shift(6), today)}>
          7 jours
        </button>
        <button type="button" onClick={() => go(shift(29), today)}>
          30 jours
        </button>
      </div>
      <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="rounded-lg border px-2 py-1 text-sm" />
      <span className="text-sm text-zinc-500">→</span>
      <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="rounded-lg border px-2 py-1 text-sm" />
      <button type="submit" className="gf-btn-outline">
        Filtrer
      </button>
    </form>
  );
}
