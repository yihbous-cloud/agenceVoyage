-- =====================================================================
-- MIGRATION 001 — Séparation du catalogue en deux familles
-- (Omra & Hajj / Voyages organisés)
-- =====================================================================
-- Additive et non destructive : ne modifie ni ne supprime aucune colonne
-- existante, aucune table liée aux inscriptions/paiements/visas/hôtels/
-- billets n'est touchée.
--
-- Décision sur `program_type` vs `family` :
-- `programs.program_type` (ENUM omra/hajj/tourisme/autre) existait déjà et
-- distingue precisement Omra/Hajj des autres voyages — il aurait pu servir
-- de base à `family`. Il n'est cependant PAS fusionné avec `family` car :
--   1. `program_type` est déjà utilisé tel quel comme étiquette affichée
--      (badge sur les cartes, colonne "Type" dans l'admin) avec 4 valeurs
--      fines (omra / hajj / tourisme / autre) — le réduire à 2 valeurs
--      ferait perdre cette granularité déjà exploitée par l'UI existante.
--   2. `family` répond à un besoin différent : le routage/la navigation du
--      site public (2 hubs), qui a besoin d'un groupe binaire stable même
--      si `program_type` gagne de nouvelles valeurs plus tard (ex: un
--      5e type de voyage organisé).
-- `family` est donc une colonne dérivée et indépendante, initialisée une
-- fois à partir de `program_type` puis modifiable librement ensuite
-- (aucun recalcul automatique après cette migration).
-- =====================================================================

SET NAMES utf8mb4;

-- 1. Colonnes ajoutées en NULL d'abord (pas de valeur par défaut imposée
--    par magie : `family` est classé ligne par ligne juste après).
ALTER TABLE programs
  ADD COLUMN family ENUM('omra_hajj', 'voyage_organise') NULL
    COMMENT 'Famille de catalogue pour la navigation publique (hub Omra&Hajj vs hub Voyages organisés)'
    AFTER program_type,
  ADD COLUMN season ENUM('mawlid', 'rajab', 'chaabane', 'ramadan', 'chawal') NULL
    COMMENT 'Saison du calendrier hégirien — pertinent uniquement si family = omra_hajj'
    AFTER family,
  ADD COLUMN theme VARCHAR(50) NULL
    COMMENT 'Tag libre (plage, culture, aventure, famille, couple...) — pertinent uniquement si family = voyage_organise'
    AFTER season;

-- 2. Classement des lignes existantes à partir de `program_type` (mapping
--    vérifié sur les valeurs réelles de l'ENUM program_type : omra/hajj
--    -> omra_hajj ; tourisme/autre -> voyage_organise).
UPDATE programs
SET family = CASE
  WHEN program_type IN ('omra', 'hajj') THEN 'omra_hajj'
  ELSE 'voyage_organise'
END
WHERE family IS NULL;

-- 3. Garde-fou : la migration s'arrête si une ligne reste orpheline avant
--    d'appliquer la contrainte NOT NULL (ne doit normalement jamais se
--    déclencher vu l'UPDATE ci-dessus, qui couvre tous les cas de l'ENUM).
--    Si ce SIGNAL se déclenche, classez manuellement les lignes concernées
--    puis relancez la migration.
SET @orphans = (SELECT COUNT(*) FROM programs WHERE family IS NULL);
SET @msg = CONCAT('Migration interrompue : ', @orphans, ' programme(s) sans family assignée');
SET @sql = IF(@orphans > 0, CONCAT('SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT = ''', @msg, ''''), 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. Contrainte NOT NULL une fois toutes les lignes classées.
ALTER TABLE programs
  MODIFY COLUMN family ENUM('omra_hajj', 'voyage_organise') NOT NULL;

-- 5. Index pour les requêtes de listing par famille (hubs publics).
ALTER TABLE programs
  ADD INDEX idx_program_family (family);
