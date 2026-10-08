import { getAdminLocale } from "./adminLocale";

// Nom d'hôtel en arabe (hotels.name_arabic, migration 034) : quand l'espace
// interne est en arabe, tous les écrans/formulaires qui listent un hôtel
// affichent le nom arabe saisi, avec repli sur le nom d'origine s'il est vide.
// Appliqué directement dans les requêtes SQL (une seule règle, aucun
// composant à modifier un par un).
//
// ⚠️ Les exports PDF/Excel (lib/listGenerators.js) n'utilisent PAS ceci :
// Helvetica n'a pas de glyphes arabes, ils gardent le nom d'origine.

// Langue de l'espace interne pour cette requête. Hors requête (script, test)
// cookies() échoue : repli sur le français, c'est-à-dire le nom d'origine.
export async function adminHotelLocale() {
  try {
    return await getAdminLocale();
  } catch {
    return "fr";
  }
}

// Expression SQL du nom d'affichage de l'hôtel d'alias `alias`.
export function hotelNameSql(alias, locale) {
  return locale === "ar"
    ? `COALESCE(NULLIF(TRIM(${alias}.name_arabic), ''), ${alias}.name)`
    : `${alias}.name`;
}
