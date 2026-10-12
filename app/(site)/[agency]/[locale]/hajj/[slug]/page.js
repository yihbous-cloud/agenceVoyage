import { programMetadata, renderProgramPage } from "@/app/_components/programPage";

// Fiche programme du pilier « hajj » (gabarit partagé :
// app/_components/programPage.js — CLAUDE.md §3centtreizequadragies).
export const revalidate = 300;

// Aucune fiche pré-générée au build, mais chacune est mise en cache à sa
// première visite puis régénérée toutes les 5 min (ISR) — sans cette
// fonction, Next rend la page à CHAQUE requête (doc generate-static-params).
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }) {
  return programMetadata(params);
}

export default async function HajjProgramPage({ params }) {
  return renderProgramPage(params, "hajj");
}
