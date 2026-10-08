import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { updateExpense, deleteExpense } from "@/lib/tripExpenses";
import { withNotFound } from "@/lib/apiGuard";

async function PUT_handler(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "charges.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }
  const { id } = await params;
  const body = await request.json();
  try {
    await updateExpense(id, body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err.code === "INVALID") return NextResponse.json({ message: err.message }, { status: 400 });
    throw err;
  }
}

async function DELETE_handler(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "charges.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }
  const { id } = await params;
  await deleteExpense(id);
  return NextResponse.json({ ok: true });
}

export const PUT = withNotFound(PUT_handler);
export const DELETE = withNotFound(DELETE_handler);
