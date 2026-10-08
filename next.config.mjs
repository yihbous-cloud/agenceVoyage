/** @type {import('next').NextConfig} */
const nextConfig = {
  // File d'attente WhatsApp (lib/queue.js) : chargées telles quelles par
  // Node plutôt qu'empaquetées (scripts Lua de BullMQ lus sur le disque).
  serverExternalPackages: ["bullmq", "ioredis"],
};

export default nextConfig;
