import { notFound } from "next/navigation";
import { getVisaTypeWithDocuments, listProgramsForSelect } from "@/lib/visaTypes";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import VisaTypeForm from "../VisaTypeForm";

export default async function EditVisaTypePage({ params }) {
  const { id } = await params;
  const [visaType, programs, session] = await Promise.all([
    getVisaTypeWithDocuments(id),
    listProgramsForSelect(),
    getSession(),
  ]);

  if (!visaType) {
    notFound();
  }

  const canManage = await hasPermission(session, "visa_types.manage");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900">{visaType.name}</h1>
      <VisaTypeForm
        visaType={visaType}
        programs={programs}
        canDelete={canManage}
      />
    </div>
  );
}
