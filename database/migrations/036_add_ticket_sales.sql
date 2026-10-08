-- =====================================================================
-- MIGRATION 036 — Service de vente de billets d'avion (hors programme)
-- =====================================================================
-- Un client peut acheter un billet d'avion seul, sans voyage organisé —
-- même logique que le service visa autonome (migration 013) : un client
-- (réutilisé par numéro WhatsApp), une vente avec son trajet, son prix
-- d'achat (coût) et son prix de vente (montant dû), un suivi des
-- versements (payments.ticket_sale_id, 4ᵉ cible possible d'un paiement)
-- et un reçu. Saisie manuelle (PNR / n° de billet émis par la compagnie
-- ou le système de réservation) — n'achète rien automatiquement.
-- =====================================================================

SET NAMES utf8mb4;

CREATE TABLE ticket_sales (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    traveler_id BIGINT UNSIGNED NOT NULL,
    airline_id SMALLINT UNSIGNED NULL,
    trip_type ENUM('aller_simple', 'aller_retour') NOT NULL DEFAULT 'aller_retour',
    origin_iata CHAR(3) NULL,
    destination_iata CHAR(3) NULL,
    departure_date DATE NULL,
    return_date DATE NULL,
    passengers_count SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    passenger_names VARCHAR(500) NULL,
    travel_class ENUM('economique', 'premium', 'affaires', 'premiere') NOT NULL DEFAULT 'economique',
    pnr VARCHAR(10) NULL,
    ticket_numbers VARCHAR(255) NULL,
    purchase_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_due DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    status ENUM('devis', 'reserve', 'emis', 'annule') NOT NULL DEFAULT 'reserve',
    notes TEXT NULL,
    registered_by_staff_id BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_ticket_sales_agency (agency_id, created_at),
    CONSTRAINT fk_ticket_sales_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_ticket_sales_traveler FOREIGN KEY (traveler_id) REFERENCES travelers(id),
    CONSTRAINT fk_ticket_sales_airline FOREIGN KEY (airline_id) REFERENCES airlines(id) ON DELETE SET NULL,
    CONSTRAINT fk_ticket_sales_staff FOREIGN KEY (registered_by_staff_id) REFERENCES staff_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4ᵉ cible possible d'un paiement : exactement une des quatre, jamais deux.
ALTER TABLE payments
    ADD COLUMN ticket_sale_id BIGINT UNSIGNED NULL AFTER visa_service_id,
    ADD CONSTRAINT fk_payments_ticket_sale FOREIGN KEY (ticket_sale_id) REFERENCES ticket_sales(id);

ALTER TABLE payments DROP CHECK chk_payment_target;
ALTER TABLE payments ADD CONSTRAINT chk_payment_target CHECK (
    (registration_id IS NOT NULL) + (group_id IS NOT NULL) + (visa_service_id IS NOT NULL) + (ticket_sale_id IS NOT NULL) = 1
);

INSERT INTO permissions (code, label, category, sort_order) VALUES
    ('ticket_sales.manage', 'Gérer les ventes de billets d''avion (hors programme)', 'Billets d''avion', 10);

INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, 'ticket_sales.manage' FROM roles r
WHERE r.name IN ('direction', 'ventes', 'comptabilite');
