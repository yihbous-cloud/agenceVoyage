import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { listPaymentsForTicketSale, createTicketSalePayment } from "@/lib/payments";
import { withNotFound } from "@/lib/apiGuard";

async function GET_handler(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "ticket_sales.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }
  const { id } = await params;
  return NextResponse.json(await listPaymentsForTicketSale(id));
}

async function POST_handler(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "ticket_sales.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }
  const { id } = await params;
  const body = await request.json();
  // Montant négatif autorisé (remboursement), montant nul refusé — même règle
  // que les autres versements (CLAUDE.md §3soixantedeuxquadragies).
  if (!body.amount || Number(body.amount) === 0) {
    return NextResponse.json({ message: "Le montant ne peut pas être nul" }, { status: 400 });
  }
  const paymentId = await createTicketSalePayment(id, body, session.id);
  return NextResponse.json({ id: paymentId }, { status: 201 });
}

export const GET = withNotFound(GET_handler);
export const POST = withNotFound(POST_handler);
