// Graphique en barres en CSS pur (aucune bibliothèque) — composant serveur.
// series : [{ label, value, value2? }] ; value2 = seconde série empilée.
export default function Bars({ series, height = 140, color = "var(--gf-accent, #0f6b4b)", color2 = "#c9a24a", legend = null, labelEvery = 1 }) {
  const max = Math.max(1, ...series.map((s) => Number(s.value || 0) + Number(s.value2 || 0)));
  return (
    <div>
      <div className="flex items-end gap-[3px]" style={{ height }} dir="ltr">
        {series.map((s, i) => {
          const v1 = Number(s.value || 0);
          const v2 = Number(s.value2 || 0);
          return (
            <div key={i} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${s.label} : ${v1}${s.value2 != null ? ` / ${v2}` : ""}`}>
              {v2 > 0 && <div style={{ height: `${(v2 / max) * 100}%`, background: color2, borderRadius: "3px 3px 0 0" }} />}
              <div style={{ height: `${(v1 / max) * 100}%`, background: color, borderRadius: v2 > 0 ? 0 : "3px 3px 0 0", minHeight: v1 > 0 ? 2 : 0 }} />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-[3px] text-[10px] text-zinc-500" dir="ltr">
        {series.map((s, i) => (
          <div key={i} className="min-w-0 flex-1 truncate text-center" translate="no">
            {i % labelEvery === 0 ? s.label : ""}
          </div>
        ))}
      </div>
      {legend && <div className="mt-2 flex flex-wrap gap-4 text-xs text-zinc-600">{legend}</div>}
    </div>
  );
}
