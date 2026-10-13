import { query } from "./db";
import { resolveAgencyId } from "./agencyContext";
import { listTranslations, isTranslationComplete } from "./contentTranslations";
import { programCompleteness } from "./programCompleteness";
import { stripMarkdown } from "./markdown";
import { PRICE_TIER_FIELD } from "./roomTypes";
import { SITE_PAGE_LABELS, termForLocale } from "./editorial";
import { tripArchivedSql } from "./tripArchive";

// Santé SEO (référencement, vague 2C — CLAUDE.md §3centdixneufquadragies) :
// problèmes détectés dans les contenus de l'agence, chacun avec le lien de
// l'écran où le corriger, et indicateurs face aux objectifs du cahier des
// charges (§16, recette contenu). Calculé à la demande depuis la base —
// aucune table, rien d'enregistré.

// Objectifs de la recette contenu du cahier des charges.
export const SEO_TARGETS = { guides: 20, questions: 200, terms: 50, pillarQuestions: 10, faqPerProgram: 5 };

const TITLE_MAX = 60;
const DESCRIPTION_MAX = 155;
const GUIDE_MIN_WORDS = 300;

const sixMonthsAgo = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 6);
  return d.toISOString().slice(0, 10);
};
const dateOnly = (value) => (value ? String(value).slice(0, 10) : null);
const wordCount = (text) => stripMarkdown(text).split(/\s+/).filter(Boolean).length;
const otherLocale = (locale) => (locale === "fr" ? "ar" : "fr");
const placeholders = (list) => list.map(() => "?").join(", ");

// issue : { severity: "erreur" | "avertissement" | "info", subject, message,
// params, href } — message = texte SOURCE français avec des {variables}
// (traduit dans l'admin par tr(message, params)) ; une variable tableau est
// une liste de libellés traduits un à un puis joints.
const issue = (severity, subject, message, params, href) => ({ severity, subject, message, params: params || {}, href });
const MISSING_VERSION = { ar: "Version arabe manquante", fr: "Version française manquante" };
const TITLE_TOO_LONG = {
  ar: "Titre (version arabe) de {length} caractères dans Google ({max} max.) : saisir un « Meta title » plus court",
  fr: "Titre (version française) de {length} caractères dans Google ({max} max.) : saisir un « Meta title » plus court",
};
const NO_DESCRIPTION = {
  ar: "Aucune description pour Google (version arabe) : une description automatique est utilisée",
  fr: "Aucune description pour Google (version française) : une description automatique est utilisée",
};
const DESCRIPTION_TOO_LONG = {
  ar: "Description pour Google (version arabe) de {length} caractères ({max} max.)",
  fr: "Description pour Google (version française) de {length} caractères ({max} max.)",
};

// Longueur du titre de l'onglet tel que le site le produit : meta title
// saisi tel quel, sinon « titre | agence ».
const pageTitleLength = (row, brand) => (row.meta_title ? row.meta_title.length : `${row.title} | ${brand}`.length);

