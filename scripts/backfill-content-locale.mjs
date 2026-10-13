import { getPool } from "../lib/db.js";
import { detectContentLocale } from "../lib/i18n/contentLocale.js";

// Remplissage initial de content_locale (référencement, vague 1B — CLAUDE.md
// §3centquinzequadragies, migration 045). La migration met toutes les lignes
// en arabe ; ce script repasse en français les contenus saisis en français
// (lettres latines majoritaires sur au moins 80 lettres). Contenu trop court
// pour décider : l'arabe est conservé.
//
// Ne touche qu'aux lignes encore en arabe SANS aucune traduction saisie (une
// ligne déjà retouchée dans l'admin n'est jamais modifiée). Toutes agences.
//
//   node --env-file=.env --import ./scripts/esm-register.mjs scripts/backfill-content-locale.mjs           (simulation)
//   node --env-file=.env --import ./scripts/esm-register.mjs scripts/backfill-content-locale.mjs --apply   (écriture)
const APPLY = process.argv.includes("--apply");

const ENTITIES = [
  {
    label: "Programmes",
    table: "programs",
    translations: "program_translations",
    foreignKey: "program_id",
    texts: ["title", "short_description", "full_description"],
  },
  {
    label: "Actualités",
    table: "news_posts",
    translations: "news_translations",
    foreignKey: "news_id",
    texts: ["title", "excerpt", "content"],
  },
  {
    label: "Diapositives",
    table: "slides",
    translations: "slide_translations",
    foreignKey: "slide_id",
    texts: ["title", "subtitle"],
  },
];

const pool = getPool();
const q = async (sql, params = []) => (await pool.query(sql, params))[0];

let changed = 0;
try {
  for (const entity of ENTITIES) {
    const rows = await q(
      `SELECT e.id, e.agency_id, ${entity.texts.map((c) => `e.${c}`).join(", ")}
       FROM ${entity.table} e
       WHERE e.content_locale = 'ar'
         AND NOT EXISTS (SELECT 1 FROM ${entity.translations} t WHERE t.${entity.foreignKey} = e.id)`
    );
    const toFrench = rows.filter((row) => detectContentLocale(...entity.texts.map((c) => row[c])) === "fr");
    console.log(`${entity.label} : ${rows.length} à examiner, ${toFrench.length} en français`);
    for (const row of toFrench) {
      console.log(`  - #${row.id} (agence ${row.agency_id}) ${String(row.title || "").slice(0, 60)}`);
      if (APPLY) {
        await q(`UPDATE ${entity.table} SET content_locale = 'fr' WHERE id = ? AND agency_id = ?`, [row.id, row.agency_id]);
      }
    }
    changed += toFrench.length;
  }
  console.log(
    APPLY
      ? `${changed} ligne(s) passée(s) en français.`
      : `Simulation : ${changed} ligne(s) seraient passées en français (relancer avec --apply).`
  );
} finally {
  await pool.end();
}
