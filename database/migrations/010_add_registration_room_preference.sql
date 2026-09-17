-- =====================================================================
-- MIGRATION 010 — Préférence hébergement à l'inscription
-- =====================================================================
-- Additive : le voyageur (via le personnel qui saisit ou met à jour son
-- inscription) peut exprimer un hôtel et un type de chambre souhaités.
-- Ce n'est qu'une PRÉFÉRENCE, pas l'affectation réelle (registrations.room_id,
-- inchangée) : l'affectation définitive reste faite par le personnel depuis
-- /admin/voyages/[tripId]/hebergement, qui doit composer avec les places
-- réellement disponibles et la règle de non-mixité par chambre.
-- =====================================================================

SET NAMES utf8mb4;

ALTER TABLE registrations
    ADD COLUMN preferred_hotel_id BIGINT UNSIGNED DEFAULT NULL
        COMMENT 'hôtel souhaité par le voyageur (préférence, pas l''affectation réelle)'
        AFTER room_id,
    ADD COLUMN preferred_room_type ENUM('simple', 'double', 'triple', 'quadruple', 'quintuple') DEFAULT NULL
        COMMENT 'type de chambre souhaité par le voyageur'
        AFTER preferred_hotel_id,
    ADD CONSTRAINT fk_registrations_preferred_hotel
        FOREIGN KEY (preferred_hotel_id) REFERENCES hotels(id);
