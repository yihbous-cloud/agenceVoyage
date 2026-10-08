// PM2 (production, VPS) : site Next.js + worker WhatsApp, redémarrés
// automatiquement en cas de plantage (NF-05), sauvegarde et contrôle de santé.
//   pm2 start ecosystem.config.cjs && pm2 save
//
// Serveur partagé entre plusieurs projets (deploy/README.md) : le site
// n'écoute que sur la boucle locale (Nginx est seul exposé) et sur le port attribué
// au projet dans /srv/apps/REGISTRE (PORT, 3000 par défaut). `cwd` fixé au
// dossier du projet : storage/, public/uploads et .env sont relatifs à lui.
const fs = require("fs");
const path = require("path");

function portFromEnvFile() {
  try {
    const line = fs.readFileSync(path.join(__dirname, ".env"), "utf8").match(/^PORT=(\d+)\s*$/m);
    return line?.[1];
  } catch {
    return undefined;
  }
}
const PORT = process.env.PORT || portFromEnvFile() || "3000";

module.exports = {
  apps: [
    {
      name: "gf-web",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      // "localhost" et non "127.0.0.1" : Next compare l'origine des réécritures
      // de proxy.js à celle du serveur — avec 127.0.0.1 elles diffèrent et Next
      // tente de "proxyfier" vers https://localhost:3000 (erreur 500 EPROTO).
      // ipv4first : "localhost" se résout en ::1 sur Ubuntu ; Nginx vise 127.0.0.1.
      node_args: "--dns-result-order=ipv4first",
      args: `start -H localhost -p ${PORT}`,
      env: { NODE_ENV: "production" },
      max_memory_restart: "1G",
    },
    {
      name: "gf-worker",
      cwd: __dirname,
      script: "worker/index.mjs",
      node_args: "--env-file=.env --import ./scripts/esm-register.mjs",
      env: { NODE_ENV: "production" },
      max_memory_restart: "512M",
      kill_timeout: 10000,
    },
    // Tâches planifiées (lancées par PM2, pas de redémarrage en boucle) :
    // sauvegarde chiffrée chaque nuit à 2h30 (NF-14), contrôle de santé
    // toutes les 5 minutes avec alerte e-mail (NF-05). Heure du serveur (UTC).
    {
      name: "gf-backup",
      cwd: __dirname,
      script: "scripts/backup.mjs",
      node_args: "--env-file=.env",
      cron_restart: "30 2 * * *",
      autorestart: false,
      env: { NODE_ENV: "production" },
    },
    {
      name: "gf-healthcheck",
      cwd: __dirname,
      script: "scripts/healthcheck.mjs",
      node_args: "--env-file=.env",
      cron_restart: "*/5 * * * *",
      autorestart: false,
      env: { NODE_ENV: "production" },
    },
  ],
};
