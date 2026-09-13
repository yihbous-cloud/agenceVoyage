import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-5xl flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
        Golden Fantastic
      </h1>
      <p className="max-w-2xl text-lg text-zinc-600">
        Omra, Hajj et séjours touristiques organisés. Découvrez nos prochains
        départs et réservez votre place en ligne.
      </p>
      <Link
        href="/programmes"
        className="rounded-full bg-emerald-700 px-6 py-3 font-medium text-white transition-colors hover:bg-emerald-800"
      >
        Voir nos programmes
      </Link>
    </main>
  );
}
