// Liste les gabarits de texte (template literals avec ${...}) contenant du texte
// français, reconstitués avec {n1}, {n2}... à la place des expressions : ce
// sont les textes DYNAMIQUES qui nécessitent une entrée de dictionnaire à
// variables (traduction par motif).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;

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

const results = new Map();
for (const root of process.argv.slice(2)) {
  for (const file of walk(root)) {
    const src = fs.readFileSync(file, "utf8");
    let ast;
    try {
      ast = parser.parse(src, { sourceType: "module", plugins: ["jsx"] });
    } catch {
      continue;
    }
    traverse(ast, {
      TemplateLiteral(p) {
        if (p.node.expressions.length === 0) return;
        const parent = p.parent;
        if (parent.type === "TaggedTemplateExpression") return;
        let text = "";
        p.node.quasis.forEach((q, i) => {
          text += q.value.cooked ?? "";
          if (i < p.node.expressions.length) {
            const e = p.node.expressions[i];
            text += "{" + (e.name || e.property?.name || "x") + "}";
          }
        });
        const letters = text.replace(/\{[^}]*\}/g, "");
        if (!/[a-zàâäéèêëîïôöùûüç]{3,}/i.test(letters)) return;
        if (/^(\/|http|px-|bg-|text-|border-|flex|grid|rounded)/.test(text.trim())) return;
        if (/(\bpx-|\bpy-|\bbg-|\btext-|\bborder-|\bflex\b|\brounded)/.test(text) && !/[À-ÿ ]{2}/.test(text)) return;
        if (/\/api\/|SELECT |INSERT |UPDATE /.test(text)) return;
        const rel = path.relative(".", file);
        if (!results.has(text)) results.set(text, rel);
      },
    });
  }
}
for (const [text, file] of [...results.entries()].sort()) console.log(`${text}   <${file}>`);
