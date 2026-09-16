// Référence statique de compagnies aériennes (nom + code IATA), pour les
// listes déroulantes éditables des champs Nom/IATA du formulaire compagnies
// (/admin/airlines). Couvre les partenaires actuels (RAM, Saudia, Turkish —
// voir CLAUDE.md §3) et les compagnies les plus courantes pour l'Omra/Hajj
// et les voyages organisés. Une compagnie absente de cette liste reste
// ajoutable manuellement (saisie libre, pas un <select> fermé).

export const AIRLINES = [
  { name: "Royal Air Maroc", iata: "AT" },
  { name: "Saudia", iata: "SV" },
  { name: "Turkish Airlines", iata: "TK" },
  { name: "Air Arabia Maroc", iata: "3O" },
  { name: "Air Arabia", iata: "G9" },
  { name: "flynas", iata: "XY" },
  { name: "Flyadeal", iata: "F3" },
  { name: "Emirates", iata: "EK" },
  { name: "Qatar Airways", iata: "QR" },
  { name: "Etihad Airways", iata: "EY" },
  { name: "Gulf Air", iata: "GF" },
  { name: "Kuwait Airways", iata: "KU" },
  { name: "Oman Air", iata: "WY" },
  { name: "EgyptAir", iata: "MS" },
  { name: "Air Algérie", iata: "AH" },
  { name: "Tunisair", iata: "TU" },
  { name: "Nouvelair", iata: "BJ" },
  { name: "Pegasus Airlines", iata: "PC" },
  { name: "Air France", iata: "AF" },
  { name: "KLM", iata: "KL" },
  { name: "Lufthansa", iata: "LH" },
  { name: "British Airways", iata: "BA" },
  { name: "Iberia", iata: "IB" },
  { name: "Vueling", iata: "VY" },
  { name: "TAP Air Portugal", iata: "TP" },
  { name: "ITA Airways", iata: "AZ" },
  { name: "Ryanair", iata: "FR" },
  { name: "easyJet", iata: "U2" },
  { name: "American Airlines", iata: "AA" },
  { name: "Delta Air Lines", iata: "DL" },
  { name: "United Airlines", iata: "UA" },
  { name: "Singapore Airlines", iata: "SQ" },
  { name: "Malaysia Airlines", iata: "MH" },
  { name: "Garuda Indonesia", iata: "GA" },
  { name: "Thai Airways", iata: "TG" },
  { name: "Qantas", iata: "QF" },
  { name: "Korean Air", iata: "KE" },
  { name: "Japan Airlines", iata: "JL" },
  { name: "ANA (All Nippon Airways)", iata: "NH" },
  { name: "Air China", iata: "CA" },
  { name: "China Southern Airlines", iata: "CZ" },
];

export function getIataByName(name) {
  const match = AIRLINES.find((a) => a.name.toLowerCase() === name.trim().toLowerCase());
  return match?.iata || null;
}

export function getNameByIata(iata) {
  const match = AIRLINES.find((a) => a.iata.toLowerCase() === iata.trim().toLowerCase());
  return match?.name || null;
}
