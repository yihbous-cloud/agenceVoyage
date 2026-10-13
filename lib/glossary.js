import { query } from "./db";
import { resolveAgencyId, assertOwned } from "./agencyContext";
import { GUIDE_PILLARS, editorialSlug, termForLocale } from "./editorial";

// Lexique bilingue (référencement, vague 2B — CLAUDE.md
// §3centdixhuitquadragies), publié sous /guide/lexique. Textes courts : les
// deux langues sont dans la même ligne ; un terme n'apparaît que dans les
// langues où il a un nom ET une définition.

const validationError = (message) => Object.assign(new Error(message), { code: "VALIDATION" });

const text = (value, max) => {
  const v = value == null ? "" : String(value).trim();
  return v === "" ? null : max ? v.slice(0, max) : v;
};

// Public (page statique : agence explicite). Termes publiés dans la langue
// de la page, triés alphabétiquement dans cette langue.
export async function listPublishedTerms(explicitAgencyId, locale) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const rows = await query(
    `SELECT slug, term_fr, term_ar, definition_fr, definition_ar, pillar, updated_at
     FROM glossary_terms WHERE agency_id = ? AND status = 'publie'`,
    [agencyId]
  );
  const collator = new Intl.Collator(locale === "ar" ? "ar" : "fr", { sensitivity: "base" });
  return rows
    .map((row) => termForLocale(row, locale))
    .filter(Boolean)
    .sort((a, b) => collator.compare(a.name, b.name));
}

// Langues dans lesquelles le lexique publié a au moins un terme complet, et
// date de sa dernière modification (hub, sitemap, hreflang).
export async function glossaryInfo(explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const rows = await query(
    `SELECT term_fr, term_ar, definition_fr, definition_ar, updated_at
     FROM glossary_terms WHERE agency_id = ? AND status = 'publie'`,
    [agencyId]
  );
  const locales = ["ar", "fr"].filter((locale) => rows.some((row) => termForLocale(row, locale)));
  const lastModified = rows.reduce((max, row) => (!max || row.updated_at > max ? row.updated_at : max), null);
  return { locales, lastModified };
}

export async function glossaryLocales(explicitAgencyId) {
  return (await glossaryInfo(explicitAgencyId)).locales;
}

export async function listAllTerms() {
  const agencyId = await resolveAgencyId();
  return query(`SELECT * FROM glossary_terms WHERE agency_id = ? ORDER BY COALESCE(term_fr, term_ar) ASC`, [agencyId]);
}

function normalizeTerm(data) {
  const term = {
    term_fr: text(data.termFr, 150),
    term_ar: text(data.termAr, 150),
    definition_fr: text(data.definitionFr, 3000),
    definition_ar: text(data.definitionAr, 3000),
  };
  const frComplete = term.term_fr && term.definition_fr;
  const arComplete = term.term_ar && term.definition_ar;
  if (!term.term_fr && !term.term_ar) throw validationError("Saisissez le terme en français ou en arabe.");
  const status = data.status === "publie" ? "publie" : "brouillon";
  if (status === "publie" && !frComplete && !arComplete) {
    throw validationError("Un terme publié doit avoir un nom et une définition dans au moins une langue.");
  }
  const slug = editorialSlug(data.slug, term.term_fr);
  if (!slug) throw validationError("Saisissez un slug (lettres latines, chiffres et tirets) : il sert d'ancre dans la page du lexique.");
  return { ...term, slug, status, pillar: GUIDE_PILLARS.includes(data.pillar) ? data.pillar : "general" };
}

const COLUMNS = ["slug", "term_fr", "term_ar", "definition_fr", "definition_ar", "pillar", "status"];
const INSERT_COLUMNS = COLUMNS.join(", ");
const INSERT_VALUES = COLUMNS.map(() => "?").join(", ");
const UPDATE_SET = COLUMNS.map((c) => c + " = ?").join(", ");

export async function createTerm(data) {
  const agencyId = await resolveAgencyId();
  const t = normalizeTerm(data);
  const result = await query(
    `INSERT INTO glossary_terms (agency_id, ${INSERT_COLUMNS}) VALUES (?, ${INSERT_VALUES})`,
    [agencyId, ...COLUMNS.map((c) => t[c])]
  );
  return result.insertId;
}

export async function updateTerm(id, data) {
  const agencyId = await resolveAgencyId();
  await assertOwned("glossary_terms", id, agencyId);
  const t = normalizeTerm(data);
  await query(
    `UPDATE glossary_terms SET ${UPDATE_SET} WHERE id = ? AND agency_id = ?`,
    [...COLUMNS.map((c) => t[c]), id, agencyId]
  );
}

export async function deleteTerm(id) {
  const agencyId = await resolveAgencyId();
  await assertOwned("glossary_terms", id, agencyId);
  await query(`DELETE FROM glossary_terms WHERE id = ? AND agency_id = ?`, [id, agencyId]);
}
