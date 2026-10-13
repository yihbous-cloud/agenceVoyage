import { normalizeDays, linesToList } from "./itineraryDays";

// Complétude d'une fiche voyage : les 10 blocs exigés par le cahier des
// charges référencement (§6.4), vague 2A — CLAUDE.md §3centdixseptquadragies.
// Fichier PUR : utilisé par l'admin (score sur la fiche programme) et par la
// santé SEO (vague 2C). Chaque bloc a un critère objectif et un conseil.
//
// Entrée normalisée :
//   program   ligne programs (langue principale)
//   nextTrip  prochain départ ouvert : { departure_date, return_date,
//             price (> 0 si connu), airline (nom ou id), baggage_allowance,
//             hotelCount }  — null s'il n'y a aucun départ ouvert
//   faqCount  questions publiées de la FAQ du programme
//   photoCount, videoCount, reviewCount  (bloc Preuves)
export const FICHE_BLOCKS = [
  { key: "entete", label: "En-tête (dates, prix, places)", hint: "Ajouter un départ ouvert avec ses dates et son prix." },
  { key: "vol", label: "Vol", hint: "Renseigner la compagnie aérienne et la franchise bagages du départ." },
  { key: "hebergement", label: "Hébergement", hint: "Attacher les hôtels du départ (page Hébergement)." },
  { key: "programme", label: "Programme jour par jour", hint: "Saisir le déroulé jour par jour dans « Contenu de la fiche »." },
  { key: "inclus", label: "Inclus / non inclus", hint: "Lister ce qui est inclus et non inclus dans le prix." },
  { key: "formalites", label: "Formalités", hint: "Saisir les formalités et leur date de vérification." },
  { key: "conditions", label: "Conditions", hint: "Saisir l'acompte, l'échéancier et les conditions d'annulation." },
  { key: "preuves", label: "Preuves (photos, avis)", hint: "Ajouter au moins 3 photos réelles et un avis client." },
  { key: "faq", label: "FAQ (5 questions ou plus)", hint: "Publier au moins 5 questions propres à ce programme." },
  { key: "action", label: "Réservation et contact", hint: "" },
];

const has = (value) => String(value ?? "").trim() !== "";

export function programCompleteness({ program, nextTrip, faqCount = 0, photoCount = 0, videoCount = 0, reviewCount = 0 }) {
  const done = {
    entete: Boolean(nextTrip && nextTrip.departure_date && nextTrip.return_date && Number(nextTrip.price) > 0),
    vol: Boolean(nextTrip && has(nextTrip.airline) && has(nextTrip.baggage_allowance)),
    hebergement: Boolean(nextTrip && nextTrip.hotelCount > 0),
    programme: Boolean(normalizeDays(program?.itinerary_days)),
    inclus: linesToList(program?.included_items).length > 0 && linesToList(program?.excluded_items).length > 0,
    formalites: has(program?.formalities) && has(program?.formalities_verified_at),
    conditions: has(program?.booking_conditions),
    preuves: photoCount + videoCount >= 3 && reviewCount > 0,
    faq: faqCount >= 5,
    // Toujours présent sur la fiche : réserver (si départ), devis, WhatsApp.
    action: true,
  };
  const blocks = FICHE_BLOCKS.map((block) => ({ ...block, done: done[block.key] }));
  return { score: blocks.filter((b) => b.done).length, total: blocks.length, blocks };
}
