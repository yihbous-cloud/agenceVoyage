import { slugify } from "./slugify";

// Correspondance IATA -> ville de départ, pour les pages pSEO /villes-depart
// et le maillage interne. Liste statique volontairement limitée aux
// aéroports marocains réellement utilisés par l'agence (pas de table SQL :
// liste fixe et petite, voir PLAN-SEO-GEO-AIO.md §3).
export const AIRPORTS = {
  CMN: { city: "Casablanca", country: "Maroc" },
  RAK: { city: "Marrakech", country: "Maroc" },
  AGA: { city: "Agadir", country: "Maroc" },
  FEZ: { city: "Fès", country: "Maroc" },
  TNG: { city: "Tanger", country: "Maroc" },
  RBA: { city: "Rabat", country: "Maroc" },
  OUD: { city: "Oujda", country: "Maroc" },
  NDR: { city: "Nador", country: "Maroc" },
};

export function citySlug(city) {
  return slugify(city);
}

export function getCityByIata(iataCode) {
  return AIRPORTS[iataCode] || null;
}

export function getIataBySlug(slug) {
  const entry = Object.entries(AIRPORTS).find(
    ([, info]) => citySlug(info.city) === slug
  );
  return entry ? entry[0] : null;
}
