import { query } from "./db";
import { resolveAgencyId, assertOwned } from "./agencyContext";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from "./i18n/locales";

// Contenu FR/AR par entité (référencement, CLAUDE.md §3centquinzequadragies,
// migration 045). Les colonnes d'origine d'une entité sont dans sa LANGUE
// PRINCIPALE (content_locale ; les FAQ suivent leur programme) ; l'autre
// langue est dans une table *_translations. Le slug est commun aux langues.
//
//   - setTranslations : écrit les traductions envoyées par un formulaire
//     admin (une ligne vide = supprimée). À n'appeler QUE si le payload
//     contient `translations` : les mises à jour qui ne l'envoient pas (ex.
//     bascule actif/inactif d'une diapositive) ne touchent à rien.
//   - applyTranslations : remplace, sur des lignes lues pour le site public,
//     les champs par leur version dans la langue de la page quand elle
//     existe, et ajoute `available_locales` (langues réellement disponibles :
//     la principale + les traductions complètes) — base des balises canonical
//     et hreflang (lib/i18n/seo.js pageAlternates).

export const TRANSLATABLE = {
  program: {
    table: "program_translations",
    key: "program_id",
    parent: "programs",
    fields: {
      title: "title",
      shortDescription: "short_description",
      fullDescription: "full_description",
      metaTitle: "meta_title",
      metaDescription: "meta_description",
    },
    // Traduction « complète » : titre + au moins une description.
    required: ["title"],
    anyOf: ["short_description", "full_description"],
  },
  faq: {
    table: "program_faq_translations",
    key: "faq_id",
    parent: "program_faqs",
    fields: { question: "question", answer: "answer" },
    required: ["question", "answer"],
    anyOf: [],
  },
  news: {
    table: "news_translations",
    key: "news_id",
    parent: "news_posts",
    fields: {
      title: "title",
      excerpt: "excerpt",
      content: "content",
      metaTitle: "meta_title",
      metaDescription: "meta_description",
    },
    required: ["title"],
    anyOf: ["excerpt", "content"],
  },
  slide: {
    table: "slide_translations",
    key: "slide_id",
    parent: "slides",
    fields: { title: "title", subtitle: "subtitle", buttonText: "button_text" },
    required: [],
    anyOf: ["title", "subtitle"],
  },
};

const clean = (value) => {
  const text = value == null ? "" : String(value).trim();
  return text === "" ? null : text;
};

// Langue dont on cherche la traduction pour une page : l'anglais (hors
// index jusqu'à la phase 2) affiche la version française quand elle existe.
export function lookupLocale(locale) {
  return locale === "en" ? "fr" : locale;
}

export function isTranslationComplete(entity, row) {
  const config = TRANSLATABLE[entity];
  if (!row) return false;
  const hasValue = (column) => clean(row[column]) !== null;
  return config.required.every(hasValue) && (config.anyOf.length === 0 || config.anyOf.some(hasValue));
}

// translations : { fr: { title, shortDescription, ... }, ar: {...} } (clés
// camelCase du formulaire). La langue principale (baseLocale) est ignorée :
// son contenu est dans les colonnes d'origine.
export async function setTranslations(entity, id, translations, { baseLocale } = {}, explicitAgencyId) {
  const config = TRANSLATABLE[entity];
  if (!config) throw new Error(`Entité non traduisible : ${entity}`);
  if (!translations || typeof translations !== "object") return;
  const agencyId = await resolveAgencyId(explicitAgencyId);
  await assertOwned(config.parent, id, agencyId);

  // Lignes existantes : on n'écrit que ce qui change (sinon la date de mise à
  // jour du contenu bougerait à chaque enregistrement du formulaire).
  const existingRows = await query(
    `SELECT * FROM ${config.table} WHERE ${config.key} = ? AND agency_id = ?`,
    [id, agencyId]
  );
  const existing = Object.fromEntries(existingRows.map((row) => [row.locale, row]));
  let changed = 0;
  const remove = async (locale) => {
    await query(`DELETE FROM ${config.table} WHERE ${config.key} = ? AND locale = ? AND agency_id = ?`, [id, locale, agencyId]);
    changed += 1;
  };

  // Langue principale changée (ex. arabe → français) : une ancienne
  // traduction dans la nouvelle langue principale n'a plus lieu d'être.
  if (baseLocale && existing[baseLocale]) await remove(baseLocale);

  for (const [locale, values] of Object.entries(translations)) {
    if (!SUPPORTED_LOCALES.includes(locale) || locale === baseLocale) continue;
    const columns = Object.entries(config.fields).map(([camel, column]) => [column, clean(values?.[camel])]);
    if (columns.every(([, value]) => value === null)) {
      if (existing[locale]) await remove(locale);
      continue;
    }
    const current = existing[locale];
    if (current && columns.every(([column, value]) => clean(current[column]) === value)) continue;
    const names = columns.map(([column]) => column);
    await query(
      `INSERT INTO ${config.table} (agency_id, ${config.key}, locale, ${names.join(", ")})
       VALUES (?, ?, ?, ${names.map(() => "?").join(", ")})
       ON DUPLICATE KEY UPDATE ${names.map((n) => `${n} = VALUES(${n})`).join(", ")}`,
      [agencyId, id, locale, ...columns.map(([, value]) => value)]
    );
    changed += 1;
  }

  // Une traduction modifiée change la page publique : date de mise à jour
  // du contenu (lastmod du sitemap). Les FAQ datent leur programme.
  if (changed > 0) {
    if (entity === "faq") {
      await query(
        `UPDATE programs p JOIN program_faqs f ON f.program_id = p.id AND f.agency_id = p.agency_id
         SET p.updated_at = CURRENT_TIMESTAMP WHERE f.id = ? AND p.agency_id = ?`,
        [id, agencyId]
      );
    } else {
      await query(`UPDATE ${config.parent} SET updated_at = CURRENT_TIMESTAMP WHERE id = ? AND agency_id = ?`, [id, agencyId]);
    }
  }
}

