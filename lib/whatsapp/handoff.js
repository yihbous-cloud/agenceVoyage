import { query } from "../db";
import {
  getBusinessHours,
  isOpenAt,
  nextOpeningLabel,
  computeSlaDue,
  getSlaRule,
  resolveTeam,
  notify,
  escortsForTraveler,
} from "./team";
import { addPrivateNote } from "./outbound";
import { getActiveSettings, pickMessage } from "../ai/settings";
import { runSimple } from "../ai/agent";
import { isAiConfigured } from "../ai/client";
import { redactText } from "../ai/redact";

// Transfert d'une conversation à un humain (HU-01, HU-02, HU-09, HU-11).
// Une conversation a UN SEUL propriétaire à la fois : à partir d'ici le
// statut est "humain" et l'agent IA ne répond plus (vérifié avant chaque
// réponse automatique, lib/whatsapp/aiReply.js).

export const REASON_LABELS = {
  intention_achat: "Intention d'achat",
  negociation: "Négociation / groupe",
  reclamation: "Réclamation",
  cas_particulier: "Cas particulier",
  demande_humain: "Demande d'un conseiller",
  question_religieuse: "Question religieuse",
  echec_ia: "L'IA n'a pas pu répondre",
  urgence: "Urgence en voyage",
  recu_paiement: "Reçu de paiement",
  vocal_non_transcrit: "Vocal non transcrit",
  conseiller_attitre: "Client avec conseiller attitré",
  prise_en_main: "Prise en main par un conseiller",
};

const toSql = (d) => (d ? d.toISOString().slice(0, 19).replace("T", " ") : null);

// Conseiller attitré du contact (HU-09) : celui de la fiche WhatsApp, sinon
// celui de l'inscription la plus récente non annulée du voyageur.
export async function findAdvisor(agencyId, contact) {
  if (contact.advisor_staff_id) {
    const rows = await query(`SELECT id FROM staff_users WHERE id = ? AND agency_id = ? AND is_active = TRUE`, [contact.advisor_staff_id, agencyId]);
    if (rows[0]) return rows[0].id;
  }
  if (contact.traveler_id) {
    const rows = await query(
      `SELECT r.advisor_staff_id FROM registrations r
       JOIN staff_users su ON su.id = r.advisor_staff_id AND su.agency_id = r.agency_id AND su.is_active = TRUE
       WHERE r.agency_id = ? AND r.traveler_id = ? AND r.status <> 'annule'
       ORDER BY r.id DESC LIMIT 1`,
      [agencyId, contact.traveler_id]
    );
    if (rows[0]) return rows[0].advisor_staff_id;
  }
  return null;
}

// Phrase à dire au client au moment du transfert (HU-03), selon les horaires.
export async function transferMessageFor(agencyId, settings, language, reason) {
  if (reason === "urgence") return pickMessage(settings, "urgence", language);
  const schedule = await getBusinessHours(agencyId);
  if (isOpenAt(schedule)) return pickMessage(settings, "transfer_in_hours", language);
  return pickMessage(settings, "transfer_out_of_hours", language, {
    OUVERTURE: nextOpeningLabel(schedule, new Date(), language === "ar" || language === "darija_arabe" ? "ar" : "fr"),
  });
}

async function buildSummary(agencyId, conversationId, settings) {
  if (!isAiConfigured()) return "";
  const rows = await query(
    `SELECT direction, author, content, transcription, type FROM wa_messages
     WHERE conversation_id = ? AND agency_id = ? AND is_private_note = FALSE
       AND (draft_status IS NULL OR draft_status = 'envoye')
     ORDER BY id DESC LIMIT 25`,
    [conversationId, agencyId]
  );
  if (rows.length === 0) return "";
  const transcript = rows
    .reverse()
    .map((m) => `${m.direction === "entrant" ? "Client" : m.author === "humain" ? "Conseiller" : "Assistant"} : ${redactText(m.content || m.transcription || `[${m.type}]`)}`)
    .join("\n");
  return runSimple({
    settings,
    agencyId,
    conversationId,
    system:
      "Tu résumes une conversation WhatsApp d'agence de voyages pour le conseiller qui reprend la main. Réponds en français, en 3 à 5 puces courtes : besoin du client, informations de qualification (voyage, mois, personnes, chambre, budget), ce qui a déjà été répondu, ce qui reste à faire. N'invente rien.",
    prompt: transcript,
  });
}

