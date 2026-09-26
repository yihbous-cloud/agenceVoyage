"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";

const AUTOPLAY_DELAY = 6000;

const FAMILY_LABELS = {
  omra_hajj: "Omra & Hajj",
  voyage_organise: "Voyage organisé",
};

// Slider animé de l'accueil, alimenté par /admin/slider. Transition en
// fondu (toutes les diapositives sont empilées, seule l'opacité change) —
// pas de bibliothèque tierce, cohérent avec le reste du projet.
export default function HeroSlider({ slides }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef(null);

  const goTo = useCallback(
    (index) => {
      setActiveIndex((index + slides.length) % slides.length);
    },
    [slides.length]
  );

  useEffect(() => {
    if (isPaused || slides.length <= 1) return undefined;
    timerRef.current = setInterval(() => {
      setActiveIndex((i) => (i + 1) % slides.length);
    }, AUTOPLAY_DELAY);
    return () => clearInterval(timerRef.current);
  }, [isPaused, slides.length]);

  return (
    <section
      className="relative h-[80vh] min-h-[460px] w-full overflow-hidden bg-ink"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {slides.map((slide, index) => (
        <div
          key={slide.id}
          aria-hidden={index !== activeIndex}
          className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
            index === activeIndex ? "z-10 opacity-100" : "z-0 opacity-0"
          }`}
        >
          {slide.image_url ? (
            <Image
              src={slide.image_url}
              alt=""
              fill
              priority={index === 0}
              sizes="100vw"
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-ink via-ink-soft to-amber-900/40" />
          )}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(200,162,74,0.16),transparent_60%)]" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/50 to-ink/30" />

          <div className="relative flex h-full items-center justify-center px-6">
            <div className="flex max-w-3xl flex-col items-center gap-5 text-center">
              {slide.program_family && (
                <span className="text-xs font-medium tracking-[0.28em] text-gold uppercase">
                  {FAMILY_LABELS[slide.program_family]}
                </span>
              )}
              <h1 className="font-display text-4xl font-normal text-white sm:text-5xl">
                {slide.title}
              </h1>
              {slide.subtitle && (
                <p className="max-w-xl text-lg text-white/70">{slide.subtitle}</p>
              )}
              <Link
                href={slide.href}
                className="mt-2 bg-gold px-9 py-3.5 text-xs font-medium tracking-widest text-ink uppercase transition-colors hover:bg-gold-light"
              >
                {slide.button_text}
              </Link>
            </div>
          </div>
        </div>
      ))}

      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => goTo(activeIndex - 1)}
            aria-label="Diapositive précédente"
            className="absolute left-4 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center border border-white/30 text-white transition-colors hover:bg-white/10"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => goTo(activeIndex + 1)}
            aria-label="Diapositive suivante"
            className="absolute right-4 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center border border-white/30 text-white transition-colors hover:bg-white/10"
          >
            ›
          </button>

          <div className="absolute inset-x-0 bottom-6 z-20 flex justify-center gap-2">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => goTo(index)}
                aria-label={`Aller à la diapositive ${index + 1}`}
                aria-current={index === activeIndex}
                className={`h-2 rounded-full transition-all ${
                  index === activeIndex ? "w-7 bg-gold" : "w-2 bg-white/40 hover:bg-white/60"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