// { [id]: { [locale]: ligne } } pour une liste d'entités.
export async function listTranslations(entity, ids, explicitAgencyId) {
  const config = TRANSLATABLE[entity];
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const unique = [...new Set((ids || []).filter(Boolean).map(Number))];
  if (unique.length === 0) return {};
  const placeholders = unique.map(() => "?").join(", ");
  const rows = await query(
    `SELECT * FROM ${config.table} WHERE ${config.key} IN (${placeholders}) AND agency_id = ?`,
    [...unique, agencyId]
  );
  const byId = {};
  for (const row of rows) {
    byId[row[config.key]] = byId[row[config.key]] || {};
    byId[row[config.key]][row.locale] = row;
  }
  return byId;
}

// Version « formulaire » (clés camelCase) des traductions d'une entité, pour
// pré-remplir l'admin : { fr: { title: "...", ... } }.
export function toFormValues(entity, byLocale) {
  const config = TRANSLATABLE[entity];
  const result = {};
  for (const [locale, row] of Object.entries(byLocale || {})) {
    result[locale] = Object.fromEntries(
      Object.entries(config.fields).map(([camel, column]) => [camel, row[column] || ""])
    );
  }
  return result;
}

// Lignes lues pour une page publique dans `locale` : champs traduits quand
// une traduction existe pour cette langue, `available_locales` ajouté.
// `baseLocale` : langue principale quand la ligne n'en porte pas (FAQ →
// langue de son programme). Renvoie de NOUVEAUX objets.
export async function applyTranslations(entity, rows, locale, explicitAgencyId, { baseLocale, idKey = "id" } = {}) {
  if (!rows || rows.length === 0) return rows || [];
  const config = TRANSLATABLE[entity];
  const byId = await listTranslations(entity, rows.map((row) => row[idKey]), explicitAgencyId);
  const wanted = lookupLocale(locale);

  return rows.map((row) => {
    const principal = row.content_locale || baseLocale || DEFAULT_LOCALE;
    const translations = byId[row[idKey]] || {};
    const available = [
      principal,
      ...Object.entries(translations)
        .filter(([l, tr]) => l !== principal && isTranslationComplete(entity, tr))
        .map(([l]) => l),
    ];
    const merged = { ...row, content_locale: principal, available_locales: available, display_locale: principal };
    const translation = wanted !== principal ? translations[wanted] : null;
    if (translation) {
      for (const column of Object.values(config.fields)) {
        const value = clean(translation[column]);
        if (value !== null) merged[column] = value;
      }
      if (isTranslationComplete(entity, translation)) merged.display_locale = wanted;
    }
    return merged;
  });
}

export async function applyTranslation(entity, row, locale, explicitAgencyId, options) {
  if (!row) return row;
  const [translated] = await applyTranslations(entity, [row], locale, explicitAgencyId, options);
  return translated;
}

// Langues complètes par entité (admin : badges AR ✓ / FR —).
export async function translationStatus(entity, rows, explicitAgencyId) {
  const byId = await listTranslations(entity, rows.map((row) => row.id), explicitAgencyId);
  return Object.fromEntries(
    rows.map((row) => {
      const principal = row.content_locale || DEFAULT_LOCALE;
      const complete = new Set([principal]);
      for (const [locale, tr] of Object.entries(byId[row.id] || {})) {
        if (isTranslationComplete(entity, tr)) complete.add(locale);
      }
      return [row.id, [...complete]];
    })
  );
}
