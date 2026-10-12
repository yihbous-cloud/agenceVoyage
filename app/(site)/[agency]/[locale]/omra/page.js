import { omraHajjHubMetadata, renderOmraHajjHub } from "@/app/_components/omraHajjHub";

// Pilier public « Omra » (gabarit partagé : app/_components/omraHajjHub.js —
// CLAUDE.md §3centtreizequadragies).
export const revalidate = 300;

export async function generateMetadata({ params }) {
  return omraHajjHubMetadata(params, "omra");
}

export default async function OmraHubPage({ params, searchParams }) {
  return renderOmraHajjHub(params, searchParams, "omra");
}
