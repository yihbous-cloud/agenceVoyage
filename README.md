# Agence Voyage

Application web pour une agence de voyage : catalogue de destinations et réservations en ligne.

## Stack

- **Backend** : Node.js + Express (API REST, `server/`)
- **Frontend** : React + Vite (`client/`)

## Démarrage

### 1. Backend

```bash
cd server
npm install
cp .env.example .env
npm run dev
```

L'API démarre sur `http://localhost:5000`.

### 2. Frontend

```bash
cd client
npm install
cp .env.example .env
npm run dev
```

Le site démarre sur `http://localhost:5173`.

## Endpoints API

| Méthode | Route                  | Description                  |
|---------|-------------------------|-------------------------------|
| GET     | `/api/voyages`          | Liste des voyages              |
| GET     | `/api/voyages/:id`      | Détail d'un voyage              |
| POST    | `/api/voyages`          | Créer un voyage                 |
| PUT     | `/api/voyages/:id`      | Modifier un voyage               |
| DELETE  | `/api/voyages/:id`      | Supprimer un voyage               |
| GET     | `/api/reservations`     | Liste des réservations           |
| POST    | `/api/reservations`     | Créer une réservation            |
| PUT     | `/api/reservations/:id` | Modifier une réservation          |
| DELETE  | `/api/reservations/:id` | Supprimer une réservation          |

## Notes

Les données sont actuellement stockées en mémoire côté serveur (`server/src/data/`), à des fins de démarrage rapide. Pour une utilisation en production, il est recommandé de brancher une vraie base de données (MongoDB, PostgreSQL, etc.) derrière la même interface de stockage.
