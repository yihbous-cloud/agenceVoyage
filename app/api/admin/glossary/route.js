import { NextResponse } from "next/server";
import { whatsappRoute as permissionRoute, readJson } from "@/lib/whatsapp/apiHelpers";
import { listAllTerms, createTerm } from "@/lib/glossary";
import { GLOSSARY_PATH, GUIDE_HUB_PATH } from "@/lib/editorial";
import { refreshPublicPages } from "@/lib/publicRevalidation";

export const dynamic = "force-dynamic";

// Lexique (vague 2B du référencement) : /guide/lexique.
export const GET = permissionRoute("contenus.manage", async () => NextResponse.json(await listAllTerms()));

export const POST = permissionRoute("contenus.manage", async (request) => {
  try {
    await createTerm(await readJson(request));
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ message: "Ce slug existe déjà dans le lexique." }, { status: 409 });
    }
    throw err;
  }
  await refreshPublicPages({ paths: [GLOSSARY_PATH, GUIDE_HUB_PATH] });
  return NextResponse.json({ terms: await listAllTerms() }, { status: 201 });
});
