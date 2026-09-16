-- =====================================================================
-- MIGRATION 004 — Généralise la distance "Haram" à un point de repère
-- =====================================================================
-- Les hôtels du catalogue ne sont pas tous à La Mecque : la colonne
-- distance_to_haram_m supposait à tort que la distance affichée était
-- toujours celle du Haram, ce qui n'a pas de sens pour un hôtel à
-- Médine, Istanbul, Paris... Remplacée par un couple générique
-- (nom du point de repère + distance), utilisable pour n'importe quelle
-- ville, y compris La Mecque (landmark_name = 'Haram').
-- =====================================================================

SET NAMES utf8mb4;

ALTER TABLE hotels
    CHANGE COLUMN distance_to_haram_m landmark_distance_m INT UNSIGNED NULL
        COMMENT 'distance en mètres jusqu''à landmark_name',
    ADD COLUMN landmark_name VARCHAR(100) NULL
        COMMENT 'point de repère de proximité (ex: Haram, Masjid Nabawi, Tour Eiffel)'
        AFTER city;

-- Rétro-remplissage des hôtels existants (tous liés à l'Omra/Hajj jusqu'ici) :
-- Haram par défaut, Masjid Nabawi pour les hôtels de Médine.
UPDATE hotels
SET landmark_name = CASE
    WHEN city LIKE '%édine%' OR city LIKE '%adinah%' OR city LIKE '%adina%' THEN 'Masjid Nabawi'
    ELSE 'Haram'
END
WHERE landmark_distance_m IS NOT NULL AND landmark_name IS NULL;
