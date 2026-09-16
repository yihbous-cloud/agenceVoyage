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
- **`LocalBusiness`** (schema.org) : non implémenté, en attente de l'adresse/téléphone réels de l'agence (voir §7)
- **Multilingue AR/FR** : architecture cible documentée (URLs `/fr/...` et `/ar/...`, `hreflang` réciproque, RTL via Tailwind) mais **implémentation différée** — restructurer les routes maintenant sans contenu arabe réel créerait des pages vides, contraire à la propre règle anti-contenu-fin du plan. À déclencher dans une session dédiée une fois une traduction arabe des pages cœur prête

## 3sexies. Séparation des layouts racine (site public / espace interne)

Le header/footer marketing (doré) s'affichait auparavant en haut de **toutes** les pages `/admin/*`, car un unique `app/layout.js` enveloppait tout le site. Corrigé via le pattern Next.js **"multiple root layouts"** :

- Toutes les pages publiques ont été déplacées dans un groupe de routes `app/(site)/` (ne change aucune URL — les parenthèses sont ignorées par le routeur), avec son propre `app/(site)/layout.js` : header/nav/footer marketing, polices (Geist, Italianno, Marcellus, Jost), JSON-LD `TravelAgency`
- `app/admin/layout.js` est devenu un **root layout indépendant** (son propre `<html>`/`<body>`) : uniquement la nav interne (tableau de bord, inscrits, programmes...) et la session — plus aucune trace du header/footer public
- Les fichiers hors page (`app/sitemap.js`, `app/robots.js`, `app/llms.txt/route.js`, `app/feed.xml/route.js`, tout `app/api/**`) ne sont pas des routes de page : ils ne sont pas concernés par les layouts et restent directement à la racine de `app/`
- `app/_components/*` (composants partagés) n'a pas bougé — les pages du groupe `(site)` l'importent via l'alias `@/app/_components/...` plutôt que des chemins relatifs, pour rester valides quelle que soit la profondeur du groupe de routes
- Conséquence attendue et documentée : naviguer entre le site public et `/admin` déclenche un rechargement complet de page (comportement normal pour deux root layouts distincts, pas une régression)

## 3septies. Paramètres agence & reçus de paiement imprimables

- Table `agency_settings` (ligne unique, `id=1`) : nom, adresse, ville, téléphone, WhatsApp, email, site web, RC, IF (`tax_id`), ICE, note de bas de reçu — voir migration `003_add_agency_settings.sql`
- Interface admin dédiée `/admin/parametres`, section **réservée** dans la barre latérale gauche (séparée de la navigation principale par un intitulé "Paramètres") — lecture pour tous les rôles, édition réservée à `direction`
- Reçu de paiement PDF au format A5 (`lib/exporters/receiptPdf.js`, `pdfkit`), généré à la demande via `GET /api/admin/payments/[id]/recu` — **un reçu par versement** (pas un cumul) : en-tête agence, identité du client, programme/voyage, détail du versement (montant/mode/référence/saisi par), puis rappel du montant total du voyage, total payé à ce jour et solde restant
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

Sur `EditTravelerForm.jsx` (`/admin/inscriptions/[id]`), au blur (perte de focus) des champs passeport :

- **Numéro de passeport** : vérification de **forme** uniquement (6-9 caractères alphanumériques, `PASSPORT_FORMAT` dans le composant) — aucune consultation d'un registre officiel. Si le format est valide, une boîte de dialogue modale demande confirmation ("Vérifiez que le N° de Passeport est : **{numéro}** — Exact ?", boutons **Corriger** / **Valider**) ; "Corriger" referme le dialogue et rend le focus au champ sans rien enregistrer, "Valider" affiche le message de confirmation permanent sous le champ. Le dialogue ne réapparaît pas tant que la valeur confirmée ne change pas. Format invalide : avertissement inline (pas de dialogue, champ non vidé)
- **Date d'expiration du passeport** (`travelers.passport_expiry_date`, déjà en base mais jusqu'ici jamais exposée dans ce formulaire) : doit rester valide au moins **6 mois après la date de départ du voyage** (`registration.departure_date`, pas la date du jour — c'est la règle réelle appliquée par les autorités/compagnies aériennes). Si non respectée : message d'erreur explicite et **champ vidé** (pas de valeur invalide silencieusement conservée)
- Revalidée côté serveur dans `PUT /api/admin/registrations/[id]/traveler` (même règle, même calcul) — la validation client seule ne suffit pas, un appel API direct doit aussi être bloqué
- **Verrouillage progressif** (état client uniquement, `passportLocked`/`formLocked` dans `EditTravelerForm.jsx`, pas de colonne dédiée en base) : cliquer "Valider" dans le dialogue verrouille (grise) immédiatement le champ passeport, avant même l'enregistrement du reste du formulaire ; cliquer "Enregistrer" verrouille alors **tous** les champs de la section (y compris passeport) une fois la sauvegarde réussie. Un bouton "Modifier" (à côté du titre de section, et un autre local à côté de la confirmation passeport) redéverrouille — sans "Modifier", impossible de corriger un champ après coup

## 3decies. Champs Nom/IATA des compagnies aériennes (listes déroulantes éditables)

Même pattern que Pays/Ville des hôtels (§3octies) : `AirlinesManager.jsx` (`/admin/airlines`) utilise `<input list>` + `<datalist>` pour les champs **Nom** et **Code IATA**, référence statique `lib/airlinesReference.js` (`AIRLINES`, ~40 compagnies courantes pour un marché marocain/Omra-Hajj/voyages organisés — RAM/Saudia/Turkish déjà partenaires, voir §3). Particularité par rapport aux hôtels : les deux champs sont **synchronisés dans les deux sens** — sélectionner un nom connu remplit automatiquement son code IATA (`getIataByName`) et inversement (`getNameByIata`). Une compagnie absente de la liste reste ajoutable librement : sans correspondance exacte, l'autre champ n'est jamais écrasé, saisie 100% manuelle des deux côtés.

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
- Droits des utilisateurs (rôles : direction, ventes, comptabilité, suivi)
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
- Types de chambres standards proposés (simple/double/triple/quadruple ?)
- Devise(s) de facturation (MAD uniquement, ou multi-devises ?)
- Adresse et téléphone réels de l'agence (bloque l'ajout du schema.org `LocalBusiness`, voir §3quinquies) — saisissables depuis `/admin/parametres` (voir §3septies), mais pas encore renseignés

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
