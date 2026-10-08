// Vérifie la couverture des traductions : extrait chaque tr("texte français")
// du code et signale les textes absents des dictionnaires (ar/en).
// Usage : node scripts/i18n-check.mjs [public|admin] [--list]
//   --list : n'imprime que les textes manquants (un par ligne, JSON)
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const scope = process.argv[2] === "admin" ? "admin" : "public";
const listOnly = process.argv.includes("--list");
const ROOTS =
  scope === "public"
    ? ["app/(site)", "app/_components", "app/sitemap.js", "app/feed.xml", "lib/i18n/seo.js"]
    : ["app/admin"];

function walk(target, out = []) {
  if (!fs.existsSync(target)) return out;
  const stat = fs.statSync(target);
  if (stat.isFile()) {
    if (/\.(js|jsx)$/.test(target)) out.push(target);
    return out;
  }
  for (const name of fs.readdirSync(target)) walk(path.join(target, name), out);
  return out;
}

const BACKSLASH = String.fromCharCode(92);
const CALL = new RegExp(
  "\\btr\\(\\s*([\"'`])((?:" + BACKSLASH + BACKSLASH + ".|(?!" + BACKSLASH + "1)[^" + BACKSLASH + BACKSLASH + "])*)" + BACKSLASH + "1",
  "gs"
);

const keys = new Map();
for (const root of ROOTS) {
  for (const file of walk(root)) {
    const src = fs.readFileSync(file, "utf8");
    for (const m of src.matchAll(CALL)) {
      let text = m[2];
      text = text.split(BACKSLASH + m[1]).join(m[1]);
      if (m[1] === "`" && text.includes("${")) continue;
      if (!keys.has(text)) keys.set(text, file);
    }
  }
}

const load = async (name, exportName) => {
  const mod = await import(pathToFileURL(path.resolve(`lib/i18n/translations/${name}.js`)).href);
  return mod[exportName];
};
const ar = await load(`${scope}.ar`, `${scope}Ar`);
const en = await load(`${scope}.en`, `${scope}En`);

let missing = 0;
for (const [text, file] of keys) {
  const lacks = [];
  if (!(text in ar)) lacks.push("ar");
  if (!(text in en)) lacks.push("en");
  if (lacks.length) {
    missing += 1;
    console.log(listOnly ? JSON.stringify(text) : `[${lacks.join(",")}] ${JSON.stringify(text)}   (${file})`);
  }
}
if (!listOnly) {
  console.log(`\n${keys.size} textes dans le code, ${missing} sans traduction complète.`);
}
