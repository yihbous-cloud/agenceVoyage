import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { listLinks } from "@/lib/whatsapp/links";
import PageHeader from "../../_components/PageHeader";
import LinksManager from "./LinksManager";

export const dynamic = "force-dynamic";

// Liens wa.me et QR codes par source (écran 8.7, CP-07).
export default async function LinksPage() {
  const session = await getSession();
  if (!(await hasPermission(session, "whatsapp.links"))) return <p className="text-sm text-zinc-500">Accès réservé.</p>;
  const links = await listLinks();
  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        icon="qr_code_2"
        title="Liens WhatsApp et QR codes"
        description="Un lien par support (flyer, affiche, page Facebook...) : le message pré-rempli contient le code source, qui est attribué au contact dès son premier message."
      />
      <LinksManager initialLinks={JSON.parse(JSON.stringify(links))} />
    </div>
  );
}
