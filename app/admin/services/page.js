import { listServices } from "@/lib/services";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import ServicesManager from "./ServicesManager";
import PageHeader from "../_components/PageHeader";

export default async function ServicesPage() {
  const [services, session] = await Promise.all([listServices(), getSession()]);
  const canManage = await hasPermission(session, "services.manage");

  return (
    <div className="space-y-6">
      <PageHeader
        icon="room_service"
        title="Catalogue de services"
        description={
          <>
            Services facturables aux voyageurs en plus du programme et du visa
            (transport local, assurance, hébergement additionnel...). Nouveau
            service ajoutable ici à tout moment.
          </>
        }
      />
      <ServicesManager initialServices={services} canManage={canManage} />
    </div>
  );
}
