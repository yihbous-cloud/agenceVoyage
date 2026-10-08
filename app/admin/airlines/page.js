import { listAirlines, listTripsWithPnrByAirline } from "@/lib/airlines";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import AirlinesManager from "./AirlinesManager";
import PageHeader from "../_components/PageHeader";

export default async function AirlinesPage() {
  const [airlines, trips, session] = await Promise.all([
    listAirlines(),
    listTripsWithPnrByAirline(),
    getSession(),
  ]);
  const canManage = await hasPermission(session, "compagnies.manage");

  return (
    <div className="space-y-6">
      <PageHeader
        icon="flight"
        title="Compagnies aériennes"
        description={
          <>
            Catalogue extensible — ajouter une compagnie ne nécessite aucun
            développement. Le gabarit d&apos;export détermine le format de la
            liste de réservation de billets pour cette compagnie.
          </>
        }
      />
      <AirlinesManager
        initialAirlines={airlines}
        trips={trips}
        canManage={canManage}
      />
    </div>
  );
}
