import { NextResponse } from "next/server";
import { whatsappRoute as permissionRoute, readJson } from "@/lib/whatsapp/apiHelpers";
import { listAllTerms, updateTerm, deleteTerm } from "@/lib/glossary";
import { GLOSSARY_PATH, GUIDE_HUB_PATH } from "@/lib/editorial";
import { refreshPublicPages } from "@/lib/publicRevalidation";

export const dynamic = "force-dynamic";

export const PUT = permissionRoute("contenus.manage", async (request, { params }) => {
  const { id } = await params;
  try {
    await updateTerm(id, await readJson(request));
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ message: "Ce slug existe déjà dans le lexique." }, { status: 409 });
    }
    throw err;
  }
  await refreshPublicPages({ paths: [GLOSSARY_PATH, GUIDE_HUB_PATH] });
  return NextResponse.json({ terms: await listAllTerms() });
});

export const DELETE = permissionRoute("contenus.manage", async (_request, { params }) => {
  const { id } = await params;
  await deleteTerm(id);
  await refreshPublicPages({ paths: [GLOSSARY_PATH, GUIDE_HUB_PATH] });
  return NextResponse.json({ terms: await listAllTerms() });
});
