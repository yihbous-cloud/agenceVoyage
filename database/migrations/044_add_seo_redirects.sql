-- =====================================================================
-- MIGRATION 044 — Référencement, phase 1 vague 1A : redirections 301,
-- journal IndexNow, programme successeur
-- =====================================================================
-- Cahier des charges « Référencement global » (CLAUDE.md §3centquatorzequadragies) :
--   * redirects : une URL publique ne casse jamais. Toute URL qui change
--     (slug, pilier), qui est dépubliée ou supprimée redirige (301) vers la
--     bonne page ; gérée aussi à la main depuis /admin/referencement.
--     Chemins SANS préfixe de langue (un slug est commun à toutes les
--     langues) : /omra/ancien redirige aussi /fr/omra/ancien.
--   * seo_indexnow_pings : journal des notifications IndexNow (TECH-17).
--   * programs.successor_program_id : « prochaine édition » affichée sur la
--     fiche d'un programme dont tous les départs sont terminés (TECH-09).
-- =====================================================================

SET NAMES utf8mb4;

CREATE TABLE redirects (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    from_path VARCHAR(500) NOT NULL COMMENT 'Chemin public SANS préfixe de langue, ex. /omra/ancien-slug',
    to_path VARCHAR(500) NOT NULL COMMENT 'Chemin cible sans préfixe de langue, ou URL absolue https://',
    status_code SMALLINT UNSIGNED NOT NULL DEFAULT 301,
    source ENUM('manuel', 'auto_slug', 'auto_depublication', 'auto_suppression') NOT NULL DEFAULT 'manuel',
    hits INT UNSIGNED NOT NULL DEFAULT 0,
    last_hit_at DATETIME NULL,
    created_by_staff_id BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_redirect_from (agency_id, from_path(255)),
    KEY idx_redirect_to (agency_id, to_path(255)),
    CONSTRAINT fk_redirects_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_redirects_staff FOREIGN KEY (created_by_staff_id) REFERENCES staff_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE seo_indexnow_pings (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    url_count INT UNSIGNED NOT NULL DEFAULT 0,
    urls JSON NULL,
    status ENUM('envoye', 'echec', 'ignore') NOT NULL,
    http_status SMALLINT UNSIGNED NULL,
    message VARCHAR(500) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_indexnow_agency_date (agency_id, created_at),
    CONSTRAINT fk_indexnow_agency FOREIGN KEY (agency_id) REFERENCES agencies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE programs
  ADD COLUMN successor_program_id BIGINT UNSIGNED NULL
    COMMENT 'Programme qui prend la suite, affiché quand tous les départs sont terminés (migration 044)' AFTER is_published,
  ADD CONSTRAINT fk_programs_successor FOREIGN KEY (successor_program_id) REFERENCES programs(id) ON DELETE SET NULL;

INSERT INTO permissions (code, label, category, sort_order) VALUES
    ('seo.manage', 'Référencement : redirections, indexation, sources des leads', 'Référencement', 10);
-- Direction : déjà garantie au niveau code (aucune ligne nécessaire).
