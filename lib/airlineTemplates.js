// Chaque compagnie aérienne exige un format de liste différent pour la
// réservation des billets (CLAUDE.md section 3). Le champ
// `airlines.export_template_key` sélectionne le gabarit ci-dessous.
// Nouveau gabarit = ajouter une entrée ici, aucun changement de schéma.

export const AIRLINE_TEMPLATES = {
  ram_template: {
    label: "Royal Air Maroc",
    columns: [
      { key: "full_name_arabic", header: "Nom complet (arabe)" },
      { key: "full_name", header: "Nom complet (latin)" },
      { key: "gender", header: "Sexe" },
      { key: "date_of_birth", header: "Date de naissance" },
      { key: "passport_number", header: "N° Passeport" },
      { key: "passport_expiry_date", header: "Expiration passeport" },
      { key: "departure_date", header: "Date de départ" },
      { key: "return_date", header: "Date de retour" },
    ],
  },
  saudia_template: {
    label: "Saudia",
    columns: [
      { key: "full_name_arabic", header: "Full Name (Arabic)" },
      { key: "full_name", header: "Full Name (Latin)" },
      { key: "passport_number", header: "Passport Number" },
      { key: "passport_expiry_date", header: "Passport Expiry" },
      { key: "date_of_birth", header: "Date of Birth" },
      { key: "gender", header: "Gender" },
      { key: "departure_date", header: "Departure" },
      { key: "return_date", header: "Return" },
    ],
  },
  turkish_template: {
    label: "Turkish Airlines",
    columns: [
      { key: "full_name", header: "Passenger Name" },
      { key: "gender", header: "Gender" },
      { key: "date_of_birth", header: "Date of Birth" },
      { key: "passport_number", header: "Passport No" },
      { key: "passport_expiry_date", header: "Passport Expiry" },
      { key: "departure_date", header: "Departure Date" },
      { key: "return_date", header: "Return Date" },
    ],
  },
  generic_template: {
    label: "Générique",
    columns: [
      { key: "full_name", header: "Nom complet" },
      { key: "full_name_arabic", header: "Nom (arabe)" },
      { key: "gender", header: "Genre" },
      { key: "date_of_birth", header: "Date de naissance" },
      { key: "passport_number", header: "N° Passeport" },
      { key: "passport_expiry_date", header: "Expiration passeport" },
      { key: "departure_date", header: "Départ" },
      { key: "return_date", header: "Retour" },
    ],
  },
};

export function getAirlineTemplate(key) {
  return AIRLINE_TEMPLATES[key] || AIRLINE_TEMPLATES.generic_template;
}
