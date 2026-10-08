import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getTripById } from "@/lib/programs";
import { resolveAgencyId } from "@/lib/agencyContext";
import { withNotFound } from "@/lib/apiGuard";
import { rateLimit, clientIp, tooManyRequests } from "@/lib/rateLimit";

async function POST_handler(request) {
  // Réservation publique : 5 demandes / 10 min par adresse IP (NF-10).
  const limit = await rateLimit(`reservation:${request.headers.get("x-agency-id")}:${clientIp(request)}`, { limit: 5, windowSeconds: 600 });
  if (!limit.ok) return tooManyRequests(NextResponse, 600);
  const body = await request.json();
  const { tripId, fullName, phoneWhatsapp, email } = body;

  if (!tripId || !fullName || !phoneWhatsapp) {
    return NextResponse.json(
      { message: "tripId, fullName et phoneWhatsapp sont requis" },
      { status: 400 }
    );
  }

  // Agence de la requête (en-tête posé par proxy.js) : le voyage doit lui
  // appartenir, et le voyageur/l'inscription créés sont rattachés à elle.
  const agencyId = await resolveAgencyId();
  const trip = await getTripById(tripId, agencyId);
  if (!trip) {
    return NextResponse.json({ message: "Voyage introuvable" }, { status: 404 });
  }

  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [existing] = await connection.execute(
      `SELECT id FROM travelers WHERE phone_whatsapp = ? AND agency_id = ? LIMIT 1`,
      [phoneWhatsapp, agencyId]
    );

    let travelerId;
    if (existing.length > 0) {
      travelerId = existing[0].id;
    } else {
      const [result] = await connection.execute(
        `INSERT INTO travelers (full_name, phone_whatsapp, email, agency_id)
         VALUES (?, ?, ?, ?)`,
        [fullName, phoneWhatsapp, email || null, agencyId]
      );
      travelerId = result.insertId;
    }

    const [registrationResult] = await connection.execute(
      `INSERT INTO registrations (trip_id, traveler_id, status, agency_id)
       VALUES (?, ?, 'inscrit', ?)`,
      [tripId, travelerId, agencyId]
    );

    await connection.commit();

    return NextResponse.json(
      { id: registrationResult.insertId, travelerId, tripId },
      { status: 201 }
    );
  } catch (err) {
    if (err?.code === "NOT_FOUND") {
      return NextResponse.json({ message: "Ressource introuvable" }, { status: 404 });
    }
    await connection.rollback();

    if (err.code === "ER_DUP_ENTRY") {
      return NextResponse.json(
        { message: "Ce voyageur est déjà inscrit à ce voyage" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { message: "Erreur serveur", detail: err.message },
      { status: 500 }
    );
  } finally {
    connection.release();
  }
}

export const POST = withNotFound(POST_handler);
