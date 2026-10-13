// Bloc d'une page légale générée (mentions légales, confidentialité) :
// rows = [[libellé, valeur], ...] — une ligne sans valeur est omise, et le
// bloc entier disparaît si aucune ligne n'a de valeur (aucune information
// inventée). Un libellé null affiche la valeur seule. Composant serveur.
export function LegalSection({ title, rows }) {
  const filled = (rows || []).filter((row) => row && String(row[1] ?? "").trim());
  if (filled.length === 0) return null;
  return (
    <section>
      <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
      <div className="mt-2 space-y-1">
        {filled.map(([label, value], index) => (
          <p key={label || index} className="whitespace-pre-line">
            {label && <span className="font-medium text-zinc-800">{label} : </span>}
            <bdi>{value}</bdi>
          </p>
        ))}
      </div>
    </section>
  );
}
