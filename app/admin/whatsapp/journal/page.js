import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { listActiveStaff } from "@/lib/whatsapp/team";
import { localToday, shiftDay } from "@/lib/whatsapp/analytics";
import PageHeader from "../../_components/PageHeader";
import JournalView from "./JournalView";

export const dynamic = "force-dynamic";

// Journal d'audit, logs IA et audit qualité hebdomadaire (cahier §8.16).
export default async function JournalPage({ searchParams }) {
  const session = await getSession();
  if (!(await hasPermission(session, "audit.view"))) return <p className="text-sm text-zinc-500">Accès réservé.</p>;
  const params = await searchParams;
  const staff = await listActiveStaff();
  const today = localToday();
  return (
    <div className="space-y-5">
      <PageHeader
        icon="fact_check"
        title="Journal et audit IA"
        description="Qui a modifié quoi (réglages, prompts, templates, campagnes, données), ce que l'IA a fait à chaque échange, et l'audit qualité hebdomadaire de 20 conversations."
      />
      <JournalView initialTab={params?.tab || "audit"} staff={staff.map((s) => ({ id: s.id, name: s.full_name }))} defaultFrom={shiftDay(today, -6)} today={today} />
    </div>
  );
}
