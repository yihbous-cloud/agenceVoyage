-- Carte "Informations Voyageurs" : un N° de téléphone général (distinct du
-- WhatsApp, canal principal existant) + une liste de numéros supplémentaires
-- répétable (ex. contact d'urgence) — voir CLAUDE.md.
ALTER TABLE travelers ADD COLUMN phone VARCHAR(30) NULL COMMENT 'N° téléphone général, distinct du WhatsApp' AFTER phone_whatsapp;

CREATE TABLE traveler_phone_numbers (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    traveler_id BIGINT UNSIGNED NOT NULL,
    phone_number VARCHAR(30) NOT NULL,
    agency_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
    FOREIGN KEY (traveler_id) REFERENCES travelers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
