-- =====================================================================
-- MIGRATION 003 — Paramètres de l'agence (pour les reçus de paiement)
-- =====================================================================
-- Additive et non destructive : nouvelle table à une seule ligne (id=1),
-- remplie via /admin/parametres. Sert d'en-tête sur les reçus de paiement
-- imprimables (format A5) générés depuis une fiche inscription.
-- =====================================================================

SET NAMES utf8mb4;

CREATE TABLE agency_settings (
    id TINYINT UNSIGNED PRIMARY KEY DEFAULT 1,
    name VARCHAR(150) NOT NULL DEFAULT 'Golden Fantastic',
    address VARCHAR(255) NULL,
    city VARCHAR(100) NULL,
    phone VARCHAR(30) NULL,
    whatsapp VARCHAR(30) NULL,
    email VARCHAR(150) NULL,
    website VARCHAR(150) NULL,
    rc VARCHAR(50) NULL,
    tax_id VARCHAR(50) NULL,
    ice VARCHAR(50) NULL,
    footer_note VARCHAR(255) NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_agency_settings_single_row CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO agency_settings (id, name) VALUES (1, 'Golden Fantastic');
