-- =====================================================================
-- MIGRATION 013 — Service visa autonome (hors voyage)
-- =====================================================================
-- Le visa n'est plus facturé séparément sur une inscription liée à un
-- voyage (déjà inclus dans le prix global du programme, voir CLAUDE.md) :
-- registration_services et visa_requests ne sont plus utilisés pour les
-- inscriptions de voyage (leurs anciennes lignes, toutes liées à un
-- voyage, sont vidées par le script d'application de cette migration).
--
-- À la place, un client peut s'inscrire uniquement au service visa,
-- indépendamment de tout voyage réservé chez l'agence — ex. quelqu'un qui
-- a besoin d'une aide pour son visa Omra/touristique sans passer par un
-- de nos programmes. Table dédiée (pas de réutilisation de
-- registrations/visa_requests, qui restent structurellement liées à un
-- voyage), avec son propre suivi financier (montant dû, versements) : un
-- paiement cible désormais soit une inscription (registration_id), soit
-- un groupe (group_id), soit une demande de visa autonome
-- (visa_service_id) — jamais deux à la fois.
-- =====================================================================

SET NAMES utf8mb4;

CREATE TABLE visa_service_requests (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    traveler_id BIGINT UNSIGNED NOT NULL,
    visa_type_id BIGINT UNSIGNED NOT NULL COMMENT 'détermine la destination, le prix et les documents requis',
    status ENUM('non_demande', 'en_cours', 'accorde', 'refuse') NOT NULL DEFAULT 'non_demande',
    total_due DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    submitted_date DATE NULL,
    consulate_or_authority VARCHAR(150) NULL,
    visa_number VARCHAR(50) NULL,
    issue_date DATE NULL,
    expiry_date DATE NULL,
    notes VARCHAR(255) NULL,
    registered_by_staff_id BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (traveler_id) REFERENCES travelers(id),
    FOREIGN KEY (visa_type_id) REFERENCES visa_types(id),
    FOREIGN KEY (registered_by_staff_id) REFERENCES staff_users(id),
    INDEX idx_visa_service_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE visa_service_documents (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    visa_service_request_id BIGINT UNSIGNED NOT NULL,
    visa_type_document_id BIGINT UNSIGNED NOT NULL,
    status ENUM('manquant', 'fourni') NOT NULL DEFAULT 'manquant',
    provided_at DATETIME NULL,
    FOREIGN KEY (visa_service_request_id) REFERENCES visa_service_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (visa_type_document_id) REFERENCES visa_type_documents(id) ON DELETE CASCADE,
    UNIQUE KEY uq_service_document (visa_service_request_id, visa_type_document_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE payments
    DROP CHECK chk_payment_target,
    ADD COLUMN visa_service_id BIGINT UNSIGNED NULL AFTER group_id,
    ADD CONSTRAINT fk_payments_visa_service FOREIGN KEY (visa_service_id) REFERENCES visa_service_requests(id),
    ADD CONSTRAINT chk_payment_target CHECK (
        (registration_id IS NOT NULL AND group_id IS NULL AND visa_service_id IS NULL) OR
        (registration_id IS NULL AND group_id IS NOT NULL AND visa_service_id IS NULL) OR
        (registration_id IS NULL AND group_id IS NULL AND visa_service_id IS NOT NULL)
    );

-- Vide les anciennes lignes visa/service liées à un voyage — désormais
-- incluses dans le prix global du programme, plus facturées à part.
DELETE FROM visa_request_documents;
DELETE FROM visa_requests;
DELETE FROM registration_services;

-- Permissions : inscriptions.visa/visa_documents.manage/inscriptions.services
-- pilotaient l'ancien visa/service par inscription, retiré de l'admin —
-- remplacées par une permission dédiée au nouveau service visa autonome.
DELETE FROM permissions WHERE code IN ('inscriptions.visa', 'visa_documents.manage', 'inscriptions.services');

INSERT INTO permissions (code, label, category, sort_order) VALUES
('visa_services.manage', 'Gérer les demandes de visa autonomes (hors voyage)', 'Visa autonome', 10);

INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, 'visa_services.manage' FROM roles r WHERE r.name IN ('direction', 'suivi', 'ventes', 'comptabilite');
