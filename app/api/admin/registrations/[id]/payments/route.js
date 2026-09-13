import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { requireRole } from "@/lib/auth";
import { listPaymentsForRegistration, createPayment } from "@/lib/payments";

export async function GET(request, { params }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  }
  const { id } = await params;
  const payments = await listPaymentsForRegistration(id);
  return NextResponse.json(payments);
}

export async function POST(request, { params }) {
  const session = await getSession();
  if (!requireRole(session, ["direction", "comptabilite"])) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  if (!body.amount || Number(body.amount) <= 0) {
    return NextResponse.json(
      { message: "Le montant doit être supérieur à 0" },
      { status: 400 }
    );
  }

  try {
    const paymentId = await createPayment(id, body, session.id);
    return NextResponse.json({ id: paymentId }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { message: "Erreur serveur", detail: err.message },
      { status: 500 }
    );
  }
}
