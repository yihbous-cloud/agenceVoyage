import { notFound } from "next/navigation";
import { getTripSummary } from "@/lib/roomAssignment";
import { getTripAirlineTemplateKey } from "@/lib/listGenerators";
import { getAirlineTemplate } from "@/lib/airlineTemplates";

function DownloadLinks({ baseHref }) {
  return (
    <div className="flex gap-3">
      <a
        href={`${baseHref}?format=xlsx`}
        className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
      >
        Télécharger Excel
      </a>
      <a
        href={`${baseHref}?format=pdf`}
        className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
      >
        Télécharger PDF
      </a>
    </div>
  );
}

export default async function ListesPage({ params }) {
  const { tripId } = await params;

  const trip = await getTripSummary(tripId);
  if (!trip) {
    notFound();
  }

  const templateKey = await getTripAirlineTemplateKey(tripId);
  const template = getAirlineTemplate(templateKey);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">
          Listes — {trip.program_title}
        </h1>
        <p className="text-sm text-zinc-500">
          {trip.reference_code} · {new Date(trip.departure_date).toLocaleDateString("fr-FR")}
        </p>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-900">
          Liste complète des voyageurs
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Identité, passeport, hôtel, chambre, statut, situation financière.
        </p>
        <div className="mt-4">
          <DownloadLinks baseHref={`/api/admin/trips/${tripId}/lists/travelers`} />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-900">
          Liste de demande de visas
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Type de visa, organisme, statut et documents fournis par voyageur.
        </p>
        <div className="mt-4">
          <DownloadLinks baseHref={`/api/admin/trips/${tripId}/lists/visa`} />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-900">
          Liste compagnie aérienne
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Format : <span className="font-medium">{template.label}</span>{" "}
          (déterminé par la compagnie assignée au voyage). Seuls les inscrits
          confirmés ou payés sont inclus.
        </p>
        <div className="mt-4">
          <DownloadLinks baseHref={`/api/admin/trips/${tripId}/lists/airline`} />
        </div>
      </section>
    </div>
  );
}
