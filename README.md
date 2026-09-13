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
cp .env.example .env   # renseigner DB_HOST / DB_USER / DB_PASSWORD / DB_NAME
npm run dev
```

Le site démarre sur `http://localhost:3000`.

## Structure actuelle

```
app/
  page.js                        page d'accueil
  programmes/page.js             liste des programmes publiés
  programmes/[slug]/page.js       détail d'un programme + départs ouverts (SEO/GEO, schema.org)
  programmes/[slug]/ReservationForm.jsx   formulaire d'inscription (client)
  api/reservations/route.js      API : crée un voyageur + une inscription
lib/
  db.js                          pool de connexion MySQL
  programs.js                    requêtes programmes / voyages
database/
  schema.sql                     schéma complet MySQL fourni
```

## Ce qui est fait vs. à venir

Cette première tranche couvre les 3 premières étapes de l'ordre de démarrage du CLAUDE.md :

- [x] Schéma de base de données (programmes, voyages, hôtels, chambres, inscriptions, paiements, visas, compagnies aériennes, WhatsApp)
- [x] Structure Next.js + connexion MySQL
- [x] Page programme (SEO/GEO : meta tags dynamiques, JSON-LD `TouristTrip`) + réservation en ligne basique

Reste à construire (sessions suivantes) :

- [ ] Authentification et tableau de bord interne (rôles direction/ventes/comptabilité/suivi)
- [ ] Module de répartition hôtels/chambres
- [ ] Générateur de listes (voyageurs, visas, compagnies aériennes avec templates par compagnie)
- [ ] Suivi des paiements et rapports financiers
- [ ] Connexion n8n + WhatsApp Cloud API
- [ ] Sitemap dynamique, `llms.txt`

## Notes

- Le formulaire de réservation crée directement un enregistrement `travelers` + `registrations` (statut `inscrit`). Le calcul du montant dû (`total_due`) et le suivi des paiements seront ajoutés avec le module financier.
- Sans base MySQL configurée/accessible, les pages publiques dégradent proprement (message d'erreur affiché, pas de crash serveur).
