import Link from "next/link";

export const metadata = {
  title: "Nos programmes",
  description:
    "Découvrez nos programmes Omra & Hajj ainsi que nos voyages organisés.",
};

// Le catalogue a été séparé en deux hubs dédiés (/omra-hajj et
// /voyages-organises, voir prompt de séparation du catalogue). Cette page
// n'est plus le hub principal mais reste en place (au lieu d'un simple 404)
// pour ne pas casser un lien existant vers /programmes.
export default function ProgrammesRedirectPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-1 flex-col items-center gap-6 px-6 py-24 text-center">
      <h1 className="text-3xl font-bold text-zinc-900">Nos programmes</h1>
      <p className="max-w-xl text-zinc-600">
        Nos programmes sont désormais répartis en deux catalogues dédiés :
      </p>
      <div className="flex flex-wrap justify-center gap-4">
        <Link
          href="/omra-hajj"
          className="rounded-full bg-emerald-700 px-6 py-3 font-medium text-white transition-colors hover:bg-emerald-800"
        >
          Omra &amp; Hajj
        </Link>
        <Link
          href="/voyages-organises"
          className="rounded-full bg-amber-600 px-6 py-3 font-medium text-white transition-colors hover:bg-amber-700"
        >
          Voyages organisés
        </Link>
      </div>
    </main>
  );
}
