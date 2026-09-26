# État des lieux — Golden Fantastic

Document de référence décrivant l'état complet du projet à date. Complète [CLAUDE.md](CLAUDE.md) (cahier des charges) et [README.md](README.md) (guide technique de démarrage) : ce fichier-ci est l'inventaire détaillé — pages, fonctions, tables, relations, et statut de chaque partie.

Dernière mise à jour : voir historique Git (`git log`).

---

## 1. Idée générale du projet

**Golden Fantastic** est une agence de voyages spécialisée dans l'organisation de programmes **Omra, Hajj et séjours touristiques**. Le projet est un système complet à deux faces :

- **Un site public (« vitrine »)** : présente les programmes de voyage, permet de réserver en ligne, publie des actualités, et est optimisé pour le référencement classique (SEO) et pour être **cité par les moteurs IA** (GEO — Generative Engine Optimization : `llms.txt`, schema.org, contenu structuré).
- **Un système interne (CRM/ERP)** : gère tout le cycle opérationnel d'un voyage — inscriptions, répartition hôtels/chambres, visas, paiements, listes d'export, et (en construction) l'achat réel de billets d'avion via l'API Duffel.

Volume visé : minimum 24 voyages/an, avec potentiellement des centaines de voyageurs par voyage type Omra. Le système est pensé pour ce volume dès la conception (voir CLAUDE.md §1).

**Stack** : Next.js (App Router, un seul projet full-stack — pages publiques en SSR/SSG, API routes pour tout le backend) + MySQL. Aucun autre backend séparé. Hébergement cible : VPS Hostinger (pas encore déployé — développement/test en local uniquement à ce jour).

---

## 2. Pages du site public (partie client)

| Route | Contenu | Rendu |
|---|---|---|
| `/` | Accueil : slider animé (diapositives gérées depuis `/admin/slider`, repli sur un hero statique si aucune diapositive active), programmes à la une par famille (Omra & Hajj / Voyages organisés), section réassurance, actualités récentes | SSR, revalidate 300s |
| `/omra-hajj` | Hub Omra & Hajj : liste filtrable par saison (`?saison=`), bandeau de réassurance | SSR, revalidate 300s |
| `/omra-hajj/[slug]` | Détail d'un programme Omra/Hajj : description, checklist visa (documents requis), voyages ouverts avec hôtel + distance à la Haram, réservation | SSR, revalidate 300s, JSON-LD `TouristTrip` |
| `/voyages-organises` | Hub Voyages organisés : liste filtrable par destination et par envie/thème (`?destination=`, `?envie=`) | SSR, revalidate 300s |
| `/voyages-organises/[slug]` | Détail d'un voyage organisé : photo de couverture, description, voyages ouverts, réservation | SSR, revalidate 300s, JSON-LD `TouristTrip` |
| `/villes-depart/[ville]` | Hub pSEO : programmes des deux familles ayant un départ ouvert depuis cette ville (uniquement les villes mappées dans `lib/airports.js`) | SSR, revalidate 300s, JSON-LD `BreadcrumbList` |
| `/programmes` | Ancienne URL (avant séparation du catalogue) : page de bascule vers les deux hubs | Statique |
| `/programmes/[slug]` | Ancienne URL : redirection permanente (308) vers `/omra-hajj/[slug]` ou `/voyages-organises/[slug]` | Redirection |
| `/a-propos` | Présentation de l'agence, valeurs | Statique |
| `/actualites` | Liste des actualités publiées | SSR, revalidate 300s |
| `/actualites/[slug]` | Détail d'une actualité | SSR, revalidate 300s, JSON-LD `NewsArticle` |
| `/faq` | Questions fréquentes (documents, paiement, réservation, chambres, annulation) | Statique, JSON-LD `FAQPage` |
| `/contact` | Coordonnées + formulaire de contact | Formulaire → API `/api/contact` |
| `/mentions-legales` | Mentions légales (contenu modèle à finaliser) | Statique, `noindex` |
| `/confidentialite` | Politique de confidentialité (contenu modèle à finaliser) | Statique, `noindex` |
| `/sitemap.xml` | Sitemap dynamique (accueil, hubs, programmes publiés des deux familles, villes de départ, actualités publiées) | Généré (`app/sitemap.js`) |
| `/robots.txt` | Autorise tout sauf `/admin`, y compris explicitement GPTBot/ClaudeBot/PerplexityBot/Google-Extended/Applebot-Extended, référence le sitemap | Généré (`app/robots.js`) |
| `/llms.txt` | Description de l'agence + les deux catalogues + les villes de départ, pour la citabilité par les moteurs IA | Généré dynamiquement (`app/llms.txt/route.js`) |
| `/feed.xml` | Flux RSS des actualités publiées (AIO) | Généré (`app/feed.xml/route.js`) |
| `/api/public/programs` | API JSON publique en lecture seule des programmes publiés (AIO) | Généré (`app/api/public/programs/route.js`) |

