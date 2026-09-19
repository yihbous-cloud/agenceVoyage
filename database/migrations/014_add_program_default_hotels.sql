-- Hôtels par défaut d'un programme : fixés une fois à la création du
-- programme, auto-attachés (via trip_hotels) à chaque nouveau voyage créé
-- sous ce programme — voir CLAUDE.md.
CREATE TABLE program_hotels (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    program_id BIGINT UNSIGNED NOT NULL,
    hotel_id BIGINT UNSIGNED NOT NULL,
    FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE,
    FOREIGN KEY (hotel_id) REFERENCES hotels(id),
    UNIQUE KEY uq_program_hotel (program_id, hotel_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
