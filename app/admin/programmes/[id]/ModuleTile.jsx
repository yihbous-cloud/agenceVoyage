"use client";

export default function ModuleTile({ title, subtitle, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-zinc-200 bg-white p-5 text-left shadow-sm transition hover:border-emerald-300 hover:shadow-md"
    >
      <p className="text-base font-semibold text-zinc-900">{title}</p>
      <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
    </button>
  );
}