**Réservation en ligne (public)** : le formulaire sur `/omra-hajj/[slug]` ou `/voyages-organises/[slug]` (composant partagé `app/_components/ReservationForm.jsx`) envoie à `POST /api/reservations`, qui crée (ou retrouve, par numéro WhatsApp) un `traveler` puis une `registration` avec le statut `inscrit`. Aucune information de paiement n'est demandée à ce stade — le paiement se gère ensuite côté interne. Identique pour les deux familles.

**Formulaire de contact** : envoie à `POST /api/contact`, crée une ligne `contact_messages` (statut `nouveau`), consultable dans `/admin/messages`.

---

## 3. Pages de l'espace interne (admin)

Toutes les routes `/admin/*` (sauf `/admin/login`) sont protégées par `middleware.js` : sans session valide, redirection vers `/admin/login`. La session est un JWT signé (HS256) en cookie httpOnly, durée 8h.

| Route | Contenu | Rôles avec accès (lecture / gestion) |
|---|---|---|
| `/admin/login` | Connexion (email + mot de passe) | Public (non authentifié) |
| `/admin` | Tableau de bord : compteurs d'inscriptions par statut, prochains départs avec liens rapides | Tous rôles |
| `/admin/inscriptions` | Liste des inscrits, filtrable par voyage (`?tripId=`) | Tous (lecture) / création+édition selon champ (voir §5) |
| `/admin/inscriptions/new` | Création manuelle d'une inscription (tous les champs voyageur + choix du voyage) | direction, ventes |
| `/admin/inscriptions/[id]` | Fiche complète d'un inscrit : infos, statut, visa (assignation + documents), services facturés, paiements, billet d'avion (lecture) | Tous (lecture) / édition selon section et rôle |
| `/admin/programmes` | Liste des programmes (avec nombre de voyages, statut publié) | Tous (lecture) / direction (gestion) |
| `/admin/programmes/new` | Création minimale (titre, type, famille, dates, ville de départ, pays/ville de destination) — crée le programme + son premier voyage en un flux (CLAUDE.md §3novotrigies) | direction |
| `/admin/programmes/[id]` | Page de gestion en tuiles cliquables (Informations — identité + dates + places + affichage public, Aéroport — tous les champs aéroport dont la ville de départ, Hôtels, + Tarifs d'hébergement si Omra/Hajj, FAQ) — clic sur une tuile ouvre son contenu en modale avec son propre "Enregistrer". Tarification/Restauration/Voyages supplémentaires retirées (CLAUDE.md §3tresquadragies) — prix modifiable via `/admin/voyages/[tripId]` (CLAUDE.md §3quadragies/§3unquadragies/§3duoquadragies/§3tresquadragies) | direction |
| `/admin/programmes/[id]/voyages/new` | Création d'un voyage rattaché à un programme — plus reliée depuis `/admin/programmes/[id]` (§3tresquadragies), accessible par URL directe | direction |
| `/admin/voyages/[tripId]` | Édition d'un voyage (référence, dates, compagnie, aéroports IATA, places, prix, statut) | direction |
| `/admin/voyages/[tripId]/hebergement` | Hôtels du voyage, chambres, affectation manuelle et automatique des voyageurs | Tous (lecture) / direction, suivi (gestion) |
| `/admin/voyages/[tripId]/listes` | Génération des 3 listes exportables (voyageurs, visas, compagnie aérienne) en Excel/PDF | Tous |
| `/admin/voyages/[tripId]/billets` | Recherche et achat de billets d'avion réels via Duffel (individuel ou groupé) | Tous (lecture) / direction, ventes (achat) |
| `/admin/hotels` | Catalogue d'hôtels partenaires — formule de restauration et quota de chambres réservées par type par hôtel (CLAUDE.md §3quaterquadragies) | Tous (lecture) / direction, suivi (gestion) |
| `/admin/visa-types` | Catalogue des types de visa (documents requis + prix) | Tous (lecture) / direction, suivi (gestion) |
| `/admin/services` | Catalogue générique de services facturables | Tous (lecture) / direction, comptabilité (gestion) |
| `/admin/airlines` | Catalogue de compagnies aériennes (nom, code IATA, gabarit d'export) | Tous (lecture) / direction (gestion) |
| `/admin/actualites` | CRUD des actualités publiées sur le site public | Tous (lecture) / direction (gestion) |
| `/admin/slider` | Diapositives du slider animé de l'accueil (titre, sous-titre, image desktop + image mobile dédiée optionnelle — CLAUDE.md §3cinquanteetunquadragies —, lien vers un programme ou URL libre, ordre, actif/inactif) | Permission `slider.manage` (direction par défaut) |
| `/admin/messages` | Messages reçus via le formulaire de contact public | direction, ventes |
| `/admin/finances` | Rapports financiers : par voyage, par programme, paiements par période | direction, comptabilité (page entière restreinte) |
| `/admin/parametres` | Informations de l'agence (coordonnées, RC/IF/ICE, logo) — en-tête des reçus de paiement | Tous (lecture) / direction (édition) |
| `/admin/parametres/utilisateurs` | CRUD des comptes internes (nom, email, téléphone, mot de passe, rôle, actif/inactif) | Permission `utilisateurs.manage` (direction par défaut) |
| `/admin/parametres/roles` | Matrice rôles × permissions, création de rôles personnalisés | Permission `roles.manage` (direction par défaut) |

**Rôles et permissions (voir CLAUDE.md §3undecies)** : les 4 rôles historiques ne sont plus câblés en dur dans le code — chaque route vérifie une permission nommée (`inscriptions.edit`, `hotels.manage`...) contre une table `role_permissions` éditable depuis `/admin/parametres/roles`. Le tableau "Rôles avec accès" ci-dessus reflète l'état **par défaut** (celui semé par la migration `007_add_permissions.sql`, identique au comportement d'avant ce système), pas une contrainte figée dans le code — direction peut créer un rôle personnalisé ou modifier ce qu'un rôle existant peut faire, sans toucher au code. Seule exception : les restrictions fines par champ sur `PUT /api/admin/registrations/[id]` (comptabilité ne modifie que le montant dû, suivi que le visa/les notes) restent câblées en dur.

---

## 4. Fonctions, traitements et relations par module

### 4.1 Authentification & rôles
- `lib/auth.js` : hash de mot de passe (bcryptjs), création/vérification de JWT de session (`jose`), fonction `requireRole(session, rolesAutorisés)` utilisée dans presque toutes les routes API admin
- `lib/session.js` : lecture de la session côté server components (`getSession()`)
- `middleware.js` : garde d'accès sur `/admin/*`
- 4 rôles fixes : `direction` (accès complet), `ventes` (inscrits/réservations/messages/billets), `comptabilite` (finances/paiements/services), `suivi` (hôtels/visas/listes)
- Bootstrap d'un compte : `npm run create-staff -- "Nom" email motdepasse role`

### 4.2 Programmes & voyages (`lib/programsAdmin.js`, `lib/programs.js`)
- Programme : contenu marketing (titre, slug, type, description, SEO, publié ou non), plus une **famille de catalogue** (`family` : `omra_hajj` / `voyage_organise`, obligatoire à la création) qui pilote le hub public et l'habillage visuel — indépendante de `program_type` (voir CLAUDE.md §3quater)
- Saison hégirien (`season`) si `family = omra_hajj`, thème/envie libre (`theme`) si `family = voyage_organise` — l'un est réinitialisé à NULL côté serveur si l'autre est renseigné
- Voyage : instance datée d'un programme (référence unique, dates, aéroports IATA, compagnie, places, prix programme, prix billet avion séparé, devise, statut)
- CRUD complet des deux depuis l'admin ; suppression protégée par les FK (un programme avec des voyages, ou un voyage avec des inscriptions, ne peuvent pas être supprimés — message d'erreur clair)
- Génération automatique du slug depuis le titre (`slugify`)
- Le site public ne lit que les programmes `is_published = TRUE` et les voyages `status IN (ouvert, planifie)` avec date future
- `getProgramsByFamily(family, filters)` : requête publique commune aux deux hubs (`/omra-hajj`, `/voyages-organises`) et à l'accueil, apparie chaque programme à son voyage ouvert le plus proche (dates, aéroport de départ, places restantes) et, pour `omra_hajj`, calcule la distance au point de repère de l'hôtel le plus proche de son propre repère (`hotels.landmark_name` + `landmark_distance_m`, généralisé — voir §3octies de CLAUDE.md)

