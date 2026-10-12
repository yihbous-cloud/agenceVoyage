import { notFound } from "next/navigation";

// Toute URL publique qui ne correspond à aucune page : on affiche la page 404
// habillée de l'agence (../not-found.js, dans le layout du site) plutôt que
// la page 404 par défaut de Next, sans layout — avec un vrai code HTTP 404.
export default function UnknownPublicPage() {
  notFound();
}
