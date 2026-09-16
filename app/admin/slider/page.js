import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { listAllSlides } from "@/lib/slides";
import { listPublishedProgramsForSelect } from "@/lib/programs";
import SlidesManager from "./SlidesManager";

export default async function SliderPage() {
  const session = await getSession();
  if (!(await hasPermission(session, "slider.manage"))) {
    redirect("/admin");
  }

  const [slides, programs] = await Promise.all([
    listAllSlides(),
    listPublishedProgramsForSelect(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Slider de l&apos;accueil</h1>
        <p className="text-sm text-zinc-500">
          Diapositives du grand visuel animé en haut de la page d&apos;accueil.
          Liez chaque diapositive à un programme existant (le lien reste
          toujours correct même si son slug change) ou saisissez une URL
          personnalisée.
        </p>
      </div>

      <SlidesManager initialSlides={slides} programs={programs} />
    </div>
  );
}
