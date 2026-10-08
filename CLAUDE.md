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
- **Automatisation** : ~~n8n~~ — **remplacé (décision du 07/10/2026, §3centquadragies)** : tout en Node.js dans le projet (webhook Next.js + worker BullMQ/Redis lancé par PM2), WhatsApp Business Cloud API officiel + agent IA Claude
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
- **Persisté en base** : `travelers.info_confirmed` (migration `005_add_traveler_info_confirmed.sql`), mis à `TRUE` par `updateTraveler()` à chaque enregistrement réussi — toujours écrit, mais ne pilote plus l'affichage initial, voir ⚠️ ci-dessous. Le lien "Modifier" déverrouille l'affichage local sans jamais repasser `info_confirmed` à `FALSE` : sans un nouvel "Enregistrer", la fiche redevient verrouillée à la prochaine visite en mode "Afficher"
- ⚠️ **Mise à jour (§3cinquantetroisquadragies)** : `EditTravelerForm.jsx` n'initialise plus `formLocked`/`passportLocked` depuis `registration.info_confirmed` seul — un vrai mode "Afficher"/"Modifier" existe désormais (lien "Modifier" dans `/admin/inscriptions`, `?mode=edit`), et "Afficher" verrouille **toujours** la fiche à l'ouverture (plus seulement si `info_confirmed` était déjà `TRUE`) — voir cette section pour le détail et pourquoi

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

### ~~⚠️ État actuel : NE PAS créer de deuxième agence avec de vraies données~~ — **LEVÉ par la passe 2, voir §3quatrevingttreizequadragies**

*(Description de l'état à la fin de la passe 1, conservée pour l'historique.)* Aucune requête métier (`lib/*.js`) ne filtre encore par `agency_id`, et tous les `INSERT` existants ne le renseignent pas (ils tombent sur `DEFAULT 1`). Tant que seule l'agence 1 (Golden Fantastic) a des données, rien ne fuit. Une agence 2 avec de vraies données verrait/mélangerait celles de l'agence 1 — **la passe 2 (filtrage) doit précéder tout onboarding réel**. `agency_id ... DEFAULT 1` est conservé **exprès** (le retirer casserait tous les `INSERT` actuels) et ne sera retiré qu'une fois chaque `INSERT` retrofité.

### Fait dans la passe 1

