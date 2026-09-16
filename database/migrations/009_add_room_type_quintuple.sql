-- =====================================================================
-- MIGRATION 009 — Type de chambre 5 personnes (quintuple)
-- =====================================================================
-- Additive : ajoute 'quintuple' à l'énumération room_type. Chaque type est
-- désormais strictement attaché à une capacité fixe côté interface admin
-- (simple=1, double=2, triple=3, quadruple=4, quintuple=5) — voir
-- HebergementManager.jsx (ROOM_TYPE_CAPACITY), le champ Capacité y est
-- verrouillé (lecture seule, dérivé du type).
-- =====================================================================

SET NAMES utf8mb4;

ALTER TABLE rooms
    MODIFY COLUMN room_type ENUM('simple', 'double', 'triple', 'quadruple', 'quintuple') NOT NULL;
