// Transcription des messages vocaux (WA-06) — interface à adaptateurs.
// ⚠️ Fournisseur NON choisi : le cahier des charges impose de le choisir
// après un banc d'essai sur de vrais vocaux en darija (non fournis à ce
// jour). Sans fournisseur configuré (TRANSCRIPTION_PROVIDER vide), les vocaux
// sont conservés et la conversation est transférée à un conseiller qui les
// écoute (lib/whatsapp/aiReply.js, motif vocal_non_transcrit).
//
// Ajouter un fournisseur = une entrée dans PROVIDERS :
//   async ({ buffer, mimeType, fileName }) => ({ text, language? })
// avec sa clé lue dans une variable d'environnement dédiée.

const PROVIDERS = {};

export function transcriptionProvider() {
  const name = (process.env.TRANSCRIPTION_PROVIDER || "").trim();
  return PROVIDERS[name] ? name : null;
}

export async function transcribeAudio({ buffer, mimeType, fileName }) {
  const name = transcriptionProvider();
  if (!name) return null;
  const result = await PROVIDERS[name]({ buffer, mimeType, fileName });
  return result?.text ? { ...result, provider: name } : null;
}
