export const metadata = {
  title: "Mentions légales",
  robots: { index: false, follow: true },
};

export default function MentionsLegalesPage() {
  return (
    <main className="mx-auto max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-16 text-zinc-700">
      <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl">Mentions légales</h1>

      <div className="mt-6 space-y-4 text-sm">
        <p>
          <strong>Éditeur du site :</strong> Golden Fantastic — agence de
          voyages. [Raison sociale, forme juridique, adresse du siège social,
          numéro RC/ICE à compléter].
        </p>
        <p>
          <strong>Directeur de la publication :</strong> [Nom à compléter]
        </p>
        <p>
          <strong>Hébergement :</strong> [Nom et adresse de l&apos;hébergeur à
          compléter — ex. Hostinger].
        </p>
        <p>
          <strong>Contact :</strong> voir la page{" "}
          <a href="/contact" className="text-emerald-700 hover:underline">
            Contact
          </a>
          .
        </p>
        <p className="text-xs text-zinc-400">
          Ce contenu est un modèle à compléter avec les informations légales
          exactes de l&apos;agence avant mise en production.
        </p>
      </div>
    </main>
  );
}
