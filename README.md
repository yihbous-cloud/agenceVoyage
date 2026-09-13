# Golden Fantastic — Agence de voyages

Système combinant un site public (programmes de voyage, réservation en ligne, SEO/GEO) et un futur CRM/ERP interne, pour une agence spécialisée Omra, Hajj et séjours touristiques.

Voir [CLAUDE.md](CLAUDE.md) pour le cahier des charges complet.

## Stack

- **Frontend + Backend** : Next.js (App Router), rendu serveur pour les pages publiques (SEO/GEO)
- **Base de données** : MySQL (schéma dans [database/schema.sql](database/schema.sql))

## Démarrage

### 1. Base de données MySQL

Avec Docker :

```bash
docker run -d --name golden-fantastic-db \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=golden_fantastic \
  -p 3306:3306 \
  mysql:8.0

# une fois le conteneur prêt (quelques secondes) :
docker exec -i golden-fantastic-db mysql -uroot -proot golden_fantastic < database/schema.sql
```

Ou pointez vers une instance MySQL existante (ex. Hostinger VPS).

### 2. Application Next.js

```bash
npm install
cp .env.example .env   # renseigner DB_HOST / DB_USER / DB_PASSWORD / DB_NAME / SESSION_SECRET
npm run dev
```

Le site démarre sur `http://localhost:3000`.

### 3. Créer un premier compte interne

Il n'y a pas d'auto-inscription pour l'espace interne. Créez un compte avec le script :

```bash
npm run create-staff -- "Nom complet" email@exemple.com motdepasse direction
```

Rôles valides : `direction`, `ventes`, `comptabilite`, `suivi`. Connexion sur `/admin/login`.

## Structure actuelle

```
app/
  page.js                              accueil (hero, programmes à la une, réassurance, actualités)
  a-propos/page.js                     page à propos
  actualites/page.js, /[slug]/page.js  liste et détail des actualités (schema.org NewsArticle)
  faq/page.js                          questions fréquentes (schema.org FAQPage)
  contact/page.js, ContactForm.jsx     formulaire de contact public
  mentions-legales/page.js, confidentialite/page.js   pages légales (noindex)
  sitemap.js, robots.js, llms.txt/route.js   SEO technique (sitemap dynamique, robots, citabilité IA)
  api/contact/route.js                 API publique : enregistre un message de contact
  programmes/page.js                   liste des programmes publiés
  programmes/[slug]/page.js            détail d'un programme + départs ouverts (SEO/GEO, schema.org)
  programmes/[slug]/ReservationForm.jsx    formulaire d'inscription public (client)
  api/reservations/route.js            API publique : crée un voyageur + une inscription
  api/auth/login, /logout              connexion / déconnexion interne
  admin/login/page.js                  page de connexion interne
  admin/layout.js                      layout protégé (nav + session)
  admin/page.js                        tableau de bord (stats, prochains départs)
  admin/inscriptions/page.js           liste des inscrits (filtrable par voyage)
  admin/inscriptions/new/page.js       création manuelle d'une inscription
  admin/inscriptions/[id]/page.js      détail / édition (statut, visa, montant dû, services)
  admin/inscriptions/[id]/VisaSection.jsx      assignation type de visa + checklist documents
  admin/inscriptions/[id]/ServicesSection.jsx  services facturés (billet avion, autres)
  admin/visa-types/*                   catalogue des types de visa (documents + prix)
  admin/services/*                     catalogue générique de services extensible
  admin/hotels/*                       catalogue des hôtels partenaires
  admin/voyages/[tripId]/hebergement   répartition hôtels/chambres pour un voyage
  admin/voyages/[tripId]/listes        génération des listes (voyageurs, visas, compagnie)
  api/admin/registrations/*            CRUD inscriptions, avec permissions par rôle
  api/admin/visa-types/*               CRUD types de visa
  api/admin/visa-documents/[id]        bascule statut d'un document (fourni/manquant)
  api/admin/services/*                 CRUD catalogue de services
  api/admin/registrations/[id]/services, /registration-services/[id]   lignes de facturation
  api/admin/hotels/*                   CRUD catalogue d'hôtels
  api/admin/trips/[tripId]/hotels, /trip-hotels/[id]   hôtels associés à un voyage
  api/admin/trip-hotels/[id]/rooms, /rooms/[id]        chambres
  api/admin/registrations/[id]/room    affectation manuelle (anti-conflit genre/capacité)
  api/admin/trips/[tripId]/auto-assign répartition automatique
  api/admin/trips/[tripId]/lists/{travelers,visa,airline}   export Excel/PDF des listes
  admin/finances/page.js               rapports financiers (par voyage, par programme, par période)
  admin/inscriptions/[id]/PaymentsSection.jsx   paiements d'une inscription (dû/payé/solde)
  api/admin/registrations/[id]/payments, /payments/[id]     CRUD paiements
  admin/programmes/*                   CRUD programmes (+ liste des voyages par programme)
  admin/voyages/[tripId]/page.js        CRUD voyage (référence, dates, compagnie, prix, statut)
  admin/airlines/*                      catalogue de compagnies aériennes (extensible, sans code)
  api/admin/programs/*, /programs/[id]/trips        CRUD programmes + création de voyage
  api/admin/trips/[tripId]/route.js     GET/PUT/DELETE d'un voyage
  api/admin/airlines/*                  CRUD compagnies aériennes
  admin/actualites/*                    CRUD actualités
  admin/messages/*                      messages de contact reçus
  api/admin/news/*, /contact-messages/[id]   CRUD actualités, statut/suppression des messages
  admin/voyages/[tripId]/billets        recherche et achat de billets d'avion (Duffel)
  api/admin/trips/[tripId]/flight-offers    recherche d'offres de vol pour un ou plusieurs inscrits
  api/admin/flight-bookings             création de la commande Duffel (achat réel)
lib/
  db.js                                pool de connexion MySQL
  programs.js                          requêtes programmes / voyages (public)
  registrations.js                     requêtes inscriptions / stats (interne)
  visaTypes.js                         catalogue visa + suivi documents par voyageur
  services.js                          catalogue de services + lignes de facturation
  hotels.js                            catalogue d'hôtels
  roomAssignment.js                    hôtels/chambres par voyage + affectation (manuelle et auto)
  listGenerators.js                    requêtes des 3 listes (voyageurs, visas, compagnie)
  airlineTemplates.js                  gabarit de colonnes par compagnie (RAM/Saudia/Turkish/générique)
  exporters/excel.js, exporters/pdf.js génération des fichiers .xlsx / .pdf
  payments.js                          paiements + rapports financiers (par voyage/programme/période)
  programsAdmin.js                     CRUD programmes + voyages (interne)
  airlines.js                          catalogue de compagnies aériennes
  news.js                              actualités (public + admin)
  contactMessages.js                   messages de contact (public + admin)
  duffel.js                             client API Duffel (recherche d'offres, commande)
  flightBookings.js                     réservations de billets (individuelles ou groupées)
  auth.js                              hash mot de passe, JWT de session (edge-safe)
  session.js                           lecture de la session (server components)
middleware.js                          protège /admin/* (redirige vers /admin/login)
scripts/create-staff-user.js           bootstrap d'un compte interne
database/
  schema.sql                           schéma complet MySQL (+ types de visa, documents, prix billet avion par voyage)
```

