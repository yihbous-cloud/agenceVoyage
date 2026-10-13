import { notFound, permanentRedirect } from "next/navigation";
import { requirePublicAgency } from "@/lib/publicAgency";
import {
  getProgramBySlug,
  getOpenTripsForProgram,
  getPastTripsForProgram,
  getProgramSuggestions,
} from "@/lib/programs";
import { listPublishedFaqsForProgram } from "@/lib/programFaqs";
import { listProgramMedia } from "@/lib/programMedia";
import { listPublishedReviews } from "@/lib/programReviews";
import { getAgencySettings } from "@/lib/agencySettings";
import { computeDuration, formatDate } from "./formatTrip";
import { programPath, programPillar } from "@/lib/programUrls";
import { canonicalLocaleFor } from "@/lib/i18n/contentLocale";
import { localizePath, INTL_TAGS } from "@/lib/i18n/locales";
import { makeTranslator } from "@/lib/i18n/translate";
import { pageAlternates, buildSocialMetadata } from "@/lib/i18n/seo";
import { plainSummary, truncateText } from "@/lib/markdown";
import ProgramDetail from "./ProgramDetail";

// Fiche programme publique, partagée par les trois piliers (/omra/[slug],
// /hajj/[slug], /voyages-organises/[slug] — CLAUDE.md §3centtreizequadragies).
// `pillar` : "omra" | "hajj" | "voyage" (lib/programUrls.js). Un programme
// ouvert sous le mauvais pilier (type changé dans l'admin, ancien lien) est
// redirigé de façon permanente vers le bon, jamais affiché en double.

// Programme dans la langue de la page (traduction si elle existe, vague 1B)
// avec ses langues disponibles (available_locales).
async function loadProgram(subdomain, slug, locale) {
  const agencyRow = await requirePublicAgency(subdomain);
  const program = await getProgramBySlug(slug, agencyRow.id, locale).catch(() => null);
  return { agencyRow, program };
}

export async function programMetadata(params) {
  const { agency: subdomain, locale, slug } = await params;
  const { agencyRow, program } = await loadProgram(subdomain, slug, locale);

  if (!program) {
    return { title: makeTranslator(locale, "public", { brandName: agencyRow.name })("Programme introuvable") };
  }

  const alternates = pageAlternates(locale, programPath(program), {
    availableLocales: program.available_locales,
  });
  const description = program.meta_description || (await defaultDescription(program, agencyRow, locale));

  return {
    // Un titre SEO saisi dans l'admin est utilisé tel quel (il contient déjà
    // la marque) : le gabarit « … | marque » du layout l'aurait doublée.
    title: program.meta_title ? { absolute: program.meta_title } : program.title,
    description,
    alternates,
    ...buildSocialMetadata({
      locale,
      siteName: agencyRow.name,
      title: program.meta_title || program.title,
      description,
      url: alternates.canonical,
      image: program.cover_image_url,
      logoUrl: agencyRow.logo_url,
    }),
  };
}

// Description par défaut quand aucune n'est saisie (cahier §6.3) : durée,
// prochain départ et prix « à partir de » en tête, puis le résumé du
// programme — 155 caractères maximum.
async function defaultDescription(program, agencyRow, locale) {
  const summary = plainSummary(program.short_description || program.full_description, 300);
  const trips = await getOpenTripsForProgram(program.id, agencyRow.id, locale).catch(() => []);
  const next = trips[0];
  if (!next) return truncateText(summary, 155);
  const tr = makeTranslator(locale, "public", { brandName: agencyRow.name });
  const priced = trips.filter((t) => Number(t.starting_price) > 0).map((t) => Number(t.starting_price));
  const duration = computeDuration(next.departure_date, next.return_date);
  const facts = [
    duration ? tr.plural("{count} jour", "{count} jours", duration.days) : null,
    tr("départ le {date}", { date: formatDate(next.departure_date, INTL_TAGS[locale]) }),
    priced.length > 0 ? `${tr("à partir de")} ${Math.min(...priced)} ${tr(next.currency || "MAD")}` : null,
  ].filter(Boolean);
  return truncateText(`${program.title} : ${facts.join(", ")}. ${summary}`, 155);
}

export async function renderProgramPage(params, pillar) {
  const { agency: subdomain, locale, slug } = await params;
  const { agencyRow, program } = await loadProgram(subdomain, slug, locale);

  if (!program) {
    notFound();
  }
  if (programPillar(program) !== pillar) {
    permanentRedirect(localizePath(programPath(program), locale));
  }

  const [trips, faqs, media, reviews, settings] = await Promise.all([
    getOpenTripsForProgram(program.id, agencyRow.id, locale).catch(() => []),
    listPublishedFaqsForProgram(program.id, agencyRow.id, locale).catch(() => []),
    listProgramMedia(program.id, agencyRow.id).catch(() => []),
    listPublishedReviews(program.id, agencyRow.id).catch(() => null),
    getAgencySettings(agencyRow.id).catch(() => null),
  ]);

  // TECH-09 : plus aucun départ ouvert → départs terminés + suite proposée
  // (programme successeur, ou autres programmes du même pilier).
  const [pastTrips, { successor, suggestions }] =
    trips.length === 0
      ? await Promise.all([
          getPastTripsForProgram(program.id, agencyRow.id).catch(() => []),
          getProgramSuggestions(program, agencyRow.id, 3, locale).catch(() => ({ successor: null, suggestions: [] })),
        ])
      : [[], { successor: null, suggestions: [] }];

  return (
    <ProgramDetail
      program={program}
      trips={trips}
      family={program.family}
      faqs={faqs}
      locale={locale}
      agency={{ id: agencyRow.id, name: agencyRow.name, subdomain }}
      canonicalLocale={canonicalLocaleFor(locale, program)}
      pastTrips={pastTrips}
      successor={successor}
      suggestions={suggestions}
      media={media}
      reviews={reviews}
      contact={{
        whatsapp: settings?.whatsapp || null,
        hasCgv: Boolean(settings?.cgv_fr?.trim() || settings?.cgv_ar?.trim()),
      }}
    />
  );
}
