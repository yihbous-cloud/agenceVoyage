/** @type {import('next').NextConfig} */
const nextConfig = {
  // File d'attente WhatsApp (lib/queue.js) : chargées telles quelles par
  // Node plutôt qu'empaquetées (scripts Lua de BullMQ lus sur le disque).
  serverExternalPackages: ["bullmq", "ioredis"],
  // Next 16 n'autorise par défaut que la qualité 75 : 90 pour le slider
  // d'accueil (HeroSlider.jsx), afin de ne pas dégrader les affiches.
  images: { qualities: [75, 90] },
};

export default nextConfig;
