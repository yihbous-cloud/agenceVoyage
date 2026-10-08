-- Nom de l'hôtel en arabe : affiché à la place de `name` quand l'espace
-- interne (cookie gf_locale) ou la page publique est en arabe ; NULL = repli
-- sur `name`. Voir lib/hotelNames.js.
ALTER TABLE hotels ADD COLUMN name_arabic VARCHAR(150) NULL AFTER name;
