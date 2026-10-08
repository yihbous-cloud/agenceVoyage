#!/usr/bin/env bash
# Ajoute un site sur le serveur (deploy/README.md) : vhost Nginx vers une
# application locale (127.0.0.1:<port>) + certificat HTTPS Let's Encrypt.
#
#   new-site <nom> <domaine> <port> [--www]
#   ex. new-site goldenfantastic goldenfantastic.com 3000 --www
#
# --www : www.<domaine> reçoit aussi un certificat et redirige vers <domaine>.
# Réglages propres au site (fichiers servis par Nginx, limites...) : déposer
# des fichiers *.conf dans /etc/nginx/apps/<nom>/, inclus dans le bloc HTTPS.
# Le DNS du domaine doit déjà pointer vers ce serveur (validation HTTP).
set -euo pipefail

NAME="${1:-}"; DOMAIN="${2:-}"; PORT="${3:-}"; WWW="${4:-}"
if [[ ! "$NAME" =~ ^[a-z0-9-]+$ || -z "$DOMAIN" || ! "$PORT" =~ ^[0-9]+$ ]]; then
  echo "Usage : new-site <nom> <domaine> <port> [--www]" >&2
  exit 1
fi

CONF="/etc/nginx/sites-available/$NAME.conf"
NAMES="$DOMAIN"
CERT_ARGS=(-d "$DOMAIN")
if [ "$WWW" = "--www" ]; then
  NAMES="$DOMAIN www.$DOMAIN"
  CERT_ARGS+=(-d "www.$DOMAIN")
fi
install -d "/etc/nginx/apps/$NAME"

# 1. HTTP seul, le temps d'obtenir le certificat.
if [ ! -f "/etc/letsencrypt/live/$NAME/fullchain.pem" ]; then
  cat > "$CONF" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $NAMES;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 503; }
}
EOF
  ln -sf "$CONF" "/etc/nginx/sites-enabled/$NAME.conf"
  nginx -t -q
  systemctl reload nginx
  certbot certonly --webroot -w /var/www/certbot --cert-name "$NAME" "${CERT_ARGS[@]}" \
    --non-interactive --agree-tos --register-unsafely-without-email --keep-until-expiring
fi

# 2. Configuration finale : HTTP → HTTPS, www → domaine nu, proxy vers l'app.
{
  cat <<EOF
# Généré par new-site — modifier plutôt /etc/nginx/apps/$NAME/*.conf
server {
    listen 80;
    listen [::]:80;
    server_name $NAMES;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://$DOMAIN\$request_uri; }
}
EOF
  if [ "$WWW" = "--www" ]; then
    cat <<EOF
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name www.$DOMAIN;
    ssl_certificate /etc/letsencrypt/live/$NAME/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$NAME/privkey.pem;
    include snippets/ssl-commun.conf;
    return 301 https://$DOMAIN\$request_uri;
}
EOF
  fi
  cat <<EOF
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $DOMAIN;
    ssl_certificate /etc/letsencrypt/live/$NAME/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$NAME/privkey.pem;
    include snippets/ssl-commun.conf;
    access_log /var/log/nginx/$NAME.access.log;
    error_log /var/log/nginx/$NAME.error.log;

    include /etc/nginx/apps/$NAME/*.conf;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        include snippets/proxy-app.conf;
    }
}
EOF
} > "$CONF"
ln -sf "$CONF" "/etc/nginx/sites-enabled/$NAME.conf"
nginx -t -q
systemctl reload nginx

REGISTRE=/srv/apps/REGISTRE
if [ -f "$REGISTRE" ] && ! grep -q "^$NAME " "$REGISTRE"; then
  printf '%-16s %-39s %-6s %-7s %s\n' "$NAME" "$NAMES" "$PORT" "?" "?" >> "$REGISTRE"
fi
echo "Site $NAME prêt : https://$DOMAIN → 127.0.0.1:$PORT"
