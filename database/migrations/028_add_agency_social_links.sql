-- Réseaux sociaux de l'agence, liste extensible (Facebook, Instagram,
-- TikTok, n'importe quelle plateforme en texte libre) éditable depuis
-- /admin/parametres, affichée dans le footer public — voir CLAUDE.md.
CREATE TABLE agency_social_links (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
    platform VARCHAR(50) NOT NULL,
    url VARCHAR(255) NOT NULL,
    sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    FOREIGN KEY (agency_id) REFERENCES agencies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