async function programIssues(agencyId, brand) {
  const programs = await query(
    `SELECT id, title, slug, family, program_type, content_locale, meta_title, meta_description,
       itinerary_days, included_items, excluded_items, formalities, formalities_verified_at, booking_conditions
     FROM programs WHERE agency_id = ? AND is_published = TRUE ORDER BY title`,
    [agencyId]
  );
  if (programs.length === 0) return { issues: [], complete: 0, total: 0, programs };
  const ids = programs.map((p) => p.id);
  const ph = placeholders(ids);

  const [trips, tierMins, hotelCounts, faqCounts, mediaCounts, reviewCounts, translations] = await Promise.all([
    // Départs ouverts à venir (mêmes critères que le site public).
    query(
      `SELECT t.id, t.program_id, t.reference_code, t.departure_date, t.return_date, t.airline_id, t.baggage_allowance,
         t.price_double, t.price_triple, t.price_quadruple, t.price_quintuple
       FROM trips t
       WHERE t.agency_id = ? AND t.program_id IN (${ph}) AND t.status IN ('ouvert', 'planifie')
         AND t.departure_date >= CURDATE() AND NOT ${tripArchivedSql("t")}
       ORDER BY t.departure_date ASC`,
      [agencyId, ...ids]
    ),
    query(
      `SELECT tht.trip_id, MIN(p.price_per_person) AS min_price
       FROM trip_hotel_tier_prices p JOIN trip_hotel_tiers tht ON tht.id = p.tier_id AND tht.agency_id = p.agency_id
       WHERE p.agency_id = ? AND p.price_per_person > 0 GROUP BY tht.trip_id`,
      [agencyId]
    ),
    query(`SELECT trip_id, COUNT(*) AS n FROM trip_hotels WHERE agency_id = ? GROUP BY trip_id`, [agencyId]),
    query(
      `SELECT program_id, COUNT(*) AS n FROM program_faqs WHERE agency_id = ? AND is_published = TRUE AND program_id IN (${ph}) GROUP BY program_id`,
      [agencyId, ...ids]
    ),
    query(
      `SELECT program_id, kind, COUNT(*) AS n FROM program_media WHERE agency_id = ? AND program_id IN (${ph}) GROUP BY program_id, kind`,
      [agencyId, ...ids]
    ),
    query(
      `SELECT program_id, COUNT(*) AS n FROM program_reviews
       WHERE agency_id = ? AND is_published = TRUE AND consent_given = TRUE AND program_id IN (${ph}) GROUP BY program_id`,
      [agencyId, ...ids]
    ),
    listTranslations("program", ids, agencyId),
  ]);

  const tierMin = new Map(tierMins.map((r) => [r.trip_id, Number(r.min_price)]));
  const hotelsOf = new Map(hotelCounts.map((r) => [r.trip_id, Number(r.n)]));
  const faqsOf = new Map(faqCounts.map((r) => [r.program_id, Number(r.n)]));
  const reviewsOf = new Map(reviewCounts.map((r) => [r.program_id, Number(r.n)]));
  const mediaOf = (programId, kind) => Number(mediaCounts.find((m) => m.program_id === programId && m.kind === kind)?.n || 0);
  const tripPrice = (trip) => {
    if (tierMin.has(trip.id)) return tierMin.get(trip.id);
    const prices = Object.values(PRICE_TIER_FIELD).map((column) => Number(trip[column])).filter((n) => n > 0);
    return prices.length > 0 ? Math.min(...prices) : 0;
  };

  const issues = [];
  let complete = 0;
  const limit = sixMonthsAgo();
  for (const program of programs) {
    const href = `/admin/programmes/${program.id}`;
    const subject = program.title;
    const programTrips = trips.filter((t) => t.program_id === program.id);
    const next = programTrips[0];

    // Blocs de la fiche (même calcul que l'indicateur de la fiche programme).
    const completeness = programCompleteness({
      program,
      nextTrip: next
        ? {
            departure_date: next.departure_date,
            return_date: next.return_date,
            price: tripPrice(next),
            airline: next.airline_id,
            baggage_allowance: next.baggage_allowance,
            hotelCount: hotelsOf.get(next.id) || 0,
          }
        : null,
      faqCount: faqsOf.get(program.id) || 0,
      photoCount: mediaOf(program.id, "photo"),
      videoCount: mediaOf(program.id, "video"),
      reviewCount: reviewsOf.get(program.id) || 0,
    });
    if (completeness.score === completeness.total) {
      complete += 1;
    } else {
      const missing = completeness.blocks.filter((b) => !b.done).map((b) => b.label);
      issues.push(issue("avertissement", subject, "Fiche : {score}/{total} blocs — à compléter : {blocks}", { score: completeness.score, total: completeness.total, blocks: missing }, href));
    }

    for (const trip of programTrips) {
      if (tripPrice(trip) <= 0) {
        issues.push(issue("erreur", subject, "Départ {ref} : prix à 0 (le site affiche « Prix sur demande »)", { ref: trip.reference_code }, href));
      }
    }
    if (!next) issues.push(issue("info", subject, "Aucun départ ouvert : la fiche affiche « Départ terminé »", null, href));

    // Titre et description, dans chaque langue saisie.
    const principal = program.content_locale || "ar";
    const byLocale = translations[program.id] || {};
    const versions = [[principal, program]];
    const other = byLocale[otherLocale(principal)];
    if (other && isTranslationComplete("program", other)) versions.push([otherLocale(principal), { ...other, title: other.title }]);
    else issues.push(issue("avertissement", subject, MISSING_VERSION[otherLocale(principal)], null, href));
    for (const [locale, row] of versions) {
      const titleLength = pageTitleLength(row, brand);
      if (titleLength > TITLE_MAX) {
        issues.push(issue("avertissement", subject, TITLE_TOO_LONG[locale], { length: titleLength, max: TITLE_MAX }, href));
      }
      const description = String(row.meta_description || "");
      if (!description) {
        issues.push(issue("info", subject, NO_DESCRIPTION[locale], null, href));
      } else if (description.length > DESCRIPTION_MAX) {
        issues.push(issue("avertissement", subject, DESCRIPTION_TOO_LONG[locale], { length: description.length, max: DESCRIPTION_MAX }, href));
      }
    }

    const verified = dateOnly(program.formalities_verified_at);
    if (String(program.formalities || "").trim() && verified && verified < limit) {
      issues.push(issue("avertissement", subject, "Formalités vérifiées le {date} : à revérifier (plus de 6 mois)", { date: verified }, href));
    }
  }
  return { issues, complete, total: programs.length, programs };
}

