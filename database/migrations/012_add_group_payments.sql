-- =====================================================================
-- MIGRATION 012 — Paiement et suivi financier partagés par groupe
-- =====================================================================
-- Un binôme/groupe créé ensemble (voir migration 011) partage désormais UN
-- SEUL montant dû et UN SEUL historique de versements pour tout le groupe,
-- au lieu d'un montant par personne. Le détail individuel (passeport,
-- visa, statut) reste par voyageur, inchangé — seul le volet financier
-- est mutualisé.
--
-- payments.registration_id devient nullable : un paiement cible SOIT une
-- inscription individuelle (registration_id), SOIT un groupe (group_id),
-- jamais les deux ni aucun des deux (CHECK). Les paiements existants
-- restent tous rattachés à registration_id, group_id NULL — comportement
-- inchangé pour toute inscription hors groupe.
-- =====================================================================

SET NAMES utf8mb4;

ALTER TABLE registration_groups
    ADD COLUMN total_due DECIMAL(10,2) NOT NULL DEFAULT 0.00
        COMMENT 'montant total dû partagé par tout le groupe (paiement suivi au niveau du groupe, pas par membre)';

ALTER TABLE payments
    MODIFY COLUMN registration_id BIGINT UNSIGNED NULL,
    ADD COLUMN group_id BIGINT UNSIGNED NULL AFTER registration_id,
    ADD CONSTRAINT fk_payments_group FOREIGN KEY (group_id) REFERENCES registration_groups(id),
    ADD CONSTRAINT chk_payment_target CHECK (
        (registration_id IS NOT NULL AND group_id IS NULL) OR
        (registration_id IS NULL AND group_id IS NOT NULL)
    );
