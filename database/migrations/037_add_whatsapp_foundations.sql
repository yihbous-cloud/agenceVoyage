-- =====================================================================
-- MIGRATION 037 — WhatsApp Cloud API : fondations (Lot 0)
-- =====================================================================
-- Cahier des charges « WhatsApp, Agent IA Claude et Espace admin » (CLAUDE.md
-- §3centquadragies). Un numéro WhatsApp PAR AGENCE : le webhook Meta (commun
-- à toutes les agences) retrouve l'agence par le phone_number_id du message.
-- Secrets (jeton système, app secret) chiffrés AES-256-GCM par lib/secrets.js
-- — jamais en clair en base.
-- Les anciennes tables whatsapp_qa_templates / whatsapp_reminders /
-- whatsapp_messages_log (jamais utilisées) sont dépréciées, conservées vides.
-- =====================================================================

SET NAMES utf8mb4;

-- Compte WhatsApp Business (un numéro) d'une agence.
CREATE TABLE wa_accounts (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    label VARCHAR(100) NOT NULL DEFAULT 'Numéro principal',
    waba_id VARCHAR(40) NULL,
    phone_number_id VARCHAR(40) NOT NULL,
    display_phone VARCHAR(30) NULL,
    access_token_enc TEXT NULL,
    app_secret_enc TEXT NULL,
    verify_token VARCHAR(100) NOT NULL,
    status ENUM('test', 'actif', 'inactif') NOT NULL DEFAULT 'test',
    quality_rating VARCHAR(20) NULL,
    messaging_tier VARCHAR(40) NULL,
    verified_name VARCHAR(150) NULL,
    last_webhook_at DATETIME NULL,
    last_check_at DATETIME NULL,
    last_check_result VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    -- Unicité GLOBALE (toutes agences) : c'est la clé de routage du webhook.
    UNIQUE KEY uq_wa_accounts_phone_number (phone_number_id),
    UNIQUE KEY uq_wa_accounts_agency (agency_id),
    CONSTRAINT fk_wa_accounts_agency FOREIGN KEY (agency_id) REFERENCES agencies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Contact WhatsApp (prospect ou client), rattaché au voyageur du CRM s'il existe.
CREATE TABLE wa_contacts (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    phone VARCHAR(20) NOT NULL,             -- wa_id Meta : indicatif + numéro, sans "+"
    profile_name VARCHAR(150) NULL,
    traveler_id BIGINT UNSIGNED NULL,
    language VARCHAR(20) NULL,              -- darija_latin, darija_arabe, ar, fr, en
    source VARCHAR(60) NULL,
    referral JSON NULL,                     -- clic sur une pub (click-to-WhatsApp)
    stage ENUM('prospect', 'qualifie', 'inscrit', 'en_voyage', 'ancien', 'perdu') NOT NULL DEFAULT 'prospect',
    advisor_staff_id BIGINT UNSIGNED NULL,
    qualification JSON NULL,
    marketing_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
    blocked BOOLEAN NOT NULL DEFAULT FALSE,
    last_inbound_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_wa_contacts_phone (agency_id, phone),
    KEY idx_wa_contacts_traveler (traveler_id),
    CONSTRAINT fk_wa_contacts_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_wa_contacts_traveler FOREIGN KEY (traveler_id) REFERENCES travelers(id) ON DELETE SET NULL,
    CONSTRAINT fk_wa_contacts_advisor FOREIGN KEY (advisor_staff_id) REFERENCES staff_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Fil de discussion. Un seul propriétaire à la fois (IA ou humain) ; une
-- conversation "resolu" n'est jamais rouverte : le message suivant en crée une.
CREATE TABLE wa_conversations (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    contact_id BIGINT UNSIGNED NOT NULL,
    status ENUM('ia', 'copilote', 'humain', 'attente', 'resolu') NOT NULL DEFAULT 'ia',
    team VARCHAR(40) NULL,
    assigned_staff_id BIGINT UNSIGNED NULL,
    transfer_reason VARCHAR(60) NULL,
    priority ENUM('basse', 'normale', 'haute', 'urgente') NOT NULL DEFAULT 'normale',
    last_inbound_at DATETIME NULL,          -- fenêtre de service client de 24h
    fep_until DATETIME NULL,                -- fenêtre gratuite 72h (pub click-to-WhatsApp)
    sla_due_at DATETIME NULL,
    opened_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_wa_conversations_contact (contact_id, status),
    KEY idx_wa_conversations_status (agency_id, status),
    KEY idx_wa_conversations_assigned (agency_id, assigned_staff_id),
    CONSTRAINT fk_wa_conversations_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_wa_conversations_contact FOREIGN KEY (contact_id) REFERENCES wa_contacts(id) ON DELETE CASCADE,
    CONSTRAINT fk_wa_conversations_staff FOREIGN KEY (assigned_staff_id) REFERENCES staff_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Chaque message (entrant ou sortant). meta_message_id unique = dédoublonnage
-- des webhooks que Meta renvoie plusieurs fois. processing_status : le
-- webhook n'enregistre que "recu" ; le worker fait passer à "traite".
CREATE TABLE wa_messages (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    conversation_id BIGINT UNSIGNED NOT NULL,
    meta_message_id VARCHAR(128) NULL,
    direction ENUM('entrant', 'sortant') NOT NULL,
    author ENUM('client', 'ia', 'humain', 'systeme') NOT NULL,
    author_staff_id BIGINT UNSIGNED NULL,
    type VARCHAR(30) NOT NULL,              -- text, audio, image, document, location, interactive, button, template...
    content TEXT NULL,
    payload JSON NULL,                      -- message Meta brut (entrant) ou corps envoyé (sortant)
    transcription TEXT NULL,
    reply_to_meta_id VARCHAR(128) NULL,
    status ENUM('recu', 'en_attente', 'envoye', 'livre', 'lu', 'echec') NOT NULL DEFAULT 'recu',
    error_code VARCHAR(20) NULL,
    error_message VARCHAR(255) NULL,
    billed_category VARCHAR(30) NULL,
    processing_status ENUM('recu', 'en_cours', 'traite', 'erreur', 'ignore') NOT NULL DEFAULT 'recu',
    processing_error VARCHAR(255) NULL,
    processed_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_wa_messages_meta_id (meta_message_id),
    KEY idx_wa_messages_conversation (conversation_id, id),
    KEY idx_wa_messages_processing (processing_status, created_at),
    KEY idx_wa_messages_created (agency_id, created_at),
    CONSTRAINT fk_wa_messages_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_wa_messages_conversation FOREIGN KEY (conversation_id) REFERENCES wa_conversations(id) ON DELETE CASCADE,
    CONSTRAINT fk_wa_messages_staff FOREIGN KEY (author_staff_id) REFERENCES staff_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Fichiers reçus/envoyés, stockés HORS du dossier public (storage/wa-media/).
CREATE TABLE wa_media (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    message_id BIGINT UNSIGNED NOT NULL,
    meta_media_id VARCHAR(128) NULL,
    kind VARCHAR(20) NOT NULL,              -- audio, image, document, video, sticker
    storage_path VARCHAR(500) NULL,
    mime_type VARCHAR(100) NULL,
    size_bytes INT UNSIGNED NULL,
    file_name VARCHAR(255) NULL,
    sha256 CHAR(64) NULL,
    doc_type ENUM('passeport', 'cin', 'photo', 'recu', 'autre') NULL,
    validated_by_staff_id BIGINT UNSIGNED NULL,
    validated_at DATETIME NULL,
    purge_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_wa_media_message (message_id),
    CONSTRAINT fk_wa_media_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_wa_media_message FOREIGN KEY (message_id) REFERENCES wa_messages(id) ON DELETE CASCADE,
    CONSTRAINT fk_wa_media_staff FOREIGN KEY (validated_by_staff_id) REFERENCES staff_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Historique du consentement marketing (accord / retrait), jamais modifié.
CREATE TABLE wa_consents (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    contact_id BIGINT UNSIGNED NOT NULL,
    action ENUM('accord', 'retrait') NOT NULL,
    source VARCHAR(60) NULL,
    text_shown TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_wa_consents_contact (contact_id),
    CONSTRAINT fk_wa_consents_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_wa_consents_contact FOREIGN KEY (contact_id) REFERENCES wa_contacts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Journal d'audit des actions sensibles (réglages, secrets, prompts...).
-- Les secrets n'y figurent jamais (masqués avant écriture).
CREATE TABLE audit_log (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    staff_id BIGINT UNSIGNED NULL,
    action VARCHAR(60) NOT NULL,
    object_type VARCHAR(60) NOT NULL,
    object_id VARCHAR(60) NULL,
    before_json JSON NULL,
    after_json JSON NULL,
    ip VARCHAR(45) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_audit_log_agency (agency_id, created_at),
    CONSTRAINT fk_audit_log_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_audit_log_staff FOREIGN KEY (staff_id) REFERENCES staff_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Conseiller attitré d'une inscription (transferts WhatsApp dirigés vers lui).
ALTER TABLE registrations ADD COLUMN advisor_staff_id BIGINT UNSIGNED NULL AFTER registered_by_staff_id,
  ADD CONSTRAINT fk_registrations_advisor FOREIGN KEY (advisor_staff_id) REFERENCES staff_users(id) ON DELETE SET NULL;

INSERT INTO permissions (code, label, category, sort_order) VALUES
    ('whatsapp.settings', 'Configurer le compte WhatsApp (identifiants Meta, webhook)', 'WhatsApp & IA', 10),
    ('whatsapp.conversations.all', 'Voir toutes les conversations WhatsApp', 'WhatsApp & IA', 20);
-- Par défaut : direction uniquement (déjà garantie au niveau code).
