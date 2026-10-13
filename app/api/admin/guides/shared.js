import { NextResponse } from "next/server";
import { GUIDE_HUB_PATH, GUIDE_PILLAR_PATHS, guidePath } from "@/lib/editorial";

// Pages publiques d'un guide : sa page (en premier), le hub, son pilier.
export function guidePublicPaths(guide) {
  return [guidePath(guide.slug), GUIDE_HUB_PATH, GUIDE_PILLAR_PATHS[guide.pillar]].filter(Boolean);
}

// Où renvoyer l'adresse d'un guide dépublié ou supprimé : son pilier, sinon
// le hub des guides.
export const guideFallbackPath = (guide) => GUIDE_PILLAR_PATHS[guide.pillar] || GUIDE_HUB_PATH;

export const duplicateSlugResponse = () =>
  NextResponse.json({ message: "Ce slug existe déjà, choisissez-en un autre" }, { status: 409 });
