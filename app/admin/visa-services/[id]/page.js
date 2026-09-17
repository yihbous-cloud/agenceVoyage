import { notFound } from "next/navigation";
import { getVisaServiceRequestById } from "@/lib/visaServices";
import { listPaymentsForVisaService } from "@/lib/payments";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import VisaServiceManager from "./VisaServiceManager";
import GroupDueForm from "../../groupes/[id]/GroupDueForm";
import PaymentsSection from "../../inscriptions/[id]/PaymentsSection";

export default async function VisaServiceDetailPage({ params }) {
  const { id } = await params;
  const [visaService, session] = await Promise.all([
    getVisaServiceRequestById(id),
    getSession(),
  ]);

  if (!visaService) {
    notFound();
  }

  const [payments, canManage] = await Promise.all([
    listPaymentsForVisaService(id),
    hasPermission(session, "visa_services.manage"),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">{visaService.full_name}</h1>
        <p className="text-sm text-zinc-500">
          {visaService.visa_type_name}
          {visaService.country && ` (${visaService.country})`} · {visaService.phone_whatsapp}
        </p>
      </div>

      <VisaServiceManager visaService={visaService} canManage={canManage} />

      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Montant dû</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Prix du service visa ({visaService.visa_type_name} — {visaService.visa_type_price} MAD
          indicatif).
        </p>
        <div className="mt-3">
          <GroupDueForm
            apiBasePath={`/api/admin/visa-services/${visaService.id}`}
            totalDue={visaService.total_due}
            canManage={canManage}
            label="Montant dû (MAD)"
          />
        </div>
      </div>

      <PaymentsSection
        apiBasePath={`/api/admin/visa-services/${visaService.id}`}
        payments={payments}
        totalDue={visaService.total_due}
        canManage={canManage}
        title="Paiements"
      />
    </div>
  );
}
