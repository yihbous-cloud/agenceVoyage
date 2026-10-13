import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { updateNews, deleteNews, slugify, getNewsById } from "@/lib/news";
import { withNotFound } from "@/lib/apiGuard";
import { syncContentRedirects, redirectDeletedContent } from "@/lib/redirects";
import { refreshPublicPages } from "@/lib/publicRevalidation";
import { setTranslations } from "@/lib/contentTranslations";

const newsPath = (post) => `/actualites/${post.slug}`;

async function PUT_handler(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "actualites.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  if (!body.title) {
    return NextResponse.json({ message: "Le titre est requis" }, { status: 400 });
  }

  try {
    // État AVANT : redirections automatiques si le slug change ou si
    // l'article est dépublié (CLAUDE.md §3centquatorzequadragies).
    const before = await getNewsById(id);
    await updateNews(id, { ...body, slug: body.slug?.trim() || slugify(body.title) });
    const after = await getNewsById(id);
    if (body.translations !== undefined && after) {
      await setTranslations("news", id, body.translations, { baseLocale: after.content_locale });
    }
    if (before && after) {
      await syncContentRedirects({
        beforePath: newsPath(before),
        afterPath: newsPath(after),
        beforePublished: Boolean(before.is_published),
        afterPublished: Boolean(after.is_published),
        fallbackPath: "/actualites",
        staffId: session?.id || null,
      });
      await refreshPublicPages({ newsSlug: after.slug, previousNewsSlug: before.slug !== after.slug ? before.slug : null });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err?.code === "NOT_FOUND") {
      return NextResponse.json({ message: "Ressource introuvable" }, { status: 404 });
    }
    if (err.code === "ER_DUP_ENTRY") {
      return NextResponse.json(
        { message: "Ce slug existe déjà, choisissez-en un autre" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { message: "Erreur serveur", detail: err.message },
      { status: 500 }
    );
  }
}

async function DELETE_handler(request, { params }) {
  const session = await getSession();
  if (!(await hasPermission(session, "actualites.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;
  const before = await getNewsById(id);
  await deleteNews(id);
  // Un article publié supprimé redirige vers la liste des actualités.
  if (before?.is_published) {
    await redirectDeletedContent({
      path: newsPath(before),
      fallbackPath: "/actualites",
      staffId: session?.id || null,
    });
    await refreshPublicPages({ newsSlug: before.slug });
  }
  return NextResponse.json({ ok: true });
}

export const PUT = withNotFound(PUT_handler);
export const DELETE = withNotFound(DELETE_handler);
