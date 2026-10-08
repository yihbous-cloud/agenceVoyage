import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { listAllSlides } from "@/lib/slides";
import { listPublishedProgramsForSelect } from "@/lib/programs";
import SlidesManager from "./SlidesManager";
import PageHeader from "../_components/PageHeader";

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
      <PageHeader
        icon="view_carousel"
        title="Slider de l'accueil"
        description={
          <>
            Diapositives du grand visuel animé en haut de la page d&apos;accueil.
            Liez chaque diapositive à un programme existant (le lien reste
            toujours correct même si son slug change) ou saisissez une URL
            personnalisée.
          </>
        }
      />

      <SlidesManager initialSlides={slides} programs={programs} />
    </div>
  );
}
