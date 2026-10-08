import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  getHebergementDistributionList,
  getHebergementRoomOccupants,
  HEBERGEMENT_LIST_COLUMNS,
} from "@/lib/listGenerators";
import { getTripSummary } from "@/lib/roomAssignment";
import { getAgencySettings } from "@/lib/agencySettings";
import { getCurrentAgency } from "@/lib/currentAgency";
import { getCityByIata } from "@/lib/airports";
import { findAirportByIata } from "@/lib/airportsReference";
import { buildExcelBuffer } from "@/lib/exporters/excel";
import { buildHebergementPdfBuffer } from "@/lib/exporters/hebergementPdf";
import { withNotFound } from "@/lib/apiGuard";

function formatDateFr(value) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("fr-FR");
}

// Nom complet d'un aéroport à partir de son code IATA — même logique de
// résolution que HomeShowcaseCard.jsx (§3soixantedouzequadragies) :
// référence internationale (lib/airportsReference.js) en priorité, repli sur
// la référence marocaine (lib/airports.js, ville seule) puis sur le code brut.
function airportLabel(iata) {
  if (!iata) return "—";
  const airport = findAirportByIata(iata);
  if (airport) return `${airport.name} (${airport.iata}) — ${airport.city}`;
  const city = getCityByIata(iata);
  if (city) return `${city.city} (${iata})`;
  return iata;
}

// Regroupe les lignes plates (une par occupant, getHebergementRoomOccupants)
// en ville → hôtel → chambres, en conservant l'ordre déjà appliqué par la
// requête SQL (Makka puis Madina, puis hôtel, puis chambre) — un
// sous-tableau par HÔTEL sur chaque page ville (§3soixanteseizequadragies,
// regroupement par pack retiré en §3soixantedixhuitquadragies : un hôtel
// peut mélanger plusieurs packs dans le même sous-tableau désormais).
function groupRoomsForPdf(rows) {
  const cityOrder = [];
  const cities = new Map();

  for (const row of rows) {
    if (!cities.has(row.city)) {
      cities.set(row.city, { order: [], groups: new Map() });
      cityOrder.push(row.city);
    }
    const city = cities.get(row.city);
    const groupKey = row.hotel_name;
    if (!city.groups.has(groupKey)) {
      city.groups.set(groupKey, {
        hotel_name: row.hotel_name,
        rows: [],
      });
      city.order.push(groupKey);
    }
    city.groups.get(groupKey).rows.push({
      room_number: row.room_number,
      traveler_name: row.traveler_name,
      traveler_phone: row.traveler_phone,
    });
  }

  return cityOrder.map((city) => {
    const bucket = cities.get(city);
    return { city, hotelGroups: bucket.order.map((key) => bucket.groups.get(key)) };
  });
}

async function GET_handler(request, { params }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  }

  const { tripId } = await params;
  const format = new URL(request.url).searchParams.get("format") || "xlsx";

  const trip = await getTripSummary(tripId);
  if (!trip) {
    return NextResponse.json({ message: "Voyage introuvable" }, { status: 404 });
  }

  const filenameBase = `hebergement-${trip.reference_code}`;

  if (format === "pdf") {
    const [rows, agency] = await Promise.all([getHebergementRoomOccupants(tripId), getAgencySettings()]);

    const { baseUrl } = await getCurrentAgency();
    const programPath =
      trip.program_family === "omra_hajj"
        ? `/omra-hajj/${trip.program_slug}`
        : `/voyages-organises/${trip.program_slug}`;

    const buffer = await buildHebergementPdfBuffer({
      trip,
      originLabel: airportLabel(trip.origin_iata),
      destinationLabel: airportLabel(trip.destination_iata),
      programUrl: `${baseUrl}${programPath}`,
      agencyName: agency?.name || "Golden Fantastic",
      rowsByCity: groupRoomsForPdf(rows),
    });
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filenameBase}.pdf"`,
      },
    });
  }

  const rows = await getHebergementDistributionList(tripId);

  const infoLines = [
    `Programme : ${trip.program_title}`,
    `Dates : ${formatDateFr(trip.departure_date)} → ${formatDateFr(trip.return_date)}`,
    `Aéroport de départ : ${airportLabel(trip.origin_iata)}`,
    `Aéroport d'arrivée : ${airportLabel(trip.destination_iata)}`,
  ];

  const buffer = await buildExcelBuffer({
    sheetName: "Hébergement",
    columns: HEBERGEMENT_LIST_COLUMNS,
    rows,
    infoLines,
  });
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filenameBase}.xlsx"`,
    },
  });
}

export const GET = withNotFound(GET_handler);
