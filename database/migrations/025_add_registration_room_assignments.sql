-- Un voyage Omra/Hajj multi-villes (Mecque + Médine, parfois une escale-
-- séjour à Istanbul) a besoin d'une chambre PAR VILLE pour chaque inscrit —
-- registrations.room_id (colonne scalaire unique) ne pouvait porter qu'une
-- seule chambre pour tout le voyage, ce qui empêchait la répartition
-- automatique de jamais affecter une deuxième ville (voir CLAUDE.md). Cette
-- table remplace l'usage de room_id (colonne conservée en base pour ne pas
-- casser l'historique, mais plus alimentée — même pattern que
-- registration_hotel_preferences/preferred_hotel_id).
-- agency_id DEFAULT 1 dès la création (pas un ALTER a posteriori) : cette
-- table naît après la fondation multi-agences (migration 016), elle suit
-- directement la même convention que les 27 tables métier existantes —
-- voir CLAUDE.md.
CREATE TABLE registration_room_assignments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    registration_id BIGINT UNSIGNED NOT NULL,
    city VARCHAR(100) NOT NULL,
    room_id BIGINT UNSIGNED NOT NULL,
    agency_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
    FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES rooms(id),
    UNIQUE KEY uq_registration_city (registration_id, city)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Backfill : dérive la ville de chaque affectation existante via la chambre
-- (rooms -> trip_hotels -> hotels.city), pour ne perdre aucune affectation
-- déjà faite.
INSERT INTO registration_room_assignments (registration_id, city, room_id)
SELECT r.id, h.city, r.room_id
FROM registrations r
JOIN rooms rm ON rm.id = r.room_id
JOIN trip_hotels th ON th.id = rm.trip_hotel_id
JOIN hotels h ON h.id = th.hotel_id
WHERE r.room_id IS NOT NULL;
