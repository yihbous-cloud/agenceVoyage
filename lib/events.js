import { resolveAgencyId } from "./agencyContext";
import { enqueue, QUEUES } from "./queue";

// Bus d'événements CRM → moteur de déclencheurs WhatsApp (cahier §7.2,
// DC-01 famille « événement »). Appelé depuis les fonctions CRM existantes
// (inscription créée, paiement reçu, statut visa, chambre affectée, billet
// émis...) ; le traitement se fait dans le worker (lib/whatsapp/triggers.js).
//
// ⚠️ Ne fait JAMAIS échouer l'opération CRM qui l'appelle : une erreur (Redis
// arrêté, agence introuvable) est seulement journalisée. Un événement perdu
// = un message automatique non envoyé, jamais une inscription ou un paiement
// refusé.
export const CRM_EVENTS = {
  inscription_creee: "Inscription créée",
  paiement_recu: "Paiement reçu",
  statut_paye_complet: "Dossier entièrement réglé",
  visa_en_cours: "Visa : demande en cours",
  visa_accorde: "Visa accordé",
  visa_refuse: "Visa refusé",
  chambre_affectee: "Chambre affectée",
  billet_emis: "Billet émis (PNR renseigné)",
  prospect_qualifie: "Prospect qualifié (mois + personnes + chambre)",
};

export async function emitCrmEvent(type, data = {}) {
  try {
    const agencyId = await resolveAgencyId(data.agencyId);
    await enqueue(QUEUES.triggers, "event", { agencyId, type, ...data, at: new Date().toISOString() }, { attempts: 3 });
  } catch (err) {
    console.warn(`[events] ${type} non transmis : ${err.message}`);
  }
}
