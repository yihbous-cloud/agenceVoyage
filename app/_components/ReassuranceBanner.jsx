const REASSURANCE = [
  {
    title: "Accompagnement complet",
    description:
      "Vols, hébergement, transport et visa pris en charge du premier jour au retour.",
  },
  {
    title: "Hôtels proches des lieux saints",
    description:
      "Une sélection d'hôtels à proximité du Haram pour l'Omra et le Hajj.",
  },
  {
    title: "Suivi personnalisé",
    description:
      "Une équipe joignable par WhatsApp pour répondre à vos questions avant et pendant le voyage.",
  },
];

// Bandeau de confiance commun à l'accueil et aux hubs de catalogue (Omra &
// Hajj / Voyages organisés) — ne pas dupliquer ce contenu ailleurs.
// `dark` adapte les couleurs de texte quand le bandeau est posé sur un fond
// sombre (bg-ink/bg-ink-soft), `compact` retire le fond et le padding pour
// s'intégrer directement sous un titre de page.
export default function ReassuranceBanner({ compact = false, dark = false }) {
  const wrapperClass = compact
    ? "py-8"
    : `py-14 ${dark ? "bg-ink-soft" : "bg-cream-card"}`;
  const titleClass = dark ? "text-white" : "text-ink";
  const descClass = dark ? "text-white/60" : "text-muted";

  return (
    <section className={wrapperClass}>
      <div className="mx-auto max-w-5xl px-6">
        <div className="grid gap-10 sm:grid-cols-3">
          {REASSURANCE.map((item) => (
            <div key={item.title} className="text-center">
              <div className="mx-auto h-px w-10 bg-gold" />
              <h3 className={`mt-4 font-display text-lg font-normal ${titleClass}`}>
                {item.title}
              </h3>
              <p className={`mt-2 text-sm ${descClass}`}>{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
