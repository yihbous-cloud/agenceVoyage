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

⚠️ **Mise à jour** : les points 2 (visa) et 4 (autres services) ci-dessous décrivent la décision **initiale** du projet. Depuis, le visa et les services facturés par voyageur ont été retirés de l'inscription liée à un voyage — **inclus dans le prix global du programme** (`trips.price_per_person`), plus itemisés à part. Le visa reste utilisé, mais uniquement comme **service autonome** (hors voyage), voir §3sedecies. Section conservée pour l'historique de la décision "type de visa ≠ prix unique", toujours vraie pour le catalogue `visa_types`.

L'agence facture, par inscription/voyageur, des **services** distincts du prix du voyage lui-même :

1. **Programme Omra / Hajj / tourisme** — le voyage organisé (déjà modélisé : ~~`trips.price_per_person`~~ — remplacé par 4 prix par type de chambre depuis §3unetrigies, voir cette section)
2. **Service visa** — ⚠️ chaque **type de visa** a sa propre **liste de documents requis** et son propre **prix** (ne pas modéliser le visa comme un simple service générique à prix unique)
3. **Réservation billet d'avion** — le prix/la logistique dépend de la **compagnie aérienne** choisie (RAM, Saudia, Turkish...)
4. **Autres services** — catalogue **extensible** : de nouveaux types de service doivent pouvoir être ajoutés plus tard sans développement supplémentaire (même exigence que pour les compagnies aériennes, section 3)

**Décisions prises (voir `database/schema.sql`)** :
- Types de visa : catalogue global réutilisable (`visa_types`, `program_id` NULL) **et** possibilité de types spécifiques à un programme (`program_id` renseigné) — les deux cas sont supportés
- Documents requis par type de visa : catalogue (`visa_type_documents`) + suivi individuel fourni/manquant par voyageur (`visa_request_documents`), lié à `visa_requests.visa_type_id`
- Billet d'avion : ~~prix rattaché au **voyage précis** (`trips.flight_ticket_price`)~~ — **retiré** depuis §3novovicies, désormais inclus dans le prix du voyage (4 paliers par type de chambre depuis §3unetrigies) comme le visa et les autres services (colonne `flight_ticket_price` conservée en base, dépréciée, plus alimentée)
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

- Le choix d'hôtel est limité aux hôtels **déjà rattachés à ce voyage précis** (`trip_hotels`, via `GET /api/admin/trips/[tripId]/hotels`) — pas le catalogue hôtel global — cohérent avec le fait qu'un voyageur ne peut réellement loger que dans un hôtel du voyage auquel il est inscrit. **Repli** (même route) : si `trip_hotels` est vide (hébergement du voyage pas encore configuré), la route retourne à la place les hôtels par défaut du programme (`program_hotels`, §3vicies) — même forme de réponse (`hotel_id`/`hotel_name`/`city`), le client ne fait aucune distinction. Si le programme n'a pas non plus de hôtels par défaut, le menu reste vide comme avant (non bloquant).
- **Répartition automatique** (`autoAssignTrip`) : priorise une chambre correspondant à la préférence via un score (hôtel + type = 3, un seul des deux = 1 ou 2, aucun = 0), avant de retomber sur l'heuristique de remplissage existante (comble les chambres partielles en premier) en cas d'égalité — une chambre qui ne matche que l'hôtel ne doit jamais battre une chambre qui matche hôtel **et** type. **Ordre de traitement** : au sein d'un même genre, les voyageurs ayant exprimé une préférence sont traités **avant** ceux qui n'en ont pas — sans ça, un voyageur sans préférence traité plus tôt (ordre alphabétique) pouvait occuper la chambre qu'un voyageur avec préférence, traité plus tard, avait explicitement demandée (le score ne joue qu'au moment du choix, il ne réserve rien pour un traitement futur). La non-mixité par chambre reste strictement appliquée (`r.gender === null || r.gender === gender` — une chambre mixte via l'exception couple/groupe, voir §3quindecies, est exclue de tout nouvel ajout solo par répartition automatique).
- Volontairement **pas** ajouté au formulaire de réservation publique (`ReservationForm.jsx`) : ce formulaire reste minimal par choix (nom/WhatsApp/email), le reste des informations étant complété par le personnel — cohérent avec le fait que les hôtels d'un voyage peuvent ne pas encore être configurés au moment où un visiteur réserve en ligne.

## 3quindecies. Groupes d'inscription (binôme/couple, famille)

Une inscription reste **toujours un voyageur = une ligne `registrations`** (documents, passeport, visa individuels). Un **groupe** (`registration_groups`, migration `011_add_registration_groups.sql`) ne fait que **lier** plusieurs inscriptions du même voyage, pour les garder visibles ensemble, partager leur suivi financier et faciliter leur affectation chambre commune — pas une fusion de dossiers.

### Création — trois types d'inscription

