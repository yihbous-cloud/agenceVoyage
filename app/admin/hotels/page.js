import { listHotels } from "@/lib/hotels";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import HotelsManager from "./HotelsManager";

export default async function HotelsPage() {
  const [hotels, session] = await Promise.all([listHotels(), getSession()]);
  const canManage = await hasPermission(session, "hotels.manage");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900">Hôtels</h1>
      <p className="text-sm text-zinc-500">
        Catalogue des hôtels partenaires. Un voyage peut utiliser plusieurs
        hôtels (ex. Omra : La Mecque + Médine).
      </p>
      <HotelsManager initialHotels={hotels} canManage={canManage} />
    </div>
  );
}
