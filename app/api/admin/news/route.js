import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { listAllNews, createNews, slugify } from "@/lib/news";
import { withNotFound } from "@/lib/apiGuard";
import { removeRedirectsFrom } from "@/lib/redirects";
import { refreshPublicPages } from "@/lib/publicRevalidation";

async function GET_handler() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
  }
  const news = await listAllNews();
  return NextResponse.json(news);
}

async function POST_handler(request) {
  const session = await getSession();
  if (!(await hasPermission(session, "actualites.manage"))) {
    return NextResponse.json({ message: "Non autorisé" }, { status: 403 });
  }

  const body = await request.json();
  if (!body.title) {
    return NextResponse.json({ message: "Le titre est requis" }, { status: 400 });
  }

  try {
    const slug = body.slug?.trim() || slugify(body.title);
    const id = await createNews({ ...body, slug });
    // Publié dès la création : son URL redevient vivante (une ancienne
    // redirection ne doit pas la masquer) et la liste est rafraîchie.
    if (body.isPublished) {
      await removeRedirectsFrom([`/actualites/${slug}`]);
      await refreshPublicPages({ newsSlug: slug });
    }
    return NextResponse.json({ id }, { status: 201 });
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

export const GET = withNotFound(GET_handler);
export const POST = withNotFound(POST_handler);
