"use client";

import { useState } from "react";
import { youtubeId, youtubeThumbnail, youtubeEmbedUrl } from "@/lib/videoUrls";
import { useLocale } from "./LocaleProvider";

// Vidéo YouTube d'une fiche (bloc « Preuves », vague 2A) en façade : seule
// la vignette est chargée ; le lecteur (youtube-nocookie) ne l'est qu'au
// clic — pas de script tiers ni de cookie au chargement de la page (CWV).
export default function VideoFacade({ url, title }) {
  const { tr } = useLocale();
  const [playing, setPlaying] = useState(false);
  const id = youtubeId(url);
  if (!id) return null;

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-ink">
      {playing ? (
        <iframe
          src={`${youtubeEmbedUrl(id)}?autoplay=1&rel=0`}
          title={title || tr("Vidéo")}
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="group absolute inset-0 h-full w-full"
          aria-label={tr("Lire la vidéo")}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- vignette externe (i.ytimg.com) */}
          <img
            src={youtubeThumbnail(id)}
            alt={title || ""}
            loading="lazy"
            className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
          />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gold text-ink shadow-lg">
              <svg viewBox="0 0 24 24" className="ms-1 h-7 w-7" fill="currentColor" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
