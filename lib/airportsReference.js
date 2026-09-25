// Référence aéroports (nom complet + code IATA + ville), pour les zones de
// texte déroulantes des champs aéroport des formulaires voyage (aller,
// retour, escales) — le personnel n'a plus besoin de connaître le code IATA
// par cœur, il tape un nom de ville ou d'aéroport et choisit dans la liste.
// Distinct de lib/airports.js, volontairement limité aux aéroports marocains
// de départ pour le pSEO villes de départ (usage différent, ne pas fusionner).
// Liste statique couvrant le Maroc (départs) + les destinations les plus
// courantes de l'agence (voir lib/worldPlaces.js POPULAR_DESTINATION_COUNTRIES) —
// un aéroport absent de cette liste reste saisissable librement (datalist,
// pas un select fermé).
export const AIRPORTS_REFERENCE = [
  // Maroc (départs)
  { iata: "CMN", name: "Aéroport Mohammed V", city: "Casablanca" },
  { iata: "RAK", name: "Aéroport Marrakech Ménara", city: "Marrakech" },
  { iata: "AGA", name: "Aéroport Al Massira", city: "Agadir" },
  { iata: "FEZ", name: "Aéroport Fès-Saïss", city: "Fès" },
  { iata: "TNG", name: "Aéroport Ibn Battouta", city: "Tanger" },
  { iata: "RBA", name: "Aéroport Rabat-Salé", city: "Rabat" },
  { iata: "OUD", name: "Aéroport Oujda Angads", city: "Oujda" },
  { iata: "NDR", name: "Aéroport Nador Al Aroui", city: "Nador" },
  // Arabie Saoudite (Omra/Hajj)
  { iata: "JED", name: "Aéroport King Abdulaziz", city: "Jeddah" },
  { iata: "MED", name: "Aéroport Prince Mohammad Bin Abdulaziz", city: "Madina" },
  { iata: "RUH", name: "Aéroport King Khalid", city: "Riyad" },
  { iata: "DMM", name: "Aéroport King Fahd", city: "Dammam" },
  // Turquie (escale/séjour courant avant l'Arabie Saoudite)
  { iata: "IST", name: "Aéroport d'Istanbul", city: "Istanbul" },
  { iata: "SAW", name: "Aéroport Sabiha Gökçen", city: "Istanbul" },
  { iata: "AYT", name: "Aéroport d'Antalya", city: "Antalya" },
  // Émirats arabes unis / Qatar
  { iata: "DXB", name: "Aéroport International de Dubaï", city: "Dubaï" },
  { iata: "AUH", name: "Aéroport International d'Abou Dabi", city: "Abou Dabi" },
  { iata: "DOH", name: "Aéroport International Hamad", city: "Doha" },
  // Égypte
  { iata: "CAI", name: "Aéroport International du Caire", city: "Le Caire" },
  { iata: "HRG", name: "Aéroport International de Hurghada", city: "Hurghada" },
  { iata: "SSH", name: "Aéroport International de Charm el-Cheikh", city: "Charm el-Cheikh" },
  // Malaisie / Asie du Sud-Est (escale/séjour courant type Kuala Lumpur)
  { iata: "KUL", name: "Aéroport International de Kuala Lumpur", city: "Kuala Lumpur" },
  { iata: "DPS", name: "Aéroport International de Bali", city: "Bali (Denpasar)" },
  { iata: "BKK", name: "Aéroport International Suvarnabhumi", city: "Bangkok" },
  // Europe
  { iata: "CDG", name: "Aéroport Paris-Charles de Gaulle", city: "Paris" },
  { iata: "ORY", name: "Aéroport Paris-Orly", city: "Paris" },
  { iata: "MAD", name: "Aéroport Madrid-Barajas", city: "Madrid" },
  { iata: "BCN", name: "Aéroport de Barcelone-El Prat", city: "Barcelone" },
  { iata: "FCO", name: "Aéroport Rome-Fiumicino", city: "Rome" },
  // Tunisie / Algérie
  { iata: "TUN", name: "Aéroport de Tunis-Carthage", city: "Tunis" },
  { iata: "ALG", name: "Aéroport d'Alger Houari Boumediene", city: "Alger" },
];

export function formatAirportOption(airport) {
  return `${airport.name} (${airport.iata}) — ${airport.city}`;
}

export function findAirportByIata(iata) {
  if (!iata) return null;
  return AIRPORTS_REFERENCE.find((a) => a.iata === iata.toUpperCase()) || null;
}

// Reconstruit le texte affiché dans le champ à partir du code IATA stocké
// (édition d'un voyage existant) — retombe sur le code brut si l'aéroport
// n'est pas dans la référence (saisie libre déjà utilisée avant cette liste).
export function airportInputValue(iata) {
  if (!iata) return "";
  const found = findAirportByIata(iata);
  return found ? formatAirportOption(found) : iata;
}

// Extrait le code IATA à partir du texte du champ (ex: "Aéroport d'Istanbul
// (IST) — Istanbul" -> "IST") — accepte aussi un code brut tapé directement
// (compatibilité avec l'ancienne saisie libre à 3 lettres).
export function extractIataFromInput(value) {
  if (!value) return "";
  const match = value.match(/\(([A-Za-z]{3})\)/);
  if (match) return match[1].toUpperCase();
  const trimmed = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(trimmed) ? trimmed : trimmed.slice(0, 3);
}
