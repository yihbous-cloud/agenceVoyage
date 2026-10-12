// Langue RÉELLE d'un contenu saisi en base (programme, actualité) — garde-fou
// provisoire du référencement global (CLAUDE.md §3centtreizequadragies) :
// tant que ces contenus n'existent qu'en une seule langue (traductions par
// entité = lot L1), les pages /fr et / affichent le même texte. On repère la
// langue dominante (lettres arabes vs latines) pour pointer la balise
// canonical de toutes les versions vers celle-ci, sans hreflang : Google les
// traite alors comme un seul contenu au lieu de doublons.
// Fichier pur.

// Sous ce nombre de lettres, le contenu est jugé trop court pour décider (la
// page est alors surtout faite de textes d'interface, réellement traduits).
const MIN_LETTERS = 80;

// "ar" | "fr" | null (indéterminé).
export function detectContentLocale(...texts) {
  const text = texts.filter(Boolean).join(" ");
  const arabic = (text.match(/[؀-ۿݐ-ݿࢠ-ࣿ]/g) || []).length;
  const latin = (text.match(/[A-Za-zÀ-ÖØ-öø-ÿ]/g) || []).length;
  if (arabic + latin < MIN_LETTERS) return null;
  return arabic >= latin ? "ar" : "fr";
}

// Mêmes champs partout (page, sitemap) : sinon la page et le sitemap
// pourraient conclure à deux langues différentes pour le même contenu.
export function programContentLocale(program) {
  return detectContentLocale(program?.title, program?.short_description);
}

export function newsContentLocale(post) {
  return detectContentLocale(post?.title, post?.excerpt);
}
