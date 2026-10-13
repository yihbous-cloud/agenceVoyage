import { NextResponse } from "next/server";
import { whatsappRoute as permissionRoute, readJson } from "@/lib/whatsapp/apiHelpers";
import { listAuthors, updateAuthor, deleteAuthor, listGuideSlugsOfAuthor } from "@/lib/authors";
import { guidePath } from "@/lib/editorial";
import { refreshPublicPages } from "@/lib/publicRevalidation";

export const dynamic = "force-dynamic";

// Un auteur modifié ou supprimé change les guides qu'il signe ou relit.
async function refreshGuidesOf(slugs) {
  if (slugs.length > 0) await refreshPublicPages({ paths: slugs.map(guidePath) });
}

export const PUT = permissionRoute("contenus.manage", async (request, { params }) => {
  const { id } = await params;
  await updateAuthor(id, await readJson(request));
  await refreshGuidesOf(await listGuideSlugsOfAuthor(id));
  return NextResponse.json({ authors: await listAuthors() });
});

export const DELETE = permissionRoute("contenus.manage", async (_request, { params }) => {
  const { id } = await params;
  const slugs = await listGuideSlugsOfAuthor(id);
  await deleteAuthor(id);
  await refreshGuidesOf(slugs);
  return NextResponse.json({ authors: await listAuthors() });
});
