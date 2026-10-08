// 27 déclencheurs PROPOSÉS (DC-09) — le catalogue du « dossier de
// conception » n'ayant pas été fourni, cette liste couvre le parcours client
// du cahier (inscription, documents, paiements, visa, vol, pré-départ,
// voyage, retour) et les déclencheurs internes (DC-10). Tous chargés
// INACTIFS : chacun s'active depuis /admin/whatsapp/declencheurs après
// relecture et approbation par Meta du template utilisé.

const STOP_PAYE = ["reponse_client", "paiement_complet", "depart_passe"];

export const DEFAULT_TRIGGERS = [
  // --- Événements CRM ---
  { code: "inscription_confirmee", name: "Confirmation d'inscription", family: "evenement", event_type: "inscription_creee", template_name: "gf_inscription_confirmee", delay_minutes: 5 },
  { code: "paiement_recu", name: "Confirmation de versement", family: "evenement", event_type: "paiement_recu", template_name: "gf_paiement_recu", max_per_target: 10 },
  { code: "solde_regle", name: "Dossier entièrement réglé", family: "evenement", event_type: "statut_paye_complet", template_name: "gf_solde_regle" },
  { code: "visa_en_cours", name: "Visa : demande déposée", family: "evenement", event_type: "visa_en_cours", template_name: "gf_visa_en_cours" },
  { code: "visa_accorde", name: "Visa accordé", family: "evenement", event_type: "visa_accorde", template_name: "gf_visa_accorde" },
  { code: "visa_refuse", name: "Visa : action requise (refus)", family: "evenement", event_type: "visa_refuse", template_name: "gf_visa_action_requise" },
  { code: "chambre_affectee", name: "Hébergement attribué", family: "evenement", event_type: "chambre_affectee", template_name: "gf_hebergement_confirme", delay_minutes: 120, description: "Délai de 2h pour laisser le temps d'affecter toutes les villes." },
  { code: "billet_emis", name: "Billet émis (PNR renseigné)", family: "evenement", event_type: "billet_emis", template_name: "gf_billet_emis", delay_minutes: 30 },
  // --- Documents ---
  { code: "documents_j45", name: "Documents manquants (J-45)", family: "date_relative", anchor: "depart", offset_days: -45, template_name: "gf_documents_manquants", conditions: { documents_incomplets: true }, stop_conditions: ["document_recu"] },
  { code: "documents_j30", name: "Relance documents (J-30)", family: "date_relative", anchor: "depart", offset_days: -30, template_name: "gf_rappel_documents", conditions: { documents_incomplets: true }, stop_conditions: ["document_recu"] },
  { code: "documents_j15", name: "Dernière relance documents (J-15)", family: "date_relative", anchor: "depart", offset_days: -15, template_name: "gf_rappel_documents", conditions: { documents_incomplets: true }, stop_conditions: ["document_recu"] },
  { code: "documents_inscription_j3", name: "Documents manquants (3 jours après l'inscription)", family: "date_relative", anchor: "inscription", offset_days: 3, template_name: "gf_documents_manquants", conditions: { documents_incomplets: true }, stop_conditions: ["document_recu"] },
  // --- Paiements ---
  { code: "solde_j30", name: "Rappel du solde (J-30)", family: "date_relative", anchor: "depart", offset_days: -30, template_name: "gf_rappel_solde", conditions: { solde_positif: true }, stop_conditions: STOP_PAYE },
  { code: "solde_j21", name: "Rappel du solde (J-21)", family: "date_relative", anchor: "depart", offset_days: -21, template_name: "gf_rappel_solde", conditions: { solde_positif: true }, stop_conditions: STOP_PAYE },
  { code: "solde_j15", name: "Rappel du solde (J-15)", family: "date_relative", anchor: "depart", offset_days: -15, template_name: "gf_rappel_solde", conditions: { solde_positif: true }, stop_conditions: STOP_PAYE },
  { code: "solde_j7", name: "Dernier rappel du solde (J-7)", family: "date_relative", anchor: "depart", offset_days: -7, template_name: "gf_rappel_solde", conditions: { solde_positif: true }, stop_conditions: STOP_PAYE },
  // --- Visa ---
  { code: "visa_non_demande_j40", name: "Visa non lancé (J-40)", family: "date_relative", anchor: "depart", offset_days: -40, template_name: "gf_documents_manquants", conditions: { visa: ["non_demande"] }, stop_conditions: ["reponse_client", "visa_accorde"] },
  // --- Pré-départ ---
  { code: "rappel_depart_j7", name: "Rappel avant le départ (J-7)", family: "date_relative", anchor: "depart", offset_days: -7, template_name: "gf_rappel_depart" },
  { code: "rappel_depart_j3", name: "Rappel avant le départ (J-3)", family: "date_relative", anchor: "depart", offset_days: -3, template_name: "gf_rappel_depart" },
  { code: "convocation_j1", name: "Convocation à l'aéroport (J-1)", family: "date_relative", anchor: "depart", offset_days: -1, template_name: "gf_convocation_aeroport", allowed_start: "09:00", allowed_end: "20:00" },
  // --- Voyage / retour ---
  { code: "changement_vol", name: "Changement de vol (manuel, urgent)", family: "manuel", template_name: "gf_changement_vol", urgent: true, description: "Lancé depuis l'admin pour tous les inscrits d'un voyage, avec le détail saisi au lancement." },
  { code: "reunion_pre_depart", name: "Réunion d'information (manuel)", family: "manuel", template_name: "gf_reunion_pre_depart", description: "Lancé pour un voyage avec la date et l'heure de la réunion." },
  { code: "bon_retour_j2", name: "Bon retour (J+2)", family: "date_relative", anchor: "retour", offset_days: 2, template_name: "gf_bon_retour" },
  { code: "satisfaction_j7", name: "Questionnaire de satisfaction (J+7)", family: "date_relative", anchor: "retour", offset_days: 7, template_name: "gf_avis_satisfaction" },
  // --- Prospects (inactivité) ---
  { code: "relance_prospect_24h", name: "Relance prospect sans réponse (24h)", family: "inactivite", inactivity_hours: 24, audience: "prospects", template_name: "gf_relance_prospect", conditions: { etapes: ["prospect", "qualifie"] }, max_per_target: 2 },
  // --- Internes (DC-10) ---
  { code: "prospect_chaud", name: "Prospect chaud (qualifié) → ventes", family: "interne", internal_action: "notifier_equipe", event_type: "prospect_qualifie", internal_team: "ventes" },
  { code: "rapport_quotidien", name: "Rapport quotidien (19h)", family: "interne", internal_action: "rapport_quotidien", internal_team: "direction" },
];
