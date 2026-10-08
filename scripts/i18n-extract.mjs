// Extrait les textes d'interface français candidats à la traduction.
// Usage : node scripts/i18n-extract.mjs <dossier|fichier>... > candidats.json
// Sortie : JSON { "texte": nombre d'occurrences } trié par texte.
// Heuristique volontairement large (on triera à la main) : textes JSX,
// attributs d'affichage (placeholder, title, aria-label, alt, label),
// chaînes "ressemblant à du texte" ailleurs dans le code, messages d'erreur.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;

const SKIP_ATTRS = new Set([
  "className", "href", "key", "type", "name", "id", "htmlFor", "value", "defaultValue",
  "src", "method", "rel", "target", "role", "style", "accept", "autoComplete", "inputMode",
  "pattern", "step", "min", "max", "list", "ref", "as", "sizes", "d", "viewBox", "fill",
  "stroke", "strokeWidth", "strokeLinecap", "strokeLinejoin", "xmlns", "data-testid",
  "action", "encType", "lang", "dir", "width", "height", "points", "cx", "cy", "r",
  "transform", "preserveAspectRatio", "tabIndex", "colSpan", "rowSpan", "cols", "rows",
  "maxLength", "minLength",
]);

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

function looksLikeText(text) {
  const t = text.trim();
  if (t.length < 2) return false;
  if (!/\p{L}/u.test(t)) return false;
  // identifiants, classes, chemins, urls, mime types, clés techniques
  if (/^[\w\-./:#?=&%+@\[\]()*,$]+$/.test(t) && !/[À-ÿ]/.test(t)) {
    // un mot unique commençant par une majuscule est probablement du texte ("Statut")
    return /^[A-ZÀ-Ý][a-zà-ÿ']+$/.test(t) || /^[A-Z]{2,}$/.test(t) === false && /^[A-ZÀ-Ý][a-zà-ÿ]+(\s|$)/.test(t);
  }
  if (/^(https?:|\/|\.\/|@\/|\$\{)/.test(t)) return false;
  if (/\b(px|py|mt|mb|ml|mr|bg|text|border|flex|grid|rounded|w|h)-[\w/\[\]]+/.test(t) && !/[À-ÿ]/.test(t)) return false;
  return true;
}

const counts = new Map();
const add = (text) => {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!looksLikeText(clean)) return;
  counts.set(clean, (counts.get(clean) || 0) + 1);
};

for (const root of process.argv.slice(2)) {
  for (const file of walk(root)) {
    const src = fs.readFileSync(file, "utf8");
    let ast;
    try {
      ast = parser.parse(src, { sourceType: "module", plugins: ["jsx"] });
    } catch (e) {
      console.error(`PARSE ERROR ${file}: ${e.message}`);
      continue;
    }
    traverse(ast, {
      JSXText(p) {
        add(p.node.value);
      },
      StringLiteral(p) {
        const parent = p.parent;
        if (parent.type === "ImportDeclaration" || parent.type === "ExportNamedDeclaration" || parent.type === "ExportAllDeclaration") return;
        if (parent.type === "JSXAttribute") {
          if (SKIP_ATTRS.has(parent.name.name)) return;
          add(p.node.value);
          return;
        }
        if (parent.type === "ObjectProperty" && parent.key === p.node && !parent.computed) return;
        if (parent.type === "MemberExpression" && parent.property === p.node) return;
        if (parent.type === "CallExpression" && parent.callee === p.node) return;
        // fetch("/api/...") et autres premiers arguments d'URL
        if (parent.type === "CallExpression" && /^(fetch|useRouter|push|replace|redirect)$/.test(parent.callee.name || parent.callee.property?.name || "")) return;
        if (parent.type === "JSXExpressionContainer" && p.parent && p.parentPath.parent?.type === "JSXAttribute" && SKIP_ATTRS.has(p.parentPath.parent.name.name)) return;
        add(p.node.value);
      },
      TemplateLiteral(p) {
        if (p.node.expressions.length === 0 && p.node.quasis.length === 1) {
          const parent = p.parent;
          if (parent.type === "JSXExpressionContainer" && p.parentPath.parent?.type === "JSXAttribute" && SKIP_ATTRS.has(p.parentPath.parent.name.name)) return;
          add(p.node.quasis[0].value.cooked || "");
        } else {
          // fragments de texte statiques d'un gabarit (ex. `${n} voyageurs`)
          for (const q of p.node.quasis) add(q.value.cooked || "");
        }
      },
    });
  }
}

const sorted = Object.fromEntries([...counts.entries()].sort((a, b) => a[0].localeCompare(b[0], "fr")));
console.log(JSON.stringify(sorted, null, 1));
console.error(`${counts.size} textes candidats`);
