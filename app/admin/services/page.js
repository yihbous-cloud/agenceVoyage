import { listServices } from "@/lib/services";
import { getSession } from "@/lib/session";
import ServicesManager from "./ServicesManager";

export default async function ServicesPage() {
  const [services, session] = await Promise.all([listServices(), getSession()]);
  const canManage = ["direction", "comptabilite"].includes(session?.role);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900">Catalogue de services</h1>
      <p className="text-sm text-zinc-500">
        Services facturables aux voyageurs en plus du programme et du visa
        (transport local, assurance, hébergement additionnel...). Nouveau
        service ajoutable ici à tout moment.
      </p>
      <ServicesManager initialServices={services} canManage={canManage} />
    </div>
  );
}
