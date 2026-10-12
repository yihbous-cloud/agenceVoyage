import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { updateFaq, deleteFaq } from "@/lib/programFaqs";
import { withNotFound } from "@/lib/apiGuard";
import { refreshPublicPages, findProgramIds } from "@/lib/publicRevalidation";

async function PUT_handler(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "programmes.manage"))) {
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
  await refreshPublicPages({ faqId: id });
  return NextResponse.json({ ok: true });
}

async function DELETE_handler(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "programmes.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const programIds = await findProgramIds({ faqId: id });
  await deleteFaq(id);
  await refreshPublicPages({ programIds });
  return NextResponse.json({ ok: true });
}

export const PUT = withNotFound(PUT_handler);
export const DELETE = withNotFound(DELETE_handler);
