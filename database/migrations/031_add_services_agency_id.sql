-- Multi-agences, passe 2 : le catalogue de services (lib/services.js) était
-- resté global à la passe 1. /admin/services permettant de créer, modifier et
-- supprimer ces lignes, une agence pouvait modifier celles d'une autre : il
-- devient propre à chaque agence comme les autres catalogues.
ALTER TABLE services ADD COLUMN agency_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
  ADD CONSTRAINT fk_services_agency FOREIGN KEY (agency_id) REFERENCES agencies(id);
