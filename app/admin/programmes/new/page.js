import { listHotels } from "@/lib/hotels";
import ProgramForm from "../ProgramForm";

export default async function NewProgramPage() {
  const hotels = await listHotels();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900">Nouveau programme</h1>
      <ProgramForm hotels={hotels} />
    </div>
  );
}
