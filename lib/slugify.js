// Fonction pure (aucune dépendance DB) — extraite de lib/programsAdmin.js
// pour rester importable depuis des fichiers utilisés côté client (ex.
// lib/airports.js) sans entraîner toute la chaîne mysql2 dans le bundle
// navigateur (voir CLAUDE.md).
export function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
