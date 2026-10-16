-- =====================================================================
-- MIGRATION 049 — Bouton WhatsApp flottant du site public
-- =====================================================================
-- Bouton rond en bas à droite de toutes les pages publiques, qui ouvre
-- WhatsApp avec un message pré-rempli modifiable dans « Paramètres
-- WhatsApp » (permission whatsapp.settings). Le code source « [SITE] »
-- est ajouté automatiquement à la fin (attribution de la source,
-- migration 046). Message vide = texte par défaut dans la langue de la
-- page. Numéro vide = le numéro WhatsApp des paramètres de l'agence.
-- =====================================================================

SET NAMES utf8mb4;

ALTER TABLE agencies
    ADD COLUMN wa_button_enabled BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'bouton WhatsApp flottant du site public' AFTER gtm_container_id,
    ADD COLUMN wa_button_number VARCHAR(30) NULL COMMENT 'vide : agencies.whatsapp' AFTER wa_button_enabled,
    ADD COLUMN wa_button_message_ar VARCHAR(500) NULL AFTER wa_button_number,
    ADD COLUMN wa_button_message_fr VARCHAR(500) NULL COMMENT 'utilisé aussi pour l anglais' AFTER wa_button_message_ar;
