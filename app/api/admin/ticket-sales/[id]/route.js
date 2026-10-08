import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { getTicketSaleById, updateTicketSale, deleteTicketSale } from "@/lib/ticketSales";
import { withNotFound } from "@/lib/apiGuard";

async function guard() {
  const session = await getSession();
  return (await hasPermission(session, "ticket_sales.manage")) ? session : null;
}

async function GET_handler(request, { params }) {
  if (!(await guard())) return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  const { id } = await params;
  const sale = await getTicketSaleById(id);
  if (!sale) return NextResponse.json({ message: "Ressource introuvable" }, { status: 404 });
  return NextResponse.json(sale);
}

async function PUT_handler(request, { params }) {
  if (!(await guard())) return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  const { id } = await params;
  const body = await request.json();
  try {
    return NextResponse.json(await updateTicketSale(id, body));
  } catch (err) {
    if (err.code === "INVALID") return NextResponse.json({ message: err.message }, { status: 400 });
    throw err;
  }
}

async function DELETE_handler(request, { params }) {
  if (!(await guard())) return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  const { id } = await params;
  try {
    await deleteTicketSale(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err.code === "INVALID") return NextResponse.json({ message: err.message }, { status: 409 });
    throw err;
  }
}

export const GET = withNotFound(GET_handler);
export const PUT = withNotFound(PUT_handler);
export const DELETE = withNotFound(DELETE_handler);
