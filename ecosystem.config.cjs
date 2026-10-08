// PM2 (production, VPS) : site Next.js + worker WhatsApp, redémarrés
// automatiquement en cas de plantage (NF-05), sauvegarde et contrôle de santé.
//   pm2 start ecosystem.config.cjs && pm2 save
module.exports = {
  apps: [
    {
      name: "gf-web",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      env: { NODE_ENV: "production" },
      max_memory_restart: "1G",
    },
    {
      name: "gf-worker",
      script: "worker/index.mjs",
      node_args: "--env-file=.env --import ./scripts/esm-register.mjs",
      env: { NODE_ENV: "production" },
      max_memory_restart: "512M",
      kill_timeout: 10000,
    },
    // Tâches planifiées (lancées par PM2, pas de redémarrage en boucle) :
    // sauvegarde chiffrée chaque nuit à 2h30 (NF-14), contrôle de santé
    // toutes les 5 minutes avec alerte e-mail (NF-05). Heure du serveur.
    {
      name: "gf-backup",
      script: "scripts/backup.mjs",
      node_args: "--env-file=.env",
      cron_restart: "30 2 * * *",
      autorestart: false,
      env: { NODE_ENV: "production" },
    },
    {
      name: "gf-healthcheck",
      script: "scripts/healthcheck.mjs",
      node_args: "--env-file=.env",
      cron_restart: "*/5 * * * *",
      autorestart: false,
      env: { NODE_ENV: "production" },
    },
  ],
};
