// Liens vidéo des fiches voyage (vague 2A) — fichier PUR, utilisable côté
// client (façade vidéo, aperçu dans l'admin) comme côté serveur.

// Identifiant d'une vidéo YouTube (watch?v=, youtu.be/, shorts/, embed/),
// ou null si le lien n'est pas une vidéo YouTube.
export function youtubeId(url) {
  if (!url) return null;
  let parsed;
  try {
    parsed = new URL(String(url).trim());
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^www\.|^m\./, "");
  let id = null;
  if (host === "youtu.be") id = parsed.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (parsed.pathname === "/watch") id = parsed.searchParams.get("v");
    else {
      const match = parsed.pathname.match(/^\/(?:shorts|embed|live)\/([^/?#]+)/);
      id = match?.[1] || null;
    }
  }
  return id && /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : null;
}

export const youtubeThumbnail = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
export const youtubeEmbedUrl = (id) => `https://www.youtube-nocookie.com/embed/${id}`;
export const youtubeWatchUrl = (id) => `https://www.youtube.com/watch?v=${id}`;
