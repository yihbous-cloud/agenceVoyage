-- =====================================================================
-- MIGRATION 043 — Tarifs d'hébergement : un hôtel par VILLE, sans limite
-- =====================================================================
-- Un tarif (trip_hotel_tiers, migration 021) n'avait que deux hôtels figés :
-- makkah_hotel_id / madinah_hotel_id. Un programme passant par une 3e ville
-- (ex. Istanbul + Makka + Madina) ne pouvait pas y rattacher son hôtel.
-- Désormais : une ligne par (tarif, hôtel), autant de villes que nécessaire
-- (un seul hôtel par ville et par tarif, contrôlé par le code — hotels.city
-- reste du texte libre). Les deux anciennes colonnes sont conservées,
-- DÉPRÉCIÉES (plus écrites), et rendues nullables.
-- =====================================================================

SET NAMES utf8mb4;

CREATE TABLE trip_hotel_tier_hotels (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    tier_id BIGINT UNSIGNED NOT NULL,
    hotel_id BIGINT UNSIGNED NOT NULL,
    board_basis ENUM('logement_seul', 'petit_dejeuner', 'demi_pension') NOT NULL DEFAULT 'logement_seul'
      COMMENT 'Copie de hotels.board_basis à l''enregistrement (l''écran affiche celle du catalogue)',
    sort_order INT NOT NULL DEFAULT 0 COMMENT 'Ordre des villes dans le tarif',
    UNIQUE KEY uq_tier_hotel (tier_id, hotel_id),
    KEY idx_tier_hotels_tier (tier_id),
    CONSTRAINT fk_tier_hotels_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_tier_hotels_tier FOREIGN KEY (tier_id) REFERENCES trip_hotel_tiers(id) ON DELETE CASCADE,
    CONSTRAINT fk_tier_hotels_hotel FOREIGN KEY (hotel_id) REFERENCES hotels(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Reprise des tarifs existants : Mecque en premier, puis Médine.
INSERT INTO trip_hotel_tier_hotels (agency_id, tier_id, hotel_id, board_basis, sort_order)
SELECT agency_id, id, makkah_hotel_id, makkah_board_basis, 0
FROM trip_hotel_tiers WHERE makkah_hotel_id IS NOT NULL;

INSERT IGNORE INTO trip_hotel_tier_hotels (agency_id, tier_id, hotel_id, board_basis, sort_order)
SELECT agency_id, id, madinah_hotel_id, madinah_board_basis, 1
FROM trip_hotel_tiers WHERE madinah_hotel_id IS NOT NULL;

ALTER TABLE trip_hotel_tiers
  MODIFY makkah_hotel_id BIGINT UNSIGNED NULL COMMENT 'DÉPRÉCIÉE (migration 043) — voir trip_hotel_tier_hotels',
  MODIFY madinah_hotel_id BIGINT UNSIGNED NULL COMMENT 'DÉPRÉCIÉE (migration 043) — voir trip_hotel_tier_hotels';
