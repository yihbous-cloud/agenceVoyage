import { notFound } from "next/navigation";
import { getRegistrationById } from "@/lib/registrations";
import { getSession } from "@/lib/session";
import EditRegistrationForm from "./EditRegistrationForm";

export default async function RegistrationDetailPage({ params }) {
  const { id } = await params;
  const registration = await getRegistrationById(id);
  const session = await getSession();

  if (!registration) {
    notFound();
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">{registration.full_name}</h1>
        <p className="text-sm text-zinc-500">
          {registration.program_title} — {registration.reference_code} (
          {new Date(registration.departure_date).toLocaleDateString("fr-FR")})
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-zinc-500">WhatsApp</dt>
            <dd className="font-medium text-zinc-900">{registration.phone_whatsapp}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Passeport</dt>
            <dd className="font-medium text-zinc-900">
              {registration.passport_number || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Genre</dt>
            <dd className="font-medium capitalize text-zinc-900">
              {registration.gender}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Email</dt>
            <dd className="font-medium text-zinc-900">
              {registration.traveler_email || "—"}
            </dd>
          </div>
        </dl>
      </div>

      <EditRegistrationForm registration={registration} role={session?.role} />
    </div>
  );
}
