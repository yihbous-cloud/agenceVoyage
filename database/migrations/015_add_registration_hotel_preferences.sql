-- Un voyageur Omra passe par plusieurs villes (Mecque + Médine) : une seule
-- préférence hôtel par inscription (registrations.preferred_hotel_id) ne
-- suffisait pas — une préférence distincte par ville est nécessaire. Cette
-- table remplace l'usage de preferred_hotel_id (colonne conservée en base
-- pour ne pas casser l'historique, mais plus alimentée — voir CLAUDE.md).
CREATE TABLE registration_hotel_preferences (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    registration_id BIGINT UNSIGNED NOT NULL,
    city VARCHAR(100) NOT NULL,
    hotel_id BIGINT UNSIGNED NOT NULL,
    FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE,
    FOREIGN KEY (hotel_id) REFERENCES hotels(id),
    UNIQUE KEY uq_registration_city (registration_id, city)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
