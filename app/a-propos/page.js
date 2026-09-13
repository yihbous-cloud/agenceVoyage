export const metadata = {
  title: "À propos",
  description:
    "Golden Fantastic, agence de voyages spécialisée dans l'organisation d'Omra, de Hajj et de séjours touristiques.",
};

export default function AProposPage() {
  return (
    <main className="mx-auto max-w-3xl flex-1 px-6 py-16">
      <h1 className="text-3xl font-bold text-zinc-900">À propos de Golden Fantastic</h1>

      <div className="mt-6 space-y-4 text-zinc-700">
        <p>
          Golden Fantastic est une agence de voyages spécialisée dans
          l&apos;organisation de programmes d&apos;Omra, de Hajj et de séjours
          touristiques. Nous accompagnons nos voyageurs à chaque étape : choix
          du programme, formalités de visa, hébergement, transport et suivi
          pendant tout le séjour.
        </p>
        <p>
          Notre équipe travaille avec des hôtels partenaires proches des lieux
          saints et avec des compagnies aériennes reconnues (Royal Air Maroc,
          Saudia, Turkish Airlines) pour vous garantir un voyage serein, du
          départ jusqu&apos;au retour.
        </p>
        <p>
          Chaque programme est organisé avec attention : répartition des
          chambres, suivi des documents de visa, rappels par WhatsApp pour ne
          rien oublier avant le départ.
        </p>
      </div>

      <h2 className="mt-10 text-xl font-semibold text-zinc-900">Nos valeurs</h2>
      <ul className="mt-4 space-y-2 text-zinc-700">
        <li>— Transparence sur les prix et les prestations incluses</li>
        <li>— Accompagnement humain, joignable par WhatsApp</li>
        <li>— Sélection rigoureuse des hôtels et compagnies partenaires</li>
      </ul>
    </main>
  );
}
