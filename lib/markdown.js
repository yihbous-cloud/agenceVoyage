// Markdown "léger" saisi dans l'admin (descriptions de programmes, actualités) :
// le personnel colle souvent des textes déjà mis en forme (**gras**, listes,
// tableaux de prix « | Chambre | Prix | »).
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

// Tableaux (syntaxe GitHub) : ligne d'en-tête, ligne de séparation
// (« |---|:---:|---:| »), puis lignes de données. Les « | » de début et de
// fin sont facultatifs ; « \| » est un « | » littéral dans une cellule.
const TABLE_SEPARATOR_CELL = /^\s*:?-+:?\s*$/;

function splitTableRow(line) {
  let row = line.trim();
  if (row.startsWith("|")) row = row.slice(1);
  if (row.endsWith("|") && !row.endsWith("\\|")) row = row.slice(0, -1);
  const cells = [];
  let current = "";
  for (let i = 0; i < row.length; i++) {
    if (row[i] === "\\" && row[i + 1] === "|") {
      current += "|";
      i += 1;
    } else if (row[i] === "|") {
      cells.push(current.trim());
      current = "";
    } else {
      current += row[i];
    }
  }
  cells.push(current.trim());
  return cells;
}

function isTableSeparator(line) {
  if (!line || !line.includes("|") || !line.includes("-")) return false;
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((cell) => TABLE_SEPARATOR_CELL.test(cell));
}

// Tableau qui commence à la ligne `index` : { header, align, rows, end }
// (`end` = première ligne après le tableau), ou null. L'alignement vient des
// « : » de la ligne de séparation : "start" | "center" | "end" | null.
function readTable(lines, index) {
  const headerLine = lines[index];
  if (!headerLine || !headerLine.includes("|") || !isTableSeparator(lines[index + 1])) return null;
  const header = splitTableRow(headerLine);
  const separator = splitTableRow(lines[index + 1]);
  // Comme sur GitHub : autant de colonnes dans la séparation que dans l'en-tête.
  if (separator.length !== header.length) return null;
  const align = separator.map((cell) => {
    const c = cell.trim();
    if (c.startsWith(":") && c.endsWith(":")) return "center";
    if (c.endsWith(":")) return "end";
    if (c.startsWith(":")) return "start";
    return null;
  });
  const width = header.length;
  const rows = [];
  let end = index + 2;
  while (end < lines.length && lines[end].trim() && lines[end].includes("|")) {
    const cells = splitTableRow(lines[end]);
    rows.push(Array.from({ length: width }, (_, i) => cells[i] ?? ""));
    end += 1;
  }
  return { header, align: Array.from({ length: width }, (_, i) => align[i] ?? null), rows, end };
}

// Texte brut sur une seule ligne (sauts de ligne et espaces multiples
// réduits à un espace). `null`/vide → "". Un tableau devient ses cellules
// séparées par « · », ligne par ligne.
export function stripMarkdown(text) {
  if (!text) return "";
  const lines = String(text).split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const table = readTable(lines, i);
    if (table) {
      for (const cells of [table.header, ...table.rows]) {
        out.push(cells.map(stripInline).filter(Boolean).join(" · "));
      }
      i = table.end - 1;
      continue;
    }
    out.push(
      stripInline(
        lines[i]
          .replace(/^\s{0,3}#{1,6}\s+/, "")
          .replace(/^\s*>\s?/, "")
          .replace(/^\s*[-*+•]\s+/, "")
          .replace(/^\s*\d+[.)]\s+/, "")
      )
    );
  }
  return out.join(" ").replace(/\s+/g, " ").trim();
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
// { type: "ul" | "ol", items: [] } |
// { type: "table", header: [], align: [], rows: [[]] }. Une ligne vide sépare
// les paragraphes ; "#"/"##" → h2 (la page a déjà son h1), "###" et plus → h3.
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

  const lines = String(text || "").split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trimEnd();
    if (!line.trim()) {
      flush();
      continue;
    }

    const table = readTable(lines, index);
    if (table) {
      flush();
      blocks.push({ type: "table", header: table.header, align: table.align, rows: table.rows });
      index = table.end - 1;
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
