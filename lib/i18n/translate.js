import { publicAr } from "./translations/public.ar";
import { publicEn } from "./translations/public.en";
import { adminAr } from "./translations/admin.ar";
import { adminEn } from "./translations/admin.en";
import { resolveLocale } from "./locales";

// Les textes sources sont les textes FRANÇAIS eux-mêmes (pas de clés
// abstraites) : tr("Devis gratuit") renvoie la traduction dans la langue
// demandée, ou le texte français tel quel pour "fr" et pour toute
// traduction manquante — jamais de clé technique affichée à l'écran.
// Deux portées : "public" (site visiteur) et "admin" (espace interne). La
// portée admin retombe sur la portée publique pour les textes partagés
// (noms de villes, pays, saisons...) — l'inverse n'est pas vrai, pour ne pas
// embarquer les milliers de textes de l'admin dans les pages publiques.
const TABLES = {
  public: { ar: [publicAr], en: [publicEn] },
  admin: { ar: [adminAr, publicAr], en: [adminEn, publicEn] },
};

function getTables(locale, scope) {
  return TABLES[scope]?.[resolveLocale(locale)] || [];
}

// Index insensible à la casse, construit à la demande : les données saisies
// en base ("MASJID NABAWI", "ramadan") retrouvent leur traduction même si la
// casse diffère du texte source du dictionnaire.
const lowerIndexCache = new WeakMap();
function lookup(table, text) {
  if (Object.prototype.hasOwnProperty.call(table, text)) return table[text];
  let index = lowerIndexCache.get(table);
  if (!index) {
    index = new Map();
    for (const key of Object.keys(table)) {
      const lower = key.toLowerCase();
      if (!index.has(lower)) index.set(lower, table[key]);
    }
    lowerIndexCache.set(table, index);
  }
  return index.get(String(text).toLowerCase());
}

// Entrées à variables ("Chevauchement avec {hotel} ({a}) ...") compilées en
// expressions régulières : servent à traduire un texte DÉJÀ assemblé (message
// d'erreur du serveur, texte lu dans le DOM) où les valeurs sont insérées.
const patternCache = new WeakMap();
function getPatterns(table) {
  let list = patternCache.get(table);
  if (list) return list;
  list = [];
  for (const [key, value] of Object.entries(table)) {
    if (typeof value !== "string" || !/\{\w+\}/.test(key)) continue;
    const names = [];
    const source = key
      .split(/(\{\w+\})/)
      .map((part) => {
        const m = /^\{(\w+)\}$/.exec(part);
        if (m) {
          names.push(m[1]);
          return "([\\s\\S]+?)";
        }
        return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      })
      .join("");
    list.push({ regex: new RegExp(`^${source}$`), names, value, literal: key.replace(/\{\w+\}/g, "").length });
  }
  // Motifs les plus spécifiques (plus de texte fixe) essayés en premier : un
  // motif générique comme "{a} · {b} · {c}" ne doit pas capturer un texte
  // qu'un motif plus précis sait traduire.
  list.sort((a, b) => b.literal - a.literal);
  patternCache.set(table, list);
  return list;
}

function matchPattern(tables, text) {
  for (const table of tables) {
    for (const { regex, names, value } of getPatterns(table)) {
      const m = regex.exec(text);
      if (m) {
        return value.replace(/\{(\w+)\}/g, (_, name) => {
          const index = names.indexOf(name);
          if (index < 0) return "";
          // Une valeur capturée peut elle-même être traduisible (statut brut,
          // nom de ville...) : traduction exacte seulement, jamais récursive
          // sur un autre motif.
          const captured = m[index + 1];
          for (const t of tables) {
            const hit = lookup(t, captured);
            if (typeof hit === "string") return hit;
          }
          return captured;
        });
      }
    }
  }
  return undefined;
}

// Une valeur de dictionnaire peut être un objet de formes plurielles
// ({ zero, one, two, few, many, other }, catégories Intl.PluralRules) : l'arabe
// en a six ("مقعد" / "مقعدان" / "مقاعد" / "مقعداً"...). La forme est choisie
// d'après vars.count.
function pickPlural(locale, value, count) {
  const rule = new Intl.PluralRules(locale).select(Number(count));
  return value[rule] ?? value.other ?? "";
}

// Les textes du dictionnaire écrits "Golden Fantastic" sont ceux de l'agence
// historique : pour une autre agence (multi-agences, CLAUDE.md §3sexvicies),
// options.brandName remplace ce nom dans le texte final — sans dupliquer ni
// réécrire les centaines de phrases du dictionnaire.
const DEFAULT_BRAND = "Golden Fantastic";

// Variables : tr("{count} voyageurs", { count: 3 }). Les {accolades} sont
// remplacées APRÈS la traduction, la phrase traduite doit donc les conserver.
export function makeTranslator(locale, scope = "public", options = {}) {
  const resolved = resolveLocale(locale);
  const tables = getTables(resolved, scope);
  const brandName =
    options.brandName && options.brandName !== DEFAULT_BRAND ? options.brandName : null;

  function tr(text, vars) {
    if (text == null || text === "") return text ?? "";
    let found;
    for (const table of tables) {
      found = lookup(table, text);
      if (found !== undefined) break;
    }
    if (found === undefined && !vars && tables.length > 0) {
      found = matchPattern(tables, text);
    }
    let out = found === undefined ? text : found;
    if (out && typeof out === "object") out = pickPlural(resolved, out, vars?.count);
    if (vars) {
      out = out.replace(/\{(\w+)\}/g, (_, key) => (vars[key] != null ? String(vars[key]) : ""));
    }
    return brandName && typeof out === "string" ? out.replaceAll(DEFAULT_BRAND, brandName) : out;
  }

  // Pluriel : le français choisit entre ses deux formes sources (singulier
  // si count === 1), les autres langues lisent la forme plurielle de leur
  // dictionnaire sous la clé de la forme "autre" (ex. "{count} places restantes").
  tr.plural = (frenchOne, frenchOther, count, vars) => {
    const all = { count, ...vars };
    if (resolved === "fr") {
      const text = (count === 1 ? frenchOne : frenchOther).replace(/\{(\w+)\}/g, (_, k) =>
        all[k] != null ? String(all[k]) : ""
      );
      return brandName ? text.replaceAll(DEFAULT_BRAND, brandName) : text;
    }
    return tr(frenchOther, all);
  };

  return tr;
}