// Transfère la conversation. Options :
//   reason   : motif (clé de sla_rules)
//   summary  : résumé court fourni par l'agent (note privée immédiate)
//   aiSummary: true = résumé détaillé par le modèle léger (HU-02)
//   staffId  : conseiller qui prend la main lui-même (prise en main manuelle)
export async function transferConversation(agencyId, conversationId, { reason, summary = null, aiSummary = true, staffId = null } = {}) {
  const [conv] = await query(
    `SELECT c.*, ct.advisor_staff_id, ct.traveler_id, ct.profile_name, ct.phone FROM wa_conversations c
     JOIN wa_contacts ct ON ct.id = c.contact_id AND ct.agency_id = c.agency_id
     WHERE c.id = ? AND c.agency_id = ?`,
    [conversationId, agencyId]
  );
  if (!conv) throw new Error("Conversation introuvable");

  const rule = await getSlaRule(reason, agencyId);
  const schedule = await getBusinessHours(agencyId);
  let team = rule ? await resolveTeam(rule.team, agencyId) : "direction";
  let assigned = staffId || (await findAdvisor(agencyId, conv));
  let escorts = [];
  if (reason === "urgence") {
    escorts = await escortsForTraveler(conv.traveler_id, agencyId);
    if (escorts[0]) {
      assigned = escorts[0].id;
      team = "accompagnateur";
    }
  }
  const due = staffId ? null : computeSlaDue(schedule, rule, new Date());
  const open = isOpenAt(schedule);

  await query(
    `UPDATE wa_conversations SET status = 'humain', team = ?, assigned_staff_id = ?, transfer_reason = ?, priority = ?,
       transferred_at = UTC_TIMESTAMP(), sla_due_at = ?, sla_alert_level = 0, first_human_reply_at = NULL,
       ooh_notice_sent_at = ?
     WHERE id = ? AND agency_id = ?`,
    [
      team,
      assigned,
      reason,
      rule?.priority || "normale",
      toSql(due),
      // Le message de transfert hors horaires vaut avertissement unique (HU-05).
      open || staffId ? null : toSql(new Date()),
      conversationId,
      agencyId,
    ]
  );

  const label = REASON_LABELS[reason] || reason;
  if (!staffId) {
    await addPrivateNote(agencyId, conversationId, `Transfert — ${label}${summary ? ` : ${summary}` : ""}`);
    if (reason === "echec_ia") {
      const [lastClient] = await query(
        `SELECT content, transcription FROM wa_messages WHERE conversation_id = ? AND agency_id = ? AND direction = 'entrant'
         ORDER BY id DESC LIMIT 1`,
        [conversationId, agencyId]
      );
      const question = lastClient?.content || lastClient?.transcription;
      if (question) {
        await query(`INSERT INTO ia_unanswered (agency_id, conversation_id, question, origin) VALUES (?, ?, ?, 'transfert')`, [
          agencyId,
          conversationId,
          redactText(question),
        ]);
      }
    }
  }

  const who = conv.profile_name || `+${conv.phone}`;
  const title = `${reason === "urgence" ? "🚨 URGENCE" : "WhatsApp"} — ${label} : ${who}`;
  if (reason === "urgence") {
    for (const e of escorts) await notify({ staffId: e.id, kind: "urgence", title, body: summary, conversationId }, agencyId);
    await notify({ team: "direction", kind: "urgence", title, body: summary, conversationId }, agencyId);
  } else if (!staffId) {
    if (assigned) await notify({ staffId: assigned, kind: "transfert", title, body: summary, conversationId }, agencyId);
    else await notify({ team, kind: "transfert", title, body: summary, conversationId }, agencyId);
  }

  if (!staffId && aiSummary) {
    try {
      const settings = await getActiveSettings(agencyId);
      const text = await buildSummary(agencyId, conversationId, settings);
      if (text) {
        await addPrivateNote(agencyId, conversationId, `Résumé IA :\n${text}`);
        await query(`UPDATE wa_conversations SET summary = ? WHERE id = ? AND agency_id = ?`, [text, conversationId, agencyId]);
      }
    } catch (err) {
      console.warn(`[handoff] résumé impossible (conversation ${conversationId}) : ${err.message}`);
    }
  }
  return { team, assigned, due, open };
}

// Alertes SLA (HU-06) : relance de l'équipe à l'échéance, puis du
// responsable (direction) si rien n'a bougé après un second délai.
// Balayage toutes agences (worker), agence portée par chaque ligne.
export async function checkSlaBreaches(agencyIds = null) {
  const scope = agencyIds?.length ? `AND c.agency_id IN (${agencyIds.map(Number).join(", ")})` : "";
  const rows = await query(
    `SELECT c.id, c.agency_id, c.team, c.assigned_staff_id, c.transfer_reason, c.sla_due_at, c.sla_alert_level,
       c.transferred_at, ct.profile_name, ct.phone
     FROM wa_conversations c -- agency-lint-ok: balayage worker, agence portée par chaque ligne
     JOIN wa_contacts ct ON ct.id = c.contact_id AND ct.agency_id = c.agency_id
     WHERE c.status = 'humain' AND c.sla_due_at IS NOT NULL AND c.sla_due_at < UTC_TIMESTAMP()
       AND c.first_human_reply_at IS NULL AND c.sla_alert_level < 2 ${scope}
     LIMIT 200`
  );
  for (const c of rows) {
    const label = REASON_LABELS[c.transfer_reason] || c.transfer_reason || "transfert";
    const who = c.profile_name || `+${c.phone}`;
    if (c.sla_alert_level === 0) {
      const title = `Délai dépassé — ${label} : ${who}`;
      if (c.assigned_staff_id) await notify({ staffId: c.assigned_staff_id, kind: "sla", title, conversationId: c.id }, c.agency_id);
      await notify({ team: c.team || "direction", kind: "sla", title, conversationId: c.id }, c.agency_id);
      // Escalade au responsable après un second délai équivalent.
      const span = new Date(`${c.sla_due_at.replace(" ", "T")}Z`) - new Date(`${c.transferred_at.replace(" ", "T")}Z`);
      const next = new Date(Date.now() + Math.max(span, 5 * 60 * 1000));
      await query(`UPDATE wa_conversations SET sla_alert_level = 1, sla_due_at = ? WHERE id = ? AND agency_id = ?`, [toSql(next), c.id, c.agency_id]);
    } else {
      await notify({ team: "direction", kind: "sla_escalade", title: `Escalade : toujours sans réponse — ${label} : ${who}`, conversationId: c.id }, c.agency_id);
      await query(`UPDATE wa_conversations SET sla_alert_level = 2 WHERE id = ? AND agency_id = ?`, [c.id, c.agency_id]);
    }
  }
  return rows.length;
}
