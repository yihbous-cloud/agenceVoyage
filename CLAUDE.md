# CLAUDE.md — Système Agence de Voyages « Golden Fantastic »

Ce fichier décrit le projet pour Claude Code, afin qu'il travaille avec la même logique et les mêmes standards à chaque session.

## 1. Vue d'ensemble du projet

- **Nom de l'agence** : Golden Fantastic
- **Type** : Système complet combinant un site public (marketing/réservation) et un système interne (CRM/ERP) pour la gestion d'une agence de voyages spécialisée dans les programmes touristiques et les voyages organisés (Omra, Hajj, séjours)
- **Volume** : minimum **24 voyages/an** (~2 par mois en moyenne) — la base de données et l'architecture doivent être dimensionnées en conséquence, avec de la marge pour la croissance
- **Public cible** :
  - Public : visiteurs du site cherchant un programme de voyage
  - Interne : équipe de l'agence (direction, ventes, comptabilité)
- **Priorité stratégique** : SEO + **GEO** (Generative Engine Optimization) — le contenu doit être indexable par les moteurs de recherche classiques **et citable par les moteurs IA** (ChatGPT, Perplexity, Gemini...)

## 2. Stack technique

- **Frontend** : Next.js (React) — SSR/SSG obligatoire pour les pages de programmes et le contenu (pas de rendu client-side seul)
- **Backend/API** : Node.js (API routes Next.js, ou Express séparé si nécessaire)
- **Base de données** : MySQL
- **Automatisation** : n8n (VPS Hostinger existant) — WhatsApp Business Cloud API officiel
- **Hébergement** : Hostinger VPS

⚠️ Ne pas changer la stack sans demande explicite. Objectif : architecture robuste et évolutive (scalable) vu le volume attendu (24+ voyages/an, potentiellement des centaines de voyageurs par voyage type Omra).

## 3. Compagnies aériennes partenaires

