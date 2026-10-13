import { NextResponse } from "next/server";
import { whatsappRoute as permissionRoute, readJson } from "@/lib/whatsapp/apiHelpers";
import { listAllGuides, createGuide, getGuideById, setGuidePrograms, countPublishedGuides } from "@/lib/guides";
import { setTranslations } from "@/lib/contentTranslations";
import { removeRedirectsFrom } from "@/lib/redirects";
import { refreshPublicPages } from "@/lib/publicRevalidation";
import { guidePublicPaths, duplicateSlugResponse } from "./shared";

export const dynamic = "force-dynamic";

// Guides de l'outil éditorial (référencement, vague 2B — CLAUDE.md
// §3centdixhuitquadragies). Permission contenus.manage.
export const GET = permissionRoute("contenus.manage", async () => NextResponse.json(await listAllGuides()));

export const POST = permissionRoute("contenus.manage", async (request) => {
  const body = await readJson(request);
  const countBefore = await countPublishedGuides();
  let id;
  try {
    id = await createGuide(body);
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") return duplicateSlugResponse();
    throw err;
  }
  const guide = await getGuideById(id);
  if (body.translations !== undefined) {
    await setTranslations("guide", id, body.translations, { baseLocale: guide.content_locale });
  }
  const programIds = Array.isArray(body.programIds) ? await setGuidePrograms(id, body.programIds) : [];
  if (guide.status === "publie") {
    // Son adresse redevient vivante : une ancienne redirection ne la masque plus.
    await removeRedirectsFrom(guidePublicPaths(guide).slice(0, 1));
    await refreshPublicPages({ paths: guidePublicPaths(guide), programIds });
    // Premier guide publié : le lien « Guides pratiques » apparaît partout.
    if (countBefore === 0) await refreshPublicPages({ site: true });
  }
  return NextResponse.json({ id }, { status: 201 });
});
