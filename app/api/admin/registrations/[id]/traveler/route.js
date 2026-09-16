import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { getRegistrationById, updateTraveler } from "@/lib/registrations";

// Corrige les informations du voyageur (nom, WhatsApp, genre, passeport,
// email) — utile quand l'inscrit les a saisies lui-même via le formulaire
// public et qu'une correction est nécessaire (faute de frappe, etc.).
export async function PUT(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "inscriptions.edit_voyageur"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  if (!body.fullName?.trim() || !body.phoneWhatsapp?.trim()) {
    return NextResponse.json(
      { message: "Le nom complet et le numéro WhatsApp sont requis" },
      { status: 400 }
    );
  }

  const registration = await getRegistrationById(id);
  if (!registration) {
    return NextResponse.json({ message: "Inscription introuvable" }, { status: 404 });
  }

  // Règle passeport : doit rester valide au moins 6 mois après la date du
  // voyage — revalidée côté serveur (le client peut être contourné).
  if (body.passportExpiryDate) {
    const reference = registration.departure_date
      ? new Date(registration.departure_date)
      : new Date();
    const minValidUntil = new Date(reference);
    minValidUntil.setMonth(minValidUntil.getMonth() + 6);
    if (new Date(body.passportExpiryDate) < minValidUntil) {
      return NextResponse.json(
        {
          message: `Le passeport doit rester valide au moins 6 mois après le ${reference.toLocaleDateString("fr-FR")}`,
        },
        { status: 400 }
      );
    }
  }

  await updateTraveler(registration.traveler_id, body);
  return NextResponse.json({ ok: true });
}
