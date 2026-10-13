import { HREFLANG_TAGS, DEFAULT_LOCALE } from "../i18n/locales";
import { plainSummary } from "../markdown";

// Balisage schema.org du site public (cahier des charges référencement §10,
// CLAUDE.md §3centquatorzequadragies) : UN SEUL bloc JSON-LD par page,
// assemblé en @graph, avec des @id stables qui relient les entités entre
// elles (l'organisation, le site, la page, le fil d'Ariane, le voyage...).
// Fichier pur : chaque fonction reçoit des données déjà chargées.
//
// Règle : aucune donnée balisée qui n'apparaît pas sur la page (prix, avis,
// notes) — d'où les filtres (offre seulement si prix > 0, etc.).

export const organizationId = (baseUrl) => `${baseUrl}/#organization`;
export const websiteId = (baseUrl) => `${baseUrl}/#website`;

export function absoluteUrl(baseUrl, pathOrUrl) {
  if (!pathOrUrl) return undefined;
  try {
    return new URL(pathOrUrl, baseUrl).toString();
  } catch {
    return undefined;
  }
}

const languageTag = (locale) => HREFLANG_TAGS[locale] || HREFLANG_TAGS[DEFAULT_LOCALE];

// Date MySQL (« 2026-10-11 21:16:55 », dateStrings) → ISO 8601.
export function isoDate(value) {
  if (!value) return undefined;
  return String(value).trim().replace(" ", "T");
}

// Agence : TravelAgency (+ LocalBusiness quand l'adresse ET le téléphone
// réels sont saisis — jamais de coordonnées inventées). Champs légaux
// (raison sociale, date de création) seulement s'ils existent.
export function organizationNode({ settings, agencyName, baseUrl, description, knowsAbout = [] }) {
  const node = {
    "@type": settings?.address && settings?.phone ? ["TravelAgency", "LocalBusiness"] : "TravelAgency",
    "@id": organizationId(baseUrl),
    name: settings?.name || agencyName,
    url: baseUrl,
    description,
    areaServed: { "@type": "Country", name: "Maroc" },
  };
  if (knowsAbout.length > 0) node.knowsAbout = knowsAbout;
  if (settings?.logo_url) {
    node.logo = { "@type": "ImageObject", url: absoluteUrl(baseUrl, settings.logo_url) };
    node.image = node.logo.url;
  }
  const sameAs = [
    ...new Set((settings?.social_links || []).map((l) => l.url).filter((u) => /^https?:\/\//.test(u || ""))),
  ];
  if (sameAs.length > 0) node.sameAs = sameAs;
  if (settings?.address && settings?.phone) {
    node.telephone = String(settings.phone).split("/")[0].trim();
    node.address = {
      "@type": "PostalAddress",
      streetAddress: settings.address,
      addressLocality: settings.city || undefined,
      addressCountry: "MA",
    };
  }
  if (settings?.email) node.email = settings.email;
  if (settings?.legal_name) node.legalName = settings.legal_name;
  if (settings?.founding_date) node.foundingDate = String(settings.founding_date).slice(0, 10);
  return node;
}

export function websiteNode({ baseUrl, name, locale }) {
  return {
    "@type": "WebSite",
    "@id": websiteId(baseUrl),
    url: baseUrl,
    name,
    inLanguage: languageTag(locale),
    publisher: { "@id": organizationId(baseUrl) },
  };
}

export function webPageNode({ url, name, description, locale, baseUrl, type = "WebPage", hasBreadcrumb, mainEntityId, dateModified }) {
  return {
    "@type": type,
    "@id": `${url}#webpage`,
    url,
    name,
    description: description || undefined,
    inLanguage: languageTag(locale),
    isPartOf: { "@id": websiteId(baseUrl) },
    about: { "@id": organizationId(baseUrl) },
    breadcrumb: hasBreadcrumb ? { "@id": `${url}#breadcrumb` } : undefined,
    mainEntity: mainEntityId ? { "@id": mainEntityId } : undefined,
    dateModified: isoDate(dateModified),
  };
}

// items : [{ name, url? }] — le dernier élément (page courante) sans url.
export function breadcrumbNode(url, items) {
  return {
    "@type": "BreadcrumbList",
    "@id": `${url}#breadcrumb`,
    itemListElement: items.map((entry, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: entry.name,
      ...(entry.url ? { item: entry.url } : {}),
    })),
  };
}

// Itinéraire d'un départ : ses hôtels dans l'ordre du séjour (ville par
// ville — ex. Istanbul, Makka, Madina).
function itineraryFor(trip, baseUrl) {
  const hotels = trip?.hotels || [];
  if (hotels.length === 0) return undefined;
  return {
    "@type": "ItemList",
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    numberOfItems: hotels.length,
    itemListElement: hotels.map((stay, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Hotel",
        name: stay.hotel_name,
        image: stay.photo_url ? absoluteUrl(baseUrl, stay.photo_url) : undefined,
        address: {
          "@type": "PostalAddress",
          addressLocality: stay.city || undefined,
          addressCountry: stay.country || undefined,
        },
        ...(stay.star_rating
          ? { starRating: { "@type": "Rating", ratingValue: String(stay.star_rating).replace(/[^\d.]/g, "") || undefined } }
          : {}),
      },
    })),
  };
}

