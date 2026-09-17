import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { listPaymentsForGroup, createGroupPayment } from "@/lib/payments";

export async function GET(request, { params }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  }
  const { id } = await params;
  const payments = await listPaymentsForGroup(id);
  return NextResponse.json(payments);
}

export async function POST(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "paiements.manage"))) {
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
    const paymentId = await createGroupPayment(id, body, session.id);
    return NextResponse.json({ id: paymentId }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { message: "Erreur serveur", detail: err.message },
      { status: 500 }
    );
  }
}
