import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getPnrPassengerList } from "@/lib/listGenerators";
import { PNR_LIST_COLUMNS, formatPnrValue } from "@/lib/pnrListColumns";
import { getTripSummary } from "@/lib/roomAssignment";
import { getAgencySettings } from "@/lib/agencySettings";
import { buildExcelBuffer } from "@/lib/exporters/excel";
import { buildPnrPdfBuffer } from "@/lib/exporters/pnrPdf";
import { query } from "@/lib/db";
import { withNotFound } from "@/lib/apiGuard";

function formatDateFr(value) {
  if (!value) return "—";
  const [y, m, d] = String(value).slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : String(value);
}

// Liste destinée à la compagnie aérienne : PNR + identité/passeport des
// inscrits. Paramètres (tous optionnels, validés contre le catalogue de
// lib/pnrListColumns.js — une valeur inconnue est ignorée) :
//   columns=pnr,full_name,...   colonnes (ordre du catalogue)
//   f=date_of_birth:dd_mm_yyyy,gender:fr_short   format d'affichage par colonne
//   lang=fr|en                  langue des en-têtes
//   orient=auto|portrait|landscape   PDF seulement
//   num=1                       première colonne N° de ligne
async function GET_handler(request, { params }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  }

  const { tripId } = await params;
  const url = new URL(request.url);
  const format = url.searchParams.get("format") || "xlsx";
  const requested = (url.searchParams.get("columns") || "").split(",").filter(Boolean);
  const lang = url.searchParams.get("lang") === "en" ? "en" : "fr";
  const orientationParam = url.searchParams.get("orient");
  const orientation = ["portrait", "landscape"].includes(orientationParam) ? orientationParam : "auto";
  const numbered = url.searchParams.get("num") === "1";

  const formatChoices = Object.fromEntries(
    (url.searchParams.get("f") || "")
      .split(",")
      .filter(Boolean)
      .map((pair) => pair.split(":"))
      .filter((pair) => pair.length === 2)
  );

  const selected = requested.length
    ? PNR_LIST_COLUMNS.filter((c) => requested.includes(c.key))
    : PNR_LIST_COLUMNS.filter((c) => c.default);
  if (selected.length === 0) {
    return NextResponse.json({ message: "Choisir au moins une colonne" }, { status: 400 });
  }

  const [trip, rawRows, airlineRows, agency] = await Promise.all([
    getTripSummary(tripId),
    getPnrPassengerList(tripId),
    query(
      `SELECT a.name AS airline_name, t.pnr FROM trips t
       LEFT JOIN airlines a ON a.id = t.airline_id WHERE t.id = ? AND t.agency_id = ?`,
      [tripId, session.agencyId]
    ),
    getAgencySettings(),
  ]);
  if (!trip) {
    return NextResponse.json({ message: "Voyage introuvable" }, { status: 404 });
  }

  const en = lang === "en";
  const headerOf = (c) => (en ? c.headerEn : c.header);
  const columns = [
    ...(numbered ? [{ key: "rownum", header: "N°" }] : []),
    ...selected.map((c) => ({ key: c.key, header: headerOf(c) })),
  ];
  const rows = rawRows.map((raw, index) => {
    const row = { rownum: index + 1 };
    for (const c of selected) {
      row[c.key] = formatPnrValue(c, raw[c.key], formatChoices[c.key]);
    }
    return row;
  });

  const airline = airlineRows[0]?.airline_name || "—";
  const pnr = airlineRows[0]?.pnr || "—";
  const labels = en
    ? { program: "Programme", airline: "Airline", pnr: "PNR", dates: "Travel dates", count: "Passengers" }
    : { program: "Programme", airline: "Compagnie", pnr: "PNR", dates: "Dates du voyage", count: "Voyageurs" };
  const infoPairs = [
    [labels.program, `${trip.program_title} (${trip.reference_code})`],
    [labels.airline, airline],
    [labels.pnr, pnr],
    [labels.dates, `${formatDateFr(trip.departure_date)} – ${formatDateFr(trip.return_date)}`],
    [labels.count, rawRows.length],
  ];
  const title = en ? "Passenger list" : "Liste des passagers";
  const filenameBase = `compagnie-pnr-${trip.reference_code}`;

  if (format === "pdf") {
    const buffer = await buildPnrPdfBuffer({
      title,
      agencyName: agency?.name || "Golden Fantastic",
      infoPairs,
      columns,
      rows,
      orientation,
      generatedLabel: `${en ? "Generated on" : "Édité le"} ${new Date().toLocaleDateString(en ? "en-GB" : "fr-FR")}`,
      pageLabel: en ? "Page" : "Page",
    });
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filenameBase}.pdf"`,
      },
    });
  }

  const buffer = await buildExcelBuffer({
    sheetName: en ? "Passengers" : "Passagers",
    columns,
    rows,
    infoLines: infoPairs.map(([label, value]) => `${label} : ${value}`),
  });
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filenameBase}.xlsx"`,
    },
  });
}

export const GET = withNotFound(GET_handler);
