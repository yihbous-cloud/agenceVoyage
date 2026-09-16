import { getAgencySettings } from "@/lib/agencySettings";
import { getSession } from "@/lib/session";
import AgencySettingsForm from "./AgencySettingsForm";

export default async function ParametresPage() {
  const [settings, session] = await Promise.all([getAgencySettings(), getSession()]);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Paramètres de l&apos;agence</h1>
        <p className="text-sm text-zinc-500">
          Ces informations apparaissent en en-tête des reçus de paiement
          imprimables (format A5).
        </p>
      </div>

      <AgencySettingsForm settings={settings} canEdit={session?.role === "direction"} />
    </div>
  );
}