`/admin/inscriptions/new` (`NewRegistrationForm.jsx`) commence par un choix **Individuel / Binôme / Groupe** :
- **Individuel** : un seul bloc de champs voyageur (comportement historique, inchangé)
- **Binôme** : exactement deux blocs de champs voyageur affichés l'un sous l'autre (pas de bouton ajouter/retirer)
- **Groupe** : un bloc de champs voyageur + bouton **"+ Ajouter un voyageur"** répétable (et "Retirer" par voyageur, tant qu'il en reste au moins un)

Chaque bloc (`TravelerFields.jsx`, composant réutilisable) porte sa **propre** vérification de passeport (format + dialogue de confirmation + expiration ≥ 6 mois après le départ du voyage sélectionné, voir §3nonies) — indépendante d'un voyageur à l'autre. Pour binôme/groupe, un nom de groupe (texte libre) et la case "Couple/famille" (voir `allow_mixed_gender_room` ci-dessous) sont demandés une fois pour tout le groupe. La préférence hôtel/type de chambre (§3quaterdecies) est elle aussi saisie une seule fois et appliquée à tous les membres.

À la soumission : le groupe est créé d'abord (`POST /api/admin/trips/[tripId]/groups`), puis chaque voyageur est créé séparément (`POST /api/admin/registrations`, un appel par personne) avec `groupId` renseigné. Redirection vers `/admin/groupes/[id]` si un groupe a été créé, vers `/admin/inscriptions` sinon (individuel).

Après création, un groupe peut aussi être rejoint/créé/quitté depuis une inscription déjà existante (`EditRegistrationForm.jsx`, "Groupe / binôme" : Voyageur seul / Créer un nouveau groupe / Rejoindre un groupe existant) — utile si un membre s'inscrit séparément plus tard.

### Chambre mixte (couple/famille)

**`allow_mixed_gender_room`** (coché uniquement pour un couple/famille) est la **seule exception** à la règle de non-mixité des chambres (`assignRegistrationToRoom`, `lib/roomAssignment.js`) : deux voyageurs de genre différent peuvent partager une chambre **uniquement s'ils appartiennent au même groupe** portant cette case — jamais une mixité générale de la chambre avec des occupants extérieurs au groupe. Vérifié côté serveur (source de vérité) ; le client se contente d'être permissif dans ce cas précis pour ne pas masquer l'option, le serveur tranche.

- `/admin/voyages/[tripId]/hebergement` : la liste "Voyageurs non affectés" regroupe visuellement les membres d'un même groupe et propose un contrôle **"Assigner le groupe à..."** qui affecte tous les membres à la même chambre en un clic (chambres filtrées par capacité restante ≥ taille du groupe) — en plus de l'affectation individuelle habituelle, toujours disponible si le personnel veut les répartir autrement
- La colonne "Genre" de la table des chambres affiche désormais tous les genres présents (`GROUP_CONCAT(DISTINCT ... SEPARATOR ' + ')`, ex. "Homme + Femme") plutôt qu'un seul (`MAX()`), pour rester exacte sur une chambre couple/famille
- **Répartition automatique** (`autoAssignTrip`) : **volontairement pas rendue consciente des groupes** (elle traite chaque genre séparément, sans connaissance des couples/familles) — un couple non affecté manuellement peut se retrouver dans deux chambres différentes après un clic sur "Répartition automatique". Pour garder un couple/groupe ensemble de façon fiable, utiliser "Assigner le groupe à..." (manuel, ci-dessus).

### Paiement et suivi financier partagés (migration `012_add_group_payments.sql`)

Un groupe (binôme ou groupe) a **un seul montant dû et un seul historique de versements pour tout le groupe** — pas un montant par personne. Le détail individuel (passeport, visa, statut) reste par voyageur.

- `registration_groups.total_due` (partagé) remplace `registrations.total_due` pour les membres d'un groupe — ce dernier champ reste présent en base mais **n'est plus affiché ni modifiable** pour une inscription groupée (`EditRegistrationForm.jsx` affiche un lien vers la page du groupe à la place)
- `payments.registration_id` est désormais **nullable** ; `payments.group_id` (nullable, FK `registration_groups`) le complète. Un paiement cible **soit l'un soit l'autre, jamais les deux ni aucun des deux** (`CHECK` en base, `chk_payment_target`) — un paiement de groupe couvre tous ses membres à la fois
- **`/admin/groupes/[id]`** (nouvelle page) : liste des membres (nom, genre, statut, statut visa — chacun avec un lien vers sa fiche individuelle pour le détail non-financier), formulaire montant dû partagé (`GroupDueForm.jsx`), et `PaymentsSection.jsx` (rendue générique via une prop `apiBasePath` plutôt qu'un `registrationId` figé, réutilisée telle quelle entre une inscription individuelle et un groupe)
- Le **reçu de paiement PDF** (`lib/exporters/receiptPdf.js`) détecte un paiement de groupe (`payment.members` présent) et affiche "Groupe : {nom}" + la liste de tous les voyageurs du groupe, à la place du champ "Client" individuel — le reste du reçu (détail du versement, montant total dû, solde) est inchangé
- Les rapports financiers (`lib/payments.js` : `getFinancialSummaryByTrip`/`ByProgram`, `getPaymentsByPeriod`) additionnent explicitement le volet individuel (`group_id IS NULL`) et le volet groupe (`registration_groups.total_due`/`payments.group_id`) pour ne rien compter deux fois ni rien oublier ; calculés via des sous-requêtes corrélées plutôt que des `LEFT JOIN` agrégés, pour éviter un double-comptage par fan-out (un voyage avec plusieurs inscriptions/paiements gonflait `SUM(total_due)` dans l'ancienne version)

## 3sedecies. Visa et services retirés de l'inscription ; service visa autonome (migration `013_add_standalone_visa_service.sql`)

Le visa et les services facturés (§3bis) ne sont **plus gérés par inscription liée à un voyage** — leur prix est désormais **inclus dans le prix global du programme** (`trips.price_per_person`), plus itemisé à part. `VisaSection.jsx`/`ServicesSection.jsx` et leurs routes API ont été supprimés de `/admin/inscriptions/[id]` ; `registration_services` et `visa_requests`/`visa_request_documents` restent en base (vidées) mais ne sont plus alimentées — conservées pour ne pas casser une éventuelle réutilisation future, pas pour un usage actif. Le champ rapide **"Statut visa"** sur `EditRegistrationForm.jsx` (`registrations.visa_status`) reste néanmoins disponible : c'est un simple indicateur manuel, indépendant du catalogue/de la facturation, jugé assez léger pour être conservé.

La page publique de détail programme (`ProgramDetail.jsx`) n'affiche donc plus la section "Visa et documents à prévoir" (prix par type de visa) : ce prix est déjà dans le total affiché, l'afficher à part aurait été trompeur.

### Service visa autonome (hors voyage)

Un client peut demander une aide visa **indépendamment de tout voyage réservé chez l'agence** (ex. quelqu'un qui a besoin d'un visa Omra ou touristique sans passer par un programme Golden Fantastic) :

- Table dédiée `visa_service_requests` (voyageur, type de visa — détermine destination/prix/documents via `visa_types`, statut, `total_due`) + `visa_service_documents` (checklist, même mécanique que l'ancien `visa_request_documents` : générée automatiquement depuis `visa_type_documents` à la création, voir `createVisaServiceRequest` dans `lib/visaServices.js`)
- **Suivi financier propre**, comme un groupe d'inscription : `payments.visa_service_id` (nullable) est un **troisième** cible possible pour un paiement, en plus de `registration_id`/`group_id` — le `CHECK chk_payment_target` exige désormais exactement un des trois, jamais deux ni aucun
- `/admin/visa-services` (liste, permission `visa_services.manage` — direction/ventes/suivi/comptabilite par défaut) → `/admin/visa-services/new` (création : type de visa par **destination**, nom, genre, WhatsApp, email — réutilise le voyageur existant par numéro WhatsApp comme `createRegistration`) → `/admin/visa-services/[id]` (statut + checklist documents via `VisaServiceManager.jsx`, montant dû via `GroupDueForm.jsx` généralisé — même composant que pour un groupe, `apiBasePath` variable —, et `PaymentsSection.jsx` réutilisé tel quel)
- Le **reçu PDF** détecte `payment.isVisaService` et affiche "Service : {type de visa} ({pays})" à la place de "Programme"/"Voyage" (aucun voyage associé) ; `getPaymentsByPeriod` (page Finances) ajoute une 3ᵉ branche `UNION ALL` pour lister aussi ces paiements, avec "Service visa" en guise de programme — mais un service visa autonome **n'entre jamais** dans les totaux "Par voyage"/"Par programme" (aucun lien avec un `trip_id`, ça n'aurait pas de sens)
- ⚠️ Les libellés de champ du reçu PDF doivent tenir sur une ligne dans `labelWidth` (110pt) : "Montant total dû (service visa)" débordait sur deux lignes et chevauchait le champ suivant (`drawField` avance d'une hauteur fixe, pas proportionnelle au nombre de lignes) — préférer des libellés courts ("Montant dû (visa)") plutôt que de complexifier `drawField` pour un cas rare

## 3septendecies. Montant dû pré-rempli au prix

Une inscription (individuelle ou groupe) démarre désormais avec `total_due` déjà rempli au prix du voyage — pas 0 — pour que le personnel n'ait pas à ressaisir un montant qu'il vient de voir affiché à l'écran (voir §3quindecies/§3sedecies pour le contexte). Même principe pour un service visa autonome, avec le prix du type de visa choisi. Reste **modifiable** ensuite comme avant (tarif négocié, remise...), rien n'est verrouillé.

- Individuel : `createRegistration()` (`lib/registrations.js`) regarde le prix du voyage choisi (palier de type de chambre demandé, sinon le plus bas — voir §3unetrigies) quand `data.totalDue` n'est pas fourni — un appelant peut toujours forcer un montant différent en le passant explicitement (ex. tarif négocié dès la création)
- Groupe/binôme : `NewRegistrationForm.jsx` calcule prix × nombre de voyageurs et fait un `PUT /api/admin/groups/[id]` juste après la création du groupe (le prix par personne n'est connu qu'au moment du choix du voyage, avant que les inscriptions individuelles existent)
- Service visa autonome : `createVisaServiceRequest()` (`lib/visaServices.js`) regarde `visa_types.price` du type choisi, même mécanique que `createRegistration`
- ⚠️ Piège React rencontré en implémentant ceci : `{group.allow_mixed_gender_room && (<span>...)}` affichait un **"0" visible à l'écran** quand la case n'était pas cochée — `mysql2` renvoie un `TINYINT(1)` comme `0`/`1` (nombre), pas `false`/`true`, et React rend `0` comme texte littéral (contrairement à `false`/`null`/`undefined`, silencieux). Toujours écrire `{Boolean(champ_booleen_mysql) && (...)}` (ou `!!`) pour un flag venant directement d'une requête SQL, jamais `{champ && (...)}` nu.

## 3octodecies. Dates d'hôtel bornées aux dates du voyage

`/admin/voyages/[tripId]/hebergement` : les dates de check-in/check-out d'un hôtel ajouté au voyage doivent rester **dans** les dates du voyage (`trips.departure_date`/`return_date`) — auparavant non vérifié, un hôtel avait pu être ajouté avec des dates totalement hors du voyage (trouvé et corrigé en base). Validé côté client (`min`/`max` sur les `<input type="date">`, plus message d'erreur explicite si contourné) **et** côté serveur (`POST /api/admin/trips/[tripId]/hotels`, source de vérité) — le check-in doit aussi précéder le check-out.

## 3novemdecies. Hébergement organisé par ville, attaché dès la création du voyage

Un voyage peut avoir plusieurs hôtels dans des villes différentes (ex. Omra : Mecque **et** Médine, cf. commentaire déjà présent dans `database/schema.sql` sur `trip_hotels`) — avant cette section, `/admin/voyages/[tripId]/hebergement` affichait hôtels, chambres et menus d'affectation en une seule liste à plat mélangeant toutes les villes, au risque d'affecter un voyageur à la mauvaise ville par inattention.

- **`lib/roomAssignment.js`** : `listTripHotels` trié par `h.city` d'abord ; `listRoomsForTrip` renvoie désormais aussi `hotel_city` (`h.city AS hotel_city`) et trie par ville également
- **`HebergementManager.jsx`** : `groupByCity()` (regroupement générique par la clé ville d'un tableau) — la liste "Hôtels du voyage" et le tableau "Chambres" sont désormais **sous-sectionnés par ville** (sous-titre par ville) ; tous les `<select>` d'affectation (chambre pour un voyageur seul, chambre pour un groupe, hôtel du catalogue, hôtel du voyage pour créer une chambre) utilisent des `<optgroup>` par ville plutôt qu'une liste plate
- **Redirection vers l'hébergement dès la création du voyage** : `TripForm.jsx` redirige désormais, à la **création** d'un voyage (pas à l'édition), directement vers `/admin/voyages/[id]/hebergement` au lieu de revenir sur la fiche programme — attacher les hôtels du voyage devient l'étape suivante immédiate, plutôt qu'une action separée qu'on risque d'oublier (d'autant plus depuis §3duotrigies, où plus rien n'est pré-rempli automatiquement). Techniquement les dates d'hôtel ne peuvent être validées qu'une fois le voyage créé (elles sont bornées par `trips.departure_date`/`return_date`, voir §3octodecies) : impossible de fusionner les deux formulaires, d'où ce chaînage par redirection plutôt qu'un unique écran.

## 3vicies. Hôtels par défaut d'un programme (migration `014_add_program_default_hotels.sql`)

Un programme (ex. "Omra Ramadan") utilise généralement les mêmes hôtels à chaque départ — répéter la saisie des hôtels à chaque nouveau voyage (§3novemdecies) était redondant. Les hôtels **habituels** du programme se fixent une fois, à sa création (`/admin/programmes/new`) ou depuis sa fiche (`/admin/programmes/[id]`). ⚠️ **Ne s'appliquent plus automatiquement aux nouveaux voyages depuis §3duotrigies** — voir cette section pour la raison ; ce catalogue sert désormais uniquement de repli pour le menu "Hôtel souhaité" des inscriptions (§3quaterdecies) tant que le voyage n'a pas encore d'hôtels configurés dans son hébergement.

- Table `program_hotels` (`program_id`, `hotel_id`, clé unique sur la paire) — simple catalogue de référence, **pas** de dates (les dates restent propres à chaque voyage, un même programme pouvant avoir des voyages à des dates différentes)
- `lib/programHotels.js` : `listDefaultHotelsForProgram`, `setDefaultHotelsForProgram` (remplacement complet purge + réinsertion, même pattern que `setRolePermissions` dans `lib/permissions.js`)
- **`ProgramForm.jsx`** : ~~case à cocher par hôtel du catalogue global, groupées par ville~~ — remplacé par un `<select multiple>` à `<optgroup>` par ville depuis §3trigies, même sélection multiple, envoyée en `defaultHotelIds` dans le payload de création/édition du programme
- ~~**Auto-attachement à la création d'un voyage**~~ : retiré, voir §3duotrigies

## 3unvicies. Alerte de préférence non respectée sur une chambre déjà occupée

Une fois un voyageur affecté à une chambre, la table "Chambres" de `/admin/voyages/[tripId]/hebergement` n'affichait plus que l'occupation agrégée (ex. "1 / 5", genre) — la préférence hôtel/type exprimée à l'inscription (§3quaterdecies) n'était visible que tant que le voyageur restait "non affecté". Une fois affecté, rien ne signalait plus qu'un changement manuel de chambre (ou un résultat de répartition automatique — qui **ne connaît pas** les préférences groupe, voir §3quindecies) avait placé quelqu'un dans une chambre différente de celle demandée.

- **`lib/roomAssignment.js`** : nouvelle fonction `listAssignedRegistrationsForTrip(tripId)` — même forme que `listUnassignedRegistrations` mais `room_id IS NOT NULL`
- **`HebergementManager.jsx`** : nouvelle colonne "Voyageurs" sur le tableau des chambres, listant chaque occupant par son nom ; si sa préférence (`preferred_hotel_id`/`preferred_room_type`) diffère de l'hôtel/type réel de la chambre, un badge ⚠ "avait demandé {hôtel} — {type}" apparaît à côté de son nom — comparaison faite uniquement sur les champs où une préférence a été exprimée (un voyageur sans préférence n'affiche jamais d'alerte)
- Volontairement informatif seulement, pas bloquant : le personnel peut avoir une bonne raison de déroger (hôtel préféré complet, contrainte de dernière minute) — l'objectif est de rendre l'écart visible, pas de l'empêcher
- **Le menu "Assigner à..."/"Assigner le groupe à..." filtre lui aussi par préférence** (`filterByPreference` dans `HebergementManager.jsx`) : un voyageur avec une préférence hôtel + type ne voit que les chambres de ce type dans cet hôtel (pas les autres hôtels/types du voyage) — retombe sur la liste complète uniquement si rien ne correspond (hôtel préféré complet), pour ne jamais bloquer l'affectation. Pour un groupe, la préférence est lue sur le premier membre (tous partagent la même, saisie une seule fois à l'inscription — voir §3quindecies)

## 3duovicies. Recherche par nom ou groupe sur la liste des inscrits

`/admin/inscriptions` ne permettait de filtrer que par voyage ou statut (paramètres d'URL `tripId`/`status`) — aucun moyen de retrouver rapidement une personne ou un groupe/binôme précis dans une longue liste.

- `listRegistrations({ tripId, status, q })` (`lib/registrations.js`) : `q` filtre sur `tr.full_name LIKE %q%` **ou** `rg.label LIKE %q%` (nom du groupe/binôme, via un nouveau `LEFT JOIN registration_groups`) — un seul champ couvre les deux cas, un même mot-clé (ex. "Fassi") retrouve aussi bien un voyageur nommé ainsi que tous les membres d'un groupe "Famille Fassi"
- **`SearchBar.jsx`** (client component) : filtre dès la première lettre tapée, pas besoin de valider — débattu de 300ms (`setTimeout`/`clearTimeout` sur `value`) pour éviter une navigation à chaque frappe, met à jour l'URL via `router.replace(..., { scroll: false })` en préservant `tripId`/`status` déjà présents dans `searchParams`. Un `useEffect` sur `initialQuery` resynchronise le champ si l'URL change de l'extérieur (ex. le lien "réinitialiser" de la page)
- La colonne "Voyageur" affiche désormais le nom du groupe entre parenthèses quand l'inscription en fait partie, pour confirmer visuellement qu'une recherche par nom de groupe a bien fonctionné — ce nom est un **lien** vers `/admin/groupes/[id]` (traitement par groupe : montant dû, paiements, tous les membres), à côté du lien "Afficher" existant vers la fiche individuelle (traitement par voyageur) — les deux niveaux de traitement restent accessibles depuis la même ligne

## 3trevicies. Voyageurs masqués de l'hébergement tant que non payés / visa non entamé

`listUnassignedRegistrations` (`lib/roomAssignment.js`, utilisée par la liste "Voyageurs non affectés" **et** `autoAssignTrip`) n'affiche/ne propose désormais que les voyageurs ayant **au moins un versement enregistré** (`status IN ('paye_partiel', 'paye_complet')`) **et** une **démarche visa au moins lancée** (`visa_status IN ('en_cours', 'accorde')`) — inutile de réserver une chambre à quelqu'un dont l'inscription peut encore changer (aucun acompte, visa jamais demandé).

- Seuil volontairement **pas** le plus strict : un acompte partiel suffit (pas besoin du paiement complet), un visa "en cours" suffit (pas besoin de l'accord définitif, qui peut prendre du temps) — choisi explicitement par l'utilisateur pour ne pas bloquer l'organisation de l'hébergement en attendant une validation finale qui peut traîner
- S'applique **avant** l'affectation (voyageurs non affectés, individuels et groupes) — un voyageur déjà affecté à une chambre reste affiché normalement dans le tableau "Chambres" quel que soit son statut de paiement/visa, ce filtre ne retire jamais une affectation déjà faite
- Conséquence attendue sur des données de démo sans paiement/visa enregistrés : la liste "Voyageurs non affectés" peut apparaître vide même avec des inscriptions en attente — normal, pas un bug, tant qu'aucun versement ni démarche visa n'a été saisi
- ⚠️ **Bug trouvé et corrigé pour les membres d'un groupe** : `registrations.status` reste "inscrit" à vie pour un membre de groupe (le suivi financier d'un groupe passe exclusivement par `registration_groups.total_due`/`payments.group_id`, voir §3quindecies — rien ne met jamais à jour `status` individuellement). Le critère de paiement vérifiait donc `r.status`, ce qui cachait indéfiniment un groupe même entièrement payé. Corrigé : pour un membre de groupe (`r.group_id IS NOT NULL`), le critère devient l'existence d'**au moins un versement du groupe** (`EXISTS (SELECT 1 FROM payments WHERE group_id = r.group_id)`) plutôt que `r.status` — le critère visa reste inchangé (`visa_status` reste individuel même au sein d'un groupe, un passeport = une démarche visa)

## 3quattuorvicies. Préférence hôtel par ville (migration `015_add_registration_hotel_preferences.sql`)

Un voyageur Omra passe par plusieurs villes (Mecque **et** Médine) — une seule préférence d'hôtel par inscription (`registrations.preferred_hotel_id`, migration 010) ne suffisait pas : `/admin/inscriptions/new` n'affichait qu'un seul menu mélangeant les hôtels des deux villes. Remplacé par une préférence **par ville**.

- Table `registration_hotel_preferences` (`registration_id`, `city`, `hotel_id`, unique sur `(registration_id, city)`) — `registrations.preferred_hotel_id` reste en base pour l'historique mais **n'est plus alimentée** (même pattern que `registration_services`/`visa_requests` en §3sedecies). `preferred_room_type` reste inchangé : un seul type de chambre partagé pour tout le séjour, la scission ne concernait que le choix d'hôtel
- `lib/registrationHotelPreferences.js` : `listHotelPreferencesForRegistration`, `setHotelPreferencesForRegistration` (purge + réinsertion, même pattern que `setRolePermissions`), `listHotelPreferencesForTrip` (tout un voyage en un aller-retour, évite le N+1 dans `listUnassignedRegistrations`)
- **`NewRegistrationForm.jsx`/`EditRegistrationForm.jsx`** : un menu déroulant **par ville** présente dans les hôtels du voyage (groupés dynamiquement, pas de ville codée en dur — cohérent avec §3octies), state `{ [ville]: hotelId }`, envoyé comme `hotelPreferences: [{ city, hotelId }]`
- **Comparaison à l'affectation réelle, corrigée au passage** : `listAssignedRegistrationsForTrip` corrèle désormais la préférence à la **ville de la chambre réellement affectée** (`JOIN` jusqu'à `hotels.city` de la chambre, puis `registration_hotel_preferences` filtrée sur cette même ville) plutôt qu'à une préférence unique globale — évite un faux "mismatch" quand la chambre affectée est dans une ville où le voyageur n'avait justement pas exprimé de préférence différente. L'alerte ⚠ de `HebergementManager.jsx` (§3unvicies) et le filtre `filterByPreference` du menu "Assigner à..." n'ont pas eu besoin de changer de logique, seulement de source de données (`hotelPreferences[]` au lieu d'un `preferred_hotel_id` unique)
- `autoAssignTrip` : le score de préférence (§3quaterdecies) matche désormais si l'hôtel de la chambre figure dans **n'importe laquelle** des préférences par ville du voyageur (un seul `room_id` par inscription au total, voir limitation ci-dessous — la répartition ne sait pas à quelle ville correspond la chambre unique qu'elle cherche à remplir)
- ⚠️ **Limitation assumée, pas corrigée ici** : le système n'affecte toujours qu'**une seule chambre par inscription** pour tout le voyage (`registrations.room_id` reste unique), alors qu'un voyageur Omra occupe réellement une chambre à la Mecque ET une chambre à Médine. Cette section ajoute la **préférence** par ville (déclarative, à l'inscription) sans changer le **mécanisme d'affectation réelle** — décision explicite pour limiter le risque (voir discussion), une éventuelle affectation à deux chambres réelles simultanées serait un chantier séparé, plus profond (page hébergement, listes, reçus)

## 3quinvicies. Remplissage automatique depuis un scanner de passeport (MRZ)

Sur `/admin/inscriptions/new` (chaque bloc voyageur) et `/admin/inscriptions/[id]` (fiche voyageur, tant qu'elle n'est pas verrouillée), un champ "Scanner le passeport" permet de remplir automatiquement nom, genre, date de naissance, numéro de passeport et date d'expiration.

- **Matériel visé** : un lecteur de passeport USB bon marché (mode clavier/HID) — il suffit de placer le curseur dans le champ puis de scanner, le lecteur "tape" directement les 2 lignes du code MRZ (zone lisible en bas de la page passeport, norme ICAO 9303, format TD3). Le même champ accepte aussi un copier-coller manuel du code MRZ — aucun matériel spécifique requis côté navigateur
- **`lib/mrzParser.js`** (nouveau, zéro dépendance externe — cohérent avec le reste du projet) : `parsePassportMrz(rawText)` — reconnaît un MRZ passeport TD3 dans les 2 dernières lignes non vides du texte, extrait nom/prénom, numéro de passeport, genre, date de naissance, date d'expiration, nationalité, et **vérifie les chiffres de contrôle ICAO** (poids 7-3-1 par caractère) pour détecter une lecture erronée. Retourne `null` si le format n'est pas reconnu (silencieux, pas de faux rejet pendant la frappe/collage en cours) ; retourne `{ valid: false, warnings: [...] }` si un chiffre de contrôle ne correspond pas (⚠ affiché, champs quand même pré-remplis mais à vérifier — un chiffre de contrôle qui échoue signale presque toujours un souci de lecture physique du scanner, pas un défaut du parseur)
- **`app/admin/inscriptions/PassportScanInput.jsx`** (composant partagé) : zone de texte dédiée, parse à chaque frappe/collage, callback `onScan(parsedFieldsOrNull)` laissé au formulaire parent pour appliquer les champs — le composant ne connaît pas la forme exacte de l'état du formulaire (objet unique dans `TravelerFields.jsx`, `useState` séparés dans `EditTravelerForm.jsx`)
- Le scan **ne contourne pas** les vérifications existantes (§3nonies) : après un scan, le champ passeport garde son état "non confirmé" (la confirmation par dialogue reste déclenchée au blur, comme une saisie manuelle) et la date d'expiration reste validée par rapport aux 6 mois après le départ — un scan valide en checksum n'est pas automatiquement synonyme de passeport valide pour CE voyage précis
- N'écrase jamais un champ non lu par le scan (ex. MRZ sans genre exploitable) : chaque champ scanné n'est appliqué que s'il a une valeur, sinon la valeur déjà saisie manuellement est conservée

## 3sexvicies. Multi-agences — fondations (passe 1 sur 2, migration `016_add_multi_agency.sql`)

Le système est conçu pour héberger **plusieurs agences indépendantes** sur un même déploiement/base. Décisions retenues : **une agence = un sous-domaine** ; **un compte staff = une seule agence** ; **catalogues propres à chaque agence** (hôtels, compagnies, visa, programmes, voyages, rôles...) ; **création d'agence manuelle** (pas d'interface super-admin pour l'instant). Refonte structurelle volontairement faite en deux passes — **cette passe pose les fondations, la suivante filtre les requêtes**.

### ⚠️ État actuel : NE PAS créer de deuxième agence avec de vraies données

Aucune requête métier (`lib/*.js`) ne filtre encore par `agency_id`, et tous les `INSERT` existants ne le renseignent pas (ils tombent sur `DEFAULT 1`). Tant que seule l'agence 1 (Golden Fantastic) a des données, rien ne fuit. Une agence 2 avec de vraies données verrait/mélangerait celles de l'agence 1 — **la passe 2 (filtrage) doit précéder tout onboarding réel**. `agency_id ... DEFAULT 1` est conservé **exprès** (le retirer casserait tous les `INSERT` actuels) et ne sera retiré qu'une fois chaque `INSERT` retrofité.

### Fait dans la passe 1

- **Schéma** : table `agencies` (nom, `subdomain` unique, coordonnées, `footer_note`, `is_active`), agence 1 reprise de `agency_settings` ; colonne `agency_id` (FK) sur 27 tables métier, y compris celles dérivables par jointure (`trips`, `rooms`, `payments`...) — **volontairement redondante** : une seule colonne à filtrer dans chaque requête plutôt qu'une chaîne de jointures qu'il faudrait refaire juste à chaque fois (le risque n°1 de fuite inter-agences est une jointure oubliée). Tables restées globales : `permissions` (capacités du logiciel), `services`, tables dépréciées vides
- **Unicité par agence** : `roles(name)`, `staff_users(email)`, `programs(slug)`, `trips(reference_code)`, `airlines(name)`, `news_posts(slug)` deviennent uniques **par `(agency_id, …)`**. `roles.id`/`role_id` élargis à `BIGINT` (4 rôles × N agences dépasserait `TINYINT`)
- **Rôles propres à chaque agence** (déduit des décisions, non posé explicitement en question) : `scripts/create-agency.js "Nom" sous-domaine` crée l'agence et copie les 4 rôles de base + leur matrice de permissions depuis l'agence 1 ; puis `scripts/create-staff-user.js "Nom" email mdp direction <agencyId>` (5ᵉ argument, `1` par défaut). `hasPermission` filtre `roles.agency_id = session.agencyId` ; le filet "`direction` a tout" (§3undecies) est inchangé
- **`proxy.js`** remplace `middleware.js` (déprécié en Next 16 ; runtime Node, pas edge). Il résout l'agence depuis l'en-tête `Host` (`lib/agencyHost.js`, fonction pure) puis `lib/agencies.js` (**cache mémoire** 5 min — les docs Next déconseillent les accès lents dans `proxy` ; agence inconnue → 404 "Agence introuvable", **jamais** de repli silencieux sur l'agence 1 en production) et pose l'en-tête interne **`x-agency-id`**, **toujours écrasé** (une valeur envoyée par le client n'est jamais prise en compte). Le `matcher` couvre désormais toutes les routes hors assets statiques (avant : `/admin` seulement), car login et pages publiques ont besoin de l'agence
- **Sessions** : le JWT porte `agencyId` ; `getSession()` (`lib/session.js`) renvoie `null` si l'agence de la session ≠ celle de la requête (défense en profondeur pour les routes API, que `proxy` ne filtre pas par session) ; `proxy` fait le même contrôle pour `/admin`. La connexion (`/api/auth/login`) ne cherche le compte que dans l'agence de la requête. **Conséquence : toute session émise avant cette migration (sans `agencyId`) est invalide — reconnexion unique nécessaire**
- **Configuration** : `ROOT_DOMAIN` (env, ex. `plateforme.ma` → `agence1.plateforme.ma` ⇒ `agence1` ; le nom de domaine n'étant pas encore choisi, rien n'est codé en dur). En local, `agence2.localhost:3000` résout `agence2` sans configuration (les navigateurs routent `*.localhost` vers la boucle locale) ; `localhost`/IP nus → `DEV_AGENCY_SUBDOMAIN`, sinon `goldenfantastic` **hors production seulement**

### Écarts assumés par rapport au plan validé

- `agency_id` garde `DEFAULT 1` (voir ci-dessus) au lieu d'être rendu obligatoire sans défaut
- colonne nommée `footer_note` (comme `agency_settings`) plutôt que `receipt_footer_note`
- **`agency_settings` est encore la source lue par le code** (`lib/agencySettings.js`, layouts, reçus PDF, `/admin/parametres`) : la table `agencies` est un instantané de la ligne migrée, la modifier depuis `/admin/parametres` n'y répercute rien. Basculer la lecture/écriture sur `agencies` est reporté à la passe 2 — le faire ici aurait rendu dynamiques (`headers()`) toutes les pages publiques en `revalidate = 300`, décision à prendre avec le branding public

### Reste à faire (passe 2, dans cet ordre)

1. **Filtrer par `agency_id` les ~25 fichiers `lib/*.js`** (`WHERE agency_id = ?` + `agency_id` dans chaque `INSERT`, puis retirer `DEFAULT 1`), fichier par fichier avec vérification SQL après chacun. Points de vigilance connus : `createRegistration` retrouve un voyageur existant **par numéro WhatsApp globalement** (deux agences fusionneraient un même voyageur — à scoper) ; `listRoles`/`getPermissionsMatrix`/`createRole` (§3undecies) ne sont pas encore filtrés ; les vues `v_trip_traveler_list`/`v_trip_airline_list`
2. **Toutes les routes `app/api/admin/**`** : vérifier que la ressource ciblée (`tripId`, `registrationId`...) appartient à `session.agencyId` avant d'agir — sinon un identifiant deviné agirait sur une autre agence même avec la lecture filtrée
3. **Branding dynamique** : "Golden Fantastic" est codé en dur dans `app/(site)/layout.js`, `app/admin/layout.js`, le JSON-LD ; basculer `getAgencySettings` sur `agencies` ; sitemap/robots/`llms.txt`/flux RSS par agence ; uploads (`public/uploads/*`) à séparer par agence
4. Déploiement : DNS wildcard + certificat pour `*.<ROOT_DOMAIN>` (le système n'est pas encore déployé)

## 3septvicies. Escale aller/retour sur le voyage (migration `017_add_trip_layovers.sql`)

Dates et aéroports aller/retour existaient déjà sur `/admin/programmes/[id]/voyages/new` (`trips.departure_date`/`return_date`/`origin_iata`/`destination_iata`) — **pas** sur `/admin/programmes/new` : un programme peut avoir plusieurs voyages à des dates et parfois des itinéraires différents, une date/aéroport fixée au niveau programme n'aurait pas de sens (confirmé explicitement avant implémentation, cohérent avec la décision déjà prise de ne rien mettre de daté sur le formulaire programme, voir §3vicies).

- `trips.outbound_layover_iata`/`return_layover_iata` (CHAR(3), tous deux nullable) — l'itinéraire (`origin_iata`/`destination_iata`) reste un **seul** couple partagé aller/retour (mêmes aéroports, sens inversé au retour) ; seule l'escale éventuelle peut différer entre les deux vols (ex. escale à Istanbul à l'aller, retour direct)
- `TripForm.jsx` : "Date d'aller"/"Date de retour" (relabellisé pour clarté), "Escale aller"/"Escale retour" (IATA, optionnels, vide = vol direct) juste après les champs d'aéroport de départ/arrivée
- `createTrip`/`updateTrip` (`lib/programsAdmin.js`) : `outboundLayoverIata`/`returnLayoverIata` ajoutés à l'INSERT/UPDATE, mêmes routes API qu'avant (`body` déjà transmis tel quel, aucun changement de route nécessaire)

## 3octovicies. Premier voyage saisi en parallèle du programme (UX de création)

Demande de suite à §3septvicies : le personnel voulait pouvoir saisir les champs du voyage (dates, aéroports, escales, compagnie, places, prix, devise) **directement sur l'écran de création du programme**, sans devoir d'abord enregistrer le programme puis cliquer séparément sur "+ Nouveau voyage". ⚠️ Ce n'est **pas** un retour sur la décision de §3vicies/§3septvicies : le modèle de données ne change pas (dates/aéroports restent sur `trips`, pas sur `programs` — un programme garde la possibilité d'avoir plusieurs voyages à des dates différentes) ; seule l'**ergonomie de la première création** change.

- **`ProgramForm.jsx`** : nouvelle section "Premier voyage", affichée **uniquement à la création** (`!isEdit` — une fois le programme créé, l'ajout de voyages supplémentaires reste sur sa fiche via `TripsList`/"+ Nouveau voyage", inchangé). Reprend exactement les champs de `TripForm.jsx` (référence, statut, dates, pays de destination, compagnie, aéroports IATA aller/retour, escales, places, prix programme, devise — voir §3novovicies pour l'évolution de ces champs) ; référence/dates restent requis, comme sur `TripForm.jsx`
- **Soumission en deux appels séquentiels, pas transactionnels** : `POST /api/admin/programs` puis, si la première réussit, `POST /api/admin/programs/[id]/trips` avec les champs du voyage — deux routes existantes, aucune n'a changé. Si le deuxième appel échoue (ex. référence de voyage déjà utilisée), **le programme reste créé** : le formulaire affiche l'erreur avec un lien vers la fiche du programme pour y ajouter le voyage manuellement, et désactive le bouton "Enregistrer" (éviterait sinon de recréer un deuxième programme en double en resoumettant)
- Succès complet : redirection vers `/admin/voyages/[tripId]/hebergement`, même comportement que la création d'un voyage depuis `TripForm.jsx` (attacher les hôtels devient l'étape suivante immédiate, voir §3novemdecies)
- `app/admin/programmes/new/page.js` charge désormais aussi `listAirlines()` (déjà utilisé par `/admin/programmes/[id]/voyages/new`) pour peupler le menu déroulant Compagnie aérienne du premier voyage

## 3novovicies. Aéroports du retour distincts, escale en case à cocher, prix billet retiré (migration `018_add_trip_return_airports.sql`)

Retouche de §3septvicies/§3ter après retour terrain, sur `TripForm.jsx` **et** la section "Premier voyage" de `ProgramForm.jsx` (§3octovicies) — les deux formulaires partagent exactement les mêmes champs voyage, modifiés en parallèle :

- **`trips.flight_ticket_price` retiré des formulaires** : le prix du billet est désormais considéré comme **inclus dans `price_per_person`** (prix programme), plus facturé à part — cohérent avec la logique déjà appliquée au visa et aux services (§3sedecies : "prix inclus dans le prix global du programme, plus itemisé à part" quand nécessaire). Colonne **conservée en base, dépréciée** (`DEPRECIEE (migration 018)`, même pattern que `registrations.preferred_hotel_id` en §3quattuorvicies) — `createTrip`/`updateTrip` ne l'écrivent plus ; une valeur déjà enregistrée sur un voyage existant n'est ni affichée ni effacée
- **Aéroports du retour indépendants de l'aller** : `trips.return_origin_iata`/`return_destination_iata` (CHAR(3), nullables) s'ajoutent à `origin_iata`/`destination_iata` (désormais explicitement relabellisés "— aller" dans les deux formulaires). Jusqu'ici le retour était toujours supposé être l'aller inversé (même paire d'aéroports, sens inversé) — insuffisant pour un voyage qui rentre depuis/vers un aéroport différent (ex. retour depuis Médine plutôt que Djeddah). **Champs optionnels** : laissés vides, le comportement reste celui d'avant (repli sur l'aller inversé) — à ne renseigner que si le retour diffère réellement
  - **`lib/duffel.js`** (`searchOffers`) et `POST /api/admin/trips/[tripId]/flight-offers` répercutent ce repli : la recherche de vols Duffel utilise `return_origin_iata`/`return_destination_iata` du voyage s'ils sont renseignés, sinon retombe sur `destination_iata`/`origin_iata` inversés (comportement historique, inchangé pour tout voyage n'utilisant pas les nouveaux champs) — Duffel reste non testé en conditions réelles (§3ter), ce repli n'a donc pu être vérifié que par lecture de code
- **Escale : case à cocher plutôt qu'un simple champ texte optionnel** : "Voyage avec escale (Aller)" / "(Retour)" — décoché, le champ IATA de l'escale correspondante est masqué et vidé (`outbound_layover_iata`/`return_layover_iata` envoyés `NULL`) ; coché, un champ IATA apparaît. **Pas de nouvelle colonne** pour ces cases : elles ne sont qu'une commodité d'affichage côté client, pilotée en édition par la présence ou non d'une valeur déjà enregistrée (`!!trip?.outbound_layover_iata`) — la donnée réelle reste uniquement `NULL`/non-`NULL` sur la colonne existante, comme avant §3septvicies

## 3trigies. Réorganisation de l'écran "Nouveau programme"

Retouche ergonomique de `ProgramForm.jsx` demandée après usage réel de §3octovicies/§3novovicies — aucun changement de route ni de modèle de données au-delà des points listés (les décisions déjà prises sur les fondations multi-agences, l'hébergement, les groupes, etc. restent inchangées) :

- **Champs "affichage public" regroupés en bas d'écran** : Slug, Description courte, Description complète, Image de couverture, Meta title/description et la case "Publié" sont désormais rassemblés dans un encart "Affichage public (site)" en toute fin de formulaire — auparavant dispersés entre le haut et le bas de l'écran. Les champs d'identification/catégorisation (Titre, Type, Famille, Thème) restent en tête, et le premier voyage (§3octovicies) reste entre les deux
- **Champ Devise retiré** de la section "Premier voyage" (agence mono-devise MAD en pratique, voir §7 "Devise(s) de facturation" toujours en suspens) — `tripPayload` n'envoie plus `currency`, `createTrip` retombe sur son défaut serveur existant (`data.currency || "MAD"`, inchangé)
- **Hôtels habituels** : la liste à cases à cocher devient un `<select multiple>` à `<optgroup>` par ville (même pattern que les `<select>` d'affectation de `HebergementManager.jsx`, voir §3novemdecies) — sélection multiple par Ctrl/Cmd-clic, plus compact à l'écran
- **Référence du premier voyage pré-remplie depuis le Titre du programme** : tant que le personnel n'a pas modifié le champ Référence à la main (`tripReferenceTouched`), il se resynchronise automatiquement sur le Titre à chaque frappe (`useEffect`) — dès la première modification manuelle, la synchronisation s'arrête pour cette création (comportement "jusqu'à ce que l'utilisateur touche le champ", jamais appliqué en édition où la section n'existe pas)
- **Pays de destination (premier voyage) en zone de texte déroulante** : `<input list="trip-destination-countries">` + `<datalist>`, suggestions limitées à `POPULAR_DESTINATION_COUNTRIES` (`lib/worldPlaces.js`, ~38 pays — même ensemble que la section "Destinations enrichies" de `CITIES_BY_COUNTRY`, §3octies, dupliqué explicitement plutôt que dérivé pour rester correct si le fichier est réorganisé) plutôt que la liste complète `COUNTRIES` (~196 pays, jugée trop longue pour être utile ici) — saisie libre toujours possible pour un pays absent de la liste. Valeur par défaut inchangée : "Arabie Saoudite", placé en tête de la liste
- **Hôtels habituels — sélection multiple confirmée** : le `<select multiple>` (voir plus haut) autorise bien plusieurs hôtels à la fois (Ctrl/Cmd-clic) — comportement natif du navigateur, aucun changement de code nécessaire pour cette exigence, déjà satisfaite dès l'introduction du `<select multiple>`
- **Champ Saison retiré du formulaire** (programme ni voyage) : `programs.season` n'est plus modifiable depuis `/admin/programmes/new` ni `/admin/programmes/[id]` — colonne et logique de filtrage public (`/omra-hajj`, §3quater) **inchangées**, une valeur déjà enregistrée sur un programme existant est simplement préservée telle quelle à chaque édition (state client en lecture seule, jamais réécrit depuis l'UI, jamais envoyé comme `null`) — même logique de dépréciation douce que `trips.flight_ticket_price` (§3novovicies)
- ⚠️ **Piège rencontré pendant cette implémentation** : le renommage de l'import (`COUNTRIES` → `POPULAR_DESTINATION_COUNTRIES`) et la mise à jour du `.map()` correspondant ont été faits en deux modifications séparées ; une requête utilisateur tombée entre les deux a affiché une erreur 500 (`ReferenceError: COUNTRIES is not defined`), auto-corrigée dès la seconde modification enregistrée — aucune action requise, mentionné ici seulement parce que Turbopack recompile et sert **chaque** sauvegarde intermédiaire, pas seulement l'état final voulu

## 3unetrigies. Prix par type de chambre (4 paliers), prix public = le plus bas (migration `019_add_trip_room_type_prices.sql`)

Règle métier explicite de l'utilisateur : le prix affiché au public n'est **pas** un tarif unique — c'est le prix le plus bas obtenu en chambre à 5 personnes (quintuple), puisque plus il y a de voyageurs par chambre, moins c'est cher par personne. **Chaque voyage** (Omra/Hajj ou voyage organisé, sans distinction) porte désormais **quatre prix**, fixés dès sa création : chambre double/binôme, triple, quadruple, quintuple.

- `trips.price_double`/`price_triple`/`price_quadruple`/`price_quintuple` (`DECIMAL(10,2) NOT NULL DEFAULT 0.00`, même convention que l'ancien `price_per_person`) — rétro-remplis à la migration avec l'ancien `price_per_person` pour chaque voyage existant (le prix affiché ne change pas tant que le personnel ne différencie pas les 4 paliers). **`price_per_person` déprécié** (même pattern que `flight_ticket_price` §3novovicies et `season` §3trigies — colonne conservée pour l'historique, plus jamais écrite)
- **`lib/roomTypes.js`** : `PRICE_TIER_FIELD` (mappe `double/triple/quadruple/quintuple` → nom de colonne — `simple` n'a volontairement pas de palier) et `pickTripPrice(trip, roomType)`, fonction pure (aucun accès DB) réutilisée **à la fois côté serveur** (`lib/registrations.js`, sur une ligne SQL) **et côté client** (`NewRegistrationForm.jsx`, sur l'objet `selectedTrip` déjà chargé) : retourne le prix du palier demandé s'il existe, sinon le plus bas des quatre (repli aussi utilisé si la préférence est `"simple"`, vide ou absente)
- **`TripForm.jsx`** et la section "Premier voyage" de `ProgramForm.jsx` (§3octovicies) : le champ unique "Prix programme" devient 4 champs **requis** en grille 2×2 ("Chambre double / binôme", "Chambre triple", "Chambre quadruple", "Chambre quintuple — prix affiché au public"), avec une note explicative sous le bloc. Mêmes noms de champs dupliqués intentionnellement entre les deux formulaires (comme l'escale/les aéroports retour)
- **Pré-remplissage du montant dû à l'inscription** (`lib/registrations.js` `createRegistration()`, `NewRegistrationForm.jsx` pour le calcul du montant dû de groupe et l'aperçu de prix affiché) : utilise `pickTripPrice(trip, preferredRoomType)` — palier correspondant au type de chambre demandé par le voyageur (`registrations.preferred_room_type`, §3quaterdecies) si renseigné, sinon le prix le plus bas. Reste **modifiable ensuite** comme avant (§3septendecies) — aucun recalcul automatique si la préférence change après coup sur `EditRegistrationForm.jsx`, cohérent avec le comportement déjà existant pour `total_due`
- **Site public — prix = `LEAST()` des 4 paliers** : les trois requêtes qui alimentaient `starting_price`/le prix par voyage (`lib/programs.js` : `getProgramsByFamily`, `getProgramsByDepartureCity`, `getOpenTripsForProgram`) utilisent désormais `LEAST(price_double, price_triple, price_quadruple, price_quintuple)`. `HomeShowcaseCard.jsx` et `app/api/public/programs/route.js` lisent déjà `starting_price`/`p.starting_price` — **aucun changement nécessaire** de leur côté, transparent au changement de calcul SQL. `ProgramDetail.jsx` : `trip.price_per_person` → `trip.starting_price` (JSON-LD `Offer.price` et prix affiché par carte voyage, avec ajout du préfixe "à partir de", cohérent avec `HomeShowcaseCard.jsx` qui l'affichait déjà côté `voyage_organise`)
- **Confirmé sans changement nécessaire** (exploration dédiée avant implémentation) : reçus PDF (`lib/exporters/receiptPdf.js`) et rapports financiers (`lib/payments.js`) travaillent uniquement sur `registrations.total_due`/`registration_groups.total_due`/`payments.amount`, jamais sur le prix du voyage — aucun lien avec `trips.price_per_person` ni les 4 nouveaux paliers ; `lib/roomAssignment.js`/`autoAssignTrip` utilise `preferred_room_type` uniquement pour l'affectation de chambre (jamais un prix)
- **"simple" retiré du choix de préférence à l'inscription, retour d'usage** : `lib/roomTypes.js` exporte désormais `PREFERRED_ROOM_TYPES` (= `ROOM_TYPES` sans `"simple"`), utilisé par le menu "Type de chambre souhaité" de `NewRegistrationForm.jsx`/`EditRegistrationForm.jsx` — cohérent avec le fait que "simple" n'a pas de palier de prix. `ROOM_TYPES` (avec "simple") reste inchangé et utilisé tel quel par `HebergementManager.jsx` pour la **création de chambre** (une chambre individuelle reste un type de chambre réel et créable, seule la *préférence exprimée par un voyageur* à l'inscription exclut ce choix). `registrations.preferred_room_type` garde `'simple'` dans son ENUM (aucune migration nécessaire, changement UI seulement)
- **Binôme → chambre double automatique** : `NewRegistrationForm.jsx`, `handleTypeChange("binome")` fixe `preferredRoomType` à `"double"` (un binôme = exactement 2 personnes, la seule chambre cohérente) et verrouille le `<select>` "Type de chambre souhaité" tant que le type d'inscription reste "Binôme" — redevient modifiable si le personnel repasse sur "Individuel"/"Groupe" (la dernière valeur, généralement "double", reste pré-remplie mais n'est plus imposée)

## 3duotrigies. Retrait de l'auto-attachement des hôtels à la création du voyage

`createTrip` (§3vicies) insérait automatiquement chaque hôtel habituel du programme dans `trip_hotels` avec `check_in_date`/`check_out_date` = **toute la durée du voyage**. Problème signalé avec capture d'écran à l'appui : pour un voyage multi-villes (Omra : Mecque **et** Médine), ce défaut plaçait les **deux hôtels sur exactement la même période** (toute la durée du voyage) — alors qu'un voyageur ne peut évidemment pas être dans les deux hôtels en même temps. Corriger ce défaut correctement demanderait de deviner automatiquement comment répartir les dates entre les hôtels (impossible de façon fiable, l'ordre et la durée réels du séjour dans chaque ville ne sont pas déductibles du seul programme) — retiré plutôt que corrigé à moitié.

- **`createTrip`** (`lib/programsAdmin.js`) : la boucle d'auto-insertion dans `trip_hotels` après la création du voyage est supprimée (avec l'import `listDefaultHotelsForProgram`, devenu inutile ici). Un voyage nouvellement créé n'a donc **plus aucun hôtel pré-rempli**
- **Seule méthode désormais** : ajouter chaque hôtel manuellement depuis `/admin/voyages/[tripId]/hebergement`, via le formulaire déjà existant (Hôtel / Check-in / Check-out / "Ajouter", `POST /api/admin/trips/[tripId]/hotels`, §3octodecies pour la validation des dates bornées au voyage) — un par un, avec la vraie période de chacun
- **`program_hotels`/"Hôtels habituels de ce programme"** (§3vicies) n'est **pas** supprimé : sert encore de repli pour le menu "Hôtel souhaité" à l'inscription (`GET /api/admin/trips/[tripId]/hotels`, §3quaterdecies) tant que le voyage n'a pas encore d'hôtels dans son hébergement — mais ne pré-remplit plus jamais `trip_hotels` lui-même
- Sans impact sur les voyages déjà créés : leurs `trip_hotels` existants (avec ou sans dates correctement corrigées à la main) restent tels quels, aucune migration ni nettoyage nécessaire

## 3tretrigies. Voyages modifiables directement depuis la fiche programme

Sur `/admin/programmes/[id]`, la liste "Voyages" (`TripsList.jsx`) n'ouvrait auparavant qu'un lien "Modifier" vers une page séparée (`/admin/voyages/[tripId]`) pour changer les champs d'un voyage (dates, aéroports, escales, compagnie, places, les 4 prix par type de chambre — §3unetrigies). L'utilisateur voulait pouvoir tout modifier **sans quitter la fiche programme**, avec la même parité de champs qu'à la création (§3octovicies "Premier voyage").

- **`TripsList.jsx`** devient un accordéon : "Modifier" (renommé "Fermer" quand ouvert) déplie désormais, **sous la ligne du tableau**, le même `TripForm` (`app/admin/voyages/TripForm.jsx`) déjà utilisé par la page dédiée — réutilisé tel quel, aucune duplication de la logique de formulaire. Un seul voyage déplié à la fois (`expandedId` en state local)
- Le bloc déplié garde aussi les liens rapides Hébergement / Listes / Billets d'avion / Inscrits (identiques à ceux de `/admin/voyages/[tripId]/page.js`), pour ne rien perdre de l'ancien point d'entrée
- **`listTripsForProgram`** (`lib/programsAdmin.js`) faisait déjà `SELECT t.*` — tous les champs nécessaires à `TripForm` (prix, aéroports, escales...) étaient donc déjà disponibles côté page, aucun changement de requête nécessaire ; seul `app/admin/programmes/[id]/page.js` charge en plus `listAirlines()` (déjà utilisé ailleurs) pour le menu Compagnie aérienne du formulaire
- La page séparée `/admin/voyages/[tripId]` **reste** en place et fonctionnelle (accessible par URL directe, ex. depuis un lien externe ou un ancien favori) — seul le lien depuis `TripsList.jsx` a changé de comportement, elle n'est plus le seul chemin

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
