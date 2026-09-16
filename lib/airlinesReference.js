// Référence statique de compagnies aériennes (nom + code IATA + gabarit
// d'export), pour les listes déroulantes éditables des champs Nom/IATA du
// formulaire compagnies (/admin/airlines). Couvre les partenaires actuels
// (RAM, Saudia, Turkish — voir CLAUDE.md §3) et les compagnies les plus
// courantes pour l'Omra/Hajj et les voyages organisés. Une compagnie
// absente de cette liste reste ajoutable manuellement (saisie libre, pas
// un <select> fermé).
//
// template : seules RAM/Saudia/Turkish ont un gabarit dédié
// (lib/airlineTemplates.js) — toute autre compagnie utilise generic_template.

export const AIRLINES = [
  { name: "Royal Air Maroc", iata: "AT", template: "ram_template" },
  { name: "Saudia", iata: "SV", template: "saudia_template" },
  { name: "Turkish Airlines", iata: "TK", template: "turkish_template" },
  { name: "Air Arabia Maroc", iata: "3O", template: "generic_template" },
  { name: "Air Arabia", iata: "G9", template: "generic_template" },
  { name: "flynas", iata: "XY", template: "generic_template" },
  { name: "Flyadeal", iata: "F3", template: "generic_template" },
  { name: "Emirates", iata: "EK", template: "generic_template" },
  { name: "Qatar Airways", iata: "QR", template: "generic_template" },
  { name: "Etihad Airways", iata: "EY", template: "generic_template" },
  { name: "Gulf Air", iata: "GF", template: "generic_template" },
  { name: "Kuwait Airways", iata: "KU", template: "generic_template" },
  { name: "Oman Air", iata: "WY", template: "generic_template" },
  { name: "EgyptAir", iata: "MS", template: "generic_template" },
  { name: "Air Algérie", iata: "AH", template: "generic_template" },
  { name: "Tunisair", iata: "TU", template: "generic_template" },
  { name: "Nouvelair", iata: "BJ", template: "generic_template" },
  { name: "Pegasus Airlines", iata: "PC", template: "generic_template" },
  { name: "Air France", iata: "AF", template: "generic_template" },
  { name: "KLM", iata: "KL", template: "generic_template" },
  { name: "Lufthansa", iata: "LH", template: "generic_template" },
  { name: "British Airways", iata: "BA", template: "generic_template" },
  { name: "Iberia", iata: "IB", template: "generic_template" },
  { name: "Vueling", iata: "VY", template: "generic_template" },
  { name: "TAP Air Portugal", iata: "TP", template: "generic_template" },
  { name: "ITA Airways", iata: "AZ", template: "generic_template" },
  { name: "Ryanair", iata: "FR", template: "generic_template" },
  { name: "easyJet", iata: "U2", template: "generic_template" },
  { name: "American Airlines", iata: "AA", template: "generic_template" },
  { name: "Delta Air Lines", iata: "DL", template: "generic_template" },
  { name: "United Airlines", iata: "UA", template: "generic_template" },
  { name: "Singapore Airlines", iata: "SQ", template: "generic_template" },
  { name: "Malaysia Airlines", iata: "MH", template: "generic_template" },
  { name: "Garuda Indonesia", iata: "GA", template: "generic_template" },
  { name: "Thai Airways", iata: "TG", template: "generic_template" },
  { name: "Qantas", iata: "QF", template: "generic_template" },
  { name: "Korean Air", iata: "KE", template: "generic_template" },
  { name: "Japan Airlines", iata: "JL", template: "generic_template" },
  { name: "ANA (All Nippon Airways)", iata: "NH", template: "generic_template" },
  { name: "Air China", iata: "CA", template: "generic_template" },
  { name: "China Southern Airlines", iata: "CZ", template: "generic_template" },
];

export function getAirlineByName(name) {
  return AIRLINES.find((a) => a.name.toLowerCase() === name.trim().toLowerCase()) || null;
}

export function getNameByIata(iata) {
  const match = AIRLINES.find((a) => a.iata.toLowerCase() === iata.trim().toLowerCase());
  return match?.name || null;
}
