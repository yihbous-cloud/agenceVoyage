-- =====================================================================
-- MIGRATION 041 — Demande de compte par l'équipe, validée par un administrateur
-- =====================================================================
-- Un membre de l'équipe peut demander son propre compte depuis la page de
-- connexion (/admin/demande-compte). Le compte est créé INACTIF, au statut
-- « en_attente », et ne peut pas se connecter tant qu'un administrateur
-- (permission utilisateurs.manage) ne l'a pas validé depuis
-- /admin/parametres/utilisateurs — c'est l'administrateur qui choisit alors
-- son rôle (le demandeur n'en choisit pas).
-- Les comptes existants (créés par un administrateur ou par script) sont
-- « valide » par défaut : aucun changement de comportement pour eux.
-- =====================================================================

SET NAMES utf8mb4;

ALTER TABLE staff_users
  ADD COLUMN approval_status ENUM('en_attente', 'valide', 'refuse') NOT NULL DEFAULT 'valide' AFTER is_active,
  ADD COLUMN reviewed_by_staff_id BIGINT UNSIGNED NULL AFTER approval_status,
  ADD COLUMN reviewed_at DATETIME NULL AFTER reviewed_by_staff_id,
  ADD KEY idx_staff_users_approval (agency_id, approval_status),
  ADD CONSTRAINT fk_staff_users_reviewer FOREIGN KEY (reviewed_by_staff_id) REFERENCES staff_users(id) ON DELETE SET NULL;
