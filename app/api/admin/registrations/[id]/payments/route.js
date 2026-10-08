import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { listPaymentsForRegistration, createPayment } from "@/lib/payments";
import { withNotFound } from "@/lib/apiGuard";

async function GET_handler(request, { params }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  }
  const { id } = await params;
  const payments = await listPaymentsForRegistration(id);
  return NextResponse.json(payments);
}

async function POST_handler(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "paiements.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  // Montant négatif autorisé : un remboursement (annulation, retour d'avance
  // ou du montant total) est un versement au montant négatif — voir
  // CLAUDE.md. Seul un montant nul/manquant est refusé.
  if (!body.amount || Number(body.amount) === 0) {
    return NextResponse.json(
      { message: "Le montant ne peut pas être nul" },
      { status: 400 }
    );
  }

  try {
    const paymentId = await createPayment(id, body, session.id);
    return NextResponse.json({ id: paymentId }, { status: 201 });
  } catch (err) {
    if (err?.code === "NOT_FOUND") {
      return NextResponse.json({ message: "Ressource introuvable" }, { status: 404 });
    }
    return NextResponse.json(
      { message: "Erreur serveur", detail: err.message },
      { status: 500 }
    );
  }
}

export const GET = withNotFound(GET_handler);
export const POST = withNotFound(POST_handler);