### 4.3 Inscriptions (`lib/registrations.js`)
- Une inscription (`registration`) relie un `traveler` à un `trip`, avec un statut (`inscrit → confirme → paye_partiel/paye_complet`, ou `annule`)
- Un même voyageur (par numéro WhatsApp) ne peut être inscrit qu'une fois par voyage (contrainte unique)
- Champs édités par rôle : `status` et `visa_status` (direction/ventes), `total_due` (comptabilité, sauf inscription groupée — voir ci-dessous), `notes` (tous)
- Le tableau de bord agrège les compteurs par statut et les prochains départs
- **Création** (`/admin/inscriptions/new`) : trois types — Individuel (un voyageur), Binôme (exactement deux, un sous l'autre) ou Groupe (1 à N, bouton "+ Ajouter un voyageur") — voir CLAUDE.md §3quindecies. Chaque voyageur du bloc porte sa propre vérification de passeport (§3nonies)
- **Tarif d'hébergement** (Omra/Hajj uniquement) : le personnel peut choisir un tarif configuré sur le voyage (Économique/Standard/VIP...), qui remplace le prix plat du voyage par le prix du type de chambre pour ce tarif précis, et fait échouer l'inscription si la limite de places de ce tarif+type de chambre est atteinte (transaction atomique) — voir CLAUDE.md §3unquadragies

### 4.4 Hôtels & répartition des chambres (`lib/hotels.js`, `lib/roomAssignment.js`, `lib/programHotels.js`)
- Catalogue d'hôtels (ville, étoiles, distance au Haram)
- **Hôtels habituels d'un programme** (`program_hotels`, migration 014, CLAUDE.md §3vicies) : fixés une fois depuis la carte "Hôtels" de la page de gestion (`<select multiple>` groupé par ville) — sert de catalogue restreint sur la page hébergement et de repli pour la préférence d'hôtel à l'inscription ; ne s'attachent **plus** automatiquement à un nouveau voyage (retiré, CLAUDE.md §3duotrigies)
- Un voyage peut être associé à plusieurs hôtels (ex. Omra : La Mecque + Médine), chacun ajouté manuellement avec ses dates de check-in/out ; hôtels et chambres sont sous-sectionnés par ville sur `/admin/voyages/[tripId]/hebergement` (CLAUDE.md §3novemdecies) pour éviter une affectation dans la mauvaise ville, triés par date (§3sextrigies)
- Les dates de check-in/check-out d'un hôtel de voyage doivent rester dans les dates du voyage lui-même (CLAUDE.md §3octodecies), et ne peuvent pas chevaucher un autre hôtel déjà attaché au même voyage (CLAUDE.md §3octotrigies)
- Chambres : type (simple/double/triple/quadruple/quintuple) + capacité **dérivée automatiquement du type et verrouillée** dans le formulaire (1 à 5 personnes respectivement, migration 009 — voir CLAUDE.md §3terdecies), rattachées à un hôtel-voyage
- **Affectation manuelle** : anti-conflit vérifié côté serveur — refuse si chambre complète, refuse si chambre déjà occupée par l'autre genre, **sauf** un couple/famille du même groupe d'inscription (voir ci-dessous)
- **Affectation automatique** : traite d'abord le genre le plus nombreux parmi les non-affectés, pour minimiser les places perdues dans une chambre mixte-libre ; priorise désormais une chambre correspondant à la préférence hébergement du voyageur avant de retomber sur l'heuristique de remplissage (voir CLAUDE.md §3quaterdecies) ; **ne connaît pas les groupes** (un couple peut finir dans deux chambres différentes après une répartition automatique, voir CLAUDE.md §3quindecies)
- **Préférence hébergement à l'inscription** : le voyageur peut indiquer un hôtel **par ville** (`registration_hotel_preferences`, migration 015, CLAUDE.md §3quattuorvicies — ex. Mecque + Médine séparément) et un type de chambre pour tout le séjour (`registrations.preferred_room_type`) dès `/admin/inscriptions/new` ou en modifiant une inscription existante — affiché comme indication au personnel sur la page Hébergement, pas comme affectation automatique
- **Groupes d'inscription** (`registration_groups`, migrations 011/012, voir CLAUDE.md §3quindecies) : lie plusieurs inscriptions du même voyage (binôme/couple, famille) sans fusionner leurs dossiers. Un groupe marqué "couple/famille" est la seule exception à la non-mixité des chambres. La page Hébergement regroupe visuellement ces voyageurs et propose "Assigner le groupe à..." pour les affecter tous à la même chambre en un clic. Un groupe partage aussi **un seul montant dû et un seul suivi de paiement** (page dédiée `/admin/groupes/[id]`), avec reçu PDF listant chaque membre — voir §4.7

### 4.5 Visa (`lib/visaTypes.js`, `lib/visaServices.js`)
- Catalogue de types de visa : réutilisables globalement (`program_id` NULL) ou spécifiques à un programme — chaque type a son propre prix et sa propre liste de documents requis
- ⚠️ Depuis la migration 013, le visa n'est **plus géré par inscription liée à un voyage** (prix inclus dans le prix du voyage — 4 paliers par type de chambre depuis la migration 019, CLAUDE.md §3unetrigies) : `VisaSection.jsx` et les routes associées ont été retirés de `/admin/inscriptions/[id]`
- **Service visa autonome** (`/admin/visa-services`, hors voyage) : un client peut demander uniquement une aide visa, avec son propre suivi financier (`visa_service_requests.total_due`, `payments.visa_service_id`) et sa propre checklist de documents (`visa_service_documents`, générée automatiquement à la création)

### 4.6 Services facturés (`lib/services.js`)
- Catalogue générique de services (nom + prix par défaut) — extensible sans changement de schéma, géré depuis `/admin/services`
- ⚠️ Depuis la migration 013, plus facturés par inscription (inclus dans le prix global du programme) — `registration_services` reste en base (vidée) mais n'est plus alimentée

### 4.7 Paiements & finances (`lib/payments.js`)
- Paiements enregistrés par inscription **ou par groupe d'inscription** (montant, devise, mode, référence de reçu, qui l'a saisi) — `payments.registration_id`/`group_id`, mutuellement exclusifs (`CHECK`, migration 012). Un groupe (binôme/famille, CLAUDE.md §3quindecies) a un montant dû et un historique de versements partagés pour tous ses membres, gérés depuis `/admin/groupes/[id]`
- Calcul dû/payé/solde à 3 niveaux : par inscription (ou groupe), par voyage, par programme — les totaux par voyage/programme additionnent le volet individuel et le volet groupe sans double-compter
- Filtrage des paiements par période avec total (inclut les paiements de groupe, affichés "Groupe : {nom}")
- Page `/admin/finances` entièrement réservée à direction/comptabilité (contrôle d'accès au niveau de la page, pas seulement des actions)
- Reçu de paiement PDF imprimable (format A5) par versement, `GET /api/admin/payments/[id]/recu` (`lib/exporters/receiptPdf.js`) — en-tête tiré de `lib/agencySettings.js` (table `agency_settings`, éditable depuis `/admin/parametres`), détail du versement + rappel dû/payé/solde de l'inscription ; pour un paiement de groupe, liste chaque voyageur du groupe à la place du client individuel

### 4.8 Listes exportables (`lib/listGenerators.js`, `lib/airlineTemplates.js`, `lib/exporters/`)
- 3 listes par voyage : voyageurs complets (vue `v_trip_traveler_list`), demandes de visa (avec documents), compagnie aérienne (vue `v_trip_airline_list`, uniquement statuts confirmé/payé)
- Export Excel (`exceljs`) et PDF (`pdfkit`)
- **Gabarit de colonnes différent par compagnie aérienne** (`airlines.export_template_key` → `ram_template`, `saudia_template`, `turkish_template`, `generic_template`) — ajouter une compagnie ne demande aucun code
- Limitation connue : les PDF n'incluent pas la colonne "Nom (arabe)" (police PDF standard sans support arabe ; l'Excel l'affiche correctement)

### 4.9 Actualités & contact (`lib/news.js`, `lib/contactMessages.js`)
- Actualités : CRUD admin, publication avec horodatage, visibles sur `/actualites`
- Messages de contact : reçus du formulaire public, statut nouveau/traité, consultables et supprimables dans l'admin

### 4.10 Billets d'avion — intégration Duffel (`lib/duffel.js`, `lib/flightBookings.js`)
- Recherche de vols réels (aéroports du voyage + dates) via l'API Duffel
- Achat individuel (1 inscrit) ou groupé (plusieurs inscrits du même voyage, une seule commande)
- Coordonnées passager pré-remplies depuis la fiche voyageur, modifiables avant achat
- Toute réservation (réussie ou échouée) est tracée (`flight_bookings` + `flight_booking_passengers`), avec le mode (test/live) déduit du préfixe de la clé API
- **⚠️ Voir §7 — non testé de bout en bout, aucune clé Duffel disponible pendant la construction**

### 4.11 Compagnies aériennes (`lib/airlines.js`)
- Catalogue simple (nom, code IATA, gabarit d'export) utilisé à la fois par les voyages (choix de compagnie), les listes (gabarit d'export) et Duffel (recherche de vols)

### 4.12 SEO / pSEO / GEO / AIO (`lib/programFaqs.js`, `lib/airports.js`, application de `PLAN-SEO-GEO-AIO.md`)
- **FAQ par programme** (`program_faqs`) : catalogue vide au départ, géré depuis `/admin/programmes/[id]` (`ProgramFaqManager.jsx`), affiché sur la fiche publique uniquement si du contenu publié existe, avec JSON-LD `FAQPage` correspondant
- **pSEO villes de départ** : `lib/airports.js` mappe les codes IATA (`trips.origin_iata`) vers un nom de ville (liste statique, pas de table SQL) ; `getDepartureCities()`/`getProgramsByDepartureCity()` alimentent `/villes-depart/[ville]`, qui agrège les deux familles pour une ville donnée — dimension orthogonale aux hubs `/omra-hajj`/`/voyages-organises`, ne les remplace pas
- **Maillage interne** : sur la fiche programme, le code IATA du voyage devient un lien vers la ville de départ correspondante quand elle est mappée
- **JSON-LD enrichi** : `BreadcrumbList` (composant partagé `app/_components/BreadcrumbJsonLd.jsx`) sur les hubs, le détail programme et les villes de départ ; `datePublished`/`dateModified` sur `TouristTrip` (depuis `programs.created_at`/`updated_at`)
- **AIO** : `next/image` sur toutes les images publiques (Core Web Vitals), flux RSS (`/feed.xml`), API JSON publique en lecture seule (`/api/public/programs`), `robots.txt` avec bots IA listés explicitement
- **`LocalBusiness`** (schema.org) : implémenté dans `app/(site)/layout.js`, à partir des vraies coordonnées `agency_settings` (adresse/téléphone désormais renseignés) — actif uniquement quand les deux sont présents. Coordonnées aussi affichées sur `/a-propos` et `/contact`
- **Non implémenté** (voir §7) : architecture multilingue AR/FR (décision documentée dans CLAUDE.md §3quinquies, implémentation différée)

---

## 5. Architecture des tables et relations

```
roles ──< staff_users
roles ──< role_permissions >── permissions
airlines ──< trips
programs ──< trips ──< registrations >── travelers
programs ──< program_hotels >── hotels (hôtels par défaut, auto-attachés à chaque nouveau voyage)
programs ──< visa_types (nullable → global si NULL)
visa_types ──< visa_type_documents
trips ──< trip_hotels >── hotels
trip_hotels ──< rooms ──< registrations (room_id, nullable)
registrations ──< registration_hotel_preferences >── hotels (une préférence par ville — migration 015)
registrations ──< registration_services >── services
registrations ──< payments
registrations ──1:1── visa_requests ──< visa_request_documents >── visa_type_documents
registrations ──< flight_booking_passengers >── flight_bookings ──< trips
travelers ──< whatsapp_messages_log
registrations ──< whatsapp_reminders
programs (contenu) : news_posts et contact_messages sont indépendants (aucune FK vers programs/trips)
programs ──< slides (program_id nullable — NULL si la diapositive utilise button_link)
```

**Détail des tables** (26 tables + 2 vues, voir [database/schema.sql](database/schema.sql) pour le détail complet des colonnes ; migrations additives dans [database/migrations/](database/migrations/)) :

| Domaine | Tables |
|---|---|
| Agences (multi-agences, passe 1/2) | `agencies` (migration 016, CLAUDE.md §3sexvicies) — `agency_id` ajouté à 27 tables, résolution par sous-domaine dans `proxy.js`. ⚠️ Les requêtes `lib/*.js` ne filtrent pas encore par agence : ne pas onboarder de deuxième agence avec de vraies données avant la passe 2 |
| Utilisateurs internes | `roles`, `staff_users`, `permissions`, `role_permissions` (migration 007 — permissions dynamiques, voir CLAUDE.md §3undecies ; rôles et comptes propres à chaque agence depuis la migration 016) |
| Compagnies aériennes | `airlines` |
| Programmes & voyages | `programs` (dont `family`/`season`/`theme` — migration 001), `trips`, `program_faqs` (FAQ par programme — migration 002) |
| Hôtels & chambres | `hotels`, `program_hotels` (hôtels par défaut d'un programme — migration 014), `trip_hotels`, `rooms` |
| Voyageurs & inscriptions | `travelers`, `registrations`, `registration_hotel_preferences` (préférence hôtel par ville — migration 015) |
| Facturation | `services`, `registration_services`, `payments` |
| Visa | `visa_types`, `visa_type_documents`, `visa_requests`, `visa_request_documents` |
| WhatsApp (schéma prêt, non câblé) | `whatsapp_qa_templates`, `whatsapp_reminders`, `whatsapp_messages_log` |
| Site public | `news_posts`, `contact_messages`, `slides` (slider accueil — migration 008) |
| Billets d'avion (Duffel) | `flight_bookings`, `flight_booking_passengers` |
| Vues | `v_trip_traveler_list`, `v_trip_airline_list` |

**Entité centrale** : `registrations` — presque toutes les autres tables s'y rattachent directement ou indirectement (chambre, visa, services, paiements, billet d'avion). C'est le point d'agrégation de tout le parcours d'un voyageur sur un voyage donné.

---

## 6. Statut des parties du projet

### ✅ Finalisées et testées de bout en bout
- Structure Next.js + connexion MySQL, dégradation propre si la base est inaccessible
- Site public : accueil, deux hubs de catalogue (Omra & Hajj / Voyages organisés, liste + détail + réservation), à propos, actualités, FAQ, contact, pages légales
- Séparation du catalogue en deux familles : migration additive `family`/`season`/`theme`, hubs filtrables, distance à la Haram affichée, checklist visa sur le détail Omra/Hajj, anciennes URLs `/programmes` préservées (bascule + redirection 308), admin mis à jour (champ famille obligatoire à la création)
- SEO/pSEO/GEO/AIO (application de `PLAN-SEO-GEO-AIO.md` Phase 1) : sitemap dynamique, robots.txt avec bots IA explicites, llms.txt, schema.org (`TravelAgency`, `TouristTrip` avec dates, `NewsArticle`, `FAQPage`, `BreadcrumbList`), `next/image` sur toutes les images publiques, flux RSS, API JSON publique, pages pSEO par ville de départ, structure FAQ par programme (contenu à rédiger)
- Authentification interne + tableau de bord + CRUD des inscrits, permissions par rôle vérifiées par appels API directs (contournant l'UI)
- Catalogue de services (visa, billet avion, extensible) avec suivi documentaire
- Répartition hôtels/chambres (manuelle + automatique), anti-conflit vérifié
- Générateur de listes Excel/PDF avec gabarits par compagnie
- Paiements et rapports financiers
- Gestion des programmes/voyages/compagnies aériennes depuis l'admin (plus besoin de SQL manuel)
- Gestion des actualités et des messages de contact
- Permissions dynamiques par rôle (§3undecies) : catalogue de ~23 permissions, matrice éditable, gestion des comptes internes depuis l'admin, filet de sécurité direction, vérifié de bout en bout (octroi/retrait d'une permission à chaud sans reconnexion, garde-fous anti-auto-verrouillage, rôle personnalisé)
- Slider animé de l'accueil (§3duodecies) : CRUD + réordonnancement depuis `/admin/slider`, lien dynamique vers un programme (jamais figé), 4 diapositives réelles en place liées aux programmes publiés, vérifié de bout en bout (autoplay, navigation par puces/flèches, lien CTA vers la vraie fiche programme, repli sur le hero statique si aucune diapositive active, permission refusée pour un rôle non autorisé)

### 🟡 En cours / construites mais non validées en conditions réelles
- **Intégration Duffel (achat de billets d'avion)** : code complet (schéma, client API, routes, interface), permissions et validations vérifiées, **mais recherche et achat n'ont jamais pu être testés avec de vraies réponses de l'API** faute de compte Duffel disponible. Un risque existe que la forme exacte des réponses Duffel (notamment l'extraction du numéro de billet) diffère de ce qui a été implémenté d'après la documentation. À valider avec une clé `duffel_test_` avant tout usage réel.

### ❌ Non commencées
- **Connexion n8n + WhatsApp Business Cloud API** : le schéma existe (`whatsapp_qa_templates`, `whatsapp_reminders`, `whatsapp_messages_log`) mais aucune intégration réelle, aucun webhook, aucune interface d'administration des questions/réponses ou des rappels programmés
- Support d'une police arabe dans les exports PDF (actuellement colonne retirée du PDF, présente uniquement dans l'Excel)
- Architecture multilingue AR/FR : décision documentée (CLAUDE.md §3quinquies), implémentation (restructuration des routes + traduction) volontairement différée
- Actions hors-code du plan SEO (§9 du plan) : Google Business Profile, Search Console/Bing Webmaster Tools, netlinking/presse/Wikidata, statistiques propriétaires chiffrées, articles de guide/pilier, pipeline Lighthouse CI

