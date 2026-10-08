-- =====================================================================
-- MIGRATION 039 — WhatsApp Lot 2 : templates Meta, déclencheurs, liens
-- wa.me / QR codes, paiement en ligne
-- =====================================================================
-- CLAUDE.md §3centdeuxquadragies. Toutes les tables portent agency_id.
-- =====================================================================

SET NAMES utf8mb4;

-- Templates : édition locale (brouillon) puis soumission à Meta (TP-01),
-- catégorie demandée vs appliquée par Meta (TP-02/03), correspondance des
-- variables {{n}} ↔ champs CRM (TP-05). Un même NOM = une famille, une ligne
-- par langue (fr, ar...) comme chez Meta (TP-04).
ALTER TABLE wa_templates
  ADD COLUMN category_requested VARCHAR(30) NULL AFTER category,
  ADD COLUMN rejection_reason VARCHAR(255) NULL AFTER status,
  ADD COLUMN variable_mapping JSON NULL AFTER components,
  ADD COLUMN description VARCHAR(255) NULL AFTER variable_mapping,
  ADD COLUMN origin ENUM('local', 'meta') NOT NULL DEFAULT 'meta' AFTER description,
  ADD COLUMN submitted_at DATETIME NULL AFTER synced_at,
  ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER submitted_at;

