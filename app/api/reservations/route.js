import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getTripById } from "@/lib/programs";

export async function POST(request) {
  const body = await request.json();
  const { tripId, fullName, phoneWhatsapp, email } = body;

  if (!tripId || !fullName || !phoneWhatsapp) {
    return NextResponse.json(
      { message: "tripId, fullName et phoneWhatsapp sont requis" },
      { status: 400 }
    );
  }

  const trip = await getTripById(tripId);
  if (!trip) {
    return NextResponse.json({ message: "Voyage introuvable" }, { status: 404 });
  }

  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [existing] = await connection.execute(
      `SELECT id FROM travelers WHERE phone_whatsapp = ? LIMIT 1`,
      [phoneWhatsapp]
    );

    let travelerId;
    if (existing.length > 0) {
      travelerId = existing[0].id;
    } else {
      const [result] = await connection.execute(
        `INSERT INTO travelers (full_name, phone_whatsapp, email)
         VALUES (?, ?, ?)`,
        [fullName, phoneWhatsapp, email || null]
      );
      travelerId = result.insertId;
    }

    const [registrationResult] = await connection.execute(
      `INSERT INTO registrations (trip_id, traveler_id, status)
       VALUES (?, ?, 'inscrit')`,
      [tripId, travelerId]
    );

    await connection.commit();

    return NextResponse.json(
      { id: registrationResult.insertId, travelerId, tripId },
      { status: 201 }
    );
  } catch (err) {
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
