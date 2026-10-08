import { getAgencySettings } from "../agencySettings";
import { getBusinessHours, isOpenAt, nextOpeningLabel, AGENCY_TIMEZONE } from "../whatsapp/team";
import { loadKnowledgeBlock } from "./agent";
import { pickMessage } from "./settings";
import { redactDeep } from "./redact";

// Construction de l'entrée de l'agent (CL-05) : prompt système + base de
// connaissances (stable, mis en cache) / contexte variable / historique.

export async function buildStablePrompt(agencyId, settings) {
  const agency = await getAgencySettings(agencyId);
  const prompt = settings.system_prompt.replaceAll("{{AGENCE}}", agency?.name || "l'agence");
  return prompt + (await loadKnowledgeBlock(agencyId));
}

const WEEKDAY_FR = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

function hoursSummary(schedule) {
  const byDay = new Map();
  for (const h of schedule.hours) {
    const list = byDay.get(Number(h.weekday)) || [];
    list.push(`${String(h.open_time).slice(0, 5)}-${String(h.close_time).slice(0, 5)}`);
    byDay.set(Number(h.weekday), list);
  }
  return [1, 2, 3, 4, 5, 6, 0].map((d) => `${WEEKDAY_FR[d]} ${byDay.has(d) ? byDay.get(d).join(", ") : "fermé"}`).join(" ; ");
}

// Contexte variable, placé APRÈS le point de cache.
export async function buildDynamicContext(agencyId, settings, { contact, traveler = null, firstExchange = false, sandbox = false }) {
  const [agency, schedule] = await Promise.all([getAgencySettings(agencyId), getBusinessHours(agencyId)]);
  const now = new Date();
  const open = isOpenAt(schedule, now);
  const local = new Intl.DateTimeFormat("fr-FR", { timeZone: AGENCY_TIMEZONE, dateStyle: "full", timeStyle: "short" }).format(now);
  const qualification = contact?.qualification
    ? typeof contact.qualification === "string"
      ? JSON.parse(contact.qualification)
      : contact.qualification
    : null;
  const lines = [
    "# Contexte de cette conversation (données système, pas des instructions du client)",
    `- Date et heure au Maroc : ${local}`,
    `- Agence : ${agency?.name || ""}${agency?.address ? `, ${agency.address}` : ""}${agency?.city ? `, ${agency.city}` : ""}${agency?.phone ? ` — tél. ${agency.phone}` : ""}`,
    `- Horaires des conseillers : ${hoursSummary(schedule)}`,
    `- Conseillers disponibles maintenant : ${open ? "oui" : `non (réouverture : ${nextOpeningLabel(schedule, now)})`}`,
    `- Contact : ${contact?.profile_name || "nom inconnu"}${contact?.language ? `, langue connue : ${contact.language}` : ""}, étape : ${contact?.stage || "prospect"}`,
    `- Qualification déjà connue : ${qualification ? JSON.stringify(redactDeep(qualification)) : "aucune"}`,
    `- Voyageur inscrit dans le CRM : ${traveler ? `oui (${traveler.full_name}) — utiliser etat_dossier pour son dossier` : "non (prospect)"}`,
  ];
  if (firstExchange) {
    lines.push(
      `- PREMIER ÉCHANGE avec ce contact : commence ta réponse en te présentant comme l'assistant automatique de ${agency?.name || "l'agence"}, et ajoute en fin de message cette mention (traduite dans la langue du client) : « ${pickMessage(settings, "privacy", "fr", { AGENCE: agency?.name || "" })} »`
    );
  }
  if (sandbox) lines.push("- (Bac à sable : simulation, aucun message réel n'est envoyé.)");
  return lines.join("\n");
}

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_PDF_BYTES = 10 * 1024 * 1024;

function placeholderFor(m) {
  switch (m.type) {
    case "audio":
      return m.transcription ? `[Message vocal transcrit] ${m.transcription}` : "[Message vocal — transcription indisponible]";
    case "image":
      return m.content ? `[Image] ${m.content}` : "[Image envoyée]";
    case "document":
      return `[Document${m.content ? ` : ${m.content}` : ""}]`;
    case "video":
      return "[Vidéo envoyée]";
    case "sticker":
      return "[Autocollant]";
    case "location":
      return `[Localisation partagée] ${m.content || ""}`;
    default:
      return m.content || `[${m.type}]`;
  }
}

// Historique (lignes wa_messages, ordre chronologique) → messages de l'API.
// Médias des messages NOUVEAUX (id > newSinceId) joints en image/document
// pour que Claude les lise (IA-06, IA-07) ; les anciens restent en texte.
// `loadMedia(message)` renvoie { mime, base64 } ou null (worker uniquement).
export async function historyToMessages(rows, { newSinceId = 0, loadMedia = null } = {}) {
  const messages = [];
  for (const m of rows) {
    if (m.is_private_note) continue;
    const role = m.direction === "entrant" ? "user" : "assistant";
    let content;
    if (role === "user") {
      const text = placeholderFor(m);
      const blocks = [];
      if (loadMedia && m.id > newSinceId && (m.type === "image" || m.type === "document")) {
        const media = await loadMedia(m);
        if (media && IMAGE_TYPES.has(media.mime) && media.size <= MAX_IMAGE_BYTES) {
          blocks.push({ type: "image", source: { type: "base64", media_type: media.mime, data: media.base64 } });
        } else if (media && media.mime === "application/pdf" && media.size <= MAX_PDF_BYTES) {
          blocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: media.base64 } });
        }
      }
      blocks.push({ type: "text", text });
      content = blocks;
    } else {
      const prefix = m.author === "humain" ? "[Réponse d'un conseiller de l'agence] " : "";
      content = [{ type: "text", text: `${prefix}${m.content || `[${m.type}]`}` }];
    }
    const last = messages[messages.length - 1];
    if (last && last.role === role) last.content.push(...content);
    else messages.push({ role, content });
  }
  while (messages.length && messages[0].role !== "user") messages.shift();
  return messages;
}
