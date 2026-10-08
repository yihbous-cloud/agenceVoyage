// English translations of the public site. Key = exact FRENCH source text used
// in tr("...") ; {variables} must be kept as-is.
// Coverage check: node scripts/i18n-check.mjs public
export const publicEn = {
  // --- Navigation, header, footer ---
  "Omra & Hajj": "Umrah & Hajj",
  "Voyages organisés": "Organized trips",
  "À propos": "About us",
  "Actualités": "News",
  "FAQ": "FAQ",
  "Contact": "Contact",
  "Devis gratuit": "Free quote",
  "Menu": "Menu",
  "Fermer": "Close",
  "Langue": "Language",
  "Golden Fantastic — Votre voyage, notre passion.": "Golden Fantastic — Your journey, our passion.",
  "Suivez-nous": "Follow us",
  "Liens rapides": "Quick links",
  "Informations": "Information",
  "Mentions légales": "Legal notice",
  "Tous droits réservés": "All rights reserved",
  "Confidentialité": "Privacy",
  "WhatsApp": "WhatsApp",
  "Email": "Email",
  "Adresse": "Address",
  "Téléphone": "Phone",
  "à compléter dans /admin/parametres": "to be completed in /admin/parametres",
  "Accueil": "Home",

  // --- Metadata / general ---
  "Agence de voyages": "Travel agency",
  "Golden Fantastic, agence de voyages spécialisée Omra, Hajj et séjours touristiques.":
    "Golden Fantastic, a travel agency specialised in Umrah, Hajj and tourist stays.",
  "Agence de voyages spécialisée dans l'organisation d'Omra, de Hajj et de séjours touristiques.":
    "Travel agency specialised in organising Umrah, Hajj and tourist stays.",

  // --- Home ---
  "L'Omra, le Hajj et vos voyages, réservés en toute confiance":
    "Umrah, Hajj and your trips, booked with complete confidence",
  "Programmes Omra & Hajj et voyages organisés, accompagnement complet du départ au retour.":
    "Umrah & Hajj programmes and organized trips, with full support from departure to return.",
  "Catalogue": "Catalogue",
  "Formules par saison du calendrier hégirien": "Packages by season of the Hijri calendar",
  "Voir tous les programmes": "View all programmes",
  "Par destination, par envie": "By destination, by desire",
  "Voir tous les voyages": "View all trips",
  "Voir tout": "View all",
  "Parlons de votre voyage": "Let's talk about your trip",
  "Nos conseillers vous accompagnent pour choisir le programme adapté à votre projet — réponse sous 24 h.":
    "Our advisers help you choose the programme that suits your plans — reply within 24 hours.",
  "Nous contacter": "Contact us",
  "Retour en haut": "Back to top",

  // --- Reassurance ---
  "Accompagnement complet": "Full support",
  "Vols, hébergement, transport et visa pris en charge du premier jour au retour.":
    "Flights, accommodation, transport and visa taken care of from day one until your return.",
  "Hôtels proches des lieux saints": "Hotels close to the holy sites",
  "Une sélection d'hôtels à proximité du Haram pour l'Omra et le Hajj.":
    "A selection of hotels near the Haram for Umrah and Hajj.",
  "Suivi personnalisé": "Personalised follow-up",
  "Une équipe joignable par WhatsApp pour répondre à vos questions avant et pendant le voyage.":
    "A team reachable on WhatsApp to answer your questions before and during the trip.",

  // --- Catalogues and filters ---
  "Nos programmes Omra et Hajj : formules par saison du calendrier hégirien, hôtels proches des lieux saints, accompagnement complet.":
    "Our Umrah and Hajj programmes: packages by season of the Hijri calendar, hotels close to the holy sites, full support.",
  "Des formules pensées par saison du calendrier hégirien, avec des hôtels sélectionnés pour leur proximité avec la Haram.":
    "Packages designed by season of the Hijri calendar, with hotels selected for their proximity to the Haram.",
  "Saison": "Season",
  "Toutes les saisons": "All seasons",
  "Filtrer": "Filter",
  "Réinitialiser": "Reset",
  "Impossible de charger les programmes depuis la base de données":
    "Unable to load the programmes from the database",
  "Vérifiez la configuration MySQL (.env).": "Check the MySQL configuration (.env).",
  "Aucun programme Omra/Hajj publié pour ces critères.": "No Umrah/Hajj programme published for these criteria.",
  "Nos séjours et voyages organisés : plage, culture, aventure, famille, couple — partez à la découverte de nouvelles destinations.":
    "Our stays and organized trips: beach, culture, adventure, family, couple — discover new destinations.",
  "Envie d'évasion ? Découvrez nos séjours organisés vers de nouvelles destinations, par envie ou par destination.":
    "Looking to get away? Discover our organized stays to new destinations, by desire or by destination.",
  "Destination": "Destination",
  "ex: Turquie": "e.g. Turkey",
  "Envie": "Desire",
  "Toutes les envies": "All desires",
  "Aucun voyage organisé publié pour ces critères.": "No organized trip published for these criteria.",
  "Plage": "Beach",
  "Culture": "Culture",
  "Aventure": "Adventure",
  "Famille": "Family",
  "Couple": "Couple",
  "plage": "Beach",
  "culture": "Culture",
  "aventure": "Adventure",
  "famille": "Family",
  "couple": "Couple",
  "Toutes": "All",
  "Nos programmes": "Our programmes",
  "Découvrez nos programmes Omra & Hajj ainsi que nos voyages organisés.":
    "Discover our Umrah & Hajj programmes as well as our organized trips.",
  "Nos programmes sont désormais répartis en deux catalogues dédiés :":
    "Our programmes are now split into two dedicated catalogues:",
  "Voyage organisé": "Organized trip",

  // --- Departure cities ---
  "Ville introuvable": "City not found",
  "Voyages au départ de {city}": "Trips departing from {city}",
  "Programmes Omra & Hajj et voyages organisés au départ de {city} ({iata}), avec Golden Fantastic.":
    "Umrah & Hajj programmes and organized trips departing from {city} ({iata}), with Golden Fantastic.",
  "Départ de {city}": "Departing from {city}",
  "{count} programmes avec un départ ouvert depuis l'aéroport de {city} ({iata})": {
    one: "{count} programme with an open departure from {city} airport ({iata})",
    other: "{count} programmes with an open departure from {city} airport ({iata})",
  },
  ", vers {destinations}": ", to {destinations}",
  "Aucun départ ouvert actuellement depuis {city} ({iata}) — consultez nos catalogues complets ci-dessous.":
    "No open departure from {city} ({iata}) at the moment — see our full catalogues below.",
  "Aucun programme avec un départ ouvert depuis {city} pour le moment.":
    "No programme with an open departure from {city} at the moment.",

  // --- Cards and programme page ---
  "Diapositive précédente": "Previous slide",
  "Diapositive suivante": "Next slide",
  "Aller à la diapositive {n}": "Go to slide {n}",
  "à partir de": "from",
  "Départ le {date}": "Departure on {date}",
  "À {distance} m du {landmark}": "{distance} m from {landmark}",
  "À {distance} m": "{distance} m away",
  "à {distance} m du {landmark}": "{distance} m from {landmark}",
  "à {distance} m": "{distance} m away",
  "{count} places restantes": { one: "{count} seat left", other: "{count} seats left" },
  "{count} jours": { one: "{count} day", other: "{count} days" },
  "{count} nuits": { one: "{count} night", other: "{count} nights" },
  "Découvrir": "Discover",
  "Prochains départs": "Upcoming departures",
  "Aucun départ ouvert à la réservation pour le moment.": "No departure open for booking at the moment.",
  "Réf.": "Ref.",
  "Départ": "Departure",
  "Hébergement": "Accommodation",
  "Restauration": "Meals",
  "Complet": "Full",
  "Questions fréquentes": "Frequently asked questions",
  "Programme introuvable": "Programme not found",
  "Haram": "Haram",
  "Masjid Nabawi": "Masjid Nabawi",
  "omra": "Umrah",
  "hajj": "Hajj",
  "tourisme": "Tourism",
  "autre": "Other",
  "Mawlid": "Mawlid",
  "Rajab": "Rajab",
  "Chaabane": "Shaban",
  "Ramadan": "Ramadan",
  "Chawal": "Shawwal",
  "MAD": "MAD",
  "EUR": "EUR",
  "USD": "USD",

  // --- Booking ---
  "Inscription enregistrée ! Nous vous contacterons sur WhatsApp.":
    "Registration saved! We will contact you on WhatsApp.",
  "S'inscrire": "Register",
  "Nom complet": "Full name",
  "Numéro WhatsApp": "WhatsApp number",
  "Email (optionnel)": "Email (optional)",
  "Envoi...": "Sending...",
  "Confirmer l'inscription": "Confirm registration",
  "Annuler": "Cancel",
  "Erreur lors de la réservation": "Error while booking",

  // --- Contact ---
  "Contactez Golden Fantastic pour toute question sur nos programmes Omra, Hajj et séjours touristiques.":
    "Contact Golden Fantastic for any question about our Umrah, Hajj and tourist stay programmes.",
  "Une question sur un programme ou votre inscription ? Écrivez-nous, ou contactez-nous directement sur WhatsApp.":
    "A question about a programme or your registration? Write to us, or contact us directly on WhatsApp.",
  "Téléphone (optionnel)": "Phone (optional)",
  "Sujet": "Subject",
  "Message": "Message",
  "Envoyer": "Send",
  "Message envoyé, nous vous répondrons rapidement.": "Message sent, we will reply shortly.",
  "Erreur lors de l'envoi": "Error while sending",

  // --- About ---
  "À propos de Golden Fantastic": "About Golden Fantastic",
  "Golden Fantastic, agence de voyages spécialisée dans l'organisation d'Omra, de Hajj et de séjours touristiques.":
    "Golden Fantastic, a travel agency specialised in organising Umrah, Hajj and tourist stays.",
  "Golden Fantastic est une agence de voyages spécialisée dans l'organisation de programmes d'Omra, de Hajj et de séjours touristiques. Nous accompagnons nos voyageurs à chaque étape : choix du programme, formalités de visa, hébergement, transport et suivi pendant tout le séjour.":
    "Golden Fantastic is a travel agency specialised in organising Umrah, Hajj and tourist stay programmes. We support our travellers at every step: choosing the programme, visa formalities, accommodation, transport and follow-up throughout the stay.",
  "Notre équipe travaille avec des hôtels partenaires proches des lieux saints et avec des compagnies aériennes reconnues (Royal Air Maroc, Saudia, Turkish Airlines) pour vous garantir un voyage serein, du départ jusqu'au retour.":
    "Our team works with partner hotels close to the holy sites and with recognised airlines (Royal Air Maroc, Saudia, Turkish Airlines) to guarantee you a peaceful journey, from departure to return.",
  "Chaque programme est organisé avec attention : répartition des chambres, suivi des documents de visa, rappels par WhatsApp pour ne rien oublier avant le départ.":
    "Every programme is organised with care: room allocation, visa document follow-up, WhatsApp reminders so you forget nothing before departure.",
  "Nos valeurs": "Our values",
  "Transparence sur les prix et les prestations incluses": "Transparency on prices and included services",
  "Accompagnement humain, joignable par WhatsApp": "Human support, reachable on WhatsApp",
  "Sélection rigoureuse des hôtels et compagnies partenaires": "Rigorous selection of partner hotels and airlines",
  "Coordonnées": "Contact details",

  // --- News ---
  "Annonces et nouveaux programmes de Golden Fantastic : Omra, Hajj et séjours touristiques.":
    "Announcements and new programmes from Golden Fantastic: Umrah, Hajj and tourist stays.",
  "Aucune actualité pour le moment.": "No news at the moment.",
  "Article introuvable": "Article not found",
  "Actualités et nouveaux programmes de Golden Fantastic (Omra, Hajj, voyages organisés).":
    "News and new programmes from Golden Fantastic (Umrah, Hajj, organized trips).",

  // --- FAQ ---
  "Réponses aux questions fréquentes sur nos programmes Omra, Hajj et séjours touristiques : visa, documents, paiement, hébergement.":
    "Answers to frequently asked questions about our Umrah, Hajj and tourist stay programmes: visa, documents, payment, accommodation.",
  "Quels documents sont nécessaires pour l'Omra ?": "Which documents are required for Umrah?",
  "Un passeport valide au moins 6 mois après la date de retour, une photo d'identité récente sur fond blanc, et selon le type de visa, un certificat de vaccination. La liste exacte est confirmée lors de l'inscription selon le type de visa applicable.":
    "A passport valid for at least 6 months after the return date, a recent ID photo on a white background and, depending on the visa type, a vaccination certificate. The exact list is confirmed at registration according to the applicable visa type.",
  "Comment se déroule la réservation en ligne ?": "How does online booking work?",
  "Vous choisissez un programme et un départ sur la page du programme, remplissez vos coordonnées, puis notre équipe vous contacte sur WhatsApp pour finaliser l'inscription et le paiement.":
    "You choose a programme and a departure on the programme page, fill in your details, then our team contacts you on WhatsApp to finalise registration and payment.",
  "Quels sont les modes de paiement acceptés ?": "Which payment methods are accepted?",
  "Espèces, virement bancaire, chèque ou carte, selon les modalités convenues avec notre équipe lors de l'inscription. Un paiement en plusieurs fois est possible.":
    "Cash, bank transfer, cheque or card, according to the terms agreed with our team at registration. Payment in instalments is possible.",
  "Comment sont réparties les chambres ?": "How are rooms allocated?",
  "Les chambres sont réparties par genre (jamais mixtes) selon le type choisi (simple, double, triple, quadruple). La répartition est faite par notre équipe et peut être ajustée sur demande avant le départ.":
    "Rooms are allocated by gender (never mixed) according to the chosen type (single, double, triple, quadruple). Allocation is done by our team and can be adjusted on request before departure.",
  "Puis-je annuler ou modifier ma réservation ?": "Can I cancel or change my booking?",
  "Contactez notre équipe dès que possible par WhatsApp ou via la page contact. Les conditions d'annulation dépendent du programme et de la date de départ.":
    "Contact our team as soon as possible on WhatsApp or via the contact page. Cancellation terms depend on the programme and the departure date.",

  // --- Legal pages ---
  "Éditeur du site": "Site publisher",
  "Golden Fantastic — agence de voyages. [Raison sociale, forme juridique, adresse du siège social, numéro RC/ICE à compléter].":
    "Golden Fantastic — travel agency. [Company name, legal form, registered office address, RC/ICE number to be completed].",
  "Directeur de la publication": "Publication director",
  "[Nom à compléter]": "[Name to be completed]",
  "[Nom et adresse de l'hébergeur à compléter — ex. Hostinger].":
    "[Name and address of the host to be completed — e.g. Hostinger].",
  "voir la page": "see the page",
  "Ce contenu est un modèle à compléter avec les informations légales exactes de l'agence avant mise en production.":
    "This content is a template to be completed with the agency's exact legal information before going live.",
  "Politique de confidentialité": "Privacy policy",
  "Golden Fantastic collecte les informations personnelles nécessaires au traitement de votre inscription (nom, coordonnées, passeport, informations de visa) uniquement dans le cadre de l'organisation de votre voyage.":
    "Golden Fantastic collects the personal information needed to process your registration (name, contact details, passport, visa information) solely for the purpose of organising your trip.",
  "Ces informations sont conservées de manière sécurisée et ne sont partagées qu'avec les organismes nécessaires au voyage (compagnies aériennes, hôtels, autorités consulaires pour les demandes de visa).":
    "This information is stored securely and only shared with the bodies required for the trip (airlines, hotels, consular authorities for visa applications).",
  "Vous pouvez demander l'accès, la rectification ou la suppression de vos données personnelles en nous contactant via la page":
    "You can request access to, correction or deletion of your personal data by contacting us via the page",
  "Ce contenu est un modèle à compléter et à faire valider juridiquement avant mise en production.":
    "This content is a template to be completed and legally validated before going live.",

  // --- Cities (departure and destinations) ---
  "Casablanca": "Casablanca",
  "Marrakech": "Marrakech",
  "Agadir": "Agadir",
  "Fès": "Fez",
  "Tanger": "Tangier",
  "Rabat": "Rabat",
  "Oujda": "Oujda",
  "Nador": "Nador",
  "Makka": "Makkah",
  "Madina": "Madinah",
  "Jeddah": "Jeddah",
  "Riyad": "Riyadh",
  "Dammam": "Dammam",
  "Istanbul": "Istanbul",
  "Antalya": "Antalya",
  "Dubaï": "Dubai",
  "Abou Dabi": "Abu Dhabi",
  "Doha": "Doha",
  "Le Caire": "Cairo",
  "Charm el-Cheikh": "Sharm El Sheikh",
  "Hurghada": "Hurghada",
  "Tunis": "Tunis",
  "Alger": "Algiers",
  "Paris": "Paris",
  "Madrid": "Madrid",
  "Barcelone": "Barcelona",
  "Rome": "Rome",
  "Kuala Lumpur": "Kuala Lumpur",
  "Bangkok": "Bangkok",
  "Bali (Denpasar)": "Bali (Denpasar)",

  // --- Countries ---
  "Arabie Saoudite": "Saudi Arabia",
  "Turquie": "Turkey",
  "Émirats arabes unis": "United Arab Emirates",
  "Égypte": "Egypt",
  "Tunisie": "Tunisia",
  "Maroc": "Morocco",
  "France": "France",
  "Espagne": "Spain",
  "Italie": "Italy",
  "Qatar": "Qatar",
  "Jordanie": "Jordan",
  "Maldives": "Maldives",
  "Malaisie": "Malaysia",
  "Indonésie": "Indonesia",
  "Thaïlande": "Thailand",
  "Royaume-Uni": "United Kingdom",
  "Allemagne": "Germany",
  "Grèce": "Greece",
  "Portugal": "Portugal",
  "États-Unis": "United States",
  "Canada": "Canada",
  "Koweït": "Kuwait",
  "Bahreïn": "Bahrain",
  "Oman": "Oman",
  "Sénégal": "Senegal",
  "Algérie": "Algeria",
  "Mauritanie": "Mauritania",
  "Liban": "Lebanon",
  "Chine": "China",
  "Japon": "Japan",
  "Corée du Sud": "South Korea",
  "Inde": "India",
  "Australie": "Australia",
  "Brésil": "Brazil",
  "Mexique": "Mexico",
  "Suisse": "Switzerland",
  "Autriche": "Austria",
  "Pays-Bas": "Netherlands",

  // --- Public API error messages ---
  "tripId, fullName et phoneWhatsapp sont requis": "tripId, fullName and phoneWhatsapp are required",
  "Voyage introuvable": "Trip not found",
  "Ce voyageur est déjà inscrit à ce voyage": "This traveller is already registered for this trip",
  "fullName, email et message sont requis": "fullName, email and message are required",
  "Erreur serveur": "Server error",
};
