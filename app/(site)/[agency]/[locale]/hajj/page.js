import { omraHajjHubMetadata, renderOmraHajjHub } from "@/app/_components/omraHajjHub";

// Pilier public « Hajj » (gabarit partagé : app/_components/omraHajjHub.js —
// CLAUDE.md §3centtreizequadragies).
export const revalidate = 300;

export async function generateMetadata({ params }) {
  return omraHajjHubMetadata(params, "hajj");
}

export default async function HajjHubPage({ params }) {
  return renderOmraHajjHub(params, undefined, "hajj");
}
