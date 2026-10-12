// Markdown "léger" saisi dans l'admin (descriptions de programmes, actualités) :
// le personnel colle souvent des textes déjà mis en forme (**gras**, listes).
// Fichier pur, sans dépendance — utilisé côté serveur ET client.
//   - stripMarkdown : texte brut (balises meta, JSON-LD, llms.txt, API, RSS)
//   - parseMarkdownBlocks / parseInline : structure rendue en éléments React
//     par app/_components/RichText.jsx (jamais de HTML injecté tel quel)

// Gras, italique, liens [texte](url) et code `x` → leur seul texte.
function stripInline(text) {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(^|[^*\w])\*(?!\s)([^*\n]+?)\*(?!\w)/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1");
}

// Texte brut sur une seule ligne (sauts de ligne et espaces multiples
// réduits à un espace). `null`/vide → "".
export function stripMarkdown(text) {
  if (!text) return "";
  return String(text)
    .split(/\r?\n/)
    .map((line) =>
      stripInline(
        line
          .replace(/^\s{0,3}#{1,6}\s+/, "")
          .replace(/^\s*>\s?/, "")
          .replace(/^\s*[-*+•]\s+/, "")
          .replace(/^\s*\d+[.)]\s+/, "")
      )
    )
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

// Coupe un texte brut à `max` caractères sur une limite de mot, avec "…"
// (meta description : 155 caractères au plus, cahier des charges §6.3).
export function truncateText(text, max = 155) {
  const clean = String(text || "").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

// Description courte prête pour une balise meta/JSON-LD.
export function plainSummary(text, max = 155) {
  return truncateText(stripMarkdown(text), max);
}

// Découpe une ligne en segments { type: "text" | "strong" | "em" | "link", ... }.
// Les liens ne sont conservés que vers http(s) ou un chemin interne.
export function parseInline(line) {
  const tokens = [];
  const pattern = /(\*\*|__)(.+?)\1|\[([^\]]+)\]\(([^)\s]+)\)|(^|[^*\w])\*(?!\s)([^*\n]+?)\*(?!\w)/g;
  let last = 0;
  let match;
  while ((match = pattern.exec(line)) !== null) {
    let start = match.index;
    if (match[6] !== undefined) {
      // Italique : le caractère précédent (match[5]) fait partie du texte.
      start += match[5].length;
    }
    if (start > last) tokens.push({ type: "text", value: line.slice(last, start) });
    if (match[2] !== undefined) {
      tokens.push({ type: "strong", value: match[2] });
    } else if (match[3] !== undefined) {
      const href = match[4];
      if (/^(https?:\/\/|\/)/.test(href)) {
        tokens.push({ type: "link", value: match[3], href });
      } else {
        tokens.push({ type: "text", value: match[3] });
      }
    } else {
      tokens.push({ type: "em", value: match[6] });
    }
    last = pattern.lastIndex;
  }
  if (last < line.length) tokens.push({ type: "text", value: line.slice(last) });
  return tokens;
}

// Blocs : { type: "h2" | "h3", text } | { type: "p", lines: [] } |
// { type: "ul" | "ol", items: [] }. Une ligne vide sépare les paragraphes ;
// "#"/"##" → h2 (la page a déjà son h1), "###" et plus → h3.
export function parseMarkdownBlocks(text) {
  const blocks = [];
  let paragraph = null;
  let list = null;

  const flush = () => {
    if (paragraph) blocks.push(paragraph);
    if (list) blocks.push(list);
    paragraph = null;
    list = null;
  };

  for (const rawLine of String(text || "").split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      flush();
      continue;
    }

    const heading = /^\s{0,3}(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      blocks.push({ type: heading[1].length <= 2 ? "h2" : "h3", text: heading[2].trim() });
      continue;
    }

    const bullet = /^\s*[-*+•]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      const type = bullet ? "ul" : "ol";
      if (paragraph) {
        blocks.push(paragraph);
        paragraph = null;
      }
      if (!list || list.type !== type) {
        if (list) blocks.push(list);
        list = { type, items: [] };
      }
      list.items.push((bullet || numbered)[1].trim());
      continue;
    }

    if (list) {
      blocks.push(list);
      list = null;
    }
    if (!paragraph) paragraph = { type: "p", lines: [] };
    paragraph.lines.push(line.trim());
  }
  flush();
  return blocks;
}
