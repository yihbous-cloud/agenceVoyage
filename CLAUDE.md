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

⚠️ **Largement remplacé par §3novotrigies** : la section "Premier voyage" complète décrite ci-dessous (tous les champs de `TripForm.jsx` à la création) a été retrimée à un sous-ensemble minimal (dates, ville de départ, pays/ville de destination) — le reste (aéroports précis, hôtels, prix, affichage) se saisit désormais après coup sur la page de gestion en cartes. Section conservée pour l'historique du principe "créer le programme et son premier voyage en un seul flux", toujours vrai.

Demande de suite à §3septvicies : le personnel voulait pouvoir saisir les champs du voyage (dates, aéroports, escales, compagnie, places, prix, devise) **directement sur l'écran de création du programme**, sans devoir d'abord enregistrer le programme puis cliquer séparément sur "+ Nouveau voyage". ⚠️ Ce n'est **pas** un retour sur la décision de §3vicies/§3septvicies : le modèle de données ne change pas (dates/aéroports restent sur `trips`, pas sur `programs` — un programme garde la possibilité d'avoir plusieurs voyages à des dates différentes) ; seule l'**ergonomie de la première création** change.

- ~~**`ProgramForm.jsx`** : nouvelle section "Premier voyage", affichée **uniquement à la création** (`!isEdit`...). Reprend exactement les champs de `TripForm.jsx` (référence, statut, dates, pays de destination, compagnie, aéroports IATA aller/retour, escales, places, prix programme, devise)~~ — voir §3novotrigies, formulaire retrimé
- **Soumission en deux appels séquentiels, pas transactionnels** : `POST /api/admin/programs` puis, si la première réussit, `POST /api/admin/programs/[id]/trips` avec les champs du voyage — **toujours vrai**, principe inchangé par §3novotrigies, seul le contenu du deuxième appel a été réduit. Si le deuxième appel échoue (ex. référence de voyage déjà utilisée), **le programme reste créé** : le formulaire affiche l'erreur avec un lien vers la fiche du programme pour y ajouter le voyage manuellement
- ~~Succès complet : redirection vers `/admin/voyages/[tripId]/hebergement`~~ — redirige désormais vers `/admin/programmes/[id]` (la page de gestion en cartes, §3novotrigies)
- ~~`app/admin/programmes/new/page.js` charge désormais aussi `listAirlines()`~~ — n'est plus nécessaire, la simplification du formulaire de création a retiré le champ Compagnie aérienne (déplacé dans la carte Aéroport)

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
- **"simple" retiré partout côté personnel, pas seulement à l'inscription** : `lib/roomTypes.js` exporte `BOOKABLE_ROOM_TYPES` (= `ROOM_TYPES` sans `"simple"`, renommé depuis `PREFERRED_ROOM_TYPES` en §3quinquatrigies une fois réutilisé au-delà de la seule préférence à l'inscription) — utilisé par le menu "Type de chambre souhaité" de `NewRegistrationForm.jsx`/`EditRegistrationForm.jsx` **et** par le menu "Type" de création de chambre dans `HebergementManager.jsx`. `ROOM_TYPE_CAPACITY`/`ROOM_TYPES` (avec `"simple"`, capacité 1) restent inchangés : c'est la référence de capacité complète (§3terdecies), pas la liste de ce qui est proposé à l'écran. `registrations.preferred_room_type`/`rooms.room_type` gardent `'simple'` dans leur ENUM (aucune migration nécessaire, changement UI seulement)
- **Binôme → chambre double automatique** : `NewRegistrationForm.jsx`, `handleTypeChange("binome")` fixe `preferredRoomType` à `"double"` (un binôme = exactement 2 personnes, la seule chambre cohérente) et verrouille le `<select>` "Type de chambre souhaité" tant que le type d'inscription reste "Binôme" — redevient modifiable si le personnel repasse sur "Individuel"/"Groupe" (la dernière valeur, généralement "double", reste pré-remplie mais n'est plus imposée)

## 3duotrigies. Retrait de l'auto-attachement des hôtels à la création du voyage

`createTrip` (§3vicies) insérait automatiquement chaque hôtel habituel du programme dans `trip_hotels` avec `check_in_date`/`check_out_date` = **toute la durée du voyage**. Problème signalé avec capture d'écran à l'appui : pour un voyage multi-villes (Omra : Mecque **et** Médine), ce défaut plaçait les **deux hôtels sur exactement la même période** (toute la durée du voyage) — alors qu'un voyageur ne peut évidemment pas être dans les deux hôtels en même temps. Corriger ce défaut correctement demanderait de deviner automatiquement comment répartir les dates entre les hôtels (impossible de façon fiable, l'ordre et la durée réels du séjour dans chaque ville ne sont pas déductibles du seul programme) — retiré plutôt que corrigé à moitié.

- **`createTrip`** (`lib/programsAdmin.js`) : la boucle d'auto-insertion dans `trip_hotels` après la création du voyage est supprimée (avec l'import `listDefaultHotelsForProgram`, devenu inutile ici). Un voyage nouvellement créé n'a donc **plus aucun hôtel pré-rempli**
- **Seule méthode désormais** : ajouter chaque hôtel manuellement depuis `/admin/voyages/[tripId]/hebergement`, via le formulaire déjà existant (Hôtel / Check-in / Check-out / "Ajouter", `POST /api/admin/trips/[tripId]/hotels`, §3octodecies pour la validation des dates bornées au voyage) — un par un, avec la vraie période de chacun
- **`program_hotels`/"Hôtels habituels de ce programme"** (§3vicies) n'est **pas** supprimé : sert encore de repli pour le menu "Hôtel souhaité" à l'inscription (`GET /api/admin/trips/[tripId]/hotels`, §3quaterdecies) tant que le voyage n'a pas encore d'hôtels dans son hébergement — mais ne pré-remplit plus jamais `trip_hotels` lui-même
- Sans impact sur les voyages déjà créés : leurs `trip_hotels` existants (avec ou sans dates correctement corrigées à la main) restent tels quels, aucune migration ni nettoyage nécessaire

## 3tretrigies. Voyages modifiables directement depuis la fiche programme

Sur `/admin/programmes/[id]`, la liste "Voyages" (`TripsList.jsx`) n'ouvrait auparavant qu'un lien "Modifier" vers une page séparée (`/admin/voyages/[tripId]`) pour changer les champs d'un voyage (dates, aéroports, escales, compagnie, places, les 4 prix par type de chambre — §3unetrigies). L'utilisateur voulait pouvoir tout modifier **sans quitter la fiche programme**, avec la même parité de champs qu'à la création (§3octovicies "Premier voyage").

- **`TripsList.jsx`** devient un accordéon, **déplié par défaut** (`collapsedIds`, un `Set` d'ids repliés — vide au départ) : tous les voyages du programme affichent déjà leur `TripForm` complet (`app/admin/voyages/TripForm.jsx`, réutilisé tel quel, aucune duplication de la logique) **dès l'ouverture de la fiche programme**, sans clic supplémentaire — retour d'usage après une première version où il fallait cliquer "Modifier" une deuxième fois : la plupart des programmes n'ont qu'un seul voyage, le personnel s'attend à tout voir/modifier (programme + voyage) d'un coup. "Fermer" (par voyage) replie individuellement si plusieurs voyages encombrent l'écran
- Le bloc de chaque voyage garde aussi les liens rapides Hébergement / Listes / Billets d'avion / Inscrits (identiques à ceux de `/admin/voyages/[tripId]/page.js`), pour ne rien perdre de l'ancien point d'entrée
- **`listTripsForProgram`** (`lib/programsAdmin.js`) faisait déjà `SELECT t.*` — tous les champs nécessaires à `TripForm` (prix, aéroports, escales...) étaient donc déjà disponibles côté page, aucun changement de requête nécessaire ; seul `app/admin/programmes/[id]/page.js` charge en plus `listAirlines()` (déjà utilisé ailleurs) pour le menu Compagnie aérienne du formulaire
- La page séparée `/admin/voyages/[tripId]` **reste** en place et fonctionnelle (accessible par URL directe, ex. depuis un lien externe ou un ancien favori) — seul le lien depuis `TripsList.jsx` a changé de comportement, elle n'est plus le seul chemin
- ⚠️ **Piège rencontré en développant cette section** : renommer un state React (`expandedId` → `collapsedIds`) en plusieurs modifications séparées a laissé, entre deux sauvegardes, une référence obsolète (`expandedId`) dans le JSX déjà réécrit ailleurs — Turbopack recompile et sert **chaque** sauvegarde intermédiaire, et une session utilisateur avec Fast Refresh connecté peut planter en plein milieu (`ReferenceError`, page blanche ou rechargement forcé), ce qui a été pris à tort pour "aucun changement visible" par l'utilisateur pendant le débogage. Repéré via `preview_logs` : les erreurs client (`[browser] Uncaught ...`) y apparaissent aussi, pas seulement les erreurs serveur — à vérifier systématiquement en plus des logs serveur après une modification d'un composant client (`"use client"`) en plusieurs étapes

## 3quattertrigies. Menu "Ajouter un hôtel" limité aux hôtels habituels du programme

`/admin/voyages/[tripId]/hebergement` : le menu déroulant du formulaire "Ajouter un hôtel" (Hôtel / Check-in / Check-out) proposait tout le **catalogue global** (`listHotels()`, tous pays/villes confondus) — peu pratique une fois le catalogue étoffé, alors que le voyage n'utilise en pratique que les hôtels habituels de son programme (§3vicies).

- **`app/admin/voyages/[tripId]/hebergement/page.js`** : charge désormais `listDefaultHotelsForProgram(trip.program_id)` (`trip.program_id` déjà renvoyé par `getTripSummary`, `lib/roomAssignment.js`) et le passe comme prop `hotels` à `HebergementManager.jsx` à la place du catalogue complet — **seul** ce menu est concerné (`groupByCity(hotels, "city")`, seule utilisation du prop `hotels` dans ce composant) ; l'affichage des hôtels déjà attachés au voyage (`tripHotels`) et les `<select>` de la section "Chambres" utilisent une prop distincte, non affectée
- **Repli non bloquant** : si le programme n'a **aucun** hôtel habituel défini (`program_hotels` vide), le menu retombe sur le catalogue complet plutôt que d'être vide et bloquer le personnel — cohérent avec le principe déjà appliqué à la préférence d'hôtel en inscription (§3quaterdecies, "le menu reste vide comme avant, non bloquant")
- `lib/programHotels.js` : commentaire d'en-tête corrigé (mentionnait encore l'auto-attachement retiré en §3duotrigies)

## 3quinquatrigies. "simple" retiré aussi du menu de création de chambre

