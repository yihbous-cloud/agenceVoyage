-- Image dédiée pour l'affichage mobile du slider d'accueil, distincte de
-- l'image desktop existante (image_url) — le hero étant recadré très
-- différemment selon l'appareil (large sur desktop, étroit et vertical sur
-- mobile), une seule image ne cadre pas bien sur les deux. NULL = pas
-- d'image mobile dédiée, HeroSlider.jsx retombe alors sur image_url. Voir
-- CLAUDE.md.
ALTER TABLE slides
    ADD COLUMN mobile_image_url VARCHAR(500) NULL COMMENT 'Image de fond pour l''affichage mobile — NULL = repli sur image_url' AFTER image_url;
