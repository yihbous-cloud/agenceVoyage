-- Responsable (point de contact) d'un groupe/binôme — voir CLAUDE.md.
-- Un voyageur seul n'a besoin d'aucune donnée supplémentaire : il est
-- responsable de lui-même par simple règle d'affichage (COALESCE côté
-- requête), pas de colonne sur `registrations`.
ALTER TABLE registration_groups
  ADD COLUMN responsible_registration_id BIGINT UNSIGNED NULL COMMENT 'Voyageur responsable/point de contact du groupe (migration 027)' AFTER label,
  ADD FOREIGN KEY (responsible_registration_id) REFERENCES registrations(id) ON DELETE SET NULL;

-- Rétro-remplissage : le premier membre inscrit (id le plus bas) de chaque
-- groupe existant devient responsable par défaut, même règle "premier
-- voyageur saisi" qu'à la création — cohérent pour les groupes déjà en
-- base au moment de cette migration.
UPDATE registration_groups rg
JOIN (
  SELECT group_id, MIN(id) AS first_registration_id
  FROM registrations
  WHERE group_id IS NOT NULL
  GROUP BY group_id
) first_reg ON first_reg.group_id = rg.id
SET rg.responsible_registration_id = first_reg.first_registration_id
WHERE rg.responsible_registration_id IS NULL;
