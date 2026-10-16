-- =====================================================================
-- MIGRATION 050 — Organisateur d'un programme (usage interne)
-- =====================================================================
-- Un programme est organisé par l'un de trois organisateurs :
--   agence_ouled_teima      — l'agence Ouled Teima
--   groupe_golden_fantastic — le groupe Golden Fantastic
--   groupement              — groupement (« تشاركي » en arabe)
-- Information réservée à l'espace interne : jamais affichée ni mentionnée
-- côté client (site public, JSON-LD, llms.txt, API publique, WhatsApp).
-- NULL = programme existant dont l'organisateur n'a pas encore été choisi.
-- =====================================================================

SET NAMES utf8mb4;

ALTER TABLE programs
    ADD COLUMN organizer ENUM('agence_ouled_teima', 'groupe_golden_fantastic', 'groupement') NULL
        COMMENT 'organisateur (usage interne, jamais public)' AFTER program_type,
    ADD INDEX idx_programs_organizer (agency_id, organizer);
