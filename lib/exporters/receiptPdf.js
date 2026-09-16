import PDFDocument from "pdfkit";

const PAYMENT_METHOD_LABELS = {
  especes: "Espèces",
  virement: "Virement",
  cheque: "Chèque",
  carte: "Carte",
  autre: "Autre",
};

function formatAmount(value, currency) {
  // toLocaleString("fr-FR") insère un espace fine insécable (U+202F) comme
  // séparateur de milliers, glyphe absent des polices standard de pdfkit
  // (Helvetica) — remplacé par un espace normal pour un rendu correct.
  const formatted = Number(value)
    .toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .replace(/[  ]/g, " ");
  return `${formatted} ${currency}`;
}

function formatDate(value) {
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

// Reçu de paiement imprimable, format A5 — un reçu par avance/versement
// (pas un cumul), avec rappel du solde restant sur le voyage.
export function buildReceiptPdfBuffer({ agency, payment }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A5", margin: 32 });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // --- En-tête agence ---
    doc.font("Helvetica-Bold").fontSize(16).text(agency?.name || "Golden Fantastic");
    doc.font("Helvetica").fontSize(8).fillColor("#444");

    const addressLine = [agency?.address, agency?.city].filter(Boolean).join(", ");
    if (addressLine) doc.text(addressLine);

    const contactLine = [
      agency?.phone && `Tél : ${agency.phone}`,
      agency?.whatsapp && `WhatsApp : ${agency.whatsapp}`,
    ]
      .filter(Boolean)
      .join("  ·  ");
    if (contactLine) doc.text(contactLine);

    const contactLine2 = [agency?.email, agency?.website].filter(Boolean).join("  ·  ");
    if (contactLine2) doc.text(contactLine2);

    const legalLine = [
      agency?.rc && `RC ${agency.rc}`,
      agency?.tax_id && `IF ${agency.tax_id}`,
      agency?.ice && `ICE ${agency.ice}`,
    ]
      .filter(Boolean)
      .join("  ·  ");
    if (legalLine) doc.text(legalLine);

    doc.fillColor("#000");
    doc.moveDown(0.6);
    doc
      .moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y)
      .lineWidth(1.5)
      .strokeColor("#B08D2B")
      .stroke()
      .strokeColor("#000")
      .lineWidth(1);
    doc.moveDown(0.8);

    // --- Titre ---
    doc.font("Helvetica-Bold").fontSize(14).text("REÇU DE PAIEMENT", { align: "center" });
    doc.moveDown(0.3);
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#444")
      .text(
        `N° ${payment.receipt_reference || `REC-${payment.id}`}   ·   ${formatDate(payment.payment_date)}`,
        { align: "center" }
      );
    doc.fillColor("#000");
    doc.moveDown(1);

    // --- Client / programme ---
    const labelWidth = 110;
    const drawField = (label, value) => {
      const y = doc.y;
      doc.font("Helvetica-Bold").fontSize(9).text(label, doc.page.margins.left, y, {
        width: labelWidth,
      });
      doc.font("Helvetica").fontSize(9).text(value || "—", doc.page.margins.left + labelWidth, y, {
        width: contentWidth - labelWidth,
      });
      doc.moveDown(0.35);
    };

    drawField("Client", payment.traveler_name);
    drawField("Téléphone", payment.phone_whatsapp);
    drawField("Programme", payment.program_title);
    drawField("Voyage", `${payment.reference_code} — ${formatDate(payment.departure_date)}`);

    doc.moveDown(0.5);
    doc
      .moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y)
      .dash(2, { space: 2 })
      .stroke()
      .undash();
    doc.moveDown(0.8);

    // --- Détail du paiement ---
    doc.font("Helvetica-Bold").fontSize(10).text("Détail du versement");
    doc.moveDown(0.4);

    drawField("Montant reçu", formatAmount(payment.amount, payment.currency));
    drawField("Mode de paiement", PAYMENT_METHOD_LABELS[payment.payment_method] || payment.payment_method);
    if (payment.notes) drawField("Notes", payment.notes);
    drawField("Reçu par", payment.recorded_by_name || "—");

    doc.moveDown(0.5);
    doc
      .moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y)
      .stroke();
    doc.moveDown(0.6);

    // --- Situation financière ---
    const totalDue = Number(payment.total_due);
    const totalPaid = Number(payment.total_paid_to_date);
    const balance = totalDue - totalPaid;

    drawField("Montant total du voyage", formatAmount(totalDue, payment.currency));
    drawField("Total payé à ce jour", formatAmount(totalPaid, payment.currency));

    doc.font("Helvetica-Bold").fontSize(10);
    drawField("Solde restant", formatAmount(balance, payment.currency));

    doc.moveDown(1.2);

    // --- Pied de page ---
    if (agency?.footer_note) {
      doc
        .font("Helvetica-Oblique")
        .fontSize(8)
        .fillColor("#444")
        .text(agency.footer_note, { align: "center" });
      doc.fillColor("#000");
      doc.moveDown(0.8);
    }

    const signatureY = doc.page.height - doc.page.margins.bottom - 40;
    doc
      .font("Helvetica")
      .fontSize(9)
      .text("Signature / cachet", doc.page.margins.left, signatureY);
    doc
      .moveTo(doc.page.width - doc.page.margins.right - 140, signatureY + 30)
      .lineTo(doc.page.width - doc.page.margins.right, signatureY + 30)
      .stroke();

    doc.end();
  });
}