async function guideIssues(agencyId) {
  const guides = await query(
    `SELECT g.id, g.title, g.content_locale, g.excerpt, g.content, g.author_id, g.reviewer_id, g.is_religious,
       g.reviewed_at, r.is_religious_referent AS reviewer_is_referent
     FROM guides g LEFT JOIN authors r ON r.id = g.reviewer_id AND r.agency_id = g.agency_id
     WHERE g.agency_id = ? AND g.status = 'publie' ORDER BY g.title`,
    [agencyId]
  );
  const translations = await listTranslations("guide", guides.map((g) => g.id), agencyId);
  const issues = [];
  const limit = sixMonthsAgo();
  for (const guide of guides) {
    const href = `/admin/contenus/guides/${guide.id}`;
    const subject = guide.title;
    if (guide.is_religious && (!guide.reviewer_id || !guide.reviewer_is_referent)) {
      issues.push(issue("erreur", subject, "Guide religieux sans relecteur référent religieux", null, href));
    }
    if (!guide.author_id) issues.push(issue("avertissement", subject, "Aucun auteur : l'encadré auteur n'est pas affiché", null, href));
    const reviewed = dateOnly(guide.reviewed_at);
    if (!reviewed) issues.push(issue("avertissement", subject, "Jamais marqué comme relu", null, href));
    else if (reviewed < limit) issues.push(issue("avertissement", subject, "Relu le {date} : à relire (plus de 6 mois)", { date: reviewed }, href));
    const words = wordCount(`${guide.excerpt || ""} ${guide.content || ""}`);
    if (words < GUIDE_MIN_WORDS) {
      issues.push(issue("avertissement", subject, "Texte court : {words} mots ({min} recommandés)", { words, min: GUIDE_MIN_WORDS }, href));
    }
    const other = (translations[guide.id] || {})[otherLocale(guide.content_locale || "ar")];
    if (!isTranslationComplete("guide", other)) {
      issues.push(issue("avertissement", subject, MISSING_VERSION[otherLocale(guide.content_locale || "ar")], null, href));
    }
  }
  return { issues, published: guides.length };
}

// Liste courte pour un message regroupé (5 noms au plus, « … » au-delà).
const sample = (names, max = 5) => (names.length <= max ? names : [...names.slice(0, max), "…"]);

async function contentIssues(agencyId, programs) {
  const [terms, knowledge] = await Promise.all([
    query(
      `SELECT slug, term_fr, term_ar, definition_fr, definition_ar FROM glossary_terms WHERE agency_id = ? AND status = 'publie' ORDER BY slug`,
      [agencyId]
    ),
    query(`SELECT id, question, question_ar, answer_ar, site_page FROM ia_knowledge WHERE agency_id = ? AND status = 'publie'`, [agencyId]),
  ]);
  const issues = [];
  const lexicon = "/admin/contenus/lexique";
  const bank = "/admin/whatsapp/connaissances";

  const TERMS_MISSING = {
    ar: "{count} terme(s) sans version arabe : {names}",
    fr: "{count} terme(s) sans version française : {names}",
  };
  for (const locale of ["ar", "fr"]) {
    const missing = terms.filter((t) => !termForLocale(t, locale)).map((t) => t.term_fr || t.term_ar || t.slug);
    if (missing.length > 0) {
      issues.push(issue("avertissement", "Lexique", TERMS_MISSING[locale], { count: missing.length, names: sample(missing) }, lexicon));
    }
  }
  const noArabic = knowledge.filter((k) => !String(k.answer_ar || "").trim()).map((k) => k.question);
  if (noArabic.length > 0) {
    issues.push(issue("avertissement", "Banque de questions", "{count} question(s) publiée(s) sans réponse en arabe : {names}", { count: noArabic.length, names: sample(noArabic) }, bank));
  }
  const offSite = knowledge.filter((k) => !k.site_page).length;
  if (offSite > 0) {
    issues.push(issue("info", "Banque de questions", "{count} question(s) publiée(s) connue(s) seulement de l'agent WhatsApp : choisir une « Page du site » pour les afficher", { count: offSite }, bank));
  }
  // Piliers qui ont des programmes publiés : 10 questions recommandées.
  const pillarHas = {
    omra: programs.some((p) => p.family === "omra_hajj" && p.program_type !== "hajj"),
    hajj: programs.some((p) => p.family === "omra_hajj" && p.program_type === "hajj"),
    voyages: programs.some((p) => p.family === "voyage_organise"),
  };
  for (const page of ["omra", "hajj", "voyages"]) {
    if (!pillarHas[page]) continue;
    const count = knowledge.filter((k) => k.site_page === page).length;
    if (count < SEO_TARGETS.pillarQuestions) {
      issues.push(issue("avertissement", SITE_PAGE_LABELS[page], "{count} question(s) affichée(s) sur ce pilier ({min} à 15 recommandées)", { count, min: SEO_TARGETS.pillarQuestions }, bank));
    }
  }
  return {
    issues,
    termCount: terms.length,
    siteQuestionCount: knowledge.filter((k) => k.site_page).length,
  };
}