### 📋 À ajouter / pistes d'amélioration (non demandées explicitement mais identifiées)
- Hub Omra & Hajj : filtres `type` (omra_classique/omra_combinee/hajj_nusuk/hajj_direct) et `gamme` (éco/touristique/luxe) volontairement **non implémentés** — aucune colonne ne les modélise dans le schéma actuel (`program_type` reste omra/hajj/tourisme/autre) ; nécessiterait une colonne supplémentaire, non ajoutée pour rester strictement dans le périmètre validé (family/season/theme)
- Hub Voyages organisés : pas de galerie photo (une seule `cover_image_url` par programme, pas de table dédiée), ni de programme "jour par jour" structuré (le contenu détaillé reste dans `full_description`, texte libre)
- Prix barré en cas de promo sur les cartes : pas de colonne "prix avant remise" dans le schéma actuel
- Multi-devises réelles si l'agence facture au-delà du MAD (actuellement `currency` est un champ libre par voyage/paiement, sans conversion)
- Gestion de types de chambre au-delà de simple/double/triple/quadruple/quintuple si besoin (ENUM fixe actuellement, extensible par migration)
- Historique/audit des modifications (qui a changé quoi et quand) au-delà de `registered_by_staff_id` / `recorded_by_staff_id` déjà présents sur certaines tables
- Notifications automatiques (hors WhatsApp) : rappels par email par exemple
- Déploiement effectif sur le VPS Hostinger visé par CLAUDE.md (le projet tourne uniquement en local pour l'instant)

---

## 7. Informations complémentaires

### Décisions déjà prises (voir aussi CLAUDE.md)
- Types de visa réutilisables **et** spécifiques à un programme sont tous deux supportés
- Documents de visa suivis individuellement par voyageur (pas seulement une liste informative)
- Prix du billet d'avion rattaché au voyage précis, pas seulement à la compagnie
- Le catalogue générique `services`/`registration_services` couvre "les autres services" sans besoin de changement de schéma
- Achat de billets Duffel supporté en individuel **et** en groupé

### Informations encore à préciser par l'utilisateur (issues de CLAUDE.md §7, toujours ouvertes)
- Nom de domaine définitif du site (impacte `NEXT_PUBLIC_SITE_URL`, sitemap, llms.txt)
- Organisme(s) exact(s) concerné(s) par les demandes de visa, pour affiner le format de la liste de demande de visa
- ~~Confirmation des types de chambre standards~~ — tranché : simple/double/triple/quadruple/quintuple (1 à 5 personnes)
- Devise(s) de facturation définitive(s) (MAD uniquement ou multi-devises réel ?)
- ~~Adresse et téléphone réels de l'agence~~ — tranché : renseignés, `LocalBusiness` actif (voir CLAUDE.md §3quinquies)

### Bugs réels trouvés et corrigés pendant le développement (pour référence)
- `mysql2` : `pool.execute()` (requêtes préparées) ne supporte pas l'expansion de tableau dans une clause `IN (?)`, contrairement à `pool.query()` — corrigé en générant les points d'interrogation manuellement partout où c'était utilisé
- `globals.css` par défaut du scaffold Next.js imposait un fond noir en mode sombre du navigateur (règle hors des cascade layers Tailwind, écrasant silencieusement les classes de thème clair) — nettoyé, le site garde un thème clair unique
- Algorithme de répartition automatique des chambres : traiter systématiquement les hommes avant les femmes pouvait gâcher une place dans une chambre mixte-libre — corrigé pour traiter le genre le plus nombreux en premier
- Connexion MySQL avec `localhost` provoquait un crash Node (AggregateError) sur Windows en l'absence de serveur — corrigé en utilisant `127.0.0.1`
- Le header/footer marketing du site public s'affichait aussi en haut de toutes les pages `/admin/*` (un seul `app/layout.js` enveloppait tout le site) — corrigé en séparant deux layouts racine indépendants via le pattern Next.js "multiple root layouts" : pages publiques déplacées dans `app/(site)/` avec leur propre layout, `app/admin/layout.js` devenu root layout indépendant sans aucune trace du header public (voir CLAUDE.md §3sexies)

### Environnement de développement
- Base de données testée via un conteneur Docker MySQL 8.0 local (voir README pour la commande complète)
- Comptes de test créés via `npm run create-staff -- "Nom" email motdepasse role`
- Aucune donnée de démonstration n'est laissée en base entre les sessions de test (nettoyage systématique après vérification)
