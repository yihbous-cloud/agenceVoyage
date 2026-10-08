-- =====================================================================
-- MIGRATION 038 — WhatsApp Lot 1 : agent IA Claude, inbox, transfert humain
-- =====================================================================
-- CLAUDE.md §3centunquadragies. Toutes les tables portent agency_id (sans
-- DEFAULT, migration 033). Les "équipes" du cahier des charges sont les
-- RÔLES existants (ventes, comptabilite, suivi = dossiers, direction =
-- responsable, + rôles personnalisés guide / accompagnateur / marketing).
-- =====================================================================

SET NAMES utf8mb4;

-- Réglages de l'agent IA, VERSIONNÉS : chaque enregistrement crée une
-- nouvelle version ; une seule active par agence ; retour arrière = réactiver
-- une version précédente (exigence 8.8 / recette "modification annulable").
CREATE TABLE ia_settings (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    version INT UNSIGNED NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    mode ENUM('ia', 'copilote', 'off') NOT NULL DEFAULT 'copilote',
    system_prompt MEDIUMTEXT NOT NULL,
    model_conversation VARCHAR(60) NOT NULL DEFAULT 'claude-sonnet-5-5',
    model_summary VARCHAR(60) NOT NULL DEFAULT 'claude-haiku-5-5',
    effort ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'low',
    max_tokens INT UNSIGNED NOT NULL DEFAULT 8000,
    history_size INT UNSIGNED NOT NULL DEFAULT 20,
    tools_enabled JSON NULL,
    transfer_keywords JSON NULL,
    messages JSON NULL,
    monthly_cost_cap_usd DECIMAL(10,2) NULL,
    prices JSON NULL,
    note VARCHAR(255) NULL,
    created_by_staff_id BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_ia_settings_version (agency_id, version),
    CONSTRAINT fk_ia_settings_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_ia_settings_staff FOREIGN KEY (created_by_staff_id) REFERENCES staff_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Base de connaissances (hors prix et dates, qui viennent du CRM).
CREATE TABLE ia_knowledge (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    category VARCHAR(40) NOT NULL DEFAULT 'agence',
    question VARCHAR(500) NOT NULL,
    variants TEXT NULL,
    answer_fr TEXT NULL,
    answer_ar TEXT NULL,
    status ENUM('brouillon', 'publie') NOT NULL DEFAULT 'brouillon',
    author_staff_id BIGINT UNSIGNED NULL,
    verified_at DATE NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_ia_knowledge_status (agency_id, status),
    CONSTRAINT fk_ia_knowledge_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_ia_knowledge_author FOREIGN KEY (author_staff_id) REFERENCES staff_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Questions sans réponse (transferts, corrections des conseillers) → fiches.
CREATE TABLE ia_unanswered (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    conversation_id BIGINT UNSIGNED NULL,
    question TEXT NOT NULL,
    origin ENUM('transfert', 'correction', 'ia') NOT NULL DEFAULT 'transfert',
    correction TEXT NULL,
    handled BOOLEAN NOT NULL DEFAULT FALSE,
    knowledge_id BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_ia_unanswered_open (agency_id, handled),
    CONSTRAINT fk_ia_unanswered_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_ia_unanswered_conversation FOREIGN KEY (conversation_id) REFERENCES wa_conversations(id) ON DELETE SET NULL,
    CONSTRAINT fk_ia_unanswered_knowledge FOREIGN KEY (knowledge_id) REFERENCES ia_knowledge(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Journal de chaque exécution de l'agent (CL-08). Jamais de passeport/CIN
-- en clair : masqués avant écriture (lib/ai/redact.js).
CREATE TABLE ia_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    conversation_id BIGINT UNSIGNED NULL,
    context ENUM('conversation', 'resume', 'bac_a_sable', 'test') NOT NULL DEFAULT 'conversation',
    model VARCHAR(60) NOT NULL,
    settings_version INT UNSIGNED NULL,
    input_tokens INT UNSIGNED NOT NULL DEFAULT 0,
    output_tokens INT UNSIGNED NOT NULL DEFAULT 0,
    cache_read_tokens INT UNSIGNED NOT NULL DEFAULT 0,
    cache_write_tokens INT UNSIGNED NOT NULL DEFAULT 0,
    tool_rounds INT UNSIGNED NOT NULL DEFAULT 0,
    tools JSON NULL,
    duration_ms INT UNSIGNED NULL,
    cost_usd DECIMAL(10,6) NOT NULL DEFAULT 0,
    outcome VARCHAR(30) NOT NULL DEFAULT 'reponse',
    stop_reason VARCHAR(30) NULL,
    response TEXT NULL,
    error VARCHAR(500) NULL,
    evaluation ENUM('bonne', 'a_corriger') NULL,
    evaluation_note TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_ia_logs_agency (agency_id, created_at),
    KEY idx_ia_logs_conversation (conversation_id),
    CONSTRAINT fk_ia_logs_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_ia_logs_conversation FOREIGN KEY (conversation_id) REFERENCES wa_conversations(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Jeu de tests de l'agent (50 questions visées), rejouable après chaque
-- changement de prompt (NF-15).
CREATE TABLE ia_test_cases (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    question TEXT NOT NULL,
    profile ENUM('prospect', 'inscrit') NOT NULL DEFAULT 'prospect',
    traveler_id BIGINT UNSIGNED NULL,
    expectation TEXT NULL,
    expect_transfer BOOLEAN NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ia_test_cases_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_ia_test_cases_traveler FOREIGN KEY (traveler_id) REFERENCES travelers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE ia_test_runs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    run_key VARCHAR(40) NOT NULL,
    case_id BIGINT UNSIGNED NOT NULL,
    settings_version INT UNSIGNED NULL,
    response TEXT NULL,
    transferred BOOLEAN NOT NULL DEFAULT FALSE,
    tools JSON NULL,
    cost_usd DECIMAL(10,6) NOT NULL DEFAULT 0,
    error VARCHAR(500) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_ia_test_runs_run (agency_id, run_key),
    CONSTRAINT fk_ia_test_runs_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_ia_test_runs_case FOREIGN KEY (case_id) REFERENCES ia_test_cases(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Horaires d'ouverture (plusieurs plages par jour possibles ; aucun = fermé)
-- et exceptions datées (fériés, horaires de Ramadan).
CREATE TABLE business_hours (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    weekday TINYINT UNSIGNED NOT NULL,      -- 0 = dimanche ... 6 = samedi
    open_time TIME NOT NULL,
    close_time TIME NOT NULL,
    KEY idx_business_hours_agency (agency_id, weekday),
    CONSTRAINT fk_business_hours_agency FOREIGN KEY (agency_id) REFERENCES agencies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE business_hours_exceptions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    label VARCHAR(100) NOT NULL,
    closed BOOLEAN NOT NULL DEFAULT TRUE,
    open_time TIME NULL,
    close_time TIME NULL,
    CONSTRAINT fk_bh_exceptions_agency FOREIGN KEY (agency_id) REFERENCES agencies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Délais de prise en charge par motif de transfert (cahier §6.3).
CREATE TABLE sla_rules (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    reason VARCHAR(40) NOT NULL,
    label VARCHAR(100) NOT NULL,
    team VARCHAR(50) NOT NULL,
    minutes INT UNSIGNED NOT NULL,
    priority ENUM('basse', 'normale', 'haute', 'urgente') NOT NULL DEFAULT 'normale',
    around_the_clock BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE KEY uq_sla_rules_reason (agency_id, reason),
    CONSTRAINT fk_sla_rules_agency FOREIGN KEY (agency_id) REFERENCES agencies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Accompagnateur(s) de permanence par voyage (urgences en voyage, HU-11).
CREATE TABLE trip_escorts (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    trip_id BIGINT UNSIGNED NOT NULL,
    staff_id BIGINT UNSIGNED NOT NULL,
    UNIQUE KEY uq_trip_escorts (trip_id, staff_id),
    CONSTRAINT fk_trip_escorts_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_trip_escorts_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
    CONSTRAINT fk_trip_escorts_staff FOREIGN KEY (staff_id) REFERENCES staff_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tâches internes créées par l'agent ou le système (reçu à valider, rappel
-- téléphonique, document à vérifier).
CREATE TABLE staff_tasks (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    type ENUM('validation_paiement', 'rappel', 'document', 'autre') NOT NULL,
    status ENUM('ouverte', 'faite', 'annulee') NOT NULL DEFAULT 'ouverte',
    team VARCHAR(50) NULL,
    assigned_staff_id BIGINT UNSIGNED NULL,
    conversation_id BIGINT UNSIGNED NULL,
    contact_id BIGINT UNSIGNED NULL,
    registration_id BIGINT UNSIGNED NULL,
    media_id BIGINT UNSIGNED NULL,
    title VARCHAR(255) NOT NULL,
    details JSON NULL,
    due_at DATETIME NULL,
    done_by_staff_id BIGINT UNSIGNED NULL,
    done_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_staff_tasks_open (agency_id, status),
    CONSTRAINT fk_staff_tasks_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_staff_tasks_assigned FOREIGN KEY (assigned_staff_id) REFERENCES staff_users(id) ON DELETE SET NULL,
    CONSTRAINT fk_staff_tasks_done_by FOREIGN KEY (done_by_staff_id) REFERENCES staff_users(id) ON DELETE SET NULL,
    CONSTRAINT fk_staff_tasks_conversation FOREIGN KEY (conversation_id) REFERENCES wa_conversations(id) ON DELETE SET NULL,
    CONSTRAINT fk_staff_tasks_contact FOREIGN KEY (contact_id) REFERENCES wa_contacts(id) ON DELETE SET NULL,
    CONSTRAINT fk_staff_tasks_registration FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE SET NULL,
    CONSTRAINT fk_staff_tasks_media FOREIGN KEY (media_id) REFERENCES wa_media(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Notifications internes (transfert, SLA dépassé, urgence) : pour un
-- conseiller précis (staff_id) ou pour toute une équipe (team = nom de rôle).
CREATE TABLE staff_notifications (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    staff_id BIGINT UNSIGNED NULL,
    team VARCHAR(50) NULL,
    kind VARCHAR(40) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NULL,
    conversation_id BIGINT UNSIGNED NULL,
    task_id BIGINT UNSIGNED NULL,
    read_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_staff_notifications_open (agency_id, read_at),
    CONSTRAINT fk_staff_notifications_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_staff_notifications_staff FOREIGN KEY (staff_id) REFERENCES staff_users(id) ON DELETE CASCADE,
    CONSTRAINT fk_staff_notifications_conversation FOREIGN KEY (conversation_id) REFERENCES wa_conversations(id) ON DELETE CASCADE,
    CONSTRAINT fk_staff_notifications_task FOREIGN KEY (task_id) REFERENCES staff_tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Réponses rapides partagées (HU-07).
CREATE TABLE wa_quick_replies (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    shortcut VARCHAR(40) NOT NULL,
    text_fr TEXT NULL,
    text_ar TEXT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    UNIQUE KEY uq_wa_quick_replies (agency_id, shortcut),
    CONSTRAINT fk_wa_quick_replies_agency FOREIGN KEY (agency_id) REFERENCES agencies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Templates Meta : au Lot 1, simple copie synchronisée depuis Meta (envoi
-- depuis l'inbox quand la fenêtre de 24h est fermée, HU-08). Création,
-- soumission et correspondance des variables : Lot 2.
CREATE TABLE wa_templates (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    meta_template_id VARCHAR(60) NULL,
    name VARCHAR(200) NOT NULL,
    language VARCHAR(20) NOT NULL,
    category VARCHAR(30) NULL,
    status VARCHAR(30) NULL,
    components JSON NULL,
    synced_at DATETIME NULL,
    UNIQUE KEY uq_wa_templates (agency_id, name, language),
    CONSTRAINT fk_wa_templates_agency FOREIGN KEY (agency_id) REFERENCES agencies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE wa_messages
  ADD COLUMN is_private_note BOOLEAN NOT NULL DEFAULT FALSE AFTER author_staff_id,
  ADD COLUMN draft_status ENUM('brouillon', 'envoye', 'rejete') NULL AFTER is_private_note,
  ADD COLUMN ia_log_id BIGINT UNSIGNED NULL AFTER draft_status,
  ADD COLUMN template_id BIGINT UNSIGNED NULL AFTER ia_log_id,
  ADD CONSTRAINT fk_wa_messages_ia_log FOREIGN KEY (ia_log_id) REFERENCES ia_logs(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_wa_messages_template FOREIGN KEY (template_id) REFERENCES wa_templates(id) ON DELETE SET NULL;

ALTER TABLE wa_conversations
  ADD COLUMN ai_last_handled_message_id BIGINT UNSIGNED NULL AFTER sla_due_at,
  ADD COLUMN ai_lock_until DATETIME NULL AFTER ai_last_handled_message_id,
  ADD COLUMN ooh_notice_sent_at DATETIME NULL AFTER ai_lock_until,
  ADD COLUMN transferred_at DATETIME NULL AFTER ooh_notice_sent_at,
  ADD COLUMN sla_alert_level TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER transferred_at,
  ADD COLUMN first_human_reply_at DATETIME NULL AFTER sla_alert_level,
  ADD COLUMN summary TEXT NULL AFTER first_human_reply_at,
  ADD COLUMN welcomed BOOLEAN NOT NULL DEFAULT FALSE AFTER summary;

-- Permissions (catégorie "WhatsApp & IA", créée en 037).
INSERT INTO permissions (code, label, category, sort_order) VALUES
    ('whatsapp.conversations.own', 'Traiter les conversations WhatsApp de son équipe et les siennes', 'WhatsApp & IA', 15),
    ('whatsapp.team', 'Gérer horaires, délais (SLA), accompagnateurs et réponses rapides', 'WhatsApp & IA', 30),
    ('whatsapp.tasks', 'Voir et traiter les tâches WhatsApp (reçus, rappels, documents)', 'WhatsApp & IA', 40),
    ('ia.knowledge', 'Gérer la base de connaissances de l''agent IA', 'WhatsApp & IA', 50),
    ('ia.sandbox', 'Utiliser le bac à sable et le jeu de tests de l''agent IA', 'WhatsApp & IA', 60),
    ('ia.settings', 'Modifier les réglages de l''agent IA (prompt, modèles, mode)', 'WhatsApp & IA', 70);

INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, p.code FROM roles r
JOIN (SELECT 'whatsapp.conversations.own' AS code UNION ALL SELECT 'whatsapp.tasks') p
WHERE r.name IN ('ventes', 'comptabilite', 'suivi');

-- Données initiales par agence (modifiables dans l'admin).
-- SLA : valeurs par défaut du cahier des charges §6.3.
INSERT INTO sla_rules (agency_id, reason, label, team, minutes, priority, around_the_clock)
SELECT a.id, s.reason, s.label, s.team, s.minutes, s.priority, s.atc FROM agencies a
JOIN (
  SELECT 'urgence' reason, 'Urgence en voyage' label, 'accompagnateur' team, 5 minutes, 'urgente' priority, TRUE atc
  UNION ALL SELECT 'reclamation', 'Réclamation', 'direction', 15, 'haute', FALSE
  UNION ALL SELECT 'intention_achat', 'Intention d''achat', 'ventes', 15, 'haute', FALSE
  UNION ALL SELECT 'demande_humain', 'Demande explicite d''un conseiller', 'ventes', 15, 'normale', FALSE
  UNION ALL SELECT 'negociation', 'Négociation / groupe (5 personnes et +)', 'ventes', 30, 'normale', FALSE
  UNION ALL SELECT 'recu_paiement', 'Reçu de paiement', 'comptabilite', 120, 'normale', FALSE
  UNION ALL SELECT 'cas_particulier', 'Cas particulier (âge, santé, mineur)', 'suivi', 240, 'normale', FALSE
  UNION ALL SELECT 'question_religieuse', 'Question religieuse', 'guide', 1440, 'basse', FALSE
  UNION ALL SELECT 'echec_ia', 'L''agent IA n''a pas pu répondre', 'ventes', 15, 'normale', FALSE
  UNION ALL SELECT 'vocal_non_transcrit', 'Message vocal non transcrit', 'ventes', 15, 'normale', FALSE
) s;

-- Horaires par défaut (à confirmer par l'agence) : lun-ven 9h-18h, sam 9h-13h.
INSERT INTO business_hours (agency_id, weekday, open_time, close_time)
SELECT a.id, d.wd, d.o, d.c FROM agencies a
JOIN (
  SELECT 1 wd, '09:00:00' o, '18:00:00' c UNION ALL SELECT 2, '09:00:00', '18:00:00'
  UNION ALL SELECT 3, '09:00:00', '18:00:00' UNION ALL SELECT 4, '09:00:00', '18:00:00'
  UNION ALL SELECT 5, '09:00:00', '18:00:00' UNION ALL SELECT 6, '09:00:00', '13:00:00'
) d;
