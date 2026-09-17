-- =====================================================================
-- MIGRATION 011 — Groupes d'inscription (binôme / famille)
-- =====================================================================
-- Additive : une inscription reste TOUJOURS un voyageur = une ligne
-- registrations (documents, passeport, visa individuels inchangés). Un
-- groupe ne fait que LIER plusieurs inscriptions du même voyage, pour les
-- garder visibles ensemble et faciliter leur affectation chambre commune.
--
-- allow_mixed_gender_room : coché uniquement pour un couple/famille — c'est
-- la SEULE exception à la règle de non-mixité des chambres
-- (assignRegistrationToRoom, lib/roomAssignment.js), et elle ne s'applique
-- qu'entre membres du MÊME groupe (jamais une mixité générale de la
-- chambre). Un groupe "groupe" simple (amis, groupe non familial) reste
-- soumis à la règle stricte habituelle.
-- =====================================================================

SET NAMES utf8mb4;

CREATE TABLE registration_groups (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    trip_id BIGINT UNSIGNED NOT NULL,
    label VARCHAR(150) NOT NULL COMMENT 'ex. "Famille Alaoui", "M. et Mme Idrissi"',
    allow_mixed_gender_room BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (trip_id) REFERENCES trips(id),
    INDEX idx_reg_group_trip (trip_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE registrations
    ADD COLUMN group_id BIGINT UNSIGNED DEFAULT NULL AFTER preferred_room_type,
    ADD CONSTRAINT fk_registrations_group
        FOREIGN KEY (group_id) REFERENCES registration_groups(id);
