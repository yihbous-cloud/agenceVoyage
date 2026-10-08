-- =====================================================================
-- MIGRATION 040 — WhatsApp Lot 3 : campagnes, coûts, pilotage, audit IA,
-- rétention des données (CNDP), double authentification, tâches système
-- =====================================================================
-- CLAUDE.md §3centtroisquadragies. Tables métier avec agency_id (sauf
-- system_jobs, état technique global du serveur).
-- =====================================================================

SET NAMES utf8mb4;

-- Segments réutilisables (CP-01) : filtres JSON évalués à la demande.
CREATE TABLE wa_segments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(150) NOT NULL,
    filters JSON NOT NULL,
    created_by_staff_id BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_wa_segments_agency (agency_id),
    CONSTRAINT fk_wa_segments_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_wa_segments_staff FOREIGN KEY (created_by_staff_id) REFERENCES staff_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Campagnes (CP-02→06). Circuit : brouillon → a_valider → validee →
-- en_cours → terminee (ou arretee / refusee). Les filtres sont recopiés à la
-- création pour que la campagne reste reproductible si le segment change.
CREATE TABLE wa_campaigns (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(150) NOT NULL,
    segment_id BIGINT UNSIGNED NULL,
    filters JSON NOT NULL,
    template_name VARCHAR(200) NOT NULL,          -- variante A (famille de templates, langue par contact)
    template_b_name VARCHAR(200) NULL,            -- variante B (test A/B)
    free_text VARCHAR(500) NULL,                  -- variable « texte saisi au moment de l'envoi »
    ab_test_percent TINYINT UNSIGNED NOT NULL DEFAULT 0,   -- 10 = 10 % des contacts reçoivent A ou B d'abord
    ab_wait_hours SMALLINT UNSIGNED NOT NULL DEFAULT 4,
    ab_metric ENUM('reponses', 'lus') NOT NULL DEFAULT 'reponses',
    ab_winner ENUM('A', 'B') NULL,
    scheduled_at DATETIME NULL,                   -- UTC ; NULL = dès la validation
    batch_size SMALLINT UNSIGNED NOT NULL DEFAULT 200,
    status ENUM('brouillon', 'a_valider', 'validee', 'en_cours', 'terminee', 'arretee', 'refusee') NOT NULL DEFAULT 'brouillon',
    estimated_recipients INT UNSIGNED NULL,
    estimated_cost DECIMAL(12,2) NULL,            -- MAD
    created_by_staff_id BIGINT UNSIGNED NULL,
    submitted_at DATETIME NULL,
    approved_by_staff_id BIGINT UNSIGNED NULL,
    approved_at DATETIME NULL,
    review_note VARCHAR(500) NULL,
    started_at DATETIME NULL,
    test_sent_at DATETIME NULL,
    finished_at DATETIME NULL,
    stopped_by_staff_id BIGINT UNSIGNED NULL,
    stopped_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_wa_campaigns_status (agency_id, status),
    CONSTRAINT fk_wa_campaigns_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_wa_campaigns_segment FOREIGN KEY (segment_id) REFERENCES wa_segments(id) ON DELETE SET NULL,
    CONSTRAINT fk_wa_campaigns_creator FOREIGN KEY (created_by_staff_id) REFERENCES staff_users(id) ON DELETE SET NULL,
    CONSTRAINT fk_wa_campaigns_approver FOREIGN KEY (approved_by_staff_id) REFERENCES staff_users(id) ON DELETE SET NULL,
    CONSTRAINT fk_wa_campaigns_stopper FOREIGN KEY (stopped_by_staff_id) REFERENCES staff_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Destinataires figés au lancement (un contact = une ligne, jamais deux envois).
CREATE TABLE wa_campaign_recipients (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    campaign_id BIGINT UNSIGNED NOT NULL,
    contact_id BIGINT UNSIGNED NOT NULL,
    variant ENUM('A', 'B') NOT NULL DEFAULT 'A',
    phase ENUM('test', 'principal') NOT NULL DEFAULT 'principal',
    status ENUM('en_attente', 'envoye', 'echec', 'ignore', 'annule') NOT NULL DEFAULT 'en_attente',
    message_id BIGINT UNSIGNED NULL,
    result VARCHAR(255) NULL,
    sent_at DATETIME NULL,
    UNIQUE KEY uq_wa_campaign_recipient (campaign_id, contact_id),
    KEY idx_wa_campaign_recipients_status (campaign_id, status, phase),
    KEY idx_wa_campaign_recipients_agency (agency_id),
    CONSTRAINT fk_wa_campaign_recipients_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_wa_campaign_recipients_campaign FOREIGN KEY (campaign_id) REFERENCES wa_campaigns(id) ON DELETE CASCADE,
    CONSTRAINT fk_wa_campaign_recipients_contact FOREIGN KEY (contact_id) REFERENCES wa_contacts(id) ON DELETE CASCADE,
    CONSTRAINT fk_wa_campaign_recipients_message FOREIGN KEY (message_id) REFERENCES wa_messages(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Coût Meta réel par message (renseigné quand Meta indique « billable » dans
-- le statut de livraison) et rattachement éventuel à une campagne.
ALTER TABLE wa_messages
  ADD COLUMN cost_mad DECIMAL(10,4) NULL AFTER billed_category,
  ADD COLUMN campaign_id BIGINT UNSIGNED NULL AFTER template_id,
  ADD KEY idx_wa_messages_campaign (campaign_id),
  ADD CONSTRAINT fk_wa_messages_campaign FOREIGN KEY (campaign_id) REFERENCES wa_campaigns(id) ON DELETE SET NULL;

-- Réglages d'exploitation par agence : tarifs Meta, rapport quotidien,
-- alertes, conservation des données (NF-13), plafond de coût.
CREATE TABLE wa_ops_settings (
    agency_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    price_marketing_mad DECIMAL(8,4) NOT NULL DEFAULT 1.0000,
    price_utility_mad DECIMAL(8,4) NOT NULL DEFAULT 0.2000,
    price_authentication_mad DECIMAL(8,4) NOT NULL DEFAULT 0.2000,
    usd_to_mad DECIMAL(8,4) NOT NULL DEFAULT 10.0000,
    report_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    report_hour TINYINT UNSIGNED NOT NULL DEFAULT 19,
    report_sections JSON NULL,                -- sections du rapport (paramétrable)
    report_emails VARCHAR(500) NULL,          -- destinataires e-mail (séparés par des virgules)
    alert_emails VARCHAR(500) NULL,           -- alertes techniques (panne webhook/file, sauvegarde)
    cost_alert_percent TINYINT UNSIGNED NOT NULL DEFAULT 80,
    retention_documents_days_after_trip SMALLINT UNSIGNED NOT NULL DEFAULT 30,
    retention_media_days SMALLINT UNSIGNED NOT NULL DEFAULT 180,
    retention_conversations_months SMALLINT UNSIGNED NOT NULL DEFAULT 24,
    retention_ia_logs_days SMALLINT UNSIGNED NOT NULL DEFAULT 90,
    purge_enabled BOOLEAN NOT NULL DEFAULT FALSE,   -- activée par la direction après validation des durées
    last_report_at DATETIME NULL,
    last_purge_at DATETIME NULL,
    last_purge_result VARCHAR(255) NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_wa_ops_settings_agency FOREIGN KEY (agency_id) REFERENCES agencies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Audit qualité hebdomadaire (NF-15, §8.16) : 20 conversations IA tirées
-- au hasard, notées sur une grille.
CREATE TABLE ia_audits (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    status ENUM('en_cours', 'termine') NOT NULL DEFAULT 'en_cours',
    created_by_staff_id BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME NULL,
    KEY idx_ia_audits_agency (agency_id, created_at),
    CONSTRAINT fk_ia_audits_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_ia_audits_staff FOREIGN KEY (created_by_staff_id) REFERENCES staff_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE ia_audit_items (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    audit_id BIGINT UNSIGNED NOT NULL,
    conversation_id BIGINT UNSIGNED NULL,
    accuracy TINYINT UNSIGNED NULL,           -- 1 à 5
    tone TINYINT UNSIGNED NULL,               -- 1 à 5
    transfer_ok BOOLEAN NULL,                 -- transfert pertinent (ou absence de transfert justifiée)
    invented_info BOOLEAN NULL,               -- information inventée détectée (tolérance zéro)
    comment VARCHAR(1000) NULL,
    reviewed_by_staff_id BIGINT UNSIGNED NULL,
    reviewed_at DATETIME NULL,
    UNIQUE KEY uq_ia_audit_item (audit_id, conversation_id),
    KEY idx_ia_audit_items_agency (agency_id),
    CONSTRAINT fk_ia_audit_items_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_ia_audit_items_audit FOREIGN KEY (audit_id) REFERENCES ia_audits(id) ON DELETE CASCADE,
    CONSTRAINT fk_ia_audit_items_conversation FOREIGN KEY (conversation_id) REFERENCES wa_conversations(id) ON DELETE SET NULL,
    CONSTRAINT fk_ia_audit_items_staff FOREIGN KEY (reviewed_by_staff_id) REFERENCES staff_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Connexion : double authentification (TOTP) et verrouillage après 5 échecs (NF-07).
ALTER TABLE staff_users
  ADD COLUMN totp_secret_enc TEXT NULL AFTER password_hash,
  ADD COLUMN totp_enabled_at DATETIME NULL AFTER totp_secret_enc,
  ADD COLUMN failed_login_count TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER totp_enabled_at,
  ADD COLUMN locked_until DATETIME NULL AFTER failed_login_count,
  ADD COLUMN last_login_at DATETIME NULL AFTER locked_until;

-- État des tâches planifiées du serveur (sauvegarde, purge, contrôle de
-- santé). Global : pas d'agency_id (une seule base, un seul serveur).
CREATE TABLE system_jobs (
    name VARCHAR(60) NOT NULL PRIMARY KEY,
    last_run_at DATETIME NULL,
    last_status ENUM('ok', 'erreur', 'en_cours') NULL,
    last_message VARCHAR(500) NULL,
    details JSON NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO permissions (code, label, category, sort_order) VALUES
    ('whatsapp.dashboard', 'Tableau de bord et statistiques WhatsApp', 'WhatsApp & IA', 110),
    ('whatsapp.costs', 'Voir les coûts Meta et Claude', 'WhatsApp & IA', 120),
    ('whatsapp.contacts', 'Contacts WhatsApp (liste, import, export)', 'WhatsApp & IA', 130),
    ('whatsapp.campaigns', 'Préparer des campagnes marketing', 'WhatsApp & IA', 140),
    ('whatsapp.campaigns.approve', 'Valider et lancer les campagnes', 'WhatsApp & IA', 150),
    ('whatsapp.data', 'Données personnelles : export, suppression, conservation', 'WhatsApp & IA', 160),
    ('audit.view', 'Journal d''audit, logs IA et audit qualité', 'WhatsApp & IA', 170);

-- Tableau de bord (périmètre limité à son équipe) et contacts : équipes en
-- contact avec les clients. Direction garantie au niveau code.
INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, 'whatsapp.dashboard' FROM roles r WHERE r.name IN ('ventes', 'comptabilite', 'suivi');
INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, 'whatsapp.contacts' FROM roles r WHERE r.name IN ('ventes', 'suivi');
