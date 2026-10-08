import { getSession } from "@/lib/session";
import PageHeader from "../_components/PageHeader";
import SecurityManager from "./SecurityManager";

export const dynamic = "force-dynamic";

// Sécurité du compte : double authentification (NF-07). Seule page
// accessible tant qu'un rôle qui l'exige ne l'a pas activée (proxy.js).
export default async function SecurityPage() {
  const session = await getSession();
  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        icon="shield"
        title="Sécurité du compte"
        description="Double authentification : à chaque connexion, un code à 6 chiffres généré par une application (Google Authenticator, Microsoft Authenticator...) est demandé en plus du mot de passe."
      />
      <SecurityManager mustSetup={Boolean(session?.mfaSetupRequired)} />
    </div>
  );
}
