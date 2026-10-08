import PDFDocument from "pdfkit";

const GOLD = "#B08D2B";
const ZEBRA = "#F7F3E8";
const INK = "#1F1F1F";
const MUTED = "#6B6358";

// Largeur relative de chaque colonne : les noms ont besoin de place, le
// genre et le N° de ligne très peu.
const WEIGHTS = {
  rownum: 0.45,
  pnr: 0.95,
  full_name: 2.5,
  date_of_birth: 1.35,
  passport_number: 1.4,
  passport_issue_date: 1.35,
  passport_expiry_date: 1.35,
  gender: 0.9,
  phone_whatsapp: 1.5,
  departure_date: 1.35,
  return_date: 1.35,
};

// Helvetica (police PDF standard) ne sait pas écrire l'arabe : la colonne
// reste dans l'Excel uniquement, plutôt qu'un rendu corrompu.
const PDF_UNSUPPORTED_COLUMNS = ["full_name_arabic"];

// rows : objets déjà FORMATÉS (chaînes) indexés par colonne.
// orientation : "portrait" | "landscape" | "auto" (portrait jusqu'à 6
// colonnes, paysage au-delà).
export function buildPnrPdfBuffer({
  title,
  agencyName,
  infoPairs = [],
  columns,
  rows,
  orientation = "auto",
  generatedLabel,
  pageLabel = "Page",
}) {
  columns = columns.filter((c) => !PDF_UNSUPPORTED_COLUMNS.includes(c.key));
  const layout =
    orientation === "auto"
      ? columns.length > 6
        ? "landscape"
        : "portrait"
      : orientation;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout, margin: 36, bufferPages: true });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = doc.page.margins.left;
    const contentWidth = doc.page.width - left - doc.page.margins.right;
    const bottomLimit = doc.page.height - doc.page.margins.bottom - 24;
    const fontSize = columns.length > 8 ? 7.5 : columns.length > 6 ? 8.5 : 9.5;
    const padding = 4;

    const totalWeight = columns.reduce((sum, c) => sum + (WEIGHTS[c.key] || 1.2), 0);
    const widths = columns.map((c) => (contentWidth * (WEIGHTS[c.key] || 1.2)) / totalWeight);
    const xs = widths.reduce((acc, w, i) => {
      acc.push(i === 0 ? left : acc[i - 1] + widths[i - 1]);
      return acc;
    }, []);

    // --- En-tête de document (première page seulement) ---
    doc.font("Helvetica-Bold").fontSize(10).fillColor(GOLD);
    doc.text((agencyName || "").toUpperCase(), left, doc.page.margins.top, {
      width: contentWidth,
      characterSpacing: 1.2,
    });
    doc.font("Helvetica-Bold").fontSize(17).fillColor(INK);
    doc.text(title, left, doc.y + 4, { width: contentWidth });
    doc
      .moveTo(left, doc.y + 6)
      .lineTo(left + 60, doc.y + 6)
      .lineWidth(2)
      .strokeColor(GOLD)
      .stroke();
    doc.y += 14;

    doc.fontSize(9.5).fillColor(INK);
    for (const [label, value] of infoPairs) {
      const y = doc.y;
      doc.font("Helvetica-Bold").text(`${label} : `, left, y, { continued: true, width: contentWidth });
      doc.font("Helvetica").text(String(value ?? "—"), { width: contentWidth });
    }
    doc.y += 10;

    // --- Tableau ---
    const headerHeight = 20;
    const drawTableHeader = () => {
      const y = doc.y;
      doc.rect(left, y, contentWidth, headerHeight).fill(GOLD);
      doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(fontSize);
      columns.forEach((c, i) => {
        doc.text(c.header, xs[i] + padding, y + 6, {
          width: widths[i] - padding * 2,
          height: headerHeight - 6,
          lineBreak: false,
          ellipsis: true,
        });
      });
      doc.y = y + headerHeight;
      doc.fillColor(INK);
    };

    drawTableHeader();

    doc.font("Helvetica").fontSize(fontSize);
    rows.forEach((row, rowIndex) => {
      let rowHeight = 0;
      columns.forEach((c, i) => {
        const h = doc.heightOfString(String(row[c.key] ?? ""), { width: widths[i] - padding * 2 });
        rowHeight = Math.max(rowHeight, h);
      });
      rowHeight += padding * 2;

      if (doc.y + rowHeight > bottomLimit) {
        doc.addPage();
        doc.y = doc.page.margins.top;
        drawTableHeader();
        doc.font("Helvetica").fontSize(fontSize);
      }

      const y = doc.y;
      if (rowIndex % 2 === 1) {
        doc.rect(left, y, contentWidth, rowHeight).fill(ZEBRA);
        doc.fillColor(INK);
      }
      columns.forEach((c, i) => {
        doc.text(String(row[c.key] ?? ""), xs[i] + padding, y + padding, {
          width: widths[i] - padding * 2,
        });
      });
      doc.y = y + rowHeight;
    });

    if (rows.length === 0) {
      doc.text("Aucune donnée.", left + padding, doc.y + padding, { width: contentWidth });
    }

    // --- Pied de page, dessiné une fois le nombre de pages connu ---
    // Le pied de page est dans la marge basse : pdfkit déclencherait une page
    // vierge à chaque .text() sous maxY(), d'où margins.bottom = 0 le temps
    // de le dessiner.
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i += 1) {
      doc.switchToPage(range.start + i);
      const savedBottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      const footerY = doc.page.height - 30;
      doc
        .moveTo(left, footerY - 6)
        .lineTo(left + contentWidth, footerY - 6)
        .lineWidth(0.5)
        .strokeColor("#CFC6B2")
        .stroke();
      doc.font("Helvetica").fontSize(8).fillColor(MUTED);
      doc.text(generatedLabel || "", left, footerY, {
        width: contentWidth / 2,
        align: "left",
        lineBreak: false,
      });
      doc.text(`${pageLabel} ${i + 1} / ${range.count}`, left + contentWidth / 2, footerY, {
        width: contentWidth / 2,
        align: "right",
        lineBreak: false,
      });
      doc.page.margins.bottom = savedBottom;
    }

    doc.end();
  });
}
