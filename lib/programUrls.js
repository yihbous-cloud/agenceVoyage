// URL publiques des programmes (référencement global, CLAUDE.md
// §3centtreizequadragies, décision D2) : Omra et Hajj sont deux piliers
// distincts. `programs.family` reste inchangé (omra_hajj / voyage_organise) ;
// c'est `program_type = 'hajj'` qui envoie un programme sous /hajj, tout le
// reste de la famille Omra & Hajj va sous /omra. Fichier pur (client et
// serveur) : SEULE source de ces chemins — ne jamais les réécrire à la main.
// Chemins SANS préfixe de langue (voir localizePath, lib/i18n/locales.js).

export const PILLAR_PATHS = {
  omra: "/omra",
  hajj: "/hajj",
  voyage: "/voyages-organises",
};

// Libellés source (français) des piliers, traduits à l'affichage par tr().
export const PILLAR_LABELS = {
  omra: "Omra",
  hajj: "Hajj",
  voyage: "Voyages organisés",
};

// "omra" | "hajj" | "voyage" — accepte une ligne `programs` brute
// ({ family, program_type }).
export function programPillar(program) {
  if (!program) return "omra";
  if (program.family === "voyage_organise") return "voyage";
  return program.program_type === "hajj" ? "hajj" : "omra";
}

export function pillarPath(program) {
  return PILLAR_PATHS[programPillar(program)];
}

export function programPath(program) {
  return `${pillarPath(program)}/${program.slug}`;
}