## Ce qui est fait vs. à venir

- [x] Schéma de base de données (programmes, voyages, hôtels, chambres, inscriptions, paiements, visas, compagnies aériennes, WhatsApp)
- [x] Structure Next.js + connexion MySQL
- [x] Page programme (SEO/GEO : meta tags dynamiques, JSON-LD `TouristTrip`) + réservation en ligne basique
- [x] Authentification interne (JWT en cookie httpOnly) + tableau de bord + CRUD des inscrits, avec permissions par rôle (direction/ventes accès complet, comptabilité limité au montant dû, suivi limité au visa/notes)
- [x] Catalogue de services : types de visa (réutilisables ou spécifiques à un programme, avec documents requis et prix), suivi document par document par voyageur, billet d'avion au prix du voyage, catalogue générique extensible pour les autres services
- [x] Répartition hôtels/chambres : catalogue d'hôtels, association hôtel(s)↔voyage avec dates, gestion des chambres (type/capacité), affectation manuelle avec anti-conflit (capacité, non-mixité de genre) et répartition automatique (regroupe le genre le plus nombreux en premier pour minimiser les places perdues)
- [x] Générateur de listes, exportables en Excel et PDF, par voyage : liste complète des voyageurs (identité, passeport, hôtel, chambre, statut, finances), liste de demande de visa (type, organisme, statut, documents fournis), liste compagnie aérienne (gabarit de colonnes différent par compagnie — RAM/Saudia/Turkish/générique — piloté par `airlines.export_template_key`, aucun changement de code pour une nouvelle compagnie)
- [x] Suivi des paiements et rapports financiers : paiements par inscription (montant/mode/référence, calcul dû/payé/solde), rapports par voyage, par programme et par période, réservé aux rôles direction/comptabilité
- [x] Gestion des programmes et voyages depuis l'admin (CRUD complet, plus de seed SQL nécessaire) : création/édition/suppression de programmes (avec protection anti-suppression si des voyages y sont rattachés) et de voyages (référence, dates, compagnie, places, prix programme/billet avion, statut), et catalogue de compagnies aériennes extensible sans aucun code — réservé au rôle direction, vérifié de bout en bout : création d'un programme + compagnie + voyage entièrement via l'interface, aussitôt visible et réservable sur le site public
- [x] Site public complet (partie "vitrine") : accueil enrichi (programmes à la une, réassurance, actualités récentes), à propos, actualités (liste + détail, gérées depuis l'admin), FAQ (schema.org `FAQPage`), contact (formulaire → messages consultables dans l'admin), pages légales, plus le SEO technique : sitemap.xml dynamique, robots.txt, `llms.txt` (citabilité par les moteurs IA), schema.org `TravelAgency` et `NewsArticle`
- [x] Intégration Duffel pour l'achat de billets d'avion (voir section dédiée ci-dessous) — code complet et vérifié (permissions, validations, sauvegarde des voyages), **mais jamais testé de bout en bout avec une vraie clé API** puisqu'aucun compte Duffel n'existait au moment de la construction

