-- Prix par type de chambre (voir CLAUDE.md) — le prix affiché au public
-- est le plus bas des quatre (en pratique toujours le prix quintuple,
-- puisque plus il y a de personnes par chambre, moins c'est cher par
-- personne). Remplace l'ancien price_per_person, désormais déprécié.
ALTER TABLE trips
    ADD COLUMN price_double DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Prix par personne en chambre double/binôme' AFTER price_per_person,
    ADD COLUMN price_triple DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Prix par personne en chambre triple' AFTER price_double,
    ADD COLUMN price_quadruple DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Prix par personne en chambre quadruple' AFTER price_triple,
    ADD COLUMN price_quintuple DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Prix par personne en chambre quintuple — le plus bas, prix affiché au public' AFTER price_quadruple;

-- Rétro-remplissage : les voyages existants gardent le même prix affiché
-- (les 4 paliers = l'ancien price_per_person), à affiner ensuite au cas par cas.
UPDATE trips SET price_double = price_per_person, price_triple = price_per_person,
                  price_quadruple = price_per_person, price_quintuple = price_per_person;

ALTER TABLE trips MODIFY COLUMN price_per_person DECIMAL(10,2) NOT NULL DEFAULT 0.00
    COMMENT 'DEPRECIEE (migration 019) — remplacé par 4 prix par type de chambre (price_double/triple/quadruple/quintuple), le plus bas (quintuple) étant le prix affiché au public. Conservée pour l''historique, plus alimentée.';
