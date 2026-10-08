import { listHotels } from "@/lib/hotels";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import HotelsManager from "./HotelsManager";
import PageHeader from "../_components/PageHeader";

export default async function HotelsPage() {
  const [hotels, session] = await Promise.all([listHotels(), getSession()]);
  const canManage = await hasPermission(session, "hotels.manage");

  return (
    <div className="space-y-6">
      <PageHeader
        icon="hotel"
        title="Hôtels"
        description={
          <>
            Catalogue des hôtels partenaires. Un voyage peut utiliser plusieurs
            hôtels (ex. Omra : La Mecque + Médine).
          </>
        }
      />
      <HotelsManager initialHotels={hotels} canManage={canManage} />
    </div>
  );
}
