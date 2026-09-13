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

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
