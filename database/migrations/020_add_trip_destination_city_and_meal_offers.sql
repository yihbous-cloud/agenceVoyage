-- Ville de destination (distincte du code aéroport précis destination_iata),
-- et offres de restauration par voyage (liste répétable, même pattern que
-- program_faqs) — voir CLAUDE.md.
ALTER TABLE trips
    ADD COLUMN destination_city VARCHAR(100) NULL COMMENT 'Ville de destination (liste Pays->Villes, lib/worldPlaces.js) — distincte du code aéroport précis (destination_iata)' AFTER destination_country;

CREATE TABLE trip_meal_offers (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    trip_id BIGINT UNSIGNED NOT NULL,
    agency_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
    title VARCHAR(150) NOT NULL,
    description TEXT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (trip_id) REFERENCES trips(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
