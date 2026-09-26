export const metadata = {
  title: "Questions fréquentes",
  description:
    "Réponses aux questions fréquentes sur nos programmes Omra, Hajj et séjours touristiques : visa, documents, paiement, hébergement.",
};

const FAQ_ITEMS = [
  {
    question: "Quels documents sont nécessaires pour l'Omra ?",
    answer:
      "Un passeport valide au moins 6 mois après la date de retour, une photo d'identité récente sur fond blanc, et selon le type de visa, un certificat de vaccination. La liste exacte est confirmée lors de l'inscription selon le type de visa applicable.",
  },
  {
    question: "Comment se déroule la réservation en ligne ?",
    answer:
      "Vous choisissez un programme et un départ sur la page du programme, remplissez vos coordonnées, puis notre équipe vous contacte sur WhatsApp pour finaliser l'inscription et le paiement.",
  },
  {
    question: "Quels sont les modes de paiement acceptés ?",
    answer:
      "Espèces, virement bancaire, chèque ou carte, selon les modalités convenues avec notre équipe lors de l'inscription. Un paiement en plusieurs fois est possible.",
  },
  {
    question: "Comment sont réparties les chambres ?",
    answer:
      "Les chambres sont réparties par genre (jamais mixtes) selon le type choisi (simple, double, triple, quadruple). La répartition est faite par notre équipe et peut être ajustée sur demande avant le départ.",
  },
  {
    question: "Puis-je annuler ou modifier ma réservation ?",
    answer:
      "Contactez notre équipe dès que possible par WhatsApp ou via la page contact. Les conditions d'annulation dépendent du programme et de la date de départ.",
  },
];

export default function FaqPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <main className="mx-auto max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl">Questions fréquentes</h1>

      <div className="mt-8 space-y-6">
        {FAQ_ITEMS.map((item) => (
          <div key={item.question} className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-6">
            <h2 className="font-semibold text-zinc-900">{item.question}</h2>
            <p className="mt-2 text-sm text-zinc-600">{item.answer}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
