-- =====================================================================
-- 046 — Référencement global, phase 1 vague 1C (CLAUDE.md §3centseizequadragies)
--   * L8 : source des demandes (inscriptions en ligne, messages de contact)
--          + identifiant Google Tag Manager de l'agence (vide = aucune mesure)
--   * L12 : informations légales et CGV de l'agence (pages légales générées)
--   * lien WhatsApp « SITE » : code source des boutons WhatsApp du site
-- =====================================================================

-- --- Source des demandes ----------------------------------------------
-- lead_source : canal classé côté serveur (lib/leadSource.js) —
--   assistant_ia, moteur_recherche, reseau_social, publicite, site_referent,
--   campagne, direct, admin. NULL = demande antérieure au suivi.
-- lead_source_details : première visite mémorisée par le navigateur
--   (utm_*, gclid/fbclid, référent, page d'arrivée, date), bornée.
ALTER TABLE registrations
    ADD COLUMN lead_source VARCHAR(30) NULL AFTER notes,
    ADD COLUMN lead_source_details JSON NULL AFTER lead_source,
    ADD INDEX idx_registrations_lead_source (agency_id, lead_source);

ALTER TABLE contact_messages
    ADD COLUMN lead_source VARCHAR(30) NULL AFTER status,
    ADD COLUMN lead_source_details JSON NULL AFTER lead_source,
    ADD INDEX idx_contact_lead_source (agency_id, lead_source);

-- --- Informations légales, CGV et mesure d'audience ---------------------
ALTER TABLE agencies
    ADD COLUMN legal_name VARCHAR(200) NULL COMMENT 'raison sociale' AFTER footer_note,
    ADD COLUMN legal_form VARCHAR(100) NULL COMMENT 'forme juridique (SARL, SARL AU...)' AFTER legal_name,
    ADD COLUMN share_capital VARCHAR(100) NULL COMMENT 'capital social, texte libre (ex. 100 000 MAD)' AFTER legal_form,
    ADD COLUMN publication_director VARCHAR(150) NULL AFTER share_capital,
    ADD COLUMN license_number VARCHAR(100) NULL COMMENT 'licence d agence de voyages (loi 31-96)' AFTER publication_director,
    ADD COLUMN founding_date DATE NULL AFTER license_number,
    ADD COLUMN insurance_info VARCHAR(500) NULL COMMENT 'assurance responsabilité civile professionnelle' AFTER founding_date,
    ADD COLUMN cndp_number VARCHAR(100) NULL COMMENT 'déclaration / autorisation CNDP (loi 09-08)' AFTER insurance_info,
    ADD COLUMN hosting_provider VARCHAR(255) NULL COMMENT 'hébergeur du site (nom et adresse)' AFTER cndp_number,
    ADD COLUMN cgv_fr MEDIUMTEXT NULL COMMENT 'conditions générales de vente, Markdown' AFTER hosting_provider,
    ADD COLUMN cgv_ar MEDIUMTEXT NULL AFTER cgv_fr,
    ADD COLUMN gtm_container_id VARCHAR(20) NULL COMMENT 'GTM-XXXX — vide : aucune mesure, aucun bandeau' AFTER cgv_ar;

-- --- Lien WhatsApp du site ------------------------------------------------
-- Les boutons WhatsApp du site public pré-remplissent un message terminé
-- par [SITE] : à son premier message, le contact reçoit la source
-- « lien:SITE » (lib/whatsapp/links.js, sourceFromMessage), qui n'est
-- reconnue que si ce lien existe et est actif.
INSERT IGNORE INTO wa_links (agency_id, code, label, prefilled_message)
SELECT id, 'SITE', 'Site web (boutons WhatsApp)', 'Bonjour, je vous contacte depuis votre site.'
FROM agencies;
