-- Escale (vol aller et vol retour) sur le voyage — voir CLAUDE.md.
-- L'itinéraire (origin_iata/destination_iata) reste un seul couple partagé
-- entre aller et retour (mêmes aéroports, sens inversé au retour) ; seule
-- l'escale éventuelle peut différer entre les deux vols.
ALTER TABLE trips
    ADD COLUMN outbound_layover_iata CHAR(3) NULL COMMENT 'aéroport d''escale à l''aller, NULL = vol direct' AFTER destination_iata,
    ADD COLUMN return_layover_iata CHAR(3) NULL COMMENT 'aéroport d''escale au retour, NULL = vol direct' AFTER outbound_layover_iata;