Suite à §3unetrigies (retrait de "simple" du choix de préférence à l'inscription) : demande de suite pour retirer "simple" également du menu "Type" de `/admin/voyages/[tripId]/hebergement` (formulaire "Créer une chambre" — Hôtel / N° chambre / Type / Capacité), pour rester cohérent puisque ce type n'a de toute façon aucun palier de prix (§3unetrigies) ni de préférence associée.

- `lib/roomTypes.js` : `PREFERRED_ROOM_TYPES` renommé `BOOKABLE_ROOM_TYPES` (même valeur, `ROOM_TYPES` sans `"simple"`) — nom générique désormais que la constante est partagée par 3 formulaires (inscription × 2, création de chambre), plus seulement une "préférence"
- **`HebergementManager.jsx`** : `ROOM_TYPES` → `BOOKABLE_ROOM_TYPES` pour le menu "Type" ; `ROOM_TYPE_CAPACITY` reste importé tel quel (dérivation de la Capacité verrouillée, §3terdecies, fonctionne pour n'importe quel type y compris "simple" si jamais réintroduit un jour)
- Une chambre "simple" existante en base (créée avant ce changement) continue de fonctionner normalement (affectation, affichage) — seule sa **création** depuis ce formulaire n'est plus proposée

## 3sextrigies. "Hôtels du voyage" classé par date plutôt que par ville

Le tri par ville (`h.city ASC`, §3novemdecies) faisait apparaître les hôtels dans un ordre alphabétique de ville sans rapport avec l'itinéraire réel — ex. Médine (02/12→06/12) listée **après** Makka (06/12→17/12) alors qu'on y séjourne en premier, contre-intuitif à la lecture.

- **`listTripHotels`** (`lib/roomAssignment.js`) : `ORDER BY h.city ASC, th.check_in_date ASC` → `ORDER BY th.check_in_date ASC, h.city ASC` — les villes servent désormais de simple départage à date égale, plus de critère de tri principal
- Effet en cascade sans changement de code côté `HebergementManager.jsx` : `groupByCity()` conserve l'ordre d'apparition du tableau reçu pour ordonner ses groupes — comme le tableau est maintenant trié par date, le sous-titre de ville qui apparaît en premier est celui du séjour le plus proche dans le temps (section "Hôtels du voyage" **et** le menu "Hôtel" du formulaire "Créer une chambre", qui partagent la même source)
- Champ d'application volontairement limité à `listTripHotels` : `listRoomsForTrip` (section "Chambres") garde son tri par ville (aucune plainte à ce sujet, et une chambre n'a pas de "date" propre à trier)

## 3septtrigies. Champs aéroport en zone de texte déroulante (nom + code IATA)

Les champs aéroport (départ/arrivée aller, départ/arrivée retour, escale aller/retour — §3septvicies/§3novovicies) étaient de simples champs texte à 3 lettres : le personnel devait connaître le code IATA par cœur (`JED`, `IST`, `KUL`...). Remplacés par le même pattern `<input list>` + `<datalist>` que Pays/Ville des hôtels (§3octies) ou Pays de destination (§3trigies), avec une liste affichant **le nom complet de l'aéroport et son code** ensemble.

- **`lib/airportsReference.js`** (nouveau) : `AIRPORTS_REFERENCE` (~31 aéroports — le Maroc au complet pour les départs, plus les destinations les plus courantes de l'agence : Arabie Saoudite, Turquie, Émirats, Égypte, Malaisie/Asie, Europe, Tunisie/Algérie — même logique de curation que `POPULAR_DESTINATION_COUNTRIES`, §3trigies). Distinct de `lib/airports.js`, volontairement limité aux aéroports marocains de départ pour le pSEO villes de départ (§3quinquies) — usage différent, pas de fusion
- `formatAirportOption(a)` → `"Aéroport d'Istanbul (IST) — Istanbul"` (texte affiché dans la liste déroulante, cherchable par nom, ville **ou** code puisque tout est dans la même chaîne) ; `airportInputValue(iata)` reconstruit ce texte à partir d'un code stocké en base (édition d'un voyage existant), retombe sur le code brut si l'aéroport n'est pas dans la référence (compatibilité avec une saisie libre antérieure) ; `extractIataFromInput(value)` fait l'inverse à la soumission (extrait le code entre parenthèses, ou accepte un code à 3 lettres tapé directement en repli)
- **`TripForm.jsx`** et la section "Premier voyage" de `ProgramForm.jsx` : les 6 champs aéroport utilisent ce pattern, un seul `<datalist id="airport-options">` partagé par formulaire. Un aéroport absent de la liste reste saisissable librement (datalist, pas un select fermé) — le payload envoie alors le code tel quel s'il ressemble à 3 lettres, sinon les 3 premiers caractères en majuscules (repli best-effort, cohérent avec l'ancien `maxLength={3}` qui limitait déjà la saisie libre à 3 caractères)

### Programmes Omra avec escale-séjour (ex. Istanbul, Kuala Lumpur) avant l'Arabie Saoudite

Remarque de l'utilisateur : certains programmes Omra s'organisent en deux étapes — un séjour touristique de plusieurs jours dans une ville tierce (Istanbul, Kuala Lumpur...) **avant** de rejoindre l'Arabie Saoudite pour l'Omra elle-même, avec son propre hôtel sur place. **Déjà supporté sans changement de code**, par le même mécanisme multi-villes qui gère Mecque + Médine (§3novemdecies) : `POST /api/admin/trips/[tripId]/hotels` n'impose aucune contrainte de pays/ville, seulement que les dates du séjour restent comprises dans les dates globales du voyage (§3octodecies). Pour ce cas :
1. Créer l'hôtel d'Istanbul dans le catalogue (`/admin/hotels`) s'il n'existe pas encore (ville "Istanbul", pays "Turquie" — déjà référencés dans `lib/worldPlaces.js`)
2. L'ajouter à "Hôtels habituels de ce programme" (`/admin/programmes/[id]`), aux côtés des hôtels de Mecque/Médine
3. Sur `/admin/voyages/[tripId]/hebergement`, l'attacher avec ses propres dates (ex. jour 1 → jour 5), puis attacher les hôtels d'Arabie Saoudite avec les dates restantes (ex. jour 5 → retour) — la section "Hôtels du voyage" les affiche déjà triés par date (§3sextrigies), Istanbul apparaît naturellement en premier

⚠️ **Bug trouvé en testant ce scénario** : rien n'empêchait deux hôtels du même voyage d'avoir des périodes qui se chevauchent (ex. check-out Istanbul le 19/12, check-in Médine le 18/12 — un jour où le voyageur serait dans les deux hôtels à la fois), tant que chaque période individuelle restait comprise dans les dates du voyage (§3octodecies, seule vérification existante). Corrigé en §3octotrigies.

## 3octotrigies. Vérification de chevauchement entre hôtels du même voyage

Un voyageur ne peut être que dans un seul hôtel à la fois, même quand le voyage a plusieurs villes (Istanbul + Médine + Makka...) — aucune vérification ne l'empêchait avant cette section.

