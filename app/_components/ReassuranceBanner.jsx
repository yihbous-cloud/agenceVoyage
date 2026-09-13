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

// Bandeau de confiance commun aux deux familles de catalogue (Omra & Hajj /
// Voyages organisés) et à l'accueil — ne pas dupliquer ce contenu ailleurs.
export default function ReassuranceBanner({ compact = false }) {
  return (
    <section className={compact ? "py-8" : "bg-white py-14"}>
      <div className="mx-auto max-w-5xl px-6">
        {!compact && (
          <h2 className="text-2xl font-bold text-zinc-900">
            Pourquoi choisir Golden Fantastic
          </h2>
        )}
        <div
          className={`grid gap-6 sm:grid-cols-3 ${compact ? "" : "mt-6 gap-8"}`}
        >
          {REASSURANCE.map((item) => (
            <div key={item.title}>
              <h3 className="font-semibold text-zinc-900">{item.title}</h3>
              <p className="mt-2 text-sm text-zinc-600">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
