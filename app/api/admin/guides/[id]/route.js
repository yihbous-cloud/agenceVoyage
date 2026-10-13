import { NextResponse } from "next/server";
import { whatsappRoute as permissionRoute, readJson } from "@/lib/whatsapp/apiHelpers";
import { updateGuide, deleteGuide, getGuideById, setGuidePrograms, countPublishedGuides } from "@/lib/guides";
import { setTranslations } from "@/lib/contentTranslations";
import { syncContentRedirects, redirectDeletedContent } from "@/lib/redirects";
import { refreshPublicPages } from "@/lib/publicRevalidation";
import { guidePublicPaths, guideFallbackPath, duplicateSlugResponse } from "../shared";

export const dynamic = "force-dynamic";

// Modification et suppression d'un guide (vague 2B du référencement) :
// redirections automatiques comme pour les actualités (slug changé,
// dépublication, suppression) et mise à jour immédiate des pages.
export const PUT = permissionRoute("contenus.manage", async (request, { params }, session) => {
  const { id } = await params;
  const body = await readJson(request);
  const before = await getGuideById(id);
  if (!before) return NextResponse.json({ message: "Ressource introuvable" }, { status: 404 });
  const countBefore = await countPublishedGuides();
  try {
    await updateGuide(id, body);
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") return duplicateSlugResponse();
    throw err;
  }
  const after = await getGuideById(id);
  if (body.translations !== undefined) {
    await setTranslations("guide", id, body.translations, { baseLocale: after.content_locale });
  }
  const programIds = Array.isArray(body.programIds) ? await setGuidePrograms(id, body.programIds) : before.program_ids;
  await syncContentRedirects({
    beforePath: guidePublicPaths(before)[0],
    afterPath: guidePublicPaths(after)[0],
    beforePublished: before.status === "publie",
    afterPublished: after.status === "publie",
    fallbackPath: guideFallbackPath(after),
    staffId: session?.id || null,
  });
  if (before.status === "publie" || after.status === "publie") {
    await refreshPublicPages({
      paths: [...new Set([...guidePublicPaths(before), ...guidePublicPaths(after)])],
      programIds,
    });
    const countAfter = await countPublishedGuides();
    if ((countBefore === 0) !== (countAfter === 0)) await refreshPublicPages({ site: true });
  }
  return NextResponse.json({ ok: true });
});

export const DELETE = permissionRoute("contenus.manage", async (_request, { params }, session) => {
  const { id } = await params;
  const before = await getGuideById(id);
  if (!before) return NextResponse.json({ message: "Ressource introuvable" }, { status: 404 });
  await deleteGuide(id);
  if (before.status === "publie") {
    await redirectDeletedContent({
      path: guidePublicPaths(before)[0],
      fallbackPath: guideFallbackPath(before),
      staffId: session?.id || null,
    });
    await refreshPublicPages({ paths: guidePublicPaths(before), programIds: before.program_ids });
    if ((await countPublishedGuides()) === 0) await refreshPublicPages({ site: true });
  }
  return NextResponse.json({ ok: true });
});