- **Royal Air Maroc (RAM)**
- **Saudia (Saudi Arabian Airlines)** — compagnie la **plus fréquente** (car l'Arabie Saoudite/Omra est la destination la plus fréquente)
- **Turkish Airlines**
- Autres compagnies à ajouter selon les besoins (le système doit permettre d'ajouter une nouvelle compagnie sans développement supplémentaire — table dédiée, pas de valeurs codées en dur)

⚠️ **Chaque compagnie a un format de liste différent** pour la réservation des billets — le système doit gérer un **template d'export distinct par compagnie** (Excel/PDF), configurable.

## 3bis. Catalogue de services facturés

L'agence facture, par inscription/voyageur, des **services** distincts du prix du voyage lui-même :

1. **Programme Omra / Hajj / tourisme** — le voyage organisé (déjà modélisé : `trips.price_per_person`)
2. **Service visa** — ⚠️ chaque **type de visa** a sa propre **liste de documents requis** et son propre **prix** (ne pas modéliser le visa comme un simple service générique à prix unique)
3. **Réservation billet d'avion** — le prix/la logistique dépend de la **compagnie aérienne** choisie (RAM, Saudia, Turkish...)
4. **Autres services** — catalogue **extensible** : de nouveaux types de service doivent pouvoir être ajoutés plus tard sans développement supplémentaire (même exigence que pour les compagnies aériennes, section 3)

**Décisions prises (voir `database/schema.sql`)** :
- Types de visa : catalogue global réutilisable (`visa_types`, `program_id` NULL) **et** possibilité de types spécifiques à un programme (`program_id` renseigné) — les deux cas sont supportés
- Documents requis par type de visa : catalogue (`visa_type_documents`) + suivi individuel fourni/manquant par voyageur (`visa_request_documents`), lié à `visa_requests.visa_type_id`
- Billet d'avion : prix rattaché au **voyage précis** (`trips.flight_ticket_price`), pas à la compagnie en général (les prix aériens varient par date/route)
- Autres services : catalogue générique existant (`services` / `registration_services`) déjà extensible tel quel, aucun changement nécessaire

## 3ter. Achat de billets d'avion via Duffel (API)

L'utilisateur souhaite pouvoir **acheter réellement** des billets d'avion (pas seulement en tracer le prix) directement depuis le site, via l'API [Duffel](https://duffel.com).

- Achat individuel (depuis une fiche inscription) **et** groupé (tous les inscrits confirmés d'un voyage en une seule commande) — les deux cas sont supportés
- Voir `/admin/voyages/[id]/billets`, `lib/duffel.js`, `lib/flightBookings.js`, tables `flight_bookings` / `flight_booking_passengers`
- ⚠️ **Aucun compte Duffel n'existait au moment de la construction** — le code suit la documentation Duffel (API v2) mais n'a jamais été testé avec de vraies réponses API. À valider avec une clé de test avant tout achat réel (clé `duffel_live_`)
- ⚠️ Ne jamais utiliser une clé `duffel_live_` en développement/test — toujours `duffel_test_` (sandbox gratuite, sans argent ni réservation réels) tant que le flux n'est pas validé de bout en bout
- Le mode (test/live) est déduit uniquement du préfixe de la clé API (`DUFFEL_API_KEY`), jamais d'un interrupteur séparé, pour éviter toute confusion

## 3quater. Séparation du catalogue public (Omra & Hajj / Voyages organisés)

Le site public distingue deux familles de programmes, à l'intention d'achat différente :

1. **Omra & Hajj** — achat engagé, comparaison par saison du calendrier hégirien (`programs.season`)
2. **Voyages organisés** — achat inspirationnel, comparaison par destination et par thème/envie (`programs.theme`)

- Chaque programme porte une colonne `programs.family` (`omra_hajj` / `voyage_organise`), indépendante de `programs.program_type` (voir `database/migrations/001_add_program_family.sql` pour la justification de ne pas les fusionner)
- Deux hubs publics dédiés : `/omra-hajj` et `/voyages-organises`, chacun avec ses propres filtres (saison ; destination/envie)
- Un seul gabarit technique de détail (`app/_components/ProgramDetail.jsx`), habillage conditionné par `family` — pas de duplication du moteur de réservation
- La distance à un point de repère (`hotels.landmark_name` + `hotels.landmark_distance_m`, généralisé depuis la migration `004_generalize_hotel_landmark.sql` — tout hôtel peut avoir un repère de proximité, pas seulement le Haram) est désormais affichée sur les cartes et le détail Omra/Hajj (voyage le plus proche)
- Anciennes URLs `/programmes` et `/programmes/[slug]` conservées : la première devient une page de bascule vers les deux hubs, la seconde redirige (308) vers la nouvelle URL préfixée par famille

## 3quinquies. Stratégie SEO / pSEO / GEO / AIO

Suite à `PLAN-SEO-GEO-AIO.md` (fourni par l'utilisateur). La Phase 1 (fondations techniques), le pSEO villes de départ et la structure FAQ par programme ont été implémentés ; le reste (Google Business Profile, backlinks, contenu multilingue, statistiques propriétaires...) reste à faire côté business/contenu — voir `ETAT_DES_LIEUX.md` pour le détail à jour.

- **`robots.txt`** autorise explicitement GPTBot/ClaudeBot/PerplexityBot/Google-Extended/Applebot-Extended, en plus de la règle générale
- **`next/image`** utilisé sur toutes les images publiques (Core Web Vitals) ; le formulaire admin garde `<img>` (page protégée, non indexée)
- **JSON-LD enrichi** : `TouristTrip` avec `datePublished`/`dateModified`, `BreadcrumbList` sur les hubs et le détail programme, `FAQPage` par programme quand du contenu existe
- **pSEO — villes de départ** (`/villes-depart/[ville]`) : dimension orthogonale aux deux hubs existants, n'a **pas** remplacé leur structure d'URL. Correspondance IATA → ville dans `lib/airports.js` (liste statique, pas de table SQL) ; pages générées uniquement pour les codes IATA mappés
- **FAQ par programme** (table `program_faqs`, migration `002_add_program_faqs.sql`) : structure et interface admin en place, **contenu vide au départ** — à rédiger par l'agence (10-15 questions/programme recommandé par le plan)
- **AIO** : flux RSS (`/feed.xml`) et API JSON publique en lecture seule (`/api/public/programs`)
- **`LocalBusiness`** (schema.org) : implémenté dans `app/(site)/layout.js` (`@type: ["TravelAgency", "LocalBusiness"]`, `address`/`telephone`), à partir des vraies coordonnées saisies dans `agency_settings` (§3septies) — n'apparaît dans le JSON-LD que si adresse **et** téléphone sont renseignés, pas de valeur inventée. Coordonnées aussi affichées sur `/a-propos` et `/contact` (remplace les anciens placeholders)
- **Multilingue AR/FR** : architecture cible documentée (URLs `/fr/...` et `/ar/...`, `hreflang` réciproque, RTL via Tailwind) mais **implémentation différée** — restructurer les routes maintenant sans contenu arabe réel créerait des pages vides, contraire à la propre règle anti-contenu-fin du plan. À déclencher dans une session dédiée une fois une traduction arabe des pages cœur prête

## 3sexies. Séparation des layouts racine (site public / espace interne)

Le header/footer marketing (doré) s'affichait auparavant en haut de **toutes** les pages `/admin/*`, car un unique `app/layout.js` enveloppait tout le site. Corrigé via le pattern Next.js **"multiple root layouts"** :

- Toutes les pages publiques ont été déplacées dans un groupe de routes `app/(site)/` (ne change aucune URL — les parenthèses sont ignorées par le routeur), avec son propre `app/(site)/layout.js` : header/nav/footer marketing, polices (Geist, Italianno, Marcellus, Jost), JSON-LD `TravelAgency`
- `app/admin/layout.js` est devenu un **root layout indépendant** (son propre `<html>`/`<body>`) : uniquement la nav interne (tableau de bord, inscrits, programmes...) et la session — plus aucune trace du header/footer public
- Les fichiers hors page (`app/sitemap.js`, `app/robots.js`, `app/llms.txt/route.js`, `app/feed.xml/route.js`, tout `app/api/**`) ne sont pas des routes de page : ils ne sont pas concernés par les layouts et restent directement à la racine de `app/`
- `app/_components/*` (composants partagés) n'a pas bougé — les pages du groupe `(site)` l'importent via l'alias `@/app/_components/...` plutôt que des chemins relatifs, pour rester valides quelle que soit la profondeur du groupe de routes
- Conséquence attendue et documentée : naviguer entre le site public et `/admin` déclenche un rechargement complet de page (comportement normal pour deux root layouts distincts, pas une régression)

## 3septies. Paramètres agence & reçus de paiement imprimables

- Table `agency_settings` (ligne unique, `id=1`) : nom, logo (`logo_url`, migration `006_add_agency_logo.sql`), adresse, ville, téléphone, WhatsApp, email, site web, RC, IF (`tax_id`), ICE, note de bas de reçu — voir migration `003_add_agency_settings.sql`
- Logo uploadé depuis `/admin/parametres` via l'API d'upload générique désormais paramétrable par dossier (`POST /api/admin/upload`, champ `folder` whitelisté `["programs", "agency"]`, stocké dans `public/uploads/agency/`) — même mécanisme que l'image de couverture des programmes
- Interface admin dédiée `/admin/parametres`, section **réservée** dans la barre latérale gauche (séparée de la navigation principale par un intitulé "Paramètres") — lecture pour tous les rôles, édition réservée à `direction`
- Reçu de paiement PDF au format A5 (`lib/exporters/receiptPdf.js`, `pdfkit`), généré à la demande via `GET /api/admin/payments/[id]/recu` — **un reçu par versement** (pas un cumul) : en-tête agence (avec logo à gauche du texte quand `logo_url` est renseigné), identité du client, programme/voyage, détail du versement (montant/mode/référence/saisi par), puis rappel du montant total du voyage, total payé à ce jour et solde restant
- ⚠️ Logo dans le PDF : lu depuis le disque (`public/<logo_url>`) via `doc.image()`. Protégé par `fs.existsSync` + `try/catch`, mais **le décodage PNG/JPEG de pdfkit peut lever une exception asynchrone qui échappe à ce `try/catch`** sur un fichier corrompu (observé avec un PNG invalide fabriqué à la main pendant les tests — jamais reproduit avec un vrai fichier uploadé). Pas de correctif structurel appliqué : le risque réel est faible (l'upload valide déjà le type MIME), à surveiller si un logo cause un jour un reçu qui ne se génère plus
- La référence du reçu (`payments.receipt_reference`) est **générée par le système** à la création du paiement (`REC-{année}-{id sur 6 chiffres}`, voir `createPayment` dans `lib/payments.js`) — le personnel ne la saisit plus manuellement, garantissant l'unicité
- Accessible depuis la fiche inscription (`PaymentsSection.jsx`) via un lien "Reçu" à côté de chaque paiement, ouvert dans un nouvel onglet (`Content-Disposition: inline`, prêt à imprimer)
- ⚠️ `toLocaleString("fr-FR")` insère un espace fine insécable (U+202F) comme séparateur de milliers — absent des polices standard de pdfkit (Helvetica), il se rend en glyphe corrompu. Toujours le remplacer par un espace normal dans tout nouveau texte PDF formatant un montant (voir `formatAmount` dans `receiptPdf.js`)

## 3octies. Point de repère des hôtels (généralisé, pas seulement le Haram)

Le catalogue d'hôtels (`/admin/hotels`) n'est pas limité à La Mecque : un hôtel peut être à Médine, Istanbul, Paris... La colonne `hotels.distance_to_haram_m` supposait à tort que la distance affichée était toujours celle du Haram. Généralisé via `004_generalize_hotel_landmark.sql` :

- `hotels.landmark_name` (texte libre, ex. "Haram", "Masjid Nabawi", "Tour Eiffel") + `hotels.landmark_distance_m` (mètres) — les deux nullable, à laisser vides quand la proximité à un lieu précis n'est pas un argument de vente
- Rétro-remplissage automatique des hôtels existants lors de la migration : `Masjid Nabawi` pour les villes contenant "Médine"/"Madinah", `Haram` sinon (tous les hôtels avec une distance renseignée avant cette migration étaient liés à l'Omra/Hajj)
- Toujours utilisé uniquement pour la famille `omra_hajj` côté public (`lib/programs.js`), mais le nom du repère affiché vient désormais de la donnée (`landmark_name`) plutôt que d'être codé en dur "Haram" — correct même si l'hôtel le plus proche du voyage est à Médine
- Champs Pays/Ville du formulaire (`HotelsManager.jsx`) : listes déroulantes éditables (`<input list>` + `<datalist>`, pas un `<select>` fermé) — filtrage natif du navigateur en tapant, saisie libre toujours possible pour un pays/ville absent de la liste. Référence statique `lib/worldPlaces.js` (`CITIES_BY_COUNTRY`, ~196 pays) : capitale pour tous, villes touristiques enrichies pour les destinations courantes de l'agence. ⚠️ Arabie Saoudite volontairement en "Makka"/"Madina" (pas "La Mecque"/"Médine") — demande explicite. Changer de pays réinitialise le champ ville (les suggestions précédentes ne correspondent plus)

## 3nonies. Vérification du passeport (fiche inscription)

Sur `EditTravelerForm.jsx` (`/admin/inscriptions/[id]`) **et** `NewRegistrationForm.jsx` (`/admin/inscriptions/new`, même comportement dès la création), au blur (perte de focus) des champs passeport :

- **Numéro de passeport** : vérification de **forme** uniquement (6-9 caractères alphanumériques, `PASSPORT_FORMAT`) — aucune consultation d'un registre officiel. Si le format est valide, une boîte de dialogue modale demande confirmation ("Vérifiez que le N° de Passeport est : **{numéro}** — Exact ?", boutons **Corriger** / **Valider**) ; "Corriger" referme le dialogue et rend le focus au champ sans rien enregistrer, "Valider" affiche le message de confirmation permanent sous le champ et verrouille le champ. Le dialogue ne réapparaît pas tant que la valeur confirmée ne change pas. Format invalide : avertissement inline (pas de dialogue, champ non vidé)
- **Date d'expiration du passeport** (`travelers.passport_expiry_date`) : doit rester valide au moins **6 mois après la date de départ du voyage** (pas la date du jour — c'est la règle réelle appliquée par les autorités/compagnies aériennes). Sur `NewRegistrationForm.jsx`, la date de référence est celle du **voyage sélectionné dans le formulaire** (`trips.departure_date`, aucune inscription n'existe encore) ; sur `EditTravelerForm.jsx`, celle de `registration.departure_date`. Si non respectée : message d'erreur explicite et **champ vidé** (pas de valeur invalide silencieusement conservée)
- **`lib/passportValidation.js`** (partagé) : `PASSPORT_FORMAT`, `isPassportExpiryValid()`, `getMinPassportValidUntil()` — même règle, même calcul utilisés par les deux formulaires client **et** revalidés côté serveur dans `PUT /api/admin/registrations/[id]/traveler` et `POST /api/admin/registrations` (création) — la validation client seule ne suffit pas, un appel API direct doit aussi être bloqué dans les deux cas
- **Verrouillage progressif** : cliquer "Valider" dans le dialogue verrouille (grise) immédiatement le champ passeport, avant même l'enregistrement du reste du formulaire (état client uniquement, `passportLocked`) ; cliquer "Enregistrer" verrouille alors **tous** les champs de la section (y compris passeport) une fois la sauvegarde réussie. Un bouton "Modifier" (à côté du titre de section, et un autre local à côté de la confirmation passeport) redéverrouille — sans "Modifier", impossible de corriger un champ après coup
- **Persisté en base** : `travelers.info_confirmed` (migration `005_add_traveler_info_confirmed.sql`), mis à `TRUE` par `updateTraveler()` à chaque enregistrement réussi. `EditTravelerForm.jsx` initialise `formLocked`/`passportLocked` depuis `registration.info_confirmed` — une fiche déjà enregistrée s'ouvre donc **verrouillée par défaut** à chaque visite/rechargement, pas seulement pendant la session en cours ("une fois vérifié, reste verrouillé"). Le lien "Modifier" déverrouille l'affichage local sans jamais repasser `info_confirmed` à `FALSE` : sans un nouvel "Enregistrer", la fiche redevient verrouillée à la prochaine visite. Le lien "Afficher" dans `/admin/inscriptions` (liste) ouvre cette même fiche — nommé ainsi (pas "Modifier") car la fiche s'ouvre en lecture seule par défaut si déjà confirmée

## 3decies. Champs Nom/IATA des compagnies aériennes (listes déroulantes éditables)

Même pattern que Pays/Ville des hôtels (§3octies) : `AirlinesManager.jsx` (`/admin/airlines`) utilise `<input list>` + `<datalist>` pour le champ **Nom**, référence statique `lib/airlinesReference.js` (`AIRLINES`, ~40 compagnies courantes pour un marché marocain/Omra-Hajj/voyages organisés — RAM/Saudia/Turkish déjà partenaires, voir §3, chacune avec son gabarit dédié `ram_template`/`saudia_template`/`turkish_template`, les autres en `generic_template`).

**Le nom est le seul champ actif** (demande explicite) : IATA et Gabarit sont des champs **dérivés**, pas des entrées indépendantes.
- Nom reconnu (correspondance exacte avec `AIRLINES`) : IATA et Gabarit se remplissent automatiquement (`getAirlineByName`) et se **verrouillent** (`disabled`, grisés) — aucune saisie manuelle possible tant que le nom correspond
- Nom non reconnu (nouvelle compagnie) : IATA et Gabarit se **déverrouillent** pour une saisie 100% manuelle ; leur valeur précédente n'est pas effacée automatiquement (évite un vidage à chaque frappe pendant la saisie d'un nom qui finira par correspondre)

## 3undecies. Gestion des utilisateurs et permissions dynamiques

Jusqu'ici, chaque route admin codait en dur la liste des rôles autorisés (`requireRole(session, ["direction", "ventes"])`, et les pages `session?.role === "direction"` pour l'affichage conditionnel). Remplacé par un système de permissions éditable depuis `/admin/parametres/roles`, sans changer le comportement par défaut (la matrice a été semée pour reproduire exactement l'ancien câblage — voir migration `007_add_permissions.sql`).

### Architecture

- Tables `permissions` (catalogue, ~23 codes du type `inscriptions.edit`, `hotels.manage`...) et `role_permissions` (association rôle ↔ permission). La table `roles` existait déjà (`direction`/`ventes`/`comptabilite`/`suivi`).
- `lib/permissions.js` : `hasPermission(session, code)` — vérification centrale, utilisée partout (routes API **et** pages, pour que l'UI affichée corresponde exactement à ce que l'API autorise). `getPermissionsMatrix()`, `setRolePermissions()`, `createRole()`, `deleteRole()` pour l'admin.
- `lib/staffUsers.js` : CRUD des comptes (`staff_users`), remplace le script CLI `scripts/create-staff-user.js` comme point d'entrée principal (le script reste utilisable, notamment pour le tout premier compte direction avant qu'aucune interface ne soit accessible).
- **⚠️ Filet de sécurité** : le rôle `direction` a toujours accès à tout, **au niveau code** (`hasPermission` retourne `true` immédiatement si `session.role === "direction"`, avant même de consulter `role_permissions`). Même si la matrice est mal configurée ou vidée par erreur, `direction` ne peut jamais se retrouver bloqué hors du système. Cohérent avec ça : l'UI de la matrice (`RolesManager.jsx`) affiche la colonne `direction` avec des cases toujours cochées et désactivées (non éditables), et l'API refuse de vider explicitement ses permissions.
- **Renommer un rôle existant n'est pas exposé dans l'UI** : le rôle est identifié par son **nom** dans le JWT de session (`session.role`), pas par son id — renommer invaliderait silencieusement les sessions déjà ouvertes des comptes qui l'utilisent (leur JWT contiendrait encore l'ancien nom, qui ne correspondrait plus à aucune ligne de `roles`). `PUT /api/admin/roles/[id]` ne modifie que l'ensemble de permissions, jamais le nom. Créer un **nouveau** rôle personnalisé (nom + description) est en revanche pleinement supporté et ne pose pas ce problème (les comptes qui l'utilisent obtiennent ce nom dès leur prochaine connexion).
- Les changements de permissions prennent effet **immédiatement**, sans déconnexion/reconnexion : `hasPermission` interroge `role_permissions` à chaque requête via une jointure sur `roles.name = session.role` (le JWT ne contient que le nom du rôle, jamais la liste de permissions elle-même — sinon un changement de permission n'aurait d'effet qu'à la prochaine connexion).

### Exception assumée : restrictions fines par champ

Certaines routes ont une logique **plus fine que "accès à la route"**, sur des champs précis d'un même endpoint — ça reste codé en dur, volontairement **hors** du système de permissions (qui reste au niveau "accès à une action/ressource") :
- `PUT /api/admin/registrations/[id]` (`app/api/admin/registrations/[id]/route.js`) : le rôle `comptabilite` ne peut modifier que `totalDue`, le rôle `suivi` que `visaStatus`/`notes` — vérifié via `session.role === "comptabilite"` / `"suivi"` directement, après le contrôle de permission générique `inscriptions.edit`
- Son miroir côté UI, `EditRegistrationForm.jsx` (`canEditStatus`/`canEditFinance`/`canEditVisa`, calculés depuis le `role` brut passé par `app/admin/inscriptions/[id]/page.js`) — seul `canDelete` (un endpoint séparé, `DELETE .../registrations/[id]`) utilise le système de permissions (`inscriptions.delete`)

Un rôle personnalisé qui obtient `inscriptions.edit` sans être nommé `comptabilite`/`suivi` peut donc modifier tous les champs de ce formulaire — comportement par défaut jugé raisonnable, non traité comme une permission séparée pour ne pas complexifier le catalogue pour un seul endpoit.

### Pages admin

- `/admin/parametres/utilisateurs` (`utilisateurs.manage`) : CRUD des comptes internes (nom, email, téléphone, mot de passe, rôle, actif/inactif). Un compte ne peut ni se désactiver, ni se supprimer, ni changer son propre rôle (`app/api/admin/staff-users/[id]/route.js`) — évite un auto-verrouillage accidentel.
- `/admin/parametres/roles` (`roles.manage`) : matrice rôles × permissions (cases à cocher, groupées par catégorie), création de nouveaux rôles, suppression des rôles personnalisés inutilisés (les 4 rôles fournis avec le système ne sont jamais supprimables, et un rôle encore assigné à un compte non plus).
- Les deux liens n'apparaissent dans la barre latérale (`app/admin/layout.js`) que pour les comptes qui ont la permission correspondante — pas seulement direction, si un rôle personnalisé venait à l'obtenir.

## 3duodecies. Slider animé de l'accueil

Grand visuel animé en haut de la page d'accueil, remplaçant le hero statique quand au moins une diapositive active existe (sinon le hero statique historique reste affiché — `app/(site)/page.js`, aucune page vide possible).

- Table `slides` (migration `008_add_slides.sql`) : titre, sous-titre, image (upload local `public/uploads/slider/`), texte du bouton, `sort_order`, `is_active`, et soit `program_id` (FK vers `programs`) soit `button_link` (URL libre) — jamais les deux à la fois
- **Lien dynamique, pas figé** : quand une diapositive est liée à un programme (`program_id`), son URL publique (`/omra-hajj/[slug]` ou `/voyages-organises/[slug]`, selon `programs.family`) est recalculée à chaque affichage par `lib/slides.js` (`resolveHref`) — si le slug du programme change un jour, le lien de la diapositive reste correct sans intervention. `button_link` ne sert que pour un lien totalement externe/personnalisé
- Permission `slider.manage` (direction uniquement par défaut, éditable comme les autres — voir §3undecies) ; `/admin/slider` (page + `SlidesManager.jsx`) : tableau avec réordonnancement (flèches haut/bas, `moveSlide()` échange `sort_order` avec la diapositive voisine — pas de bibliothèque drag-and-drop), bascule active/inactive en un clic, formulaire création/édition avec upload d'image et sélecteur de programme (qui masque/désactive le champ URL libre)
- `app/_components/HeroSlider.jsx` (client component) : diapositives empilées en `absolute`, transition en fondu par opacité (`transition-opacity`, pas de bibliothèque tierce — cohérent avec le reste du projet, zéro nouvelle dépendance), autoplay 6s en pause au survol, flèches précédent/suivant, puces cliquables. Sans image (`image_url` NULL), un dégradé doré/sombre cohérent avec la charte du site sert de fond — pas d'image cassée
- ⚠️ Saisir des caractères accentués dans un payload JSON via une commande shell (curl `-d '...'` avec du texte inline) peut corrompre l'encodage UTF-8 selon le terminal — préférer écrire le JSON dans un fichier puis `curl --data-binary @fichier.json` pour tout script/test futur insérant du contenu accentué

## 3terdecies. Types de chambre à capacité fixe

`rooms.room_type` (ENUM, migration `009_add_room_type_quintuple.sql`) : `simple`/`double`/`triple`/`quadruple`/`quintuple`, chacun **strictement attaché** à une capacité fixe (1 à 5 personnes respectivement) — pas une coïncidence de valeurs par défaut, une règle métier. `HebergementManager.jsx` (`ROOM_TYPE_CAPACITY`) dérive automatiquement le champ **Capacité** du type choisi et le garde **verrouillé** (lecture seule) dans le formulaire de création de chambre — impossible de saisir une capacité incohérente avec le type. Ajouter un nouveau type (ex. 6 personnes) nécessite une migration (`ALTER ... MODIFY COLUMN room_type ENUM(...)`) + une entrée dans `ROOM_TYPE_CAPACITY`. La constante est désormais partagée (`lib/roomTypes.js`) plutôt que dupliquée, car aussi utilisée par la préférence hébergement (§3quaterdecies).

## 3quaterdecies. Préférence hébergement à l'inscription

Le voyageur peut exprimer un **hôtel et un type de chambre souhaités** dès l'inscription (`registrations.preferred_hotel_id`/`preferred_room_type`, migration `010_add_registration_room_preference.sql`) — champs optionnels sur `NewRegistrationForm.jsx` (nouvelle inscription) et `EditRegistrationForm.jsx` (inscription existante), réservés au même groupe de rôles que `status` (`direction`/`ventes`, voir §3undecies).

⚠️ **C'est une préférence, pas l'affectation réelle** : `registrations.room_id` (chambre effectivement occupée) reste distinct et n'est renseigné que depuis `/admin/voyages/[tripId]/hebergement`, seul endroit qui applique les contraintes réelles (place disponible, non-mixité par chambre). La liste "Voyageurs non affectés" de cette page affiche la préférence à côté de chaque voyageur pour guider le personnel.

- Le choix d'hôtel est limité aux hôtels **déjà rattachés à ce voyage précis** (`trip_hotels`, via `GET /api/admin/trips/[tripId]/hotels`) — pas le catalogue hôtel global — cohérent avec le fait qu'un voyageur ne peut réellement loger que dans un hôtel du voyage auquel il est inscrit. Si l'hébergement du voyage n'est pas encore configuré, le menu reste vide et la préférence est simplement laissée de côté (non bloquant).
- **Répartition automatique** (`autoAssignTrip`) : priorise désormais une chambre correspondant à la préférence via un score (hôtel + type = 3, un seul des deux = 1 ou 2, aucun = 0), avant de retomber sur l'heuristique de remplissage existante (comble les chambres partielles en premier) en cas d'égalité — une chambre qui ne matche que l'hôtel ne doit jamais battre une chambre qui matche hôtel **et** type.
- Volontairement **pas** ajouté au formulaire de réservation publique (`ReservationForm.jsx`) : ce formulaire reste minimal par choix (nom/WhatsApp/email), le reste des informations étant complété par le personnel — cohérent avec le fait que les hôtels d'un voyage peuvent ne pas encore être configurés au moment où un visiteur réserve en ligne.

## 3quindecies. Groupes d'inscription (binôme/couple, famille)

Une inscription reste **toujours un voyageur = une ligne `registrations`** (documents, passeport, visa individuels). Un **groupe** (`registration_groups`, migration `011_add_registration_groups.sql`) ne fait que **lier** plusieurs inscriptions du même voyage, pour les garder visibles ensemble et faciliter leur affectation chambre commune — pas une fusion de dossiers.

- Créé depuis `NewRegistrationForm.jsx` (nouvelle inscription) ou `EditRegistrationForm.jsx` (inscription existante), réservé au même groupe de rôles que `status` (`direction`/`ventes`) : soit "Créer un nouveau groupe" (nom libre + case "Couple/famille"), soit "Rejoindre un groupe existant" du même voyage (`GET /api/admin/trips/[tripId]/groups`)
- **`allow_mixed_gender_room`** (coché uniquement pour un couple/famille) est la **seule exception** à la règle de non-mixité des chambres (`assignRegistrationToRoom`, `lib/roomAssignment.js`) : deux voyageurs de genre différent peuvent partager une chambre **uniquement s'ils appartiennent au même groupe** portant cette case — jamais une mixité générale de la chambre avec des occupants extérieurs au groupe. Vérifié côté serveur (source de vérité) ; le client se contente d'être permissif dans ce cas précis pour ne pas masquer l'option, le serveur tranche.
- `/admin/voyages/[tripId]/hebergement` : la liste "Voyageurs non affectés" regroupe visuellement les membres d'un même groupe et propose un contrôle **"Assigner le groupe à..."** qui affecte tous les membres à la même chambre en un clic (chambres filtrées par capacité restante ≥ taille du groupe) — en plus de l'affectation individuelle habituelle, toujours disponible si le personnel veut les répartir autrement
- La colonne "Genre" de la table des chambres affiche désormais tous les genres présents (`GROUP_CONCAT(DISTINCT ... SEPARATOR ' + ')`, ex. "Homme + Femme") plutôt qu'un seul (`MAX()`), pour rester exacte sur une chambre couple/famille
- **Répartition automatique** (`autoAssignTrip`) : **volontairement pas rendue consciente des groupes** (elle traite chaque genre séparément, sans connaissance des couples/familles) — un couple non affecté manuellement peut se retrouver dans deux chambres différentes après un clic sur "Répartition automatique". C'est un choix de portée délibéré : l'algorithme reste un outil de remplissage rapide générique ; pour garder un couple/groupe ensemble de façon fiable, utiliser "Assigner le groupe à..." (manuel, ci-dessus).

## 4. Modules fonctionnels

### a) Site public
- Publicité des programmes de voyage (page dédiée par programme/voyage)
- Système de réservation en ligne
- Publication des annonces et nouveaux programmes touristiques
- Architecture SEO + GEO : URLs propres, `schema.org` (Trip, TouristTrip, Offer), `llms.txt`, Sitemap dynamique, meta tags par page

### b) Gestion des inscrits (Registrations)
- Saisie et suivi des inscrits
- Classification par programme/voyage
- Suivi du statut de chaque inscrit (inscrit, confirmé, payé partiellement, payé intégralement, annulé...)

### c) Répartition hôtels et chambres
- Affectation de chaque voyageur à un hôtel et une chambre au sein du même voyage (ex. Omra : La Mecque + Médine)
- Logique anti-conflit (chambre complète, type de chambre : simple/double/quadruple...)
- Possibilité d'ajustement manuel après la répartition automatique

### d) Listes intelligentes (générées automatiquement depuis la base de données)
1. **Liste complète des voyageurs** : toutes les informations nécessaires (identité, passeport, hôtel, chambre, programme)
2. **Liste de demande de visas** : format adapté aux exigences de l'organisme concerné
3. **Listes pour compagnies aériennes** : ⚠️ **format différent selon la compagnie** (RAM / Saudia / Turkish / autres) — le système doit avoir un template configurable par compagnie, exportable (Excel/PDF)

### e) Communication intelligente via WhatsApp
- Rappels automatiques des rendez-vous et documents manquants (basé sur n8n + WhatsApp Cloud API)
- Réponses basées sur une **liste de questions/réponses prédéfinies** — pas une conversation IA totalement ouverte, mais un système qui oriente les messages entrants vers la réponse adaptée de la liste
- Possibilité d'escalade vers un employé humain si le message ne correspond à aucune entrée de la liste

### f) Section administrative et de gestion
- Droits des utilisateurs : 4 rôles fournis avec le système (direction, ventes, comptabilité, suivi) + rôles personnalisés possibles, permissions éditables par action (voir §3undecies) — `/admin/parametres/utilisateurs` et `/admin/parametres/roles`
- Workflow interne

### g) Audit et suivi financier
- Suivi de chaque service fourni à chaque voyageur (montant, payé, restant dû)
- Rapports financiers (par voyage, par période, par programme)

## 5. Éléments à ne pas changer sans demande explicite

- Next.js avec SSR/SSG pour les pages de contenu public (pas de SPA pure) — nécessaire pour le SEO/GEO
- MySQL comme base de données principale
- Le format différent par compagnie aérienne dans les listes — ne pas unifier le template sans demande explicite
- Réponses WhatsApp basées sur une liste de questions prédéfinies, pas une IA totalement ouverte (sauf instruction contraire explicite)

## 6. Pour commencer à travailler avec Claude Code

1. `git init` / `git clone` du repo
2. `claude` dans le terminal, à la racine du projet
3. `/install-github-app` (une seule fois) pour activer l'intégration GitHub
4. Ordre de démarrage proposé :
   - Structure de la base de données (schéma MySQL) : voyages, programmes, inscrits, hôtels, chambres, paiements, compagnies aériennes
   - Structure Next.js (pages, API routes, connexion à la base de données)
   - Page type d'un programme de voyage (prête pour le SEO/GEO) + système de réservation
   - Tableau de bord interne de base (CRUD des inscrits)
   - Module de répartition hôtels/chambres
   - Générateur de listes (voyageurs, visas, compagnies aériennes)
   - Connexion n8n + WhatsApp Cloud API pour les rappels

## 7. Informations encore à préciser

- Nom de domaine du site
- Organisme(s) concerné(s) par les demandes de visa (pour construire le format requis)
- ~~Types de chambres standards proposés~~ — tranché : simple/double/triple/quadruple/quintuple (1 à 5 personnes), voir §3terdecies
- Devise(s) de facturation (MAD uniquement, ou multi-devises ?)
- ~~Adresse et téléphone réels de l'agence~~ — tranché : renseignés depuis `/admin/parametres` (§3septies), `LocalBusiness` actif (§3quinquies)

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
