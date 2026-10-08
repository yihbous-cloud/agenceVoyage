-- PNR (référence de réservation) du voyage auprès de sa compagnie aérienne
-- (trips.airline_id) — voir CLAUDE.md.
ALTER TABLE trips ADD COLUMN pnr VARCHAR(10) NULL COMMENT 'PNR de la réservation groupe auprès de la compagnie (migration 030)' AFTER airline_id;
