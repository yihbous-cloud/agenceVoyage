import { getAgencySettings } from "@/lib/agencySettings";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import AgencySettingsForm from "./AgencySettingsForm";
import PageHeader from "../_components/PageHeader";

export default async function ParametresPage() {
  const [settings, session] = await Promise.all([getAgencySettings(), getSession()]);
  const canEdit = await hasPermission(session, "parametres.edit");

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        icon="storefront"
        title="Paramètres de l'agence"
        description={
          <>
            Ces informations apparaissent en en-tête des reçus de paiement
            imprimables (format A5).
          </>
        }
      />

      <AgencySettingsForm settings={settings} canEdit={canEdit} />
    </div>
  );
}
