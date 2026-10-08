#!/usr/bin/env bash
# Première installation de Golden Fantastic sur le serveur multi-sites
# (deploy/README.md). À lancer en root après deploy/server/setup.sh.
# Relançable : ne recrée ni la base, ni le .env, ni les secrets s'ils existent.
# Les mises à jour suivantes passent par scripts/deploy.sh (utilisateur deploy).
set -euo pipefail

APP=goldenfantastic
DOMAIN=goldenfantastic.com
PORT=3000
REDIS_DB=0
DB_NAME=golden_fantastic
DB_USER=gf_app
REPO=https://github.com/yihbous-cloud/agenceVoyage.git
DEPLOY_USER=deploy
DIR="/srv/apps/$APP"
as_deploy() { sudo -u "$DEPLOY_USER" -H bash -lc "cd '$DIR' && $1"; }
secret() { openssl rand -base64 32 | tr -d '\n'; }

echo "==> Code"
if [ ! -d "$DIR/.git" ]; then
  sudo -u "$DEPLOY_USER" -H git clone -q "$REPO" "$DIR"
fi
as_deploy "git pull -q --ff-only"

echo "==> Base de données"
if [ -f "$DIR/.env" ]; then
  DB_PASSWORD="$(grep '^DB_PASSWORD=' "$DIR/.env" | cut -d= -f2-)"
else
  DB_PASSWORD="$(openssl rand -hex 24)"
fi
if ! mysql -N -e "SHOW DATABASES LIKE '$DB_NAME'" | grep -q "$DB_NAME"; then
  mysql -e "CREATE DATABASE $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
  mysql "$DB_NAME" < "$DIR/database/schema.sql"
  echo "    base $DB_NAME créée depuis database/schema.sql"
fi
mysql -e "CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';
          ALTER USER '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';
          GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost'; FLUSH PRIVILEGES;"

echo "==> Configuration (.env)"
if [ ! -f "$DIR/.env" ]; then
  umask 077
  cat > "$DIR/.env" <<EOF
# Production — généré par deploy/goldenfantastic/install.sh. Jamais versionné.
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_NAME=$DB_NAME

NEXT_PUBLIC_SITE_URL=https://$DOMAIN
# Domaine propre de l'agence historique (lib/agencyHost.js).
AGENCY_DOMAINS=$DOMAIN=$APP
PORT=$PORT

SESSION_SECRET=$(secret)
# ⚠️ La changer rend illisibles les secrets déjà enregistrés en base.
SECRETS_ENCRYPTION_KEY=$(secret)
REDIS_URL=redis://127.0.0.1:6379/$REDIS_DB

DUFFEL_API_KEY=
META_GRAPH_API_VERSION=v23.0
META_APP_SECRET=
META_WEBHOOK_VERIFY_TOKEN=
WA_MEDIA_DIR=storage/wa-media
WA_ECHO_TEST=0
ANTHROPIC_API_KEY=
WA_AI_DEBOUNCE_MS=7000
TRANSCRIPTION_PROVIDER=
WA_WORKER_AGENCY_IDS=

ADMIN_2FA_ROLES=direction
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=
ALERT_EMAILS=
# ⚠️ À copier HORS du serveur : sans elle, les sauvegardes sont illisibles.
BACKUP_ENCRYPTION_KEY=$(secret)
BACKUP_DIR=storage/backups
BACKUP_RETENTION_DAYS=30
BACKUP_RCLONE_REMOTE=
EOF
  chown "$DEPLOY_USER:$DEPLOY_USER" "$DIR/.env"
  chmod 600 "$DIR/.env"
fi
install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$DIR/storage" "$DIR/public/uploads"

echo "==> Build et démarrage (PM2, utilisateur $DEPLOY_USER)"
as_deploy "npm ci --no-audit --no-fund --loglevel=error && npm run build"
as_deploy "pm2 startOrReload ecosystem.config.cjs --update-env && pm2 save"

echo "==> Nginx + HTTPS"
install -d "/etc/nginx/apps/$APP"
cat > "/etc/nginx/apps/$APP/uploads.conf" <<EOF
# Images envoyées depuis l'admin : servies directement depuis le disque
# (app/uploads/[...path]/route.js prend le relais si le fichier manque).
location ~* ^/uploads/.+\.(jpe?g|png|webp|gif)\$ {
    root $DIR/public;
    try_files \$uri @${APP}_app;
    expires 30d;
}
location @${APP}_app {
    proxy_pass http://127.0.0.1:$PORT;
    include snippets/proxy-app.conf;
}
EOF
new-site "$APP" "$DOMAIN" "$PORT" --www
sed -i "s|^$APP .*|$(printf '%-16s %-39s %-6s %-7s %s' "$APP" "$DOMAIN www.$DOMAIN" "$PORT" "db$REDIS_DB" "$DB_NAME")|" /srv/apps/REGISTRE

echo "Golden Fantastic en ligne : https://$DOMAIN"