// Programme (fiche) : TouristTrip avec ses offres (prix connus seulement) et
// l'itinéraire du prochain départ.
// Offres d'une fiche : prix connus seulement (jamais d'offre à 0).
function offersFor(trips, url, baseUrl) {
  const priced = trips.filter((trip) => Number(trip.starting_price) > 0);
  if (priced.length === 0) return undefined;
  return priced.map((trip) => ({
    "@type": "Offer",
    price: Number(trip.starting_price),
    priceCurrency: trip.currency || "MAD",
    availability: trip.seats_remaining > 0 ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
    availabilityEnds: isoDate(trip.departure_date),
    url,
    seller: { "@id": organizationId(baseUrl) },
  }));
}

// Images d'une fiche : couverture puis photos de la galerie (vague 2A).
function imagesFor(program, photos, baseUrl) {
  const urls = [program.cover_image_url, ...(photos || []).map((p) => p.url)]
    .filter(Boolean)
    .map((path) => absoluteUrl(baseUrl, path))
    .filter(Boolean);
  if (urls.length === 0) return undefined;
  return urls.length === 1 ? urls[0] : [...new Set(urls)];
}

// Programme (fiche) : TouristTrip avec ses offres et l'itinéraire du
// prochain départ.
export function touristTripNode({ program, trips, url, baseUrl, photos = [] }) {
  return {
    "@type": "TouristTrip",
    "@id": `${url}#trip`,
    name: program.title,
    description: plainSummary(program.short_description || program.full_description, 300) || undefined,
    url,
    image: imagesFor(program, photos, baseUrl),
    touristType: program.family === "omra_hajj" ? (program.program_type === "hajj" ? "Hajj" : "Omra") : undefined,
    datePublished: isoDate(program.created_at),
    dateModified: isoDate(program.updated_at),
    provider: { "@id": organizationId(baseUrl) },
    itinerary: itineraryFor(trips[0], baseUrl),
    offers: offersFor(trips, url, baseUrl),
  };
}

// Vidéo de la fiche (YouTube) : seulement si sa date de mise en ligne est
// connue (uploadDate est obligatoire pour VideoObject).
export function videoObjectNode({ video, program, url, thumbnailUrl, embedUrl }) {
  if (!video || !video.video_upload_date || !thumbnailUrl) return null;
  return {
    "@type": "VideoObject",
    "@id": `${url}#video`,
    name: video.caption || program.title,
    description: video.caption || plainSummary(program.short_description || program.full_description, 300) || program.title,
    thumbnailUrl,
    uploadDate: isoDate(video.video_upload_date),
    embedUrl,
    url: video.url,
  };
}

// Avis réellement reçus et publiés (cahier §10, option Product + Offer +
// AggregateRating) : nœud seulement s'il y a au moins un avis affiché.
export function productNode({ program, trips, url, baseUrl, photos = [], reviews }) {
  if (!reviews || reviews.count === 0) return null;
  return {
    "@type": "Product",
    "@id": `${url}#product`,
    name: program.title,
    description: plainSummary(program.short_description || program.full_description, 300) || undefined,
    image: imagesFor(program, photos, baseUrl),
    brand: { "@id": organizationId(baseUrl) },
    offers: offersFor(trips, url, baseUrl),
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: reviews.average,
      reviewCount: reviews.count,
      bestRating: 5,
      worstRating: 1,
    },
    review: reviews.reviews.slice(0, 10).map((review) => ({
      "@type": "Review",
      author: { "@type": "Person", name: review.author_name },
      datePublished: isoDate(review.review_date),
      reviewBody: plainSummary(review.body, 1000),
      reviewRating: { "@type": "Rating", ratingValue: Number(review.rating), bestRating: 5, worstRating: 1 },
    })),
  };
}

export function faqNode(url, faqs) {
  if (!faqs || faqs.length === 0) return null;
  return {
    "@type": "FAQPage",
    "@id": `${url}#faq`,
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: plainSummary(faq.question, 300),
      acceptedAnswer: { "@type": "Answer", text: plainSummary(faq.answer, 2000) },
    })),
  };
}

export function newsArticleNode({ post, url, baseUrl, description }) {
  return {
    "@type": "NewsArticle",
    "@id": `${url}#article`,
    headline: post.title,
    url,
    description: description || undefined,
    image: post.cover_image_url ? absoluteUrl(baseUrl, post.cover_image_url) : undefined,
    datePublished: isoDate(post.published_at),
    dateModified: isoDate(post.updated_at || post.published_at),
    publisher: { "@id": organizationId(baseUrl) },
    mainEntityOfPage: { "@id": `${url}#webpage` },
  };
}

// Liste de pages (pilier, ville de départ, actualités) : items [{ name, url }].
export function itemListNode(url, items) {
  if (!items || items.length === 0) return null;
  return {
    "@type": "ItemList",
    "@id": `${url}#list`,
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: item.url,
    })),
  };
}

// Supprime récursivement les propriétés undefined (JSON plus propre).
function prune(value) {
  if (Array.isArray(value)) return value.map(prune);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, prune(v)])
    );
  }
  return value;
}

export function buildGraph(nodes) {
  return prune({ "@context": "https://schema.org", "@graph": nodes.filter(Boolean) });
}

// Sérialisation sûre dans un <script> : « < » échappé (doc Next json-ld.md),
// un texte saisi contenant « </script> » ne peut pas fermer la balise.
export function serializeJsonLd(data) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
