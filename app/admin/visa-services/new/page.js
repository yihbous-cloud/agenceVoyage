import { listActiveVisaTypes } from "@/lib/visaTypes";
import NewVisaServiceForm from "./NewVisaServiceForm";

export default async function NewVisaServicePage() {
  const visaTypes = await listActiveVisaTypes();

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900">Nouvelle demande de service visa</h1>
      <NewVisaServiceForm visaTypes={visaTypes} />
    </div>
  );
}
