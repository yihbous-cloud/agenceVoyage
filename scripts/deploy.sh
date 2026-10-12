#!/usr/bin/env bash
# Mise à jour de Golden Fantastic en production (deploy/README.md) :
#   ssh deploy@<serveur> /srv/apps/goldenfantastic/scripts/deploy.sh
# Récupère la branche main, réinstalle les dépendances, reconstruit puis
# redémarre le site et le worker sans coupure (pm2 reload).
# ⚠️ Les migrations SQL (database/migrations/*.sql) ne sont PAS appliquées
# automatiquement : les lancer à la main AVANT ce script si le commit en ajoute.
set -euo pipefail
cd "$(dirname "$0")/.."

git pull --ff-only
npm ci --no-audit --no-fund --loglevel=error
npm run build
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save
echo "Déployé : $(git log -1 --format='%h %s')"

# Contrôle du référencement sur le site en ligne (balisage JSON-LD, canonical,
# hreflang, 404...) — rapport seulement, n'annule jamais le déploiement.
echo "==> Contrôle SEO"
node --env-file=.env scripts/seo-check.mjs || echo "⚠ Contrôle SEO : des erreurs sont signalées ci-dessus (déploiement conservé)."
