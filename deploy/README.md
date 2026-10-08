# Serveur de production (VPS Hostinger, multi-sites)

VPS Ubuntu 24.04 (`srv2036938.hstgr.cloud`, IP `187.7.65.20`), prévu pour héberger **plusieurs projets**. Un projet = un dossier, un port local, une base MySQL, une base Redis et un fichier Nginx.

| Élément | Emplacement |
|---|---|
| Projets | `/srv/apps/<nom>/` (propriétaire `deploy`) |
| Registre des projets (domaine, port, Redis, MySQL) | `/srv/apps/REGISTRE` |
| Vhosts Nginx (générés) | `/etc/nginx/sites-available/<nom>.conf` |
| Réglages Nginx propres à un projet | `/etc/nginx/apps/<nom>/*.conf` |
| Certificats HTTPS (renouvelés automatiquement) | `/etc/letsencrypt/live/<nom>/` |
| Processus Node | PM2, utilisateur `deploy` (`pm2 ls`), relancés au démarrage |

Seuls les ports 22, 80 et 443 sont ouverts (ufw). MySQL et Redis n'écoutent que sur `127.0.0.1`, et chaque application n'écoute que sur `127.0.0.1:<port>` : Nginx est le seul point d'entrée.

## Mise en place (une seule fois)

```bash
scp -r deploy root@187.7.65.20:/root/deploy
ssh root@187.7.65.20 bash /root/deploy/server/setup.sh
```

## Ajouter un nouveau projet

1. DNS du domaine → `187.7.65.20` (enregistrement A, + CNAME `www`).
2. Choisir un port libre et une base Redis libre dans `/srv/apps/REGISTRE`.
3. Base MySQL dédiée (en root : `mysql -e "CREATE DATABASE ..."`, puis un utilisateur limité à cette base).
4. Code dans `/srv/apps/<nom>` (utilisateur `deploy`), lancé par PM2 sur `127.0.0.1:<port>`.
5. `new-site <nom> <domaine> <port> --www` : vhost + certificat HTTPS.

## Golden Fantastic

- Première installation : `bash deploy/goldenfantastic/install.sh` (root). Port 3000, Redis base 0, MySQL `golden_fantastic` (utilisateur `gf_app`).
- Mise à jour après un `git push` sur `main` :

  ```bash
  ssh deploy@187.7.65.20 /srv/apps/goldenfantastic/scripts/deploy.sh
  ```

  ⚠️ Les migrations `database/migrations/*.sql` ne sont pas appliquées automatiquement : les lancer avant (`mysql golden_fantastic < database/migrations/0XX_....sql` en root).
- Le `.env` de production est sur le serveur uniquement (`/srv/apps/goldenfantastic/.env`). **`BACKUP_ENCRYPTION_KEY` doit aussi être conservée ailleurs** : sans elle, les sauvegardes sont illisibles.
- Domaine `goldenfantastic.com` rattaché à l'agence `goldenfantastic` par `AGENCY_DOMAINS` (`lib/agencyHost.js`) ; `www` redirige vers le domaine nu.
- Journaux : `pm2 logs gf-web`, `pm2 logs gf-worker`, `/var/log/nginx/goldenfantastic.*.log`.
