-- Tarifs par palier d'hébergement (tiers), pour les voyages Omra/Hajj
-- uniquement (programs.family = 'omra_hajj'). Un tier associe un hôtel
-- Mecque + un hôtel Médine précis (FK libres vers hotels, sans contrainte de
-- ville — city reste du texte libre) et une formule de restauration par
-- ville, puis un prix par personne + une limite de places (NULL = illimité)
-- par type de chambre. Un voyage sans tier configuré continue de
-- fonctionner exactement comme avant (price_double/triple/quadruple/
-- quintuple sur trips) — les tiers sont additifs, jamais un remplacement.
-- Voir CLAUDE.md.
CREATE TABLE trip_hotel_tiers (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    trip_id BIGINT UNSIGNED NOT NULL,
    agency_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
    label VARCHAR(100) NOT NULL COMMENT 'ex: Économique, Standard, VIP',
    makkah_hotel_id BIGINT UNSIGNED NOT NULL,
    makkah_board_basis ENUM('logement_seul', 'petit_dejeuner', 'demi_pension') NOT NULL DEFAULT 'logement_seul',
    madinah_hotel_id BIGINT UNSIGNED NOT NULL,
    madinah_board_basis ENUM('logement_seul', 'petit_dejeuner', 'demi_pension') NOT NULL DEFAULT 'logement_seul',
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
    FOREIGN KEY (makkah_hotel_id) REFERENCES hotels(id),
    FOREIGN KEY (madinah_hotel_id) REFERENCES hotels(id),
    INDEX idx_tier_trip (trip_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE trip_hotel_tier_prices (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tier_id BIGINT UNSIGNED NOT NULL,
    agency_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
    room_type ENUM('simple', 'double', 'triple', 'quadruple', 'quintuple') NOT NULL,
    price_per_person DECIMAL(10,2) NOT NULL,
    seats_limit INT UNSIGNED NULL COMMENT 'NULL = illimité',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tier_id) REFERENCES trip_hotel_tiers(id) ON DELETE CASCADE,
    UNIQUE KEY uq_tier_room_type (tier_id, room_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tarif choisi par le personnel à l'inscription (NULL = comportement
-- inchangé, prix plat du voyage). Pas de ON DELETE CASCADE : un tier
-- référencé par au moins une inscription ne doit pas pouvoir être supprimé
-- (la FK rejette la suppression, voir lib/tripHotelTiers.js::deleteTier).
ALTER TABLE registrations
    ADD COLUMN selected_tier_id BIGINT UNSIGNED NULL COMMENT 'Tarif d''hébergement choisi (trip_hotel_tiers), NULL = prix plat du voyage (migration 021)' AFTER preferred_room_type,
    ADD CONSTRAINT fk_registrations_selected_tier FOREIGN KEY (selected_tier_id) REFERENCES trip_hotel_tiers(id);
