import { listProgramsForSelect } from "@/lib/visaTypes";
import VisaTypeForm from "../VisaTypeForm";

export default async function NewVisaTypePage() {
  const programs = await listProgramsForSelect();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900">Nouveau type de visa</h1>
      <VisaTypeForm programs={programs} />
    </div>
  );
}
