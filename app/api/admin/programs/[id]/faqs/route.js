import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { listAllFaqsForProgram, createFaq } from "@/lib/programFaqs";
import { withNotFound } from "@/lib/apiGuard";

async function GET_handler(request, { params }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  }

  const { id } = await params;
  const faqs = await listAllFaqsForProgram(id);
  return NextResponse.json(faqs);
}

async function POST_handler(request, { params }) {
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

  const faqId = await createFaq(id, body);
  return NextResponse.json({ id: faqId }, { status: 201 });
}

export const GET = withNotFound(GET_handler);
export const POST = withNotFound(POST_handler);
