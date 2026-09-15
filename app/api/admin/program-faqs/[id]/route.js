import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { requireRole } from "@/lib/auth";
import { updateFaq, deleteFaq } from "@/lib/programFaqs";

export async function PUT(request, { params }) {
  const session = await getSession();
  if (!requireRole(session, ["direction"])) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  if (!body.question?.trim() || !body.answer?.trim()) {
    return NextResponse.json(
      { message: "La question et la réponse sont requises" },
      { status: 400 }
    );
  }

  await updateFaq(id, body);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request, { params }) {
  const session = await getSession();
  if (!requireRole(session, ["direction"])) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  await deleteFaq(id);
  return NextResponse.json({ ok: true });
}
