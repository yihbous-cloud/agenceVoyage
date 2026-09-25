-- Aéroports du retour indépendants de l'aller (jusqu'ici un seul couple
-- origin_iata/destination_iata servait aux deux sens, retour = sens
-- inversé — ne permettait pas un retour depuis/vers un aéroport différent,
-- ex. retour depuis Médine plutôt que Djeddah). Voir CLAUDE.md.
-- Déprécie aussi flight_ticket_price : le prix du billet est désormais
-- inclus dans price_per_person, plus facturé à part.
ALTER TABLE trips
    ADD COLUMN return_origin_iata CHAR(3) NULL COMMENT 'aéroport de départ au retour, NULL = même aéroport que l''arrivée à l''aller (sens inversé)' AFTER return_layover_iata,
    ADD COLUMN return_destination_iata CHAR(3) NULL COMMENT 'aéroport d''arrivée au retour, NULL = même aéroport que le départ à l''aller (sens inversé)' AFTER return_origin_iata,
    MODIFY COLUMN flight_ticket_price DECIMAL(10,2) NULL COMMENT 'DEPRECIEE (migration 018) — prix désormais inclus dans price_per_person, conservée pour l''historique mais plus alimentée';
