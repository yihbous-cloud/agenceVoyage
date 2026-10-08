import QRCode from "qrcode";
import PDFDocument from "pdfkit";
import { whatsappRoute } from "@/lib/whatsapp/apiHelpers";
import { getLink } from "@/lib/whatsapp/links";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// QR code d'un lien wa.me : PNG (?format=png) ou PDF A5 imprimable (?format=pdf).
export const GET = whatsappRoute("whatsapp.links", async (request, { params }) => {
  const { id } = await params;
  const link = await getLink(id);
  if (!link.url) return new Response("Numéro WhatsApp de l'agence non renseigné (paramètres WhatsApp).", { status: 409 });
  const png = await QRCode.toBuffer(link.url, { type: "png", width: 1024, margin: 2, errorCorrectionLevel: "M" });
  const name = `qr-${link.code.toLowerCase()}`;
  if (request.nextUrl.searchParams.get("format") !== "pdf") {
    return new Response(png, { headers: { "Content-Type": "image/png", "Content-Disposition": `attachment; filename="${name}.png"` } });
  }
  const doc = new PDFDocument({ size: "A5", margin: 40 });
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise((resolve) => doc.on("end", resolve));
  const width = doc.page.width - 80;
  doc.fontSize(18).text(link.label, { align: "center" });
  doc.moveDown(0.5);
  doc.image(png, 40 + (width - 300) / 2, doc.y, { width: 300 });
  doc.y += 310;
  doc.fontSize(11).fillColor("#555").text("Scannez pour nous écrire sur WhatsApp", { align: "center" });
  doc.fontSize(9).text(`Code : ${link.code}`, { align: "center" });
  doc.end();
  await done;
  return new Response(Buffer.concat(chunks), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}.pdf"` } });
});
