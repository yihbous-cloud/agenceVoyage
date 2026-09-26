-- Retouches du catalogue hôtels après usage réel (migration 022) :
-- 1. Étoiles en texte libre (VARCHAR) pour autoriser des notations comme
--    "4+"/"5+", courantes dans l'hôtellerie — un TINYINT ne peut pas les
--    stocker. Les valeurs numériques déjà saisies restent valides telles
--    quelles (MySQL les convertit en chaîne sans perte).
-- 2. Quotas de chambres réservées par type rendus NULL-able (NULL = ce
--    type de chambre n'existe pas dans cet hôtel, distinct de 0 = existe
--    mais aucune réservée) — certains hôtels n'ont par exemple aucune
--    chambre quintuple. Voir CLAUDE.md.
ALTER TABLE hotels
    MODIFY COLUMN star_rating VARCHAR(10) NULL COMMENT 'ex: 3, 4, 4+, 5+ (migration 023)',
    MODIFY COLUMN reserved_rooms_simple INT UNSIGNED NULL DEFAULT NULL COMMENT 'Quota réservé pour l''agence — NULL = ce type n''existe pas dans cet hôtel (migration 023)',
    MODIFY COLUMN reserved_rooms_double INT UNSIGNED NULL DEFAULT NULL,
    MODIFY COLUMN reserved_rooms_triple INT UNSIGNED NULL DEFAULT NULL,
    MODIFY COLUMN reserved_rooms_quadruple INT UNSIGNED NULL DEFAULT NULL,
    MODIFY COLUMN reserved_rooms_quintuple INT UNSIGNED NULL DEFAULT NULL;