- **Schéma** : table `agencies` (nom, `subdomain` unique, coordonnées, `footer_note`, `is_active`), agence 1 reprise de `agency_settings` ; colonne `agency_id` (FK) sur 27 tables métier, y compris celles dérivables par jointure (`trips`, `rooms`, `payments`...) — **volontairement redondante** : une seule colonne à filtrer dans chaque requête plutôt qu'une chaîne de jointures qu'il faudrait refaire juste à chaque fois (le risque n°1 de fuite inter-agences est une jointure oubliée). Tables restées globales : `permissions` (capacités du logiciel), `services`, tables dépréciées vides
- **Unicité par agence** : `roles(name)`, `staff_users(email)`, `programs(slug)`, `trips(reference_code)`, `airlines(name)`, `news_posts(slug)` deviennent uniques **par `(agency_id, …)`**. `roles.id`/`role_id` élargis à `BIGINT` (4 rôles × N agences dépasserait `TINYINT`)
- **Rôles propres à chaque agence** (déduit des décisions, non posé explicitement en question) : `scripts/create-agency.js "Nom" sous-domaine` crée l'agence et copie les 4 rôles de base + leur matrice de permissions depuis l'agence 1 ; puis `scripts/create-staff-user.js "Nom" email mdp direction <agencyId>` (5ᵉ argument, `1` par défaut). `hasPermission` filtre `roles.agency_id = session.agencyId` ; le filet "`direction` a tout" (§3undecies) est inchangé
- **`proxy.js`** remplace `middleware.js` (déprécié en Next 16 ; runtime Node, pas edge). Il résout l'agence depuis l'en-tête `Host` (`lib/agencyHost.js`, fonction pure) puis `lib/agencies.js` (**cache mémoire** 5 min — les docs Next déconseillent les accès lents dans `proxy` ; agence inconnue → 404 "Agence introuvable", **jamais** de repli silencieux sur l'agence 1 en production) et pose l'en-tête interne **`x-agency-id`**, **toujours écrasé** (une valeur envoyée par le client n'est jamais prise en compte). Le `matcher` couvre désormais toutes les routes hors assets statiques (avant : `/admin` seulement), car login et pages publiques ont besoin de l'agence
- **Sessions** : le JWT porte `agencyId` ; `getSession()` (`lib/session.js`) renvoie `null` si l'agence de la session ≠ celle de la requête (défense en profondeur pour les routes API, que `proxy` ne filtre pas par session) ; `proxy` fait le même contrôle pour `/admin`. La connexion (`/api/auth/login`) ne cherche le compte que dans l'agence de la requête. **Conséquence : toute session émise avant cette migration (sans `agencyId`) est invalide — reconnexion unique nécessaire**
- **Configuration** : `ROOT_DOMAIN` (env, ex. `plateforme.ma` → `agence1.plateforme.ma` ⇒ `agence1` ; le nom de domaine n'étant pas encore choisi, rien n'est codé en dur). En local, `agence2.localhost:3000` résout `agence2` sans configuration (les navigateurs routent `*.localhost` vers la boucle locale) ; `localhost`/IP nus → `DEV_AGENCY_SUBDOMAIN`, sinon `goldenfantastic` **hors production seulement**

### Écarts assumés par rapport au plan validé *(tous résolus en passe 2, §3quatrevingttreizequadragies)*

- `agency_id` garde `DEFAULT 1` (voir ci-dessus) au lieu d'être rendu obligatoire sans défaut
- colonne nommée `footer_note` (comme `agency_settings`) plutôt que `receipt_footer_note`
- **`agency_settings` est encore la source lue par le code** (`lib/agencySettings.js`, layouts, reçus PDF, `/admin/parametres`) : la table `agencies` est un instantané de la ligne migrée, la modifier depuis `/admin/parametres` n'y répercute rien. Basculer la lecture/écriture sur `agencies` est reporté à la passe 2 — le faire ici aurait rendu dynamiques (`headers()`) toutes les pages publiques en `revalidate = 300`, décision à prendre avec le branding public

### ~~Reste à faire (passe 2, dans cet ordre)~~ — **FAIT, §3quatrevingttreizequadragies**

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

## 3cinquantetroisquadragies. Tarif d'hébergement obligatoire, ajouté à la fiche inscription, verrouillage "Afficher"/"Modifier"

Trois retouches liées, demandées ensemble sur `/admin/inscriptions/new` et `/admin/inscriptions/[id]` :

### Tarif d'hébergement rendu obligatoire (création) et déplacé sous les voyageurs

`NewRegistrationForm.jsx` : le sélecteur de tarif d'hébergement (Omra/Hajj avec tiers configurés, §3unquadragies) portait le libellé "(optionnel)" et une option "Aucun (prix plat du voyage)" — décision revue : dès qu'un voyage a des tarifs configurés, en choisir un devient **obligatoire** (`required`, plus d'option "Aucun"). Un voyage sans tarif configuré (`tiers.length === 0`) n'affiche toujours aucun sélecteur — comportement inchangé, rien de bloquant dans ce cas. Le bloc est aussi **déplacé sous la liste des voyageurs** (après le bouton "+ Ajouter un voyageur", juste avant la validation) — auparavant affiché avant le type d'inscription et les champs voyageur, ce qui séparait artificiellement une information de "prix/hébergement" du reste du formulaire.

### Champ ajouté à la fiche inscription existante (`EditRegistrationForm.jsx`)

Jusqu'ici, le tarif d'hébergement n'était choisi qu'à la création — aucun moyen de le voir ou de le changer depuis `/admin/inscriptions/[id]`. Ajouté dans la même section que "Hôtel souhaité"/"Type de chambre souhaité" (désormais un encart "Préférence d'hébergement" à part, voir plus bas), affiché uniquement si des tarifs existent pour ce voyage (`tiers` chargés côté serveur via `listTiersForTrip`, uniquement si `registration.program_family === "omra_hajj"` — `getRegistrationById` gagne `p.family AS program_family` pour ce test). **Non rendu obligatoire ici** contrairement à la création : une inscription déjà existante peut avoir été créée avant l'ajout des tarifs ou sur un voyage qui n'en avait pas encore — forcer une sélection rétroactive aurait bloqué l'édition d'autres champs sans rapport. L'option "Aucun (prix plat du voyage)" reste donc disponible sur ce formulaire précis.

- **Changer le tarif révérifie la capacité comme à la création** (`reserveTierRoomTypeCapacity`, lib/tripHotelTiers.js, §3unquadragies) : `updateRegistration` (lib/registrations.js) ouvre désormais sa propre transaction quand `selectedTierId` fait partie du payload, verrouille la ligne de prix (`FOR UPDATE`) et compte les inscriptions concurrentes sur ce `(tier, type de chambre)` avant d'appliquer l'`UPDATE` — refusé (409, même messages que la création) si la place est prise. La capacité se recalculant par **comptage** (pas un compteur décrémenté), l'inscription en cours d'édition est explicitement exclue de son propre décompte (`reserveTierRoomTypeCapacity` gagne un 4ᵉ paramètre optionnel `excludeRegistrationId`) — sans ça, une inscription déjà titulaire d'une place à capacité=1 se bloquerait elle-même en ré-enregistrant son propre tarif inchangé
- **Vérifié par script Node réel contre la vraie base** (pas de simulation) : tarif de test à `seatsLimit: 1`, une inscription titulaire + une seconde tentant de récupérer la même place par édition → rejetée avec le message attendu ; la titulaire peut ré-enregistrer son propre tarif sans se bloquer ; après annulation de la titulaire (`status = 'annule'`), la seconde inscription peut alors prendre la place libérée. Toutes les données de test nettoyées après vérification (aucune trace en base, confirmé par requête SQL directe)
- `PUT /api/admin/registrations/[id]` : mêmes validations/traductions d'erreur que `POST /api/admin/registrations` (§3unquadragies) — `selectedTierId` sans `preferredRoomType` refusé en 400, erreurs de capacité traduites en 409 avec message explicite plutôt qu'un 500 générique

### Verrouillage "Afficher" (lecture seule) / "Modifier" (déverrouillé)

Jusqu'ici, seul `EditTravelerForm.jsx` (informations du voyageur : nom, passeport...) se verrouillait après enregistrement (`travelers.info_confirmed`, §3nonies) — le reste de la fiche (`EditRegistrationForm.jsx` : statut, visa, hébergement, groupe, montant dû, notes) restait toujours modifiable selon le rôle uniquement, sans notion de verrouillage. Étendu à **tout** `EditRegistrationForm.jsx` (retouché une deuxième fois après un premier essai trop étroit qui ne verrouillait que l'encart hébergement — retour explicite de l'utilisateur : "tous les champs déjà remplis doivent être verrouillés", pas seulement ceux-là) :

- **`/admin/inscriptions` (liste)** : un lien **"Modifier"** apparaît désormais à côté de "Afficher" (`/admin/inscriptions/[id]?mode=edit`) — même fiche, même URL de base, seul le paramètre `mode` change
- **`/admin/inscriptions/[id]/page.js`** lit `searchParams.mode` (`"edit"` ou repli `"view"`) et le transmet en `initialMode` à `EditTravelerForm` **et** `EditRegistrationForm` — aucun autre effet que l'état initial de verrouillage de ces deux cartes, le reste de la page (permissions par rôle, résumé en haut de fiche, paiements...) est inchangé
- **`EditTravelerForm.jsx`** : `formLocked`/`passportLocked` s'initialisent à `initialMode !== "edit"` — **ne dépendent plus de `registration.info_confirmed`** (retouché une deuxième fois : un premier essai gardait `&& Boolean(registration.info_confirmed)`, ce qui laissait une fiche déverrouillée via "Afficher" si le voyageur avait été rempli à la création mais jamais explicitement "confirmé" via ce formulaire — contraire à "tous les champs déjà remplis doivent être verrouillés"). "Afficher" (mode par défaut) verrouille donc désormais **toujours**, "Modifier" déverrouille toujours dès l'ouverture — `info_confirmed` reste écrit en base (`updateTraveler()`, §3nonies) mais ne pilote plus l'état initial du verrouillage, seul `mode` le fait
- **`EditRegistrationForm.jsx`** : un seul `formLocked` (initialisé à `initialMode !== "edit"`, sans nuance de champ vide/rempli — une inscription déjà existante a toujours des valeurs sur ses champs, contrairement à une création) couvre désormais **toute la carte** : statut, statut visa, l'encart "Préférence d'hébergement" (hôtel par ville, type de chambre, tarif), groupe/binôme, montant dû et notes — chaque `<select>`/`<input>`/`<textarea>` reçoit `disabled={formLocked}` (combiné à la permission de rôle existante quand il y en a une, ex. `disabled={!canEditStatus || formLocked}`). Un seul lien **"Modifier"** dans l'en-tête de la carte (même pattern que `EditTravelerForm.jsx`) déverrouille tout d'un coup — plus de lien local par sous-section. Le bouton "Enregistrer" (et "Supprimer l'inscription" à côté) ne s'affiche que si `!formLocked`, comme le bouton "Enregistrer" de `EditTravelerForm.jsx`
- Se **reverrouille automatiquement après un enregistrement réussi** (`setFormLocked(true)`, symétrique à `EditTravelerForm.jsx`) — y compris juste après avoir ouvert la fiche via `?mode=edit` : un nouveau clic sur "Modifier" est nécessaire pour modifier à nouveau lors d'une visite suivante

## 3cinquantequatrequadragies. Chevauchement d'hôtels : contrôle limité aux VILLES différentes

`findOverlappingTripHotel` (§3octotrigies) refusait tout chevauchement de dates entre **deux hôtels quelconques** d'un même voyage, sans tenir compte de leur ville — bloquait à tort le cas réel signalé : attacher un **deuxième hôtel de la même ville** (ex. KARAOUAN BLAZA, Madina) sur les **mêmes dates** qu'un hôtel déjà attaché de cette ville (MARKAZIA, Madina également), pour offrir une **option d'hébergement concurrente** dans cette ville sur cette période — chaque voyageur choisissant ensuite l'un des deux via sa préférence d'hôtel par ville (`registration_hotel_preferences`, §3quattuorvicies, qui liste déjà tous les hôtels d'une même ville en une seule liste de choix — cette section n'a donc rien eu à changer, la structure prévoyait déjà plusieurs hôtels par ville).

- **`findOverlappingTripHotel(tripId, hotelId, checkInDate, checkOutDate)`** (`lib/roomAssignment.js`) gagne un paramètre `hotelId` (le nouvel hôtel candidat) — la requête rejoint `hotels candidate ON candidate.id = ?` et ajoute `AND h.city != candidate.city` : un hôtel existant n'est plus considéré en conflit que s'il est dans une **ville différente** de celle du candidat. Toujours vrai : un voyageur ne peut pas être dans **deux villes** en même temps (le vrai invariant physique) — mais peut très bien avoir le choix entre deux hôtels d'une même ville sur la même période
- **`POST /api/admin/trips/[tripId]/hotels`** transmet désormais `hotelId` à `findOverlappingTripHotel` (signature élargie)
- **`HebergementManager.jsx`** (`handleAddHotel`, vérification client miroir) : retrouve la ville de l'hôtel sélectionné (`hotels.find(...)`) et exclut du contrôle de chevauchement tout hôtel déjà attaché de cette **même** ville
- Message d'erreur reformulé pour refléter le véritable invariant : "un voyageur ne peut pas être dans **deux villes** en même temps" (au lieu de "deux hôtels") — cohérent avec la nouvelle portée du contrôle, dans les deux endroits (route API et vérification client)
- **Vérifié par requête SQL directe contre la vraie base** (pas de simulation) sur le voyage réel signalé (OMRA 25 NOV) : KARAOUAN BLAZA (Madina) sur les mêmes dates que MARKAZIA (Madina, déjà attaché) → plus aucun conflit détecté (autorisé) ; KARAOUAN BLAZA (Madina) sur des dates chevauchant réellement ABRAJ TAYSSIR (Makka, ville différente) → conflit toujours détecté correctement

## 3cinquantecinququadragies. Une chambre par VILLE (multi-hébergement par inscription, migration `025_add_registration_room_assignments.sql`)

Signalé sur `/admin/voyages/[tripId]/hebergement` : "Répartition automatique" n'affectait des chambres qu'à une seule ville (Médine), jamais à l'autre (Makka), alors que des hôtels/chambres Makka existaient bel et bien et que des voyageurs avaient une préférence pour Makka.

**Cause racine** : `registrations.room_id` était une colonne scalaire — une inscription ne pouvait avoir **qu'une seule chambre pour tout le voyage**, alors qu'un voyage Omra multi-villes (Mecque + Médine, parfois une escale-séjour à Istanbul, §3septtrigies) a besoin d'une chambre **par ville**. `autoAssignTrip` construisait un seul pool de chambres toutes villes confondues et n'affectait qu'une chambre par inscription au total ; une fois affectée à une ville (au hasard de l'ordre de traitement), l'inscription disparaissait de `listUnassignedRegistrations` (`WHERE room_id IS NULL`) et n'était plus jamais considérée pour l'autre ville. C'était une limitation **déjà documentée et sciemment acceptée** (§3quattuorvicies, "limitation assumée, pas corrigée ici") — corrigée ici sur demande explicite.

### Nouvelle table `registration_room_assignments`

Même forme que `registration_hotel_preferences` (§3quattuorvicies, précédent direct imité) : une ligne par `(registration_id, city)`, `room_id` à la place de `hotel_id`, `agency_id DEFAULT 1` dès la création (cette table naît après la fondation multi-agences, §3sexvicies, pas besoin d'un `ALTER` a posteriori). Migration avec **backfill** : chaque affectation existante (`registrations.room_id`) est recopiée dans la nouvelle table, ville dérivée via `rooms → trip_hotels → hotels.city`. `registrations.room_id` reste en base, **déprécié** (même pattern que `flight_ticket_price`/`preferred_hotel_id`/`season`) : plus jamais écrit par le nouveau code.

`lib/registrationRoomAssignments.js` (nouveau) : `listRoomAssignmentsForRegistration`/`listRoomAssignmentsForTrip`, CRUD en lecture seule — les écritures restent dans `lib/roomAssignment.js` (a besoin de la connexion/transaction partagée pour les contrôles de capacité/mixité, même séparation que pour les préférences d'hôtel).

### `lib/roomAssignment.js` — réécriture

- **`listRoomsForTrip`** : comptage d'occupants via `registration_room_assignments` au lieu de `reg.room_id = r.id`.
- **`listUnassignedRegistrations`** : le filtre paiement/visa (§3trevicies) **reste strictement inchangé**. "Non affecté" ne signifie plus "n'a aucune chambre" mais "n'a pas encore de chambre dans **toutes** les villes du voyage" — chaque inscription porte désormais `missingCities`/`assignedCities`. Garde-fou : si le voyage n'a encore aucun hôtel attaché, ne rien filtrer (sinon la liste disparaîtrait avant même la configuration de l'hébergement). Pour un voyage à une seule ville, comportement 100% identique à avant.
- **`listAssignedRegistrationsForTrip`** : renvoie désormais **une ligne par (inscription, ville affectée)** — un voyageur bi-ville apparaît sur deux lignes. ⚠️ **Piège rencontré à l'implémentation** (repéré par l'agent Plan avant même d'écrire le code) : le `SELECT` doit exposer `rra.room_id` sous l'alias `room_id`, jamais `r.room_id` (la colonne dépréciée) — sinon `HebergementManager.jsx` (`occupantsByRoom.set(a.room_id, ...)`) grouperait les occupants sur une valeur obsolète.
- **`assignRegistrationToRoom`** : même structure de verrouillage (`FOR UPDATE` sur l'inscription puis la chambre), mais l'écriture finale devient un **upsert** (`INSERT ... ON DUPLICATE KEY UPDATE room_id = VALUES(room_id)`) sur `(registration_id, city)` — additif par ville, n'affecte/ne remplace jamais que la ville de la chambre choisie.
- **Nouvelle `unassignRegistrationFromRoom(registrationId, roomId)`** (remplace `unassignRegistration`, qui n'avait plus de sens sans savoir quelle chambre désaffecter) — cible une chambre précise.
- **`autoAssignTrip`** : la boucle gloutonne d'origine (remplissage des chambres partielles d'abord, score de préférence, genre le plus nombreux traité en premier) **ne change pas dans sa substance** — enveloppée dans une boucle externe sur chaque ville distincte du voyage, avec `byGender`/`hasPreference`/`genderOrder` **recalculés à l'intérieur de chaque itération** (pas une fois globalement — sinon un voyageur avec préférence à Médine mais pas à Makka aurait été mal priorisé pendant la passe Makka). Le score de préférence devient conscient de la ville courante (`hotelPreferences.find(p => p.city === city)`, auparavant la comparaison ignorait la ville — ça « marchait » seulement parce qu'il n'y avait qu'une seule chambre au total). `{assignedCount, skippedCount}` comptent désormais par tentative (inscription, ville).
- **⚠️ Bug de contrainte FK trouvé en validation (agent Plan), corrigé dans la même passe** : `rooms.id` est référencée par `registrations.room_id` sans `ON DELETE` (RESTRICT implicite). Comme cette colonne n'est plus jamais mise à jour, une chambre affichée comme vide (via la nouvelle table) pouvait encore porter une référence **obsolète** dans `registrations.room_id` et bloquer sa suppression avec une erreur SQL brute — `removeTripHotel` était touché en cascade de la même façon. Fix : `deleteRoom`/`removeTripHotel` mettent d'abord `registrations.room_id` à `NULL` pour toute référence à la chambre concernée, avant de supprimer — neutralise uniquement la colonne morte, `registration_room_assignments.room_id` (RESTRICT implicite lui aussi) continue de bloquer correctement la suppression d'une chambre **réellement** occupée.

### `app/api/admin/registrations/[id]/room/route.js`

`PUT` garde le contrat `{ roomId }` (désormais additif), mais exige un `roomId` non vide (400 sinon — PUT ne signifie plus "désaffecter" avec un `roomId` vide). Nouveau `DELETE` : `{ roomId }` dans le corps → `unassignRegistrationFromRoom`.

### `HebergementManager.jsx`

Changement à faible surface — les dropdowns "Assigner à..."/"Assigner le groupe à..." étaient déjà groupés par ville (`<optgroup>` via `groupByCity`, §3novemdecies) et n'ont pas eu besoin de sections dupliquées par ville :
- `handleAssign` : retour anticipé si aucune chambre choisie (un `<select>` vide ne signifie plus "désaffecter").
- Nouvelle `handleUnassign(registrationId, roomId)` (`DELETE` sur la même route) ; le bouton "Retirer" dans la ligne d'un occupant lui passe désormais la chambre déjà affichée dans cette ligne, au lieu d'appeler `handleAssign(o.id, "")`.
- Les deux dropdowns filtrent maintenant les chambres candidates pour exclure les villes déjà affectées à l'inscription (ou, pour un groupe, au premier membre — même simplification déjà utilisée pour la préférence) via le nouveau champ `assignedCities` — n'offre plus que les villes encore réellement nécessaires.
- `occupantsByRoom` (regroupement des occupants par `room_id`) : **aucun changement** — supporte déjà nativement qu'une même inscription apparaisse sous deux clés différentes.

### `app/admin/inscriptions/[id]/page.js`

La fiche "Chambre" affiche désormais une ligne par ville (`listRoomAssignmentsForRegistration`) au lieu d'un unique hôtel/chambre.

### `v_trip_traveler_list` (vue, base de l'export "liste des voyageurs")

⚠️ **Piège anti-fan-out identifié en validation** : ajouter naïvement `LEFT JOIN registration_room_assignments` (relation 1-N) par-dessus le `LEFT JOIN payments` existant (déjà 1-N) sous le même `GROUP BY reg.id` aurait multiplié `SUM(pay.amount)` par le nombre de villes affectées (double-comptage du montant payé pour un voyageur bi-ville). Fix : les paiements sont pré-agrégés dans une sous-requête dérivée **avant** la jointure sur les affectations de chambre, et le `GROUP BY` est supprimé — la vue renvoie désormais une ligne par (inscription, ville affectée), montants financiers identiques et simplement répétés sur chaque ligne du même voyageur, jamais resommés. **Aucun changement nécessaire** dans `lib/listGenerators.js` (`getTravelerList`/`TRAVELER_LIST_COLUMNS`, flat pass-through) ni les exporters Excel/PDF (génériques, aucune hypothèse "une ligne = un voyageur") — `v_trip_airline_list`/la liste visa n'ont aucun champ hôtel/chambre, non concernées.

### Conséquence attendue sur l'export "liste des voyageurs"

Un voyageur affecté dans deux villes apparaît désormais sur **deux lignes** de l'export Excel/PDF (une par ville/hôtel/chambre), avec les mêmes colonnes identité/statut/montants répétées sur chacune — c'est la représentation correcte de la réalité (un hébergement par ville), pas une régression.

### Vérification effectuée

Recherche par 2 agents Explore (cartographie complète des lectures/écritures de `room_id`, étude de `registration_hotel_preferences` comme précédent) + 1 agent Plan (validation du design, lecture intégrale des fichiers critiques — a trouvé les deux bugs ci-dessus **avant** l'écriture du code). Aucune connexion admin possible dans cet environnement — vérifié par script Node réel (pas de simulation) contre la vraie base de dev, sur un **voyage de test isolé** (même programme Omra que le voyage réel signalé, mais un `trips`/`trip_hotels`/`rooms` dédiés, pour ne jamais toucher aux données réelles de l'utilisateur) :
- `autoAssignTrip` sur 2 inscriptions de test × 2 villes (Makka + Madina) → `assignedCount: 4`, chaque inscription reçoit bien 2 affectations (une par ville) — confirmation directe que le bug signalé est corrigé
- `assignRegistrationToRoom`/`unassignRegistrationFromRoom` manuels : comptage d'occupation correct, l'affectation d'une ville reste intacte pendant la manipulation d'une autre ville pour la même inscription (additif confirmé)
- Le correctif de la contrainte FK : `registrations.room_id` forcé à une valeur obsolète, `deleteRoom` réussit quand même (aurait échoué avant)
- `v_trip_traveler_list` : une ligne par ville, `total_paid` correct (non doublé) sur un voyageur avec 2 paiements et 2 villes
- `next build` réussi ; toutes les données de test nettoyées après vérification (aucune trace en base, confirmé par requête SQL directe)

## 3cinquantesixquadragies. Répartition automatique aveugle au tarif d'hébergement choisi

Signalé : un voyageur ayant choisi le tarif "VIP" à l'inscription (ANJOUM à Makka, KARAOUAN BLAZA à Madina — le tarif détermine l'hôtel par ville, §3unquadragies) s'est retrouvé affecté par "Répartition automatique" à ABRAJ TAYSSIR (l'hôtel du tarif "Économique"), alors même que le voyageur n'a jamais eu le choix de saisir cet hôtel.

**Cause racine** : `autoAssignTrip`/`listUnassignedRegistrations`/`listAssignedRegistrationsForTrip` (§3cinquantecinququadragies) ne lisaient la préférence d'hôtel que depuis `registration_hotel_preferences` — or ce champ "Hôtel souhaité" a été **retiré** de `/admin/inscriptions/new` dès qu'un tarif est choisi (§3unquadragies, "Retour d'usage — champs 'Hôtel souhaité' retirés..."), le tarif choisi devenant la seule source de vérité de l'hôtel par ville. Résultat : pour toute inscription avec un `selected_tier_id`, `hotelPreferences` était systématiquement vide, et la répartition automatique retombait sur la seule heuristique de remplissage — sans aucune notion de l'hôtel réellement choisi.

- **`effectiveHotelPreferences(registration, explicitPreferences, tiersById)`** (nouvelle fonction, `lib/roomAssignment.js`) : si l'inscription a un `selected_tier_id`, dérive la préférence d'hôtel par ville **depuis le tarif** (`makkah_hotel_id`/`madinah_hotel_id` du tarif, avec la ville/le nom résolus via `listTiersForTrip`, `lib/tripHotelTiers.js`) — prioritaire sur `registration_hotel_preferences`, qui reste le mécanisme pour une inscription sans tarif (voyage sans tarifs configurés, ou inscription antérieure à l'introduction des tarifs)
- **`listUnassignedRegistrations`** : `hotelPreferences` de chaque inscription passe désormais par `effectiveHotelPreferences` — bénéfice en cascade sans changement supplémentaire pour `autoAssignTrip` (qui ne fait que lire ce champ) **et** pour l'affichage "souhaite : {ville} → {hôtel}" / le filtrage des dropdowns "Assigner à..." dans `HebergementManager.jsx` (§3cinquantecinququadragies), qui reflètent désormais aussi le tarif
- **`listAssignedRegistrationsForTrip`** (alerte ⚠ de préférence non respectée, §3unvicies) : corrélation à la préférence recalculée en JS plutôt qu'en SQL corrélé (un simple `LEFT JOIN registration_hotel_preferences` ratait systématiquement l'alerte pour une inscription à tarif, faute de ligne dans cette table) — même fonction `effectiveHotelPreferences`, filtrée sur la ville de la chambre réellement affectée
- **Régularisation de la donnée déjà affectée à tort** : le voyageur signalé a été manuellement réaffecté (upsert `registration_room_assignments`, même requête que `assignRegistrationToRoom`) à l'hôtel de son tarif — plus aucune trace de l'affectation incorrecte
- **Vérifié par script Node réel contre la vraie base** (voyage de test isolé, pas de simulation) : deux hôtels Makka attachés à un même voyage de test (l'un neutre, l'autre celui d'un tarif "VIP" créé pour le test), une inscription avec `selected_tier_id` pointant vers ce tarif → `autoAssignTrip` l'affecte bien à l'hôtel du tarif (ANJOUM), jamais à l'autre — confirmation directe. Données de test nettoyées après vérification

### Retour d'usage — "X voyageur(s) affecté(s)" comptait des chambres, pas des voyageurs

Conséquence directe de §3cinquantecinququadragies (chambre par ville) signalée après usage réel : le message affiché après "Répartition automatique" ("4 voyageur(s) affecté(s)") comptait en réalité `assignedCount`, incrémenté une fois **par (inscription, ville)** — 2 voyageurs bi-villes affectés dans leurs 2 villes chacun affichaient donc "4", alors qu'il n'y avait que 2 personnes.

- **`autoAssignTrip`** (`lib/roomAssignment.js`) gagne `travelersAssignedIds` (`Set`, alimenté à chaque affectation réussie) et retourne un troisième champ, `travelersAssignedCount` — `assignedCount`/`skippedCount` gardent leur sens existant (compte par tentative ville), inchangé pour ne rien casser côté appelants déjà en place
- **`HebergementManager.jsx`** : le message affiche désormais `travelersAssignedCount` en tête ("X voyageur(s) affecté(s)"), avec un complément entre parenthèses uniquement si différent de `assignedCount` ("... (Y chambres, un voyage multi-villes compte pour plusieurs)") — pour un voyage à une seule ville, les deux comptes sont toujours égaux, donc **aucun changement visible** du message par rapport à avant
- **Vérifié par script Node réel** (voyage de test isolé) : 1 voyageur bi-ville (Makka + Madina) → `autoAssignTrip` renvoie `{ assignedCount: 2, travelersAssignedCount: 1 }`, confirmant la distinction. Données de test nettoyées après vérification

### "Retirer" désaffecte désormais TOUTES les villes d'un coup

Demande explicite : retirer un voyageur de sa chambre à Makka doit aussi le retirer de Médine (et inversement) — jusqu'ici, "Retirer" (bouton dans la ligne d'un occupant, table "Chambres") ne ciblait que la chambre affichée dans cette ligne précise (`unassignRegistrationFromRoom(registrationId, roomId)`), laissant le voyageur à moitié affecté (encore logé dans l'autre ville).

- **`unassignRegistrationFromTrip(registrationId)`** (`lib/roomAssignment.js`, remplace `unassignRegistrationFromRoom`) : `DELETE FROM registration_room_assignments WHERE registration_id = ?` — sans filtre sur `room_id`, efface donc toutes les villes déjà affectées à cette inscription en un seul appel
- **`DELETE /api/admin/registrations/[id]/room`** : n'a plus besoin de `roomId` dans le corps (la suppression n'est plus scopée à une chambre précise)
- **`HebergementManager.jsx`** : `handleUnassign(registrationId)` (perd son paramètre `roomId`) ; le bouton "Retirer" gagne un `title` explicite ("Retire ce voyageur de toutes les villes du voyage") pour ne pas surprendre le personnel
- **Vérifié par script Node réel** (voyage de test isolé) : voyageur affecté à Makka **et** Médine, un seul retrait → les deux affectations disparaissent (`registration_room_assignments` vide pour cette inscription). Données de test nettoyées après vérification

## 3cinquanteseptquadragies. Ajouter d'autres voyageurs à un groupe depuis une fiche inscription

⚠️ **Retouché immédiatement après par §3cinquantehuitquadragies** : le bouton décrit ci-dessous a été retiré d'`EditRegistrationForm.jsx` et déplacé au niveau de la page groupe (`AddGroupMemberForm.jsx`) — cette section reste pour l'historique du principe ("ajouter un membre à un groupe déjà existant en un seul geste", toujours vrai), mais l'emplacement exact a changé.

Jusqu'ici, la seule façon d'ajouter un membre à un groupe **déjà existant** était détournée : créer sa fiche séparément en "Individuel" depuis `/admin/inscriptions/new`, puis, depuis **cette nouvelle fiche**, choisir "Rejoindre un groupe existant" (§3quindecies) — deux allers-retours, deux pages. Demande explicite : pouvoir ajouter directement d'autres personnes au même groupe depuis la fiche d'un membre déjà dans ce groupe (`/admin/inscriptions/[id]?mode=edit`).

- **`EditRegistrationForm.jsx`** réutilise **`TravelerFields.jsx`** (`app/admin/inscriptions/new/TravelerFields.jsx`, déjà utilisé par `NewRegistrationForm.jsx` pour le type "Groupe") : un bouton "+ Ajouter un autre voyageur au groupe" (dans l'encart "Groupe / binôme", visible uniquement si `registration.group_id` est déjà renseigné **et** la fiche déverrouillée) ouvre une liste répétable de blocs voyageur ("+ Ajouter un voyageur"/"Retirer" par bloc, même mécanique que la création), chacun avec sa propre vérification de passeport (§3nonies, portée par `TravelerFields.jsx` lui-même)
- **Soumission séparée du reste du formulaire** : un bouton "Ajouter au groupe" dédié (pas le bouton "Enregistrer" principal) — un `POST /api/admin/registrations` par nouveau voyageur (même endpoint, même logique que `NewRegistrationForm.jsx`), avec `groupId: registration.group_id` déjà connu (pas de création de groupe ici, il existe déjà) — chaque ajout reste **une inscription à part entière** (documents/passeport/visa individuels), seulement rattachée d'emblée à ce groupe, pas une fusion de dossiers (cohérent avec §3quindecies)
- **N'apparaît que pour un groupe déjà enregistré** (`registration.group_id` non vide) : un groupe en cours de création dans ce même formulaire (`groupMode === "nouveau"`, pas encore soumis) n'a pas encore d'id à rattacher — il faut d'abord "Enregistrer" pour que le groupe existe, puis revenir ajouter d'autres membres
- **Montant dû du groupe volontairement non recalculé automatiquement** : à la différence de la création d'un groupe (`NewRegistrationForm.jsx`, qui calcule `totalDue = prix × nombre de voyageurs` puisque rien n'existait avant), ajouter un membre à un groupe **déjà en cours de financement** ne touche jamais `registration_groups.total_due` — un montant déjà négocié/partiellement payé ne doit pas être silencieusement écrasé ; le personnel l'ajuste manuellement depuis la page du groupe si besoin
- Succès : redirection vers `/admin/groupes/[groupId]` (la page qui liste tous les membres), pour voir immédiatement le résultat — cette fiche individuelle n'affiche que ses propres données, pas celles des autres membres
- **Vérifié par script Node réel contre la vraie base** (pas de simulation), sur le cas réel signalé (`/admin/inscriptions/10`, membre du groupe "GROUPE A", id 1) : une nouvelle inscription insérée avec `group_id = 1` apparaît immédiatement comme membre de ce groupe aux côtés du membre existant — confirmation directe. Donnée de test nettoyée après vérification

## 3cinquantehuitquadragies. Le traitement d'un membre de groupe se fait désormais dans la page du groupe

Demande explicite, suite directe de §3cinquanteseptquadragies : `/admin/groupes/[id]` n'était qu'un résumé en lecture seule (nom, genre, statut, visa), avec une note renvoyant vers la fiche individuelle de chaque membre pour tout traitement (statut, visa, préférence d'hébergement/tarif, notes). L'utilisateur a confirmé (après clarification) vouloir **tout consolider** dans la page du groupe — la fiche individuelle (`/admin/inscriptions/[id]`) ne garde plus que l'identité/passeport.

### `lib/registrationGroups.js`

- **`getGroupMembers(groupId)`** étendu : au lieu de 5 champs d'affichage, retourne tout ce dont `EditRegistrationForm.jsx` a besoin par membre (`id, status, visa_status, total_due, notes, preferred_room_type, selected_tier_id, group_id, trip_id, full_name, gender, phone_whatsapp`). L'alias `registration_id` devient `id` (aligné sur `registration.id`, lu partout dans `EditRegistrationForm.jsx`) — **seul appelant affecté**, `app/admin/groupes/[id]/page.js` (vérifié avant modification : `GET /api/admin/groups/[id]/route.js` relaie `{...group, members}` sans dépendre du nom du champ ; le reçu PDF groupe, `lib/payments.js`, a sa **propre** requête indépendante, ne passe jamais par `getGroupMembers`)
- **`getGroupById(id)`** gagne `p.family AS program_family` (même besoin que `getRegistrationById`, pour savoir si les tarifs d'hébergement Omra/Hajj s'appliquent à ce voyage)

### `EditRegistrationForm.jsx` — deux nouvelles props, réutilisé tel quel une fois par membre

- **`hideDueAmount`** (défaut `false`) : masque entièrement le bloc "Montant dû" — sur la page groupe, le montant dû est déjà géré une fois pour tout le groupe par `GroupDueForm.jsx` ; afficher, pour CHAQUE membre, un lien "voir/modifier sur la page du groupe" qui pointerait vers la page où on est déjà aurait été absurde
- **`stayOnPage`** (défaut `false`) : `handleDelete` fait `router.refresh()` seul (au lieu de `router.push("/admin/inscriptions")`) — supprimer un membre depuis la page groupe doit y rester
- **Retrait complet** du bloc "+ Ajouter un autre voyageur au groupe" (§3cinquanteseptquadragies) — dupliqué une fois par membre sur la page groupe, ça n'avait pas de sens ; relocalisé en composant de PAGE (ci-dessous)
- Le reste (statut, visa, préférence d'hébergement, tarif, groupe/binôme — y compris déplacer un membre vers un AUTRE groupe ou le rendre solo, notes, verrouillage Afficher/Modifier, suppression) est **inchangé**, simplement rendu N fois (une fois par membre) au lieu d'une fois par fiche individuelle

### `app/admin/groupes/[id]/AddGroupMemberForm.jsx` (nouveau)

Reprend exactement le bloc retiré d'`EditRegistrationForm.jsx` (réutilise `TravelerFields.jsx`), mais comme action de **page** plutôt que par membre : `tripId`/`groupId` fixes en props, un `POST /api/admin/registrations` par nouveau voyageur, `router.refresh()` après succès (reste sur la page groupe, pas de redirection nécessaire puisqu'on y est déjà).

### `app/admin/groupes/[id]/page.js`

Charge en plus `listTripHotels(group.trip_id)`, `listGroupsForTrip(group.trip_id)`, `listTiersForTrip(group.trip_id)` (si `program_family === "omra_hajj"`, sinon `[]`), `listHotelPreferencesForTrip(group.trip_id)` (batch, regroupé par `registration_id` en JS — même pattern anti-N+1 que `lib/roomAssignment.js::listUnassignedRegistrations`), et `hasPermission(session, "inscriptions.delete")`. Lit `searchParams.mode` comme la fiche individuelle. Le `<ul>` en lecture seule des membres devient, pour chaque membre, un encart (nom/genre + lien "Fiche voyageur (passeport) →" vers `/admin/inscriptions/[id]`) contenant `<EditRegistrationForm ... hideDueAmount stayOnPage />`. `<AddGroupMemberForm>` apparaît une seule fois, au niveau de la page. `GroupDueForm`/`PaymentsSection` (montant dû + paiements partagés) : inchangés.

### `app/admin/inscriptions/[id]/page.js`

`<EditTravelerForm>` (identité/passeport) reste **toujours** rendu, quel que soit le groupe. `<EditRegistrationForm>` n'est plus rendu que si `!registration.group_id` — pour un membre de groupe, remplacé par un encart miroir de celui déjà existant pour "Paiements" juste en dessous (même style, même principe) : *"Ce voyageur fait partie du groupe {label} : le suivi (statut, visa, hébergement, notes) se gère au niveau du groupe, pas individuellement."* + lien vers `/admin/groupes/[group_id]`. Le résumé `<dl>` en haut de page (Chambre/Préférence/Groupe/Billet, lecture seule) reste affiché dans tous les cas.

### `app/admin/inscriptions/page.js` (liste)

Pour une ligne dont `reg.group_id` est renseigné, "Afficher"/"Modifier" pointent désormais vers `/admin/groupes/[group_id]`/`/admin/groupes/[group_id]?mode=edit` au lieu de la fiche individuelle — cohérent avec "le traitement se fait dans le groupe". Le lien `({reg.group_label})` déjà existant à côté du nom est conservé (même destination désormais, mais reste un repère visuel utile). Une inscription individuelle (`reg.group_id` null) n'est pas affectée.

### Vérification effectuée

`next build` réussi ; parse Babel/JSX sur les 6 fichiers touchés/créés. Requêtes SQL des deux fonctions étendues exécutées directement contre la vraie base de dev, sur le groupe réel "GROUPE A" (id=1, 3 membres réels) : `getGroupMembers(1)` renvoie bien tous les nouveaux champs (`preferred_room_type`, `selected_tier_id`, `notes`, `trip_id`...) pour les 3 membres ; `getGroupById(1)` renvoie bien `program_family: "omra_hajj"`. Aucune connexion admin possible dans cet environnement — le rendu visuel des N formulaires empilés sur la page groupe n'a pas pu être vérifié dans le navigateur, seulement par lecture de code et compilation réussie.

## 3cinquanteneufquadragies. Montant dû du groupe recalculé automatiquement selon le nombre de membres et leur tarif

Demande explicite, suite directe de §3cinquantehuitquadragies : le "Montant dû du groupe" n'était calculé qu'**une seule fois**, à la création (`NewRegistrationForm.jsx`, `prix × nombre de voyageurs`), puis restait figé jusqu'à une modification manuelle (§3septendecies). L'utilisateur veut qu'il **s'actualise automatiquement** selon le nombre de membres actifs et le tarif/type de chambre choisi par CHACUN — après clarification explicite (choix confirmé), ce recalcul est **automatique et silencieux** : il écrase le montant existant à chaque événement pertinent, y compris un montant déjà négocié manuellement (rupture assumée avec la règle "ne jamais écraser silencieusement un montant négocié" énoncée ailleurs dans ce projet — ici explicitement voulue par l'utilisateur pour CE champ précis).

### `recalculateGroupTotalDue(groupId)` (nouveau, `lib/registrationGroups.js`)

Recalcule `registration_groups.total_due` comme la **somme du prix de chaque membre actif** (`status != 'annule'`), chacun selon **son propre** tarif d'hébergement (`selected_tier_id` → `trip_hotel_tier_prices`, via `pickTierPrice`) s'il en a choisi un, sinon le prix plat du voyage selon son type de chambre (`pickTripPrice` sur les 4 paliers du voyage, §3unetrigies) — mêmes fonctions pures que le pré-remplissage à l'inscription (`lib/roomTypes.js`, aucun changement là). Un groupe sans membre actif retombe à `0`. Requêtes batchées (tarifs distincts récupérés en un seul `IN (?)`, même pattern que le reste du projet) — pas de N+1 même pour un groupe nombreux.

### Déclenché depuis `lib/registrations.js`, pas depuis les composants client

Décision : le recalcul est câblé dans les fonctions serveur qui font réellement bouger la composition/le tarif d'un groupe, pas dans les gestionnaires React — robuste à **tout** appelant futur (script, API directe), pas seulement les deux chemins UI actuels (`EditRegistrationForm.jsx`, `AddGroupMemberForm.jsx`), qui n'ont donc **eu besoin d'aucune modification**.

- **`createRegistration`** : si `data.groupId` est renseigné, recalcule ce groupe juste après le commit (hors transaction — purement dérivé, aucun risque à le recalculer juste après plutôt que dans la même transaction)
- **`updateRegistration`** : capture le `group_id` **d'avant** la mise à jour dès que le payload touche `groupId`, `selectedTierId`, `preferredRoomType` **ou** `status` (une annulation retire un membre du décompte actif) — après la mise à jour, recalcule l'ANCIEN groupe (si le membre l'a quitté) **et** le NOUVEAU (s'il en a rejoint un, ou si son tarif a changé au sein du même groupe), sans doublon (`Set`) si les deux sont identiques
- **`deleteRegistration`** : capture le `group_id` avant suppression, recalcule ce groupe après (un membre supprimé ne doit plus compter)

### Vérifié par script Node réel contre la vraie base (voyage de test isolé, pas de simulation)

Séquence complète rejouée : membre 1 en chambre double (1000) → total 1000 ; ajout membre 2 en double → total 2000 ; membre 1 passe en triple (1500) → total 2500 ; membre 1 reçoit un tarif VIP avec un prix triple à 6000 → total 7000 (6000 + 1000, le tarif prime sur le prix plat) ; membre 1 annulé (`status='annule'`) → total 1000 (seul membre 2 restant compte) ; membre 2 supprimé → total 0 (plus aucun membre actif). Les 6 étapes produisent exactement les montants attendus. Données de test nettoyées après vérification.

## 3soixantequadragies. Réorganisation en 3 cartes (Informations Voyageurs / Paiement / Visa) + numéros de téléphone supplémentaires (migration `026_add_traveler_phone_fields.sql`)

Demande explicite : réorganiser la création (`/admin/inscriptions/new`) et la consultation/modification (`/admin/inscriptions/[id]`, `/admin/groupes/[id]`) en **3 blocs visuellement séparés, tous visibles en permanence** (pas des tuiles cliquables + modale comme `/admin/programmes/[id]`, §3quadragies — choix explicite de l'utilisateur) : **Informations Voyageurs**, **Paiement**, **Visa**. Chaque bloc garde son propre mécanisme de sauvegarde déjà existant, aucun nouveau système transversal.

### Champs téléphone

- `travelers.phone` (nouveau, distinct de `phone_whatsapp` — canal principal existant, toujours requis) — simple champ optionnel
- `traveler_phone_numbers` (nouvelle table, `lib/travelerPhoneNumbers.js`) : liste **répétable** de numéros supplémentaires par voyageur (ex. contact d'urgence), purge + réinsertion à chaque enregistrement (même pattern que `setHotelPreferencesForRegistration`) — un vrai nouveau besoin, pas une duplication des champs Tél/WhatsApp existants
- ⚠️ **Appel volontairement placé APRÈS le commit** de la transaction de `createRegistration` (`lib/registrations.js`) : `setPhoneNumbersForTraveler` ouvre sa **propre** connexion — l'appeler à l'intérieur de la transaction du voyageur provoquerait un blocage (la seconde connexion attendrait un verrou de ligne que la première ne relâche qu'à la fin) — même précaution déjà appliquée à `recalculateGroupTotalDue` (§3cinquanteneufquadragies)
- **`updateTraveler`** (`lib/registrations.js`) étendu au passage : ne persistait jusqu'ici que 6 des ~10 champs voyageur (`full_name_arabic`/`date_of_birth`/`national_id`/`address` existaient en base depuis la création mais n'étaient jamais réécrits en modification) — gap comblé, ces champs sont désormais éditables sans risque de perte silencieuse

### Carte 1 — Informations Voyageurs

`TravelerFields.jsx` (création) et `EditTravelerForm.jsx` (édition) partagent désormais exactement le même ordre de champs : Nom complet → Nom en arabe → Genre → Date de naissance → CIN → N° Passeport (format + dialogue de confirmation + verrouillage inchangés, §3nonies) → Date d'expiration (validation 6 mois inchangée) → N° Tél → N° WhatsApp → Autres numéros (répétable) → Email (optionnel) → Adresse.

- **Champs "Hôtel souhaité — {ville}" retirés** de `EditRegistrationForm.jsx` (déjà retirés du formulaire de création en §3cinquantetroisquadragies) : redondants depuis que le tarif d'hébergement encode déjà l'hôtel par ville. Le composant ne reçoit plus les props `tripHotels`/`hotelPreferences` — les pages appelantes continuent d'appeler `listTripHotels`/`listHotelPreferencesForRegistration` pour leur propre résumé `<dl>` en lecture seule, inchangé
- **`NewRegistrationForm.jsx`** : "Nom du groupe / binôme" devient **toujours visible** (`disabled`/non `required` si Individuel, au lieu de conditionnellement rendu), positionné avant les boutons "Type d'inscription" ; le bloc "Tarif d'hébergement souhaité" est remonté avant les blocs voyageur ; le mot "(optionnel)" est retiré du label "Type de chambre souhaité" (reste fonctionnellement optionnel)
- `AddGroupMemberForm.jsx` (page groupe) a sa **propre** fabrique locale `emptyMember()`, distincte de celle de `NewRegistrationForm.jsx` — mise à jour en parallèle (`phone`, `additionalPhoneNumbers`) pour ne pas planter au premier ajout de voyageur

### Carte 2 — Paiement

`EditRegistrationForm.jsx` perd entièrement "Montant dû" (state, JSX, payload) — remplacé par **`GroupDueForm.jsx`** (déjà générique via `apiBasePath`/`totalDue`/`canManage`/`label`, jusqu'ici réservé aux groupes/services visa) réutilisé tel quel pour une inscription individuelle, `apiBasePath = /api/admin/registrations/[id]`. Le prop `hideDueAmount` (devenu inutile des deux côtés) est retiré.

### Carte 3 — Visa (légère, pas de réactivation du workflow complet)

Nouveau `VisaStatusForm.jsx` (même esprit que `GroupDueForm.jsx`) : `<select>` Statut visa (PUT `{visaStatus}` seul — correspond exactement à ce que le rôle `suivi` a le droit d'envoyer, §3undecies) + rappel lecture-seule "Passeport : {numéro} — expire le {date}". Explicitement **pas** de réactivation du workflow complet de demande de visa (type de visa, checklist de documents, retiré en §3sedecies). `EditRegistrationForm.jsx` perd "Statut visa" en parallèle (sinon doublon sur la page groupe, ce `<select>` y étant rendu par membre sans garde de rôle).

- Réutilisé **par membre** sur `/admin/groupes/[id]` (statut visa reste individuel par voyageur même en groupe, §3trevicies) — `getGroupMembers` (`lib/registrationGroups.js`) gagne `tr.passport_number, tr.passport_expiry_date` pour l'alimenter
- `canEditVisa` (`direction`/`suivi`) et `canEditFinance` (`direction`/`comptabilite`) — restrictions fines par rôle déjà existantes (§3undecies), déplacées des composants formulaire vers les deux `page.js` appelants (individuelle et groupe), qui les calculent maintenant eux-mêmes pour piloter `VisaStatusForm`/`GroupDueForm`

### Vérification effectuée

- `next build` réussi ; parse Babel/JSX sur tous les fichiers touchés/créés
- **Test de bout en bout avec les vraies fonctions JS** (pas une simulation SQL), contre la vraie base de dev : les fichiers `lib/*.js` étant des modules ESM avec imports relatifs sans extension (`from "./db"`) et sans `"type": "module"` dans `package.json`, ils ne sont normalement pas `import()`-ables depuis un script Node autonome (seulement bundlés par Next.js/webpack) — contourné avec un hook de résolution ESM minimal (`node --import`, API `module.register`, qui retente `+".js"` sur un spécificateur relatif sans extension) plutôt que dupliquer la logique en SQL brut comme les vérifications précédentes de ce projet. `createRegistration` (avec `phone`+`additionalPhoneNumbers`) → `updateTraveler` (purge+réinsertion des numéros, nouveaux champs) → `updateRegistration` avec seulement `{visaStatus}` puis seulement `{totalDue}` (simulant les rôles `suivi`/`comptabilite`) : les 4 étapes confirmées correctes en relisant `getRegistrationById`/`listPhoneNumbersForTraveler`. Données de test nettoyées après vérification
- ⚠️ **Bug trouvé et corrigé grâce à ce test** : `getRegistrationById` (`lib/registrations.js`) ne sélectionnait pas `tr.phone` (seulement `tr.phone_whatsapp`) — le nouveau champ "N° Tél" se serait donc toujours affiché vide sur `EditTravelerForm.jsx` en rouvrant une fiche déjà enregistrée, même après une sauvegarde réussie. Un test uniquement en SQL brut (comme fait dans une première passe) n'aurait pas révélé ce gap, puisque la colonne existe bien en base — c'est la fonction de lecture JS qui l'omettait. Ajouté à la liste `SELECT` existante ; `next build` re-vérifié après correction

## 3soixanteetunquadragies. Fiche inscription/groupe en tuiles cliquables + modale, comme `/admin/programmes/[id]`

Demande explicite : aligner `/admin/inscriptions/[id]` (affichage/modification) et `/admin/groupes/[id]` sur le même modèle visuel que `/admin/programmes/[id]` (§3quadragies) — tuiles compactes cliquables, chacune ouvrant son contenu complet dans une modale avec son propre bouton "Enregistrer" — plutôt que les blocs empilés en permanence mis en place en §3soixantequadragies (qui avait explicitement écarté ce pattern par choix utilisateur à l'époque ; décision inversée ici sur nouvelle demande explicite).

### `ModuleTile.jsx` mutualisé, gagne un mode "lien"

Déplacé de `app/admin/programmes/[id]/ModuleTile.jsx` vers **`app/admin/_components/ModuleTile.jsx`** (même mouvement que `Modal.jsx` en §3octoquadragies — un composant utilisé par plus d'une page admin rejoint `_components`). Gagne un prop `href` optionnel : une tuile avec `href` devient un `<Link>` de navigation directe (même apparence) au lieu d'un bouton ouvrant une modale — utilisé pour la tuile "Groupe" d'une inscription groupée, qui renvoie vers `/admin/groupes/[id]` plutôt que d'ouvrir un formulaire ici.

### `app/admin/inscriptions/[id]/InscriptionManagerGrid.jsx` (nouveau)

Remplace l'empilement de cartes de §3soixantequadragies par une grille de tuiles (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`, identique à `ProgramManagerGrid.jsx`) :
- **"Informations Voyageurs"** → `EditTravelerForm` (sous-titre : numéro de passeport)
- **"Suivi de l'inscription"** → `EditRegistrationForm` (sous-titre : statut) — **seulement si non groupée**
- **"Paiement"** → `GroupDueForm` + `PaymentsSection` combinés dans une même modale (sous-titre : montant dû) — **seulement si non groupée**
- **"Groupe"** (tuile-lien `href`, pas de modale) → `/admin/groupes/[group_id]`, remplace les deux tuiles précédentes **si groupée** — un seul renvoi couvre suivi et paiement à la fois (avant, deux blocs séparés répétaient le même message)
- **"Visa"** → `VisaStatusForm` — toujours affichée, groupée ou non (statut visa reste par voyageur, §3trevicies)

Le résumé en lecture seule (Chambre/Préférence hébergement/Groupe/Billet d'avion) reste **au-dessus** de la grille, hors tuile — même principe que le `<h1>`/en-tête de `/admin/programmes/[id]`, qui reste hors grille lui aussi.

### `app/admin/groupes/[id]/GroupManagerGrid.jsx` (nouveau)

Une tuile **par membre** (titre : nom, sous-titre : `genre · statut · visa {statut}`) ouvre une modale combinant `EditRegistrationForm` (suivi/hébergement/tarif/groupe/notes) **et** `VisaStatusForm` (visa reste individuel même en groupe) pour ce membre, plus un lien "Fiche voyageur (passeport) →" vers sa fiche individuelle — remplace l'ancien empilement de blocs "un par membre, tous ouverts en permanence" de §3cinquantehuitquadragies. Une tuile supplémentaire **"Paiement du groupe"** (sous-titre : montant dû) ouvre `GroupDueForm` + `PaymentsSection`, partagée pour tout le groupe — inchangé dans son fonctionnement, seulement déplacé dans une modale. Le roster (titre "Membres du groupe (N)", grille de tuiles, formulaire "+ Ajouter un voyageur au groupe") reste un seul bloc visible en permanence, pas lui-même une tuile — cohérent avec le fait que `/admin/programmes/[id]` garde aussi son `<h1>`/contexte de page hors grille.

### Composants "carte" allégés — même retouche que `InfoCard.jsx`/`AirportCard.jsx` (§3quadragies)

`EditTravelerForm.jsx`/`EditRegistrationForm.jsx` perdent leur habillage `rounded-xl border bg-white p-6` et leur `<h2>` de titre (redondants : `Modal.jsx` fournit déjà la boîte + le titre) — remplacés par une simple ligne de statut ("Verrouillé après enregistrement" + lien "Modifier") quand verrouillé. Les deux gagnent un prop **`onSuccess`**, appelé juste après `router.refresh()` en cas de sauvegarde réussie — ferme automatiquement la modale, même mécanique que les cartes programme. `PaymentsSection.jsx` gagne un prop **`bare`** (retire son propre encadré/titre quand elle est déjà dans une modale) — son usage historique hors modale (aucun dans ce projet actuellement, mais le prop reste optionnel, défaut `false`, non cassant) continue de fonctionner à l'identique. `VisaStatusForm`/`GroupDueForm` n'avaient déjà aucun habillage propre — aucun changement nécessaire pour eux.

### Vérification effectuée (avec connexion admin réelle, contrairement à toutes les sections précédentes)

Un compte `direction` temporaire a été créé (`scripts/create-staff-user.js`) pour tester **visuellement** dans le navigateur — une première pour ce projet, toutes les vérifications précédentes ayant dû se limiter à la lecture de code/scripts DB faute d'identifiants. Testé en direct : `/admin/inscriptions/24` (NOURA, non groupée) — les 4 tuiles s'ouvrent chacune correctement (Informations Voyageurs avec le N° Tél et les numéros supplémentaires bien pré-remplis, confirmant au passage en conditions réelles le correctif `tr.phone` de §3soixantequadragies ; Suivi ; Paiement ; Visa) ; `/admin/groupes/4` (GROUPE C, 3 membres) — tuile par membre ouvrant la modale combinée suivi+visa+lien fiche voyageur, et tuile "Paiement du groupe" fonctionnelle. `next build` réussi ; parse Babel/JSX sur tous les fichiers touchés/créés. Compte de test supprimé après vérification (confirmé par requête SQL directe).

## 3soixantedeuxquadragies. Remboursement (annulation, retour d'avance ou du montant total)

Demande explicite : dans la partie Paiement, pouvoir annuler un paiement / rembourser une avance ou le montant total, pour le cas d'un voyageur qui annule le voyage. Clarifié par deux questions avant implémentation :
1. **Modèle de données** : un remboursement est un **versement au montant négatif** dans la table `payments` existante (pas de nouvelle colonne `type`) — choix explicite de l'utilisateur, plus simple en base ; en contrepartie, l'UI doit systématiquement afficher la valeur absolue avec un habillage clair ("Remboursement"/rouge/signe "−") pour qu'un montant négatif ne soit jamais confondu avec une erreur de saisie.
2. **Disponibilité** : le bouton n'est **pas** limité aux inscriptions au statut "annulé" — toujours disponible, comme "Ajouter un paiement" aujourd'hui (couvre aussi un remboursement partiel sans annulation totale, ex. geste commercial, erreur de saisie).

### `PaymentsSection.jsx` — un même formulaire pour versement et remboursement

Le formulaire d'ajout gagne un `<select>` **Type** (Versement / Remboursement) devant le champ Montant — le personnel saisit toujours un montant **positif**, le signe est appliqué à la soumission (`type === "remboursement" ? -Math.abs(amount) : amount`) : pas de risque qu'un montant négatif soit tapé directement à l'envers par erreur. Bouton submit et libellé changent de couleur/texte selon le type (rouge "Enregistrer le remboursement" vs vert "Enregistrer le paiement").

- **Aide "Tout rembourser"** (couvre explicitement "le montant total" de la demande) : quand Type = Remboursement et qu'un montant a déjà été versé, un bouton "Tout rembourser ({total payé} MAD déjà payés)" pré-remplit le champ Montant avec le total déjà payé — évite au personnel de recalculer le cumul à la main pour un remboursement intégral. Un remboursement **partiel** (retour d'avance) reste à saisir manuellement, aucune restriction sur le montant tapé.
- **Aucun changement de calcul nécessaire** : `totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0)` sommait déjà tous les montants — un remboursement (négatif) s'y soustrait automatiquement, `balance = totalDue - totalPaid` remonte donc correctement. Nouvelle ligne `totalRefunded` (somme des montants négatifs, en valeur absolue) affichée sous "Payé" ("dont X MAD remboursés") uniquement si non nulle — purement informatif, ne change aucun calcul existant.
- **Liste des versements** : une ligne au montant négatif affiche un badge "Remboursement" (fond rouge clair) + le montant en rouge avec un signe "−" et sa valeur absolue (`Math.abs`) — jamais un nombre négatif brut affiché tel quel. "Reçu" et "Supprimer" fonctionnent à l'identique pour un remboursement (la suppression existante gère déjà n'importe quelle ligne de `payments`, aucun changement nécessaire).
- **`bare` (Modal)** : aucun changement, le composant reste utilisable dans `InscriptionManagerGrid.jsx`/`GroupManagerGrid.jsx` (§3soixanteetunquadragies) comme avant.

### Routes API — validation assouplie, pas retirée

`POST /api/admin/registrations/[id]/payments`, `.../groups/[id]/payments`, `.../visa-services/[id]/payments` : la vérification `Number(body.amount) <= 0` (qui rejetait tout montant négatif) devient `Number(body.amount) === 0` — seul un montant nul/manquant reste refusé, un montant négatif (remboursement) est désormais accepté. Message d'erreur mis à jour ("Le montant ne peut pas être nul"). Aucun autre changement de route : `createPayment`/`createGroupPayment`/`createVisaServicePayment` (`lib/payments.js`) insèrent déjà `data.amount` tel quel, sans validation de signe côté lib.

### Reçu PDF et page Finances — reconnus par le signe, pas une colonne

`lib/exporters/receiptPdf.js` : `isRefund = Number(payment.amount) < 0` pilote le titre ("REÇU DE REMBOURSEMENT" au lieu de "REÇU DE PAIEMENT"), l'intitulé de section ("Détail du remboursement") et le libellé du champ montant ("Montant remboursé", affiché en valeur absolue) — le reste du reçu (identité, programme/voyage, montant dû/payé à ce jour/solde) est inchangé, ces valeurs étant déjà correctement nettes du remboursement. `/admin/finances` (tableau "Paiements par période") reçoit le même traitement visuel que la liste de `PaymentsSection.jsx` (badge + signe + couleur rouge) pour ne pas y afficher un montant négatif brut sans explication.

### Vérification effectuée (avec connexion admin réelle)

Compte `direction` temporaire recréé pour tester en direct sur `/admin/inscriptions/24` (NOURA, 5700 MAD déjà versés) : sélection Type = Remboursement → clic "Tout rembourser (5700 MAD déjà payés)" → montant pré-rempli à 5700 → soumission réussie. Confirmé après coup : "Payé" passe à 0 MAD, "dont 5700 MAD remboursés" affiché, "Solde" repasse à 25700 MAD (montant dû intégral) ; la nouvelle ligne "Remboursement" apparaît en rouge avec "−5700 MAD", la ligne du versement d'origine reste inchangée à "5700 MAD" ; le lien "Reçu" du remboursement se télécharge sans erreur. ⚠️ Une erreur 500 FK (`recorded_by_staff_id`) rencontrée en cours de route s'est révélée être un artefact de la session de test (JWT référençant un ancien id de compte temporaire supprimé/recréé) — sans rapport avec cette fonctionnalité, résolu par une reconnexion. `next build` réussi ; parse Babel/JSX sur tous les fichiers touchés. Paiement de test et compte temporaire supprimés après vérification (confirmé par requête SQL directe), NOURA restaurée à son état d'origine (5700 MAD versés, aucun remboursement).

### Retour d'usage — "Remboursement" retiré tant qu'aucun montant n'est payé

Bug réel signalé par capture d'écran (inscription Wafae, en dehors de toute session de test) : rien n'empêchait de choisir "Remboursement" comme **premier** paiement d'une inscription — un remboursement de 5000 MAD sans aucun versement préalable donnait "Payé : -5000 MAD", un état sans rapport avec la réalité comptable (rien n'a jamais été payé, donc rien à rembourser).

- **`canRefund = totalPaid > 0`** (`PaymentsSection.jsx`) : l'option "Remboursement" est désormais **retirée** du `<select>` Type (pas seulement désactivée) tant que le total net déjà payé n'est pas strictement positif — couvre à la fois "aucun paiement enregistré" (demande explicite de l'utilisateur) et le cas plus large "déjà entièrement remboursé" (même risque de repasser en négatif)
- **`effectiveType`** : si le state `type` pointait encore vers "remboursement" alors que `canRefund` devient `false` entre-temps (ex. après un remboursement total qui ramène "Payé" à 0), tous les usages de `type` dans le rendu et `handleAdd` retombent sur "versement" — pas de state invalide affiché ni envoyé au serveur
- Cette ligne de données erronée (paiement id 14, inscription Wafae, `-5000.00`, `REC-2026-000014`) n'a **pas** été supprimée par ce correctif — l'utilisateur a choisi de la retirer lui-même depuis l'interface (bouton "Supprimer" déjà existant à côté de la ligne)
- **Vérification** : `next build` réussi ; parse Babel/JSX sur `PaymentsSection.jsx`

## 3soixantetroisquadragies. Cartes "Suivi de l'inscription" et "Paiement" fusionnées en "Hébergement et Paiement" ; Statut toujours modifiable et auto-actualisé

Demande explicite : regrouper les deux tuiles de `/admin/inscriptions/[id]` en une seule "Hébergement et Paiement", avec un ordre de champs précis — Tarif d'hébergement, Type de chambre demandé, Groupe/binôme, puis tous les champs Paiement, puis Statut (toujours modifiable, actualisé automatiquement selon le paiement effectué — partiel/complet/annulé si remboursement total), Notes tout en bas.

### `InscriptionManagerGrid.jsx` — une tuile au lieu de deux

Les tuiles "Suivi de l'inscription" et "Paiement" (§3soixanteetunquadragies) deviennent une seule tuile **"Hébergement et Paiement"** (sous-titre : `{montant dû} MAD dû · {statut}`) — inchangée pour une inscription groupée (toujours remplacée par la tuile-lien "Groupe", le suivi/paiement d'un groupe restant géré à part). La modale empile, dans l'ordre demandé : `EditRegistrationForm` (allégé, voir plus bas) → `GroupDueForm` + `PaymentsSection` (inchangés) → `StatusNotesForm` (nouveau).

### `EditRegistrationForm.jsx` — Tarif avant Type, Statut/Notes extractibles

- **Réordonné** : "Tarif d'hébergement" passe **avant** "Type de chambre souhaité" (inversé par rapport à l'ordre historique) — affecte aussi la modale par membre de `GroupManagerGrid.jsx` (même composant réutilisé), changement jugé sans risque puisqu'il ne fait qu'inverser deux champs déjà présents, aucune perte de fonctionnalité
- **Nouveau prop `showStatusAndNotes`** (défaut `true`, valeur historique — **inchangé** pour l'usage dans `GroupManagerGrid.jsx`) : à `false` (nouvelle carte fusionnée), les blocs Statut et Notes ne sont ni rendus ni inclus dans le payload de soumission — le reste (verrouillage Afficher/Modifier, Préférence d'hébergement, Groupe/binôme, Enregistrer/Supprimer) est **inchangé**

### `StatusNotesForm.jsx` (nouveau) — Statut "toujours modifiable"

Contrairement au reste de la carte (verrouillée par le cycle Afficher/Modifier, §3cinquantetroisquadragies), ce petit formulaire séparé n'a **aucun verrouillage** — demande explicite ("le champs Statut... doit être toujours modifiable"). Un `useEffect` resynchronise la valeur affichée du `<select>` Statut à chaque nouvelle valeur reçue du serveur (`status` en prop), pour refléter immédiatement un recalcul automatique survenu pendant que la modale reste ouverte (ex. après l'ajout d'un paiement dans la même modale, sans fermer/rouvrir) — une modification manuelle explicite via "Enregistrer" reste toujours possible et écrase la valeur auto-calculée. Notes rejoint ce même petit formulaire (positionné tout en bas, comme demandé), avec son propre cycle non verrouillé — payload envoyé : `{notes}` seul si `canEditStatus` est faux (rôle `suivi` par ex., cohérent avec la restriction fine déjà en place, §3undecies), `{status, notes}` sinon.

### Recalcul automatique du Statut — `lib/payments.js::recalculateRegistrationStatus`

Nouvelle fonction privée, appelée après chaque `createPayment`/`deletePayment` (inscription **individuelle uniquement** — un membre de groupe garde `status="inscrit"` à vie par design, voir §3trevicies/§3quindecies, aucun changement pour les groupes) :
- `total_refunded > 0 ET total_paid <= 0` → **`annule`** (remboursement total effectué, cas explicitement demandé)
- `total_due > 0 ET total_paid >= total_due` → **`paye_complet`**
- `total_paid > 0` (mais en dessous du dû) → **`paye_partiel`**
- sinon (aucun paiement n'a jamais eu lieu) → **aucun changement** — ne touche jamais un statut "inscrit"/"confirme" tant qu'aucun versement n'existe, pour ne pas écraser un statut de suivi commercial antérieur au premier paiement

Fonction pure vis-à-vis des totaux courants (pas un compteur incrémental) : un nouveau versement après un remboursement total repasse naturellement de `annule` à `paye_partiel`/`paye_complet` sans traitement spécial. Le recalcul écrit directement en base (`UPDATE registrations SET status = ?`), en dehors du système de permissions/restrictions par rôle de `updateRegistration` — c'est un événement système déclenché par un mouvement de paiement, pas une soumission utilisateur, donc les restrictions "suivi ne peut envoyer que visaStatus/notes" etc. ne s'y appliquent pas (comportement voulu).

### Vérification effectuée (avec connexion admin réelle)

Compte `direction` temporaire, testé sur `/admin/inscriptions/28` (Wafae, 7700 MAD déjà versés par un vrai compte réel, statut resté "inscrit" — confirmant que le recalcul ne s'applique que sur les nouveaux mouvements, pas rétroactivement sur les paiements déjà existants) :
- Ordre des champs confirmé visuellement (capture d'écran) : Tarif d'hébergement → Type de chambre souhaité → Groupe/binôme → Paiement (Montant dû/Payé/Solde/liste/formulaire) → Statut → Notes
- Ajout d'un versement de 2000 MAD → tuile et `<select>` Statut passent automatiquement à **paye_partiel** (9700/17700 MAD), sans fermer la modale (confirmé par lecture directe du DOM du `<select>`, pas seulement du texte affiché)
- "Tout rembourser (9700 MAD déjà payés)" → remboursement total → tuile et Statut passent automatiquement à **annule**
- `next build` réussi ; parse Babel/JSX sur tous les fichiers touchés/créés. Paiements de test (2 lignes) supprimés après vérification, statut restauré à "inscrit", compte temporaire supprimé — confirmé par requête SQL directe. Le paiement réel préexistant (7700 MAD, saisi par un vrai compte) n'a pas été touché

## 3soixantequatrequadragies. Genre affiché par voyageur dans le tableau "Chambres", pas seulement agrégé

Capture d'écran à l'appui : la colonne "Voyageurs" du tableau "Chambres" (`/admin/voyages/[tripId]/hebergement`) ne listait que les noms des occupants, le genre n'apparaissant qu'agrégé une seule fois dans la colonne "Genre" (`r.occupants_gender`, `GROUP_CONCAT(DISTINCT ...)`, §3quindecies) — pour une chambre à plusieurs occupants (ex. un groupe couple/famille à 3 personnes), impossible de savoir individuellement qui est de quel genre sans deviner.

- **`HebergementManager.jsx`** : chaque occupant de la liste "Voyageurs" affiche désormais son propre genre entre parenthèses — `{o.full_name} ({o.gender})` — même format que la liste "Voyageurs non affectés" juste en dessous, qui l'affichait déjà ainsi par voyageur. `o.gender` était déjà sélectionné par `listAssignedRegistrationsForTrip` (`lib/roomAssignment.js`), aucun changement de requête nécessaire
- **Colonne "Genre" agrégée conservée** (pas retirée) : reste utile comme repère rapide de la composition d'une chambre en un coup d'œil (mixte ou non) sans avoir à lire chaque nom — les deux affichages sont désormais complémentaires plutôt que redondants
- **Vérification en conditions réelles** (avec connexion admin réelle, lecture seule — aucune donnée modifiée) : `/admin/voyages/1/hebergement`, chambre MARKAZIA 301 (groupe "GROUPE C", 3 occupants homme) confirmée affichant "C1 (Homme)", "C2 (Homme)", "C3 (Homme)" individuellement ; chambres mixtes de la même page (KARAOUAN BLAZA 333 "NOURA (Femme)", MARKAZIA 401 "Wafae (Femme)") confirmées correctement affichées aux côtés des chambres à occupants homme. `next build` réussi ; parse Babel/JSX. Compte temporaire supprimé après vérification

## 3soixantecinququadragies. Colonne "Genre" remplacée par "Responsable" dans le tableau "Chambres" (migration `027_add_group_responsible.sql`)

Demande explicite : dans le tableau "Chambres" de `/admin/voyages/[tripId]/hebergement`, remplacer la colonne "Genre" (agrégée) par une colonne "Responsable" affichant le nom du voyageur désigné responsable du groupe/binôme — un voyageur seul étant responsable de lui-même par simple règle d'affichage. Nouveau concept, absent du schéma jusqu'ici — clarifié par deux questions avant implémentation (modèle de données, désignation/modification).

### Schéma — `registration_groups.responsible_registration_id`

Nouvelle colonne (nullable, FK vers `registrations(id)`, `ON DELETE SET NULL`) — un seul responsable désigné par groupe, pas de champ équivalent sur `registrations` (un voyageur seul n'a besoin d'aucune donnée supplémentaire). Référence en avant vers `registrations` (définie plus bas dans `schema.sql`) : valide car `FOREIGN_KEY_CHECKS=0` couvre tout le bloc de création des tables — confirmé en amont plutôt que supposé, après la leçon des sections précédentes sur l'ordre des tables. Migration avec rétro-remplissage : le premier membre inscrit (id le plus bas) de chaque groupe déjà existant devient responsable par défaut, même règle qu'à la création.

### `lib/registrationGroups.js` — désignation automatique + réattribution

- **`ensureGroupResponsible(groupId)`** (nouveau, idempotent) : ne fait rien si le responsable actuel est toujours membre du groupe ; sinon retombe sur le membre restant le plus ancien (id le plus bas), ou `NULL` si le groupe est vide. Appelée après **tout** événement qui change la composition d'un groupe :
  - `createRegistration` (`lib/registrations.js`) — après le commit, aux côtés de `recalculateGroupTotalDue` : le **premier** membre inséré devient responsable (les suivants ne l'écrasent jamais, grâce à l'idempotence)
  - `updateRegistration` — dans le même bloc `groupsToRecalculate` déjà utilisé pour le montant dû, uniquement quand `data.groupId !== undefined` (un membre qui quitte/rejoint un groupe) : réattribue l'ancien groupe si son responsable vient de partir
  - `deleteRegistration` — la FK `ON DELETE SET NULL` a déjà nettoyé la colonne si le membre supprimé était responsable ; `ensureGroupResponsible` réattribue alors un remplaçant plutôt que de laisser le groupe sans point de contact
- **`updateGroupResponsible(groupId, responsibleRegistrationId)`** (nouveau) : désignation manuelle explicite, utilisée par la nouvelle route `PUT /api/admin/groups/[id]/responsible` (permission `inscriptions.edit`, même contrôle que la création/modification d'un groupe — vérifie côté serveur que la personne choisie est bien un membre actuel avant d'accepter)
- **`getGroupById`** gagne `responsible_full_name` (jointure `registrations`/`travelers` sur `responsible_registration_id`) pour l'affichage

### `GroupResponsibleForm.jsx` (nouveau) — modifiable depuis la page du groupe

Petit `<select>` (parmi les membres actuels + option "Aucun"), affiché sous "Membres du groupe (N)" dans `GroupManagerGrid.jsx`, uniquement si le groupe a au moins un membre. Change immédiatement au `onChange` (pas de bouton "Enregistrer" séparé, cohérent avec la simplicité de ce réglage ponctuel) ; gated par le même rôle que les autres champs de gestion de groupe (`direction`/`ventes`).

### `lib/roomAssignment.js::listRoomsForTrip` — nouvel agrégat, `occupants_gender` conservé

⚠️ **Piège évité avant d'écrire le code** : `occupants_gender` (l'agrégat Genre existant) n'est **pas** qu'un affichage — il pilote aussi la logique de non-mixité (`isRoomCompatible` dans `HebergementManager.jsx`, ligne `otherGenderPresent = room.occupants_gender...`). Remplacer purement et simplement la colonne SQL aurait cassé cette vérification. La requête gagne donc un **second** agrégat, `occupants_responsible`, en plus de `occupants_gender` (inchangé) :
```sql
GROUP_CONCAT(DISTINCT COALESCE(resp_tr.full_name, tr.full_name)
  ORDER BY COALESCE(resp_tr.full_name, tr.full_name) SEPARATOR ' + ') AS occupants_responsible
```
`COALESCE(resp_tr.full_name, tr.full_name)` : si l'occupant appartient à un groupe (`rg.responsible_registration_id` résolu via une jointure supplémentaire `registration_groups`/`registrations`/`travelers`), affiche le nom du responsable du groupe ; sinon (voyageur seul, `rg` est `NULL` via le `LEFT JOIN`) retombe naturellement sur son propre nom — aucune condition explicite nécessaire, le `COALESCE` suffit. `GROUP_CONCAT(DISTINCT ...)` déduplique : une chambre occupée par un seul groupe affiche un seul nom (le responsable), pas répété une fois par occupant.

### `HebergementManager.jsx`

En-tête de colonne "Genre" → "Responsable" ; cellule `{r.occupants_gender || "—"}` → `{r.occupants_responsible || "—"}` (classe `capitalize` retirée, un nom propre n'a pas besoin de cette transformation CSS). Seul ce point d'affichage change — `isRoomCompatible` continue de lire `room.occupants_gender`, intact.

### Vérification effectuée (avec connexion admin réelle + script Node réel)

- **Navigateur** (compte `direction` temporaire) : `/admin/voyages/1/hebergement` — chambre MARKAZIA 301 (GROUPE C, 3 membres homme) affiche "C1" (un seul nom, pas répété 3 fois) ; chambre MARKAZIA 501 (5 occupants : groupe B + un voyageur seul) affiche "B1 + IHBOUS YASSINE" (le responsable du groupe B, dédupliqué, **et** le nom du voyageur seul) — confirme `COALESCE`/`GROUP_CONCAT DISTINCT` corrects dans le cas mixte groupe+solo. `/admin/groupes/4` : `<select>` Responsable pré-rempli sur "C1", changé vers "C2" → confirmé par requête SQL directe (`responsible_registration_id` mis à jour) et répercuté immédiatement sur les DEUX chambres où GROUPE C apparaît (MARKAZIA 301 et MAATABBA 302). Restauré à "C1" après vérification (donnée réelle)
- **Script Node réel** (vraies fonctions JS, pas une simulation SQL — même méthode que §3soixantequadragies) sur un groupe de test isolé : premier membre inséré → devient responsable ; deuxième membre → ne l'écrase pas ; responsable qui quitte le groupe (`updateRegistration groupId:null`) → réattribution automatique à un membre restant ; suppression du nouveau responsable → réattribution au dernier membre restant ; suppression du dernier membre → groupe vide retombe à `responsible_registration_id: null`. Les 4 scénarios produisent exactement les résultats attendus
- `next build` réussi ; parse Babel/JSX sur tous les fichiers touchés/créés. Toutes les données de test nettoyées après vérification (confirmé par requête SQL directe) ; compte temporaire supprimé

## 3soixantesixquadragies. Page groupe : deux tuiles par membre ("Hébergement et Paiement", "Visa") au lieu d'une seule combinée

Demande explicite : sur `/admin/groupes/[id]`, afficher les mêmes cartes que sur la fiche individuelle non groupée (§3soixantetroisquadragies) — "Hébergement et Paiement" et "Visa" — au lieu de la tuile unique par membre (nommée d'après son nom) qui combinait tout dans une seule modale.

### `GroupManagerGrid.jsx` — restructuré

Chaque membre est désormais un petit encart (nom + genre + lien "Fiche voyageur (passeport) →", repris de l'ancien emplacement) contenant **deux tuiles** :
- **"Hébergement et Paiement"** (sous-titre : statut) → modale combinant `EditRegistrationForm` (statut/préférence hébergement/tarif/groupe-binôme/notes, **inchangé**, toujours verrouillé par le cycle Afficher/Modifier existant) **et**, en dessous, le montant dû partagé (`GroupDueForm`) + l'historique des versements (`PaymentsSection`, `bare`) — même contenu que la tuile "Paiement du groupe" déjà existante, désormais **aussi** accessible depuis la carte de chaque membre pour éviter d'avoir à chercher la tuile séparée
- **"Visa"** (sous-titre : statut visa) → `VisaStatusForm` seul, extrait de l'ancienne modale combinée

La tuile **"Paiement du groupe"** partagée (en dehors de la liste des membres) est **conservée telle quelle** — un second point d'entrée vers les mêmes données de paiement, pas une duplication de logique (même `GroupDueForm`/`PaymentsSection`, mêmes props). Rien d'autre ne change : verrouillage, permissions par rôle, recalcul automatique du montant dû du groupe (§3cinquanteneufquadragies), tout est réutilisé sans modification.

### Vérification effectuée (avec connexion admin réelle)

Compte `direction` temporaire, `/admin/groupes/4` (GROUPE C, 3 membres) : les 3 membres affichent chacun leurs 2 tuiles distinctes ; "Hébergement et Paiement — C1" ouvre bien le statut/préférence/groupe de C1 **et** le montant dû/historique partagé du groupe (56100 MAD, versement existant visible) ; "Visa" ouvre le statut visa de C1 seul, avec rappel passeport. `next build` réussi ; parse Babel/JSX. Compte temporaire supprimé après vérification, aucune donnée modifiée (vérification en lecture/ouverture de modales uniquement)

## 3soixantesetquadragies. Tableau "Prochains départs" (tableau de bord) : référence retirée, arrivée/aéroports/paiement ajoutés

Demande explicite sur `/admin` (Tableau de bord), tableau "Prochains départs" : retirer la colonne "Référence", ajouter la date d'arrivée, l'aéroport de départ et d'arrivée, et le nombre de "Payé partiel"/"Payé complet" par voyage.

- **`getDashboardStats()`** (`lib/registrations.js`) : la requête `upcomingTrips` gagne `t.return_date` (date d'arrivée — retour du voyage), `t.origin_iata`/`t.destination_iata` (aéroports), et deux agrégats `COUNT(CASE WHEN r.status = 'paye_partiel'/'paye_complet' THEN 1 END)` — basés sur le même `LEFT JOIN registrations` déjà filtré `status != 'annule'` que `registered_count`, aucun risque de fan-out (un seul JOIN)
- **`app/admin/page.js`** : colonne "Référence" supprimée ; nouvelles colonnes "Arrivée" (`return_date`, "—" si absente), "Aéroport" (`{origin_iata} → {destination_iata}`, "—" si les deux absents), "Payé partiel"/"Payé complet" (compteurs cliquables, liens vers `/admin/inscriptions?tripId=X&status=paye_partiel`/`paye_complet` — `listRegistrations` acceptait déjà `tripId`+`status` combinés, aucun changement de route nécessaire)
- **Vérification en conditions réelles** (compte `direction` temporaire) : `/admin` affiche bien "25/11/2026 · 09/12/2026 · RAK → MED · 11/40 · 2 · 9" pour OMRA 25 NOV — les compteurs 2/9 correspondent exactement aux cartes "Payé partiel"/"Payé complet" du haut de la même page. `next build` réussi ; parse Babel/JSX. Compte temporaire supprimé après vérification, aucune donnée modifiée

## 3soixantehuitquadragies. Page groupe, réajustée : "Informations Voyageurs" et "Visa" par voyageur, "Hébergement et Paiement" UNIQUE pour tout le groupe

Retour immédiat sur §3soixantesixquadragies : la tuile "Hébergement et Paiement" dupliquée une fois par membre créait 3 modales quasi-identiques pointant vers le même montant dû/historique partagé — demande explicite de corriger : "Informations Voyageurs" et "Visa" restent par voyageur (une tuile chacune, par membre), mais "Hébergement et Paiement" redevient une tuile **unique** pour tout le groupe.

### `GroupManagerGrid.jsx` — troisième itération

- Par membre : **"Informations Voyageurs"** (nouveau, remplace le lien "Fiche voyageur (passeport) →" qui faisait sortir de la page — ouvre désormais `EditTravelerForm` directement dans une modale, exactement comme sur la fiche individuelle) et **"Visa"** (inchangé)
- Une seule tuile **"Hébergement et Paiement"** (sous-titre : montant dû du groupe) — sa modale liste, l'un après l'autre, le `EditRegistrationForm` (statut/tarif/type/groupe-binôme/notes) de **chaque** membre, chacun sous un encart avec son nom, suivi du montant dû partagé (`GroupDueForm`) et de l'historique des versements/remboursements (`PaymentsSection`, `bare`) — reprend exactement le contenu qui vivait avant dans 3 tuiles séparées, mais en une seule tuile/modale

### `lib/registrationGroups.js::getGroupMembers` — étendu pour porter "Informations Voyageurs"

Gagne `r.traveler_id, tr.full_name_arabic, tr.date_of_birth, tr.national_id, tr.phone, tr.email AS traveler_email, tr.address` — tout ce dont `EditTravelerForm.jsx` a besoin, en plus des champs déjà là. `app/admin/groupes/[id]/page.js` enrichit ensuite chaque membre avec `departure_date` (repris du groupe — tous les membres partagent le même voyage, nécessaire pour la validation passeport ≥ 6 mois) et `phoneNumbers` (`listPhoneNumbersForTraveler(member.traveler_id)`, un appel par membre) avant de transmettre à `GroupManagerGrid`.

### Vérification effectuée (avec connexion admin réelle)

`/admin/groupes/4` (GROUPE C, 3 membres) : chaque membre affiche ses 2 tuiles "Informations Voyageurs"/"Visa" ; "Informations Voyageurs — C1" ouvre le formulaire complet (nom, passeport, téléphones...) directement en modale ; la tuile unique "Hébergement et Paiement" ouvre une modale listant C1, C2 et C3 chacun avec leurs propres champs, suivis du montant dû partagé (56100 MAD) et de l'historique des versements (un seul, visible une seule fois, pas triplé). `next build` réussi ; parse Babel/JSX. Compte temporaire supprimé après vérification, aucune donnée modifiée

## 3soixanteneufquadragies. Tableau de bord : section "Services" (compteurs par statut du service visa)

Demande explicite : sur `/admin`, garder la partie "Prochains départs" telle quelle et insérer une **deuxième partie** listant, pour chaque service (le service visa autonome §3sedecies pour l'instant, d'autres pourront suivre le même schéma), des compteurs par statut — chaque partie visuellement cadrée (encart bordé) comme "Prochains départs".

- **`lib/visaServices.js`** : `listVisaServiceRequests()` accepte désormais un filtre optionnel `{status}` (`WHERE vsr.status = ?`) ; nouvelle `getVisaServiceStats()` (compteurs `GROUP BY status`, même principe que `statusCounts` de `getDashboardStats()` pour les inscriptions)
- **`app/admin/visa-services/page.js`** : lit `searchParams.status`, filtre la liste et affiche un indicateur "Filtré par statut : ... — réinitialiser" (même pattern que `/admin/inscriptions`)
- **`app/admin/page.js`** : nouvelle section "Services" sous "Prochains départs", avec une carte cadrée "Service visa" (4 tuiles cliquables Non demandé/En cours/Accordé/Refusé, chacune vers `/admin/visa-services?status=X`) — structure pensée pour accueillir une carte par futur service, pas seulement le visa
- **Vérification en conditions réelles** (compte `direction` temporaire) : `/admin` affiche la carte "Service visa" (1 "Non demandé") ; clic sur la tuile → `/admin/visa-services?status=non_demande` affiche bien uniquement la demande correspondante avec le lien "réinitialiser". `next build` réussi. Compte temporaire supprimé après vérification, aucune donnée modifiée

## 3soixantedixquadragies. Finances : "Par programme" retiré (redondant avec "Par voyage"), section "Services" ajoutée

Demande explicite : `/admin/finances` retire la section "Par programme" (la plupart des programmes n'ayant qu'un seul voyage, §3novotrigies "primaryTrip", elle faisait doublon avec "Par voyage") et gagne une section "Services" (même principe qu'au tableau de bord, §3soixanteneufquadragies) ; "Paiements par période" doit aussi refléter les services.

- **`lib/payments.js`** : `getFinancialSummaryByProgram()` **supprimée** (plus aucun appelant après son retrait de la page) — pas seulement masquée
- **`app/admin/finances/page.js`** : section "Par programme" remplacée par "Services" → sous-carte "Service visa" listant chaque demande (`listVisaServiceRequests()`, déjà pourvue de `total_due`/`total_paid` par une sous-requête, réutilisée telle quelle) avec Client/Type de visa/Dû/Payé/Solde, solde en rouge si positif (même convention que "Par voyage") ; lien client vers `/admin/visa-services/[id]`
- **"Paiements par période" : déjà conforme, aucun changement nécessaire** — `getPaymentsByPeriod()` incluait déjà une 3ᵉ branche `UNION ALL` sur `visa_service_requests` depuis §3sedecies (`'Service visa'` en guise de programme) ; confirmé en direct que les versements de service visa y apparaissent bien aux côtés des paiements de voyage
- **Vérification en conditions réelles** (compte `direction` temporaire) : `/admin/finances` — "Par programme" absent, section "Services"/"Service visa" affiche BAHA NOURA (2200 MAD dû, 2200 MAD payé, 0 MAD solde) ; "Paiements par période" liste bien "Service visa — Visa Omra" (28/09/2026, REC-2026-000020) aux côtés des paiements de voyage. `next build` réussi. Compte temporaire supprimé après vérification, aucune donnée modifiée

## 3soixanteonzequadragies. Totaux de `/admin/finances` réservés à direction/comptabilité

Demande explicite, suite directe de §3soixantedixquadragies : chacune des 3 parties ("Par voyage", "Service visa", "Paiements par période") gagne une ligne **Total** en bas (déjà présente uniquement sur "Paiements par période" jusqu'ici) — mais ces totaux (sommes agrégées) ne doivent être visibles **que** pour les rôles `direction`/`comptabilite`, jamais pour un rôle qui obtiendrait `finances.view` sans être l'un des deux.

- **`app/admin/finances/page.js`** : `canViewTotals = ["direction", "comptabilite"].includes(session?.role)` — restriction fine par rôle brut, même pattern déjà établi ailleurs dans le projet (§3undecies, "Exception assumée : restrictions fines par champ") plutôt qu'une nouvelle permission dédiée (la page reste par ailleurs gardée par `finances.view` pour l'accès au détail ligne par ligne, inchangé)
- Nouveaux `<tfoot>` sur "Par voyage" (Dû/Payé/Solde sommés sur `byTrip`) et "Service visa" (Dû/Payé/Solde sommés sur `visaServiceRequests`), même style que celui déjà existant sur "Paiements par période" — les 3 `<tfoot>` sont désormais conditionnés par `canViewTotals && <table non vide>`
- Le `<tfoot>` de "Paiements par période" (déjà existant) gagne la même condition `canViewTotals` — auparavant visible par quiconque accédait à la page
- **Détail ligne par ligne non affecté** : un rôle avec `finances.view` mais sans être `direction`/`comptabilite` voit toujours chaque ligne (voyage, demande de service visa, paiement individuel) — seule la somme agrégée en bas de tableau disparaît
- **Vérifié en conditions réelles avec deux comptes temporaires** : compte `direction` → les 3 totaux s'affichent (Par voyage : 203700/205100/-1400 MAD ; Service visa : 2200/2200/0 MAD ; Paiements par période : 207300 MAD) ; `finances.view` accordé temporairement au rôle `ventes` (normalement sans accès à `/admin/finances`) + compte `ventes` de test → les 3 tableaux affichent bien le même détail ligne par ligne mais **aucune** ligne "Total" nulle part sur la page. Permission temporaire et les deux comptes de test supprimés après vérification (confirmé par requête SQL directe). `next build` réussi

## 3soixantedouzequadragies. Carte programme publique (`HomeShowcaseCard.jsx`) : mention "à partir de", villes de départ/arrivée en toutes lettres

Demande explicite, à partir d'une capture d'écran d'une carte Omra & Hajj (accueil + `/omra-hajj`) : le prix affiché ("0.00 MAD") n'avait pas la mention "à partir de" (déjà présente côté carte voyage organisé, mais pas côté Omra/Hajj) ; le bas de carte n'affichait que le code IATA de départ ("Départ RAK") sans ville d'arrivée.

- **`lib/programs.js`** : `getProgramsByFamily`/`getProgramsByDepartureCity` sélectionnent désormais aussi `nt.destination_iata`/`nt.destination_city` (déjà en base, §3novotrigies/§3septvicies) en plus de `nt.origin_iata`/`nt.destination_country` déjà présents — nécessaire pour résoudre la ville d'arrivée côté carte
- **`app/_components/HomeShowcaseCard.jsx`** :
  - Badge prix (branche Omra/Hajj) : petite mention "à partir de" ajoutée au-dessus du montant, même traitement que la branche voyage organisé (qui l'avait déjà)
  - Bas de carte (branche Omra/Hajj) : "Départ {IATA}" remplacé par "{ville de départ} → {ville d'arrivée}" en toutes lettres — ville de départ résolue via `getCityByIata` (`lib/airports.js`, référence des 8 aéroports marocains) ; ville d'arrivée résolue par priorité : `destination_city` (texte libre, §3novotrigies) sinon `findAirportByIata` (`lib/airportsReference.js`, §3septtrigies, référence internationale) sinon repli sur le code IATA brut si aucune des deux ne reconnaît l'aéroport
  - Branche voyage organisé (pays de destination affiché en badge sur l'image, pas de code aéroport) : **non touchée**, hors périmètre de la capture fournie
- **Vérification en direct** (site public, sans connexion) : `/` et `/omra-hajj` — la carte OMRA 25 NOV affiche "À PARTIR DE / 0.00 MAD" et "Marrakech → Madina" (voyage réel : `origin_iata=RAK`, `destination_city="Madina"` déjà renseigné). `next build` réussi

## 3soixantetreizequadragies. Bug corrigé : prix de la carte publique (0.00 MAD) incohérent avec la fiche programme (tarifs d'hébergement Omra/Hajj)

Signalé par capture d'écran + lien : la carte OMRA 25 NOV affichait "0.00 MAD" (§3soixantedouzequadragies) alors que `/omra-hajj/omra-25-nov` affiche "à partir de 15700 MAD" pour le même voyage — divergence entre deux calculs du même prix. C'est précisément la limitation déjà identifiée (mais laissée hors périmètre) en §3unquadragies : *"Les deux autres fonctions utilisant `LEAST(...)` (`getProgramsByFamily`/`getProgramsByDepartureCity`) ont la même limitation latente pour un programme à tiers... à corriger dans une session dédiée si un jour un programme à tiers apparaît dans ces listes avec un prix incohérent"* — ce jour est arrivé (OMRA 25 NOV a des tarifs d'hébergement configurés, §3unquadragies, et ses colonnes `price_double`/etc. dépréciées sont à 0).

**Cause racine** : la sous-requête `starting_price` de `getProgramsByFamily`/`getProgramsByDepartureCity` (`lib/programs.js`) calculait `LEAST(price_double, price_triple, price_quadruple, price_quintuple, COALESCE(tier_min.min_price, price_double))` — le prix du tarif était **fondu dans le même `LEAST()`** que les colonnes dépréciées, qui valent `0` pour un voyage entièrement passé aux tarifs par hôtel. `LEAST()` retombe donc systématiquement sur `0`, quel que soit le prix réel du tarif le plus bas. `getOpenTripsForProgram` (utilisée par la fiche programme, `ProgramDetail.jsx`) ne fait pas cette erreur : elle calcule d'abord `LEAST(price_double, ...)`, puis **remplace** ce résultat par le prix du tarif s'il existe (`COALESCE(tier_min.min_price, LEAST(...))` — le tarif prioritaire, pas mélangé dedans) — d'où l'écart entre la carte et la fiche.

- **Fix** : les deux sous-requêtes de `lib/programs.js` reprennent exactement la même forme que `getOpenTripsForProgram` — `COALESCE(tier_min.min_price, LEAST(t2.price_double, t2.price_triple, t2.price_quadruple, t2.price_quintuple))` au lieu de fondre le tarif dans le `LEAST()`
- **Portée** : corrige simultanément les 3 points d'entrée qui utilisaient `getProgramsByFamily`/`getProgramsByDepartureCity` — accueil (`/`), hubs (`/omra-hajj`, `/voyages-organises`) et pages pSEO (`/villes-depart/[ville]`) — sans toucher `getOpenTripsForProgram`/`ProgramDetail.jsx`, déjà correct
- **Vérification en direct** (site public, sans connexion) : `/`, `/omra-hajj` et `/villes-depart/marrakech` affichent désormais tous "À PARTIR DE / 15700.00 MAD" pour OMRA 25 NOV, identique à `/omra-hajj/omra-25-nov`. `next build` réussi

## 3soixantequatorzequadragies. Liste d'hébergement par programme (`/admin/voyages/[tripId]/listes`)

Demande explicite : ajouter, en **première** position sur la page des listes intelligentes (avant "Liste complète des voyageurs"), une liste d'hébergement — une ligne par ville, **Makka en premier puis Madina** en deuxième ligne (ordre fixe demandé, indépendant des dates réelles du séjour — pour ce voyage de test, Madina est en réalité visitée en premier chronologiquement, §3sextrigies, mais l'ordre Makka→Madina reste celui voulu ici).

- **`lib/listGenerators.js`** : nouvelle `getHebergementByCityList(tripId)` — regroupe `trip_hotels`/`hotels` par ville (`GROUP_CONCAT` des hôtels de la ville, `MIN`/`MAX` des dates de check-in/check-out, comptage des chambres et des voyageurs affectés via `registration_room_assignments`, §3cinquantecinququadragies, en excluant les inscriptions annulées) ; `ORDER BY CASE WHEN city = 'Makka' THEN 0 WHEN city = 'Madina' THEN 1 ELSE 2 END` — toute autre ville (escale-séjour type Istanbul, §3septtrigies) suit par ordre alphabétique. Plusieurs hôtels d'une même ville (§3cinquantequatrequadragies) sont fusionnés sur une seule ligne, conformément à la demande ("hébergement de makka" = une ligne, pas une par hôtel)
- **`HEBERGEMENT_LIST_COLUMNS`** : Ville, Hôtel(s), Check-in, Check-out, Chambres, Voyageurs — même structure `{key, header}` que les 3 listes existantes (`TRAVELER_LIST_COLUMNS`/`VISA_LIST_COLUMNS`), consommée sans changement par les exporters génériques déjà en place (`lib/exporters/excel.js`/`pdf.js`)
- **`app/api/admin/trips/[tripId]/lists/hebergement/route.js`** (nouveau) : mirroir exact de la route `.../lists/travelers` (même contrôle de session, mêmes formats `xlsx`/`pdf`)
- **`app/admin/voyages/[tripId]/listes/page.js`** : nouvelle section "Liste d'hébergement par programme", positionnée en premier (avant "Liste complète des voyageurs"), mêmes boutons de téléchargement que les 3 sections existantes
- **Vérification en conditions réelles** (compte `direction` temporaire) : `/admin/voyages/1/listes` — la section apparaît bien en tête de page ; téléchargement Excel réussi (200 OK, fichier non vide) ; requête SQL identique exécutée directement contre la vraie base confirme 2 lignes exactement — Makka (ABRAJ TAYSSIR, ANJOUM, MAATABBA · 28/11→08/12 · 10 chambres · 11 voyageurs) puis Madina (KARAOUAN BLAZA, MARKAZIA · 24/11→27/11 · 7 chambres · 11 voyageurs). `next build` réussi. Compte temporaire supprimé après vérification, aucune donnée modifiée

## 3soixantequinzequadragies. Liste d'hébergement : contenu affiné (retour immédiat sur §3soixantequatorzequadragies)

Retour explicite juste après §3soixantequatorzequadragies : le résumé agrégé par ville (une ligne = une ville) ne suffisait pas — demande de contenu précis : (1) le nom du programme, (2) les dates de départ/retour et le nom des aéroports **en tête de liste**, et dans le **tableau** une répartition **par chambre**, avec pour chaque chambre le **groupe** et les **personnes** qui l'occupent.

### Grain de la table : une ligne par CHAMBRE (plus par ville)

- **`lib/listGenerators.js`** : `getHebergementByCityList` remplacée par **`getHebergementDistributionList(tripId)`** — repart de `rooms`/`trip_hotels`/`hotels` (comme `listRoomsForTrip`, `lib/roomAssignment.js`) plutôt que d'agréger par ville. Une ligne par chambre : `city`, `hotel_name`, `room_number`, `group_label` (`GROUP_CONCAT(DISTINCT rg.label)` via `registration_room_assignments` → `registrations` → `registration_groups`, vide si voyageur(s) seul(s)), `occupants` (`GROUP_CONCAT(DISTINCT tr.full_name)`) — les inscriptions annulées sont exclues, une chambre vide affiche des colonnes Groupe/Voyageur(s) vides plutôt qu'une ligne absente (utile pour voir la capacité non utilisée)
- Tri inchangé : Makka puis Madina puis autre ville par ordre alphabétique (§3soixantequatorzequadragies), puis hôtel, puis numéro de chambre
- **`HEBERGEMENT_LIST_COLUMNS`** : Ville, Hôtel, Chambre, Groupe, Voyageur(s) — remplace Ville/Hôtel(s)/Check-in/Check-out/Chambres/Voyageurs (agrégats retirés, plus nécessaires à ce grain)

### Lignes d'information en tête de liste — nouveau support générique dans les exporters

Les 3 exporters existants (voyageurs/visa/compagnie) n'affichaient qu'un titre + un tableau, rien entre les deux. Ajout d'un paramètre optionnel **`infoLines`** (tableau de chaînes), à défaut vide (`[]`) — **comportement strictement inchangé pour les 3 listes existantes**, qui ne le passent pas :
- **`lib/exporters/excel.js`** : `buildExcelBuffer` n'utilise plus le mécanisme `sheet.columns = [...]` (qui écrit automatiquement les en-têtes en ligne 1, incompatible avec des lignes d'info avant le tableau) — largeurs de colonnes posées directement via `sheet.getColumn(i+1).width`, lignes ajoutées une à une (`infoLines`, ligne vide, ligne d'en-tête en gras, puis les données) — rendu identique à avant quand `infoLines` est vide (l'en-tête reste la ligne 1)
- **`lib/exporters/pdf.js`** : `buildPdfBuffer` insère les `infoLines` (police 10, normale) entre le titre et le tableau si non vide, sinon rien ne change
- **`app/api/admin/trips/[tripId]/lists/hebergement/route.js`** : construit `infoLines` = `["Programme : ...", "Dates : {départ} → {retour}", "Aéroport de départ : ...", "Aéroport d'arrivée : ..."]` — noms d'aéroport résolus par la même logique que la carte publique (§3soixantedouzequadragies) : `findAirportByIata` (`lib/airportsReference.js`, référence internationale) en priorité, repli sur `getCityByIata` (`lib/airports.js`, ville marocaine seule), repli final sur le code IATA brut
- **`getTripSummary`** (`lib/roomAssignment.js`) gagne `t.origin_iata, t.destination_iata` (ajout additif, tous les appelants existants — hébergement, tiers, hôtels, les 3 autres listes — vérifiés non affectés par un `SELECT` élargi)

### Vérification effectuée

- **Requête room-level exécutée directement contre la vraie base** (voyage réel OMRA 25 NOV) : 17 lignes (10 Makka + 7 Madina), groupe correctement rempli pour les chambres de groupe ("B" → B1-B4+IHBOUS YASSINE ; "GROUPE C" → C1-C3, répétée à Makka et Madina puisque le groupe a une chambre dans chaque ville) et vide pour les chambres solo/vides
- **En conditions réelles** (compte `direction` temporaire) : téléchargement Excel de la nouvelle liste (200 OK, 7294 octets, taille cohérente avec le contenu enrichi) ; les 3 exports existants (voyageurs/visa/compagnie) re-testés en parallèle, toujours 200 OK, tailles inchangées — confirme la non-régression de la signature étendue des exporters
- `next build` réussi. Compte temporaire supprimé après vérification, aucune donnée modifiée

## 3soixanteseizequadragies. PDF de la liste d'hébergement : une page par ville (portrait), en-tête/pied de page, colonne "Packs" (migration nécessaire uniquement côté code, aucun schéma)

Demande explicite, avec un exemple de rendu fourni (capture d'écran d'une carte programme + PDF existant en pièce jointe) : le bouton "Télécharger PDF" de la liste d'hébergement (§3soixantequinzequadragies) doit produire un PDF **multi-page, une page par ville** (Makka puis Madina), **format portrait**, avec un **en-tête** (infos du programme + **nom de la ville en grand et en gras**), un **pied de page** (pagination, lien vers la fiche programme publique, nom de l'agence), et un tableau avec **Hôtel, Packs (nom du tarif), N° Chambre, Groupe, Voyageur(s)**.

### `lib/listGenerators.js` — colonne "Packs"

`getHebergementDistributionList` gagne un `LEFT JOIN trip_hotel_tiers tht ON tht.id = reg.selected_tier_id` et `GROUP_CONCAT(DISTINCT tht.label ...) AS pack_label` — le nom du tarif d'hébergement (§3unquadragies, "Économique"/"Standard"/"VIP"...) choisi par les occupants de la chambre, même agrégation que `group_label`/`occupants`. `HEBERGEMENT_LIST_COLUMNS` (Excel, resté un tableau plat) gagne la colonne "Packs" entre Hôtel et N° Chambre ; l'en-tête "Chambre" devient "N° Chambre" pour lever toute ambiguïté avec un éventuel compte de chambres.

### `lib/exporters/hebergementPdf.js` (nouveau) — exporteur dédié, pas une extension du générique

`buildPdfBuffer` (`lib/exporters/pdf.js`, partagé par les listes voyageurs/visa/compagnie) reste **inchangé au-delà de l'ajout `infoLines`** déjà fait en §3soixantequinzequadragies — la mise en page ici (pagination par ville, en-tête/pied répétés, portrait) est trop spécifique pour rester générique sans complexifier les 3 autres listes. `buildHebergementPdfBuffer({ trip, originLabel, destinationLabel, programUrl, agencyName, rowsByCity })` :
- `PDFDocument({ size: "A4", margin: 40, bufferPages: true })` — portrait (taille par défaut de `size: "A4"`, contrairement à `buildPdfBuffer` qui force `layout: "landscape"`) ; `bufferPages: true` nécessaire pour connaître le nombre total de pages avant de dessiner "Page X / N"
- Une page par entrée de `rowsByCity` (déjà triée Makka→Madina→autre, §3soixantequinzequadragies) : en-tête (programme, référence, dates, aéroports départ/arrivée, filet doré `#B08D2B` — couleur déjà utilisée pour l'identité de marque, `lib/exporters/receiptPdf.js`) puis **nom de la ville en `Helvetica-Bold` 24pt, couleur dorée**
- Tableau : colonnes Hôtel/Packs/N° Chambre/Groupe/Voyageur(s) (largeurs en proportion de la largeur de contenu, la plus large pour Voyageur(s) — souvent plusieurs noms) ; lignes zébrées (fond `#F7F3E8` une ligne sur deux) ; nouvelle page + en-tête de tableau répété si une ville déborde de la page (rare, mais géré)
- Pied de page dessiné **après coup** sur chaque page bufferisée (`doc.bufferedPageRange()` + `doc.switchToPage(i)`) : nom de l'agence (`getAgencySettings()`, repli `"Golden Fantastic"`) à gauche, lien cliquable vers la fiche programme publique au centre (`/omra-hajj/[slug]` ou `/voyages-organises/[slug]` selon `program_family`, résolu via `NEXT_PUBLIC_SITE_URL`), pagination "Page X / N" à droite

### ⚠️ Piège pdfkit rencontré et corrigé : pagination fantôme au pied de page

Première version : `footerY = doc.page.height - doc.page.margins.bottom + 10` (10pt sous la ligne de marge basse, zone visuelle normale pour un pied de page). Résultat en test réel : **8 pages au lieu de 2**. Cause : pdfkit déclenche son saut de page automatique dès qu'un `.text()` est appelé avec un y qui dépasse `page.maxY()` (`height - margins.bottom`) — **même avec x/y explicites**, l'auto-pagination se déclenche AVANT le dessin. Comme `footerY` est volontairement sous cette limite (c'est la zone de marge, où le pied de page doit justement se trouver), chacun des 3 appels `.text()` du pied de page (agence/lien/pagination) déclenchait sa propre page vierge parasite. **Fix** : `doc.page.margins.bottom` mis à `0` juste avant de dessiner le pied de page de la page courante (repoussant artificiellement `maxY()` à `page.height`, désactivant le déclenchement), puis restauré aussitôt après — sans toucher à la mise en page du contenu réel (dessiné avant, avec la vraie marge).

### Vérification effectuée

- **Détection du bug ci-dessus** : PDF téléchargé une première fois depuis un compte `direction` temporaire, décodé octet par octet (inflate manuel des flux `/FlateDecode`, `zlib.inflateSync`) pour inspecter la structure réelle (`/Kids` de l'objet `/Pages`) — révèle 8 pages au lieu de 2, diagnostiqué et corrigé comme ci-dessus
- **Après correctif, vérification par génération directe** (script Node réel via le hook d'import ESM déjà documenté au §3soixantequadragies, appelant `buildHebergementPdfBuffer` avec les vraies données du voyage OMRA 25 NOV — pas une simulation) : PDF régénéré, structure `/Pages /Count 2` confirmée ; décodage complet des 2 flux de contenu confirme **tout le contenu attendu, mot pour mot**, sur chaque page — programme, dates, aéroports (noms complets, §3soixantequinzequadragies), nom de ville en tête (Makka / Madina), en-têtes de colonnes (Hôtel/Packs/N° Chambre/Groupe/Voyageur(s)), toutes les lignes de chambres avec Packs/Groupe/Voyageurs corrects (ex. Makka : ANJOUM/212/VIP/vddv ; MAATABBA/302/Standard/GROUPE C/C1,C2,C3 ; ABRAJ TAYSSIR/521/Economique/B/B1-B4+IHBOUS YASSINE), pied de page complet ("Golden Fantastic", lien `http://localhost:3000/omra-hajj/omra-25-nov`, "Page 1 / 2" / "Page 2 / 2")
- Format portrait confirmé (`/MediaBox [0 0 595.28 841.89]`, largeur < hauteur, A4 portrait standard)
- Excel et les 3 autres exports (voyageurs/visa/compagnie) re-testés après ce changement : tous 200 OK, comportement inchangé
- `next build` réussi. Compte temporaire supprimé après vérification, aucune donnée modifiée

## 3soixantedixseptquadragies. PDF hébergement : un sous-tableau par hôtel/pack, colonnes réduites à N° Chambre/Voyageur/Tél/Observations

Retouche directe du PDF (§3soixanteseizequadragies), portée **uniquement au PDF** (l'Excel garde son tableau plat unique, colonnes inchangées — "page" n'a de sens que pour le PDF) : sur chaque page ville, le tableau unique est désormais **éclaté en plusieurs sous-tableaux, un par couple (Hôtel, Pack)** — le nom de l'hôtel (et le pack, s'il y en a un) devient un **sous-titre** au-dessus de chaque sous-tableau plutôt que des colonnes. Les colonnes Hôtel/Packs/Groupe sont retirées du tableau ; le tableau devient **N° Chambre / Voyageur / Tél / Observations**, avec **une ligne par voyageur** (pas par chambre) — une chambre à plusieurs occupants affiche désormais un nom par ligne, chacun avec son propre téléphone.

### `lib/listGenerators.js` — nouvelle requête au grain occupant

`getHebergementRoomOccupants(tripId)` (nouvelle, distincte de `getHebergementDistributionList` gardée telle quelle pour l'Excel) : une ligne par **(chambre, occupant)**, pas par chambre. Le pack reste calculé **au niveau de la chambre** (sous-requête dérivée `room_packs`, `GROUP_CONCAT DISTINCT` sur `trip_hotel_tiers.label` des occupants de cette chambre) — décision explicite pour ne jamais éclater une même chambre entre deux sous-tableaux même si, en théorie, deux colocataires avaient choisi des tarifs différents (cas non empêché ailleurs mais resté rare/inhabituel) : le sous-tableau reste l'unité "hôtel + pack homogène pour toutes ses chambres". `traveler_phone` = `COALESCE(tr.phone, tr.phone_whatsapp)` — le numéro général (§3soixantequadragies) prioritaire, repli sur le WhatsApp (toujours renseigné à l'inscription) si absent. Une chambre vide produit une ligne avec `traveler_name`/`traveler_phone` à `NULL`. Tri : Makka puis Madina puis autre ville (inchangé), puis hôtel, **puis pack** (regroupe les chambres homogènes d'un même hôtel avant celles à pack différent, même si leurs numéros de chambre sont entremêlés), puis chambre, puis nom.

### `lib/exporters/hebergementPdf.js` — grain de rendu à trois niveaux

`rowsByCity` change de forme : `[{ city, hotelGroups: [{ hotel_name, pack_label, rows: [{room_number, traveler_name, traveler_phone}, ...] }, ...] }, ...]` (construit par une nouvelle `groupRoomsForPdf()` dans la route, regroupement par clé `hotel_name + pack_label`, en conservant l'ordre déjà appliqué par le tri SQL).

- `drawHotelSubHeading(hotelName, packLabel)` : nom de l'hôtel en gras 12pt, puis "Pack : {label}" en italique gris 9pt **seulement si un pack existe** (silencieux sinon — une chambre sans tarif n'affiche pas "Pack : —")
- `COLUMNS` réduites à 4 : N° Chambre (15%), Voyageur (30%), Tél (20%), **Observations** (35%, volontairement large — colonne vide à remplir à la main sur l'imprimé, jamais alimentée par une donnée). `cell()` renvoie une chaîne **vide** (pas "—" comme les autres exporteurs) pour une valeur manquante — ce tableau est un document de travail à compléter, un tiret aurait suggéré à tort une vérification déjà faite
- Le numéro de chambre est **répété sur chaque ligne occupant** (pas de fusion de cellule façon tableur — trop complexe à faire proprement avec l'API bas niveau de pdfkit pour un gain surtout esthétique) ; une chambre vide affiche une seule ligne, chambre + 3 cellules vides
- **Gestion de la coupure de page à trois niveaux** (nouveau, absent de la version précédente qui ne gérait qu'un seul tableau par page) : avant de commencer un nouveau sous-tableau, si moins de 70pt restent sur la page (`MIN_BLOCK_HEIGHT`), saut de page + en-tête de ville répété — évite un titre d'hôtel orphelin tout en bas d'une page ; si le sous-tableau lui-même déborde en cours de remplissage, saut de page + en-tête de ville **et** sous-titre hôtel/pack **et** en-tête de colonnes répétés, pour qu'aucune page ne commence par des lignes de données sans contexte

### Vérification effectuée

- **Génération directe** (script Node réel, mêmes fonctions que la route, voyage OMRA 25 NOV — pas de simulation) : structure de regroupement vérifiée avant même le rendu PDF — ex. Makka/ABRAJ TAYSSIR se scinde bien en 2 sous-tableaux ("Pack : (aucun)", 3 chambres vides ; "Pack : Economique", 5 lignes = les 5 occupants de la chambre 521 du groupe B, chacun avec son numéro) ; Makka/MAATABBA de même ("Pack : (aucun)" vs "Pack : Standard", ce dernier avec les 3 membres de GROUPE C sur 3 lignes distinctes pour la chambre 302
- **Décodage complet des flux de contenu** (inflate manuel des 2 pages) : confirme mot pour mot chaque sous-titre hôtel/pack, chaque en-tête de colonnes (N° Chambre/Voyageur/Tél/Observations, sans Hôtel/Packs/Groupe), chaque ligne occupant avec son numéro de téléphone réel (ex. B1 → 0715023696), les chambres vides sans ligne occupant superflue, et le pied de page inchangé (agence, lien, pagination "Page 1/2"/"Page 2/2")
- Structure confirmée : `/Pages /Count 2`, `/MediaBox [0 0 595.28 841.89]` (portrait A4, inchangé)
- Excel et les 3 autres exports re-testés après ce changement (requête directe navigateur authentifiée) : tous 200 OK, tailles cohérentes, aucune régression
- `next build` réussi. Compte temporaire supprimé après vérification, aucune donnée modifiée

## 3soixantedixhuitquadragies. PDF hébergement : retour sur le regroupement par pack (hôtel seul) + colonne case à cocher

Retour immédiat sur §3soixantedixseptquadragies : le regroupement en sous-tableaux se faisait par **(hôtel, pack)**, ce qui pouvait scinder un même hôtel en plusieurs sous-tableaux (une chambre sans tarif vs une chambre avec tarif). Demande explicite : **annuler le critère "pack"**, ne garder que le regroupement **par hôtel seul** (un hôtel = un seul sous-tableau, quels que soient les packs de ses chambres) ; et ajouter une **colonne case à cocher**, en tout premier, avant N° Chambre.

- **`lib/listGenerators.js`** : `getHebergementRoomOccupants` perd la sous-requête dérivée `room_packs` et la colonne `pack_label` (plus lue par aucun consommateur) — tri simplifié (ville, hôtel, chambre, nom), sans clause pack
- **`app/api/.../hebergement/route.js`** : `groupRoomsForPdf` regroupe désormais par `hotel_name` seul (clé de regroupement simplifiée, plus de `pack_label` dans la clé ni dans l'objet retourné)
- **`lib/exporters/hebergementPdf.js`** :
  - `drawHotelSubHeading` perd son paramètre `packLabel` et la ligne "Pack : ..." — ne dessine plus que le nom de l'hôtel
  - `COLUMNS` gagne une 5ᵉ entrée en tête, `{ key: "checkbox", header: "", ratio: 0.08 }` — les autres ratios réduits en proportion pour garder un total de 1 (N° Chambre 0.14, Voyageur 0.27, Tél 0.19, Observations 0.32)
  - `drawRow` traite `checkbox` à part (pas de texte) : dessine un **carré vide** (8×8pt, contour gris `#444`, centré verticalement/horizontalement dans la cellule) via `doc.rect(...).stroke()` — même esprit que la colonne Observations (rien à lire, une case à cocher/remplir à la main sur l'imprimé)
- **Conséquence directe du regroupement simplifié** : un hôtel dont certaines chambres ont un pack et d'autres non (ex. ABRAJ TAYSSIR à Makka : 3 chambres sans pack + la chambre 521 du groupe B en pack "Economique") s'affiche désormais dans **un seul** sous-tableau de 8 lignes, plus de scission en 2 tableaux pour le même hôtel

### Vérification effectuée

- **Génération directe** (script Node réel, mêmes fonctions que la route, voyage OMRA 25 NOV — pas de simulation) : structure de regroupement confirmée un seul niveau par ville — Makka : ABRAJ TAYSSIR (8 lignes, fusion des 3 chambres vides + les 5 occupants de la 521), ANJOUM (3 lignes), MAATABBA (5 lignes) ; Madina : KARAOUAN BLAZA (3), MARKAZIA (10) — plus aucune scission par pack au sein d'un même hôtel
- **Décodage complet des flux de contenu** (inflate manuel des 2 pages) : confirme qu'aucune ligne "Pack : ..." n'apparaît plus nulle part, que les en-têtes de colonnes restent N° Chambre/Voyageur/Tél/Observations (la case à cocher, sans texte, ne modifie pas ce qui est lisible dans le flux), et que le nombre de rectangles dessinés par page (23 page 1, 19 page 2) est cohérent avec une case à cocher par ligne + les bandes zébrées habituelles
- Structure confirmée inchangée par ailleurs : `/Pages /Count 2`, `/MediaBox [0 0 595.28 841.89]` (portrait A4)
- **En conditions réelles** (compte `direction` temporaire) : les 5 exports (hébergement PDF/Excel, voyageurs, visa, compagnie) re-testés en direct depuis `/admin/voyages/1/listes`, tous 200 OK — taille du PDF hébergement identique à celle de la génération directe (4902 octets), confirmant que la route sert bien le nouveau code
- `next build` réussi. Compte temporaire supprimé après vérification, aucune donnée modifiée

## 3soixantedixneufquadragies. PDF hébergement : titres d'hôtel mal alignés (bug corrigé) + fusion visuelle de la cellule N° Chambre

Retour avec capture d'écran à l'appui (§3soixantedixhuitquadragies) : les titres des hôtels après le premier de chaque ville ("ANJOUM", "MAATABBA"...) apparaissaient décalés vers la droite au lieu d'être alignés à gauche comme "ABRAJ TAYSSIR"/le nom de la ville. Deux demandes : corriger l'alignement, et fusionner visuellement la cellule N° Chambre pour les lignes d'une même chambre (un numéro affiché une seule fois, pas répété par occupant) — en gardant une case à cocher sur **chaque** ligne (celle-ci ne fusionne pas).

### Bug d'alignement — cause et correctif

**Cause** : `drawTableHeader`/`drawRow` dessinaient chaque cellule avec un `x` **explicite** (`doc.text(valeur, x, y, {width})`), ce qui laisse `doc.x` (le curseur ambiant de pdfkit) sur la position de la **dernière** colonne écrite dans la ligne précédente — souvent la colonne Tél ou Voyageur (pas Observations, cette dernière n'ayant jamais de texte, seul un `.text()` avec valeur non vide déplace `doc.x`). `drawHotelSubHeading` du sous-titre suivant appelait ensuite `doc.text(hotelName, {width: contentWidth})` **sans x explicite**, héritant donc de ce `doc.x` résiduel au lieu de repartir de la marge gauche — d'où un décalage variable selon la dernière colonne réellement écrite avant (constaté : décalage important si la dernière ligne avait un téléphone rempli, décalage léger si seule la colonne N° Chambre avait été écrite pour une chambre vide).

**Fix** : tous les textes "pleine largeur" (en-tête de page, sous-titre hôtel, message "Aucune chambre.") passent désormais un **x explicite** (`doc.page.margins.left`), sans jamais dépendre de l'état ambiant de `doc.x` laissé par un tableau précédent — même précaution que celle déjà documentée pour le pied de page (§3soixanteseizequadragies), cette fois côté positionnement horizontal plutôt que pagination automatique.

### Fusion visuelle de la cellule N° Chambre

- **`groupRoomBlocks(rows)`** (nouveau, `lib/exporters/hebergementPdf.js`) : regroupe les lignes déjà triées par chambre (`getHebergementRoomOccupants`) en blocs contigus `{ room_number, occupants: [...] }` — un bloc par chambre, un occupant fictif à `null` pour une chambre vide (comportement déjà existant, inchangé)
- **`drawRoomBlock(block, startIndex)`** : dessine chaque ligne occupant du bloc (case à cocher, voyageur, tél, observations — **toujours une par ligne**, `startIndex` pilote l'alternance zébrée en continu sur tout le tableau de l'hôtel, pas remise à zéro par bloc), puis dessine le **N° Chambre une seule fois**, centré verticalement sur la hauteur totale cumulée du bloc — pas une vraie fusion de cellule au sens tableur (le tableau n'a aucun trait de séparation entre lignes, seul le fond zébré distingue visuellement les lignes), mais le résultat pratique est identique : un numéro qui semble couvrir tout le bloc de ses occupants
- **Coupure de page à l'échelle du bloc entier**, pas ligne par ligne comme avant : la hauteur totale du bloc est calculée à l'avance (`lineHeight` sommée sur tous ses occupants) et comparée à l'espace restant **avant** de commencer à dessiner quoi que ce soit du bloc — un bloc ne peut plus se retrouver coupé au milieu entre deux pages, ce qui aurait cassé la fusion visuelle (numéro de chambre sur une page, une partie de ses occupants sur la suivante)

### Vérification effectuée

- **Génération directe + décodage positionnel** (script Node réel, voyage OMRA 25 NOV, extraction des coordonnées `Tm` de chaque bloc de texte du flux PDF décompressé — pas une simulation) : **tous** les titres pleine largeur (programme, ville, chaque nom d'hôtel : ABRAJ TAYSSIR/ANJOUM/MAATABBA/KARAOUAN BLAZA/MARKAZIA) sont à `x = 40.0` exactement, la marge gauche de page — alignement confirmé identique pour tous, bug résolu
- **Fusion de chambre confirmée par comptage** : le numéro "521" (5 occupants, groupe B) n'apparaît qu'**une seule fois** dans le flux, après les 5 lignes B1-B4+IHBOUS YASSINE (pas répété 5 fois comme avant §3soixantedixseptquadragies) ; même constat pour "302"/"301" (3 occupants chacun, GROUPE C) et "501" (5 occupants, groupe B à Madina)
- **Cases à cocher confirmées une par ligne, pas fusionnées** : comptage des rectangles 8×8pt dans chaque page — 16 sur la page Makka (= 8+3+5, exactement le nombre total de lignes occupant/chambre-vide des 3 hôtels) et 13 sur la page Madina (= 3+10) — correspond exactement au nombre de lignes, confirmant qu'aucune case n'a été fusionnée par erreur
- Structure inchangée par ailleurs : `/Pages /Count 2` (portrait A4)
- **En conditions réelles** (compte `direction` temporaire) : les 5 exports re-testés depuis `/admin/voyages/1/listes`, tous 200 OK, taille du PDF hébergement identique à la génération directe (4935 octets)
- `next build` réussi. Compte temporaire supprimé après vérification, aucune donnée modifiée

## 3quatrevingtquadragies. PDF hébergement : bug réel de chevauchement (§3soixantedixneufquadragies), corrigé — leçon sur la vérification

Signalé par 2 captures d'écran (rendu réel, pas juste une lecture de code) : malgré la vérification "positionnelle" de §3soixantedixneufquadragies (alignement X confirmé à 40.0 pour tous les titres), le rendu réel montrait des lignes **chevauchées** — "ANJOUM" superposé aux dernières lignes d'ABRAJ TAYSSIR, "401"/"Wafae" superposés à "C3", une case à cocher dédoublée près de "401". La vérification précédente ne portait que sur les coordonnées **X** et un comptage d'éléments : elle ne pouvait pas détecter un problème de coordonnée **Y**, exactement où le bug se trouvait.

### Cause racine

`drawRoomBlock` (`lib/exporters/hebergementPdf.js`) dessine toutes les lignes occupant d'un bloc (ce qui avance correctement `doc.y` jusqu'au vrai bas du bloc), **puis** dessine le N° Chambre une seule fois, **centré verticalement**, donc à un `y` explicite plus haut que ce bas réel dès qu'un bloc a plusieurs occupants. Or un `doc.text(str, x, y, options)` avec un `y` explicite **déplace `doc.y` à la position de CE texte**, quelle que soit sa position par rapport au `doc.y` déjà atteint — après le dessin du numéro centré, `doc.y` se retrouvait donc remonté au milieu du bloc au lieu de rester à son vrai bas. Le contenu suivant (bloc chambre suivant, ou titre du prochain hôtel) repartait de cette position trop haute et se superposait aux dernières lignes déjà dessinées plus bas sur la page.

### Fix

Une ligne ajoutée en fin de `drawRoomBlock` : `doc.y = blockTop + blockHeight;` — recale explicitement le curseur sur le vrai bas du bloc (déjà calculé pour le test de coupure de page, réutilisé ici) juste après le dessin du numéro centré, indépendamment de l'endroit où ce dessin a laissé `doc.y`. Même famille de piège que le pied de page (§3soixanteseizequadragies) et l'alignement des titres (§3soixantedixneufquadragies) : **tout `.text()` à coordonnée explicite dans pdfkit doit être suivi d'un recalage explicite de `doc.y` si son y ne correspond pas au point de reprise voulu** — un motif désormais rencontré trois fois dans ce seul fichier.

### Leçon sur la méthode de vérification (pour la suite)

La vérification de §3soixantedixneufquadragies (décodage du flux, extraction des `Tm`) était réelle et non simulée, mais **incomplète** : elle ne comparait que les `x` (pour l'alignement) sans jamais croiser les `y` dans l'ordre de dessin. Un chevauchement est par nature un problème de `y`, pas de `x` — d'où le bug non détecté malgré une vérification "réelle". Corrigé cette fois en extrayant **x ET y** de chaque bloc de texte, dans l'ordre d'apparition dans le flux, et en vérifiant que le point le plus bas déjà atteint (`y` minimal rencontré) n'est jamais dépassé vers le haut par un élément dessiné plus tard — sauf le numéro de chambre centré lui-même (seule exception connue et voulue, isolée dans sa propre colonne, jamais suivie d'un autre élément qui hériterait de sa position).

### Vérification effectuée

- **Génération directe + décodage x/y complet** (script Node réel, voyage OMRA 25 NOV) : sur les deux pages, les seuls "sauts vers le haut" détectés dans la séquence de dessin sont exactement les numéros de chambre centrés eux-mêmes (521, 302 côté Makka ; 301, 501 côté Madina) — et dans chaque cas, l'élément dessiné juste après repart bien **en dessous** du point le plus bas déjà atteint dans le bloc (ex. "ANJOUM" à y=501.5, sous "IHBOUS YASSINE" à y=529.0 — alors qu'avant le fix "521" aurait laissé `doc.y` à 559.7, au-dessus de cette ligne). Confirmé sur les 4 blocs multi-occupants du voyage réel (521, 302, 301, 501)
- Cases à cocher (16 page 1, 13 page 2) et structure (`/Pages /Count 2`, portrait A4) reconfirmées inchangées par ce correctif
- **En conditions réelles** (compte `direction` temporaire) : PDF re-téléchargé depuis `/admin/voyages/1/listes`, 200 OK, taille identique à la génération directe (4903 octets) ; les 4 autres exports re-testés, tous 200 OK
- `next build` réussi. Compte temporaire supprimé après vérification, aucune donnée modifiée

## 3quatrevingtetunquadragies. Footer public modernisé + réseaux sociaux éditables depuis `/admin/parametres` (migration `028_add_agency_social_links.sql`)

Demande explicite : finaliser le footer du site public (`SiteFooter.jsx`, jusqu'ici minimal — copyright + 2 liens légaux) pour qu'il soit "moderne et pratique" avec liens vers les pages du site, logo/infos de l'agence, et des réseaux sociaux — ces derniers ajoutables/modifiables depuis `/admin/parametres` ("Infos agence").

### Schéma — réseaux sociaux en catalogue extensible, pas des colonnes figées

Nouvelle table `agency_social_links` (`agency_id DEFAULT 1`, `platform` VARCHAR libre, `url`, `sort_order`) — choix explicite d'un **catalogue extensible** (même logique que `services`/`airlines`, §1/§3bis : "de nouveaux types doivent pouvoir être ajoutés plus tard sans développement supplémentaire") plutôt que des colonnes figées `facebook_url`/`instagram_url`/... : l'agence peut ajouter n'importe quelle plateforme (TikTok, YouTube, Snapchat...) sans migration. Placée en fin de `schema.sql` (après la table `agencies`, migration 016) — c'est une table **neuve**, pas une colonne ajoutée à une table existante ; ⚠️ constaté au passage que les migrations 017 à 027 ne sont mirrorées dans `schema.sql` qu'en éditant **directement** les `CREATE TABLE` d'origine (colonnes ajoutées inline, ex. `destination_city`, `selected_tier_id`), jamais en ajoutant des `ALTER TABLE` en fin de fichier — schema.sql s'arrêtait donc juste après le bloc multi-agences (migration 016, ligne ~933) ; cette section y ajoute le premier bloc post-multi-agences.

### `lib/agencySettings.js`

- `listAgencySocialLinks()` / `setAgencySocialLinks(links)` (purge + réinsertion complète, même pattern que `setDefaultHotelsForProgram`/`setHotelPreferencesForRegistration`) — entrées sans `platform`/`url` non vides filtrées silencieusement
- `getAgencySettings()` attache désormais `social_links` au résultat (requête batch supplémentaire) — additif, tous les appelants existants (reçu PDF, liste d'hébergement, pages publiques `a-propos`/`contact`, `/admin/parametres`) vérifiés non affectés par ce champ en plus

### `app/api/admin/agency-settings/route.js`

`PUT` accepte désormais un `socialLinks: [{platform, url}]` optionnel dans le corps — appelle `setAgencySocialLinks` après `updateAgencySettings`, puis renvoie l'état complet via `getAgencySettings()` (donc avec la liste à jour). Un seul bouton "Enregistrer" pour toute la page, cohérent avec le formulaire existant.

### `app/admin/parametres/AgencySettingsForm.jsx` — section "Réseaux sociaux"

Liste répétable {Plateforme, URL} sous les champs existants : "+ Ajouter un réseau social" / "Retirer" par ligne, champ Plateforme avec `<datalist>` de suggestions courantes (Facebook, Instagram, TikTok, YouTube, LinkedIn, X (Twitter), WhatsApp, Snapchat, Pinterest, Telegram — même pattern datalist que les compagnies aériennes/pays-villes, §3decies/§3octies) mais **texte libre accepté**, champ URL en `type="url"`. Respecte `canEdit` (lecture seule si le rôle n'a pas `parametres.edit`, inchangé).

### `app/_components/SocialIcon.jsx` (nouveau) — icônes SVG à la main, zéro dépendance

Reconnaît ~10 plateformes courantes (comparaison insensible à la casse/espaces sur le nom saisi) et affiche une icône SVG dédiée dessinée à la main (même esprit que le hamburger de `SiteHeader.jsx` — aucune bibliothèque d'icônes ajoutée) ; **toute autre valeur retombe sur une icône générique (lien/globe)** plutôt que de ne rien afficher — un réseau social inconnu du mapping reste donc toujours utilisable et visible, condition nécessaire pour que "ajouter n'importe quel réseau social" (demande explicite) fonctionne vraiment.

### `app/_components/navLinks.js` (nouveau) — `NAV_LINKS` extrait de `SiteHeader.jsx`

Extrait dans un petit module partagé pour que `SiteFooter.jsx` réutilise exactement la même liste de liens (Omra & Hajj, Voyages organisés, À propos, Actualités, FAQ, Contact) sans risque de divergence entre en-tête et pied de page — `SiteHeader.jsx` importe désormais depuis ce module au lieu de définir sa propre copie locale.

### `app/_components/SiteFooter.jsx` — réécriture

Toujours "use client" (React Context `useLocale`), gagne une prop **`agency`** (déjà chargé côté serveur dans `app/(site)/layout.js` pour le JSON-LD `LocalBusiness`, simplement transmis en plus — **aucune requête supplémentaire**, `SiteFooter` ne peut de toute façon pas interroger la base lui-même étant un composant client). Disposition en grille responsive (empilée en mobile, 4 colonnes à partir de `sm:`) :
- **Logo + tagline + réseaux sociaux** : logo de l'agence (`agency.logo_url`) si renseigné, sinon le nom en `font-script` doré (repli identique au header) ; icônes sociales rondes cliquables (`target="_blank" rel="noopener noreferrer"`, `aria-label`/`title` = nom de la plateforme) sous un intitulé "Suivez-nous" — bloc entier masqué si aucun réseau social n'est configuré
- **Liens rapides** : les 6 liens de navigation (`NAV_LINKS`, partagés avec le header)
- **Contact** : adresse+ville, téléphone, WhatsApp, email (chaque ligne conditionnelle, repli discret si rien n'est renseigné — cohérent avec le comportement déjà existant de `/a-propos`/`/contact`)
- **Barre du bas inchangée** : copyright + liens Mentions légales/Confidentialité (déjà existants avant cette passe), simplement repositionnée sous la nouvelle grille plutôt que seul contenu du footer
- RTL-safe par construction : propriétés logiques uniquement (`sm:text-start`, pas de `left`/`right`), cohérent avec la règle déjà posée en §3cinquantedeuxquadragies

### Vérification effectuée

- `next build` réussi ; liste des pages statiques/ISR **identique à avant** (`/`, `/a-propos`, `/confidentialite`, `/contact`, `/faq`, `/mentions-legales`, `/programmes` toujours `○`) — confirme que passer `agency` (déjà chargé) en prop à `SiteFooter` ne réintroduit pas la régression de rendu dynamique déjà rencontrée et corrigée en §3cinquantedeuxquadragies
- **En conditions réelles** (compte `direction` temporaire, données réelles de l'agence déjà en place) : deux réseaux sociaux de test ajoutés depuis `/admin/parametres` ("Paramètres enregistrés." affiché), persistance confirmée par requête SQL directe (`agency_social_links`, 2 lignes, `sort_order` 0/1)
- **Site public** (`/`, sans connexion) : contenu du `<footer>` du DOM inspecté directement — logo/tagline, "Suivez-nous" avec les 2 icônes de test (liens `<a target="_blank">` corrects, `aria-label` et SVG présents), "Liens rapides" (6 liens), "Contact" (adresse/ville/téléphone/WhatsApp/email réels de l'agence), barre du bas (copyright + mentions légales/confidentialité) — tout confirmé présent et correct
- Réseaux sociaux de test et compte temporaire supprimés après vérification (confirmé par requête SQL directe) — aucune donnée réelle de l'agence modifiée

## 3quatrevingtdeuxquadragies. Footer : Google Maps dans les réseaux sociaux, icônes couleur du projet, "Liens rapides" scindé en 2, contact entièrement cliquable

Retouches directes sur §3quatrevingtetunquadragies, demande explicite :
1. Pouvoir ajouter un lien Google Maps depuis la même liste "réseaux sociaux" de `/admin/parametres`
2. Icônes du footer mieux mises en valeur avec la couleur du projet (doré)
3. "Liens rapides" scindé en 2 groupes : (Omra & Hajj, Voyages organisés, Actualités) et (À propos, FAQ, Contact)
4. Téléphone, WhatsApp et email du bloc Contact rendus cliquables (`tel:`, `wa.me`, `mailto:`)

### Google Maps comme entrée du catalogue existant, pas un champ à part

`SOCIAL_PLATFORM_SUGGESTIONS` (`AgencySettingsForm.jsx`) gagne "Google Maps" — aucune nouvelle colonne/table, cohérent avec le choix déjà fait en §3quatrevingtetunquadragies de garder les réseaux sociaux en catalogue extensible plutôt qu'en champs figés : Google Maps n'est qu'une plateforme de plus dans la même liste `agency_social_links`. `SocialIcon.jsx` gagne une icône dédiée (`googlemaps`, épingle de localisation) — sans elle, un lien Google Maps serait retombé sur l'icône générique (toujours fonctionnel, juste moins reconnaissable).

### Icônes — style doré du projet au lieu du gris neutre

Les boutons ronds des réseaux sociaux (`SiteFooter.jsx`) passent de `border-gold/30 text-cream-card/80` (visible seulement au survol) à **`border-gold/40 bg-gold/10 text-gold`** en permanence, avec `hover:bg-gold hover:text-ink` — même bascule "fond doré plein + texte encre" que le bouton CTA "Devis gratuit" du header (`SiteHeader.jsx`), pour une identité visuelle cohérente entre les deux composants plutôt qu'un gris neutre par défaut.

### "Liens rapides" scindé en 2 colonnes internes

`SiteFooter.jsx` : `quickLinksGroup1`/`quickLinksGroup2` dérivés de `NAV_LINKS` (§3quatrevingtetunquadragies) par un simple `.filter()` sur les clés désirées — l'ordre d'origine de `NAV_LINKS` est préservé sans tri manuel. Rendu comme deux colonnes de la grille du footer (toujours 4 colonnes au total à `lg:`, Logo/Groupe1/Groupe2/Contact) plutôt qu'une sous-grille dans une seule cellule — la seconde colonne porte un `<h3>` "Liens rapides" identique mais **invisible** (`opacity-0 aria-hidden="true"`) pour garder les 4 colonnes alignées verticalement sans dupliquer le titre à l'écran ni le rendre visible aux lecteurs d'écran.

### Contact — trois liens cliquables

- Téléphone : `tel:{numéro sans espaces}`
- WhatsApp : `wa.me` — `whatsappHref()` (nouvelle fonction pure, `SiteFooter.jsx`) convertit le format marocain local saisi dans `/admin/parametres` ("0662681625") en international sans le 0 initial ("212662681625"), repli sur les chiffres tels quels si le numéro commence déjà par "+" ou n'est pas au format local à 0 initial
- Email : `mailto:`

### ⚠️ Incident réel pendant la vérification — donnée réelle corrompue puis restaurée

En testant l'ajout de Google Maps depuis le formulaire admin, un clic+saisie a atterri sur un champ **déjà rempli** (un lien Facebook réel de l'agence, `https://www.facebook.com/goldenfantastic44`, ajouté par l'utilisateur entre les deux sessions) au lieu du nouveau champ vide attendu — le curseur s'est positionné au milieu du texte existant plutôt qu'à la fin, produisant une valeur corrompue par concaténation (`"FacebookGoogle Maps"`, URL entrelacée). Repéré immédiatement après enregistrement via une relecture SQL directe (jamais supposé que l'écriture avait réussi comme prévu). **Corrigé par reconstruction précise** : la valeur d'origine était déductible sans ambiguïté en retirant le texte tapé (connu) de la valeur corrompue (`"https://www.facebook.c" + [texte tapé] + "om/goldenfantastic44"` → original `"https://www.facebook.com/goldenfantastic44"`), restaurée par `UPDATE` ciblé sur cette ligne précise, revérifiée par lecture SQL puis par relecture des `input.value` réels de la page admin rechargée. **Leçon retenue pour la suite** : avant de taper dans un champ de formulaire réel (pas un compte de test), relire l'état actuel du DOM (`input.value`, pas seulement la présence du champ) plutôt que de supposer qu'un champ nouvellement ajouté est vide — surtout sur une page qui mélange déjà des données réelles de l'utilisateur avec le test en cours. Le test Google Maps lui-même a ensuite été fait par **insertion SQL directe** d'une ligne séparée (n'a jamais retouché le formulaire réel), supprimée après vérification.

### Vérification effectuée

- `next build` réussi
- **Site public** (`/`, sans connexion, DOM inspecté directement) : icônes Facebook (réelle) et Google Maps (test, ajoutée par SQL) toutes deux rendues avec les nouvelles classes dorées (`border-gold/40 bg-gold/10 text-gold ... hover:bg-gold hover:text-ink`) et un `<svg>` propre à chacune ; deux `<nav>` distincts sous "Liens rapides" contenant exactement `["Omra & Hajj", "Voyages organisés", "Actualités"]` et `["À propos", "FAQ", "Contact"]` ; liens Contact confirmés cliquables avec les bons hrefs : `tel:0661395060`, `https://wa.me/212662681625` (conversion correcte depuis "0662681625"), `mailto:goldenfantatstic44@gmail.com`
- Ligne de test Google Maps supprimée après vérification ; entrée Facebook réelle de l'agence restaurée à l'identique et reconfirmée par requête SQL directe

## 3quatrevingttroisquadragies. Footer : fond blanc, couleurs de marque réelles par réseau social, titre "Informations", + bug réel de corruption de données corrigé (clé React instable)

Retouche directe sur §3quatrevingtdeuxquadragies, demande explicite : fond du footer en **blanc** (au lieu du fond sombre d'origine), textes retravaillés pour rester bien lisibles sur ce nouveau fond, icônes réseaux sociaux avec la **couleur de marque réelle de chaque plateforme** (pas une teinte dorée uniforme), et un **titre visible** pour le second groupe de "Liens rapides" (À propos, FAQ, Contact) — jusqu'ici un doublon de titre invisible (`opacity-0`) purement pour l'alignement.

### Fond blanc + couleurs de texte

`SiteFooter.jsx` : `bg-ink-soft` → `bg-white`, `border-gold/20` → `border-gold-pale` (même bordure douce que les cartes du site public sur fond clair, ex. `HomeShowcaseCard.jsx`). Tous les textes (`text-cream-card/*`, pensés pour un fond sombre) remplacés par les tokens déjà établis pour du texte sur fond clair ailleurs sur le site public : `text-muted` (`--color-muted: #6e655a`) pour le corps de texte, et **`#A8863C`** (constante `GOLD_ON_LIGHT`, pas le token `text-gold` plus clair — celui-ci reste réservé aux fonds sombres, cf. `HomeShowcaseCard.jsx`/`ProgramDetail.jsx`/`ReservationForm.jsx` qui utilisent déjà exactement cette même teinte `#A8863C` pour du texte doré lisible sur blanc) pour les titres de colonne et les accents au survol.

### Couleurs de marque réelles — `getSocialBrand()` dans `SocialIcon.jsx`

Nouvelle table `BRAND_COLORS` (même clé normalisée que les icônes) : Facebook `#1877F2`, Instagram `#E1306C`, TikTok `#010101`, YouTube `#FF0000`, X `#000000`/Twitter `#1DA1F2`, LinkedIn `#0A66C2`, WhatsApp `#25D366`, Snapchat `#FFFC00` (avec un drapeau `dark: true` — fond jaune trop clair pour une icône blanche au survol, bascule sur l'encre du projet), Pinterest `#E60023`, Telegram `#229ED9`, Google Maps `#EA4335` ; repli sur `#A8863C` (couleur or du projet) pour toute plateforme non reconnue — jamais de couleur cassée. `SiteFooter.jsx` calcule, par lien, un fond légèrement teinté (12% d'opacité) et une bordure (35%) au repos, puis un remplissage plein de la couleur de marque au survol.

⚠️ **Piège évité** : plutôt qu'un modificateur d'opacité Tailwind arbitraire directement sur une variable CSS (`bg-[color:var(--brand)]/10`, fragile — dépend de la façon dont la version de Tailwind résout l'opacité d'une valeur `var()`), chaque teinte est précalculée **en JS** en `rgba(...)` complet (`hexToRgba()`) et posée comme variable CSS à part entière (`--brand-tint`, `--brand-border`, `--brand-solid`), référencée telle quelle (`bg-[var(--brand-tint)]`) — élimine toute dépendance à ce comportement d'opacité sur variable.

### Titre "Informations" pour le second groupe de liens

Nouvelle clé `dict.footer.informations` (les 3 dictionnaires i18n, même portée que le reste — voir §3cinquantedeuxquadragies) = "Informations". Remplace le `<h3>` dupliqué en `opacity-0`/`aria-hidden` de §3quatrevingtetunquadragies par un **vrai titre visible**, cohérent visuellement avec "Liens rapides"/"Contact".

### ⚠️ Bug réel trouvé et corrigé — clé React instable sur la liste "Réseaux sociaux"

En re-testant l'ajout d'un lien Google Maps (cette fois par insertion SQL directe pour ne pas retoucher le formulaire réel après l'incident de §3quatrevingtdeuxquadragies), la base contenait déjà, **sans intervention de cette session**, plusieurs lignes visiblement corrompues : un "YouTube" avec l'URL Facebook, un "Google Maps" avec la même URL Facebook, un "LinkedIn" avec `http://localhost:3000/` — signe que l'utilisateur réel avait lui-même essayé d'ajouter des réseaux sociaux entre deux tours de cette conversation et avait subi la **même classe de bug**, mais cette fois causée par le code, pas par une manipulation malencontreuse de ma part.

**Cause racine** : `AgencySettingsForm.jsx` utilisait `key={index}` (position dans le tableau) pour chaque ligne de la liste répétable "Réseaux sociaux". Ajouter ou retirer une ligne décale les index de toutes les lignes suivantes — React, indexé par position, **réutilise alors les `<input>` DOM existants pour une ligne logiquement différente**, laissant leur valeur affichée (et donc saisie) résiduelle au lieu de la vider. C'est un piège React classique des listes dynamiques sans clé stable, ici responsable d'une vraie corruption de données utilisateur en conditions réelles.

**Fix** : chaque ligne porte désormais une clé stable indépendante de sa position (`_key` : l'id réel de la base une fois chargée depuis le serveur, un id généré côté client — `makeClientKey()`, horodatage + aléatoire — pour une ligne fraîchement ajoutée non encore enregistrée). `handleSocialLinkChange`/`removeSocialLink` ciblent désormais par `_key`, plus par index. `_key` est retiré du payload envoyé au serveur à l'enregistrement (l'API n'attend que `{platform, url}`).

**Nettoyage** : les lignes corrompues trouvées (YouTube/Google Maps pointant vers l'URL Facebook, LinkedIn vers localhost) ont été supprimées — leur contenu réel voulu par l'utilisateur n'était pas reconstituable (contrairement à l'incident précédent où la valeur d'origine restait déductible par soustraction du texte tapé). L'entrée Facebook réelle, correcte, a été laissée intacte. **L'utilisateur devra ré-ajouter lui-même les réseaux sociaux qu'il avait tenté d'ajouter (YouTube, LinkedIn, Google Maps) — le bug qui les avait corrompus est maintenant corrigé.**

### Vérification effectuée

- `next build` réussi
- **Site public** (`/`, sans connexion, propriétés CSS calculées lues directement dans le DOM — pas une lecture de code) : fond du footer confirmé `rgb(255, 255, 255)` ; icônes de test (Instagram, Snapchat, ajoutées par SQL puis supprimées) confirmées aux couleurs de marque exactes — Facebook `rgb(24, 119, 242)`, Instagram `rgb(225, 48, 108)`, Snapchat `rgb(255, 252, 0)`, chacune avec son fond teinté à 12% d'opacité correspondant ; les 3 titres de colonne ("Liens rapides", **"Informations"**, "Contact") confirmés dans la couleur `rgb(168, 134, 60)` (= `#A8863C`)
- Toutes les données de test supprimées après vérification ; entrée Facebook réelle de l'agence reconfirmée intacte par requête SQL directe

## 3quatrevingtquatrequadragies. Tarifs d'hébergement : hôtels Mecque/Médine limités aux "hôtels habituels" du programme, exclusion mutuelle entre les deux champs

Signalé avec capture d'écran à l'appui : les listes déroulantes "Hôtel Mecque"/"Hôtel Médine" de la fenêtre "Tarifs d'hébergement" (`TiersCard.jsx`, §3unquadragies) proposaient tout le **catalogue global** d'hôtels (`listHotels()`), pas seulement les hôtels déjà retenus comme "habituels" pour ce programme dans la fenêtre "Hôtels" (`HotelsCard.jsx`, §3vicies/§3novotrigies) — les deux fenêtres pouvaient donc afficher des listes différentes. Sur les données de test, les deux catalogues coïncidaient par coïncidence (le catalogue global ne contenait que les 5 hôtels déjà choisis comme habituels pour le programme OMRA 25 NOV), masquant le problème jusqu'à ce qu'un second programme (OMRA 06 DEC, seulement 4 hôtels habituels sur les 5 du catalogue) le révèle. Demande explicite, en deux parties : (1) limiter les deux listes aux hôtels déjà choisis dans la fenêtre Hôtels ; (2) une fois un hôtel choisi dans l'un des deux champs, l'exclure de la liste de l'autre (un même hôtel ne doit pas pouvoir être choisi pour les deux villes à la fois).

### `app/admin/programmes/[id]/ProgramManagerGrid.jsx`

Nouvelle constante dérivée `habitualHotels = hotels.filter((h) => defaultHotelIds.includes(h.id))` (`hotels` = catalogue global, déjà chargé pour `HotelsCard` ; `defaultHotelIds` = ids des hôtels habituels du programme, déjà chargés aussi) — transmise à `TiersCard` en tant que prop `hotels` **à la place** du catalogue complet. `HotelsCard` continue de recevoir le catalogue complet inchangé (c'est justement l'endroit où on choisit les hôtels habituels parmi tout le catalogue).

### `app/admin/programmes/[id]/TiersCard.jsx` — exclusion mutuelle dans `TierForm`

`hotelsByCity` (calculée une fois, partagée par les deux `<select>`) remplacée par **deux listes distinctes** : `makkahHotelsByCity` (le prop `hotels` moins l'hôtel actuellement sélectionné pour Médine) et `madinahHotelsByCity` (moins celui sélectionné pour Mecque) — chaque champ n'exclut que la sélection de **l'autre** champ, jamais la sienne propre (sinon la valeur déjà choisie disparaîtrait de sa propre liste). Recalculées à chaque rendu (pas de `useEffect`), se mettent donc à jour immédiatement dès qu'un des deux `<select>` change.

### Vérification effectuée (avec connexion admin réelle)

- **Catalogue vs habituels, sur données réelles** : requête SQL directe confirme que le catalogue global ne contient que 5 hôtels, tous habituels du programme 1 (OMRA 25 NOV) mais seulement 4 des 5 pour le programme 2 (OMRA 06 DEC, sans MAATABBA) — cas réel exploitable pour vérifier le filtre
- **En conditions réelles** (compte `direction` temporaire) : `/admin/programmes/2` → "Tarifs d'hébergement" → "+ Ajouter un tarif" — les deux listes Mecque/Médine confirmées (lecture directe des `<option>` du DOM) sans MAATABBA, exactement les 4 hôtels habituels du programme 2
- **Exclusion mutuelle confirmée par manipulation réelle du DOM** : sélection de "ABRAJ TAYSSIR" dans le champ Mecque → relecture du champ Médine → "ABRAJ TAYSSIR" a bien disparu de sa liste, les 3 autres hôtels restants toujours présents
- `next build` réussi. Formulaire de test annulé (aucun tarif créé) ; compte temporaire supprimé après vérification, aucune donnée modifiée

## 3quatrevingtcinquantequadragies. Suppression d'un programme : bloquée seulement s'il a de vrais voyageurs inscrits, pas dès qu'il a un voyage

Signalé avec capture d'écran : supprimer un programme de test sans aucun voyageur inscrit échouait avec "Impossible de supprimer : ce programme a des voyages associés". Cause : `deleteProgram` faisait un simple `DELETE FROM programs`, qui butait sur la contrainte de clé étrangère `trips.program_id` (RESTRICT, aucun `ON DELETE CASCADE`) dès que le programme avait ne serait-ce qu'**un voyage**, indépendamment du nombre d'inscrits sur ce voyage — la présence d'un voyage suffisait à bloquer, pas la présence d'un voyageur. Règle explicite de l'utilisateur : seul un **voyageur réellement inscrit** (une ligne `registrations`, quel que soit son statut — même annulé, ça reste une vraie donnée voyageur) doit bloquer la suppression ; un programme dont les voyages n'ont jamais reçu d'inscription doit pouvoir être supprimé **entièrement**, voyages compris.

### `lib/programsAdmin.js::deleteProgram` — réécriture avec suppression en cascade contrôlée

Transaction (`getPool()`/`beginTransaction`) :
1. **Vérification d'abord** : `COUNT(*)` sur `registrations` jointes à `trips` pour ce programme — si > 0, lève une erreur `err.code = "PROGRAM_HAS_REGISTRATIONS"` (message explicite), rien n'est touché
2. **Sinon**, nettoyage manuel des dépendances de `trips` qui n'ont pas de `ON DELETE CASCADE` en base (`flight_bookings`, `trip_meal_offers`, `registration_groups` — sans inscription sur ces voyages, ces lignes ne peuvent être que vides/orphelines, jamais un vrai dossier voyageur), puis `DELETE FROM trips WHERE program_id = ?` — ce qui cascade déjà automatiquement `trip_hotels → rooms` et `trip_hotel_tiers → trip_hotel_tier_prices` (`ON DELETE CASCADE` déjà en place, voir `database/schema.sql`)
3. `DELETE FROM programs WHERE id = ?` — cascade déjà `program_faqs`/`program_hotels` (`ON DELETE CASCADE`), passe `slides.program_id` à `NULL` (`ON DELETE SET NULL`)
- **Filet de sécurité conservé** : si une dépendance non prévue bloquait malgré tout (contrainte de clé étrangère oubliée), la transaction échoue et s'annule proprement (`rollback`) — aucune perte de données possible même si la liste de nettoyage manuel s'avérait incomplète un jour

### `app/api/admin/programs/[id]/route.js`

`DELETE` traduit `PROGRAM_HAS_REGISTRATIONS` en message explicite ("des voyageurs sont inscrits à ce programme") ; l'ancien filet `ER_ROW_IS_REFERENCED_2` reste en repli avec un message générique, au cas où.

### Vérification effectuée (script Node réel, pas une simulation, contre la vraie base de dev)

- **Cas réel signalé** : `deleteProgram(3)` ("Omra Décembre", le programme de test de l'utilisateur, 0 inscription, 2 hôtels habituels) → suppression réussie ; programme, voyage et `program_hotels` associés confirmés absents par requête SQL directe après coup
- **Cas bloqué, toujours protégé** : `deleteProgram(1)` (OMRA 25 NOV, inscriptions réelles) → rejeté avec `code: PROGRAM_HAS_REGISTRATIONS`, programme confirmé intact ensuite (`getProgramById` le retrouve toujours)
- **Cascade complète, cas le plus chargé** : programme jetable créé avec un voyage, un hôtel attaché (`trip_hotels`), une chambre (`rooms`), un tarif d'hébergement avec un prix (`trip_hotel_tiers`/`trip_hotel_tier_prices`) — `deleteProgram` supprime tout, les 6 tables vérifiées vides après coup (programme, voyage, hôtel attaché, chambre, tarif, prix)
- `next build` réussi. Toutes les données de test supprimées/nettoyées après vérification (le programme "Omra Décembre" de l'utilisateur a été réellement supprimé, comme demandé)

## 3quatrevingtsixquadragies. Champs de `/admin/slider` rendus optionnels + doublon "Texte du bouton" corrigé

Signalé par capture d'écran : le formulaire de diapositive (`/admin/slider`) affichait le champ "Texte du bouton" **deux fois** simultanément dès qu'un programme était choisi dans "Lien vers", et le Titre ne pouvait pas être laissé vide. Demande explicite : tous les champs doivent être optionnels.

### Doublon "Texte du bouton" — bug réel confirmé et corrigé

`SlideForm` (`app/admin/slider/SlidesManager.jsx`) rendait le champ "Texte du bouton" (`form.buttonText`) une première fois dans le bloc dynamique partagé avec "URL personnalisée" (label conditionné par `linkMode`), **et** une seconde fois juste après dans un bloc séparé affiché uniquement quand un programme est sélectionné (`linkMode !== CUSTOM_LINK_VALUE`) — exact doublon de la même liaison `form.buttonText`, jamais retiré lors d'un ajout antérieur. Le second bloc (redondant) est supprimé ; le premier bloc dynamique suffit déjà à couvrir les deux cas (URL personnalisée / Texte du bouton selon le mode de lien).

### Champs rendus optionnels

- **Client** (`SlidesManager.jsx`) : `required` retiré du champ Titre (label renommé "Titre (optionnel)") et du champ URL personnalisée (label "URL personnalisée (optionnel)", affiché seulement en mode lien personnalisé) ; Sous-titre et Lien vers déjà optionnels, labels alignés pour le préciser
- **Serveur** (`app/api/admin/slides/route.js` `POST`, `app/api/admin/slides/[id]/route.js` `PUT`) : les deux validations bloquantes ("le titre est requis" ; "choisir un programme ou renseigner un lien personnalisé") sont retirées — `slides.title` reste `NOT NULL` en base (`database/schema.sql`) mais accepte une chaîne vide, aucune migration nécessaire
- `lib/slides.js` (`createSlide`/`updateSlide`) : aucun changement nécessaire, transmettait déjà les valeurs telles quelles

### `app/_components/HeroSlider.jsx` — rendu public sans champ

Une diapositive sans titre/lien ne doit pas afficher un `<h1>` vide ni un bouton menant nulle part : le `<h1>` n'est désormais rendu que si `slide.title` est non vide, et le bouton (`<Link>`) n'est rendu que si `slide.href !== "#"` (`resolveHref()` retombe sur `"#"` seulement quand ni programme ni lien personnalisé ne sont renseignés) — comportement inchangé pour toute diapositive qui a déjà un titre/lien.

### ⚠️ Incident réel pendant la vérification — donnée de production accidentellement écrasée, restaurée

En testant en direct (compte `direction` temporaire), une séquence clic "Modifier" → sélection du texte du champ Titre → clic sur "Annuler" a en réalité déclenché une **soumission** du formulaire d'édition (cause exacte non identifiée avec certitude — probablement un décalage de coordonnées entre la lecture de la page et le clic, les boutons "Enregistrer"/"Annuler" étant adjacents) : la diapositive réelle "OMRA 25 NOV" (id 5, seule diapositive existante, images desktop/mobile réelles déjà uploadées) s'est retrouvée avec titre/sous-titre/programme vidés (`updated_at` confirmant l'écriture au moment exact de l'incident). Détecté immédiatement par relecture directe de la base (jamais supposé qu'un clic avait réussi sans revérifier), avant de continuer.

- **Restauré** par `UPDATE` ciblé, à partir des valeurs exactes lues juste avant l'incident (titre/sous-titre en arabe, `program_id = 1`) — images (`image_url`/`mobile_image_url`, jamais touchées par l'incident) laissées intactes. Reconfirmé par requête directe puis visuellement sur `/admin/slider` et la page d'accueil publique (image, titre, sous-titre, bouton "Découvrir" → `/omra-hajj/omra-25-nov` tous corrects)
- **Leçon retenue pour la suite** : après toute séquence de clics sur un formulaire portant des données réelles (pas un enregistrement de test), revérifier immédiatement l'état en base plutôt que d'enchaîner l'action suivante en supposant que le clic précédent a fait ce qui était prévu — c'est cette revérification systématique qui a permis de détecter l'écrasement avant qu'il ne passe inaperçu
- Vérification du correctif lui-même faite ensuite **sans reproduire le risque** : diapositive de test créée/supprimée directement via l'API (`fetch` depuis la console du navigateur, pas de clics dans le formulaire) pour confirmer que titre/sous-titre/lien vides sont désormais acceptés (`POST` → 201) — `next build` réussi, compte temporaire supprimé après vérification

## 3quatrevingtsepttquadragies. Transfert d'un voyageur/groupe : autre chambre (même hôtel ou autre hôtel) ou autre voyage/programme

Demande explicite sur `/admin/voyages/[tripId]/hebergement` : après l'affectation, pouvoir transférer un voyageur **ou un groupe** vers une autre chambre (même hôtel ou autre hôtel), et le transférer **totalement** vers un autre programme.

- **Bouton "Transférer"** (nouveau `TransferModal.jsx`, même dossier) à côté de "Retirer" sur chaque occupant du tableau "Chambres", et sur les voyageurs/groupes non affectés (section voyage seule). La modale a deux parties :
  - **Changer de chambre** : chambres compatibles de la **même ville** que la chambre actuelle (donc même hôtel ou autre hôtel de cette ville — une chambre d'une autre ville s'ajouterait au lieu de remplacer, ce n'est pas un transfert), groupées par hôtel, filtrées client-side sur capacité/mixité (le serveur reste l'autorité). Si le voyageur est dans un groupe avec d'autres membres dans **la même chambre**, une case (cochée par défaut) déplace aussi ces membres
  - **Autre voyage** : liste des autres voyages ouverts/planifiés (`listOpenTripsForSelect`, tout programme confondu), confirmation en deux temps dans la modale
- **`assignRegistrationsToRoom(registrationIds, roomId)`** (`lib/roomAssignment.js`) : version multi-inscriptions en **une seule transaction** de `assignRegistrationToRoom` (conservée, devenue un wrapper) — un groupe n'est jamais déplacé à moitié. L'upsert par ville existant (§3cinquantecinququadragies) fait déjà d'une affectation sur une ville déjà affectée un vrai transfert (l'ancienne chambre de la ville est remplacée). Capacité = occupants restants (hors déplacés) + déplacés ≤ capacité ; mixité évaluée sur l'occupation **finale** de la chambre. `PUT /api/admin/registrations/[id]/room` accepte un `registrationIds` optionnel
- **`transferRegistrationToTrip(registrationId, targetTripId)`** (`lib/tripTransfer.js`, route `PUT /api/admin/registrations/[id]/transfer-trip`, permission `hebergement.manage`) : un membre de groupe n'est **jamais** déplacé seul (un groupe n'a qu'un voyage, `registration_groups.trip_id`) — le groupe entier suit, avec ses versements (`payments.group_id`). Remis à zéro : affectations de chambre, préférences d'hôtel, `selected_tier_id` (un tarif appartient à un voyage). **Conservés** : montant dû et versements — aucun recalcul silencieux d'un montant déjà encaissé, le personnel rechoisit le tarif/ajuste le montant depuis la fiche. Refusé si : même voyage, voyage de destination non `ouvert`/`planifie`, un voyageur est déjà inscrit au voyage de destination (`uq_traveler_per_trip`), passeport expirant moins de 6 mois après le départ du **nouveau** voyage (§3nonies), places insuffisantes (`total_seats` > 0), ou un voyageur figure dans une commande de billets d'avion de l'ancien voyage (`flight_booking_passengers`)
- `listAssignedRegistrationsForTrip` gagne `group_id`, `group_label`, `allow_mixed_gender_room`
- **Vérification** : script Node réel (vraies fonctions, loader ESM `.js`, voyage/programme jetables, nettoyés) — solo vers une autre chambre, groupe entier vers un **autre hôtel** en une transaction, refus "Chambre complète", transfert de groupe vers un autre voyage (voyage du groupe + membres mis à jour, 0 chambre restante, tarif remis à `NULL`), refus "déjà inscrit", refus passeport trop court, transfert solo ; modale ouverte en direct sur un vrai groupe (aucune soumission sur données réelles). `next build` réussi. ⚠️ Le refus pour mixité de genre n'a pas été isolé en test (la chambre testée était pleine avant) — vérifié par relecture de code uniquement

## 3quatrevingthuitquadragies. Date de délivrance du passeport (migration `029_add_passport_issue_date.sql`)

Demande explicite sur `/admin/inscriptions/new` : ajouter la **date de délivrance** du passeport. Nouvelle colonne `travelers.passport_issue_date` (DATE, nullable, placée avant `passport_expiry_date`), champ optionnel "Date de délivrance" inséré entre "N° Passeport" et "Date d'expiration" dans `TravelerFields.jsx` (création, inscription individuelle/binôme/groupe, et `AddGroupMemberForm.jsx` via le même composant) **et** `EditTravelerForm.jsx` (fiche existante, et modale "Informations Voyageurs" de la page groupe — `getGroupMembers` expose le champ).

- Persisté par `createRegistration` (INSERT/UPDATE voyageur existant), `updateTraveler` et lu par `getRegistrationById` (`lib/registrations.js`) ; non fourni par le scan MRZ (le code MRZ ne contient pas la date de délivrance), saisie manuelle
- **Règle** (`getPassportIssueDateError`, `lib/passportValidation.js`, revalidée côté serveur dans `POST /api/admin/registrations` et `PUT .../[id]/traveler`) : ni dans le futur, ni postérieure/égale à la date d'expiration ; côté client `max` = aujourd'hui sur le champ
- Non ajouté aux listes d'export (voyageurs/visa/compagnie) : pas demandé
- **Vérification** : migration appliquée ; création via l'API avec une date future → 400, avec une date valide → 201 ; champ présent entre N° Passeport et Date d'expiration sur `/admin/inscriptions/new` ; valeur relue pré-remplie dans la modale de `/admin/inscriptions/[id]?mode=edit` ; `next build` réussi ; données de test et compte temporaire supprimés

## 3quatrevingtneufquadragies. PNR de la compagnie aérienne (migration `030_add_trip_pnr.sql`)

Demande explicite sur `/admin/airlines` : un champ PNR lié à une compagnie, à remplir avec les **données réelles**. Un PNR est la référence d'une **réservation** auprès de la compagnie, pas une propriété de la compagnie elle-même : il est donc porté par le **voyage** (`trips.pnr`, VARCHAR(10), nullable — réservation groupe du voyage auprès de `trips.airline_id`), et `/admin/airlines` l'affiche par compagnie.

- **Saisie** : champ "PNR (référence de réservation)" dans la carte Aéroport de `/admin/programmes/[id]` (`AirportCard.jsx`, à côté de la compagnie) et dans `TripForm.jsx` ; normalisé en majuscules/trim (`TRIP_FIELD_MAP.pnr`, `createTrip`). Aucune valeur n'est inventée ni pré-remplie : vide tant que l'agence n'a pas saisi le PNR réel fourni par la compagnie
- **Affichage** : nouvelle colonne "PNR par voyage" sur `/admin/airlines` (`listTripsWithPnrByAirline`, `lib/airlines.js`) — pour chaque compagnie, ses voyages (lien vers le programme, date de départ) avec leur PNR, ou "PNR à renseigner" s'il manque
- **Liste `/admin/inscriptions`** : la colonne "Voyage" (référence du voyage) est remplacée par **"N° PNR"** (`listRegistrations` expose `t.pnr`, "—" si non saisi), la date de départ restant en sous-ligne
- Distinct de `flight_bookings.booking_reference` (PNR renvoyé par Duffel, §3ter, jamais testé en réel) : aucune synchronisation entre les deux
- **Vérification** : migration appliquée ; PNR " zz1234 " enregistré via l'API → relu "ZZ1234" et affiché sur `/admin/airlines`, puis remis à `NULL` (voyage réel intact) ; `next build` réussi ; compte temporaire supprimé

## 3quatrevingtdixquadragies. Liste passagers pour la compagnie aérienne (PNR), colonnes au choix

Positionnée en **deuxième** (juste après la liste d'hébergement). Demande explicite sur `/admin/voyages/[tripId]/listes` : une liste destinée à la compagnie aérienne avec **N° PNR, Nom complet, Date de naissance, N° Passeport, Date de délivrance, Date d'expiration**, et un choix de contenu pour s'adapter au besoin de chaque compagnie. Nouvelle section "Liste passagers pour la compagnie aérienne (PNR)", **à côté** de la liste compagnie existante par gabarit (§3, format RAM/Saudia/Turkish, inchangée — deux usages différents, aucune fusion).

- **`lib/pnrListColumns.js`** (fichier pur, partagé client/serveur) : catalogue des colonnes — les 6 demandées cochées par défaut, plus en option Nom (arabe), Genre, Téléphone (WhatsApp), Date de départ, Date de retour. Ajouter une colonne = une entrée ici (+ le champ dans `getPnrPassengerList`)
- **`PnrListOptions.jsx`** (composant client) : cases à cocher, liens Excel/PDF qui transmettent `?columns=pnr,full_name,...` (ordre du catalogue conservé quel que soit l'ordre des clics) ; téléchargement désactivé si aucune colonne cochée
- **`GET /api/admin/trips/[tripId]/lists/pnr?format=xlsx|pdf&columns=...`** : colonnes validées contre le catalogue (clé inconnue ignorée, aucune colonne valide → 400), repli sur les 6 par défaut si `columns` absent. Réutilise les exporters existants (`buildExcelBuffer`/`buildPdfBuffer`) avec `infoLines` (programme, compagnie, PNR du voyage, nombre de voyageurs) — la colonne arabe reste exclue du PDF (limite Helvetica, déjà documentée)
- **`getPnrPassengerList`** (`lib/listGenerators.js`) : tous les inscrits **non annulés** du voyage (pas seulement confirmés/payés comme la liste par gabarit — la compagnie doit voir tous les passagers à réserver) ; le PNR vient de `trips.pnr` (§3quatrevingtneufquadragies), dates en jj/mm/aaaa. Les colonnes vides (PNR non saisi, passeport/délivrance non renseignés) restent vides, jamais de valeur inventée
- **Vérification** : build réussi ; en direct (compte temporaire) Excel/PDF 200, sélection de 3 colonnes 200, colonne inconnue 400 ; contenu du xlsx relu avec exceljs (infoLines, en-têtes dans l'ordre demandé, 11 passagers) — les cellules passeport/PNR sont vides car les voyageurs réels n'ont pas encore ces données

## 3quatrevingtonzequadragies. Liste passagers PNR : format d'affichage par information + PDF finalisé

Suite directe de §3quatrevingtdixquadragies, demande explicite : finaliser le PDF de la liste passagers (PNR) pour qu'il s'adapte à chaque compagnie, avec des **listes déroulantes de format** pour chaque information cochée — dates (01/01/2026, 01 JAN 2026, 01-01-2026, 01 janvier 2026, etc.), genre (Homme/Femme, H/F...), et de même pour les autres informations.

- **`lib/pnrListColumns.js`** (fichier pur, partagé client/serveur) : chaque colonne porte un `type` (`date`, `gender`, `name`, `passport`, `phone`) et `FORMATS_BY_TYPE` liste les formats disponibles — **21 formats de date** (jj/mm/aaaa, jj-mm-aaaa, jj.mm.aaaa, jj/mm/aa, mm/jj/aaaa US, ISO, aaaa/mm/jj, aaaammjj, jjmmaaaa, jj MOIS aaaa, jj Mois aaaa, jj-MOIS-aaaa, jjMOISaaaa, jjMOISaa, mois complet EN en majuscules/normal, "Mois jj, aaaa", mois complet FR en minuscules/majuscules, "j mois aaaa", mois abrégé FR "sept."), **9 formats de genre** (Homme/Femme, HOMME/FEMME, H/F, Masculin/Féminin, Male/Female, MALE/FEMALE, M/F, MR/MRS, MR/MS), **noms** (tel que saisi, MAJUSCULES, MAJUSCULES sans accents, Première Lettre Majuscule, minuscules), **passeport** (tel que saisi, MAJUSCULES, sans espaces/tirets), **téléphone** (tel que saisi, chiffres uniquement, +212..., 00212... — un numéro marocain local `0XXXXXXXXX` est converti en indicatif 212). `formatPnrValue(column, rawValue, formatKey)` applique le format ; clé inconnue → premier format du type, valeur vide/illisible → vide/texte brut. **Une seule source de vérité** : l'interface tire de `getFormatOptions` l'exemple affiché dans chaque liste déroulante (calculé avec `formatPnrValue` sur une valeur d'exemple, jour 7 ≠ mois 9 pour distinguer jj/mm de mm/jj), donc ce qu'on voit à l'écran est exactement ce que produit le fichier. Le N° PNR et le nom arabe n'ont pas de format (rien à choisir)
- **`PnrListOptions.jsx`** : à côté de chaque colonne cochée, une liste déroulante de format (exemples réels) ; options globales **Langue des en-têtes** (Français/English — `headerEn` par colonne, ex. "Passport No.", "Date of issue"), **Orientation du PDF** (Automatique/Portrait/Paysage), **Numéroter les lignes** (colonne "N°"). Paramètres envoyés : `columns`, `f=colonne:format,...`, `lang`, `orient`, `num`
- **`getPnrPassengerList`** renvoie désormais les valeurs **brutes** (dates "AAAA-MM-JJ", genre "homme"/"femme") — le formatage est appliqué par la route (`GET .../lists/pnr`), qui le partage entre Excel et PDF : mêmes valeurs dans les deux fichiers, en-têtes dans la langue choisie, infos d'en-tête (Programme, Compagnie/Airline, PNR, dates du voyage, nombre de voyageurs) traduites aussi
- **`lib/exporters/pnrPdf.js`** (nouveau, exporteur dédié — l'exporteur générique `pdf.js`, utilisé par les 3 autres listes, reste inchangé) : bandeau d'en-tête (nom de l'agence, titre, filet doré, infos programme/compagnie/PNR/dates/effectif), tableau à **en-tête doré répété sur chaque page**, lignes zébrées, largeurs de colonnes proportionnelles au contenu (noms plus larges, genre/N° étroits), police réduite automatiquement au-delà de 6/8 colonnes, **pied de page** (date d'édition + "Page X / N"), orientation automatique (portrait jusqu'à 6 colonnes, paysage au-delà). Nom arabe toujours exclu du PDF (limite Helvetica). ⚠️ Même piège pdfkit que §3soixanteseizequadragies pour le pied de page (`margins.bottom = 0` le temps de le dessiner) ; ⚠️ la flèche "→" n'existe pas dans Helvetica (rendue "f") — la plage de dates du voyage utilise un tiret demi-cadratin "–"
- **Vérification** : build réussi ; catalogue de formats exécuté et relu (exemples de chaque liste, conversions de téléphone, valeur vide/illisible) ; PDF de 70 lignes généré en auto/portrait/paysage (3/2/3 pages, `MediaBox` correcte) et **relu visuellement** dans le navigateur (en-tête, en-tête de tableau répété page 2, zébrage, pied de page) ; téléchargement réel authentifié avec formats variés (`dd_MON_yyyy`, `ddMONyy`, `dd_mois_yyyy_fr`, genre `en_short`, `upper_ascii`, `intl_plus`, `lang=en`, `num=1`) — contenu de l'Excel relu cellule par cellule, `columns` invalide → 400 ; fichiers de test et compte temporaire supprimés

## 3quatrevingtdouzequadragies. Multilingue AR / FR / EN sur tout le système, **arabe langue principale**

⚠️ **Remplace** l'approche "cookie seul, aucune URL modifiée" de §3cinquantedeuxquadragies et lève le report documenté en §3quinquies : le routage par préfixe de langue est maintenant en place. Demande : "activer les langues dans toutes les parties du système (admin et client) et rendre la langue arabe principale".

### Site public — URLs préfixées, arabe sans préfixe

- Toutes les pages publiques vivent sous `app/(site)/[locale]/...` (`generateStaticParams` sur `ar`/`fr`/`en`, `dynamicParams = false` → toujours statique/ISR, pas de régression SEO). `/xyz` → 404.
- **Arabe = langue par défaut et SANS préfixe** (`/`, `/omra-hajj`, `/a-propos`...) ; français sous `/fr/...`, anglais sous `/en/...`. ⚠️ **Conséquence** : l'ancien français sans préfixe est maintenant de l'arabe — tout lien externe/favori vers une page publique affichera l'arabe ; le français est à `/fr/...`.
- `proxy.js` : une URL non préfixée est *réécrite* en interne vers `/ar/...` ; `/ar/...` est redirigé (308) vers l'URL sans préfixe ; `/fr` et `/en` passent tels quels. Exclus du traitement (`NON_LOCALIZED`) : `api`, `admin`, `uploads`, `_next`, `feed.xml`, `llms.txt`, `sitemap.xml`, `robots.txt`, `favicon`, tout fichier avec extension.
- `lib/i18n/locales.js` : `SUPPORTED_LOCALES`, `DEFAULT_LOCALE = "ar"`, `localizePath`, `stripLocalePrefix`, `isRtl`, `INTL_TAGS`. `app/_components/LocalizedLink.jsx` préfixe automatiquement les liens internes ; `LanguageSwitcher.jsx` change le préfixe d'URL (+ cookie `gf_locale` pour mémoriser) en conservant la query string.
- **SEO** : `lib/i18n/seo.js` → `pageAlternates(locale, path)` (canonical + `hreflang` ar/fr/en/x-default réciproques) utilisé par chaque `generateMetadata` ; `app/sitemap.js` liste chaque page dans les 3 langues avec ses alternates ; `llms.txt` mentionne les langues ; le flux RSS est en arabe (`<language>ar</language>`) ; JSON-LD localisé ; `<html lang dir>` posé côté serveur par le layout `[locale]`.
- **RTL** : classes Tailwind logiques (`ms-/me-/ps-/pe-/start-/end-/text-start/text-end/border-s/border-e`) — un codemod a converti les classes physiques de ~25 fichiers (`app/admin`, `app/_components`, `app/(site)`) ; flèches ←/→ inversées selon la langue. Police **Cairo** pour l'arabe ; espacement de lettres neutralisé pour l'arabe (`globals.css`). Nouveaux composants : toujours des propriétés logiques, jamais `left/right/ml/mr`.

### Mécanisme de traduction (`lib/i18n/`)

- **Clé = texte source FRANÇAIS** (pas de clés abstraites) : `tr("Devis gratuit")`. Texte absent du dictionnaire → texte français inchangé, jamais de clé technique à l'écran.
- `translate.js` : `makeTranslator(locale, scope)` avec `scope` = `"public"` | `"admin"` (admin retombe sur les dictionnaires publics pour les textes partagés — villes, pays, saisons… —, l'inverse est faux pour ne pas embarquer l'admin dans les pages publiques). Variables `{var}`, **pluriels** (objet `{zero,one,two,few,many,other}` — l'arabe en a six, indispensable pour "15 أيام"/"3 مقاعد"…) via `tr("{count} voyageurs", {count})` ou `tr.plural(frSingulier, frPluriel, count)`. Une entrée contenant `{var}` sert aussi de **motif** pour traduire un texte déjà assemblé (message d'erreur serveur, libellé construit en JS) — les valeurs capturées sont traduites si elles ont une entrée exacte (ex. statut brut `planifie`). Recherche insensible à la casse (données saisies en base : `MASJID NABAWI`).
- Dictionnaires : `translations/public.ar.js`, `public.en.js` (site public, API messages, villes/pays/saisons/thèmes/devises), `admin.ar.js`, `admin.en.js` (~775 entrées chacun, parité exacte vérifiée). **Pour ajouter un texte** : ajouter la clé française dans les 2 fichiers de la portée concernée.
- `scripts/i18n-check.mjs public [--list]` : vérifie que chaque `tr("...")` littéral du site public est traduit (0 manquant à la livraison ; ne détecte pas les clés de `tr.plural`) ; `scripts/i18n-extract.mjs` (candidats de traduction par analyse Babel) et `scripts/i18n-templates.mjs` (chaînes dynamiques) servent à compléter les dictionnaires.
- Un motif trop générique (`"{a} double"`) attraperait des textes inattendus : ne pas ajouter de motifs à une seule variable collée à un mot courant.

### Espace interne (`/admin`) — langue par cookie, traducteur DOM

L'admin n'a **pas** de préfixe d'URL (session, pas de SEO). Langue = cookie `gf_locale` (défaut **arabe** sans cookie), lue côté serveur par `app/admin/layout.js` (déjà dynamique) qui pose `<html lang dir>`, la police, les libellés de navigation (traduits côté serveur) et `AdminLanguageSwitcher` (bas de barre latérale + page de connexion ; changer de langue = cookie + rechargement).

Les ~80 écrans contiennent des textes français en dur : plutôt que de réécrire chaque composant, `app/admin/_components/AdminLocale.jsx` (`startDomTranslation`) remplace après affichage le texte des nœuds DOM et les attributs `placeholder/title/aria-label/alt` d'après le dictionnaire admin, avec un `MutationObserver` pour tout contenu ajouté ensuite (modales, messages d'erreur, navigation) ; `window.alert` est aussi patché. Éléments `translate="no"`, `<textarea>`, `<code>`, `<pre>`, scripts ignorés ; **les valeurs saisies dans les champs ne sont jamais touchées**.
- ⚠️ **Hydratation** : la traduction ne doit démarrer qu'APRÈS l'hydratation React (y compris les frontières `<Suspense>` hydratées plus tard, ex. `useSearchParams` sur la page de connexion), sinon "Hydration failed" (texte modifié avant que React le compare). Le démarrage sonde donc que chaque élément porte sa propriété interne `__reactFiber$…` (max 3 s, puis traduit quand même). La page reste masquée (`html[data-i18n-pending] body { visibility: hidden }`) jusque-là — un `<noscript>` lève ce masquage si JS est désactivé.
- Les textes **assemblés en JS avec pluriel** (nombre de voyageurs/chambres/hôtels…) ne peuvent pas être traduits par simple remplacement de nœud : ils passent par `useAdminLocale().tr.plural(...)` (`ProgramManagerGrid`, `HotelsCard`, `NewRegistrationForm`, `EditRegistrationForm`, `FlightBookingManager`, `HebergementManager`). Hook : `const { tr } = useAdminLocale();`.
- Audit en direct : `window.__i18nMissing` (Set) liste, dans la console de la page admin ouverte, chaque texte latin non traduit rencontré ; un texte propre à une donnée (noms de voyageurs, hôtels, programmes, codes IATA) y apparaît légitimement. Audit réalisé sur tableau de bord, inscriptions (liste, fiche, modales), programmes (fiche, tuiles/modales), finances, hébergement, listes, billets, hôtels, paramètres, nouvelle inscription : seuls des noms/données restent non traduits.

### Hors périmètre / limites à connaître

- **Contenu saisi en base non traduit** : titres/descriptions de programmes, FAQ, actualités, diapositives, noms d'hôtels et de voyageurs s'affichent tels que saisis (français) même sous `/` en arabe — une vraie traduction du contenu éditorial demanderait des colonnes/tables de traductions par entité (chantier séparé). Les libellés structurels (saisons, thèmes, villes, pays, statuts) sont, eux, traduits.
- **Exports PDF/Excel/reçus restent en français** (Helvetica ne contient pas l'arabe ; les en-têtes de la liste PNR ont leur propre option de langue, §3quatrevingtdixquadragies).
- **Les traductions arabe et anglaise ont été rédigées par IA** : à relire par un locuteur natif avant mise en production (vocabulaire du pèlerinage, formules juridiques des mentions légales/confidentialité en particulier).
- Le `LocaleProvider` public reçoit désormais la langue par prop depuis l'URL (plus de lecture de cookie côté client → plus de "flash" français au chargement).
- Vérification : `next build` réussi (pages publiques statiques en `/ar`, `/fr`, `/en`) ; tests en direct des 3 langues sur le site public et sur l'admin (compte `direction` temporaire, supprimé), RTL/LTR, changement de langue, pluriels arabes, motifs composés ; parité `admin.ar`/`admin.en` contrôlée par script (0 clé manquante).

## 3quatrevingttreizequadragies. Multi-agences — passe 2 : isolation des données, pages publiques par agence, branding

Exécution du plan de §3sexvicies ("Reste à faire"). Le système héberge désormais **réellement** plusieurs agences indépendantes : une agence ne lit, ne modifie et ne supprime jamais rien d'une autre, que ce soit via les pages, les routes API ou les exports. Une agence se crée avec `npm run create-agency -- "Nom" sous-domaine`, puis `npm run create-staff -- "Nom" email mdp direction <agencyId>`. Test local : `http://<sous-domaine>.localhost:3000` ; production : `https://<sous-domaine>.<ROOT_DOMAIN>`.

### 1. Filtrage par agence — `lib/agencyContext.js` (point unique)

- **`resolveAgencyId(explicit?)`** — l'agence de la requête : un `agencyId` **explicite** (pages publiques statiques), sinon l'en-tête interne `x-agency-id` posé par `proxy.js`, sinon (scripts/tests) `setScriptAgencyId(n)`. ⚠️ **Fail closed** : sans agence identifiable, erreur — jamais de repli silencieux sur l'agence 1.
- **Toutes** les fonctions de `lib/*.js` (29 fichiers, ~250 requêtes) filtrent `WHERE agency_id = ?` et posent `agency_id` dans chaque `INSERT` ; les tables enfants (`trip_hotel_tier_prices`, `program_faqs`...) portent aussi la colonne. Le catalogue `services` (resté global en passe 1, alors que `/admin/services` permettait de le modifier depuis n'importe quelle agence) reçoit `agency_id` (migration `031`).
- **`assertOwned(table, id, agencyId, connection?)` / `assertAllOwned`** — appelés **avant** tout INSERT/UPDATE/DELETE qui référence un identifiant venu du client (`tripId`, `hotelId`, `roomId`, `groupId`, `roleId`, cible d'un paiement...). Une clé étrangère valide en base ne prouve pas que la ressource est à nous : sans ce contrôle, un `tripId` d'une autre agence aurait été accepté. Tous les `update*`/`delete*` par id l'appellent aussi (sinon un `UPDATE ... WHERE id = ? AND agency_id = ?` sans ligne concernée répondrait un faux succès). Lève `err.code = "NOT_FOUND"`.
- **`lib/apiGuard.js` → `withNotFound(handler)`** enveloppe les 63 routes API (`export const PUT = withNotFound(PUT_handler)`) et **chaque `catch (err)`** de route convertit `NOT_FOUND` en **404 "Ressource introuvable"** — le même message qu'une ressource inexistante : aucune différence observable entre "n'existe pas" et "est à une autre agence".
- Points de vigilance de §3sexvicies traités : voyageur retrouvé par WhatsApp **dans l'agence seulement** (`createRegistration`, `createVisaServiceRequest`, `/api/reservations`) ; `listRoles`/`getPermissionsMatrix`/`createRole`/`deleteRole`/`setRolePermissions` filtrés (`role_permissions` n'a pas d'`agency_id` : filtrage via `roles`) ; vues `v_trip_traveler_list`/`v_trip_airline_list` (pas de colonne agence) précédées d'un `assertOwned("trips", tripId)`.
- Fonctions **publiques** (appelées par des pages statiques) : `agencyId` explicite en dernier paramètre ou dans `filters.agencyId` (`getProgramsByFamily`, `getProgramBySlug`, `getOpenTripsForProgram`, `listActiveSlides`, `listPublishedNews`, `getPublishedNewsBySlug`, `getAgencySettings`, `listPublishedFaqsForProgram`...) — elles ne lisent **jamais** `headers()`.
- **Migration `033`** : `agency_id` perd son `DEFAULT 1` sur les 34 tables (et `schema.sql`) — un `INSERT` qui oublie l'agence **échoue bruyamment** au lieu de rattacher silencieusement la ligne à l'agence 1.

### 2. Pages publiques : segment `[agency]` pour rester statiques/ISR

Lire l'agence via `headers()` aurait rendu dynamiques toutes les pages publiques (perte du cache ISR, priorité SEO n°1). À la place, **`proxy.js` réécrit chaque URL publique en `/<sous-domaine>/<langue>/...`** (jamais visible dans le navigateur) et les pages vivent sous **`app/(site)/[agency]/[locale]/...`** (déplacées depuis `app/(site)/[locale]/`, aucune URL visible ne change). `generateStaticParams` du layout pré-génère agences actives × 3 langues ; une agence créée après le build est rendue à la première visite puis mise en cache. `lib/publicAgency.js` (`requirePublicAgency(subdomain)`, 404 si inconnue/inactive) fournit l'agence à chaque page, qui la transmet explicitement aux fonctions publiques. Tout chemin public est réécrit par le proxy : un client ne peut pas atteindre `/<autre-agence>/...` en le tapant (il serait préfixé par SON sous-domaine).

Routes dynamiques par nature (`force-dynamic`, agence via `x-agency-id`, `lib/currentAgency.js` → `getCurrentAgency()` → `{id, name, subdomain, baseUrl}`) : `sitemap.xml`, `robots.txt`, `llms.txt`, `feed.xml`, `/api/public/programs`. `robots.txt` annonce le sitemap **du sous-domaine demandé**.

### 3. Branding par agence

- **`agency_settings` est déprécié** (conservé en base, plus lu ni écrit) : `lib/agencySettings.js` lit/écrit la ligne de **`agencies`** (migration `032` : recopie finale de ce qui avait été modifié dans `/admin/parametres` depuis la passe 1) ; réseaux sociaux par `agency_id`.
- "Golden Fantastic" n'est plus codé en dur : titres/méta/JSON-LD/header/footer/hero (site public), barre latérale + titre + page de connexion (admin), `llms.txt`, flux RSS. Les ~100 phrases de dictionnaire qui contiennent le nom ne sont **pas** dupliquées : `makeTranslator(locale, scope, { brandName })` remplace "Golden Fantastic" par le nom de l'agence dans le texte final (`LocaleProvider`/`AdminLocaleProvider` reçoivent `brandName`).
- **`siteBaseUrl(subdomain)`** (`lib/i18n/seo.js`) : `ROOT_DOMAIN` défini → `https://<sous-domaine>.<ROOT_DOMAIN>` ; sinon l'agence historique → `NEXT_PUBLIC_SITE_URL` ; sinon `http://<sous-domaine>.localhost:3000`. Sert aux canonical/hreflang/JSON-LD/sitemap.
- **Uploads** : désormais `public/uploads/agencies/<agencyId>/<dossier>/` (route `POST /api/admin/upload`). Les fichiers envoyés avant (`public/uploads/<dossier>/`) restent à leur emplacement — leur URL est déjà en base.

### 4. Garde-fous permanents

- **`npm run lint:agency`** (`scripts/agency-lint.mjs`) : repère toute requête SQL sur une table métier qui ne mentionne pas `agency_id` (code de sortie 1). Une exception légitime se marque par un commentaire SQL `-- agency-lint-ok: raison` (utilisé 6 fois : fragments `WHERE` dynamiques et sous-requêtes dont la clé est déjà filtrée). À lancer après toute nouvelle requête.
- **`npm run test:agency`** (`scripts/agency-isolation-test.mjs`, ~60 contrôles) : crée une agence temporaire, y fabrique données et lit/écrit en tant qu'agence 1 pour vérifier lectures, écritures et suppressions croisées (tout doit échouer en `NOT_FOUND`/ne rien faire), puis supprime tout. Nécessite le chargeur `scripts/esm-register.mjs` (les `lib/*.js` utilisent des imports sans extension, pensés pour le bundler de Next).

### Limites connues / à décider

- **Clé Duffel unique** (`DUFFEL_API_KEY`) partagée par toutes les agences : l'achat de billets (§3ter, jamais testé en réel) n'est pas isolé financièrement. À rendre propre à chaque agence (colonne chiffrée sur `agencies`) avant que deux agences achètent des billets.
- **Déploiement** : DNS wildcard + certificat `*.<ROOT_DOMAIN>` toujours à faire ; `ROOT_DOMAIN` à renseigner (nom de domaine non choisi, §7). En production sans `ROOT_DOMAIN` ni sous-domaine résolu, le proxy renvoie 404 — pas de repli.
- **Tables WhatsApp/n8n** (`whatsapp_*`) portent `agency_id` mais ne sont encore lues/écrites par aucun code.
- Aucune interface super-admin (création d'agence en ligne de commande, décision de §3sexvicies).
- Les dictionnaires i18n (§3quatrevingtdouzequadragies) restent communs à toutes les agences ; le contenu éditorial saisi en base appartient, lui, à chaque agence.

### Vérification effectuée

`next build` réussi (route table : `/[agency]/[locale]/…` générée pour chaque agence × langue, pages restées statiques/ISR). `npm run lint:agency` OK, `npm run test:agency` **tous les contrôles passent**. **Test HTTP réel à deux agences** (`agence2.localhost:3000` vs `localhost:3000`, comptes `direction` dans chacune) : l'admin de l'agence 1 tentant 22 actions (lecture/modification/suppression d'inscription, voyage, programme, hôtel, paiement, rôle, reçu PDF, listes, réservation publique...) sur des ressources de l'agence 3 → **22 × 404/403, aucune donnée modifiée** (relecture SQL) ; symétriquement l'agence 3 sur celles de l'agence 1 ; un compte de l'agence 3 ne peut pas se connecter sur le sous-domaine de l'agence 1 (401) ; le cookie de l'agence 1 présenté au sous-domaine de l'agence 3 → 403. Pages publiques : chaque agence ne voit que son catalogue (aucune occurrence de l'autre agence ni de "Golden Fantastic" dans les pages de l'agence 2), `<title>`, `llms.txt`, `sitemap.xml`, `robots.txt` et pied de page propres à chaque sous-domaine ; contact et réservation publics rattachés à la bonne agence ; réservation croisée → 404 ; upload écrit sous `uploads/agencies/<id>/`. Les 21 pages admin principales de l'agence 1 répondent normalement après refonte. Agence de test, comptes temporaires et fichiers supprimés.

## 3quatrevingtquatorzequadragies. Liste des inscrits regroupée par programme

Demande sur `/admin/inscriptions` : la colonne **N° PNR** (sans importance ici — le PNR reste saisi sur le voyage et visible sur `/admin/airlines`, §3quatrevingtneufquadragies) est remplacée par le **second numéro de téléphone** (`travelers.phone`, "N° Tél"), et l'affichage se fait **par programme** : un bloc par voyage, **nom du programme en haut à gauche** (date de départ en discret à côté, utile quand un programme a plusieurs départs), puis un tableau numéroté **N° / Nom Complet / N° WhatsApp / N° Tél / Statut / Visa** (+ liens Afficher/Modifier, inchangés, et lien vers le groupe à côté du nom).
- `listRegistrations` (`lib/registrations.js`) expose `tr.phone` et `p.id AS program_id`, et trie désormais par programme, date de départ puis ordre d'inscription (avant : inscription la plus récente en premier) ; le regroupement par voyage est fait dans la page. Les filtres (voyage, statut, recherche) fonctionnent comme avant et ne laissent que les blocs concernés.

## 3quatrevingtquinzequadragies. Mention de droits réservés dans le pied de page

`SiteFooter.jsx` affiche, sous la barre du bas, **« Tous droits réservés — STE BUSINESS KEEPER (0661327686) »** (clé `Tous droits réservés` traduite ar/en ; le numéro est un lien `tel:`). Mention **identique pour toutes les agences** (exploitant de la plateforme, pas l'agence) : le nom et le numéro sont volontairement codés en dur dans le composant, `translate="no"` / `dir="ltr"` pour rester lisibles en arabe.

## 3quatrevingtseizequadragies. Nom du voyageur en arabe dans la liste des inscrits

Quand l'espace interne est en **arabe** (cookie `gf_locale`, défaut), `/admin/inscriptions` affiche le **nom arabe saisi à l'inscription** (`travelers.full_name_arabic`) à la place du nom d'origine ; repli sur `full_name` si aucun nom arabe n'a été saisi (jamais de cellule vide), et en français/anglais le nom d'origine reste affiché. `lib/adminLocale.js` : `getAdminLocale()` (langue côté serveur, pour adapter les **données** et pas seulement les libellés) et `displayTravelerName(row, locale)`. Le nom est dans un `<span translate="no">` pour que le traducteur DOM n'y touche pas. La **recherche** (`listRegistrations`, paramètre `q`) couvre aussi `full_name_arabic`. Portée volontairement limitée à cette liste (demande) : les fiches, groupes, listes d'hébergement et exports gardent le nom d'origine.

## 3quatrevingtdixseptquadragies. Nom d'hôtel en arabe (migration `034_add_hotel_name_arabic.sql`)

Nouveau champ **« Nom en arabe »** (optionnel) sur le formulaire d'hôtel (`/admin/hotels`, création et modification) : `hotels.name_arabic`. **Quand la langue est l'arabe, tous les écrans et formulaires rattachés affichent ce nom** à la place de `name` (repli sur `name` si vide) : liste des hôtels, hôtels habituels et tarifs d'hébergement d'un programme (menus Mecque/Médine, résumés de tarifs), page hébergement (hôtels du voyage, chambres, menus d'affectation/transfert, préférences), libellés de tarif à l'inscription, fiche inscription, **et le site public** (ligne « Hébergement » des départs d'un programme Omra/Hajj).
- **Une seule règle, côté SQL** (`lib/hotelNames.js` : `hotelNameSql(alias, locale)` + `adminHotelLocale()`), appliquée dans les requêtes qui alimentent ces écrans — aucun composant n'a été réécrit un par un. Les listes d'hôtels (`listHotels`, `listDefaultHotelsForProgram`) gardent `name` intact (nécessaire au formulaire d'édition) et ajoutent `display_name`, que les menus affichent.
- **Admin** : la langue est celle du cookie `gf_locale` ; hors requête (scripts), repli sur le nom d'origine. **Site public** : la langue est celle de la page, passée explicitement (`getOpenTripsForProgram(programId, agencyId, locale)`), jamais lue d'un cookie (pages statiques/ISR).
- **Exports PDF/Excel inchangés** (`lib/listGenerators.js`) : Helvetica n'a pas de glyphes arabes, ils gardent le nom d'origine ; les messages d'erreur serveur (ex. chevauchement d'hôtels) aussi.
- Vérifié en réel (nom arabe posé temporairement sur un hôtel, puis retiré) : admin en arabe → nom arabe partout, en français → nom d'origine ; page publique `/omra-hajj/...` en arabe → nom arabe, `/fr/...` → nom d'origine.

## 3quatrevingtdixhuitquadragies. Charte visuelle de l'espace interne (designadmin.md)

L'espace interne reprend la maquette « Tableau de bord - Golden Fantastic » (fournie par l'agence). **Référence unique : `designadmin.md`** (jetons, typo, composants, règles RTL) — à suivre pour toute nouvelle page admin, dans les 3 langues.
- `app/admin/admin-theme.css` : la palette Tailwind (`zinc`/`emerald`/`amber`/`red`/`blue`, rayons, `text-sm`) est **remappée** sous `html.gf-admin` → les ~80 écrans existants adoptent la charte sans réécriture ; défauts des champs/tableaux/cartes en `@layer base` (une classe utilitaire garde la main) ; composants `gf-*` en `@layer components`.
- Shell `AdminShell.jsx` (remplace `AdminSidebarNav.jsx`/`LogoutButton.jsx`, supprimés) : barre latérale sombre groupée avec icônes, repliable (état dans `localStorage`), tiroir ≤ 900px, en-tête (fil d'Ariane, « Créer » selon la section), palette **Ctrl/Cmd + K**. Navigation et permissions : `NAV_GROUPS`/`QUICK_ACTIONS` dans `app/admin/layout.js` ; pastille « Inscrits » = `countActiveRegistrations()`.
- Icônes Material Symbols Rounded, police chargée en **sous-ensemble** Google Fonts : toute nouvelle icône doit être ajoutée à `ADMIN_ICON_NAMES` (`Icon.jsx`, liste triée). Polices : Geist + Noto Kufi Arabic (Cairo n'est plus chargée côté admin).
- `PageHeader` sur les pages de premier niveau ; tableau de bord et liste des inscrits refaits à l'identique de la maquette ; tuiles de module avec icône ; total dû/encaissé/solde en tête de `/admin/finances` (direction/comptabilité, même règle que les totaux §3soixanteonzequadragies).
- Éléments de la maquette **non** implémentés car factices : « Assistant » IA et notifications. La carte « Suggestions de l'assistant » devient « À traiter », calculée sur données réelles (paiements partiels des départs à venir, PNR manquant quand une compagnie est choisie, places restantes du prochain départ).
- **Liste des inscrits en accordéon** (`ProgramAccordion.jsx`) : un tableau par voyage, **un seul ouvert à la fois** (ouvrir un programme referme les autres, recliquer le referme) ; ouvert par défaut : le voyage filtré (`tripId`), sinon le prochain départ à venir, sinon le premier ; l'en-tête affiche date, nombre d'inscrits et pastilles payé complet/partiel ; un changement de filtre/recherche réinitialise la section ouverte.
- **Fiche inscription réorganisée** : en-tête (avatar, nom + nom arabe, pastille de statut, programme/date/visa, retour à la liste), carte « Récapitulatif » (chambre, préférence, groupe, billet, avec icônes), puis « Dossier du voyageur » en tuiles larges avec valeurs mises en forme (pastilles de statut traduites, « payé / dû » en MAD, validité du passeport) au lieu des codes bruts (`paye_complet`, `accorde`). Libellés/tons partagés : `app/admin/_components/statusStyles.js`.

## 3quatrevingtdixneufquadragies. Charges financières des programmes (migration `035_add_trip_expenses.sql`)

Nouvelle tuile **« Charges financières »** sur `/admin/programmes/[id]` (modale large, `ExpensesCard.jsx`) : coûts supportés par l'agence pour le **voyage principal** (même rattachement que Aéroport/Hôtels/Tarifs), par catégorie — **hôtels** (lien optionnel vers un hôtel du catalogue), **billets d'avion** (lien optionnel vers une compagnie), **équipe / guide**, **accessoires / cadeaux**, **autres** — chacun avec un **échéancier** d'une ou plusieurs dates de paiement (ex. compagnie payée en 3 fois).
- Tables `trip_expenses` (catégorie, libellé, fournisseur, `hotel_id`/`airline_id` ON DELETE SET NULL, montant, notes ; `trip_id` ON DELETE CASCADE) et `trip_expense_installments` (`due_date`, `amount`, `paid_date` NULL = à payer, mode, référence ; cascade sur la charge). Les deux portent `agency_id` (ajoutées à `TENANT_TABLES` de `lib/agencyContext.js` et de `scripts/agency-lint.mjs`).
- `lib/tripExpenses.js` : `listExpensesForTrip`, `createExpense`/`updateExpense` (transaction, échéancier purgé + réinséré — le client renvoie toujours la liste complète, paiements compris), `deleteExpense`, `setInstallmentPaid`. Validation serveur (`normalizeExpense`) : catégorie, libellé, montant > 0, chaque échéance datée et > 0, **total des échéances ≤ montant** (un reste « non planifié » est autorisé et affiché).
- Routes : `GET/POST /api/admin/trips/[tripId]/expenses`, `PUT/DELETE /api/admin/trip-expenses/[id]`, `PUT /api/admin/trip-expense-installments/[id]` (marquer payée / annuler).
- Interface : synthèse (total, payé, reste à payer, retard ou prochaine échéance), charges groupées par catégorie avec barre de paiement, échéances datées (« Payé le », « À payer », « En retard »), bouton « Marquer payé » (date du jour) ; formulaire avec raccourcis « Paiement unique / Répartir en 2 / en 3 » (échéances mensuelles à partir d'aujourd'hui, la dernière absorbe l'arrondi) et saisie libre date/montant/payé le (+ mode et référence si payé). Dates en **heure locale** (`toISOString` donnait la veille en soirée).
- **Permissions** (matrice `/admin/parametres/roles`, catégorie « Paiements & finances ») : `charges.view` (voir la tuile) et `charges.manage` (ajouter/modifier/supprimer, marquer payé) — accordées par défaut à direction et comptabilité. La tuile n'apparaît que pour un rôle ayant l'une des deux.
- **Retour d'usage** : le menu « Hôtel » ne propose que les hôtels **affectés au programme** (hôtels habituels + hôtels attachés au voyage) et le menu « Compagnie aérienne » que la **compagnie du voyage** — un choix déjà enregistré qui ne serait plus affecté reste affiché en édition (`withCurrent`). Le **libellé est facultatif** (stocké vide) : l'interface affiche à sa place l'hôtel, la compagnie ou la catégorie.
- **Date de paiement dans le futur = « Paiement en cours »** (`installmentState`, `ExpensesCard.jsx`) : une échéance n'est comptée « payée » (synthèse, barre, « Payé : », tuile) que si sa date de paiement est aujourd'hui ou passée ; une date à venir affiche « Paiement en cours · prévu le … » (bleu), reste dans le « reste à payer » et n'est jamais « en retard ».
- ⚠️ Supprimer un programme (autorisé seulement sans inscrit, §3quatrevingtcinquantequadragies) supprime aussi ses charges et échéances (cascade sur le voyage).
- Vérifié : script réel contre la base (création 3 échéances, dépassement refusé, marquer payé, modification conservant les paiements, isolation inter-agences NOT_FOUND, cascade) et parcours UI réel en FR/AR sur un programme jetable, supprimé ensuite.
- **Tableau de bord — carte « Finances » à onglets** (`app/admin/_components/FinanceWidget.jsx`, client ; données préparées côté serveur par `buildFinanceData` dans `app/admin/page.js`, `finances.view`) : 4 onglets **Programmes / Visa / Billets / Autres services**, chacun avec une **liste déroulante** (voyages du plus proche départ à venir au plus ancien ; types de visa + « Tous » ; catalogue de services) puis le détail. Programmes = recettes des inscrits (dû / encaissé / reste à encaisser ou **« Trop-perçu »**, taux d'encaissement) + charges du voyage + marge prévisionnelle / trésorerie (si `charges.view`/`charges.manage`) ; Visa = service visa autonome (dû/encaissé/reste, taux, compteurs par statut) ; Billets = charges de catégorie « billets » du voyage (+ compagnies, prochaine échéance) et achats Duffel confirmés (`listFlightBookingTotalsByTrip`) ; Autres services = prix catalogue, aucune vente séparée (inclus dans le prix des programmes, §3sedecies). **Tous les montants et pourcentages sont masqués (« ****** ») à l'ouverture**, bouton œil « Afficher / Masquer » (non mémorisé) ; tant que c'est masqué, libellé neutre « Solde » et fonds neutres pour ne pas trahir le signe. ⚠️ Masquage **visuel** uniquement : les chiffres sont dans la page (accès déjà limité à `finances.view`).
- **Bouton « Inscrire » (inscription pré-remplie)** — sur chaque départ de « Prochains départs » (tableau de bord, seulement si le voyage est `ouvert`/`planifie`) et sur chaque ligne de `/admin/programmes` (si le programme a au moins un voyage ouvert/planifié, `listAllPrograms` → `open_trips_count`), visible avec `inscriptions.create`. Ouvre `/admin/inscriptions/new?tripId=X` ou `?programId=Y` (`page.js` → `pickInitialTrip` : le voyage demandé, ou le prochain départ ouvert du programme). `NewRegistrationForm.jsx` reçoit `initialTripId` : voyage pré-sélectionné (toujours modifiable), tarifs d'hébergement chargés d'emblée, récapitulatif du programme sous le menu (titre, dates aller–retour, aéroports, destination — `listOpenTripsForSelect` expose désormais `return_date`/`program_id`/aéroports/destination), contrôle du passeport (6 mois après le départ) déjà sur la bonne date. Quand le voyage a des tarifs et qu'aucun n'est choisi, « Prix : selon le tarif d'hébergement choisi ci-dessous » au lieu d'un trompeur « 0,00 MAD ».

## 3centquadragies. WhatsApp Business + agent IA Claude — Lot 0 : fondations (migration `037_add_whatsapp_foundations.sql`)

Mise en œuvre du cahier des charges « Golden Fantastic — WhatsApp, Agent IA Claude et Espace admin » (07/10/2026), en 4 lots (0 fondations → 1 réception + IA + humain → 2 configuration → 3 pilotage). Plan d'action complet : `C:\Users\DELL\.claude\plans\c-users-dell-downloads-cahier-des-charg-iridescent-melody.md`.

### Décisions (validées avec l'utilisateur, écarts assumés au cahier)

- **Inbox intégrée à `/admin`**, pas de Chatwoot (isolation `agency_id` native, mêmes rôles).
- **Tout en Node.js, sans n8n** : webhook dans Next.js, traitement dans un **worker séparé** (`worker/index.mjs`, BullMQ + Redis, PM2).
- **Un numéro WhatsApp par agence** dès la conception : le webhook Meta est commun, l'agence est retrouvée par `phone_number_id`.
- **Droits via le système de permissions existant** (§3undecies) : pas de tables `adm_roles` ; nouvelle catégorie « WhatsApp & IA ».
- Noms de tables du cahier alignés sur le réel : `travelers`/`registrations`/`payments`/`staff_users` ; préfixes `wa_`, `ia_`, et `audit_log`.
- Paiement en ligne : couche d'adaptateurs multi-passerelles (lot 2). Transcription : fournisseur choisi après banc d'essai sur de vrais vocaux darija (pas encore fait — nécessite des échantillons et des clés).

### Livré au Lot 0

- **Tables** (toutes avec `agency_id`, ajoutées à `TENANT_TABLES` de `lib/agencyContext.js` et de `scripts/agency-lint.mjs`) : `wa_accounts` (un par agence, `phone_number_id` **unique global** = clé de routage), `wa_contacts` (wa_id sans « + », lien `traveler_id` par variantes du numéro, étape, source/`referral` pub), `wa_conversations` (statut `ia/copilote/humain/attente/resolu`, `last_inbound_at` = fenêtre 24h, `fep_until` = 72h pub ; une conversation résolue n'est jamais rouverte), `wa_messages` (`meta_message_id` unique = dédoublonnage, statut de livraison + `processing_status` du worker), `wa_media`, `wa_consents`, `audit_log`, et `registrations.advisor_staff_id`. Anciennes tables `whatsapp_*` dépréciées (jamais utilisées).
- **Secrets** : `lib/secrets.js` (AES-256-GCM, clé maître `SECRETS_ENCRYPTION_KEY` en env, format `v1:iv:tag:data`). Jeton système et app secret Meta chiffrés en base, jamais renvoyés au navigateur (masqués, 4 derniers caractères). ⚠️ Changer la clé maître rend les secrets illisibles → l'écran le signale, à ressaisir.
- **Webhook** `app/api/webhooks/meta/route.js` : `GET` = abonnement (jeton de vérification du compte ou `META_WEBHOOK_VERIFY_TOKEN`) ; `POST` = corps brut, regroupement par `phone_number_id` → compte, **signature `X-Hub-Signature-256` vérifiée** avec l'app secret du compte (ou `META_APP_SECRET` si application Meta partagée) → 401 sinon ; numéro inconnu ignoré (200, sinon Meta renvoie en boucle) ; n'écrit qu'en base (`lib/whatsapp/inbound.js`) puis dépose dans la file → réponse en ~50 ms. Gère messages (tous types, résumé texte dans `content`, brut dans `payload`), statuts de livraison (jamais de régression lu → livré), note de qualité ; statut des templates seulement journalisé (lot 2).
- **`proxy.js`** : `/api/webhooks/*` passe **avant** la résolution de sous-domaine (Meta appelle le domaine racine) et `x-agency-id` y est supprimé (jamais pris d'un appelant).
- **File d'attente** `lib/queue.js` : `enqueue()` ne lève jamais d'erreur et borne l'attente (1,5 s). **Aucun message perdu** : la base reste la source de vérité ; un message resté `recu` (Redis arrêté) est repris par le **balayage** du worker toutes les 30 s. `jobId = in-<id>` évite le double traitement, `claimInboundMessage` (UPDATE conditionnel) aussi. ⚠️ Piège rencontré : `enableOfflineQueue: false` casse l'initialisation de BullMQ (commande INFO envoyée avant la connexion) → remplacé par `maxRetriesPerRequest: 1`. ⚠️ Les instances de file sont mises en cache dans `globalThis` (survivent au rechargement à chaud) : changer leurs options en dev nécessite de redémarrer le serveur (ou de changer la clé de cache, d'où `__gfQueuesV2`).
- **Worker** `worker/index.mjs` (`npm run worker` ; PM2 : `ecosystem.config.cjs`, apps `gf-web` + `gf-worker`) : accusé de lecture, téléchargement des médias vers `storage/wa-media/<agence>/<mois>/` (**hors `public/`**, ignoré par Git), battement de cœur Redis (`gf:worker:heartbeat`), file `wa-outbound` limitée à 20 envois/s. **Mode écho** de recette : compte au statut `test` + `WA_ECHO_TEST=1` → chaque texte reçu est renvoyé (« Écho : ... »). L'agent IA arrive au lot 1 à la place de l'écho.
- **Graph API** `lib/whatsapp/graph.js` (fetch natif, version `META_GRAPH_API_VERSION`, défaut `v23.0` — à vérifier au moment de la mise en service) : texte libre, accusé de lecture, médias, infos du numéro. `sendConversationText` (`lib/whatsapp/processing.js`) refuse si la fenêtre de 24h est fermée (`WINDOW_CLOSED` → template requis, lot 2).
- **Admin** `/admin/whatsapp/parametres` (permission `whatsapp.settings`, direction par défaut ; groupe de navigation « WhatsApp ») : identifiants Meta, secrets masqués (vide = conservé), test de connexion (met à jour nom vérifié/qualité/palier), URL + jeton de vérification à copier dans Meta (régénérable), **état des services** (chiffrement, compte, Meta, dernier webhook, Redis, worker, qualité) et 20 derniers messages. Toute modification du compte est tracée dans `audit_log` (secrets masqués). Traduit AR/EN.
- ⚠️ Pages admin : importer `lib/whatsapp/messages.js` (lectures), jamais `lib/whatsapp/processing.js` (accès disque → Turbopack trace tout le projet au build).
- ⚠️ **MySQL doit tourner en UTC** (cas du conteneur Docker) : les tables `wa_*` comparent `created_at`/`updated_at` (CURRENT_TIMESTAMP) à `UTC_TIMESTAMP()`. Affichage converti en heure du Maroc.

### Mise en route locale

1. `.env` : `SECRETS_ENCRYPTION_KEY` (`openssl rand -base64 32`), `REDIS_URL` — voir `.env.example`.
2. Redis : `docker run -d --name golden-fantastic-redis --restart unless-stopped -p 6379:6379 redis:7-alpine`
3. `npm run dev` + `npm run worker`
4. Recette automatisée : `npm run test:whatsapp` (26 contrôles) — agence + compte **temporaires**, **faux serveur Graph API local** (`META_GRAPH_BASE_URL`, ignoré en production) et worker lancé par le script : signature, dédoublonnage, isolation, < 2 s, médias hors `public/`, accusé de lecture, écho, statuts, balayage. Supprime tout à la fin.

### Vérification effectuée

`npm run test:whatsapp` : 26/26 ; `npm run test:agency` et `npm run lint:agency` OK ; `next build` sans avertissement ; page admin rendue en réel (compte `direction` temporaire), rôle `ventes` → 403 et « Accès réservé », comptes supprimés. **Rien n'a été testé contre la vraie API Meta** (aucun compte/numéro de test fourni) : la recette réelle du Lot 0 se fera avec le numéro de test de l'agence (déclarer l'URL du webhook — exige une URL publique HTTPS — puis envoyer un message : écho attendu).

### Reste à faire / prérequis agence (bloquants pour le Lot 1)

Compte Business Meta vérifié + numéro de test ; **dossier de conception** (prompt système, 21 templates FR/AR, 27 déclencheurs, règles de transfert — absent du dépôt) ; contenus de la base de connaissances ; compte Claude Console ; vocaux darija pour le banc de transcription ; déclaration CNDP ; nom de domaine HTTPS (`ROOT_DOMAIN`). Maquettes des écrans du Lot 1 à valider.

⚠️ La migration de ce lot a été renommée **`037_add_whatsapp_foundations.sql`** : une autre session avait créé `036_add_ticket_sales.sql` en parallèle, deux fichiers 036 coexistaient. (La section « vente de billets » ci-dessous porte aussi le numéro §3centquadragies — les deux sujets sont distincts.)

## 3centunquadragies. WhatsApp — Lot 1 : agent IA Claude, inbox intégrée, transfert humain (migration `038_add_whatsapp_ai_lot1.sql`)

Suite de la section WhatsApp Lot 0. **Réalisé sans aucun appel réel** (ni Meta ni Claude : aucun compte fourni) — tout est vérifié contre de faux serveurs locaux ; la recette réelle reste à faire avec le numéro de test et une clé Claude.

### Moteur (worker)

- **Tour IA** (`lib/whatsapp/aiReply.js::handleAiTurn`, file `wa-ai`) : déclenché après chaque message entrant avec un **délai de regroupement** (`WA_AI_DEBOUNCE_MS`, 7 s, WA-03) — un message plus récent annule le tour en attente, le suivant répond à TOUS les messages non traités (`wa_conversations.ai_last_handled_message_id`). Verrou par conversation (`ai_lock_until`, UPDATE conditionnel) ; un tour reporté (verrou pris, média en cours) est relancé par BullMQ (`RetryLaterError`). Ordre des contrôles : contact bloqué → **STOP** (retrait marketing dans `wa_consents`, WA-10) → **mot-clé d'urgence** (24h/24, quel que soit le statut, HU-11) → **statut humain/attente : AUCUNE réponse IA** (HU-05), un seul avertissement hors horaires (`ooh_notice_sent_at`), notification du conseiller, SLA relancé → client avec conseiller attitré et dossier ouvert qui rouvre une conversation résolue → directement à son conseiller (§6.1) → mode `off` ou clé Claude absente → transfert → vocal seul non transcrit → transfert → **plafond mensuel** atteint → copilote forcé + alerte direction (CL-09) → agent.
- **Agent** (`lib/ai/agent.js`) : SDK `@anthropic-ai/sdk` (0.132), boucle d'outils manuelle **≤ 5 tours** (CL-04), `maxRetries: 3` (CL-07). **Modèles du cahier** : `claude-sonnet-5-5` pour la conversation (effort `low` par défaut, recommandé pour le chat) et `claude-haiku-5-5` pour les résumés, tous deux modifiables. **Repli serveur sur refus** (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`) activé par défaut pour Sonnet/Opus 5.5 — désactivé automatiquement quand `ANTHROPIC_BASE_URL` pointe un faux serveur. **Cache du prompt** (CL-06) : outils (ordre fixe), puis bloc système STABLE (prompt + base de connaissances publiée, `cache_control`), puis bloc système VARIABLE (date, horaires, fiche CRM) **après** le point de cache. Historique = les `history_size` derniers messages (texte) ; images/PDF des NOUVEAUX messages joints en base64 (lecture passeport/reçu, IA-06/07). Chaque exécution → `ia_logs` (tokens, cache, outils, coût, durée, issue), passeport/CIN masqués (`lib/ai/redact.js`, NF-12).
- **9 outils** (`lib/ai/tools.js`, CL-03), branchés sur les fonctions CRM existantes (`getProgramsByFamily`, `getOpenTripsForProgram`, `listTiersForTrip`, `listPublishedFaqsForProgram`...) : `chercher_programmes`, `details_programme` (prix par chambre OU formules d'hébergement), `creer_ou_maj_prospect` (`wa_contacts.qualification`, étape `qualifie`), `etat_dossier` (**uniquement si le numéro WhatsApp = voyageur inscrit**, montants de groupe compris), `enregistrer_document` (reçu → tâche comptable + transfert ; passeport/CIN → tâche dossiers), `demander_humain`, `planifier_rappel`, `envoyer_brochure`, `envoyer_localisation`. Les effets de bord sont **différés** (`ctx.effects`) et appliqués après le tour → le bac à sable les simule sans rien envoyer.
- **Échec** (erreur API, refus, > 5 tours, réponse vide) → message d'attente + transfert `echec_ia` + question ajoutée à `ia_unanswered` (NF-04).
- **Contexte d'agence par tâche** : `runWithAgency(agencyId, fn)` (`lib/agencyContext.js`, AsyncLocalStorage ; priorité : explicite > tâche > en-tête > script). Le worker traite plusieurs agences en parallèle et réutilise toutes les fonctions `lib/*` sans risque de mélange (`setScriptAgencyId` est global, donc inutilisable dans le worker).
- **Transfert** (`lib/whatsapp/handoff.js`) : équipe = règle `sla_rules` du motif (équipe sans membre actif → `direction`) ; conseiller attitré (`wa_contacts.advisor_staff_id`, sinon `registrations.advisor_staff_id`) ; échéance SLA en **minutes d'ouverture** (`computeSlaDue`, sauf règle 24h/24) ; note privée + **résumé par Haiku** (HU-02) ; notifications. Urgence → accompagnateurs du voyage en cours (`trip_escorts`) + direction. Alertes SLA par le worker toutes les minutes : l'équipe, puis escalade à la direction (HU-06).
- **Horaires** (`lib/whatsapp/team.js`) : heure du Maroc via `Intl` (`Africa/Casablanca`), plages par jour + exceptions (fériés, Ramadan). `scripts/create-agency.js` copie les règles SLA et horaires par défaut.
- **Transcription** (`lib/transcription/index.js`) : interface à adaptateurs, **aucun fournisseur** (banc d'essai darija non fait) → les vocaux sont transférés à un conseiller.
- ⚠️ **`WA_WORKER_AGENCY_IDS`** : périmètre d'agences d'un worker (vide = toutes). **Indispensable aux scripts de recette**, qui lancent un worker pointé sur de faux serveurs : sans lui, ce worker a traité (avec le faux Claude) une conversation d'une AUTRE agence pendant les tests — constaté sur une agence de démonstration. Une tâche hors périmètre est ignorée sans être consommée (reprise par le balayage du vrai worker).

### Réglages et contenu (admin)

- **Réglages IA versionnés** (`ia_settings`, `/admin/whatsapp/ia`, permission `ia.settings`) : mode `ia`/`copilote`/`off`, prompt, modèles, effort, longueur, historique, outils actifs, mots-clés d'urgence, messages automatiques FR/AR, plafond mensuel, tarifs. Chaque enregistrement = nouvelle version, **réactivation en un clic**, journal d'audit. ⚠️ **Version initiale en mode COPILOTE avec un prompt PROVISOIRE** (`DEFAULT_SYSTEM_PROMPT`, `lib/ai/settings.js`) en attendant le prompt du dossier de conception : ne passer en « IA active » qu'après validation au bac à sable.
- **Base de connaissances** (`ia_knowledge`, `/admin/whatsapp/connaissances`, `ia.knowledge`) : fiches FR/AR + variantes darija, brouillon/publié (seules les publiées vont à l'IA), alerte à 6 mois ; file « questions sans réponse » (transferts `echec_ia` + corrections des conseillers) → fiche en un clic.
- **Bac à sable** (`/admin/whatsapp/bac-a-sable`, `ia.sandbox`) : conversation simulée (prospect ou voyageur inscrit, version de réglages au choix), outils et effets affichés, coût ; jeu de tests rejoué par le worker (`ia_test_cases`/`ia_test_runs`) et comparé au passage précédent.
- **Équipe & horaires** (`/admin/whatsapp/equipe`, `whatsapp.team`) : horaires + exceptions, délais par motif (valeurs du cahier §6.3), accompagnateurs par voyage, réponses rapides.

### Inbox intégrée

- `/admin/whatsapp/conversations` (liste filtrable, rafraîchie toutes les 10 s) et `/conversations/[id]` (fil, rafraîchi toutes les 5 s). Actions : prendre la main, rendre à l'IA, copilote, en attente client, résoudre, transfert par motif, **réassignation avec note obligatoire** (HU-10). Réponse libre (fenêtre 24 h) ou **template approuvé** (fenêtre fermée, HU-08 — copie synchronisée depuis Meta ; création et soumission au Lot 2), réponses rapides, notes internes. **Brouillons copilote** à valider, corriger ou rejeter (IA-14 ; une correction marque la réponse « à corriger »), évaluation des réponses IA (HU-13). Panneau CRM : qualification, dossiers, conseiller attitré, consentement marketing, blocage. Médias servis par une route protégée (`/api/admin/whatsapp/media/[id]`, `no-store`). `/admin/whatsapp/taches` : tâches (reçus à valider, rappels, documents) + alertes.
- **Droits** : `whatsapp.conversations.all` (tout) / `whatsapp.conversations.own` (conversations assignées à soi ou à son équipe = son rôle ; ventes/comptabilité/suivi par défaut), `whatsapp.tasks`, `whatsapp.team`, `ia.knowledge`, `ia.sandbox`, `ia.settings` (direction seule par défaut pour les quatre derniers). Pastille de navigation = conversations transférées sans réponse humaine. Un brouillon copilote rattache l'équipe `ventes` (sinon il serait invisible pour un périmètre « équipe »).
- Traduit AR/EN (≈ 290 entrées). ⚠️ Correctif du traducteur (`lib/i18n/translate.js`) : les motifs les plus spécifiques sont désormais essayés en premier. Un motif générique (`{title} · {status} · {pub}`) capturait des textes qu'un motif plus précis savait traduire, et les laissait en français.

### Vérification effectuée

- `npm run test:whatsapp-ai` (**24 contrôles**, faux Claude + faux Meta, agence temporaire) : réponse avec outil, modèle et effort, cache du prompt, présentation au premier échange, journal IA, regroupement de 2 messages en 1 réponse, transfert ventes + SLA + notes + résumé, silence de l'IA en statut humain, STOP, urgence, panne Claude → attente + transfert + question sans réponse, copilote (brouillon puis validation corrigée), bac à sable sans envoi, isolation de l'agence 1.
- `npm run test:whatsapp` (Lot 0, 26/26) et `npm run test:agency` sans régression ; `lint:agency`, eslint et `next build` sans avertissement.
- Écrans vérifiés en réel dans le navigateur (FR et AR/RTL) sur une agence de démonstration jetable, supprimée ensuite. Un compte « ventes » ne voit que la conversation de son équipe (404 sinon) et reçoit 403 sur les réglages IA, la base de connaissances et le bac à sable.

### Reste à faire / limites

- **Recette réelle** : `ANTHROPIC_API_KEY`, numéro de test Meta, puis rejouer les critères du cahier au bac à sable (jeu de 50 tests à rédiger par l'agence) avant de passer en « IA active ».
- Transcription des vocaux (fournisseur à choisir), templates et déclencheurs (Lot 2). Les urgences ne sont notifiées que dans l'admin : écrire à un accompagnateur hors fenêtre 24 h demandera un template interne approuvé par Meta.
- Temps réel par rafraîchissement périodique (pas de SSE).

## 3centdeuxquadragies. WhatsApp — Lot 2 : templates Meta, déclencheurs, liens & QR, boutons, paiement en ligne (migration `039_add_whatsapp_lot2.sql`)

Suite des Lots 0/1. **Comme eux, réalisé sans aucun appel réel** (ni Meta, ni Claude, ni passerelle de paiement) : tout est vérifié contre de faux serveurs locaux. Les **21 templates** et **27 déclencheurs** du « dossier de conception » n'ayant jamais été fournis, ce sont des **propositions rédigées ici** (FR + AR), chargées en brouillon / inactives : à relire par l'agence avant toute soumission à Meta ou activation.

### Templates Meta (TP-01→08) — `/admin/whatsapp/templates`, permission `whatsapp.templates`

- `lib/whatsapp/templates.js` : forme « simple » éditable (en-tête texte/image/document/localisation, corps, pied, boutons réponse rapide/lien/appel) ↔ `components` Meta (`toComponents`/`fromComponents`). **Contrôles avant soumission** (`validateTemplate`) : nom, longueurs, variables consécutives, pas de variable en début/fin ni collées, mapping de chaque variable, boutons ; avertissement de mots promotionnels dans un template « Utilité » (risque de reclassement).
- **Variables ↔ champs CRM** (`variable_mapping`, TP-05) : catalogue `CRM_FIELDS` (`lib/whatsapp/crmContext.js` — ajouter un champ = une entrée + sa valeur dans `buildCrmContext`), valeurs calculées pour le destinataire à l'envoi ; leurs exemples sont joints à la soumission (exigés par Meta). Un en-tête média exige un fichier d'exemple (uploadé chez Meta via l'API d'upload reprenable).
- Soumission (`submitTemplate` → statut `PENDING`), modification limitée au mapping une fois soumis/approuvé (dupliquer pour une nouvelle version ou l'autre langue), suppression aussi chez Meta pour la dernière langue. **Statut synchronisé** par le webhook `message_template_status_update` / `template_category_update` **et** par une synchronisation toutes les heures (worker, + bouton). Un reclassement Utilité → Marketing alerte la direction (TP-03). Statistiques 30 j par template (envois, lus, réponses, échecs).
- ⚠️ **Webhook des templates routé par WABA ID** : ces notifications Meta sont au niveau du compte WhatsApp Business (`entry.id` = WABA ID) et n'ont **pas** de `phone_number_id` — `app/api/webhooks/meta/route.js` garde `entry.id` sur chaque « change » et retrouve l'agence par `findAccountByWabaId` quand le numéro manque. Sans ça, les statuts d'approbation étaient ignorés.
- Envoi : `pickTemplateVariant` choisit la langue du client (repli FR) ; l'inbox (HU-08) ne reçoit que les templates approuvés (`GET ...templates`), la liste complète (`?all=1`) est réservée à `whatsapp.templates`.

### Déclencheurs (DC-01→10) — `/admin/whatsapp/declencheurs`, permission `whatsapp.triggers`

- `lib/whatsapp/triggers.js`, tables `wa_triggers` / `wa_trigger_runs` (historique ; `dedupe_key` unique par agence = jamais deux fois le même envoi). Familles : **événement CRM**, **date relative** (J±n par rapport au départ, au retour ou à l'inscription — `registration_date`, pas `created_at` qui n'existe pas sur `registrations`), **inactivité** du client, **interne** (notifier une équipe, rapport quotidien 19h), **manuel** (lancé pour tous les inscrits d'un voyage, avec un texte saisi).
- **Événements CRM** : `lib/events.js` → `emitCrmEvent()` (file `wa-triggers`, ne lève jamais d'erreur) appelé depuis `createRegistration`/`updateRegistration` (inscription, statuts visa), `createPayment`/`createGroupPayment` (paiement reçu, dossier réglé), `updateTrip` (PNR renseigné → billet émis), `assignRegistrationsToRoom` (chambre affectée), l'outil IA `creer_ou_maj_prospect` (prospect qualifié).
- Worker : planification des dates relatives toutes les 15 min, exécution des envois dus chaque minute. **Juste avant l'envoi** : plage horaire (9h-21h, pas le vendredi 12h-14h, sauf « urgent » — sinon reporté), conditions d'arrêt (client a répondu, document reçu, dossier réglé, visa accordé, départ passé), consentement et plafond **marketing** (1/semaine), puis **texte libre gratuit si la fenêtre 24h est ouverte** (DC-03), sinon template approuvé. Bouton « Simuler » (qui recevrait aujourd'hui, rien n'est envoyé).
- 27 déclencheurs proposés (`lib/whatsapp/defaultTriggers.js`), **tous inactifs** au chargement.

### Liens & QR codes (CP-07) — `/admin/whatsapp/liens`, permission `whatsapp.links`

`wa_links` : un lien `wa.me` par support avec message pré-rempli terminé par le **code source** ; le code est attribué au contact à son premier message (`sourceFromMessage`, `wa_contacts.source`). QR PNG/PDF (`/api/admin/whatsapp/links/[id]/qr`, dépendance `qrcode`), statistiques (contacts, qualifiés). Nécessite le numéro WhatsApp de l'agence (paramètres WhatsApp).

### Boutons cliquables (IA-12)

Nouvel outil IA `proposer_choix` (≤ 3 boutons ou liste) → message interactif WhatsApp ; la réponse du client revient comme un message texte normal.

### Paiement en ligne — `/admin/paiements-en-ligne`, permissions `paiements.liens` (ventes, comptabilité) / `paiements.passerelles` (direction)

- **Adaptateurs** `lib/payments/gateways/` : **Stripe** (Checkout), **PayPal** (Orders v2, montant **converti** du MAD vers EUR/USD au taux saisi par l'agence — PayPal n'accepte pas le dirham), **CMI** (formulaire signé hash `ver3`, réponse `ACTION=POSTAUTH`), **virement** (RIB affiché). ⚠️ **Écrits d'après la documentation, jamais testés avec un vrai compte** : valider chaque passerelle en mode test avant toute mise en production. Secrets chiffrés (`lib/secrets.js`), jamais renvoyés au navigateur. `STRIPE_API_BASE`/`PAYPAL_API_BASE` = faux serveurs de test, ignorés en production.
- `lib/payments/online.js` : `payment_links` (montant ≤ reste à payer, fixé côté serveur), page client `/api/paiement/[reference]` (redirection vers la passerelle) sur le sous-domaine de l'agence. **Un paiement n'est enregistré qu'à réception d'une confirmation vérifiée** (webhook signé `POST /api/webhooks/paiement/[provider]`, ou capture serveur PayPal au retour) via `confirmLinkPayment` — **idempotent**, montant contrôlé — puis `createPayment`/`createGroupPayment` existants (reçu, recalcul du statut, événement « paiement reçu »). Bouton « Lien de paiement » dans la conversation WhatsApp (variable `paiement.lien`).

### Correctifs au passage

- `formatMoney` (`lib/whatsapp/crmContext.js`) : la classe d'espaces insécables avait perdu ses caractères (remplacée par des espaces ordinaires) — désormais écrite en échappements `  `.
- `pickMessage` (`lib/ai/settings.js`) : une variable vide (ex. aucun horaire d'ouverture configuré) retire aussi ses parenthèses (« dès la réouverture. » au lieu de « dès la réouverture () »).
- `scripts/esm-loader.mjs` : ajoute `.js` à tout import relatif sans extension JS (avant, `./translations/public.ar` était pris pour une extension `.ar`).
- Traductions AR/EN des 4 écrans (~290 entrées) ; textes à variables écrits en chaînes uniques pour le traducteur DOM.

### Vérification effectuée

`npm run test:whatsapp-lot2` (**39 contrôles**, agence temporaire, faux Meta/Stripe/PayPal, worker lancé par le script) : 21×2 templates valides, contrôles et avertissements, soumission + exemples, approbation par webhook (WABA), reclassement, synchronisation, 27 déclencheurs inactifs, inscription → template avec variables CRM, texte libre si fenêtre ouverte, simulation, planification J-7, report hors plage, urgent, arrêt sur réponse, marketing sans consentement, déclencheur interne, rapport quotidien, lien + attribution de source + stats, boutons, Stripe (secrets, montant serveur, signature invalide refusée, idempotence, statut recalculé), CMI (hash, POSTAUTH), PayPal (conversion, capture), virement, isolation. Lots 0/1 (`test:whatsapp`, `test:whatsapp-ai`), `test:agency`, `lint:agency` et `next build` sans régression. Écrans vérifiés en réel (FR et AR/RTL, compte `direction` sur une agence jetable supprimée ensuite) : un compte « ventes » reçoit 403 sur déclencheurs, liens et passerelles, et seulement les templates approuvés.

### Reste à faire

Relecture par l'agence des 21 templates/27 déclencheurs (et traduction arabe par un natif), soumission réelle à Meta, comptes et clés de test des passerelles. (Lot 3 : voir §3centtroisquadragies.)

## 3centtroisquadragies. WhatsApp — Lot 3 : campagnes, pilotage, coûts, conformité CNDP, sécurité, exploitation (migration `040_add_whatsapp_lot3.sql`)

Dernier lot du cahier des charges. **Comme les précédents, aucun appel réel** (Meta, Claude, SMTP) : vérifié contre de faux serveurs, avec de vrais appels HTTP pour la connexion/2FA et une vraie sauvegarde + restauration. Guides : `docs/guide-exploitation.md` (redémarrage, sauvegarde, restauration, rotation des clés) et `docs/guide-utilisateur-whatsapp.md`.

### Campagnes (CP-01→06) — `/admin/whatsapp/campagnes`, `lib/whatsapp/campaigns.js`

- Tables `wa_segments`, `wa_campaigns`, `wa_campaign_recipients` ; `wa_messages.campaign_id`. Permissions `whatsapp.campaigns` (préparer, marketing) et `whatsapp.campaigns.approve` (valider/refuser, responsable) — **aucune n'est donnée par défaut** hors direction : à attribuer dans la matrice des rôles.
- Segment = filtres (étape, type de voyage, programme, source, langue, ville, dernière interaction, anciens pèlerins) ; **consentement marketing et non-blocage toujours imposés**, revérifiés juste avant chaque envoi (un STOP reçu pendant la campagne écarte le contact).
- Circuit `brouillon → a_valider → validee → en_cours → terminee` (+ `refusee`, `arretee`) ; soumission refusée si le template A n'est approuvé dans aucune langue ; estimation du coût = destinataires × tarif Meta de la catégorie.
- Envoi par le worker sur une **file dédiée `wa-campaigns`** (concurrence 1, un lot par minute) : les réponses aux clients ne sont jamais retardées (NF-03, mesuré : 0,2 s pendant un envoi de masse). Plages 9h-21h, jamais le vendredi 12h-14h. **Arrêt d'urgence** vérifié entre deux messages.
- Test A/B : X % du segment reçoit A ou B (moitié chacun), après N heures le gagnant (réponses ou lectures) part au reste. Rapport : livrés, lus, réponses, inscriptions générées (60 jours), désinscriptions, coût (réel si Meta l'a communiqué, sinon estimé), coût par inscription, contacts ayant répondu (CSV).
- Scripts de recette seulement : `WA_CAMPAIGN_INTERVAL_MS`, `WA_CAMPAIGN_IGNORE_HOURS=1` (ignoré en production).

### Pilotage (§8.1-8.3) — `lib/whatsapp/analytics.js`

- `/admin/whatsapp` (tableau de bord, `whatsapp.dashboard` — ventes/comptabilité/suivi par défaut, **limité à leur équipe** sans `conversations.all`), `/statistiques`, `/couts` (`whatsapp.costs`, direction seule par défaut). Périodes en jours **heure du Maroc** (`periodBounds`).
- **Coût Meta réel** : `wa_messages.cost_mad` renseigné depuis `pricing.billable/category` du statut de livraison, au tarif saisi par l'agence (`wa_ops_settings.price_*_mad`, à aligner sur la grille Meta Maroc — valeurs par défaut indicatives). Claude en USD (`ia_logs`), converti au taux `usd_to_mad`.
- Rapport quotidien paramétrable (`lib/whatsapp/reports.js`) : heure, sections, destinataires e-mail ; notification direction + e-mail (`lib/mailer.js`, nodemailer, **sans SMTP rien n'est envoyé** ; `MAIL_TRANSPORT=json` écrit `storage/mail-outbox.jsonl` hors production). Une fois par jour ; le déclencheur interne « Rapport quotidien » (DC-10) appelle la même fonction.

### Contacts (§8.5) — `/admin/whatsapp/contacts`, `lib/whatsapp/contacts.js`

Liste filtrable, fiche (profil, qualification, dossiers CRM, conversations, historique du consentement, templates reçus, médias), modification avec **preuve du consentement** historisée, import CSV (**colonne consentement obligatoire**, 10 000 lignes max, liaison automatique au voyageur par numéro), export CSV.

### Données personnelles (NF-13) — `lib/whatsapp/privacy.js`, permission `whatsapp.data` (direction)

- Durées dans `wa_ops_settings` : copies de documents N jours après le retour du dernier voyage, autres médias, conversations résolues, journaux IA. **Purge désactivée par défaut** (à activer après validation des durées), exécutée par le worker entre 2h et 4h ; simulation et purge manuelle dans « Paramètres WhatsApp ». Les fichiers sont supprimés du disque, la ligne `wa_media` reste (« document reçu le... », `purge_at`). **Le dossier de voyage du CRM n'est jamais purgé.**
- Export JSON et suppression des données WhatsApp d'un contact (fiche contact).
- ⚠️ `privacy.js` accède au disque : ne l'importer que dans des routes API ou le worker.

### Journal et audit IA (§8.16, NF-15) — `/admin/whatsapp/journal`, permission `audit.view`

Journal d'audit (filtres, avant/après, CSV ; désormais aussi utilisateurs, rôles/permissions, campagnes, contacts, sécurité), logs IA (filtres, détail, CSV), **audit hebdomadaire** : 20 conversations IA tirées au hasard (`ia_audits`/`ia_audit_items`), créé automatiquement chaque lundi + tirage manuel ; grille exactitude/ton (1-5), transfert pertinent, information inventée (→ alerte direction, tolérance zéro).

### Sécurité (NF-07, NF-10)

- **Double authentification TOTP** (`lib/totp.js`, RFC 6238, sans dépendance) **imposée aux rôles `ADMIN_2FA_ROLES`** (défaut `direction`) : sans 2FA activée, la session (`mfaSetupRequired` dans le JWT) n'ouvre que `/admin/securite` et `/api/admin/security` — **contrôle dans `proxy.js`** (pages redirigées, autres API admin → 403). Secret chiffré (`staff_users.totp_secret_enc`). Réinitialisation par un administrateur (« Utilisateurs → Réinitialiser 2FA », déverrouille aussi le compte). ⚠️ Conséquence : **chaque compte direction existant devra activer la 2FA à sa prochaine connexion.**
- Verrouillage 15 min après 5 échecs (`failed_login_count`, `locked_until`, réponse 423) ; limitation de débit Redis (`lib/rateLimit.js`, laisse passer si Redis est indisponible) : connexion 20/15 min par IP, formulaire de contact et réservation 5/10 min, API publique 120/min.
- Notifications web : cloche dans l'en-tête (`NotificationBell.jsx`, interrogation toutes les 30 s) + notifications du navigateur (Notification API, sur autorisation).

### Exploitation (NF-05, NF-14, NF-17)

- `scripts/backup.mjs` (`npm run backup`) : dump SQL écrit par Node (aucun mysqldump), archive tar des médias et uploads, chiffrement AES-256-GCM (`BACKUP_ENCRYPTION_KEY`), manifeste, rétention 30 j, copie hors serveur par `rclone` si `BACKUP_RCLONE_REMOTE`. `scripts/restore.mjs --verify` : vérifie l'intégrité **avant** d'écrire, restaure dans une base temporaire, compare au manifeste, la supprime. `scripts/healthcheck.mjs` : base, Redis, worker, messages bloqués, webhooks, sauvegarde < 26 h, disque ; alertes e-mail (passage en échec, rappel 6 h, retour à la normale). PM2 : `gf-backup` (2h30), `gf-healthcheck` (5 min). État dans `system_jobs` (table globale) affiché dans « Paramètres WhatsApp ».
- ⚠️ Les tâches système en échec apparaissent dans les alertes du tableau de bord de **toutes** les agences (serveur unique, pas encore de rôle super-admin plateforme).

### Bugs trouvés et corrigés pendant ce lot

- **`lib/db.js`** : chaque rechargement à chaud du serveur de dev créait un nouveau pool MySQL de 10 connexions sans fermer les anciens → « Too many connections » (151 connexions tenues par `next dev`, même root refusé). Pool désormais en cache dans `globalThis`.
- `periodBounds` : une date de début seule ne couvrait qu'un jour (au lieu d'aller jusqu'à aujourd'hui).
- Script du Lot 1 : trois contrôles lisaient un champ écrit quelques millisecondes après celui qu'ils attendaient (échecs aléatoires) → attente de la condition complète.

### Vérification effectuée

`npm run test:whatsapp-lot3` (**67 contrôles** : segments, estimation, circuit de validation, worker, A/B, consentement retiré en cours de campagne, NF-03, coût réel, rapport de campagne, arrêt d'urgence, campagne planifiée, tableau de bord/statistiques/coûts, rapport + e-mail, import/export, purge et suppression sur disque, audit IA, 2FA et verrouillage en HTTP réel, limitation de débit, isolation, sauvegarde + restauration vérifiée) ; Lots 0/1/2 (`test:whatsapp`, `test:whatsapp-ai` ×2, `test:whatsapp-lot2`), `test:agency`, `lint:agency`, eslint du périmètre et `next build` sans régression. Écrans vérifiés en réel en FR et AR sur une agence jetable (activation 2FA, tableau de bord, campagnes et assistant, contacts, coûts, journal et tirage d'audit) — aucun texte non traduit hormis les données ; agence supprimée ensuite. Sauvegarde altérée correctement rejetée.

### Reste à faire / limites

Recette réelle (Meta, Claude, SMTP, rclone) ; grille tarifaire Meta réelle ; attribution des permissions campagnes/coûts aux rôles de l'agence ; transcription des vocaux (fournisseur non choisi) ; temps réel par interrogation périodique (pas de SSE ni de Web Push hors onglet ouvert) ; formation des équipes (livrable humain).

## 3centquadragies. Service de vente de billets d'avion hors programme (migration `036_add_ticket_sales.sql`)

Un client peut acheter un **billet d'avion seul**, sans voyage organisé — même modèle que le service visa autonome (§3sedecies). **Saisie manuelle** (PNR / n° de billet fournis par la compagnie ou le système de réservation) : ce service **n'achète rien** automatiquement (l'achat Duffel §3ter reste distinct, lié aux voyages).
- Table `ticket_sales` : client (`traveler_id`, réutilisé par numéro WhatsApp **dans l'agence**, comme `createVisaServiceRequest`), compagnie (`airline_id`, SET NULL), `trip_type` (aller simple / aller-retour), aéroports IATA, dates, nombre/noms des passagers, classe, PNR (majuscules), n° de billet(s), **`purchase_price` (coût d'achat)** et **`total_due` (prix de vente)** → marge, statut `devis`/`reserve`/`emis`/`annule`, notes. `agency_id` + `TENANT_TABLES`/lint.
- **Paiements** : `payments.ticket_sale_id` = **4ᵉ cible** possible ; `chk_payment_target` réécrit en « exactement une des quatre » (`(a IS NOT NULL)+(b…)+(c…)+(d…) = 1`). Versements/remboursements via `PaymentsSection.jsx` (réutilisé, `apiBasePath=/api/admin/ticket-sales/[id]`) ; reçu PDF (`isTicketSale` : lignes Billet / Dates / PNR, « Prix du billet ») ; « Paiements par période » (5ᵉ branche UNION, « Vente de billet »).
- `lib/ticketSales.js` (list/get/create/update/delete + stats), `lib/payments.js` (`listPaymentsForTicketSale`, `createTicketSalePayment`). Validation serveur : nom + WhatsApp requis, retour ≥ départ, montants ≥ 0. **Suppression refusée (409) dès qu'un versement existe** — annuler la vente et rembourser plutôt qu'effacer l'historique.
- Routes : `GET/POST /api/admin/ticket-sales`, `GET/PUT/DELETE /api/admin/ticket-sales/[id]`, `GET/POST /api/admin/ticket-sales/[id]/payments`. Permission **`ticket_sales.manage`** (catégorie « Billets d'avion » de la matrice des rôles ; direction, ventes, comptabilité par défaut).
- Pages : `/admin/billets` (KPI CA/encaissé/reste/marge réservés direction-comptabilité, filtre par statut, tableau), `/admin/billets/new`, `/admin/billets/[id]` (en-tête, KPI, formulaire `TicketSaleForm.jsx` partagé création/édition avec aéroports en datalist `lib/airportsReference.js` et marge calculée en direct, versements). Lien « Billets d'avion » dans la barre latérale (groupe Visa & voyages), action rapide Ctrl K, bouton « Créer » contextuel.
- **Finances** : tableau « Vente de billets d'avion » dans la section Services de `/admin/finances` (total hors ventes annulées, réservé direction/comptabilité) et ventes incluses dans les KPI globaux ; tableau de bord, onglet **Billets** de la carte Finances : option par défaut « Ventes de billets hors programme » (CA, encaissé, reste, coût d'achat, marge — montants masqués comme le reste de la carte).
- Vérifié en réel (compte temporaire, données jetables supprimées) : création via le formulaire (PNR normalisé, aéroports extraits), versement 201, reçu PDF relu visuellement, suppression refusée 409, dates incohérentes refusées 400, présence sur Finances et tableau de bord ; isolation inter-agences (lecture null, modification/suppression/versement → NOT_FOUND).

## 3centetunquadragies. Programmes clôturés archivés, inscrits séparés, crédits en cours

**Règle unique** (`lib/tripArchive.js`, fichier pur) : un voyage est **clôturé/archivé** si son statut est `termine` ou `annule`, **ou** si sa date de retour (à défaut de départ) est passée — `tripArchivedSql(alias)` côté SQL, `isTripArchived(trip)` côté JS. **Aucune écriture en base** : l'archivage est dérivé, donc automatique le lendemain du retour. Un **programme** est archivé quand il a au moins un voyage et que **tous** sont clôturés (`listAllPrograms` → `is_archived`, `last_return_date`).
- **Inscrits** (`/admin/inscriptions`) : bascule **« En cours » / « Archives (programmes clôturés) »** (`?view=archives`) avec compteurs ; `listRegistrations({ archived })`. Un `?tripId=` s'affiche quel que soit son état. Accordéon : icône archive + pastille « Clôturé ». En vue Archives, carte **« Crédits en cours — programmes clôturés »** (débiteur, programme, WhatsApp, dû/payé/reste dû, dernier versement, total).
- **Crédits en cours** (`lib/credits.js` → `listOutstandingCredits({ archived })`) : un débiteur = une inscription **individuelle** (hors annulées) ou un **groupe** (montant/versements partagés) ; seulement si reste dû > 0. **Finances** : nouvelle section « Crédits en cours » avec deux tuiles et deux tableaux **séparés** — programmes en cours (à encaisser avant le départ) / programmes clôturés (crédit à recouvrer) ; totaux réservés direction/comptabilité. Le tableau « Par voyage » marque les voyages « Clôturé ».
- **Programmes** (`/admin/programmes`) : onglets « En cours » / « Archivés » ; un programme archivé affiche « Clôturé · date du dernier retour » et n'a plus de bouton « Inscrire ».
- **Exclus des chiffres « en cours »** : compteurs du tableau de bord (`getDashboardStats`), pastille « Inscrits » (`countActiveRegistrations`), voyages proposés à l'inscription (`listOpenTripsForSelect`). Carte Finances du tableau de bord : voyages clôturés en fin de liste, suffixés « · clôturé » (`getFinancialSummaryByTrip` expose `trip_status`/`return_date`).
- **Données de test CONSERVÉES (demande explicite de l'utilisateur)** : programme **« OMRA TEST CLÔTURÉ SEPT 2026 »** (programme 20, voyage 28 `OMRA-TEST-SEPT26`, 01/09→15/09/2026, statut `termine`, non publié), 6 voyageurs « TEST … » (WhatsApp `0700900001`→`0700900006`) dont le groupe « TEST Famille Tazi » (17), versements datés du 20/08/2026, charges hôtels 60 000 (payées) + billets Saudia 48 000 (une échéance de 18 000 impayée). Crédits attendus : 34 000 MAD (Salma 8 000, Youssef 12 000, famille Tazi 14 000). Créées via les vraies fonctions (`createProgram`/`createTrip`/`createRegistration`/`createPayment`/`createGroupPayment`/`createExpense`). À supprimer à la main quand ils ne serviront plus.
- Vérifié en réel (compte temporaire, supprimé) : programme absent des inscrits en cours, des programmes en cours, du formulaire d'inscription et des compteurs ; présent dans les Archives avec 34 000 MAD de crédits ; Finances : 34 000 MAD (clôturés) séparés de 49 500 MAD (en cours) ; vue Archives en arabe sans texte manquant.

## 3centdeuxetunquadragies. Production : VPS Hostinger multi-sites, https://goldenfantastic.com (08/10/2026)

Site en ligne sur le VPS Hostinger `srv2036938.hstgr.cloud` (Ubuntu 24.04, `187.7.65.20`), conçu pour héberger **plusieurs projets**. Mode d'emploi complet : **`deploy/README.md`**.
- **Organisation serveur** (`deploy/server/setup.sh`, relançable) : un projet = `/srv/apps/<nom>` (utilisateur `deploy`, PM2 relancé au démarrage) + un port local + une base Redis + une base MySQL, recensés dans `/srv/apps/REGISTRE` ; Nginx seul exposé (ufw 22/80/443, fail2ban, mises à jour de sécurité auto), MySQL 8 (UTC) et Redis (`noeviction`, AOF) sur la boucle locale. `new-site <nom> <domaine> <port> --www` crée vhost + certificat Let's Encrypt (renouvelé automatiquement) ; réglages propres à un site dans `/etc/nginx/apps/<nom>/*.conf`. Un domaine inconnu est refusé (444 / handshake TLS rejeté).
- **Golden Fantastic** : `/srv/apps/goldenfantastic`, port 3000, Redis base 0, MySQL `golden_fantastic` (utilisateur `gf_app`). Installé **vide** (choix de l'utilisateur) depuis `database/schema.sql` + coordonnées/logo/Facebook de l'agence recopiés de la base locale. Le `.env` de production (secrets générés sur le serveur) n'existe que là-bas. Mises à jour : `git push` puis `ssh deploy@187.7.65.20 /srv/apps/goldenfantastic/scripts/deploy.sh` — **les migrations SQL ne sont pas appliquées automatiquement**.
- **DNS** (hPanel) : `A @ → 187.7.65.20` (remplace le parking Hostinger), `CNAME www → goldenfantastic.com` ; `www` redirige vers le domaine nu.
- **Domaine propre d'agence** : `AGENCY_DOMAINS=goldenfantastic.com=goldenfantastic` (`lib/agencyHost.js`) — prioritaire sur `ROOT_DOMAIN` (laissé vide : le domaine de la plateforme multi-agences n'est pas choisi) ; `siteBaseUrl()` renvoie alors `https://goldenfantastic.com` (canonical, hreflang, sitemap, URL du webhook WhatsApp).
- ⚠️ **Pièges rencontrés** :
  - `next start -H 127.0.0.1` → toutes les pages publiques en 500 (`Failed to proxy https://localhost:3000/... EPROTO`) : Next compare l'origine des réécritures de `proxy.js` (`localhost`) à celle du serveur (`127.0.0.1`) et prend la réécriture pour une URL externe. D'où `-H localhost` **et** `--dns-result-order=ipv4first` (sinon `localhost` → `::1` et Nginx, qui vise `127.0.0.1`, ne joint plus l'app) dans `ecosystem.config.cjs`.
  - `next start` ne liste `public/` qu'au démarrage : une image uploadée ensuite répondait 404 (y compris via `next/image`). Nouvelle route `app/uploads/[...path]/route.js` (JPG/PNG/WEBP/GIF uniquement, chemin borné à `public/uploads`) ; Nginx sert aussi `/uploads/*.{jpg,png,webp,gif}` directement depuis le disque.
  - `database/schema.sql` ne permettait plus une installation neuve (seeds rôles/compagnies insérés avant l'ajout de `agency_id` sans défaut → échec de clé étrangère) : `agency_id` ajouté avec `DEFAULT 1` puis défaut retiré juste après ; `services.agency_id` (migration 031) ajouté. Vérifié : import dans une base vierge = structure identique à la base de développement (tables, colonnes, clés étrangères).
  - Nginx 1.24 (Ubuntu 24.04) : pas de directive `http2 on;` (→ `listen 443 ssl http2;`) et `gzip on;` déjà présent dans `nginx.conf`.
- Premier compte direction : créé par l'utilisateur lui-même (`scripts/create-staff-user.js`, voir `deploy/README.md`) ; 2FA imposée à la première connexion. Non configurés en production : SMTP, clé Claude, WhatsApp Meta, copie des sauvegardes hors serveur (`BACKUP_RCLONE_REMOTE`).

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
⚠️ **Remplacé par le cahier des charges « WhatsApp, Agent IA Claude et Espace admin » (07/10/2026) — voir §3centquadragies.** Décision explicite de l'utilisateur : un **agent IA Claude** répond (limité au métier de l'agence, prix/dates uniquement via les outils CRM, transfert humain selon des règles), plus une simple liste de questions/réponses ; rappels par templates Meta et moteur de déclencheurs en Node.js (plus n8n).
- ~~Rappels automatiques des rendez-vous et documents manquants (basé sur n8n + WhatsApp Cloud API)~~
- ~~Réponses basées sur une **liste de questions/réponses prédéfinies**~~ — devient la base de connaissances de l'agent (lot 1)
- Escalade vers un employé humain : conservée et renforcée (inbox intégrée à `/admin`, lot 1)

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
- ~~Réponses WhatsApp basées sur une liste de questions prédéfinies, pas une IA totalement ouverte~~ — instruction contraire explicite donnée le 07/10/2026 : agent IA Claude **cadré** (métier de l'agence uniquement, aucune donnée inventée, transfert humain), voir §3centquadragies

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

- ~~Nom de domaine du site~~ — tranché : `goldenfantastic.com` pour l'agence historique (§3centdeuxetunquadragies) ; domaine de la plateforme multi-agences (`ROOT_DOMAIN`) encore à choisir
- Organisme(s) concerné(s) par les demandes de visa (pour construire le format requis)
- ~~Types de chambres standards proposés~~ — tranché : simple/double/triple/quadruple/quintuple (1 à 5 personnes), voir §3terdecies
- Devise(s) de facturation (MAD uniquement, ou multi-devises ?)
- ~~Adresse et téléphone réels de l'agence~~ — tranché : renseignés depuis `/admin/parametres` (§3septies), `LocalBusiness` actif (§3quinquies)

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
