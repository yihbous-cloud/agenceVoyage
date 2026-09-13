"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function PeriodFilter({ start, end }) {
  const router = useRouter();
  const [startDate, setStartDate] = useState(start);
  const [endDate, setEndDate] = useState(end);

  const handleSubmit = (e) => {
    e.preventDefault();
    router.push(`/admin/finances?start=${startDate}&end=${endDate}`);
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2">
      <input
        type="date"
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
        className="rounded-lg border border-zinc-300 px-2 py-1 text-sm"
      />
      <span className="text-sm text-zinc-500">→</span>
      <input
        type="date"
        value={endDate}
        onChange={(e) => setEndDate(e.target.value)}
        className="rounded-lg border border-zinc-300 px-2 py-1 text-sm"
      />
      <button
        type="submit"
        className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800"
      >
        Filtrer
      </button>
    </form>
  );
}