- **`lib/roomAssignment.js`** : nouvelle fonction `findOverlappingTripHotel(tripId, checkInDate, checkOutDate)` — repère un hôtel déjà attaché au voyage dont la période chevauche celle proposée (`existing.check_in < nouveau.check_out ET nouveau.check_in < existing.check_out`, intervalles semi-ouverts : un check-out le même jour qu'un check-in suivant est autorisé, c'est le jour de transition normal, pas un chevauchement)
- **`POST /api/admin/trips/[tripId]/hotels`** (source de vérité) : appelle cette fonction après les vérifications existantes (dates dans les bornes du voyage, check-in < check-out) et refuse (400) avec un message nommant l'hôtel en conflit et ses dates si un chevauchement est trouvé
- **`HebergementManager.jsx`** (`handleAddHotel`) : même vérification côté client, sur le tableau `tripHotels` déjà chargé (pas d'appel réseau supplémentaire) — retour immédiat avant même la requête au serveur, même message d'erreur
- Comparaison de chaînes `"YYYY-MM-DD"` directe des deux côtés (client et serveur) : `lib/db.js` configure `dateStrings: true` sur le pool MySQL, les colonnes `DATE` ne sont donc jamais des objets `Date` mais des chaînes déjà au format comparable lexicographiquement — cohérent avec la vérification de bornage déjà existante (§3octodecies) qui faisait la même hypothèse
- Pas de correctif rétroactif sur les données déjà en base : un voyage existant avec un chevauchement créé avant cette vérification (comme celui découvert pendant les tests) reste tel quel jusqu'à correction manuelle (supprimer puis rajouter l'hôtel avec les bonnes dates) — aucune fonction d'édition des dates d'un `trip_hotels` n'existe, seulement suppression + réajout
- **Retour d'usage — message affiché près des champs de date, pas seulement en haut de page** : `handleAddHotel` utilise désormais son propre state `hotelFormError` (distinct du `error` général de la page, partagé par les autres actions — création de chambre, affectations, répartition automatique) affiché juste sous les champs Check-in/Check-out du formulaire "Ajouter un hôtel", plutôt que remonter dans la bannière d'erreur générique tout en haut de la page, plus difficile à relier visuellement au bon champ
- **Retour d'usage — repris au style de la bulle de validation native du navigateur** (capture d'écran à l'appui, ex. le message natif "La date doit être postérieure à ..." affiché par Chrome sous un `<input type="date">` en échec de contrainte `min`/`max`) : `hotelFormError` s'affiche dans une bulle positionnée (`ErrorBubble`, composant local — `position: absolute`, ancré via un conteneur `relative`) — fond blanc, bordure, ombre, petit carré orange avec "!" et un petit triangle pointant vers le champ — plutôt qu'un simple paragraphe de texte rouge en pleine largeur. Champ d'application limité à cette bulle précise (les autres messages d'erreur de la page restent des bannières classiques, non demandé pour eux)
- **Retour d'usage — bulle ancrée sur le bon champ, pas toujours Check-out** : `hotelFormErrorField` (`"checkIn"` ou `"checkOut"`) détermine sous quel champ `ErrorBubble` s'affiche. Les bornes du voyage sont maintenant vérifiées **séparément** (check-in trop tôt → bulle sur Check-in ; check-out trop tard → bulle sur Check-out, au lieu d'une seule condition combinée qui pointait toujours vers Check-out). Pour un **chevauchement**, le champ fautif se déduit de l'ordre chronologique avec l'hôtel en conflit : si celui-ci commence avant le nouveau check-in (`overlap.check_in_date < checkIn`), c'est le check-in qui doit être repoussé après son check-out → bulle sur Check-in ; sinon c'est le check-out qui empiète trop loin sur un hôtel qui commence après → bulle sur Check-out
- **Retour d'usage — hôtels déjà attachés retirés du menu "Ajouter"** : le `<select>` "Hôtel" du formulaire "Ajouter un hôtel" ne proposait pas seulement les hôtels habituels du programme (§3quattertrigies) mais aussi ceux **déjà attachés à ce voyage précis**, au risque d'un doublon accidentel. `selectableHotelsByCity` filtre `hotels` sur `attachedHotelIds` (les `hotel_id` déjà présents dans `tripHotels`) avant de grouper par ville — une fois un hôtel ajouté, il disparaît du menu jusqu'à ce qu'il soit retiré ("Retirer" dans la liste "Hôtels du voyage")

## 3novotrigies. Création minimale + page de gestion en cartes (migration `020_add_trip_destination_city_and_meal_offers.sql`)

Refonte majeure demandée après usage réel : le formulaire de création (§3octovicies) était devenu trop long (identité du programme + tous les champs du premier voyage d'un coup). Désormais, `/admin/programmes/new` ne demande que l'essentiel, et tout le reste se complète ensuite sur la page de gestion du programme, réorganisée en **cartes indépendantes** — chacune avec son propre bouton "Enregistrer", à son propre rythme.

### Formulaire de création — `ProgramForm.jsx`, désormais **création uniquement**

Plus de mode édition (`isEdit` supprimé) : titre, type, famille (+ thème si voyage organisé), date d'aller/retour, **ville de départ** (Maroc — `<select>` fermé sur `AIRPORTS` de `lib/airports.js`, 8 aéroports, pas de saisie libre), **pays et ville de destination** (pays : datalist `POPULAR_DESTINATION_COUNTRIES` comme avant ; ville : nouveau champ, datalist cascadée via `getCitiesForCountry`, `lib/worldPlaces.js`, même pattern que Pays/Ville des hôtels §3octies). Référence et statut du premier voyage restent générés en arrière-plan (référence = titre, statut = `planifie`), non affichés. Tout le reste (compagnie, aéroports précis, escales, hôtels, prix, affichage) part à `null`/`0`/vide à la création. Soumission toujours en deux appels séquentiels (programme puis voyage, §3octovicies, principe inchangé) ; redirige vers `/admin/programmes/[id]` (la page de gestion) plutôt que vers l'hébergement.

### Nouvelle colonne `trips.destination_city`

Distincte du code aéroport précis (`destination_iata`) — un champ géographique simple (ville) à côté d'un champ technique (code IATA), remplie aussi bien à la création (ci-dessus) que sur `TripForm.jsx` (même cascade Pays→Villes ajoutée là aussi, pour les voyages supplémentaires) et la carte Informations (ci-dessous).

### Mises à jour partielles — `lib/programsAdmin.js`

Point technique central de cette refonte : chaque carte de la page de gestion ne sauvegarde que **son propre sous-ensemble de champs**. `updateProgram`/`updateTrip` faisaient auparavant un remplacement **complet** de toutes les colonnes à chaque appel (avec des replis `|| 0`/`|| null` sur les clés absentes) — si gardé tel quel, la carte "Aéroport" aurait silencieusement écrasé ce que "Tarification" venait d'enregistrer. Les deux fonctions reprennent maintenant le patron déjà utilisé par `updateRegistration` (`lib/registrations.js`) : une map `{clé: {colonne, transform}}`, seules les clés présentes dans `data` (`!== undefined`) sont incluses dans le `UPDATE` — le reste de la ligne n'est jamais touché. Vérifié en conditions réelles (voir Vérification ci-dessous) : une carte qui n'envoie que `{airlineId, destinationIata}` laisse `price_double`/`total_seats`/`status`/etc. parfaitement intacts, et vice-versa. `createProgram`/`createTrip` restent des `INSERT` complets classiques (une création fournit toujours un état initial cohérent, pas besoin de sémantique partielle) — `createTrip` gagne juste `destinationCity`.

⚠️ **Conséquence sur les routes API** : `PUT /api/admin/programs/[id]` et `PUT /api/admin/trips/[tripId]` imposaient des champs obligatoires **inconditionnellement** (`title`/`family` pour l'un, `referenceCode`/`departureDate`/`returnDate` pour l'autre) — cassé par un payload partiel légitime. Les deux vérifications sont devenues conditionnelles (`body.champ !== undefined && !body.champ`). Le `slug` que la route `programs/[id]` recalculait systématiquement (`body.slug?.trim() || slugify(body.title)`) est devenu conditionnel lui aussi : seulement si `body.slug !== undefined` (carte Affichage), avec repli sur le titre **déjà en base** (`getProgramById`) plutôt que `body.title` (absent des autres cartes).

⚠️ **Piège rencontré en développant cette section** : `lib/airports.js` (les 8 aéroports marocains, §3quinquies) importait `slugify` depuis `lib/programsAdmin.js` — qui importe `lib/db.js` (donc `mysql2`, qui a besoin de modules Node natifs comme `tls`/`net`, absents du navigateur). Tant que `lib/airports.js` n'était utilisé que côté serveur (pSEO), ça ne posait pas de problème ; l'utiliser dans un composant client (`ProgramForm.jsx`, pour le `<select>` "Ville de départ") a fait planter la compilation (`Module not found: Can't resolve 'tls'`) — toute la chaîne mysql2 se retrouvait entraînée dans le bundle navigateur. Corrigé en extrayant `slugify` dans un nouveau fichier pur, sans aucune dépendance, `lib/slugify.js` — `lib/programsAdmin.js` le ré-exporte (`export { slugify }`, tous les imports existants `from "@/lib/programsAdmin"` continuent de fonctionner sans changement), et `lib/airports.js` importe directement `lib/slugify.js`. Leçon générale : un fichier destiné à être importé par un composant client ne doit jamais importer, même transitivement, un fichier qui touche `lib/db.js`.

### La page de gestion — `/admin/programmes/[id]/page.js`, six cartes

Calcule le **voyage principal** du programme (`primaryTrip` : le plus ancien par `departure_date`, id en départage — cas courant, un seul voyage) ; les cartes suivantes portent sur lui. Sous `app/admin/programmes/[id]/` :

- **`InfoCard.jsx`** — Titre/Type/Famille/Thème (→ `programs`) **et** Référence/Statut/Dates/Ville de départ/Pays+Ville de destination (→ `trip`), un bouton unique déclenche les deux `PUT` (programme puis voyage). Contient aussi "Supprimer ce programme" (repris de l'ancien mode édition de `ProgramForm.jsx`)
- **`AirportCard.jsx`** — Compagnie aérienne, aéroport d'arrivée aller, aéroports retour, escales (réutilise `AIRPORTS_REFERENCE`/`airportInputValue`/`extractIataFromInput` de `lib/airportsReference.js`, §3septtrigies). **N'expose pas** l'aéroport de départ aller (`origin_iata`) — déjà possédé par `InfoCard` via "Ville de départ", pour qu'aucune colonne ne soit éditée par deux cartes différentes
- **`HotelsCard.jsx`** — le multi-select "hôtels habituels" (`program_hotels`, inchangé dans son fonctionnement) + un résumé lecture-seule (nombre d'hôtels attachés au voyage principal, nombre de chambres créées) et un lien vers `/admin/voyages/[tripId]/hebergement` — ne duplique **pas** `HebergementManager.jsx`
- **`DisplayCard.jsx`** — reprise telle quelle de l'ancienne section "Affichage public" (slug, descriptions, image, meta SEO, publié)
- **`RestaurationCard.jsx`** — nouveau, voir plus bas
- **`PricingCard.jsx`** — Places totales, les 4 prix par type de chambre, Devise (regroupement pur, aucun nouveau champ — décision explicite de l'utilisateur : pas de quota de chambres séparé)

La liste "Voyages" (`TripsList.jsx`) devient "**Voyages supplémentaires**" (texte vide adapté) : ne montre plus que les voyages **autres** que le principal (`trips.filter(t => t.id !== primaryTrip?.id)`), toujours avec "+ Nouveau voyage" pour un départ à une date différente — `voyages/new` et l'édition standalone `/admin/voyages/[tripId]` gardent `TripForm.jsx` complet, inchangé, pour ces voyages-là.

### Restauration — nouvelle table `trip_meal_offers`

Liste répétable d'offres (titre + description), par **voyage** (pas par programme — cohérence avec Aéroport/Hôtels/Tarification, toutes des infos de voyage). `lib/tripMealOffers.js` et les routes `app/api/admin/trips/[tripId]/meal-offers/route.js` (GET/POST) + `app/api/admin/trip-meal-offers/[id]/route.js` (PUT/DELETE) sont un mirroir exact de `program_faqs`/`lib/programFaqs.js`/`ProgramFaqManager.jsx` (§3duodecies) — permission `voyages.manage` réutilisée, aucune nouvelle entrée de permission. `RestaurationCard.jsx` reprend la structure de `ProgramFaqManager.jsx` à l'identique (titre/description au lieu de question/réponse).

**Affichage public** : `getOpenTripsForProgram` (`lib/programs.js`) rattache désormais `meal_offers` (offres **publiées uniquement**) à chaque voyage retourné, via une requête batch (`IN (?)` construit à la main — `lib/db.js` passe par `pool.execute()`, qui n'étend pas un tableau automatiquement, même précédent que `lib/listGenerators.js`). `ProgramDetail.jsx` affiche une section "Restauration" par voyage, seulement si des offres existent. Testé en conditions réelles : une offre publiée et une brouillon insérées sur un voyage réel, seule la publiée apparaît sur la fiche publique.

### Vérification effectuée

- Migration appliquée (`DESCRIBE trips` + `SHOW TABLES`)
- **Test critique de non-écrasement partiel**, avec les vraies fonctions (pas une simulation SQL) : `updateTrip(id, {airlineId, destinationIata})` puis `updateTrip(id, {totalSeats, priceDouble, ...})` sur le même voyage — confirmé que le deuxième appel n'a pas touché `origin_iata`/`destination_iata` posés par le premier
- `createTrip` avec le payload minimal de la création simplifiée : `destination_city`/`origin_iata` correctement enregistrés, `total_seats`/`price_double` correctement à `0` (à compléter ensuite)
- Fiche publique testée en direct (offre repas publiée visible, brouillon masqué, encodage UTF-8 correct)
- Aucune connexion admin possible (contrainte identifiants) — les 6 cartes et le formulaire de création n'ont pu être vérifiés que statiquement (parse Babel/JSX) et via les fonctions serveur directement, pas visuellement dans le navigateur

## 3quadragies. Cartes en tuiles cliquables + modale (8 modules)

Suite directe de §3novotrigies : les 6 cartes (Informations/Aéroport/Hôtels/Affichage/Restauration/Tarification), déjà en formulaire toujours visible sur `/admin/programmes/[id]`, prenaient trop de place à l'écran une fois toutes affichées ensemble. Transformées en **tuiles** compactes (titre + sous-titre dynamique) ; cliquer une tuile ouvre le contenu complet du module dans une **modale**, avec son propre bouton "Enregistrer" — inchangé par ailleurs (mêmes champs, mêmes routes API, même logique de sauvegarde partielle §3novotrigies).

- **`Modal.jsx`** (nouveau, générique) — overlay `fixed inset-0 bg-black/40` + boîte blanche centrée scrollable (`max-h-[90vh] overflow-y-auto`), titre + bouton fermer, ferme au clic sur l'overlay ou sur Échap. Style repris de la modale de confirmation passeport déjà existante (`TravelerFields.jsx`, §3nonies) — même vocabulaire visuel que le reste du projet, pas une nouvelle bibliothèque
- **`ModuleTile.jsx`** (nouveau) — bouton carte compacte (titre + sous-titre), style cohérent avec le reste de l'admin (bordure zinc, hover emerald)
- **`ProgramManagerGrid.jsx`** (nouveau) — orchestrateur client (`useState<openModule>`), affiche la grille de **8 tuiles** et, selon la tuile cliquée, la modale correspondante. Sous-titres dynamiques par tuile : référence+statut (Informations), IATA aller (Aéroport), nombre d'hôtels habituels/attachés (Hôtels), publié/brouillon (Affichage), nombre d'offres (Restauration), prix le plus bas (Tarification), nombre de voyages/questions (Voyages supplémentaires/FAQ)
- **Les 8 modules** : les 6 cartes existantes **plus** "Voyages supplémentaires" (`TripsList` + bouton "+ Nouveau voyage", déjà existants) et "FAQ" (`ProgramFaqManager`, déjà existant) — désormais eux aussi dans une modale au lieu d'être affichés en permanence sous la grille
- **Cartes adaptées** : chaque carte formulaire (`InfoCard`/`AirportCard`/`HotelsCard`/`DisplayCard`/`PricingCard`) perd son `<h2>` de titre et son habillage `rounded-xl border bg-white p-6` (redondant : `Modal.jsx` fournit déjà la boîte blanche + le titre) et gagne un callback **`onSuccess`**, appelé juste après `router.refresh()` en cas de sauvegarde réussie — ferme automatiquement la modale, pour que l'utilisateur voie immédiatement la tuile mise à jour (sous-titre recalculé depuis les props fraîches passées par le Server Component parent)
- **`RestaurationCard.jsx` fait exception** : pas de `onSuccess`, la modale reste ouverte après un ajout/modification/suppression — c'est un gestionnaire de liste (potentiellement plusieurs offres à ajouter d'affilée), fermer automatiquement à chaque action serait plus gênant qu'utile. Même logique pour "Voyages supplémentaires"/FAQ : restent des listes gérées en place dans leur modale, pas de fermeture automatique
- **Vérification** : `next build` (compilation Turbopack + résolution de tous les imports) réussi sans erreur ; parse Babel/JSX sur les 3 fichiers touchés/créés (`page.js`, `ProgramManagerGrid.jsx`, `InfoCard.jsx`) ; redémarrage serveur propre, aucune erreur dans les logs. Aucune connexion admin possible (contrainte identifiants, inchangée) — l'ouverture réelle des modales et le rendu visuel des tuiles n'ont pas pu être vérifiés dans le navigateur, seulement par lecture de code et compilation réussie

## 3unquadragies. Tarifs par palier d'hébergement — tiers hôtel Omra/Hajj (migration `021_add_trip_hotel_tiers.sql`)

Demande initiale fournie sous forme de spécification technique (Prisma/Redis/TypeScript/`branch_id`) pour un système e-commerce de voyages — **rien de tout ça n'existe dans ce projet** (confirmé par grep : pas de `schema.prisma`, pas de `tsconfig.json`, pas de client Redis). Le concept métier a été adapté à la stack réelle (Next.js + `mysql2` brut, `agency_id` et non `branch_id`), après confirmation explicite de l'utilisateur. Traité comme les autres refontes architecturales du projet : plan complet (agents Explore + Plan, clarifications par AskUserQuestion, plan écrit, approbation) avant implémentation.

**Le manque comblé** : un voyage Omra/Hajj n'avait qu'**un seul** jeu de 4 prix (`trips.price_double/triple/quadruple/quintuple`, §3unetrigies), sans lien entre un prix et un hôtel précis — impossible de vendre "Économique : Hôtel A (Mecque) + Hôtel C (Médine)" et "VIP : Hôtel B + Hôtel D" pour le même départ. Réservé aux voyages **Omra/Hajj** uniquement (`programs.family = 'omra_hajj'`, décision explicite de l'utilisateur) ; un voyage **sans** tier configuré continue de fonctionner exactement comme avant — les tiers sont additifs, jamais un remplacement.

### Schéma

- `trip_hotel_tiers` : `trip_id`, `label` (ex. "Économique"/"Standard"/"VIP"), `makkah_hotel_id`/`madinah_hotel_id` (FK **libres** vers `hotels`, sans contrainte de ville imposée — `hotels.city` reste du texte libre, voir §3octies, aucun mécanisme de ce projet ne garantit qu'un hôtel est "vraiment" à Mecque ou Médine, c'est un picker ouvert groupé par ville comme partout ailleurs dans l'admin), `makkah_board_basis`/`madinah_board_basis` (ENUM `logement_seul`/`petit_dejeuner`/`demi_pension`)
- `trip_hotel_tier_prices` : `tier_id`, `room_type` (réutilise l'ENUM à 5 valeurs de `lib/roomTypes.js`, pas de nouvel ENUM), `price_per_person`, `seats_limit` (NULL = illimité) — unique par `(tier_id, room_type)`, un tier n'a pas besoin de prix pour chaque type de chambre
- `registrations.selected_tier_id` (nullable, FK vers `trip_hotel_tiers`, **sans** `ON DELETE CASCADE` volontairement) — le "type de chambre" de la combinaison capacité se lit sur la colonne **déjà existante** `preferred_room_type`, pas de nouvelle colonne pour ça

### `lib/tripHotelTiers.js` (nouveau)

- `listTiersForTrip` : même pattern batch `IN (?)` construit à la main que `getOpenTripsForProgram` pour `meal_offers` (`pool.execute()` n'étend pas un tableau en paramètre)
- `createTier`/`updateTier` : purge + réinsertion des prix (même compromis que `setRolePermissions`/`setDefaultHotelsForProgram`)
- `deleteTier` : bloquée par la FK `fk_registrations_selected_tier` si au moins une inscription référence encore ce tier — la route API traduit `ER_ROW_IS_REFERENCED_2` en message convivial plutôt qu'un 500 brut
- **`reserveTierRoomTypeCapacity(connection, tierId, roomType)`** — le cœur du blocage strict de capacité (décision explicite de l'utilisateur, pas un simple compteur informatif) : verrouille la ligne de prix (`SELECT ... FOR UPDATE`) avant de compter les inscriptions existantes sur ce `(tier_id, room_type)`, exactement le même schéma que `assignRegistrationToRoom` verrouillant une chambre avant de compter ses occupants (`lib/roomAssignment.js`). **Compose avec la connexion déjà ouverte par `createRegistration`** plutôt que d'ouvrir sa propre transaction — appelée en tout premier dans `lib/registrations.js::createRegistration`, avant tout autre travail, pour échouer vite si la place n'est plus disponible

### `pickTierPrice` — piège déjà rencontré, évité ici

`NewRegistrationForm.jsx` est un composant client qui importe `pickTripPrice` depuis `lib/roomTypes.js` précisément parce que ce fichier n'importe rien (pas de `./db`). Le nouveau `pickTierPrice` (analogue à `pickTripPrice` mais à partir des lignes `trip_hotel_tier_prices` d'un tier plutôt que des colonnes plates de `trips`) a été placé dans ce **même** fichier `lib/roomTypes.js`, jamais dans `lib/tripHotelTiers.js` (qui importe `./db`) — sinon `mysql2` se retrouverait entraîné dans le bundle navigateur, même piège déjà documenté en §3novotrigies avec `slugify`/`lib/airports.js`. Vérifié : `next build` réussit avec cet agencement.

### Routes API

Permission réutilisée : **`voyages.manage`** (même code que `trip-meal-offers`, le sibling le plus proche — un tarif est une structure de prix par voyage, pas une opération d'hébergement post-inscription `hebergement.manage`). Aucune nouvelle permission créée.
- `GET`/`POST /api/admin/trips/[tripId]/tiers` — le `POST` valide côté serveur que le voyage existe et que `program_family === "omra_hajj"` (défense en profondeur, `lib/roomAssignment.js::getTripSummary` étendu avec `p.family AS program_family`)
- `PUT`/`DELETE /api/admin/trip-hotel-tiers/[id]`

### Interface admin — 9ᵉ tuile, conditionnelle

`TiersCard.jsx` (nouveau, même convention liste+formulaire inline que `RestaurationCard.jsx`, §3novotrigies) ajouté à `ProgramManagerGrid.jsx` (§3quadragies) comme tuile **"Tarifs d'hébergement"**, affichée **uniquement si `program.family === "omra_hajj"`** — un programme voyage organisé ne voit jamais cette tuile, aucun changement pour lui. `app/admin/programmes/[id]/page.js` ne charge `listTiersForTrip` que dans ce même cas (sinon `[]`).

### Inscription — sélection du tarif par le personnel (pas de calculateur public)

Décision explicite de l'utilisateur : le tier est choisi **par le personnel**, dans `NewRegistrationForm.jsx`, exactement comme `preferredRoomType`/`hotelPreferences` faisait jusqu'ici — **pas** de calculateur public sur la fiche programme. `listOpenTripsForSelect` (`lib/registrations.js`) a gagné `p.family` (absent jusqu'ici) pour que le formulaire sache n'afficher le sélecteur de tarif que pour un voyage `omra_hajj`. Le tarif choisi remplace `pickTripPrice` par `pickTierPrice` dans la prévisualisation de prix et le calcul du `total_due` par défaut (individuel et groupe) — sans tarif choisi, comportement exactement inchangé.

⚠️ **Retour d'usage — champs "Hôtel souhaité" retirés de `/admin/inscriptions/new`** : une fois le tarif d'hébergement en place, les selects "Hôtel souhaité — {ville}" (préférence par ville, §3quattuorvicies) sont devenus redondants sur ce formulaire précis — l'hôtel de chaque ville est désormais déterminé par le tarif choisi. Retirés uniquement de `NewRegistrationForm.jsx` (state `tripHotels`/`hotelsLoading`/`hotelsError`/`hotelPreferencesByCity` et le fetch `/api/admin/trips/[id]/hotels` associé supprimés, `hotelPreferences` n'est plus envoyé dans le payload de création) — **pas** touché ailleurs : `EditRegistrationForm.jsx` (inscription existante), `registration_hotel_preferences`, l'alerte de préférence non respectée sur l'hébergement (§3unvicies) et le filtre "Assigner à..." restent inchangés, la table et son mécanisme continuent de fonctionner normalement pour toute inscription qui l'utilise encore par ce chemin.

### Prix public affiché — correction ciblée, portée volontairement limitée

`getOpenTripsForProgram` (`lib/programs.js`) : après la requête batch `meal_offers` existante, une seconde requête batch calcule le prix minimum des tarifs par voyage ; `starting_price` (jusqu'ici toujours `LEAST(price_double, ...)`) n'est remplacé que pour les voyages qui ont effectivement des tiers — un voyage sans tier garde son calcul d'origine, aucun changement pour le cas courant. ⚠️ **Les deux autres fonctions utilisant `LEAST(...)`** (`getProgramsByFamily`/`getProgramsByDepartureCity`) ont la même limitation latente pour un programme à tiers mais sont restées **hors périmètre** de cette demande (portée explicitement limitée à la fiche programme) — à corriger dans une session dédiée si un jour un programme à tiers apparaît dans ces listes avec un prix incohérent.

### Vérification effectuée

- Migration appliquée (`SHOW CREATE TABLE trip_hotel_tiers`/`trip_hotel_tier_prices`, `DESCRIBE registrations`)
- **Test non simulé du blocage de capacité**, script Node réel (pas de simulation, mêmes contraintes que §3novotrigies — connexion login admin impossible dans cet environnement) contre la vraie base de dev : création d'un tier `seatsLimit: 1`, première inscription réussie, deuxième inscription rejetée avec le message attendu, `deleteTier` bloqué tant qu'une inscription y réfère puis réussi après nettoyage
- **Test de concurrence réelle** : deux `createRegistration` lancées en `Promise.allSettled` contre un même tarif `seatsLimit: 1` — exactement une résout, l'autre rejette avec le message de capacité épuisée, preuve que le verrou `FOR UPDATE` sérialise réellement (pas une course qui passe par chance en mono-thread)
- **Régression "sans tier"** : une inscription classique sans `selectedTierId` sur un voyage sans tier calcule toujours son `total_due` via `pickTripPrice`, exactement comme avant
- `next build` réussi (Turbopack, TypeScript, génération des pages statiques) — confirme en particulier que `pickTierPrice` reste importable depuis un composant client sans entraîner `mysql2`
- Toutes les données de test nettoyées après vérification (aucune trace en base, confirmé par requête SQL directe)

## 3duoquadragies. Réorganisation des champs entre cartes + prix public = le plus bas du programme

Retouche ergonomique de `/admin/programmes/[id]` demandée après usage réel (aucun changement de modèle de données, aucune nouvelle colonne — uniquement redistribution des champs entre cartes déjà existantes, et une requête publique modifiée) :

- **`InfoCard.jsx`** ("carte programme") gagne **Nombre de places** (`total_seats`, déplacé depuis `PricingCard.jsx` — retiré de cette dernière, jamais dupliqué entre deux cartes, cohérent avec le principe déjà en place pour `origin_iata`, §3novotrigies) et **fusionne tous les champs de l'ancienne carte "Affichage"** (slug, descriptions, image de couverture, meta SEO, publié) au bas du formulaire, sous un même bouton "Enregistrer" unique qui déclenche toujours les deux appels `PUT` (programme puis voyage, si un voyage existe) — `DisplayCard.jsx` est supprimé, son contenu vit désormais entièrement dans `InfoCard.jsx`
- **`AirportCard.jsx`** devient l'unique propriétaire de **tous** les champs liés à l'aéroport : gagne **Ville de départ (Maroc)** (`origin_iata`, déplacé depuis `InfoCard.jsx` — même `<select>` sur `AIRPORTS` de `lib/airports.js`), aux côtés de la compagnie aérienne, l'aéroport d'arrivée aller, les aéroports retour et les escales déjà présents. Les **dates** (aller/retour) restent dans `InfoCard.jsx` — ce ne sont pas des champs "aéroport" à proprement parler, et elles y étaient déjà correctement renseignées
- **`ProgramManagerGrid.jsx`** : tuile "Affichage" retirée (fusionnée dans "Informations", dont le sous-titre inclut désormais aussi le statut publié/brouillon) ; import et bloc modal `DisplayCard` supprimés. Nombre de tuiles ramené de 8/9 à 7/8 selon la famille du programme
- **Aucun changement backend nécessaire** : les mises à jour partielles (`lib/programsAdmin.js`, §3novotrigies) et les routes API (`PUT /api/admin/programs/[id]`/`PUT /api/admin/trips/[tripId]`) acceptaient déjà `totalSeats`/`originIata`/tous les champs d'affichage indépendamment de quelle carte les envoie — seule la répartition **côté UI** a changé, la carte "Informations" envoie simplement un payload de voyage/programme plus large qu'avant

### Prix public = le plus bas de **tout le programme**, pas seulement du voyage le plus proche

Jusqu'ici, `getProgramsByFamily`/`getProgramsByDepartureCity` (`lib/programs.js`, hubs publics `/omra-hajj`/`/voyages-organises` et pages pSEO `/villes-depart/[ville]`) affichaient le prix du **voyage ouvert le plus proche** (`nt`, "nearest trip") comme prix de la carte programme. Demande explicite : le prix affiché doit être le **plus bas parmi tous les voyages ouverts du programme**, pas seulement celui du départ le plus proche — un programme avec plusieurs départs à des prix différents doit afficher son tarif le plus attractif.

- Nouvelle sous-requête corrélée (`t2`, distincte de la sous-requête `nt` qui continue de fournir dates/aéroport/places restantes/distance au repère — ces champs-là restent bien ceux du départ le plus proche) : `MIN(LEAST(price_double, price_triple, price_quadruple, price_quintuple, tarif le plus bas s'il existe))` sur tous les voyages ouverts (`ouvert`/`planifie`, date future) du programme — même correction tarifs (§3unquadragies) que `getOpenTripsForProgram`, mais agrégée en un seul minimum plutôt que calculée par voyage
- Filtres déjà existants (destination pour `voyage_organise`, ville de départ pour les pages pSEO) répliqués sur cette nouvelle sous-requête : un programme filtré par destination/ville affiche le plus bas prix **parmi les voyages qui correspondent à ce filtre**, pas parmi tous ses voyages
- **Portée volontairement limitée à ces deux fonctions** (le prix "carte résumé" d'un programme) : `getOpenTripsForProgram`/`ProgramDetail.jsx` (fiche détail d'un programme) continue d'afficher **un prix par voyage/départ** — cohérent, un visiteur qui choisit entre plusieurs dates de départ doit voir le prix propre à chacune, pas un prix unique masquant les écarts
- ⚠️ Conséquence attendue, pas un bug : un programme dont un voyage a un palier de prix encore à 0 (saisie incomplète, ex. `price_quadruple`/`price_quintuple` jamais renseignés) verra ce 0 remonter comme "prix le plus bas" — c'était déjà vrai avant (si ce voyage était le plus proche) mais devient plus fréquent maintenant qu'il suffit qu'**un seul** voyage du programme soit incomplet. Pas de garde-fou ajouté (afficherait un prix incorrect plutôt qu'un 0 visiblement suspect) — à corriger en complétant la saisie du voyage concerné, pas côté code
- **Vérification** : `next build` réussi ; hub `/omra-hajj`, page pSEO `/villes-depart/casablanca` et fiche `/admin/programmes/[id]` (redirection login propre, aucune erreur serveur) testés en direct — un programme avec un 0.00 MAD repéré et confirmé comme donnée de test incomplète préexistante (voyage à un seul palier de prix non rempli), pas une régression introduite par ce changement

## 3tresquadragies. Retrait des cartes Tarification, Restauration et Voyages supplémentaires

Demande explicite de simplification de `/admin/programmes/[id]` : les tuiles **Tarification** (`PricingCard.jsx`), **Restauration** (`RestaurationCard.jsx`) et **Voyages supplémentaires** (liste `TripsList.jsx` + lien "+ Nouveau voyage") sont retirées de `ProgramManagerGrid.jsx`. Les trois composants n'étaient utilisés que par cette grille (confirmé par recherche dans tout le dépôt) — **fichiers supprimés**, pas seulement masqués.

- **`app/admin/programmes/[id]/page.js`** : ne charge plus `listAllMealOffersForTrip` (fetch devenu inutile) ni ne calcule plus `otherTrips` (filtrage des voyages autres que le principal, devenu inutile) — seuls `tripHotels`/`rooms`/`tiers` restent chargés en plus du programme/voyage principal
- **Portée volontairement limitée à l'interface admin de cette page** : ni les tables (`trip_meal_offers`, les 4 colonnes `price_double`/etc. sur `trips`), ni les routes API (`app/api/admin/trips/[tripId]/meal-offers`, `app/api/admin/trip-meal-offers/[id]`), ni l'affichage public (`ProgramDetail.jsx` continue d'afficher la section "Restauration" et le prix par voyage si des données existent déjà) ne sont touchés — seuls les points d'entrée d'édition disparaissent de cette page précise
- **Conséquences pratiques à connaître** :
  - Le prix d'un voyage (4 paliers par type de chambre + devise) et les offres de restauration ne sont plus modifiables **depuis cette page**. Le prix reste modifiable via la page standalone `/admin/voyages/[tripId]` (`TripForm.jsx`, inchangée, toujours accessible par URL directe, voir §3tretrigies) — les offres de restauration, elles, n'ont plus aucun point d'entrée d'édition dans l'admin (la route API existe toujours, mais plus aucun composant ne l'appelle)
  - Le lien "+ Nouveau voyage" (`/admin/programmes/[id]/voyages/new`) et la liste des voyages autres que le principal ont disparu de cette page — la route de création reste fonctionnelle par URL directe mais n'est plus reliée nulle part dans l'UI
- **Vérification** : `next build` réussi (aucun import orphelin) ; redémarrage du serveur de dev (nécessaire — une erreur de cache Turbopack obsolète mentionnant les anciens imports supprimés persistait dans les logs jusqu'au redémarrage, comportement déjà documenté en §3tretrigies) ; `/admin/programmes/[id]` (redirection login propre) et la fiche publique testés en direct, aucune erreur serveur

## 3quaterquadragies. Restauration + quota de chambres réservées sur le catalogue hôtels (migration `022_add_hotel_board_basis_and_room_quotas.sql`)

Deux nouveaux champs sur `/admin/hotels`, clarifiés par deux questions posées avant implémentation :
1. **Restauration** (formule repas) — décision : attribut du **catalogue hôtel** (`hotels.board_basis`), pas de l'attachement à un voyage précis (`trip_hotels`) — un hôtel donné garde la même formule quel que soit le voyage qui l'utilise.
2. **Nombre de chambres réservées par type** — décision : un **quota de planification** (`hotels.reserved_rooms_simple/double/triple/quadruple/quintuple`), pas un mécanisme de création en masse de vraies chambres — un simple chiffre informatif par type, distinct des chambres réelles assignables (`rooms`, créées une par une depuis `/admin/voyages/[tripId]/hebergement`).

- `hotels.board_basis` : même ENUM (`logement_seul`/`petit_dejeuner`/`demi_pension`) que les tarifs d'hébergement Omra/Hajj (`trip_hotel_tiers.makkah_board_basis`/`madinah_board_basis`, §3unquadragies) — vocabulaire partagé, mais **conceptuellement distinct** : celui du catalogue décrit l'hôtel en général, celui d'un tier décrit un choix précis pour un voyage donné (un même hôtel peut apparaître dans un tier avec une formule différente de son `board_basis` par défaut, aucune synchronisation entre les deux n'est faite ni souhaitée)
- **`BOARD_BASIS_OPTIONS`** extrait de `TiersCard.jsx` vers `lib/roomTypes.js` (constante partagée, même fichier que `ROOM_TYPES`/`ROOM_TYPE_CAPACITY`) — `TiersCard.jsx` l'importe désormais au lieu de la redéfinir localement, aucun changement de comportement
- ~~`hotels.reserved_rooms_simple/double/triple/quadruple/quintuple` (`INT UNSIGNED DEFAULT 0` chacun, un par valeur de `ROOM_TYPES` — y compris `simple`)~~ — retouché en §3quinquadragies (colonnes rendues NULL-able, `simple` retiré de l'UI)
- **`HotelsManager.jsx`** : formulaire de création étendu (`<select>` Restauration + 5 champs numériques "Chambres réservées ... par type", vide/0 = aucune) et tableau étendu (colonnes Restauration + Chambres réservées, cette dernière résumée en texte du type "10 double, 5 triple", masquant les types à 0) — **pas d'ajout d'un mode édition** : ce formulaire ne gérait déjà que création + suppression (aucun mode édition n'existait pour aucun champ existant non plus), cohérent avec l'état actuel de la page plutôt qu'une nouvelle fonctionnalité non demandée. `lib/hotels.js` (`createHotel`/`updateHotel`, cette dernière déjà appelée par une route API existante mais jusqu'ici jamais depuis l'UI) étendu en parallèle pour accepter ces champs
- **Vérification** : migration appliquée (`DESCRIBE hotels`) ; script Node réel (pas de simulation, même méthode que pour les tiers §3unquadragies) appelant directement `createHotel`/`updateHotel` contre la vraie base de dev — confirmé que `board_basis` et chaque quota par type persistent et se mettent à jour correctement, y compris qu'un champ non renseigné dans un `updateHotel` retombe bien à `0`/`logement_seul` (ce ne sont **pas** des mises à jour partielles comme `lib/programsAdmin.js`, ces deux fonctions remplacent toujours la ligne complète — cohérent avec leur comportement déjà existant avant cette section) ; `next build` réussi ; nettoyage confirmé par requête SQL directe. Aucune connexion admin possible dans cet environnement — le formulaire lui-même n'a pas pu être vérifié visuellement dans le navigateur

## 3quinquadragies. Retouches du catalogue hôtels après usage réel (migration `023_hotel_star_rating_text_and_nullable_quotas.sql`)

Suite directe de §3quaterquadragies, trois retouches demandées après un premier passage réel sur `/admin/hotels` :

1. **Étoiles en texte libre** : `hotels.star_rating` passe de `TINYINT UNSIGNED` à `VARCHAR(10)` — autorise des notations courantes dans l'hôtellerie comme "4+"/"5+", qu'un entier ne peut pas représenter. Champ `<input>` texte (placeholder "ex : 4, 5+") au lieu d'un `<input type="number" min="1" max="5">`. Valeurs numériques déjà saisies conservées telles quelles (conversion implicite MySQL, aucune perte). Seul usage ailleurs dans le code (`lib/roomAssignment.js::listTripHotels`) : un `SELECT` passthrough sans logique numérique — aucun autre changement nécessaire
2. **"Simple" retiré du quota de chambres réservées** : `HotelsManager.jsx` itère désormais `BOOKABLE_ROOM_TYPES` (déjà utilisé partout ailleurs pour exclure "simple" des champs orientés personnel/voyageur, §3unetrigies/§3quinquatrigies) au lieu de `ROOM_TYPES`, pour le formulaire **et** le résumé du tableau — cohérence avec le reste du projet. La colonne `hotels.reserved_rooms_simple` reste en base (jamais retirée structurellement, même pattern de dépréciation douce que `flight_ticket_price`/`preferred_hotel_id`) mais n'est plus jamais écrite depuis l'UI (`createHotel`/`updateHotel` reçoivent `undefined` pour cette clé → `NULL`)
3. **Quotas rendus NULL-able** : un hôtel n'a pas forcément tous les types de chambre (ex. pas de chambre quintuple) — forcer une saisie à `0` pour un type absent était ambigu avec "existe mais aucune réservée". Les 5 colonnes `reserved_rooms_*` passent de `NOT NULL DEFAULT 0` à `NULL DEFAULT NULL` : **`NULL` = ce type n'existe pas dans cet hôtel, `0` = existe mais aucune réservée actuellement** — distinction réelle en base, pas seulement cosmétique. `lib/hotels.js` : nouvelle fonction `toNullableInt(v)` (vide/undefined/null → `NULL`, sinon `Number(v)`) remplace le `data.reservedRoomsX || 0` précédent qui écrasait silencieusement un champ vide en `0`. `HotelsManager.jsx` : les champs restent des `<input type="number">` vides par défaut, mais le payload envoie désormais `null` (pas `0`) quand un champ est laissé vide — texte d'aide mis à jour pour expliciter que "vide" et "0" ont un sens différent
- **Vérification** : migration appliquée (`DESCRIBE hotels` — `star_rating` en `varchar(10)`, les 5 `reserved_rooms_*` en `YES` sur `Null`) ; script Node réel (pas de simulation) créant un hôtel avec `star_rating: "5+"`, `reserved_rooms_double: 12` (positif), `reserved_rooms_triple: 0` (explicite) et `reserved_rooms_quintuple` omis — confirmé que les trois se distinguent correctement en base (`"5+"`, `12`, `0`, `null`) ; `next build` réussi ; nettoyage confirmé par requête SQL directe. Aucune connexion admin possible dans cet environnement — le formulaire lui-même n'a pas pu être vérifié visuellement dans le navigateur

## 3sesquadragies. Modification d'un hôtel du catalogue

`HotelsManager.jsx` (`/admin/hotels`) ne gérait que création + suppression depuis sa mise en place initiale — `updateHotel`/`PUT /api/admin/hotels/[id]` existaient déjà en base et en API mais **aucun bouton "Modifier" n'y donnait accès** (noté comme décision de portée délibérée en §3quaterquadragies, revenue sur demande explicite ici).

- **Formulaire extrait en `HotelForm`** (composant partagé, même fichier) : reçoit un `initial` optionnel (`hotelToFormValues(hotel)` pré-remplit tous les champs, y compris les quotas nullables via `?? ""` pour distinguer `NULL`/vide de `0`), un `onSubmit(payload)` et un `onCancel` optionnel — réutilisé à l'identique pour la création (pas de `initial`) et l'édition
- **`buildPayload(form)` extrait aussi** : centralise la conversion vide→`null` déjà en place (§3quinquadragies), partagée entre les deux usages plutôt que dupliquée
- **Édition en ligne dans le tableau** : cliquer "Modifier" remplace la ligne (`<tr>`) par une ligne à cellule unique (`colSpan={7}`) contenant `<HotelForm initial={h} .../>`, plutôt que d'ouvrir une modale — cohérent avec le fait que cette page n'a pas (encore) adopté le pattern `Modal.jsx` utilisé côté `/admin/programmes/[id]`. "Annuler" démonte le formulaire (retour à `editingId = null`), ce qui décharge son état local sans effet de bord — rouvrir "Modifier" recharge toujours les valeurs actuelles de l'hôtel, jamais un brouillon resté en mémoire
- ⚠️ **Piège évité** : `HotelForm` gère son propre state interne (`useState`), donc le formulaire de **création** (monté une seule fois, en permanence en bas de page) ne se réinitialisait plus tout seul après un ajout réussi une fois `setForm` devenu inaccessible depuis l'extérieur. Corrigé par un `key={createFormKey}` incrémenté après chaque création réussie, forçant React à démonter/remonter l'instance (et donc à repartir d'un formulaire vide) — sans ce détail, le champ resterait rempli avec les valeurs du dernier hôtel ajouté
- **Vérification** : `next build` réussi ; script Node réel (pas de simulation) reproduisant le cycle complet création → chargement dans le formulaire d'édition (`hotelToFormValues`) → modification d'un sous-ensemble de champs → soumission (`updateHotel`) → relecture en base, confirmant que les valeurs déjà correctes non touchées (`double`, `triple` explicite à 0) survivent intactes au aller-retour, qu'une valeur ajoutée (`quadruple`) est bien écrite, et qu'un champ jamais renseigné (`quintuple`, `NULL`) le reste. Nettoyage confirmé par requête SQL directe. Aucune connexion admin possible dans cet environnement — le bouton "Modifier" et le formulaire en ligne n'ont pas pu être vérifiés visuellement dans le navigateur

## 3septquadragies. Restauration verrouillée sur le tarif d'hébergement + retrait de "simple"

Retouche de `TiersCard.jsx` (§3unquadragies) demandée après usage réel : la formule de restauration par ville (`makkah_board_basis`/`madinah_board_basis`) était jusqu'ici un `<select>` indépendant, à ressaisir manuellement — redondant depuis que chaque hôtel du catalogue porte sa propre formule (`hotels.board_basis`, §3quaterquadragies).

- **`boardBasisForHotel(hotels, hotelId)`** (nouvelle fonction pure dans `TiersCard.jsx`) : retrouve l'hôtel choisi dans la liste `hotels` déjà chargée et renvoie son `board_basis` — appelée à chaque rendu, pas de state indépendant pour `makkahBoardBasis`/`madinahBoardBasis` (supprimés en tant que `useState`, devenus de simples valeurs dérivées de `makkahHotelId`/`madinahHotelId`)
- Les deux `<select>` restauration deviennent `disabled` (verrouillés, grisés) — même principe que le verrouillage IATA/Gabarit sur le nom de compagnie reconnu (§3decies) : la valeur affichée suit toujours l'hôtel sélectionné, aucune saisie manuelle possible. Choisir un autre hôtel Mecque/Médine met à jour le select verrouillé correspondant immédiatement (dérivation à chaque rendu, pas de useEffect nécessaire)
- En édition d'un tarif existant, la formule affichée est **recalculée depuis le `board_basis` actuel de l'hôtel** (pas relue depuis l'ancienne valeur stockée sur le tarif, qui pouvait dater d'avant un changement de formule sur la fiche hôtel) — cohérent avec l'objectif "toujours la formule du catalogue", pas un figé historique
- **"Simple" retiré du tableau de prix par type de chambre** : `TiersCard.jsx` itère désormais `BOOKABLE_ROOM_TYPES` (au lieu de `ROOM_TYPES`) pour les lignes de prix, l'initialisation des `priceRows` et le filtre de soumission — même cohérence que §3quinquadragies pour le quota hôtel. Aucun changement de schéma (`trip_hotel_tier_prices.room_type` garde l'ENUM à 5 valeurs ; "simple" reste insérable via un appel API direct, juste plus proposé dans ce formulaire)
- **Vérification** : `next build` réussi ; script Node réel (pas de simulation) créant deux hôtels de test avec des `board_basis` différents (`demi_pension`/`petit_dejeuner`), simulant `boardBasisForHotel()` puis `createTier` avec les valeurs dérivées — confirmé que la formule stockée sur le tarif correspond exactement à celle du catalogue de chaque hôtel. Nettoyage confirmé par requête SQL directe. Aucune connexion admin possible dans cet environnement — le verrouillage visuel des `<select>` n'a pas pu être vérifié dans le navigateur

## 3octoquadragies. Bouton "Ajouter l'hôtel" en modale, `Modal.jsx` mutualisé

`/admin/hotels` affichait jusqu'ici le formulaire de création en permanence sous le tableau (§3sesquadragies). Demande explicite : un bouton "Ajouter l'hôtel" **au-dessus** du tableau, ouvrant le même formulaire dans une **modale**.

- **`Modal.jsx` déplacé** de `app/admin/programmes/[id]/Modal.jsx` vers **`app/admin/_components/Modal.jsx`** — premier composant partagé entre plusieurs pages admin (jusqu'ici, seul `app/_components/*` existait, pour le site public, §3sexies). Contenu inchangé, seul l'emplacement change ; `ProgramManagerGrid.jsx` importe désormais depuis ce nouveau chemin (`@/app/admin/_components/Modal`). Créer un second composant partagé admin **ici** plutôt que d'attendre a semblé raisonnable : deux pages en ont maintenant besoin, avec un composant déjà générique (titre + fermeture + `children`), aucune adaptation nécessaire
- **`HotelsManager.jsx`** : nouveau state `adding` remplace l'ancien `createFormKey` (devenu inutile — la modale monte/démonte `HotelForm` à l'ouverture/fermeture, ce qui réinitialise déjà son state interne naturellement, plus besoin du contournement par changement de `key`). Bouton "Ajouter l'hôtel" déplacé en haut de page (au-dessus du tableau, aligné à droite) ; cliquer dessus ouvre `<Modal title="Ajouter un hôtel">` contenant `HotelForm` ; la modale se ferme automatiquement après une création réussie (`setAdding(false)` dans `handleCreate`, même schéma que `onSuccess` sur `/admin/programmes/[id]`)
- **`HotelForm` perd son habillage `rounded-xl border bg-white p-6 max-w-2xl`** (redondant : `Modal.jsx` fournit déjà la boîte blanche/bordure/ombre) — même retouche que celle appliquée aux cartes de `/admin/programmes/[id]` en §3quadragies. Le formulaire d'**édition** (toujours affiché en ligne dans la ligne du tableau, pas dans une modale — hors périmètre de cette demande) hérite du même style sans bordure propre, la cellule du tableau (`px-4 py-4`) suffisant à le délimiter visuellement
- **Vérification** : `next build` réussi (aucun import cassé après le déplacement de `Modal.jsx`, vérifié par recherche de toute référence à l'ancien chemin avant suppression du fichier) ; redémarrage du serveur de dev ; `/admin/hotels` **et** `/admin/programmes/[id]` (qui importe désormais le même fichier déplacé) testés en direct, redirection login propre, aucune erreur serveur sur les deux routes. Aucune connexion admin possible dans cet environnement — l'ouverture de la modale elle-même n'a pas pu être vérifiée visuellement

## 3neufquadragies. `window.confirm()` remplacé par une modale sur tout l'admin

Capture d'écran à l'appui : les confirmations de suppression ("Supprimer cet hôtel ?"...) s'affichaient via `window.confirm()`, le dialogue **natif du navigateur** (fond noir, "localhost:3000 indique", boutons non stylables) — visuellement incohérent avec le reste de l'admin. Recherche exhaustive (`confirm(` dans tout `app/`) : **17 fichiers**, 18 appels, tous exactement du même schéma `if (!confirm("message")) return;` juste avant une suppression.

- **`app/admin/_components/ConfirmDialog.jsx`** (nouveau) — modale de confirmation générique (message + boutons Confirmer/Annuler), construite sur `Modal.jsx` (§3octoquadragies, déjà partagé)
- **`app/admin/_components/useConfirm.jsx`** (nouveau hook) — `const [confirm, confirmDialog] = useConfirm();` reproduit l'API de `window.confirm()` au point d'appel (juste `await` en plus, puisque désormais asynchrone par nature : l'utilisateur doit cliquer un bouton React, pas une boîte de dialogue bloquante) : `if (!(await confirm("message"))) return;`. En interne, `confirm(message)` retourne une `Promise` résolue par le clic sur Confirmer (`true`) ou Annuler/fermeture (`false`) ; le composant appelant doit juste rendre `{confirmDialog}` une fois dans son JSX
- **Les 17 fichiers retouchés** (mécaniquement identique partout) : import du hook, `const [confirm, confirmDialog] = useConfirm();` à côté des autres `useState` du composant, `await` ajouté devant chaque `confirm(...)` existant, `{confirmDialog}` ajouté en fin de JSX retourné (certains retours n'avaient qu'un seul élément racine — `<form>`/`<table>` — enveloppé dans un fragment `<>...</>` pour accueillir `{confirmDialog}` comme second enfant, sans changement visuel) : `HotelsManager.jsx`, `NewsForm.jsx`, `AirlinesManager.jsx`, `MessagesList.jsx`, `SlidesManager.jsx`, `TripForm.jsx`, `ServicesManager.jsx`, `HebergementManager.jsx` (2 appels), `RolesManager.jsx`, `PaymentsSection.jsx`, `UtilisateursManager.jsx`, `EditRegistrationForm.jsx`, `InfoCard.jsx`, `VisaTypeForm.jsx`, `FlightBookingManager.jsx`, `ProgramFaqManager.jsx`, `TiersCard.jsx`
- ⚠️ **`window.alert()` volontairement non touché** (utilisé pour signaler certaines erreurs après une suppression échouée, ex. `AirlinesManager.jsx`, `RolesManager.jsx`, `UtilisateursManager.jsx`, `SlidesManager.jsx`) — hors périmètre de cette demande, qui ciblait spécifiquement les confirmations de suppression visibles sur la capture d'écran fournie, pas tous les dialogues natifs du navigateur
- **Vérification** : parse Babel/JSX sur les 19 fichiers touchés (17 + les 2 nouveaux) ; `next build` réussi ; redémarrage du serveur de dev ; plusieurs routes parmi les 17 testées en direct (`/admin/slider`, `/admin/hotels`, `/admin/parametres/roles`), redirection login propre, aucune erreur serveur. Aucune connexion admin possible dans cet environnement — le clic réel sur "Supprimer" et l'ouverture de la modale de confirmation n'ont pas pu être vérifiés dans le navigateur pour aucun des 17 fichiers

## 3cinquantequadragies. Hauteur du slider d'accueil réduite, en aperçu de la section suivante

`HeroSlider.jsx` (§3duodecies) avait une hauteur **fixe en pixels** (`h-[620px]`, `sm:h-[680px]`) — sur beaucoup d'écrans courants, cette hauteur dépassait déjà la quasi-totalité du viewport (une fois le header `sticky` déduit), si bien qu'aucune partie de la section suivante n'était visible avant de scroller. Demande explicite : réduire la hauteur, garder la pleine largeur, et laisser dépasser un peu la section suivante.

- **`h-[620px] sm:h-[680px]`** → **`h-[80vh] min-h-[460px]`** — hauteur exprimée en **vh** (pourcentage du viewport) plutôt qu'en pixels fixes, pour que le "petit bout visible de la section suivante" reste présent quelle que soit la hauteur réelle de l'écran (un pixel fixe déborde différemment selon les écrans ; un `vh` laisse toujours ~20% du viewport pour amorcer la section suivante). `min-h-[460px]` évite un slider trop écrasé sur un très petit viewport (mobile en paysage) où le titre/sous-titre/bouton n'auraient plus la place de respirer. Une seule valeur pour tous les breakpoints (plus de variante `sm:`) — le `vh` s'adapte déjà nativement, une valeur différente par breakpoint n'apportait rien
- Le hero **statique** de repli (`app/(site)/page.js`, affiché seulement si aucune diapositive active n'existe) n'a **pas** été touché : il est dimensionné par son contenu (`py-28`, pas de hauteur fixe/viewport) et n'avait donc jamais ce problème
- **Vérification en direct** (mesure DOM réelle, pas une estimation) : à 1024×768, hauteur du hero = 614px (80 % de 768), reste visible = 89px avant scroll ; à 1920×1080, hauteur = 864px, reste visible = 151px ; à 375×812 (mobile), le pied de la section suivante ("Catalogue") apparaît bien en bas d'écran malgré un header qui passe sur 3 lignes sur mobile (nav sans menu hamburger, écran étroit) — capture d'écran prise aux trois tailles, `next build` réussi

### Dimensions d'image recommandées pour ce nouveau format

Le composant utilise déjà `next/image` avec `fill` + `object-cover` + `sizes="100vw"` : **une seule image uploadée suffit**, Next.js génère automatiquement les variantes redimensionnées par appareil — pas besoin de préparer plusieurs tailles à la main.

- **Ratio** : le hero à 80vh sur un écran 16:9 (le plus courant) donne un cadrage large d'environ **2.2:1** (proche du "cinémascope") quelle que soit la résolution exacte — une image carrée ou portrait serait très largement rognée sur les côtés
- **Taille d'export recommandée : 2560 × 1150 px** (ratio ≈ 2.2:1) — confortable pour les grands écrans (jusqu'à un moniteur 1440p) sans excès de poids fichier ; en dessous de **1920 × 864 px**, l'image commencera à être agrandie (perte de netteté) sur les écrans Full HD et plus grands
- ⚠️ **Composition mobile — devenu obsolète, voir §3cinquanteetunquadragies** : cette section recommandait initialement de garder le sujet centré parce qu'une seule image servait aux deux formats (mobile n'en voyait qu'une bande verticale étroite au centre) — un champ d'image mobile dédié existe désormais, cette contrainte ne s'applique plus qu'à un tarif qui n'aurait pas encore d'image mobile spécifique

## 3cinquanteetunquadragies. Image dédiée pour le format mobile du slider (migration `024_add_slide_mobile_image.sql`)

Suite directe de §3cinquantequadragies : une seule image ne peut pas bien cadrer à la fois le hero large desktop (~2.2:1) et un hero mobile étroit/vertical — recadrer la même image en `object-cover` sur les deux formats donnait soit un cadrage desktop correct mais une bande centrale peu représentative sur mobile, soit l'inverse. Demande explicite : un **second champ d'upload dédié au mobile**, le champ existant devenant explicitement "desktop".

- **`slides.mobile_image_url`** (nullable) — `NULL` = pas d'image mobile dédiée, repli automatique sur `image_url` (déjà le comportement d'origine, préservé pour toute diapositive existante non retouchée)
- **`HeroSlider.jsx`** : au lieu d'un seul `<Image>` par diapositive, **deux** `<Image fill>` superposées dans le même conteneur, chacune affichée/masquée en CSS pur (`hidden sm:block` pour la desktop, `block sm:hidden` pour la mobile — breakpoint Tailwind `sm` = 640px, cohérent avec le reste du site) — pas de JavaScript ni de détection d'appareil, le navigateur ne charge que celle qui correspond au media query actif. Repli symétrique : la desktop utilise `mobile_image_url` si `image_url` est absent, et vice-versa ; le dégradé doré/sombre par défaut ne s'affiche que si **aucune** des deux n'est renseignée
- **`SlidesManager.jsx`** : deuxième bloc d'upload "Image de fond — mobile" (même mécanisme que l'existant, dossier `slider` partagé), libellé existant renommé "— desktop" pour clarifier. États `uploading`/`uploadError` passés de booléen/chaîne unique à `{ desktop, mobile }` (un upload ne doit pas bloquer/masquer l'erreur de l'autre) — piège **corrigé avant de committer** : `handleToggleActive` (bascule active/inactive depuis le tableau, dans le composant parent) reconstruit tout le payload à la main pour chaque `PUT` (pas de mise à jour partielle sur `slides`, voir `updateSlide`) — oublier `mobileImageUrl` dans cette reconstruction aurait effacé silencieusement l'image mobile à chaque bascule active/inactive
- **Vérification en conditions réelles** (pas de simulation) : diapositive de test insérée directement en base avec deux URLs distinctes (desktop/mobile) ; mesure DOM réelle (`getComputedStyle().display` + `offsetParent`) confirmant qu'à largeur desktop seule l'image desktop est visible (l'autre `display: none`), et l'inverse à largeur mobile (375px) ; puis `mobile_image_url` mis à `NULL` sur la même diapositive et re-vérifié que le mobile retombe bien sur l'image desktop plutôt que de rester vide. Diapositive de test supprimée après vérification. `next build` réussi ; une erreur de rendu (`uploadError` rendu comme objet) est apparue une fois dans les logs du serveur de dev mais s'est révélée être un artefact Turbopack d'une sauvegarde intermédiaire (comportement déjà documenté en §3tretrigies) — disparue après redémarrage du serveur, le code final relu ligne par ligne ne contient aucune occurrence fautive

### Dimensions d'image par format

| Format | Ratio | Taille d'export recommandée | Minimum avant perte de netteté |
|---|---|---|---|
| Desktop (`image_url`) | ≈ 2.2:1 (large) | **2560 × 1150 px** | 1920 × 864 px |
| Mobile (`mobile_image_url`) | ≈ 9:16 (portrait) — mesuré sur iPhone (375×812, hero à 80vh ≈ 650px) | **1080 × 1500 px** | 750 × 1040 px |

Le champ mobile reste **optionnel** — sans lui, l'image desktop est réutilisée (recadrée en bande centrale, moins optimal mais jamais vide).

## 3cinquantedeuxquadragies. Sélecteur de langue (FR/AR/EN), infrastructure RTL/LTR, finalisation responsive du site public

Demande explicite : un sélecteur de langue visiteur (FR/AR/EN) avec adaptation LTR/RTL, **sans traduction réelle pour l'instant**, plus la finalisation du responsive (mobile/tablette/desktop) sur toutes les pages publiques. CLAUDE.md (§3quinquies) documentait déjà une cible multilingue à URLs préfixées (`/fr/...`, `/ar/...`) avec `hreflang` — explicitement **reportée**, restructurer les URLs sans vraies traductions arabes recréerait le risque de contenu fin/dupliqué que cette cible visait justement à éviter. Approche retenue à la place, validée avec l'utilisateur avant implémentation : un **cookie de préférence de langue**, aucune URL modifiée — livrable immédiatement, sans risque SEO, le vrai routage `/fr/`/`/ar/` restant le chantier documenté pour une session dédiée future une fois une traduction arabe réelle prête.

### Infrastructure de traduction (scaffolding uniquement)

- **`lib/i18n/`** (nouveau dossier, même logique que `lib/worldPlaces.js`/`lib/airportsReference.js` — données de référence statiques) : `locales.js` (`SUPPORTED_LOCALES = ["fr","en","ar"]`, `DEFAULT_LOCALE = "fr"`, `LOCALE_COOKIE_NAME = "gf_locale"`, `isRtl(locale)`), `fr.js`/`en.js`/`ar.js` (dictionnaires plats `{ nav, footer, langSwitcher }`, **seules ces trois sections sont couvertes** — le contenu des pages, FAQ, descriptions de programme... reste hors périmètre, un futur chantier de traduction à part entière), `getDictionary.js` (repli sur `fr` pour toute clé/locale absente, jamais de `undefined` affiché)
- `en.js`/`ar.js` dupliquent le texte français comme *placeholder* explicite (commentaire `// TODO: traduction anglaise/arabe`) — aucune traduction réelle produite, conformément à la demande
- Pas de fonction `t("clé.plate")` façon bibliothèque i18n : accès direct `dict.nav.omraHajj`, cohérent avec le style déjà en place (`SEASON_LABELS`/`FAMILY_LABELS` utilisés directement en JSX). Zéro nouvelle dépendance npm (aucune lib i18n/RTL ajoutée)

### ⚠️ Piège rencontré et corrigé : `cookies()` casse le rendu statique/ISR

Première implémentation : lecture du cookie **côté serveur** dans `app/(site)/layout.js` (`await cookies()` depuis `next/headers`, même idiome que `lib/session.js`) pour poser `<html lang dir>` dès le rendu serveur. `next build` a révélé une régression sérieuse : `cookies()`/`headers()` dans un layout force **tout l'arbre de rendu sous ce layout** en dynamique (`ƒ`) — `/`, `/a-propos`, `/actualites`, `/confidentialite`, `/faq`, `/mentions-legales`, `/programmes` sont tous passés de `○` (statique) à `ƒ` (dynamique), perdant leur `revalidate = 300` ISR. Le SEO/GEO étant la priorité stratégique n°1 du projet (§1), traité comme une régression bloquante, pas un détail mineur.

**Solution retenue — mécanisme entièrement client-side** : le layout reste `<html lang="fr" dir="ltr">` codé en dur (identique octet pour octet au comportement d'avant cette fonctionnalité), aucun `cookies()`/`headers()` nulle part dans `app/(site)/layout.js`. Un nouveau composant client corrige `lang`/`dir` **après montage** :

- **`app/_components/LocaleProvider.jsx`** (`"use client"`) : contexte React (`useLocale()` → `{ locale, dict, dir, setLocale }`). Au montage, lit `document.cookie` (`readCookieLocale()`) et met à jour `document.documentElement.lang`/`dir` via `useEffect` ; `setLocale(next)` écrit le cookie (`path=/`, `max-age` 1 an, `samesite=lax`) et déclenche le re-render du contexte — pas de `router.refresh()` (inutile, rien à recharger côté serveur)
- **Compromis assumé** : un visiteur revenant avec une autre langue déjà choisie voit un bref "flash" en français au tout premier rendu, le temps que l'effet s'exécute après montage — accepté comme le prix nécessaire pour préserver le rendu statique/ISR (priorité SEO), documenté en commentaire dans le fichier
- `next build` re-vérifié après la réécriture : liste exacte des pages statiques/ISR restaurée (voir Vérification)

### Composants publics

- **`app/_components/LanguageSwitcher.jsx`** — `<select>` natif (`FR`/`EN`/`AR`, pas d'emoji drapeau), toujours visible dans le header à toutes les tailles d'écran (hors tiroir mobile repliable — un choix de langue est une préférence persistante, pas une destination de nav)
- **`app/_components/SiteHeader.jsx`** (nouveau, `"use client"`, remplace le `<header>` inline de `app/(site)/layout.js`) : logo + `LanguageSwitcher` + CTA "Devis gratuit" toujours visibles ; les 6 liens de nav passent dans un menu **hamburger** sous `lg:` (1024px, seuil justifié par le contenu : logo + 6 liens + CTA + sélecteur = 9 éléments) ; tiroir mobile (`useState`) qui se ferme au clic sur un lien et au changement de route (`usePathname()` + `useEffect`) — aucun `left-`/`right-` codé en dur dans le tiroir (uniquement `flex`/`gap`), RTL-safe par construction
- **`app/_components/SiteFooter.jsx`** (nouveau, extrait du layout pour pouvoir utiliser `useLocale()` sans forcer le layout parent en client)

### Adaptation RTL

Règle générale adoptée : propriétés logiques (`start-`/`end-`, `text-start`/`text-end`, `ms-`/`me-`/`ps-`/`pe-`) plutôt que physiques (`left-`/`right-`/`ml-`/`mr-`/`text-left`/`text-right`) — Tailwind v4 les retourne automatiquement sous `dir="rtl"`, sans variante `rtl:` à ajouter après coup.

- **`HeroSlider.jsx`** : flèches précédent/suivant `left-4`/`right-4` → `start-4`/`end-4` ; le glyphe (`‹`/`›`) suit `dir` (via `useLocale()`) et s'inverse sous RTL pour continuer à pointer visuellement dans le bon sens
- **`HomeShowcaseCard.jsx`** : `text-right` → `text-end` (prix), **et 4 instances supplémentaires trouvées au-delà de l'audit initial** — l'audit de recherche n'avait grepé que `ml-/mr-/pl-/pr-/text-left/text-right`, manquant une famille de classes différente (positionnement absolu) : `-left-11` → `-start-11` (ruban de saison), `right-0 bottom-0` → `end-0 bottom-0` (étiquette prix Omra/Hajj), `top-4 left-4` → `top-4 start-4` (étiquette thème voyage organisé), `right-0 bottom-4` → `end-0 bottom-4` (étiquette destination)
- **`app/(site)/page.js`** : bouton flottant "retour en haut" `right-6 bottom-6` → `end-6 bottom-6` (même famille de classes manquée par l'audit)

### Finalisation responsive

- **`ProgramDetail.jsx`** (page de conversion, zéro classe responsive avant cette passe) : padding `px-6 py-12` → `px-4 py-8 sm:px-6 sm:py-12` ; image de couverture `h-64` → `h-48 sm:h-64` ; titre `text-3xl` → `text-2xl sm:text-3xl` ; bloc prix `mt-2 sm:mt-0` (évite qu'il colle au bloc au-dessus une fois empilé sur mobile)
- **`ReservationForm.jsx`**/**`ContactForm.jsx`** : cibles tactiles trop justes sur mobile (`py-2` ≈ 34-36px) → `py-2.5 sm:py-2` sur tous les champs et boutons d'action ; bouton "Annuler" (lien texte sans padding) gagne `px-2 py-2` pour une zone cliquable correcte
- **Pages statiques** (`a-propos`, `actualites/[slug]`, `confidentialite`, `faq`, `mentions-legales`, `programmes`) : motif mécanique `px-6 py-16` → `px-4 py-10 sm:px-6 sm:py-16`, titres `text-3xl` → `text-2xl sm:text-3xl`
- **Déjà responsive, non touchées** (confirmé par audit avant implémentation) : `/omra-hajj`, `/voyages-organises`, `/villes-depart/[ville]`, `/actualites`, `/contact` (page conteneur), reste de `/` (`page.js`)

### Vérification effectuée

- `next build` : liste des pages statiques/ISR identique à avant la fonctionnalité (`/` avec `revalidate` 5m ; `/a-propos`, `/confidentialite`, `/contact`, `/faq`, `/mentions-legales`, `/programmes` en `○` statique) — la régression du paragraphe ci-dessus est bien résolue
- Test en direct dans le navigateur (site public accessible sans connexion, contrairement à `/admin`) : 375px (mobile), 768px (tablette), 1440px (desktop) sur `/`, `/omra-hajj`, une fiche programme, `/contact`, `/faq` — aucun débordement horizontal (`scrollWidth === clientWidth`) sur aucune des 5 pages à aucune largeur
- Header : hamburger seul visible sous 1024px (mobile **et** tablette 768px, comme prévu par le seuil `lg:`), les 6 liens + CTA visibles sans hamburger à 1440px ; tiroir mobile s'ouvre/se ferme correctement (icône bascule menu/fermeture, libellé accessible bascule "Menu"/"Fermer")
- Changement de langue testé en direct (`<select>` → `ar`) : confirmé via DOM que `document.documentElement.lang`/`dir` passent bien à `"ar"`/`"rtl"`, et visuellement que le tiroir mobile se réordonne correctement (texte aligné à droite, bouton fermer/sélecteur de langue basculés du côté "start" visuel)
- Logique des flèches `HeroSlider` vérifiée par lecture de code (`dir === "rtl" ? "›" : "‹"` etc.) plutôt que visuellement : le seul slide actif en base au moment du test ne déclenche pas l'affichage des flèches (`slides.length > 1` requis, comportement correct, pas un bug)
- Logs serveur (`preview_logs`) sans erreur sur le serveur de dev courant ; une erreur `cookies is not defined` visible dans `read_console_messages` provient d'un historique HMR d'un serveur de dev précédent (avant la réécriture client-only) — confirmé stale : `app/(site)/layout.js` ne contient plus aucun appel `cookies()` (seule une mention en commentaire expliquant pourquoi), le serveur de dev courant n'a jamais loggé cette erreur

### Hors périmètre (rappel)

Aucune traduction réelle de contenu de page ; aucune restructuration d'URL (`/fr/`, `/ar/` restent le chantier futur documenté, §3quinquies) ; aucun changement sur `sitemap.js`/`robots.js`/`llms.txt`/`feed.xml` (aucune URL ne change dans cette passe) ; aucune nouvelle dépendance npm.

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
