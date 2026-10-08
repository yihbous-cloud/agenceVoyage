import { readFile, stat } from "fs/promises";
import path from "path";

// Images envoyées depuis l'admin (public/uploads/...). En production, `next
// start` ne liste le dossier public/ qu'au démarrage : un fichier uploadé
// ensuite (logo, diapositive, couverture de programme) répondrait 404 — y
// compris pour l'optimiseur next/image, qui le récupère en interne — jusqu'au
// prochain redémarrage. Cette route ne sert donc que ces fichiers-là (ceux
// présents au démarrage restent servis directement par Next, et Nginx sert
// /uploads/ depuis le disque en production). Mêmes formats que l'upload
// (app/api/admin/upload) : jamais de SVG/HTML, qui pourraient exécuter du code.
const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");
const CONTENT_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export async function GET(_request, { params }) {
  const { path: segments } = await params;
  const filePath = path.resolve(UPLOADS_DIR, ...(segments || []));
  const contentType = CONTENT_TYPES[path.extname(filePath).toLowerCase()];
  if (!contentType || !filePath.startsWith(UPLOADS_DIR + path.sep)) {
    return new Response("Introuvable", { status: 404 });
  }
  try {
    const info = await stat(filePath);
    if (!info.isFile()) return new Response("Introuvable", { status: 404 });
    const body = await readFile(filePath);
    return new Response(body, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(info.size),
        // Noms de fichier aléatoires (UUID) : un fichier ne change jamais.
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Introuvable", { status: 404 });
  }
}