// Programme, guide ou actualité publié derrière un chemin public (sans langue).
async function publishedPaths(agencyId) {
  const [programs, guides, news] = await Promise.all([
    query(`SELECT slug, family, program_type FROM programs WHERE agency_id = ? AND is_published = TRUE`, [agencyId]),
    query(`SELECT slug FROM guides WHERE agency_id = ? AND status = 'publie'`, [agencyId]),
    query(`SELECT slug FROM news_posts WHERE agency_id = ? AND is_published = TRUE`, [agencyId]),
  ]);
  const pillar = (p) => (p.family === "voyage_organise" ? "/voyages-organises" : p.program_type === "hajj" ? "/hajj" : "/omra");
  return new Set([
    ...programs.map((p) => `${pillar(p)}/${p.slug}`),
    ...guides.map((g) => `/guide/${g.slug}`),
    ...news.map((n) => `/actualites/${n.slug}`),
  ]);
}

const CONTENT_PATH = /^\/(omra|hajj|voyages-organises|guide|actualites)\/[^/]+$/;

async function technicalIssues(agencyId) {
  const [failures, redirects, live] = await Promise.all([
    query(
      `SELECT COUNT(*) AS n FROM seo_indexnow_pings
       WHERE agency_id = ? AND status = 'echec' AND created_at >= UTC_TIMESTAMP() - INTERVAL 7 DAY`,
      [agencyId]
    ),
    query(`SELECT from_path, to_path FROM redirects WHERE agency_id = ?`, [agencyId]),
    publishedPaths(agencyId),
  ]);
  const issues = [];
  const n = Number(failures[0]?.n || 0);
  if (n > 0) {
    issues.push(
      issue("avertissement", "IndexNow", "{count} signalement(s) aux moteurs en échec sur 7 jours", { count: n }, "/admin/referencement?onglet=indexation")
    );
  }
  for (const r of redirects) {
    const target = String(r.to_path || "").replace(/\/+$/, "");
    if (CONTENT_PATH.test(target) && !live.has(target)) {
      issues.push(
        issue("avertissement", r.from_path, "Redirige vers {target}, qui n'est pas publié (le visiteur arrive sur une page introuvable)", { target }, "/admin/referencement?onglet=redirections")
      );
    }
  }
  return { issues };
}

export async function getSeoHealth(explicitAgencyId) {
  const agencyId = await resolveAgencyId(explicitAgencyId);
  const [agency] = await query(`SELECT name FROM agencies WHERE id = ?`, [agencyId]);
  const brand = agency?.name || "";
  const programs = await programIssues(agencyId, brand);
  const [guides, contents, technical] = await Promise.all([
    guideIssues(agencyId),
    contentIssues(agencyId, programs.programs),
    technicalIssues(agencyId),
  ]);
  const sections = [
    { key: "programmes", title: "Programmes publiés", issues: programs.issues },
    { key: "guides", title: "Guides publiés", issues: guides.issues },
    { key: "contenus", title: "Lexique et banque de questions", issues: contents.issues },
    { key: "technique", title: "Technique", issues: technical.issues },
  ];
  const counts = { erreur: 0, avertissement: 0, info: 0 };
  for (const section of sections) for (const i of section.issues) counts[i.severity] += 1;
  return {
    counts,
    indicators: [
      { key: "fiches", label: "Fiches complètes (10/10 blocs)", value: programs.complete, target: programs.total },
      { key: "guides", label: "Guides publiés", value: guides.published, target: SEO_TARGETS.guides },
      { key: "questions", label: "Questions affichées sur le site", value: contents.siteQuestionCount, target: SEO_TARGETS.questions },
      { key: "termes", label: "Termes du lexique", value: contents.termCount, target: SEO_TARGETS.terms },
    ],
    sections,
  };
}
