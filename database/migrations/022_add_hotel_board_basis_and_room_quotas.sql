-- Formule de restauration proposée par l'hôtel (attribut du catalogue,
-- réutilisé pour tous les voyages qui utilisent cet hôtel — distinct des
-- formules par ville des tarifs d'hébergement Omra/Hajj, migration 021,
-- qui restent spécifiques à un tarif précis) + quota de chambres réservées
-- par type pour l'agence (information/planification, distinct des chambres
-- réelles créées par voyage dans `rooms`). Voir CLAUDE.md.
ALTER TABLE hotels
    ADD COLUMN board_basis ENUM('logement_seul', 'petit_dejeuner', 'demi_pension') NOT NULL DEFAULT 'logement_seul' COMMENT 'Formule de restauration proposée par l''hôtel' AFTER star_rating,
    ADD COLUMN reserved_rooms_simple INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Quota de chambres simples réservées pour l''agence (planification, distinct des chambres réelles de rooms)',
    ADD COLUMN reserved_rooms_double INT UNSIGNED NOT NULL DEFAULT 0,
    ADD COLUMN reserved_rooms_triple INT UNSIGNED NOT NULL DEFAULT 0,
    ADD COLUMN reserved_rooms_quadruple INT UNSIGNED NOT NULL DEFAULT 0,
    ADD COLUMN reserved_rooms_quintuple INT UNSIGNED NOT NULL DEFAULT 0;
