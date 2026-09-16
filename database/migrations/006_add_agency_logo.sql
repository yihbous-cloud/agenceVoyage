-- =====================================================================
-- MIGRATION 006 — Logo de l'agence
-- =====================================================================
-- Additive : nouvelle colonne sur agency_settings (ligne unique, voir
-- migration 003). Uploadé depuis /admin/parametres via l'API d'upload
-- générique (public/uploads/agency/), même mécanisme que l'image de
-- couverture des programmes.
-- =====================================================================

SET NAMES utf8mb4;

ALTER TABLE agency_settings
    ADD COLUMN logo_url VARCHAR(255) NULL COMMENT 'chemin public (/uploads/agency/...)' AFTER name;
