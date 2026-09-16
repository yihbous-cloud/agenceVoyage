import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getPaymentById } from "@/lib/payments";
import { getAgencySettings } from "@/lib/agencySettings";
import { buildReceiptPdfBuffer } from "@/lib/exporters/receiptPdf";

export async function GET(request, { params }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  }

  const { id } = await params;
  const [payment, agency] = await Promise.all([getPaymentById(id), getAgencySettings()]);

  if (!payment) {
    return NextResponse.json({ message: "Paiement introuvable" }, { status: 404 });
  }

  const buffer = await buildReceiptPdfBuffer({ agency, payment });
  const filename = `recu-${payment.reference_code}-${payment.id}.pdf`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
