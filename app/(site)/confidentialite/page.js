export const metadata = {
  title: "Politique de confidentialité",
  robots: { index: false, follow: true },
};

export default function ConfidentialitePage() {
  return (
    <main className="mx-auto max-w-3xl flex-1 px-6 py-16 text-zinc-700">
      <h1 className="text-3xl font-bold text-zinc-900">
        Politique de confidentialité
      </h1>

      <div className="mt-6 space-y-4 text-sm">
        <p>
          Golden Fantastic collecte les informations personnelles nécessaires
          au traitement de votre inscription (nom, coordonnées, passeport,
          informations de visa) uniquement dans le cadre de l&apos;organisation
          de votre voyage.
        </p>
        <p>
          Ces informations sont conservées de manière sécurisée et ne sont
          partagées qu&apos;avec les organismes nécessaires au voyage
          (compagnies aériennes, hôtels, autorités consulaires pour les
          demandes de visa).
        </p>
        <p>
          Vous pouvez demander l&apos;accès, la rectification ou la
          suppression de vos données personnelles en nous contactant via la
          page{" "}
          <a href="/contact" className="text-emerald-700 hover:underline">
            Contact
          </a>
          .
        </p>
        <p className="text-xs text-zinc-400">
          Ce contenu est un modèle à compléter et à faire valider
          juridiquement avant mise en production.
        </p>
      </div>
    </main>
  );
}
