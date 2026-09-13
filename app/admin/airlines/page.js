import { listAirlines } from "@/lib/airlines";
import { getSession } from "@/lib/session";
import AirlinesManager from "./AirlinesManager";

export default async function AirlinesPage() {
  const [airlines, session] = await Promise.all([listAirlines(), getSession()]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900">Compagnies aériennes</h1>
      <p className="text-sm text-zinc-500">
        Catalogue extensible — ajouter une compagnie ne nécessite aucun
        développement. Le gabarit d&apos;export détermine le format de la
        liste de réservation de billets pour cette compagnie.
      </p>
      <AirlinesManager
        initialAirlines={airlines}
        canManage={session?.role === "direction"}
      />
    </div>
  );
}
