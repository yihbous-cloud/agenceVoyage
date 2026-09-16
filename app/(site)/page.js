import Link from "next/link";
import Image from "next/image";
import { getProgramsByFamily } from "@/lib/programs";
import { listPublishedNews } from "@/lib/news";
import { listActiveSlides } from "@/lib/slides";
import HomeShowcaseCard from "@/app/_components/HomeShowcaseCard";
import ReassuranceBanner from "@/app/_components/ReassuranceBanner";
import HeroSlider from "@/app/_components/HeroSlider";

export const revalidate = 300;

export default async function Home() {
  const [omraHajjPrograms, voyagePrograms, news, slides] = await Promise.all([
    getProgramsByFamily("omra_hajj", { limit: 3 }).catch(() => []),
    getProgramsByFamily("voyage_organise", { limit: 3 }).catch(() => []),
    listPublishedNews().catch(() => []),
    listActiveSlides().catch(() => []),
  ]);

  const latestNews = news.slice(0, 3);

  return (
    <main id="top" className="flex-1 bg-cream">
      {/* Hero : slider animé (/admin/slider) si des diapositives actives
          existent, sinon repli sur le hero statique historique. */}
      {slides.length > 0 ? (
        <HeroSlider slides={slides} />
      ) : (
        <section className="relative overflow-hidden bg-ink py-28">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(200,162,74,0.16),transparent_60%)]" />
          <div className="absolute inset-0 opacity-[0.06] bg-[repeating-linear-gradient(135deg,#E9D9AE_0px,#E9D9AE_1px,transparent_1px,transparent_26px)]" />
          <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 text-center">
            <span className="font-script text-6xl leading-none text-gold">
              Golden Fantastic
            </span>
            <h1 className="font-display text-4xl font-normal text-white sm:text-5xl">
              L&apos;Omra, le Hajj et vos voyages, réservés en toute confiance
            </h1>
            <p className="max-w-xl text-lg text-white/70">
              Programmes Omra &amp; Hajj et voyages organisés, accompagnement
              complet du départ au retour.
            </p>
          </div>
        </section>
      )}

      {/* Accès rapide aux deux catalogues */}
      <section className="relative z-10 mx-auto -mt-14 max-w-3xl px-6">
        <div className="grid gap-px bg-ink p-2 sm:grid-cols-2">
          <Link
            href="/omra-hajj"
            className="group flex items-center justify-between bg-cream-card px-7 py-6 transition-colors hover:bg-gold-pale/50"
          >
            <div>
              <div className="text-xs tracking-widest text-muted uppercase">
                Catalogue
              </div>
              <div className="mt-1 font-display text-xl text-ink">
                Omra &amp; Hajj
              </div>
            </div>
            <span className="text-gold transition-transform group-hover:translate-x-1">
              →
            </span>
          </Link>
          <Link
            href="/voyages-organises"
            className="group flex items-center justify-between bg-cream-card px-7 py-6 transition-colors hover:bg-gold-pale/50"
          >
            <div>
              <div className="text-xs tracking-widest text-muted uppercase">
                Catalogue
              </div>
              <div className="mt-1 font-display text-xl text-ink">
                Voyages organisés
              </div>
            </div>
            <span className="text-gold transition-transform group-hover:translate-x-1">
              →
            </span>
          </Link>
        </div>
      </section>

      {/* Omra & Hajj */}
      {omraHajjPrograms.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 py-24">
          <div className="text-center">
            <div className="font-script text-5xl leading-none text-gold">
              Omra &amp; Hajj
            </div>
            <div className="mt-2 font-display text-sm tracking-[0.28em] text-muted uppercase">
              Formules par saison du calendrier hégirien
            </div>
          </div>
          <div className="mt-14 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
            {omraHajjPrograms.map((program) => (
              <HomeShowcaseCard key={program.id} program={program} />
            ))}
          </div>
          <div className="mt-10 flex justify-center">
            <Link
              href="/omra-hajj"
              className="border border-gold px-9 py-3.5 text-xs tracking-widest text-[#A8863C] uppercase transition-colors hover:bg-gold hover:text-ink"
            >
              Voir tous les programmes
            </Link>
          </div>
        </section>
      )}

      {/* Voyages organisés */}
      {voyagePrograms.length > 0 && (
        <section className="bg-ink py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="text-center">
              <div className="font-script text-5xl leading-none text-gold">
                Voyages organisés
              </div>
              <div className="mt-2 font-display text-sm tracking-[0.28em] text-white/60 uppercase">
                Par destination, par envie
              </div>
            </div>
            <div className="mt-14 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
              {voyagePrograms.map((program) => (
                <HomeShowcaseCard key={program.id} program={program} />
              ))}
            </div>
            <div className="mt-10 flex justify-center">
              <Link
                href="/voyages-organises"
                className="border border-gold px-9 py-3.5 text-xs tracking-widest text-gold uppercase transition-colors hover:bg-gold hover:text-ink"
              >
                Voir tous les voyages
              </Link>
            </div>
          </div>
        </section>
      )}

      <ReassuranceBanner />

      {/* Actualités */}
      {latestNews.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-normal text-ink">
              Actualités
            </h2>
            <Link
              href="/actualites"
              className="text-sm font-medium text-[#A8863C] hover:underline"
            >
              Voir tout
            </Link>
          </div>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {latestNews.map((post) => (
              <Link
                key={post.id}
                href={`/actualites/${post.slug}`}
                className="group relative h-72 overflow-hidden border border-gold-pale/60"
              >
                {post.cover_image_url ? (
                  <Image
                    src={post.cover_image_url}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 33vw, 100vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-gold-pale via-cream-card to-gold/30" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <h3 className="font-display text-lg font-normal text-white">
                    {post.title}
                  </h3>
                  {post.excerpt && (
                    <p className="mt-1 line-clamp-2 text-sm text-white/70">
                      {post.excerpt}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Contact */}
      <section className="border-t border-gold/20 bg-ink-soft py-20">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 px-6 text-center">
          <span className="font-script text-5xl leading-none text-gold">
            Parlons de votre voyage
          </span>
          <p className="max-w-xl text-white/70">
            Nos conseillers vous accompagnent pour choisir le programme adapté
            à votre projet — réponse sous 24 h.
          </p>
          <Link
            href="/contact"
            className="bg-gold px-9 py-3.5 text-xs font-medium tracking-widest text-ink uppercase transition-colors hover:bg-gold-light"
          >
            Nous contacter
          </Link>
        </div>
      </section>

      <a
        href="#top"
        aria-label="Retour en haut"
        className="fixed right-6 bottom-6 z-50 flex h-14 w-14 items-center justify-center border border-gold bg-ink text-xl text-gold shadow-lg"
      >
        ↑
      </a>
    </main>
  );
}
