-- =====================================================================
-- MIGRATION 035 — Charges financières d'un programme (coûts de l'agence)
-- =====================================================================
-- Coûts supportés par l'agence pour un voyage (réservations d'hôtels,
-- billets d'avion, équipe/guide, accessoires/cadeaux, autres), chacun
-- payable en une ou PLUSIEURS échéances datées (ex. compagnie aérienne
-- payée en 3 fois). Rattachées au voyage (comme Aéroport/Hôtels/Tarifs de
-- la fiche programme, qui portent sur le voyage principal).
-- Permissions : charges.view (consulter la carte) / charges.manage
-- (ajouter, modifier, marquer une échéance payée) — matrice des rôles.
-- =====================================================================

SET NAMES utf8mb4;

CREATE TABLE trip_expenses (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    trip_id BIGINT UNSIGNED NOT NULL,
    category ENUM('hotel', 'billets', 'equipe', 'accessoires', 'autre') NOT NULL,
    label VARCHAR(150) NOT NULL,
    supplier VARCHAR(150) NULL,
    hotel_id BIGINT UNSIGNED NULL,
    airline_id SMALLINT UNSIGNED NULL,
    amount DECIMAL(12,2) NOT NULL,
    notes TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_trip_expenses_trip (trip_id),
    CONSTRAINT fk_trip_expenses_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_trip_expenses_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
    CONSTRAINT fk_trip_expenses_hotel FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE SET NULL,
    CONSTRAINT fk_trip_expenses_airline FOREIGN KEY (airline_id) REFERENCES airlines(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Échéancier : une ligne par date de paiement prévue. paid_date NULL = à payer.
CREATE TABLE trip_expense_installments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    expense_id BIGINT UNSIGNED NOT NULL,
    due_date DATE NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    paid_date DATE NULL,
    payment_method VARCHAR(30) NULL,
    reference VARCHAR(100) NULL,
    KEY idx_expense_installments_expense (expense_id),
    KEY idx_expense_installments_due (agency_id, due_date),
    CONSTRAINT fk_expense_installments_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_expense_installments_expense FOREIGN KEY (expense_id) REFERENCES trip_expenses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO permissions (code, label, category, sort_order) VALUES
    ('charges.view', 'Consulter les charges financières des programmes', 'Paiements & finances', 30),
    ('charges.manage', 'Gérer les charges financières des programmes (coûts, échéances)', 'Paiements & finances', 40);

-- Direction (déjà garantie au niveau code) et comptabilité, dans chaque agence.
INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, p.code FROM roles r
JOIN (SELECT 'charges.view' AS code UNION ALL SELECT 'charges.manage') p
WHERE r.name IN ('direction', 'comptabilite');