-- Déclencheurs (moteur unique, cahier §7.2).
CREATE TABLE wa_triggers (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    code VARCHAR(60) NULL,                  -- identifiant stable des déclencheurs livrés
    name VARCHAR(150) NOT NULL,
    description VARCHAR(500) NULL,
    family ENUM('evenement', 'date_relative', 'inactivite', 'interne', 'manuel') NOT NULL,
    event_type VARCHAR(40) NULL,            -- famille "evenement" (et interne "prospect_qualifie")
    anchor ENUM('depart', 'retour', 'inscription') NULL,  -- famille "date_relative"
    offset_days INT NULL,                   -- J-15 = -15, J+2 = 2
    inactivity_hours INT UNSIGNED NULL,     -- famille "inactivite"
    audience ENUM('inscrits', 'prospects', 'equipe') NOT NULL DEFAULT 'inscrits',
    conditions JSON NULL,                   -- filtres (statut, visa, solde, famille de programme...)
    delay_minutes INT UNSIGNED NOT NULL DEFAULT 0,
    template_name VARCHAR(200) NULL,        -- famille de templates (langue choisie par contact)
    free_text_when_open BOOLEAN NOT NULL DEFAULT TRUE,   -- DC-03 : texte libre gratuit si fenêtre 24h ouverte
    internal_action VARCHAR(40) NULL,       -- notifier_equipe, rapport_quotidien
    internal_team VARCHAR(50) NULL,
    allowed_start TIME NOT NULL DEFAULT '09:00:00',
    allowed_end TIME NOT NULL DEFAULT '21:00:00',
    skip_friday_prayer BOOLEAN NOT NULL DEFAULT TRUE,    -- pas d'envoi le vendredi 12h-14h (DC-06)
    urgent BOOLEAN NOT NULL DEFAULT FALSE,               -- ignore les plages d'envoi (changement de vol...)
    stop_conditions JSON NULL,              -- reponse_client, paiement_complet, document_recu, visa_accorde
    max_per_target INT UNSIGNED NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_wa_triggers_code (agency_id, code),
    KEY idx_wa_triggers_active (agency_id, is_active, family),
    CONSTRAINT fk_wa_triggers_agency FOREIGN KEY (agency_id) REFERENCES agencies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Exécutions (DC-08) : planifiées puis envoyées / annulées / ignorées.
-- dedupe_key empêche d'envoyer deux fois le même rappel à la même personne.
CREATE TABLE wa_trigger_runs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    trigger_id BIGINT UNSIGNED NOT NULL,
    registration_id BIGINT UNSIGNED NULL,
    contact_id BIGINT UNSIGNED NULL,
    dedupe_key VARCHAR(190) NOT NULL,
    status ENUM('planifie', 'envoye', 'annule', 'ignore', 'echec') NOT NULL DEFAULT 'planifie',
    scheduled_at DATETIME NOT NULL,
    executed_at DATETIME NULL,
    channel ENUM('template', 'texte', 'interne') NULL,
    message_id BIGINT UNSIGNED NULL,
    result VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_wa_trigger_runs_dedupe (agency_id, dedupe_key),
    KEY idx_wa_trigger_runs_due (status, scheduled_at),
    KEY idx_wa_trigger_runs_trigger (trigger_id, created_at),
    CONSTRAINT fk_wa_trigger_runs_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_wa_trigger_runs_trigger FOREIGN KEY (trigger_id) REFERENCES wa_triggers(id) ON DELETE CASCADE,
    CONSTRAINT fk_wa_trigger_runs_registration FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE,
    CONSTRAINT fk_wa_trigger_runs_contact FOREIGN KEY (contact_id) REFERENCES wa_contacts(id) ON DELETE CASCADE,
    CONSTRAINT fk_wa_trigger_runs_message FOREIGN KEY (message_id) REFERENCES wa_messages(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Liens wa.me avec code source et QR code (CP-07).
CREATE TABLE wa_links (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    code VARCHAR(40) NOT NULL,
    label VARCHAR(150) NOT NULL,
    prefilled_message VARCHAR(500) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by_staff_id BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_wa_links_code (agency_id, code),
    CONSTRAINT fk_wa_links_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_wa_links_staff FOREIGN KEY (created_by_staff_id) REFERENCES staff_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Passerelles de paiement par agence (secrets chiffrés, lib/secrets.js).
CREATE TABLE payment_gateways (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    provider ENUM('stripe', 'paypal', 'cmi', 'virement') NOT NULL,
    mode ENUM('test', 'live') NOT NULL DEFAULT 'test',
    public_config JSON NULL,
    secret_config_enc TEXT NULL,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_payment_gateways (agency_id, provider),
    CONSTRAINT fk_payment_gateways_agency FOREIGN KEY (agency_id) REFERENCES agencies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Liens de paiement envoyés aux clients. Le montant et la référence sont
-- fixés CÔTÉ SERVEUR à la création ; le paiement n'est enregistré dans le
-- CRM qu'à réception de la notification signée de la passerelle.
CREATE TABLE payment_links (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    provider VARCHAR(20) NOT NULL,
    mode ENUM('test', 'live') NOT NULL DEFAULT 'test',
    reference VARCHAR(40) NOT NULL,
    registration_id BIGINT UNSIGNED NULL,
    group_id BIGINT UNSIGNED NULL,
    conversation_id BIGINT UNSIGNED NULL,
    amount DECIMAL(12,2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'MAD',
    description VARCHAR(255) NULL,
    external_id VARCHAR(120) NULL,
    checkout_url VARCHAR(1000) NULL,
    status ENUM('cree', 'paye', 'expire', 'annule', 'echec') NOT NULL DEFAULT 'cree',
    payment_id BIGINT UNSIGNED NULL,
    created_by_staff_id BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    paid_at DATETIME NULL,
    last_event JSON NULL,
    UNIQUE KEY uq_payment_links_reference (reference),
    KEY idx_payment_links_external (provider, external_id),
    CONSTRAINT fk_payment_links_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_payment_links_registration FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE SET NULL,
    CONSTRAINT fk_payment_links_group FOREIGN KEY (group_id) REFERENCES registration_groups(id) ON DELETE SET NULL,
    CONSTRAINT fk_payment_links_conversation FOREIGN KEY (conversation_id) REFERENCES wa_conversations(id) ON DELETE SET NULL,
    CONSTRAINT fk_payment_links_payment FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL,
    CONSTRAINT fk_payment_links_staff FOREIGN KEY (created_by_staff_id) REFERENCES staff_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO permissions (code, label, category, sort_order) VALUES
    ('whatsapp.templates', 'Gérer les templates Meta (créer, soumettre, variables)', 'WhatsApp & IA', 80),
    ('whatsapp.triggers', 'Gérer les déclencheurs automatiques', 'WhatsApp & IA', 90),
    ('whatsapp.links', 'Créer des liens wa.me et QR codes', 'WhatsApp & IA', 100),
    ('paiements.liens', 'Créer et envoyer des liens de paiement en ligne', 'Paiements & finances', 50),
    ('paiements.passerelles', 'Configurer les passerelles de paiement en ligne', 'Paiements & finances', 60);

-- Liens de paiement : comptabilité et ventes (direction garantie au niveau code).
INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, 'paiements.liens' FROM roles r WHERE r.name IN ('comptabilite', 'ventes');
