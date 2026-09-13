import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAirlineList, getTripAirlineTemplateKey } from "@/lib/listGenerators";
import { getAirlineTemplate } from "@/lib/airlineTemplates";
import { getTripSummary } from "@/lib/roomAssignment";
import { buildExcelBuffer } from "@/lib/exporters/excel";
import { buildPdfBuffer } from "@/lib/exporters/pdf";

export async function GET(request, { params }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  }

  const { tripId } = await params;
  const format = new URL(request.url).searchParams.get("format") || "xlsx";

  const [trip, rows, templateKey] = await Promise.all([
    getTripSummary(tripId),
    getAirlineList(tripId),
    getTripAirlineTemplateKey(tripId),
  ]);

  if (!trip) {
    return NextResponse.json({ message: "Voyage introuvable" }, { status: 404 });
  }

  const template = getAirlineTemplate(templateKey);
  const filenameBase = `compagnie-${trip.reference_code}`;
  const title = `Liste compagnie aérienne (${template.label}) — ${trip.program_title} (${trip.reference_code})`;

  if (format === "pdf") {
    const buffer = await buildPdfBuffer({ title, columns: template.columns, rows });
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filenameBase}.pdf"`,
      },
    });
  }

  const buffer = await buildExcelBuffer({
    sheetName: template.label,
    columns: template.columns,
    rows,
  });
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filenameBase}.xlsx"`,
    },
  });
}
