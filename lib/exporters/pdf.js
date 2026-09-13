import PDFDocument from "pdfkit";

function formatValue(value) {
  if (value == null) return "";
  if (value instanceof Date) return value.toLocaleDateString("fr-FR");
  return String(value);
}

// La police PDF standard (Helvetica) ne supporte pas l'écriture arabe :
// les colonnes listées ici sont retirées du PDF (elles restent dans l'Excel)
// pour éviter un rendu corrompu, en attendant l'intégration d'une police arabe.
const PDF_UNSUPPORTED_COLUMNS = ["full_name_arabic"];

export function buildPdfBuffer({ title, columns, rows }) {
  columns = columns.filter((c) => !PDF_UNSUPPORTED_COLUMNS.includes(c.key));

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ layout: "landscape", margin: 30, size: "A4" });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(14).font("Helvetica-Bold").text(title, { align: "left" });
    doc.moveDown(0.5);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colWidth = pageWidth / columns.length;
    const fontSize = columns.length > 8 ? 6 : 8;
    doc.fontSize(fontSize);

    const drawRow = (values, { bold = false } = {}) => {
      const y = doc.y;
      doc.font(bold ? "Helvetica-Bold" : "Helvetica");
      let maxHeight = 0;
      columns.forEach((col, i) => {
        const height = doc.heightOfString(String(values[i] ?? ""), {
          width: colWidth - 4,
        });
        maxHeight = Math.max(maxHeight, height);
      });
      columns.forEach((col, i) => {
        doc.text(String(values[i] ?? ""), doc.page.margins.left + i * colWidth, y, {
          width: colWidth - 4,
        });
      });
      doc.y = y + maxHeight + 4;

      if (doc.y > doc.page.height - doc.page.margins.bottom - 20) {
        doc.addPage();
      }
    };

    drawRow(
      columns.map((c) => c.header),
      { bold: true }
    );
    doc
      .moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y)
      .stroke();
    doc.moveDown(0.3);

    for (const row of rows) {
      drawRow(columns.map((c) => formatValue(row[c.key])));
    }

    if (rows.length === 0) {
      doc.text("Aucune donnée.");
    }

    doc.end();
  });
}
