// Programme jour par jour d'une fiche voyage (vague 2A, CLAUDE.md
// §3centdixseptquadragies) : [{ title, description }]. Fichier PUR —
// importable par un composant client (éditeur de l'admin) comme par le
// serveur (lib/contentTranslations.js, lib/programsAdmin.js).

const clean = (value) => {
  const text = value == null ? "" : String(value).trim();
  return text === "" ? null : text;
};

// Jours sans entrée vide, ou null. Accepte le JSON en texte (selon la
// version de mysql2) ou un tableau.
export function normalizeDays(value) {
  let list = value;
  if (typeof list === "string") {
    try {
      list = JSON.parse(list);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(list)) return null;
  const days = list
    .map((day) => ({ title: clean(day?.title) || "", description: clean(day?.description) || "" }))
    .filter((day) => day.title || day.description);
  return days.length > 0 ? days : null;
}

// Texte « un élément par ligne » → liste (inclus / non inclus).
export function linesToList(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*•]\s*/, "").trim())
    .filter(Boolean);
}
