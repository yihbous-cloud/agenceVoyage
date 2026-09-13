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
  page.js                              page d'accueil
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
  admin/inscriptions/[id]/page.js      détail / édition (statut, visa, montant dû)
  api/admin/registrations/*            CRUD inscriptions, avec permissions par rôle
lib/
  db.js                                pool de connexion MySQL
  programs.js                          requêtes programmes / voyages (public)
  registrations.js                     requêtes inscriptions / stats (interne)
  auth.js                              hash mot de passe, JWT de session (edge-safe)
  session.js                           lecture de la session (server components)
middleware.js                          protège /admin/* (redirige vers /admin/login)
scripts/create-staff-user.js           bootstrap d'un compte interne
database/
  schema.sql                           schéma complet MySQL fourni
```

## Ce qui est fait vs. à venir

- [x] Schéma de base de données (programmes, voyages, hôtels, chambres, inscriptions, paiements, visas, compagnies aériennes, WhatsApp)
- [x] Structure Next.js + connexion MySQL
- [x] Page programme (SEO/GEO : meta tags dynamiques, JSON-LD `TouristTrip`) + réservation en ligne basique
- [x] Authentification interne (JWT en cookie httpOnly) + tableau de bord + CRUD des inscrits, avec permissions par rôle (direction/ventes accès complet, comptabilité limité au montant dû, suivi limité au visa/notes)

Reste à construire (sessions suivantes) :

- [ ] Module de répartition hôtels/chambres
- [ ] Générateur de listes (voyageurs, visas, compagnies aériennes avec templates par compagnie)
- [ ] Suivi des paiements détaillé (table `payments`) et rapports financiers
- [ ] Gestion des programmes/voyages/hôtels depuis l'admin (actuellement seed via SQL direct)
- [ ] Connexion n8n + WhatsApp Cloud API
- [ ] Sitemap dynamique, `llms.txt`

## Notes

- Le formulaire de réservation public crée directement un enregistrement `travelers` + `registrations` (statut `inscrit`). Le calcul du montant dû (`total_due`) et le suivi des paiements détaillé seront ajoutés avec le module financier.
- Sans base MySQL configurée/accessible, les pages publiques dégradent proprement (message d'erreur affiché, pas de crash serveur).
- La session interne est un JWT signé (HS256, `SESSION_SECRET`) stocké en cookie httpOnly, durée 8h. Le middleware protège toutes les routes `/admin/*` sauf `/admin/login`.
