"use client";

import { useAdminLocale } from "@/app/admin/_components/AdminLocale";

// Complétude de la fiche publique (10 blocs du cahier référencement, vague
// 2A — lib/programCompleteness.js). Les blocs manquants sont listés avec le
// conseil pour les compléter.
export default function CompletenessPanel({ completeness }) {
  const { tr } = useAdminLocale();
  const { score, total, blocks } = completeness;
  const missing = blocks.filter((b) => !b.done);
  const percent = Math.round((score / total) * 100);
  const tone = score === total ? "bg-emerald-600" : score >= 7 ? "bg-amber-500" : "bg-red-500";

  return (
    <details className="mb-4 rounded-xl border border-zinc-200 bg-white p-4" open={missing.length > 0 && missing.length <= 3}>
      <summary className="flex cursor-pointer flex-wrap items-center gap-3 text-sm">
        <span className="font-medium text-zinc-900">
          {tr("Fiche publique : {score}/{total} blocs", { score, total })}
        </span>
        <span className="h-2 w-40 overflow-hidden rounded-full bg-zinc-100" aria-hidden="true">
          <span className={`block h-full ${tone}`} style={{ width: `${percent}%` }} />
        </span>
        {missing.length === 0 ? (
          <span className="text-xs text-emerald-700">Fiche complète</span>
        ) : (
          <span className="text-xs text-zinc-500">Voir ce qui manque</span>
        )}
      </summary>
      {missing.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-sm">
          {missing.map((block) => (
            <li key={block.key} className="flex flex-wrap gap-x-2">
              <span className="font-medium text-zinc-800">{block.label}</span>
              {block.hint && <span className="text-zinc-500">{block.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
