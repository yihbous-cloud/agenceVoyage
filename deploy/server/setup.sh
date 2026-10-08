#!/usr/bin/env bash
# Préparation d'un VPS Ubuntu 24.04 pour héberger PLUSIEURS sites (voir
# deploy/README.md). À lancer en root ; relançable sans risque (idempotent).
#
#   Nginx (un fichier par site) + certificats Let's Encrypt
#   Node.js + PM2 (applications lancées par l'utilisateur "deploy")
#   MySQL 8 et Redis, accessibles uniquement depuis le serveur
#   Pare-feu (SSH/HTTP/HTTPS), fail2ban, mises à jour de sécurité automatiques
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

NODE_MAJOR=24
DEPLOY_USER=deploy
APPS_DIR=/srv/apps
HERE="$(cd "$(dirname "$0")" && pwd)"

echo "==> Paquets système"
apt-get update -q
apt-get -y -q -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold upgrade
apt-get -y -q install ca-certificates curl gnupg git build-essential rsync jq htop \
  ufw fail2ban unattended-upgrades nginx certbot mysql-server redis-server
timedatectl set-timezone UTC

echo "==> Mémoire d'échange (2 Go, utile pendant les builds)"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
echo 'vm.swappiness=10' > /etc/sysctl.d/90-swappiness.conf && sysctl -q -p /etc/sysctl.d/90-swappiness.conf

echo "==> Pare-feu"
ufw allow OpenSSH >/dev/null
ufw allow 'Nginx Full' >/dev/null
ufw --force enable >/dev/null

echo "==> fail2ban (SSH)"
cat > /etc/fail2ban/jail.d/sshd.local <<'EOF'
[sshd]
enabled = true
maxretry = 5
findtime = 10m
bantime = 1h
EOF
systemctl enable -q fail2ban && systemctl restart fail2ban

echo "==> Mises à jour de sécurité automatiques"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF

echo "==> Node.js $NODE_MAJOR + PM2"
if ! command -v node >/dev/null || ! node -v | grep -q "^v$NODE_MAJOR\."; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - >/dev/null
  apt-get -y -q install nodejs
fi
command -v pm2 >/dev/null || npm install -g pm2 >/dev/null

echo "==> MySQL (local uniquement, UTC)"
cat > /etc/mysql/mysql.conf.d/zz-serveur.cnf <<'EOF'
[mysqld]
bind-address = 127.0.0.1
mysqlx-bind-address = 127.0.0.1
# Les applications comparent CURRENT_TIMESTAMP à UTC_TIMESTAMP() : MySQL en UTC.
default-time-zone = '+00:00'
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci
innodb_buffer_pool_size = 1G
max_connections = 200
EOF
systemctl enable -q mysql && systemctl restart mysql

echo "==> Redis (local uniquement, persistant, jamais d'éviction : files BullMQ)"
redis-cli CONFIG SET maxmemory 512mb >/dev/null
redis-cli CONFIG SET maxmemory-policy noeviction >/dev/null
redis-cli CONFIG SET appendonly yes >/dev/null
redis-cli CONFIG REWRITE >/dev/null
systemctl enable -q redis-server

echo "==> Utilisateur $DEPLOY_USER et dossier $APPS_DIR"
id "$DEPLOY_USER" >/dev/null 2>&1 || adduser --disabled-password --gecos "" "$DEPLOY_USER" >/dev/null
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
if [ -f /root/.ssh/authorized_keys ]; then
  install -m 600 -o "$DEPLOY_USER" -g "$DEPLOY_USER" /root/.ssh/authorized_keys "/home/$DEPLOY_USER/.ssh/authorized_keys"
fi
install -d -m 755 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$APPS_DIR"
[ -f "$APPS_DIR/REGISTRE" ] || cat > "$APPS_DIR/REGISTRE" <<'EOF'
# Projets hébergés sur ce serveur — un port et une base Redis par projet.
# nom              domaine(s)                              port   redis   base MySQL
EOF
chown "$DEPLOY_USER:$DEPLOY_USER" "$APPS_DIR/REGISTRE"
env PATH="$PATH" pm2 startup systemd -u "$DEPLOY_USER" --hp "/home/$DEPLOY_USER" >/dev/null
systemctl enable -q --now "pm2-$DEPLOY_USER"

echo "==> Nginx (réglages communs, site par défaut fermé)"
rm -f /etc/nginx/sites-enabled/default
install -d /var/www/certbot /etc/nginx/apps
cat > /etc/nginx/conf.d/00-serveur.conf <<'EOF'
server_tokens off;
client_max_body_size 10m;
# gzip on; est déjà dans nginx.conf (Ubuntu) — le répéter ferait échouer nginx -t.
gzip_vary on;
gzip_proxied any;
gzip_comp_level 5;
gzip_types text/plain text/css text/xml application/json application/javascript application/xml application/rss+xml image/svg+xml;
map $http_upgrade $connection_upgrade { default upgrade; '' close; }
EOF
cat > /etc/nginx/snippets/proxy-app.conf <<'EOF'
proxy_http_version 1.1;
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection $connection_upgrade;
proxy_read_timeout 120s;
EOF
cat > /etc/nginx/snippets/ssl-commun.conf <<'EOF'
ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 1d;
add_header Strict-Transport-Security "max-age=31536000" always;
add_header X-Content-Type-Options nosniff always;
add_header Referrer-Policy strict-origin-when-cross-origin always;
EOF
# Un domaine qui ne correspond à aucun site est refusé (pas de site servi
# "par hasard" sur l'IP du serveur ou un domaine mal configuré).
cat > /etc/nginx/sites-available/00-defaut.conf <<'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 444; }
}
server {
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;
    server_name _;
    ssl_reject_handshake on;
}
EOF
ln -sf /etc/nginx/sites-available/00-defaut.conf /etc/nginx/sites-enabled/00-defaut.conf
install -d /etc/letsencrypt/renewal-hooks/deploy
printf '#!/bin/sh\nsystemctl reload nginx\n' > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
nginx -t -q
systemctl reload nginx

echo "==> Outil d'ajout de site"
install -m 755 "$HERE/new-site.sh" /usr/local/sbin/new-site

echo "Serveur prêt. Ajouter un site : new-site <nom> <domaine> <port> [--www]"
