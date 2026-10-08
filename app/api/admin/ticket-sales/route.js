import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { listTicketSales, createTicketSale } from "@/lib/ticketSales";
import { withNotFound } from "@/lib/apiGuard";

// Vente de billets d'avion hors programme (migration 037) — ticket_sales.manage.
async function GET_handler() {
  const session = await getSession();
  if (!(await hasPermission(session, "ticket_sales.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }
  return NextResponse.json(await listTicketSales());
}

async function POST_handler(request) {
  const session = await getSession();
  if (!(await hasPermission(session, "ticket_sales.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }
  const body = await request.json();
  try {
    const id = await createTicketSale(body, session.id);
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    if (err.code === "INVALID") return NextResponse.json({ message: err.message }, { status: 400 });
    throw err;
  }
}

export const GET = withNotFound(GET_handler);
export const POST = withNotFound(POST_handler);
