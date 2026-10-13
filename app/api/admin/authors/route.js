import { NextResponse } from "next/server";
import { whatsappRoute as permissionRoute, readJson } from "@/lib/whatsapp/apiHelpers";
import { listAuthors, createAuthor } from "@/lib/authors";

export const dynamic = "force-dynamic";

// Auteurs et relecteurs des guides (vague 2B du référencement).
export const GET = permissionRoute("contenus.manage", async () => NextResponse.json(await listAuthors()));

export const POST = permissionRoute("contenus.manage", async (request) => {
  const id = await createAuthor(await readJson(request));
  return NextResponse.json({ id, authors: await listAuthors() }, { status: 201 });
});
