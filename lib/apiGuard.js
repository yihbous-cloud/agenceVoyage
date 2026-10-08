import { NextResponse } from "next/server";

// Multi-agences : assertOwned (lib/agencyContext.js) lève une erreur
// NOT_FOUND quand une ressource référencée n'appartient pas à l'agence
// courante. Sans ce garde-fou la route répondrait 500 (erreur non gérée) ;
// on répond 404 avec le MÊME message qu'une ressource inexistante — jamais
// de différence observable entre "n'existe pas" et "est à une autre agence".
export function withNotFound(handler) {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err?.code === "NOT_FOUND") {
        return NextResponse.json({ message: "Ressource introuvable" }, { status: 404 });
      }
      throw err;
    }
  };
}