Reste à construire (sessions suivantes) :

- [ ] Tester l'intégration Duffel de bout en bout avec une clé de test réelle (voir section dédiée) et ajuster si le format des réponses Duffel diffère de ce qui a été implémenté d'après la documentation
- [ ] Connexion n8n + WhatsApp Cloud API

## Intégration Duffel (achat de billets d'avion)

Permet de rechercher de vrais vols et d'acheter réellement des billets pour
les inscrits d'un voyage, individuellement ou en groupe, depuis
`/admin/voyages/[id]/billets`.

### Configuration

1. Créez un compte sur [duffel.com](https://duffel.com)
2. Dans le dashboard, récupérez une clé **de test** (`duffel_test_...`) —
   ne jamais utiliser une clé `duffel_live_` en développement
3. Renseignez-la dans `.env` :
   ```
   DUFFEL_API_KEY=duffel_test_votre_cle
   ```
4. Pour chaque voyage concerné, renseignez les codes IATA aéroport de
   départ/arrivée dans sa fiche (`/admin/voyages/[id]`)

### Fonctionnement

- Recherche : un ou plusieurs inscrits confirmés/payés sans billet →
  recherche d'offres réelles (route + dates du voyage)
- Sélection d'une offre → formulaire des coordonnées passager pré-rempli
  depuis la fiche voyageur (nom, date de naissance, passeport), modifiable
  avant confirmation
- Achat : création d'une commande Duffel (`type: instant`, paiement
  `balance`) — nécessite un solde de test suffisant dans le compte Duffel
  (rechargeable gratuitement en mode test depuis leur dashboard)
- Le mode (test/production) est déduit du préfixe de la clé et affiché en
  bandeau sur la page ; toute réservation garde la trace du mode utilisé
  (`flight_bookings.duffel_mode`)
- Permissions : recherche et achat réservés aux rôles `direction` et
  `ventes`

### ⚠️ Non testé de bout en bout

Ce module a été construit d'après la documentation Duffel (API v2) mais
**aucun compte Duffel n'était disponible pendant le développement** :
recherche et achat n'ont donc pas pu être vérifiés avec de vraies réponses
de l'API. Ce qui a été vérifié : permissions par rôle, validations
(aéroports manquants, offre expirée), sauvegarde des champs IATA. Avant
tout achat réel (clé `duffel_live_`), testez d'abord intégralement avec une
clé `duffel_test_` et un compte de test approvisionné, et corrigez si la
forme exacte des réponses Duffel diffère de ce qui a été supposé
(notamment l'extraction des numéros de billet dans `flightBookings.js`).

## Notes

- Le formulaire de réservation public crée directement un enregistrement `travelers` + `registrations` (statut `inscrit`). Le calcul du montant dû (`total_due`) et le suivi des paiements détaillé seront ajoutés avec le module financier.
- Sans base MySQL configurée/accessible, les pages publiques dégradent proprement (message d'erreur affiché, pas de crash serveur).
- La session interne est un JWT signé (HS256, `SESSION_SECRET`) stocké en cookie httpOnly, durée 8h. Le middleware protège toutes les routes `/admin/*` sauf `/admin/login`.
- **Limitation connue** : les PDF exportés n'affichent pas la colonne "Nom (arabe)" (police PDF standard sans support de l'écriture arabe — corruption du rendu sinon). L'Excel, lui, l'affiche correctement. À corriger plus tard en intégrant une police arabe (ex. Noto Naskh Arabic) si le PDF doit inclure ce champ.
- Le `globals.css` par défaut du scaffold Next.js imposait un fond noir en mode sombre du navigateur (règle CSS hors des cascade layers de Tailwind, qui écrasait silencieusement les classes `bg-zinc-50`/`text-zinc-900` du `<body>`) — nettoyé ; le site garde un thème clair unique quel que soit le réglage du navigateur.
- Renseignez `NEXT_PUBLIC_SITE_URL` en production (utilisé par le sitemap, `llms.txt` et le schema.org `TravelAgency`) — sinon ces éléments pointent vers `http://localhost:3000`.
