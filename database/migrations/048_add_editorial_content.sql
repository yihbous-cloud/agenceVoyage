-- =====================================================================
-- MIGRATION 048 — Référencement, phase 2 vague 2B : outil éditorial
-- =====================================================================
-- Cahier des charges « Référencement global » §6, §8, §13 (CLAUDE.md
-- §3centdixhuitquadragies) :
--   * authors : auteurs et relecteurs des guides (E-E-A-T : rôle, expérience,
--     référent religieux) ;
--   * guides (+ guide_translations, modèle de la vague 1B) : articles de
--     fond sous /guide/<slug>, rattachés à un pilier ; un guide religieux
--     n'est publiable qu'avec un relecteur référent ;
--   * program_guides : guides choisis pour la fiche d'un programme ;
--   * glossary_terms : lexique bilingue (/guide/lexique) ;
--   * ia_knowledge étendue : la base de connaissances de l'agent WhatsApp
--     devient la banque de questions du site (une réponse = un endroit).
-- =====================================================================

SET NAMES utf8mb4;

CREATE TABLE authors (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(150) NOT NULL,
    name_ar VARCHAR(150) NULL COMMENT 'nom écrit en arabe (affiché sur le site en arabe)',
    job_title_fr VARCHAR(150) NULL,
    job_title_ar VARCHAR(150) NULL,
    bio_fr TEXT NULL,
    bio_ar TEXT NULL,
    photo_url VARCHAR(500) NULL,
    trips_supervised INT UNSIGNED NULL COMMENT 'nombre de voyages encadrés (expérience affichée)',
    is_religious_referent BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'peut relire un guide religieux',
    staff_user_id BIGINT UNSIGNED NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_authors_agency (agency_id, is_active),
    CONSTRAINT fk_authors_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_authors_staff FOREIGN KEY (staff_user_id) REFERENCES staff_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE guides (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    slug VARCHAR(220) NOT NULL,
    content_locale ENUM('ar', 'fr') NOT NULL DEFAULT 'ar' COMMENT 'langue des champs de contenu ; l autre langue est dans guide_translations',
    pillar ENUM('omra', 'hajj', 'voyages', 'general') NOT NULL DEFAULT 'general',
    title VARCHAR(200) NOT NULL,
    excerpt VARCHAR(500) NULL,
    content MEDIUMTEXT NULL COMMENT 'Markdown',
    cover_image_url VARCHAR(500) NULL,
    meta_title VARCHAR(200) NULL,
    meta_description VARCHAR(300) NULL,
    author_id BIGINT UNSIGNED NULL,
    reviewer_id BIGINT UNSIGNED NULL COMMENT 'relecteur (référent religieux pour un guide religieux)',
    is_religious BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'contenu religieux : publication soumise à un relecteur référent',
    status ENUM('brouillon', 'publie') NOT NULL DEFAULT 'brouillon',
    published_at DATETIME NULL,
    reviewed_at DATE NULL COMMENT 'dernière relecture (affichée « Relu le »)',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_guides_slug (agency_id, slug),
    INDEX idx_guides_published (agency_id, status, pillar, published_at),
    CONSTRAINT fk_guides_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_guides_author FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE SET NULL,
    CONSTRAINT fk_guides_reviewer FOREIGN KEY (reviewer_id) REFERENCES authors(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE guide_translations (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    guide_id BIGINT UNSIGNED NOT NULL,
    locale ENUM('ar', 'fr', 'en') NOT NULL,
    title VARCHAR(200) NULL,
    excerpt VARCHAR(500) NULL,
    content MEDIUMTEXT NULL,
    meta_title VARCHAR(200) NULL,
    meta_description VARCHAR(300) NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_guide_translation (guide_id, locale),
    CONSTRAINT fk_guide_translations_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_guide_translations_guide FOREIGN KEY (guide_id) REFERENCES guides(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Guides affichés sur la fiche d'un programme (3 au plus ; à défaut, les
-- plus récents du même pilier).
CREATE TABLE program_guides (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    program_id BIGINT UNSIGNED NOT NULL,
    guide_id BIGINT UNSIGNED NOT NULL,
    sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    UNIQUE KEY uq_program_guide (program_id, guide_id),
    INDEX idx_program_guides_guide (agency_id, guide_id),
    CONSTRAINT fk_program_guides_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
    CONSTRAINT fk_program_guides_program FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE,
    CONSTRAINT fk_program_guides_guide FOREIGN KEY (guide_id) REFERENCES guides(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Lexique bilingue : textes courts, les deux langues dans la même ligne.
CREATE TABLE glossary_terms (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    agency_id BIGINT UNSIGNED NOT NULL,
    slug VARCHAR(150) NOT NULL,
    term_fr VARCHAR(150) NULL,
    term_ar VARCHAR(150) NULL,
    definition_fr TEXT NULL,
    definition_ar TEXT NULL,
    pillar ENUM('omra', 'hajj', 'voyages', 'general') NOT NULL DEFAULT 'general',
    status ENUM('brouillon', 'publie') NOT NULL DEFAULT 'brouillon',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_glossary_slug (agency_id, slug),
    INDEX idx_glossary_status (agency_id, status),
    CONSTRAINT fk_glossary_agency FOREIGN KEY (agency_id) REFERENCES agencies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Banque de questions = base de connaissances de l'agent WhatsApp.
ALTER TABLE ia_knowledge
  ADD COLUMN question_ar VARCHAR(500) NULL COMMENT 'question en arabe (site en arabe)' AFTER question,
  ADD COLUMN site_page ENUM('faq', 'omra', 'hajj', 'voyages') NULL COMMENT 'page du site où la question est affichée (NULL = agent seulement)' AFTER status,
  ADD COLUMN site_sort SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER site_page,
  ADD COLUMN detail_path VARCHAR(500) NULL COMMENT 'lien « En savoir plus » (chemin du site, sans préfixe de langue)' AFTER site_sort,
  ADD INDEX idx_ia_knowledge_site (agency_id, site_page, status);

INSERT INTO permissions (code, label, category, sort_order) VALUES
    ('contenus.manage', 'Contenus éditoriaux : guides, auteurs, lexique', 'Contenu public', 20);
-- Direction : déjà garantie au niveau code (aucune ligne nécessaire).
