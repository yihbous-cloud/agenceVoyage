import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";

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

    // --- En-tête agence (logo à gauche, texte décalé s'il est présent) ---
    const LOGO_SIZE = 48;
    const headerStartY = doc.y;
    let textX = doc.page.margins.left;
    let textWidth = contentWidth;

    if (agency?.logo_url) {
      const logoPath = path.join(process.cwd(), "public", agency.logo_url);
      if (fs.existsSync(logoPath)) {
        try {
          doc.image(logoPath, doc.page.margins.left, headerStartY, {
            fit: [LOGO_SIZE, LOGO_SIZE],
          });
          textX = doc.page.margins.left + LOGO_SIZE + 10;
          textWidth = contentWidth - LOGO_SIZE - 10;
        } catch {
          // Fichier illisible/corrompu : le reçu continue sans logo.
        }
      }
    }

    doc
      .font("Helvetica-Bold")
      .fontSize(16)
      .text(agency?.name || "Golden Fantastic", textX, headerStartY, { width: textWidth });
    doc.font("Helvetica").fontSize(8).fillColor("#444");

    const addressLine = [agency?.address, agency?.city].filter(Boolean).join(", ");
    if (addressLine) doc.text(addressLine, textX, doc.y, { width: textWidth });

    const contactLine = [
      agency?.phone && `Tél : ${agency.phone}`,
      agency?.whatsapp && `WhatsApp : ${agency.whatsapp}`,
    ]
      .filter(Boolean)
      .join("  ·  ");
    if (contactLine) doc.text(contactLine, textX, doc.y, { width: textWidth });

    const contactLine2 = [agency?.email, agency?.website].filter(Boolean).join("  ·  ");
    if (contactLine2) doc.text(contactLine2, textX, doc.y, { width: textWidth });

    const legalLine = [
      agency?.rc && `RC ${agency.rc}`,
      agency?.tax_id && `IF ${agency.tax_id}`,
      agency?.ice && `ICE ${agency.ice}`,
    ]
      .filter(Boolean)
      .join("  ·  ");
    if (legalLine) doc.text(legalLine, textX, doc.y, { width: textWidth });

    doc.fillColor("#000");
    doc.x = doc.page.margins.left;
    doc.y = Math.max(doc.y, headerStartY + LOGO_SIZE);
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

    if (payment.members) {
      drawField("Groupe", payment.traveler_name);
      drawField(
        "Voyageurs",
        payment.members.map((m) => m.full_name).join(", ") || "—"
      );
    } else {
      drawField("Client", payment.traveler_name);
      drawField("Téléphone", payment.phone_whatsapp);
    }
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

    drawField(
      payment.members ? "Montant total dû (groupe)" : "Montant total du voyage",
      formatAmount(totalDue, payment.currency)
    );
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
